import { useCallback, useEffect, useState } from 'react'
import { api, USING_MOCK } from './api'
import type { Episode, RunInfo, StepVersion, StepId, DecisionAction, PlatformHealth } from './types'
import { STEP_LABELS } from './types'
import { ChatPanel, type LogEntry } from './components/ChatPanel'
import { StepView } from './components/StepView'

const ts = () => new Date().toISOString()
const uid = () => Math.random().toString(36).slice(2, 9)

export default function App() {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [currentId, setCurrentId] = useState<string | undefined>(undefined)
  const [run, setRun] = useState<RunInfo | undefined>(undefined)
  const [focusStep, setFocusStep] = useState<StepId | undefined>(undefined)
  const [curVersion, setCurVersion] = useState<StepVersion | undefined>(undefined)
  const [versions, setVersions] = useState<StepVersion[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | undefined>(undefined)
  const [health, setHealth] = useState<PlatformHealth | undefined>(undefined)

  const pushLog = useCallback((kind: 'user' | 'system', text: string) => {
    setLog((l) => [...l.slice(-80), { id: uid(), ts: ts(), kind, text }])
  }, [])

  // 初始加载：集列表 + 平台健康
  useEffect(() => {
    (async () => {
      try {
        const [eps, h] = await Promise.all([api.listEpisodes(), api.getPlatformHealth()])
        setEpisodes(eps)
        setHealth(h)
        if (eps.length > 0 && !currentId) {
          const first = eps.find((e) => e.status === 'in_progress') ?? eps[0]
          setCurrentId(first.episode_id)
          setFocusStep(first.current_step)
        }
      } catch (e) {
        setErr(String(e))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentEpisode = episodes.find((e) => e.episode_id === currentId)

  // 切集 / 切步 → 拉当前版本 + 版本列表
  const loadStep = useCallback(async (episodeId: string, step: StepId) => {
    try {
      const [cur, vs] = await Promise.all([
        api.getCurrentVersion(episodeId, step).catch(() => undefined),
        api.listVersions(episodeId, step),
      ])
      setCurVersion(cur)
      setVersions(vs)
    } catch (e) {
      setErr(String(e))
    }
  }, [])

  useEffect(() => {
    if (!currentId || !focusStep) return
    loadStep(currentId, focusStep)
  }, [currentId, focusStep, loadStep])

  const onSelectEpisode = async (id: string) => {
    setCurrentId(id)
    const ep = await api.getEpisode(id)
    setFocusStep(ep.current_step)
    setRun(undefined)
    pushLog('system', `切换到 ${id} · ${ep.title}`)
  }

  const onCreateEpisode = async (id: string, title: string) => {
    setBusy(true)
    try {
      const e = await api.createEpisode({ episode_id: id, title })
      setEpisodes((x) => [...x, e])
      setCurrentId(id)
      setFocusStep(e.current_step)
      pushLog('system', `新建集 ${id} · ${title}`)
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  const onStartRun = async () => {
    if (!currentEpisode) return
    setBusy(true)
    try {
      const r = await api.startRun(currentEpisode.episode_id)
      setRun(r)
      setFocusStep(r.current_step)
      await loadStep(currentEpisode.episode_id, r.current_step)
      pushLog('system', `发起 run：从 ${STEP_LABELS[r.current_step]} 起跑（${r.status}）`)
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  const onDecision = async (action: DecisionAction, note?: string, paramsOverride?: Record<string, unknown>) => {
    if (!curVersion) return
    setBusy(true)
    const ep = curVersion.episode_id
    const step = focusStep ?? curVersion.step
    pushLog('user', `${action} · ${STEP_LABELS[step]}${note ? `：${note}` : ''}${paramsOverride?.seed != null ? `（seed=${paramsOverride.seed}）` : ''}`)
    try {
      const r = await api.postDecision(ep, step, { version: curVersion.version, action, note, params_override: paramsOverride })
      setRun(r)
      setFocusStep(r.current_step)
      await loadStep(ep, r.current_step)
      const moved = r.current_step !== step
      pushLog('system', moved ? `已推进到 ${STEP_LABELS[r.current_step]}` : `已在 ${STEP_LABELS[r.current_step]} 产出新版本（${r.status}）`)
    } catch (e) {
      setErr(String(e))
      pushLog('system', `决策失败：${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🎬 AI 漫剧制作 · 可视化产品</div>
        <div className="top-right">
          <span className={`badge ${USING_MOCK ? 'mock' : 'live'}`}>{USING_MOCK ? 'MOCK 后端' : 'LIVE 后端'}</span>
          {currentEpisode && <span className="ep-tag">{currentEpisode.episode_id} · {currentEpisode.title}</span>}
          {run && <span className={`st st-${run.status}`}>run: {run.status}</span>}
          {health && <span className="muted">平台: {Object.entries(health).map(([k, v]) => `${k}=${typeof v === 'string' ? v : (v as { status: string }).status}`).join(' · ')}</span>}
        </div>
      </header>

      {err && <div className="callout err" onClick={() => setErr(undefined)}>⚠ {err}（点此关闭）</div>}

      <main className="main">
        <section className="left">
          <ChatPanel
            episodes={episodes}
            current={currentEpisode}
            run={run}
            log={log}
            busy={busy}
            onSelectEpisode={onSelectEpisode}
            onCreateEpisode={onCreateEpisode}
            onStartRun={onStartRun}
            onJumpStep={(s) => { setFocusStep(s); if (currentId) loadStep(currentId, s) }}
          />
        </section>
        <section className="right">
          {curVersion ? (
            <StepView current={curVersion} versions={versions} busy={busy} onDecision={onDecision} />
          ) : (
            <div className="empty big">在左侧选择/新建一集并发起 run，工作区会展示当前 checkpoint。</div>
          )}
        </section>
      </main>
    </div>
  )
}
