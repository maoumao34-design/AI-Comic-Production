import type { ComicApi } from './types'
import type {
  Episode,
  StepVersion,
  RunInfo,
  PlatformHealth,
  StepId,
  DecisionAction,
} from '../types'
import { STEP_ORDER } from '../types'
import { SEED_EPISODES, SEED_VERSIONS, draftVersionContent, placeholderContent, STEP_ARCHIVE_DIR } from '../data/mockData'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()
const nextStep = (s: StepId): StepId | null => {
  const i = STEP_ORDER.indexOf(s)
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null
}
const prevStep = (s: StepId): StepId | null => {
  const i = STEP_ORDER.indexOf(s)
  return i > 0 ? STEP_ORDER[i - 1] : null
}

/**
 * 内存态 mock 后端，实现 BACKEND-API-CONTRACT §4 的接口 + §2.3 的 decision 语义。
 * 后端就绪后切换到 RealApi（见 ./index.ts），前端代码无需改。
 */
class MockApi implements ComicApi {
  private episodes: Episode[] = structuredClone(SEED_EPISODES)
  private versions: Record<StepId, StepVersion[]> = structuredClone(SEED_VERSIONS)
  private runs: Map<string, RunInfo> = new Map()

  private runFor(episodeId: string): RunInfo {
    const ep = this.epi(episodeId)
    const existing = [...this.runs.values()].find((r) => r.episode_id === episodeId)
    if (existing) return existing
    const run: RunInfo = {
      run_id: `run-${episodeId}-${Math.random().toString(36).slice(2, 8)}`,
      episode_id: episodeId,
      status: 'paused_at_checkpoint',
      current_step: ep.current_step,
      started_at: now(),
      steps: STEP_ORDER.map((step) => {
        const vs = this.versions[step].filter((v) => v.episode_id === episodeId)
        const latest = vs.find((v) => v.is_latest)
        return { step, status: latest?.status ?? 'pending', latest_version: latest?.version }
      }),
    }
    this.runs.set(run.run_id, run)
    return run
  }

  private epi(id: string): Episode {
    const e = this.episodes.find((x) => x.episode_id === id)
    if (!e) throw new Error(`episode ${id} not found`)
    return e
  }

  private syncRun(episodeId: string): RunInfo {
    const ep = this.epi(episodeId)
    const run = this.runFor(episodeId)
    run.current_step = ep.current_step
    run.steps = STEP_ORDER.map((step) => {
      const vs = this.versions[step].filter((v) => v.episode_id === episodeId)
      const latest = vs.find((v) => v.is_latest)
      return { step, status: latest?.status ?? (STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(ep.current_step) ? 'approved' : 'pending'), latest_version: latest?.version }
    })
    run.status = ep.current_step === '07' && this.versions['07'].some((v) => (v as StepVersion).episode_id === episodeId && (v as StepVersion).status === 'approved') ? 'done' : 'paused_at_checkpoint'
    return run
  }

  async listEpisodes(): Promise<Episode[]> {
    await delay(120)
    return structuredClone(this.episodes)
  }
  async createEpisode(input: { episode_id: string; title: string }): Promise<Episode> {
    await delay(150)
    if (this.episodes.some((e) => e.episode_id === input.episode_id)) throw new Error(`episode ${input.episode_id} 已存在`)
    const e: Episode = { episode_id: input.episode_id, title: input.title, status: 'draft', current_step: '01', created_at: now(), updated_at: now() }
    this.episodes.push(e)
    return structuredClone(e)
  }
  async getEpisode(episodeId: string): Promise<Episode> {
    await delay(80)
    return structuredClone(this.epi(episodeId))
  }
  async startRun(episodeId: string, input?: { from_step?: StepId }): Promise<RunInfo> {
    await delay(300)
    const ep = this.epi(episodeId)
    ep.status = 'in_progress'
    if (input?.from_step) ep.current_step = input.from_step
    ep.updated_at = now()
    return structuredClone(this.syncRun(episodeId))
  }
  async getRun(runId: string): Promise<RunInfo> {
    await delay(80)
    const r = this.runs.get(runId)
    if (!r) throw new Error(`run ${runId} not found`)
    return structuredClone(this.syncRun(r.episode_id))
  }
  async getCurrentVersion(episodeId: string, step: StepId): Promise<StepVersion> {
    await delay(100)
    const vs = this.versions[step].filter((v) => v.episode_id === episodeId)
    const latest = vs.find((v) => v.is_latest) ?? vs[vs.length - 1]
    if (!latest) throw new Error(`${episodeId}/${step} 暂无版本`)
    return structuredClone(latest)
  }
  async listVersions(episodeId: string, step: StepId): Promise<StepVersion[]> {
    await delay(100)
    return structuredClone(this.versions[step].filter((v) => v.episode_id === episodeId))
  }

