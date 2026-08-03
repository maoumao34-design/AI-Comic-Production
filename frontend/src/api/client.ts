import type { ComicApi } from './types'
import type { Episode, StepVersion, RunInfo, PlatformHealth, StepId, RunStepStatus } from '../types'

/** 后端 /api/v1 的真实实现（BACKEND-API-CONTRACT v0.2 + ComfyUI 工程师 backend/server.mjs 实测形状）。
 *  后端把每个响应包一层 envelope（{episodes}/{episode}/{run}/{version}/{versions}/{result}），
 *  且 run.steps 是以 stepId 为 key 的对象——这里拆包 + 转成前端 RunInfo 形状。 */
class RealApi implements ComicApi {
  private base: string
  constructor(base: string) {
    this.base = base.replace(/\/$/, '')
  }
  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      let detail = ''
      try {
        detail = JSON.stringify(await res.json())
      } catch {
        /* ignore */
      }
      throw new Error(`${res.status} ${res.statusText} ${path} ${detail}`)
    }
    return (await res.json()) as T
  }

  /** 后端 run.steps 是 { "01": {status,versions,current_version,...}, ... }；前端要数组 */
  private toRunInfo(r: any): RunInfo {
    const steps = Array.isArray(r.steps)
      ? r.steps
      : Object.entries<Record<string, unknown>>(r.steps ?? {}).map(([step, s]) => ({
          step: step as StepId,
          status: (s as any)?.status as RunStepStatus,
          latest_version: (s as any)?.current_version ?? (s as any)?.latest_version ?? undefined,
        }))
    return {
      run_id: r.run_id,
      episode_id: r.episode_id,
      status: r.status,
      current_step: r.current_step as StepId,
      started_at: r.started_at ?? r.created_at,
      steps,
    }
  }

  async listEpisodes(): Promise<Episode[]> {
    const j = await this.req<{ episodes: Episode[] }>('/episodes')
    return j.episodes
  }
  async createEpisode(input: { episode_id: string; title: string }): Promise<Episode> {
    const j = await this.req<{ episode: Episode }>('/episodes', { method: 'POST', body: JSON.stringify(input) })
    return j.episode
  }
  async getEpisode(id: string): Promise<Episode> {
    const j = await this.req<{ episode: Episode }>(`/episodes/${id}`)
    return j.episode
  }
  async startRun(id: string, input?: { from_step?: StepId }): Promise<RunInfo> {
    const j = await this.req<{ run: any }>(`/episodes/${id}/runs`, { method: 'POST', body: JSON.stringify({ inputs: input ?? {} }) })
    return this.toRunInfo(j.run)
  }
  async getRun(runId: string): Promise<RunInfo> {
    const j = await this.req<{ run: any }>(`/runs/${runId}`)
    return this.toRunInfo(j.run)
  }
  async getCurrentVersion(id: string, step: StepId): Promise<StepVersion> {
    const j = await this.req<{ version: StepVersion }>(`/episodes/${id}/steps/${step}/current`)
    return j.version
  }
  async listVersions(id: string, step: StepId): Promise<StepVersion[]> {
    const j = await this.req<{ versions: StepVersion[] }>(`/episodes/${id}/steps/${step}/versions`)
    return j.versions
  }
  /** 后端 decision 只回 {result:{run_id,status,current_step,current_version}}（瘦身）；
   *  前端要完整 RunInfo，所以拿 run_id 再取一次 run。 */
  async postDecision(id: string, step: StepId, d: { version: string; action: string; note?: string; params_override?: Record<string, unknown> }): Promise<RunInfo> {
    const j = await this.req<{ result: { run_id: string } }>(`/episodes/${id}/steps/${step}/decision`, {
      method: 'POST',
      body: JSON.stringify({ ...d, client_request_id: crypto.randomUUID() }),
    })
    return this.getRun(j.result.run_id)
  }
  async getPlatformHealth(): Promise<PlatformHealth> {
    return this.req<PlatformHealth>('/health/platforms')
  }
}

export const realApi = (base: string): ComicApi => new RealApi(base)
