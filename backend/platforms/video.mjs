// platforms/video.mjs — 视频模型平台入口（Seedance / Kling / Wan）
// MVP：仅健康检查槽位；未配 key 如实 unconfigured。五件套（submit/record/poll/recover/retry）占位，不伪造调用成功。

const PROVIDERS = {
  seedance: { envKey: "SEEDANCE_API_KEY", envBase: "SEEDANCE_BASE_URL", label: "Seedance" },
  kling: { envKey: "KLING_API_KEY", envBase: "KLING_BASE_URL", label: "Kling" },
  wan: { envKey: "WAN_API_KEY", envBase: "WAN_BASE_URL", label: "Wan" },
};

function providerHealth(id) {
  const p = PROVIDERS[id];
  if (!p) return { status: "unconfigured", detail: `unknown provider: ${id}` };
  const key = (process.env[p.envKey] || "").trim();
  const base = (process.env[p.envBase] || "").trim();
  if (!key && !base) {
    return { status: "unconfigured", detail: `${p.label}：未设 ${p.envKey}/${p.envBase}（custom_env）` };
  }
  if (!key) {
    return { status: "unconfigured", detail: `${p.label}：缺 ${p.envKey}` };
  }
  // 有 key 也不假装已探活成功（无真实 endpoint 契约前如实 degraded）
  return {
    status: "degraded",
    detail: `${p.label}：key 已设，五件套尚未接线（入口保留；不伪造已连）`,
  };
}

/** 聚合健康：任一 provider 有配置则反映；全无则 unconfigured */
export async function health() {
  const parts = {};
  let anyConfigured = false;
  for (const id of Object.keys(PROVIDERS)) {
    parts[id] = providerHealth(id);
    if (parts[id].status !== "unconfigured") anyConfigured = true;
  }
  if (!anyConfigured) {
    return {
      status: "unconfigured",
      detail: "Seedance/Kling/Wan key 未配置；步骤 05 多候选需讨论后锁定",
      providers: parts,
    };
  }
  return {
    status: "degraded",
    detail: "至少一视频平台有 env，但五件套未接线",
    providers: parts,
  };
}

export async function submit() {
  throw Object.assign(new Error("video submit not_implemented — 平台未锁定/未接线"), { code: "not_implemented" });
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
