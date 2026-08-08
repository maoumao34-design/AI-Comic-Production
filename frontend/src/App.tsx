import { Component, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
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
  const [seriesOptions, setSeriesOptions] = useState<string[]>(['heiress', 'default'])

  const pushLog = useCallback((kind: 'user' | 'system', text: string) => {
    setLog((l) => [...l.slice(-80), { id: uid(), ts: ts(), kind, text }])
  }, [])

  /** 挂上该集最新 run（本机 bootstrap 已预创建，不必再点「发起 run」） */
  const attachLatestRun = useCallback(async (episodeId: string) => {
    try {
      const ep = await api.getEpisode(episodeId)
      const last = ep.runs?.[ep.runs.length - 1]
      if (last?.run_id) {
        const r = await api.getRun(last.run_id)
        setRun(r)
        return r
      }
    } catch {
      /* ignore */
    }
    setRun(undefined)
    return undefined
  }, [])

  // 初始加载：集列表 + 平台健康
  useEffect(() => {
    (async () => {
      try {
        const [eps, h, series] = await Promise.all([
          api.listEpisodes(),
          api.getPlatformHealth(),
          api.listSeries?.().catch(() => ['heiress', 'default']) ?? Promise.resolve(['heiress', 'default']),
        ])
        setEpisodes(eps)
        setHealth(h)
        if (series?.length) setSeriesOptions(series)
        if (eps.length > 0 && !currentId) {
          const first = eps.find((e) => e.status === 'in_progress') ?? eps[0]
          setCurrentId(first.episode_id)
          setFocusStep(first.current_step)
          await attachLatestRun(first.episode_id)
          pushLog('system', `已加载 ${first.episode_id} · 当前步骤 ${STEP_LABELS[first.current_step]}。步骤 03/04 点 🔄 重生即可本地 ComfyUI 出图。`)
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
    setEpisodes((list) => list.map((x) => (x.episode_id === id ? { ...x, ...ep } : x)))
    setFocusStep(ep.current_step)
    await attachLatestRun(id)
    pushLog('system', `切换到 ${id} · ${ep.title}${ep.series_id ? ` · series:${ep.series_id}` : ''}`)
  }

  const onCreateEpisode = async (id: string, title: string, seriesId: string) => {
    setBusy(true)
    try {
      const e = await api.createEpisode({ episode_id: id, title, series_id: seriesId })
      setEpisodes((x) => [...x, e])
      setCurrentId(id)
      setFocusStep(e.current_step)
      setSeriesOptions((s) => (s.includes(seriesId) ? s : [...s, seriesId].sort()))
      pushLog('system', `新建集 ${id} · ${title} · series:${seriesId}`)
    } catch (e) {
      setErr(String(e))
    } finally {
      setBusy(false)
    }
  }

  const onSetSeries = async (seriesId: string) => {
    if (!currentId || !api.setEpisodeSeries) return
    setBusy(true)
    try {
      const e = await api.setEpisodeSeries(currentId, seriesId)
      setEpisodes((list) => list.map((x) => (x.episode_id === e.episode_id ? { ...x, ...e } : x)))
      setSeriesOptions((s) => (s.includes(seriesId) ? s : [...s, seriesId].sort()))
      pushLog('system', `${currentId} 已切换到系列 ${seriesId}`)
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
    pushLog('user', `${action} · ${STEP_LABELS[step]}${note ? `：${note}` : ''}${paramsOverride?.seed != null ? `（seed=${paramsOverride.seed}）` : ''}${paramsOverride?.provider != null ? `（provider=${String(paramsOverride.provider)}）` : ''}`)
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

  const onSelectVersion = async (v: StepVersion) => {
    if (!curVersion) return
    setBusy(true)
    const ep = curVersion.episode_id
    const step = focusStep ?? curVersion.step
    pushLog('user', `选用此版 · ${STEP_LABELS[step]} ${v.version}`)
    try {
      const r = await api.selectVersion(ep, step, v.version)
      setRun(r)
      await loadStep(ep, step)
      pushLog('system', `审阅指针 → ${v.version}（current_step 仍 ${STEP_LABELS[r.current_step]}；归档保留）`)
    } catch (e) {
      setErr(String(e))
      pushLog('system', `选用失败：${String(e)}`)
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
          {currentEpisode && (
            <span className="ep-tag">
              {currentEpisode.episode_id} · {currentEpisode.title}
              {currentEpisode.series_id ? ` · series:${currentEpisode.series_id}` : ''}
            </span>
          )}
          {run && <span className={`st st-${run.status}`}>run: {run.status}</span>}
          {health && (
            <span className="muted">
              平台:{' '}
              {(['comfyui', 'video_models', 'elevenlabs', 'local_compose', 'overall'] as const)
                .map((k) => {
                  const v = (health as Record<string, unknown>)[k]
                  if (typeof v === 'string') return `${k}=${v}`
                  if (v && typeof v === 'object' && 'status' in v) return `${k}=${String((v as { status: string }).status)}`
                  return null
                })
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>
      </header>

      {err && <div className="callout err" onClick={() => setErr(undefined)}>⚠ {err}（点此关闭）</div>}

      <main className="main">
        <section className="left">
          <ChatPanel
            episodes={episodes}
            current={currentEpisode}
            run={run}
            focusStep={focusStep}
            log={log}
            busy={busy}
            seriesOptions={seriesOptions}
            onSelectEpisode={onSelectEpisode}
            onCreateEpisode={onCreateEpisode}
            onSetSeries={onSetSeries}
            onStartRun={onStartRun}
            onJumpStep={(s) => { setFocusStep(s); if (currentId) void loadStep(currentId, s) }}
          />
        </section>
        <section className="right">
          {curVersion ? (
            <ErrorBoundary key={`${curVersion.episode_id}-${curVersion.step}-${curVersion.version}`} onReset={() => setErr(undefined)}>
              <StepView
                current={curVersion}
                versions={versions}
                busy={busy}
                health={health}
                browsing={!!(run && focusStep && focusStep !== run.current_step)}
                onDecision={onDecision}
                onSelectVersion={onSelectVersion}
              />
            </ErrorBoundary>
          ) : (
            <div className="empty big">
              {focusStep
                ? `步骤 ${STEP_LABELS[focusStep]} 暂无版本可显示。可点左侧其它步骤，或回到流水线当前步。`
                : '在左侧选择/新建一集并发起 run，工作区会展示当前 checkpoint。若刚回退，点左侧步骤或刷新页面即可。'}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

/** 避免单步渲染异常导致整页黑屏 */
class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, { error?: string }> {
  state: { error?: string } = {}
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[StepView crash]', err, info.componentStack)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="empty big">
          <p>工作区渲染出错（常见于回退后字段类型不匹配），页面未死锁。</p>
          <p className="muted mono">{this.state.error}</p>
          <button
            className="btn"
            type="button"
            onClick={() => {
              this.setState({ error: undefined })
              this.props.onReset?.()
              window.location.reload()
            }}
          >
            刷新恢复
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
