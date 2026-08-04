// platforms/elevenlabs.mjs — ElevenLabs TTS 入口（步骤 06）
// MVP：健康检查槽位；五件套占位。铁律：未配 key 如实 unconfigured。

function cfg() {
  return {
    apiKey: (process.env.ELEVENLABS_API_KEY || "").trim(),
    base: (process.env.ELEVENLABS_BASE_URL || "https://api.elevenlabs.io").trim().replace(/\/+$/, ""),
  };
}

export function isConfigured() {
  return Boolean(cfg().apiKey);
}

export async function health() {
  const { apiKey, base } = cfg();
  if (!apiKey) {
    return {
      status: "unconfigured",
      detail: "ELEVENLABS_API_KEY 未设置（custom_env）；步骤 06 入口已保留",
    };
  }
  // 有 key 时做轻量探活；失败如实 down，成功 ok
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(`${base}/v1/user`, {
      headers: { "xi-api-key": apiKey, Accept: "application/json" },
      signal: ac.signal,
    });
    clearTimeout(t);
    if (res.ok) return { status: "ok", detail: `elevenlabs ok (${base})` };
    if (res.status === 401 || res.status === 403) {
      return { status: "down", detail: `鉴权失败 HTTP ${res.status}` };
    }
    return { status: "degraded", detail: `HTTP ${res.status}；TTS 五件套尚未全量接线` };
  } catch (e) {
    return { status: "down", detail: `探活失败: ${e?.message || e}` };
  }
}

export async function submit() {
  throw Object.assign(new Error("elevenlabs submit not_implemented"), { code: "not_implemented" });
}
export function record() {
  throw Object.assign(new Error("elevenlabs record not_implemented"), { code: "not_implemented" });
}
export async function poll() {
  throw Object.assign(new Error("elevenlabs poll not_implemented"), { code: "not_implemented" });
}
export async function recover() {
  throw Object.assign(new Error("elevenlabs recover not_implemented"), { code: "not_implemented" });
}
export async function retry() {
  throw Object.assign(new Error("elevenlabs retry not_implemented"), { code: "not_implemented" });
}
