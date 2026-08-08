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
  /** 正在查看非流水线当前步（历史已通过内容） */
  browsing?: boolean
  onDecision: (action: DecisionAction, note?: string, paramsOverride?: Record<string, unknown>) => Promise<void>
  onSelectVersion?: (version: StepVersion) => Promise<void>
}

/** model 可能是 string，也可能是磁盘导入的 {name,temperature} 对象——不能直接当 React 子节点渲染 */
function formatModel(model: unknown): string {
  if (model == null) return '—'
  if (typeof model === 'string' || typeof model === 'number') return String(model)
  if (typeof model === 'object' && model !== null && 'name' in model) {
    const n = (model as { name?: unknown }).name
    return typeof n === 'string' ? n : JSON.stringify(n)
  }
  try {
    return JSON.stringify(model)
  } catch {
    return String(model)
  }
}

/** 通用 StepView 外壳：平台槽位 + StepHeader + StepContent + DecisionBar + VersionBrowser + 接手面板 */
export function StepView({ current, versions, busy, health, browsing, onDecision, onSelectVersion }: Props) {
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
            <span>
              版本 <b>{current.version}</b>
              <em className="reviewing">审阅</em>
              {current.is_latest && <em className="latest">latest</em>}
            </span>
            <span className={`st st-${current.status}`}>{current.status}</span>
            {current.model != null && current.model !== '' && (
              <span className="muted">· {formatModel(current.model)} · seed {current.seed ?? '—'}</span>
            )}
            {current.failure && (
              <span className="st st-failed">
                FAILED: {typeof current.failure.reason === 'string' ? current.failure.reason : 'error'}
              </span>
            )}
          </div>
        </header>

        <PlatformSlotPanel
          step={current.step}
          health={health}
          selected={providerForStep}
          onSelect={setProvider}
        />

        {browsing && (
          <div className="callout info">
            正在浏览历史步骤 {STEP_LABELS[current.step]}（已归档内容）。这不会改变流水线当前位置；要改这一步请先 ↩️ 退回到该步。
          </div>
        )}
        {!isReviewingCurrent && (
          <div className="callout warn">
            正在预览 {viewing.version}（只读）。点「选用此版」后，✅/✏️/🔄 将作用于该版；不会删除更新的版本，也不会退到上一步。
          </div>
        )}

        <section className="step-content">
          <StepContent version={viewing} />
        </section>

        <footer className="step-foot">
          {browsing ? (
            <div className="callout info">历史浏览中 · 决策按钮已隐藏。回到流水线当前步后再 ✅✏️↩️🔄。</div>
          ) : (
            <DecisionBar status={current.status} step={current.step} busy={busy} onDecision={handleDecision} />
          )}
        </footer>
      </div>

      <aside className="step-side">
        <VersionBrowser
          versions={versions}
          current={current}
          preview={preview}
          onPreview={setPreview}
          onSelectVersion={onSelectVersion ? (v) => { void onSelectVersion(v) } : undefined}
          busy={busy}
        />
        <HandoffPanel version={viewing} />
      </aside>
    </div>
  )
}
