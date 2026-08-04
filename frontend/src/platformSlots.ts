import type { StepId, PlatformHealth } from './types'

/** 平台接入槽位（对齐总控 P0 §7 + 工程师接线）。FE 只展示/选参，不直连平台。 */
export type PlatformId = 'comfyui' | 'seedance' | 'kling' | 'wan' | 'elevenlabs' | 'local_compose' | 'none'

export interface PlatformOption {
  id: PlatformId
  label: string
  /** 对应 /health/platforms 的键；none/local 无健康探针 */
  healthKey?: keyof Omit<PlatformHealth, 'overall'>
}

export interface StepPlatformSlot {
  step: StepId
  /** 主平台（默认选中；多候选时未锁定） */
  primary: PlatformOption
  /** 同一步可选的其他平台；多选时 UI 标明「先讨论再定」 */
  candidates: PlatformOption[]
  /** true = 多平台未锁定，须讨论/导演确认后再写死 */
  discussFirst: boolean
  /** 给接手 agent / 人类看的接入说明 */
  note: string
}

const COMFY: PlatformOption = { id: 'comfyui', label: 'ComfyUI', healthKey: 'comfyui' }
const SEEDANCE: PlatformOption = { id: 'seedance', label: 'Seedance', healthKey: 'video_models' }
const KLING: PlatformOption = { id: 'kling', label: 'Kling', healthKey: 'video_models' }
const WAN: PlatformOption = { id: 'wan', label: 'Wan', healthKey: 'video_models' }
const ELEVEN: PlatformOption = { id: 'elevenlabs', label: 'ElevenLabs', healthKey: 'elevenlabs' }
const LOCAL: PlatformOption = { id: 'local_compose', label: '本地合成 (ffmpeg)' }
const NONE: PlatformOption = { id: 'none', label: '内容步（无生成平台）' }

/** 每步平台槽位表 —— CLI≠产品；网页人审主路径 */
export const STEP_PLATFORM_SLOTS: Record<StepId, StepPlatformSlot> = {
  '01': {
    step: '01',
    primary: NONE,
    candidates: [],
    discussFirst: false,
    note: '剧本/解说词由内容侧产出；网页展示 + decision，无 Comfy 入口。',
  },
  '02': {
    step: '02',
    primary: NONE,
    candidates: [],
    discussFirst: false,
    note: '分场分镜由内容侧产出；网页展示 + decision，无生成平台入口。',
  },
  '03': {
    step: '03',
    primary: COMFY,
    candidates: [COMFY],
    discussFirst: false,
    note: '一致性资产经后端 Job/Task 调 ComfyUI；产物落 assets/…/outputs/ 后在此人审。',
  },
  '04': {
    step: '04',
    primary: COMFY,
    candidates: [COMFY],
    discussFirst: false,
    note: '关键帧经后端调 ComfyUI；引用 03 锁定资产，人审后再进 05。',
  },
  '05': {
    step: '05',
    primary: SEEDANCE,
    candidates: [SEEDANCE, KLING, WAN, COMFY],
    discussFirst: true,
    note: '分段视频多平台候选未锁定。选前先讨论；拿不准找导演确认。选定后经 decision.params_override.provider 下发。',
  },
  '06': {
    step: '06',
    primary: ELEVEN,
    candidates: [ELEVEN],
    discussFirst: false,
    note: '旁白 TTS 经后端调 ElevenLabs；字幕轨与音频在此预览后人审。',
  },
  '07': {
    step: '07',
    primary: LOCAL,
    candidates: [LOCAL],
    discussFirst: false,
    note: '后期合成走本地/后端合成管线；成片产物在此预览验收。',
  },
}
