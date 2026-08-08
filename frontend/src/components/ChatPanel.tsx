import { useEffect, useState } from 'react'
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
  focusStep?: StepId
  seriesOptions?: string[]
  log: LogEntry[]
  busy?: boolean
  onSelectEpisode: (id: string) => void
  onCreateEpisode: (id: string, title: string, seriesId: string) => Promise<void>
  onSetSeries?: (seriesId: string) => Promise<void>
  onStartRun: () => Promise<void>
  onJumpStep: (step: StepId) => void
}

/** 对话区（MVP stub）：选/建集 → 发起 run → 活动 log + 步骤快跳 */
export function ChatPanel({
  episodes, current, run, focusStep, seriesOptions = [], log, busy,
  onSelectEpisode, onCreateEpisode, onSetSeries, onStartRun, onJumpStep,
}: Props) {
  const [mode, setMode] = useState<'run' | 'new'>('run')
  const [newId, setNewId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newSeries, setNewSeries] = useState('heiress')
  const [editSeries, setEditSeries] = useState('')

  useEffect(() => {
    setEditSeries(current?.series_id || 'heiress')
  }, [current?.episode_id, current?.series_id])

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
          {current && (
            <div className="series-row">
              <label>所属系列（跨集角色参考）</label>
              <div className="series-edit">
                <input
                  list="series-options"
                  value={editSeries}
                  onChange={(e) => setEditSeries(e.target.value)}
                  placeholder="如 heiress / my-drama"
                />
                <button
                  type="button"
                  className="btn"
                  disabled={!editSeries.trim() || busy || editSeries.trim() === (current.series_id || '')}
                  onClick={() => { void onSetSeries?.(editSeries.trim()) }}
                >
                  切换系列
                </button>
              </div>
              <p className="muted jump-hint">同系列才共享 03 锁定资产；新故事请填新系列 ID。</p>
            </div>
          )}
          <button className="btn primary" disabled={!current || busy} onClick={onStartRun}>
            ▶ 从当前步（{current ? STEP_LABELS[current.current_step] : '—'}）发起 run
          </button>
          {run && (
            <div className="run-state">
              <span className={`st st-${run.status}`}>run: {run.status}</span>
              <span>当前步 {STEP_LABELS[run.current_step]}</span>
              {current?.series_id && <span className="mono">series:{current.series_id}</span>}
            </div>
          )}
          {(run || current) && (
            <div className="step-jump">
              <label>步骤快跳（查看已通过内容；不等于退回流水线）</label>
              <div className="steps-row">
                {STEP_ORDER.map((s) => {
                  const si = run?.steps.find((x) => x.step === s)
                  const viewing = (focusStep ?? run?.current_step) === s
                  const pipeline = run?.current_step === s
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`pill ${si?.status ?? 'pending'} ${viewing ? 'cur' : ''} ${pipeline ? 'pipeline' : ''}`}
                      title={`${STEP_LABELS[s]} · ${si?.status ?? 'pending'}${pipeline ? ' · 流水线当前步' : ''}`}
                      onClick={() => onJumpStep(s)}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
              {focusStep && run && focusStep !== run.current_step && (
                <p className="muted jump-hint">正在查看 {STEP_LABELS[focusStep]}（只读浏览）。流水线仍在 {STEP_LABELS[run.current_step]}。</p>
              )}
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
          <label>系列 ID（同系列共享角色参考；新片请新建系列）</label>
          <input
            list="series-options"
            value={newSeries}
            onChange={(e) => setNewSeries(e.target.value)}
            placeholder="heiress 或 my-new-series"
          />
          <datalist id="series-options">
            {seriesOptions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <button
            className="btn primary"
            disabled={!newId.trim() || !newTitle.trim() || !newSeries.trim() || busy}
            onClick={async () => {
              await onCreateEpisode(newId.trim(), newTitle.trim(), newSeries.trim())
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
