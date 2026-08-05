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
const ptrKey = (ep: string, step: StepId) => `${ep}/${step}`

/**
 * 内存态 mock 后端，实现 BACKEND-API-CONTRACT §4 + SELECT-VERSION-CONTRACT。
 * 审阅指针 current_version 与通过指针 is_latest 分开维护。
 */
class MockApi implements ComicApi {
  private episodes: Episode[] = structuredClone(SEED_EPISODES)
  private versions: Record<StepId, StepVersion[]> = structuredClone(SEED_VERSIONS)
  private runs: Map<string, RunInfo> = new Map()
  /** 审阅指针：episode/step → version id（≠ is_latest） */
  private currentPtr: Record<string, string> = {}

  constructor() {
    for (const step of STEP_ORDER) {
      for (const v of this.versions[step]) {
        const k = ptrKey(v.episode_id, step)
        if (!this.currentPtr[k]) {
          // 优先 awaiting_review，否则 is_latest，否则该步最后一版
          const vs = this.versions[step].filter((x) => x.episode_id === v.episode_id)
          const review = vs.find((x) => x.status === 'awaiting_review')
          const latest = vs.find((x) => x.is_latest)
          this.currentPtr[k] = (review ?? latest ?? vs[vs.length - 1]).version
        }
      }
    }
  }

  private epi(id: string): Episode {
    const e = this.episodes.find((x) => x.episode_id === id)
    if (!e) throw new Error(`episode ${id} not found`)
    return e
  }

  private stepVersions(episodeId: string, step: StepId): StepVersion[] {
    return this.versions[step].filter((v) => v.episode_id === episodeId)
  }

  private getCurrent(episodeId: string, step: StepId): StepVersion | undefined {
    const vs = this.stepVersions(episodeId, step)
    const ptr = this.currentPtr[ptrKey(episodeId, step)]
    return (ptr ? vs.find((v) => v.version === ptr) : undefined) ?? vs.find((v) => v.is_latest) ?? vs[vs.length - 1]
  }

