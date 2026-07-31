import { useState } from 'react'
import type { StepVersion, DecisionAction } from '../types'
import { STEP_LABELS } from '../types'
import { StepContent } from './StepContent'
import { DecisionBar } from './DecisionBar'
import { VersionBrowser } from './VersionBrowser'

interface Props {
  /** 当前要 review 的 latest 版本 */
  current: StepVersion
  /** 该步全部版本（版本浏览器） */
  versions: StepVersion[]
  /** 浏览历史版本时预览用的版本；undefined=看 current */
  busy?: boolean
  onDecision: (action: DecisionAction, note?: string, paramsOverride?: Record<string, unknown>) => Promise<void>
}

/** 通用 StepView 外壳：StepHeader + StepContent + DecisionBar + VersionBrowser */
export function StepView({ current, versions, busy, onDecision }: Props) {
  const [preview, setPreview] = useState<StepVersion | null>(null)
  const viewing = preview ?? current
  const isReviewingCurrent = viewing.version === current.version

  return (
    <div className="step-view">
      <div className="step-main">
        <header className="step-header">
          <div className="title">{STEP_LABELS[current.step]}</div>
          <div className="sub">
            <span>版本 <b>{current.version}</b>{current.is_latest && <em className="latest">latest</em>}</span>
            <span className={`st st-${current.status}`}>{current.status}</span>
            {current.model && <span className="muted">· {current.model} · seed {current.seed ?? '—'}</span>}
            {current.failure && <span className="st st-failed">FAILED: {current.failure.reason}</span>}
          </div>
        </header>

        {!isReviewingCurrent && (
          <div className="callout warn">正在预览历史版本 {viewing.version}（{viewing.status}）。决策作用于 latest {current.version}，点版本列表的 {current.version} 回到当前。</div>
        )}

        <section className="step-content">
          <StepContent version={viewing} />
        </section>

        <footer className="step-foot">
          <DecisionBar status={current.status} busy={busy} onDecision={onDecision} />
        </footer>
      </div>

      <aside className="step-side">
        <VersionBrowser versions={versions} current={viewing} onSelect={setPreview} />
      </aside>
    </div>
  )
}
