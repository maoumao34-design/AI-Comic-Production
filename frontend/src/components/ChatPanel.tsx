import { useState } from 'react'
import type { Episode, RunInfo, StepId } from '../types'
import { STEP_LABELS, STEP_ORDER } from '../types'

export interface LogEntry {
  id: string
  ts: string
  kind: 'user' | 'system'
  text: string
}

interface Props {
  episodes: Episode[]
  current?: Episode
  run?: RunInfo
  log: LogEntry[]
  busy?: boolean
  onSelectEpisode: (id: string) => void
  onCreateEpisode: (id: string, title: string) => Promise<void>
  onStartRun: () => Promise<void>
  onJumpStep: (step: StepId) => void
}

/** 对话区（MVP stub）：选/建集 → 发起 run → 活动 log + 步骤快跳 */
export function ChatPanel({ episodes, current, run, log, busy, onSelectEpisode, onCreateEpisode, onStartRun, onJumpStep }: Props) {
  const [mode, setMode] = useState<'run' | 'new'>('run')
  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')

  return (
    <div className="chat-panel">
      <div className="chat-tabs">
        <button className={mode === 'run' ? 'active' : ''} onClick={() => setMode('run')}>发起 / 继续 Run</button>
        <button className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>新建集</button>
      </div>

      {mode === 'run' && (
        <div className="chat-actions">
          <label>选择集号</label>
          <select value={current?.episode_id ?? ''} onChange={(e) => onSelectEpisode(e.target.value)}>
            <option value="" disabled>— 选择集 —</option>
            {episodes.map((e) => (
              <option key={e.episode_id} value={e.episode_id}>{e.episode_id} · {e.title}</option>
            ))}
          </select>
          <button className="btn primary" disabled={!current || busy} onClick={onStartRun}>
            ▶ 从当前步（{current ? STEP_LABELS[current.current_step] : '—'}）发起 run
          </button>
          {run && (
            <div className="run-state">
              <span className={`st st-${run.status}`}>run: {run.status}</span>
              <span>当前步 {STEP_LABELS[run.current_step]}</span>
            </div>
          )}
          {run && (
            <div className="step-jump">
              <label>步骤快跳（只读切换工作区焦点）</label>
              <div className="steps-row">
                {STEP_ORDER.map((s) => {
                  const si = run.steps.find((x) => x.step === s)
                  return (
                    <button
                      key={s}
                      className={`pill ${si?.status ?? 'pending'} ${run.current_step === s ? 'cur' : ''}`}
                      title={si?.status}
                      onClick={() => onJumpStep(s)}
                    >
                      {s.split('-')[0]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="chat-actions">
          <label>集号</label>
          <input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="如 EP-03" />
          <label>标题</label>
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="如 第3集 · …" />
          <button
            className="btn primary"
            disabled={!newId.trim() || !newTitle.trim() || busy}
            onClick={async () => {
              await onCreateEpisode(newId.trim(), newTitle.trim())
              setNewId('')
              setNewTitle('')
              setMode('run')
            }}
          >
            ＋ 新建集
          </button>
        </div>
      )}

      <div className="chat-log">
        <div className="log-head">活动记录</div>
        <ul>
          {log.length === 0 && <li className="muted">暂无活动</li>}
          {log.map((l) => (
            <li key={l.id} className={l.kind}>
              <span className="ts">{l.ts.slice(11, 19)}</span>
              <span className="txt">{l.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