  private setCurrent(episodeId: string, step: StepId, version: string) {
    this.currentPtr[ptrKey(episodeId, step)] = version
  }

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
        const cur = this.getCurrent(episodeId, step)
        return { step, status: cur?.status ?? 'pending', latest_version: cur?.version }
      }),
    }
    this.runs.set(run.run_id, run)
    return run
  }

  private syncRun(episodeId: string): RunInfo {
    const ep = this.epi(episodeId)
    const run = this.runFor(episodeId)
    run.current_step = ep.current_step
    run.steps = STEP_ORDER.map((step) => {
      const cur = this.getCurrent(episodeId, step)
      const fallback =
        STEP_ORDER.indexOf(step) < STEP_ORDER.indexOf(ep.current_step) ? 'approved' : 'pending'
      return {
        step,
        status: cur?.status ?? fallback,
        latest_version: cur?.version,
      }
    })
    run.status =
      ep.current_step === '07' &&
      this.versions['07'].some((v) => v.episode_id === episodeId && v.status === 'approved')
        ? 'done'
        : 'paused_at_checkpoint'
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
    const cur = this.getCurrent(episodeId, step)
    if (!cur) throw new Error(`${episodeId}/${step} 暂无版本`)
    return structuredClone(cur)
  }
  async listVersions(episodeId: string, step: StepId): Promise<StepVersion[]> {
    await delay(100)
    return structuredClone(this.stepVersions(episodeId, step))
  }

  /** SELECT-VERSION-CONTRACT：只改审阅指针，不改 is_latest / 不删档 / 不退步 */
  async selectVersion(episodeId: string, step: StepId, version: string, _note?: string): Promise<RunInfo> {
    await delay(200)
    const ep = this.epi(episodeId)
    if (ep.current_step !== step) {
      throw new Error(`409 只能改当前步审阅指针（current_step=${ep.current_step}, asked=${step}）`)
    }
    const vs = this.stepVersions(episodeId, step)
    const target = vs.find((v) => v.version === version)
    if (!target) throw new Error(`404 version ${version} not found`)
    const cur = this.getCurrent(episodeId, step)
    if (!cur) throw new Error(`${episodeId}/${step} 无可审阅版本`)
    if (cur.status !== 'awaiting_review') {
      throw new Error(`409 当前状态 ${cur.status}，选用仅 awaiting_review`)
    }
    // 幂等：已是当前审阅版
    if (cur.version === version) {
      return structuredClone(this.syncRun(episodeId))
    }
    if (cur.status === 'awaiting_review') {
      cur.status = 'superseded'
    }
    target.status = 'awaiting_review'
    this.setCurrent(episodeId, step, version)
    // 不改任何版的 is_latest；不删任何 vN
    ep.updated_at = now()
    return structuredClone(this.syncRun(episodeId))
  }

  /** §2.3 decision：approve→推进；revise/regenerate→当前步出新版；rollback→上步。决策永远打在 current_version。 */
  async postDecision(episodeId: string, step: StepId, d: { version: string; action: DecisionAction; note?: string; params_override?: Record<string, unknown> }): Promise<RunInfo> {
    await delay(400)
    const ep = this.epi(episodeId)
    const cur = this.getCurrent(episodeId, step)
    if (!cur) throw new Error(`${episodeId}/${step} 无可决策版本`)
    const rollbackOk = cur.status === 'awaiting_review' || cur.status === 'approved' || cur.status === 'failed'
    if (d.action === 'rollback') {
      if (!rollbackOk) throw new Error(`当前状态 ${cur.status}，不可回退`)
    } else if (cur.status !== 'awaiting_review') {
      throw new Error(`当前状态 ${cur.status}，不可决策（✅✏️🔄 仅 awaiting_review；↩️ 在 approved/failed 仍可）`)
    }

    const bump = (): string => {
      const nums = this.stepVersions(episodeId, step).map((v) => {
        const m = v.version.match(/^v(\d+)$/)
        return m ? Number(m[1]) : 0
      })
      return `v${Math.max(0, ...nums) + 1}`
    }

    if (d.action === 'approve') {
      // 通过指针：清掉同步其他 is_latest，当前版置 latest
      for (const v of this.stepVersions(episodeId, step)) {
        v.is_latest = false
      }
      cur.status = 'approved'
      cur.is_latest = true
      const ns = nextStep(step)
      if (ns) {
        ep.current_step = ns
        this.versions[ns] = this.versions[ns].filter((v) => v.episode_id !== episodeId)
        const ph = this.placeholder(episodeId, ns)
        this.versions[ns].push(ph)
        this.setCurrent(episodeId, ns, ph.version)
      } else {
        ep.status = 'done'
      }
    } else if (d.action === 'rollback') {
      const ps = prevStep(step)
      if (!ps) throw new Error('已在第一步，无法回退')
      // 不删本步任何 vN；仅退 current_step
      if (cur.status === 'awaiting_review') cur.status = 'superseded'
      ep.current_step = ps
      if (ep.status === 'done') ep.status = 'in_progress'
      const pl = this.getCurrent(episodeId, ps)
      if (pl) {
        pl.status = 'awaiting_review'
        // is_latest 保留（通过指针不动，直至再次 approve）
      }
    } else {
      // revise / regenerate → 以当前审阅版为基线出新版；不改 is_latest
      cur.status = 'superseded'
      const nv: StepVersion = {
        ...structuredClone(cur),
        version: bump(),
        is_latest: false,
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
      // 修正 archive 路径版本段
      const dir = STEP_ARCHIVE_DIR[step]
      nv.archive_path = `assets/${episodeId}/${dir}/${nv.version}/`
      nv.prompt_path = `${nv.archive_path}prompt.md`
      nv.meta_path = `${nv.archive_path}meta.md`
      this.versions[step].push(nv)
      this.setCurrent(episodeId, step, nv.version)
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
      // is_latest 仅 approve 置位；占位待审版不是 latest
      is_latest: false,
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
    return {
      comfyui: { status: 'unconfigured', detail: 'mock 未配置（后端未联调）' },
      video_models: { status: 'unconfigured', detail: 'mock 未配置' },
      elevenlabs: { status: 'unconfigured', detail: 'mock 未配置' },
      overall: 'degraded',
    }
  }
}

export const mockApi: ComicApi = new MockApi()
