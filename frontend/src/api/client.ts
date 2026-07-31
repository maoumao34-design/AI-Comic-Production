import type { ComicApi } from './types'
import type { Episode, StepVersion, RunInfo, PlatformHealth, StepId } from '../types'

/** 打后端 /api/v1 的真实实现（BACKEND-API-CONTRACT §4）。后端就绪后启用。 */
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

  listEpisodes() {
    return this.req<Episode[]>('/episodes')
  }
  createEpisode(input: { episode_id: string; title: string }) {
    return this.req<Episode>('/episodes', { method: 'POST', body: JSON.stringify(input) })
  }
  getEpisode(id: string) {
    return this.req<Episode>(`/episodes/${id}`)
  }
  startRun(id: string, input?: { from_step?: StepId }) {
    return this.req<RunInfo>(`/episodes/${id}/runs`, { method: 'POST', body: JSON.stringify(input ?? {}) })
  }
  getRun(runId: string) {
    return this.req<RunInfo>(`/runs/${runId}`)
  }
  getCurrentVersion(id: string, step: StepId) {
    return this.req<StepVersion>(`/episodes/${id}/steps/${step}/current`)
  }
  listVersions(id: string, step: StepId) {
    return this.req<StepVersion[]>(`/episodes/${id}/steps/${step}/versions`)
  }
  postDecision(id: string, step: StepId, d: { version: string; action: string; note?: string; params_override?: Record<string, unknown> }) {
    return this.req<RunInfo>(`/episodes/${id}/steps/${step}/decision`, { method: 'POST', body: JSON.stringify({ ...d, client_request_id: crypto.randomUUID() }) })
  }
  getPlatformHealth() {
    return this.req<PlatformHealth>('/health/platforms')
  }
}

export const realApi = (base: string): ComicApi => new RealApi(base)
