import type {
  Episode,
  StepVersion,
  Decision,
  RunInfo,
  PlatformHealth,
  StepId,
} from '../types'

/** 前端唯一依赖的后端接口（对齐 BACKEND-API-CONTRACT §4）。
 *  有两个实现：MockApi（内置，后端未就绪用）与 RealApi（打 /api/v1）。
 *  所有写操作带 client_request_id 做幂等。 */
export interface ComicApi {
  // §4.1 Episode
  listEpisodes(): Promise<Episode[]>
  createEpisode(input: { episode_id: string; title: string }): Promise<Episode>
  getEpisode(episodeId: string): Promise<Episode>
  // §4.2 Run
  startRun(episodeId: string, input?: { from_step?: StepId }): Promise<RunInfo>
  getRun(runId: string): Promise<RunInfo>
  // §4.3 Step / version
  getCurrentVersion(episodeId: string, step: StepId): Promise<StepVersion>
  listVersions(episodeId: string, step: StepId): Promise<StepVersion[]>
  // §4.4 Decision（推进流水线的唯一入口）
  postDecision(episodeId: string, step: StepId, d: Omit<Decision, 'episode_id' | 'step' | 'at'>): Promise<RunInfo>
  // §4.4b 选用旧版（审阅指针；见 SELECT-VERSION-CONTRACT）
  selectVersion(episodeId: string, step: StepId, version: string, note?: string): Promise<RunInfo>
  // §4.5 Health
  getPlatformHealth(): Promise<PlatformHealth>
}
