// platforms/video.mjs — 视频平台（步骤 05）
// 方案锁定：草稿 = 本机 Wan I2V；成片候选 Kling / Seedance（见 docs/PRODUCTION-STACK.md）
// 铁律：未装模型 / 未配 key 如实 unconfigured；submit 在真实 graph 未就绪前 not_implemented。

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const COMFY_ROOT = process.env.COMFYUI_ROOT || "E:\\ComfyUI";

const CLOUD = {
  seedance: { envKey: "SEEDANCE_API_KEY", envBase: "SEEDANCE_BASE_URL", label: "Seedance" },
  kling: { envKey: "KLING_API_KEY", envBase: "KLING_BASE_URL", label: "Kling" },
  wan_cloud: { envKey: "WAN_API_KEY", envBase: "WAN_BASE_URL", label: "Wan Cloud" },
};

async function dirHasModel(dir, patterns) {
  try {
    const names = await fs.readdir(dir);
    return names.some((n) => patterns.some((p) => n.toLowerCase().includes(p)));
  } catch {
    return false;
  }
}

/** 本机 Wan：检查常见模型目录是否已有 wan 权重 */
async function wanLocalHealth() {
  const roots = [
    path.join(COMFY_ROOT, "models", "diffusion_models"),
    path.join(COMFY_ROOT, "models", "unet"),
    path.join(COMFY_ROOT, "models", "checkpoints"),
  ];
  let found = false;
  for (const r of roots) {
    if (await dirHasModel(r, ["wan2.1", "wan2_1", "wan-i2v", "wani2v"])) {
      found = true;
      break;
    }
  }
  const placeholder = path.join(REPO_ROOT, "workflows", "05-clips", "wan-i2v.placeholder.json");
  let hasRealGraph = false;
  try {
    const j = JSON.parse(await fs.readFile(placeholder.replace(".placeholder", ""), "utf8"));
    hasRealGraph = j && !j._meta?.status?.includes?.("placeholder");
  } catch {
    hasRealGraph = false;
  }
  // 也接受显式 wan-i2v.api.json
  try {
    await fs.access(path.join(REPO_ROOT, "workflows", "05-clips", "wan-i2v.api.json"));
    hasRealGraph = true;
  } catch {
    /* keep */
  }

  if (!found) {
    return {
      status: "unconfigured",
      detail: "本机 Wan 权重未找到（放到 ComfyUI models/diffusion_models 或 unet）。草稿路径见 docs/PRODUCTION-STACK.md",
    };
  }
  if (!hasRealGraph) {
    return {
      status: "degraded",
      detail: "已检测到 Wan 相关文件，但 workflows/05-clips/wan-i2v.api.json 尚未就绪；submit 仍 not_implemented",
    };
  }
  return { status: "ok", detail: `wan_local models under ${COMFY_ROOT}` };
}

function cloudHealth(id) {
  const p = CLOUD[id];
  if (!p) return { status: "unconfigured", detail: `unknown: ${id}` };
  const key = (process.env[p.envKey] || "").trim();
  if (!key) {
    return { status: "unconfigured", detail: `${p.label}：未设 ${p.envKey}` };
  }
  return {
    status: "degraded",
    detail: `${p.label}：key 已设，五件套尚未接线（成片精修用；不伪造已连）`,
  };
}

export async function health() {
  const provider = (process.env.VIDEO_PROVIDER || "wan_local").trim();
  const wan_local = await wanLocalHealth();
  const parts = {
    wan_local,
    seedance: cloudHealth("seedance"),
    kling: cloudHealth("kling"),
    wan_cloud: cloudHealth("wan_cloud"),
  };
  const primary = parts[provider] || wan_local;
  return {
    status: primary.status,
    detail: `VIDEO_PROVIDER=${provider} · ${primary.detail}`,
    providers: parts,
    policy: "draft=wan_local; final candidates=kling|seedance — docs/PRODUCTION-STACK.md",
  };
}

export async function submit() {
  throw Object.assign(
    new Error(
      "video submit not_implemented — 下载 Wan I2V 权重并把 workflows/05-clips/wan-i2v.api.json 换成可提交图后即可接线",
    ),
    { code: "not_implemented" },
  );
}
export function record() {
  throw Object.assign(new Error("video record not_implemented"), { code: "not_implemented" });
}
export async function poll() {
  throw Object.assign(new Error("video poll not_implemented"), { code: "not_implemented" });
}
export async function recover() {
  throw Object.assign(new Error("video recover not_implemented"), { code: "not_implemented" });
}
export async function retry() {
  throw Object.assign(new Error("video retry not_implemented"), { code: "not_implemented" });
}
