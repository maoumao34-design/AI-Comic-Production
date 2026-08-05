import { useEffect, useState } from 'react'
import type { StepVersion, DecisionAction, PlatformHealth } from '../types'
import { STEP_LABELS } from '../types'
import type { PlatformId } from '../platformSlots'
import { STEP_PLATFORM_SLOTS } from '../platformSlots'
import { StepContent } from './StepContent'
import { DecisionBar } from './DecisionBar'
import { VersionBrowser } from './VersionBrowser'
import { PlatformSlotPanel } from './PlatformSlotPanel'
import { HandoffPanel } from './HandoffPanel'

interface Props {
  current: StepVersion
  versions: StepVersion[]
  busy?: boolean
  health?: PlatformHealth
  onDecision: (action: DecisionAction, note?: string, paramsOverride?: Record<string, unknown>) => Promise<void>
}

/** 通用 StepView 外壳：平台槽位 + StepHeader + StepContent + DecisionBar + VersionBrowser + 接手面板 */
export function StepView({ current, versions, busy, health, onDecision }: Props) {
  const [preview, setPreview] = useState<StepVersion | null>(null)
  const slot = STEP_PLATFORM_SLOTS[current.step]
  const [provider, setProvider] = useState<PlatformId>(slot.primary.id)
  const viewing = preview ?? current
  const isReviewingCurrent = viewing.version === current.version

  useEffect(() => {
    setProvider(STEP_PLATFORM_SLOTS[current.step].primary.id)
    setPreview(null)
  }, [current.step, current.version])

  const providerForStep = slot.candidates.some((c) => c.id === provider)
    ? provider
    : slot.primary.id

  const handleDecision = async (
    action: DecisionAction,
    note?: string,
    paramsOverride?: Record<string, unknown>,
  ) => {
    const params = { ...(paramsOverride ?? {}) }
    // 多平台步：regenerate/revise 带上选定 provider（未锁定时仍可先选，导演确认后再 approve 流程外讨论）
    if (
      (action === 'regenerate' || action === 'revise') &&
      providerForStep !== 'none' &&
      STEP_PLATFORM_SLOTS[current.step].primary.id !== 'none'
    ) {
      params.provider = providerForStep
    }
    await onDecision(action, note, Object.keys(params).length ? params : undefined)
  }

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

        <PlatformSlotPanel
          step={current.step}
          health={health}
          selected={providerForStep}
          onSelect={setProvider}
        />

        {!isReviewingCurrent && (
          <div className="callout warn">正在预览历史版本 {viewing.version}（{viewing.status}）。决策作用于 latest {current.version}，点版本列表的 {current.version} 回到当前。</div>
        )}

        <section className="step-content">
          <StepContent version={viewing} />
        </section>

        <footer className="step-foot">
          <DecisionBar status={current.status} step={current.step} busy={busy} onDecision={handleDecision} />
        </footer>
      </div>

      <aside className="step-side">
        <VersionBrowser versions={versions} current={viewing} onSelect={setPreview} />
        <HandoffPanel version={viewing} />
      </aside>
    </div>
  )
}
