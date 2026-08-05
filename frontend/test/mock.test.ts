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
  assert(ep01.current_step === '02', `EP-01 starts at 02 (got ${ep01.current_step})`)

  const run = await mockApi.startRun('EP-01')
  console.log('  run status:', run.status, 'current_step:', STEP_LABELS[run.current_step])

  const cur02 = await mockApi.getCurrentVersion('EP-01', '02')
  assert(cur02.status === 'awaiting_review', `02 current is awaiting_review (got ${cur02.status})`)
  assert(cur02.version === 'v1', `02 current is v1 (got ${cur02.version})`)

  // ✅ approve 02 → 推进 03
  const afterApprove = await mockApi.postDecision('EP-01', '02', { version: 'v1', action: 'approve' })
  assert(afterApprove.current_step === '03', `approve 02 advances to 03 (got ${afterApprove.current_step})`)
  console.log('  after approve 02 ->', STEP_LABELS[afterApprove.current_step])

  const cur03 = await mockApi.getCurrentVersion('EP-01', '03')
  assert(cur03.status === 'awaiting_review', `03 current is awaiting_review`)

  // ✏️ revise 03 → 仍 03，出新版
  const afterRevise = await mockApi.postDecision('EP-01', '03', { version: cur03.version, action: 'revise', note: '角色三视图表情再严肃一点' })
  assert(afterRevise.current_step === '03', `revise 03 stays on 03`)
  const vs03 = await mockApi.listVersions('EP-01', '03')
  assert(vs03.length === 2, `revise produced 2nd version (got ${vs03.length})`)
  console.log('  after revise 03 ->', vs03.map((v) => `${v.version}:${v.status}`).join(', '))

  // 🔄 regenerate 03（新 seed）
  const latest03 = vs03.find((v) => v.is_latest)!
  const afterRegen = await mockApi.postDecision('EP-01', '03', { version: latest03.version, action: 'regenerate', params_override: { seed: 999 } })
  assert(afterRegen.current_step === '03', `regenerate 03 stays on 03`)
  const vs03b = await mockApi.listVersions('EP-01', '03')
  const latest03b = vs03b.find((v) => v.is_latest)!
  assert(latest03b.seed === 999, `regenerate applied seed 999 (got ${latest03b.seed})`)

  // ↩️ rollback 03 → 回 02
  const afterRollback = await mockApi.postDecision('EP-01', '03', { version: latest03b.version, action: 'rollback' })
  assert(afterRollback.current_step === '02', `rollback 03 returns to 02 (got ${afterRollback.current_step})`)
  console.log('  after rollback 03 ->', STEP_LABELS[afterRollback.current_step])

  // 成片后仍可 ↩️：推进到 done，再从 approved 末步回退
  let step: '02' | '03' | '04' | '05' | '06' | '07' = '02'
  while (true) {
    const cur = await mockApi.getCurrentVersion('EP-01', step)
    const r = await mockApi.postDecision('EP-01', step, { version: cur.version, action: 'approve' })
    if (r.status === 'done' || !r.current_step || r.current_step === step) break
    step = r.current_step as typeof step
  }
  const epDone = await mockApi.getEpisode('EP-01')
  assert(epDone.status === 'done', `episode reaches done (got ${epDone.status})`)
  const cur07 = await mockApi.getCurrentVersion('EP-01', '07')
  assert(cur07.status === 'approved', `07 is approved after done (got ${cur07.status})`)
  const afterDoneRollback = await mockApi.postDecision('EP-01', '07', { version: cur07.version, action: 'rollback' })
  assert(afterDoneRollback.current_step === '06', `rollback after done 07 → 06 (got ${afterDoneRollback.current_step})`)
  const epReopen = await mockApi.getEpisode('EP-01')
  assert(epReopen.status === 'in_progress', `done → rollback reopens episode (got ${epReopen.status})`)
  console.log('  after done-rollback 07 ->', STEP_LABELS[afterDoneRollback.current_step], 'ep:', epReopen.status)

  const h = await mockApi.getPlatformHealth()
  assert(h.comfyui.status === 'unconfigured', `platform health honest: comfyui unconfigured`)

  console.log('\nALL ASSERTIONS PASSED ✅')
}

main().catch((e) => {
  console.error('\nTEST FAILED:', e)
  process.exit(1)
})
