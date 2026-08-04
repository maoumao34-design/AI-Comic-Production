import { useState } from 'react'
import type { StepId, PlatformHealth } from '../types'
import { STEP_PLATFORM_SLOTS, type PlatformId } from '../platformSlots'

interface Props {
  step: StepId
  health?: PlatformHealth
  /** 当前选中的 provider（写入 regenerate params_override） */
  selected?: PlatformId
  onSelect?: (id: PlatformId) => void
}

/** 每步平台接入槽位：入口可见 + 健康态；多候选 discuss-first */
export function PlatformSlotPanel({ step, health, selected, onSelect }: Props) {
  const slot = STEP_PLATFORM_SLOTS[step]
  const value = selected ?? slot.primary.id
  const [openNote, setOpenNote] = useState(false)

  if (slot.primary.id === 'none') {
    return (
      <div className="platform-slot muted-slot">
        <div className="ps-head">平台入口</div>
        <div className="ps-body">{slot.note}</div>
      </div>
    )
  }

  const statusOf = (opt: (typeof slot.candidates)[0]) => {
    if (!opt.healthKey || !health) return { status: '—', detail: '' }
    const h = health[opt.healthKey]
    return { status: h?.status ?? '—', detail: h?.detail ?? '' }
  }

  return (
    <div className={`platform-slot ${slot.discussFirst ? 'discuss' : ''}`}>
      <div className="ps-head">
        <span>平台接入入口</span>
        {slot.discussFirst && <span className="chip warn">多平台未锁定 · 先讨论再定</span>}
      </div>

      <div className="ps-options">
        {slot.candidates.map((opt) => {
          const { status, detail } = statusOf(opt)
          const active = value === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              className={`ps-opt ${active ? 'active' : ''}`}
              title={detail || opt.label}
              onClick={() => onSelect?.(opt.id)}
              disabled={slot.candidates.length <= 1}
            >
              <span className="ps-label">{opt.label}</span>
              <span className={`st st-${status}`}>{status}</span>
            </button>
          )
        })}
      </div>

      <div className="ps-note">
        <button type="button" className="linkish" onClick={() => setOpenNote((x) => !x)}>
          {openNote ? '收起说明' : '接入说明 / 接手 agent'}
        </button>
        {openNote && <p>{slot.note}</p>}
      </div>
    </div>
  )
}
