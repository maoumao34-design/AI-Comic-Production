import { useState } from 'react'
import type { DecisionAction } from '../types'
import { DECISION_META } from '../types'

interface Props {
  status: string
  busy?: boolean
  onDecision: (action: DecisionAction, note?: string, paramsOverride?: Record<string, unknown>) => Promise<void>
}

const ORDER: DecisionAction[] = ['approve', 'revise', 'regenerate', 'rollback']

/** §2.3 / PER-STEP-UI-SPEC §2、§5：四按钮，只在 awaiting_review 可点 */
export function DecisionBar({ status, busy, onDecision }: Props) {
  const [active, setActive] = useState<DecisionAction | null>(null)
  const [note, setNote] = useState('')
  const [seed, setSeed] = useState('')
  const reviewable = status === 'awaiting_review'

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
          const disabled = !reviewable || busy
          return (
            <button
              key={a}
              className={`btn ${a} ${active === a ? 'active' : ''}`}
              disabled={disabled}
              title={m.hint}
              onClick={() => (a === 'revise' || a === 'regenerate' ? setActive(a) : onDecision(a))}
            >
              <span className="ic">{m.icon}</span>
              {m.label}
            </button>
          )
        })}
      </div>

      {!reviewable && status !== 'awaiting_review' && (
        <div className="status-note">当前状态「{status}」，决策按钮仅在 awaiting_review 时可用。</div>
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
