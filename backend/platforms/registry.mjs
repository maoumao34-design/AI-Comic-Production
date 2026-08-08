// platforms/registry.mjs — 每步平台接入槽（可视化产品用）
// 铁律：不伪造已连接；多候选步骤 primary=null + needs_decision，讨论后再锁。

/** @typedef {{ id: string, label: string, module?: string }} PlatformRef */
/** @typedef {{
 *   step: string,
 *   name: string,
 *   primary: string | null,
 *   candidates: string[],
 *   status: 'locked' | 'needs_decision' | 'none',
 *   entry: string,
 *   note?: string
 * }} StepPlatformSlot */

/** 平台目录（id → 说明）。真实探活走各自 health。 */
export const PLATFORMS = {
  none: { id: "none", label: "无外部生成平台（文本/人工）" },
  comfyui: { id: "comfyui", label: "ComfyUI", module: "./comfyui.mjs" },
  seedance: { id: "seedance", label: "Seedance", module: "./video.mjs" },
  kling: { id: "kling", label: "Kling", module: "./video.mjs" },
  wan: { id: "wan", label: "Wan", module: "./video.mjs" },
  elevenlabs: { id: "elevenlabs", label: "ElevenLabs TTS", module: "./elevenlabs.mjs" },
  local_compose: { id: "local_compose", label: "本地合成（ffmpeg 等）", module: "./compose.mjs" },
};

/** @type {StepPlatformSlot[]} */
export const STEP_PLATFORM_SLOTS = [
  {
    step: "01",
    name: "剧本准备",
    primary: null,
    candidates: [],
    status: "none",
    entry: "content schema / 人工或脚本",
    note: "无 GPU 平台；产物为文本归档",
  },
  {
    step: "02",
    name: "分场分镜",
    primary: null,
    candidates: [],
    status: "none",
    entry: "content schema / 人工或脚本",
    note: "无 GPU 平台；产物为分镜 JSON",
  },
  {
    step: "03",
    name: "一致性资产",
    primary: "comfyui",
    candidates: ["comfyui"],
    status: "locked",
    entry: "platforms/comfyui.mjs + workflows/03-assets/",
    note: "角色/场景一致性资产；CLI=ep01-cli run --step 03",
  },
  {
    step: "04",
    name: "关键帧",
    primary: "comfyui",
    candidates: ["comfyui"],
    status: "locked",
    entry: "platforms/comfyui.mjs + workflows/04-keyframes/",
    note: "关键帧出图；CLI=ep01-cli run --step 04",
  },
  {
    step: "05",
    name: "分段视频",
    primary: "wan",
    candidates: ["wan", "kling", "seedance", "comfyui"],
    status: "locked",
    entry: "platforms/video.mjs + workflows/05-clips/wan-i2v（本机草稿）",
    note: "草稿=本机 Wan I2V；成片质量不够再切 Kling/Seedance（见 docs/PRODUCTION-STACK.md）",
  },
  {
    step: "06",
    name: "配音字幕",
    primary: "elevenlabs",
    candidates: ["elevenlabs"],
    status: "locked",
    entry: "platforms/elevenlabs.mjs",
    note: "TTS + 字幕轨；key 未配时 unconfigured",
  },
  {
    step: "07",
    name: "后期合成",
    primary: "local_compose",
    candidates: ["local_compose"],
    status: "locked",
    entry: "platforms/compose.mjs",
    note: "成片合成入口；本机工具链，不依赖云 GPU",
  },
];

export function slotForStep(stepId) {
  return STEP_PLATFORM_SLOTS.find((s) => s.step === stepId) || null;
}

export function platformMap() {
  return {
    platforms: PLATFORMS,
    steps: STEP_PLATFORM_SLOTS,
    policy: {
      cli_is_not_product: true,
      multi_candidate_requires_discussion: true,
      ask_director_when_uncertain: true,
    },
  };
}
