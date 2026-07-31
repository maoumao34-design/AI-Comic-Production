// 通用数据模型 —— 严格对齐 docs/BACKEND-API-CONTRACT.md §2（通用外壳）。
// 各步 content 的具体 schema 由该步 owner 定义（见 CONTENT-SCHEMA-*.md），此处用联合类型占位。

/** 步骤 id（与归档目录名一致） */
export type StepId =
  | '01-script'
  | '02-storyboard'
  | '03-assets'
  | '04-keyframes'
  | '05-clips'
  | '06-voice-sub'
  | '07-final'

export const STEP_ORDER: StepId[] = [
  '01-script',
  '02-storyboard',
  '03-assets',
  '04-keyframes',
  '05-clips',
  '06-voice-sub',
  '07-final',
]

export const STEP_LABELS: Record<StepId, string> = {
  '01-script': '01 · 剧本准备',
  '02-storyboard': '02 · 分场分镜',
  '03-assets': '03 · 一致性资产',
  '04-keyframes': '04 · 关键帧',
  '05-clips': '05 · 分段视频',
  '06-voice-sub': '06 · 配音字幕',
  '07-final': '07 · 后期合成',
}

/** 集状态 */
export type EpisodeStatus = 'draft' | 'in_progress' | 'done' | 'blocked'

/** §2.1 Episode */
export interface Episode {
  episode_id: string
  title: string
  status: EpisodeStatus
  current_step: StepId
  created_at: string
  updated_at: string
}

/** 步骤版本状态 */
export type StepVersionStatus =
  | 'running'
  | 'awaiting_review'
  | 'approved'
  | 'rejected'
  | 'superseded'

/** Run 状态 */
export type RunStatus = 'running' | 'paused_at_checkpoint' | 'done' | 'failed' | 'paused'

/** 产物（图/视频/音频/文本） */
export interface Artifact {
  type: 'image' | 'video' | 'audio' | 'text'
  url: string
  label: string
  meta?: Record<string, unknown>
}

/** §2.2 StepVersion（= checkpoint 展示单元） */
export interface StepVersion {
  episode_id: string
  step: StepId
  version: string
  is_latest: boolean
  status: StepVersionStatus
  model?: string
  seed?: number
  params?: Record<string, unknown>
  artifacts: Artifact[]
  refs?: string[]
  archive_path: string
  prompt_path?: string
  meta_path?: string
  /** 各步 owner 定义的 step 专属内容 schema；前端按 step 类型 narrow */
  content: unknown
  created_at: string
  duration_ms?: number
  failure?: { code: string; reason: string; retryable: boolean } | null
}

/** §2.3 Decision action（已锁定语义） */
export type DecisionAction = 'approve' | 'revise' | 'rollback' | 'regenerate'

export const DECISION_META: Record<
  DecisionAction,
  { icon: string; label: string; hint: string }
> = {
  approve: { icon: '✅', label: '通过', hint: '归档为 latest，推进下一步' },
  revise: { icon: '✏️', label: '修改', hint: '带修改意见重跑当前步' },
  regenerate: { icon: '🔄', label: '重生', hint: '换参数/seed 重跑当前步' },
  rollback: { icon: '↩️', label: '回退', hint: '回上一步重做' },
}

/** §2.3 Decision（提交后端） */
export interface Decision {
  episode_id: string
  step: StepId
  version: string
  action: DecisionAction
  note?: string
  params_override?: Record<string, unknown>
  at: string
}

/** Run 里每个 step 的状态（允许 pending=尚未跑到） */
export type RunStepStatus = StepVersionStatus | 'pending'

/** Run 概览 */
export interface RunInfo {
  run_id: string
  episode_id: string
  status: RunStatus
  current_step: StepId
  steps: { step: StepId; status: RunStepStatus; latest_version?: string }[]
  started_at: string
}

/** 平台健康（§4.5） */
export interface PlatformHealth {
  comfyui: 'ok' | 'degraded' | 'down' | 'not_configured'
  video_model: 'ok' | 'degraded' | 'down' | 'not_configured'
  elevenlabs: 'ok' | 'degraded' | 'down' | 'not_configured'
}