  /** §2.3 decision 语义：approve→推进；revise/regenerate→当前步出新版；rollback→上步 */
  async postDecision(episodeId: string, step: StepId, d: { version: string; action: DecisionAction; note?: string; params_override?: Record<string, unknown> }): Promise<RunInfo> {
    await delay(400)
    const ep = this.epi(episodeId)
    const vs = this.versions[step]
    const cur = vs.find((v) => v.episode_id === episodeId && v.is_latest)
    if (!cur) throw new Error(`${episodeId}/${step} 无可决策版本`)
    const rollbackOk = cur.status === 'awaiting_review' || cur.status === 'approved' || cur.status === 'failed'
    if (d.action === 'rollback') {
      if (!rollbackOk) throw new Error(`当前状态 ${cur.status}，不可回退`)
    } else if (cur.status !== 'awaiting_review') {
      throw new Error(`当前状态 ${cur.status}，不可决策（✅✏️🔄 仅 awaiting_review；↩️ 在 approved/failed 仍可）`)
    }

    const bump = (n: number): string => {
      const m = cur.version.match(/^v(\d+)$/)
      return `v${(m ? Number(m[1]) : n) + 1}`
    }

    if (d.action === 'approve') {
      cur.status = 'approved'
      const ns = nextStep(step)
      if (ns) {
        ep.current_step = ns
        // 为下一步生成一个 awaiting_review 占位版本（mock 推进）
        this.versions[ns] = this.versions[ns].filter((v) => v.episode_id !== episodeId)
        this.versions[ns].push(this.placeholder(episodeId, ns))
      } else {
        ep.status = 'done'
      }
    } else if (d.action === 'rollback') {
      const ps = prevStep(step)
      if (!ps) throw new Error('已在第一步，无法回退')
      cur.status = 'superseded'
      ep.current_step = ps
      if (ep.status === 'done') ep.status = 'in_progress'
      // 上步重新进入 awaiting_review
      const pvs = this.versions[ps].filter((v) => v.episode_id === episodeId)
      const pl = pvs.find((v) => v.is_latest)
      if (pl) { pl.status = 'awaiting_review'; pl.is_latest = true }
    } else {
      // revise / regenerate → 当前步出新版，仍 awaiting_review
      cur.status = 'superseded'
      cur.is_latest = false
      const nv: StepVersion = {
        ...structuredClone(cur),
        version: bump(1),
        is_latest: true,
        status: 'awaiting_review',
        seed: d.action === 'regenerate' && d.params_override?.seed != null ? Number(d.params_override.seed) : (cur.seed ?? 0) + 7,
        params: { ...(cur.params ?? {}), ...(d.params_override ?? {}) },
        model: d.params_override?.provider != null ? String(d.params_override.provider) : cur.model,
        content: (() => {
          const base = draftVersionContent(step, episodeId) as Record<string, unknown>
          if (d.params_override?.provider != null) base.provider = d.params_override.provider
          return base
        })(),
        created_at: now(),
        artifacts: cur.artifacts.map((a) => ({ ...a, label: a.label + ' (重生)' })),
        failure: null,
      }
      this.versions[step].push(nv)
    }
    ep.updated_at = now()
    return structuredClone(this.syncRun(episodeId))
  }

  private placeholder(episodeId: string, step: StepId): StepVersion {
    const dir = STEP_ARCHIVE_DIR[step]
    const archive = `assets/${episodeId}/${dir}/v1/`
    const arts =
      step === '03' || step === '04'
        ? [{ type: 'image' as const, url: `/${archive}output_preview.png`, label: `${step} preview (mock)` }]
        : step === '05' || step === '07'
          ? [{ type: 'video' as const, url: `/${archive}output_preview.mp4`, label: `${step} preview (mock)` }]
          : step === '06'
            ? [
                { type: 'audio' as const, url: `/${archive}output_voiceover.mp3`, label: 'voiceover (mock)' },
                { type: 'text' as const, url: `/${archive}output_subs.srt`, label: 'subtitles (mock)' },
              ]
            : []
    const model =
      step === '01' || step === '02'
        ? 'claude-sonnet'
        : step === '03' || step === '04'
          ? 'comfyui'
          : step === '05'
            ? 'video:<unset>'
            : step === '06'
              ? 'elevenlabs'
              : 'ffmpeg'
    return {
      episode_id: episodeId,
      step,
      version: 'v1',
      is_latest: true,
      status: 'awaiting_review',
      model,
      seed: Math.floor(Math.random() * 99999),
      params: {},
      artifacts: arts,
      refs: [],
      archive_path: archive,
      prompt_path: `${archive}prompt.md`,
      meta_path: `${archive}meta.md`,
      content: placeholderContent(episodeId, step),
      created_at: now(),
      duration_ms: 0,
      failure: null,
    }
  }

  async getPlatformHealth(): Promise<PlatformHealth> {
    await delay(100)
    // mock：后端未就绪，如实报「未配置」（不伪造已连接）
    return {
      comfyui: { status: 'unconfigured', detail: 'mock 未配置（后端未联调）' },
      video_models: { status: 'unconfigured', detail: 'mock 未配置' },
      elevenlabs: { status: 'unconfigured', detail: 'mock 未配置' },
      overall: 'degraded',
    }
  }
}

export const mockApi: ComicApi = new MockApi()
