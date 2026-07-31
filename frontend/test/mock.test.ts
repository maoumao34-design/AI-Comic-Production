import { mockApi } from '../src/api/mock'
import { STEP_LABELS } from '../src/types'

const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg)
  console.log('  ✓', msg)
}

async function main() {
  console.log('== mock state-machine test ==')

  const eps = await mockApi.listEpisodes()
  assert(eps.length >= 1, `listEpisodes returns ${eps.length} episode(s)`)
  const ep01 = eps.find((e) => e.episode_id === 'EP-01')!
  assert(ep01.current_step === '02-storyboard', `EP-01 starts at 02-storyboard (got ${ep01.current_step})`)

  const run = await mockApi.startRun('EP-01')
  console.log('  run status:', run.status, 'current_step:', STEP_LABELS[run.current_step])

  // 当前要 review 的是 02 v1，状态 awaiting_review
  const cur02 = await mockApi.getCurrentVersion('EP-01', '02-storyboard')
  assert(cur02.status === 'awaiting_review', `02 current version is awaiting_review (got ${cur02.status})`)
  assert(cur02.version === 'v1', `02 current version is v1 (got ${cur02.version})`)

  // ✅ approve 02 → 应推进到 03
  const afterApprove = await mockApi.postDecision('EP-01', '02-storyboard', { version: 'v1', action: 'approve' })
  assert(afterApprove.current_step === '03-assets', `approve 02 advances to 03-assets (got ${afterApprove.current_step})`)
  console.log('  after approve 02 ->', STEP_LABELS[afterApprove.current_step])

  // 03 当前版本应是 awaiting_review（推进时生成的占位）
  const cur03 = await mockApi.getCurrentVersion('EP-01', '03-assets')
  assert(cur03.status === 'awaiting_review', `03 current is awaiting_review (got ${cur03.status})`)

  // ✏️ revise 03（带 note）→ 仍在 03，且出新版本 v2 awaiting_review
  const afterRevise = await mockApi.postDecision('EP-01', '03-assets', { version: cur03.version, action: 'revise', note: '角色三视图表情再严肃一点' })
  assert(afterRevise.current_step === '03-assets', `revise 03 stays on 03 (got ${afterRevise.current_step})`)
  const vs03 = await mockApi.listVersions('EP-01', '03-assets')
  assert(vs03.length === 2, `revise produced a 2nd version on 03 (got ${vs03.length})`)
  const latest03 = vs03.find((v) => v.is_latest)!
  assert(latest03.version === 'v2' && latest03.status === 'awaiting_review', `03 latest is v2 awaiting_review`)
  console.log('  after revise 03 -> versions:', vs03.map((v) => `${v.version}:${v.status}`).join(', '))

  // 🔄 regenerate 03（带新 seed）→ 仍 03，第 3 版
  const afterRegen = await mockApi.postDecision('EP-01', '03-assets', { version: 'v2', action: 'regenerate', params_override: { seed: 999 } })
  assert(afterRegen.current_step === '03-assets', `regenerate 03 stays on 03`)
  const vs03b = await mockApi.listVersions('EP-01', '03-assets')
  const latest03b = vs03b.find((v) => v.is_latest)!
  assert(latest03b.seed === 999, `regenerate applied new seed 999 (got ${latest03b.seed})`)
  console.log('  after regenerate 03 -> latest seed:', latest03b.seed)

  // ↩️ rollback 03 → 回到 02
  const afterRollback = await mockApi.postDecision('EP-01', '03-assets', { version: latest03b.version, action: 'rollback' })
  assert(afterRollback.current_step === '02-storyboard', `rollback 03 returns to 02-storyboard (got ${afterRollback.current_step})`)
  console.log('  after rollback 03 ->', STEP_LABELS[afterRollback.current_step])

  // 平台健康：mock 如实报未配置
  const h = await mockApi.getPlatformHealth()
  assert(h.comfyui === 'not_configured', `platform health honest: comfyui not_configured`)

  console.log('\nALL ASSERTIONS PASSED ✅')
}

main().catch((e) => {
  console.error('\nTEST FAILED:', e)
  process.exit(1)
})
