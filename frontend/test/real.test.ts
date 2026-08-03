import { realApi } from '../src/api/client'
import type { ComicApi } from '../src/api/types'

const assert = (cond: boolean, msg: string) => {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg)
  console.log('  ✓', msg)
}

async function main() {
  const api: ComicApi = realApi('http://127.0.0.1:8000/api/v1')
  const rid = 'IT-' + Math.random().toString(36).slice(2, 6)
  console.log('== real front↔back integration test (backend :8000) ==  episode EP-' + rid)

  const ep = await api.createEpisode({ episode_id: 'EP-' + rid, title: '联调测试' })
  assert(ep.episode_id === 'EP-' + rid, `createEpisode (unwrap {episode}) -> ${ep.episode_id}`)

  const eps = await api.listEpisodes()
  assert(Array.isArray(eps) && eps.some((e) => e.episode_id === 'EP-' + rid), `listEpisodes (unwrap {episodes}) -> array`)

  const run = await api.startRun('EP-' + rid)
  assert(run.status === 'paused_at_checkpoint' && run.current_step === '01', `startRun (unwrap {run}) -> ${run.status} @ ${run.current_step}`)
  assert(Array.isArray(run.steps) && run.steps.length === 7, `run.steps object→array -> ${run.steps.length} items`)

  const cur01 = await api.getCurrentVersion('EP-' + rid, '01')
  assert(cur01.status === 'awaiting_review' && cur01.step === '01', `getCurrentVersion 01 (unwrap {version}) -> ${cur01.status}`)

  const afterApprove = await api.postDecision('EP-' + rid, '01', { version: cur01.version, action: 'approve' })
  assert(afterApprove.current_step === '02', `approve 01 → 02 (decision slim result + getRun)`)
  assert(Array.isArray(afterApprove.steps), `postDecision returns full RunInfo (steps array)`)

  const vs02 = await api.listVersions('EP-' + rid, '02')
  assert(Array.isArray(vs02) && vs02.length >= 1, `listVersions 02 (unwrap {versions})`)

  const afterRevise = await api.postDecision('EP-' + rid, '02', { version: vs02[0].version, action: 'revise', note: '景别改特写' })
  assert(afterRevise.current_step === '02', `revise 02 stays on 02`)
  const vs02b = await api.listVersions('EP-' + rid, '02')
  assert(vs02b.length === 2, `revise produced 2nd version (got ${vs02b.length})`)

  // 注意：后端 is_latest 仅标「已通过」版本（contract §3）；要评审的当前版走 /current
  const cur02 = await api.getCurrentVersion('EP-' + rid, '02')
  const afterRegen = await api.postDecision('EP-' + rid, '02', { version: cur02.version, action: 'regenerate', params_override: { seed: 7777 } })
  assert(afterRegen.current_step === '02', `regenerate 02 stays on 02`)

  const cur02b = await api.getCurrentVersion('EP-' + rid, '02')
  const afterRollback = await api.postDecision('EP-' + rid, '02', { version: cur02b.version, action: 'rollback' })
  assert(afterRollback.current_step === '01', `rollback 02 → 01 (got ${afterRollback.current_step})`)

  const h = await api.getPlatformHealth()
  assert(h.comfyui.status === 'unconfigured', `getPlatformHealth honest -> comfyui ${h.comfyui.status}`)

  console.log('\nREAL INTEGRATION PASSED ✅  (前端 realApi ↔ 后端 :8000 跑通完整闭环)')
}

main().catch((e) => {
  console.error('\nINTEGRATION TEST FAILED:', e)
  process.exit(1)
})
