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
  assert(cur02.is_latest === false, `02 awaiting_review is not is_latest yet (got ${cur02.is_latest})`)

  // ✅ approve 02 → 推进 03；v1 变 is_latest
  const afterApprove = await mockApi.postDecision('EP-01', '02', { version: 'v1', action: 'approve' })
  assert(afterApprove.current_step === '03', `approve 02 advances to 03 (got ${afterApprove.current_step})`)
  const approved02 = (await mockApi.listVersions('EP-01', '02')).find((v) => v.version === 'v1')!
  assert(approved02.is_latest === true && approved02.status === 'approved', `approve sets is_latest on 02/v1`)
  console.log('  after approve 02 ->', STEP_LABELS[afterApprove.current_step])

  const cur03 = await mockApi.getCurrentVersion('EP-01', '03')
  assert(cur03.status === 'awaiting_review', `03 current is awaiting_review`)
  assert(cur03.is_latest === false, `03 placeholder not is_latest until approve`)

  // ✏️ revise 03 → 仍 03，出新版；决策打在 current，不改 is_latest
  const afterRevise = await mockApi.postDecision('EP-01', '03', { version: cur03.version, action: 'revise', note: '角色三视图表情再严肃一点' })
  assert(afterRevise.current_step === '03', `revise 03 stays on 03`)
  const vs03 = await mockApi.listVersions('EP-01', '03')
  assert(vs03.length === 2, `revise produced 2nd version (got ${vs03.length})`)
  const cur03b = await mockApi.getCurrentVersion('EP-01', '03')
  assert(cur03b.version === 'v2', `after revise current is v2 (got ${cur03b.version})`)
  console.log('  after revise 03 ->', vs03.map((v) => `${v.version}:${v.status}`).join(', '))

  // 🔄 regenerate 03（新 seed）— 用 getCurrentVersion，不用 is_latest
  const afterRegen = await mockApi.postDecision('EP-01', '03', { version: cur03b.version, action: 'regenerate', params_override: { seed: 999 } })
  assert(afterRegen.current_step === '03', `regenerate 03 stays on 03`)
  const cur03c = await mockApi.getCurrentVersion('EP-01', '03')
  assert(cur03c.seed === 999, `regenerate applied seed 999 (got ${cur03c.seed})`)
  assert(cur03c.version === 'v3', `after regen current is v3 (got ${cur03c.version})`)
  const vs03c = await mockApi.listVersions('EP-01', '03')
  assert(vs03c.length === 3, `three versions archived (got ${vs03c.length})`)
  assert(vs03c.every((v) => !v.is_latest), `no is_latest until approve on 03`)

  // —— 选用旧版（SELECT-VERSION-CONTRACT §6）——
  const afterSelect = await mockApi.selectVersion('EP-01', '03', 'v1')
  assert(afterSelect.current_step === '03', `select-version does not change current_step`)
  const curAfterSelect = await mockApi.getCurrentVersion('EP-01', '03')
  assert(curAfterSelect.version === 'v1', `select v1 → current is v1 (got ${curAfterSelect.version})`)
  assert(curAfterSelect.status === 'awaiting_review', `selected version is awaiting_review`)
  const vsAfterSelect = await mockApi.listVersions('EP-01', '03')
  assert(vsAfterSelect.length === 3, `select keeps all archives (got ${vsAfterSelect.length})`)
  assert(vsAfterSelect.map((v) => v.version).sort().join(',') === 'v1,v2,v3', `v1/v2/v3 still present`)
  assert(vsAfterSelect.every((v) => !v.is_latest), `select does not move is_latest`)
  const v3 = vsAfterSelect.find((v) => v.version === 'v3')!
  assert(v3.status === 'superseded', `old current v3 becomes superseded`)
  console.log('  after select v1 -> current', curAfterSelect.version, 'archives', vsAfterSelect.map((v) => v.version).join(','))

  // 选用后 ✏️ → 出 v4，基线来自 v1；归档不删
  const afterSelectRevise = await mockApi.postDecision('EP-01', '03', { version: 'v1', action: 'revise', note: '从旧版改' })
  assert(afterSelectRevise.current_step === '03', `revise after select stays on 03`)
  const curV4 = await mockApi.getCurrentVersion('EP-01', '03')
  assert(curV4.version === 'v4', `revise after select bumps to v4 (got ${curV4.version})`)
  const vs04 = await mockApi.listVersions('EP-01', '03')
  assert(vs04.length === 4, `v1–v4 all kept (got ${vs04.length})`)
  assert(vs04.some((v) => v.version === 'v1'), `v1 archive retained`)

  // 幂等选用
  const idem = await mockApi.selectVersion('EP-01', '03', 'v4')
  assert((await mockApi.getCurrentVersion('EP-01', '03')).version === 'v4', `idempotent select current version`)
  assert(idem.current_step === '03', `idempotent select keeps step`)

  // ↩️ rollback 03 → 回 02
  const afterRollback = await mockApi.postDecision('EP-01', '03', { version: curV4.version, action: 'rollback' })
  assert(afterRollback.current_step === '02', `rollback 03 returns to 02 (got ${afterRollback.current_step})`)
  const vs03Keep = await mockApi.listVersions('EP-01', '03')
  assert(vs03Keep.length === 4, `rollback does not delete 03 archives (got ${vs03Keep.length})`)
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
