import { useState } from 'react'
import type { DecisionAction, StepId } from '../types'
import { DECISION_META } from '../types'

interface Props {
  status: string
  step?: StepId
  busy?: boolean
  onDecision: (action: DecisionAction, note?: string, paramsOverride?: Record<string, unknown>) => Promise<void>
}

const ORDER: DecisionAction[] = ['approve', 'revise', 'regenerate', 'rollback']

/** 可打回重做的版本态：人审中 / 已通过 / 失败（成片后仍可 ↩️） */
const ROLLBACKABLE = new Set(['awaiting_review', 'approved', 'failed'])

/** §2.3：✅✏️🔄 仅 awaiting_review；↩️ 任意可评审态均可（含 approved/done 打回），01 无上步除外 */
export function DecisionBar({ status, step, busy, onDecision }: Props) {
  const [active, setActive] = useState<DecisionAction | null>(null)
  const [note, setNote] = useState('')
  const [seed, setSeed] = useState('')
  const reviewable = status === 'awaiting_review'
  const canRollback = ROLLBACKABLE.has(status) && step !== '01'

  const reset = () => {
    setActive(null)
    setNote('')
    setSeed('')
  }

  const submit = async () => {
    if (!active) return
    if (active === 'revise' && !note.trim()) return
    const paramsOverride: Record<string, unknown> = {}
    if (active === 'regenerate' && seed.trim()) paramsOverride.seed = Number(seed)
    await onDecision(active, active === 'revise' ? note.trim() : undefined, paramsOverride)
    reset()
  }

  return (
    <div className="decision-bar">
      <div className="btns">
        {ORDER.map((a) => {
          const m = DECISION_META[a]
          const enabled = a === 'rollback' ? canRollback : reviewable
          const disabled = !enabled || !!busy
          return (
            <button
              key={a}
              className={`btn ${a} ${active === a ? 'active' : ''}`}
              disabled={disabled}
              title={a === 'rollback' && step === '01' ? '已在第一步，无法回退' : m.hint}
              onClick={() => (a === 'revise' || a === 'regenerate' ? setActive(a) : onDecision(a))}
            >
              <span className="ic">{m.icon}</span>
              {m.label}
            </button>
          )
        })}
      </div>

      {!reviewable && (
        <div className="status-note">
          当前状态「{status}」：✅✏️🔄 仅 awaiting_review 可用
          {canRollback ? '；↩️ 仍可回退打回上一步' : step === '01' ? '；已在第一步，无法回退' : '；当前态不可回退'}。
        </div>
      )}

      {active === 'revise' && (
        <div className="popover">
          <label>修改意见（revise 必填，会带着重跑当前步）</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="例：b2 的旁白情绪再强一点；S2 镜头景别改特写……" autoFocus />
          <div className="pop-actions">
            <button className="btn ghost" onClick={reset}>取消</button>
            <button className="btn revise" disabled={!note.trim() || busy} onClick={submit}>{DECISION_META.revise.icon} 提交修改</button>
          </div>
        </div>
      )}

      {active === 'regenerate' && (
        <div className="popover">
          <label>重生（换参重跑当前步，可不填则随机换参）</label>
          <div className="inline">
            <span>新 seed</span>
            <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="如 999（可选）" />
          </div>
          <div className="pop-actions">
            <button className="btn ghost" onClick={reset}>取消</button>
            <button className="btn regenerate" disabled={busy} onClick={submit}>{DECISION_META.regenerate.icon} 确认重生</button>
          </div>
        </div>
      )}
    </div>
  )
}
