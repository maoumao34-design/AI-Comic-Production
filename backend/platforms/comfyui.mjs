// platforms/comfyui.mjs — ComfyUI 平台胶水（五件套）
// 支持：本地 ComfyUI（默认 http://127.0.0.1:8188，无需 Key）
//       Comfy Cloud（https://cloud.comfy.org + X-API-Key）
// 环境变量：COMFYUI_BASE_URL（必填才算已配置）、COMFYUI_API_KEY（Cloud 必填；本地可空）
// 铁律：未配置如实 unconfigured；探活失败如实 down — 不伪造已连接。

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_LOCAL = "http://127.0.0.1:8188";
const POLL_MS = Number(process.env.COMFYUI_POLL_MS || 1500);
const TIMEOUT_MS = Number(process.env.COMFYUI_TIMEOUT_MS || 300_000);

function cfg() {
  const base = (process.env.COMFYUI_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.COMFYUI_API_KEY || "").trim();
  return { base, apiKey };
}

export function isConfigured() {
  return Boolean(cfg().base);
}

function isCloud(base) {
  try {
    const h = new URL(base).hostname;
    return h === "cloud.comfy.org" || h.endsWith(".comfy.org");
  } catch {
    return false;
  }
}

function headers(apiKey) {
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (apiKey) h["X-API-Key"] = apiKey;
  return h;
}

async function fetchJson(url, { method = "GET", body, apiKey, timeoutMs = 15_000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: headers(apiKey),
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* raw */ }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(t);
  }
}

/** 健康检查：本地 GET /system_stats；Cloud GET /api/user */
export async function health() {
  const { base, apiKey } = cfg();
  if (!base) {
    return {
      status: "unconfigured",
      detail: "COMFYUI_BASE_URL 未设置（本地示例：http://127.0.0.1:8188；Cloud：https://cloud.comfy.org）",
    };
  }
  if (isCloud(base) && !apiKey) {
    return {
      status: "unconfigured",
      detail: "Comfy Cloud 需 COMFYUI_API_KEY（platform.comfy.org → API Keys；Free 档无 API）",
    };
  }
  try {
    if (isCloud(base)) {
      const r = await fetchJson(`${base}/api/user`, { apiKey });
      if (r.ok) return { status: "ok", detail: `cloud ok (${base})` };
      if (r.status === 401 || r.status === 403) {
        return { status: "down", detail: `鉴权失败 HTTP ${r.status}（检查 API Key / 订阅档）` };
      }
      return { status: "down", detail: `cloud health HTTP ${r.status}: ${(r.text || "").slice(0, 160)}` };
    }
    // 本地：/system_stats 最稳；兼容少数版本仅有 /object_info
    let r = await fetchJson(`${base}/system_stats`, { apiKey });
    if (!r.ok) r = await fetchJson(`${base}/object_info`, { apiKey, timeoutMs: 30_000 });
    if (r.ok) {
      const devices = r.json?.devices;
      const tip = Array.isArray(devices) && devices[0]?.name ? ` device=${devices[0].name}` : "";
      return { status: "ok", detail: `local ok (${base})${tip}` };
    }
    return { status: "down", detail: `local health HTTP ${r.status}: ${(r.text || "").slice(0, 160)}` };
  } catch (e) {
    return { status: "down", detail: `连接失败: ${e?.message || e}` };
  }
}

/**
 * submit — 提交工作流（API format prompt graph）
 * @param {object} workflowOrPrompt ComfyUI API prompt 图（节点 dict）或 { prompt, client_id? }
 * @param {object} [params]
 * @returns {{ job_id: string, number?: number }}
 */
export async function submit(workflowOrPrompt, _refs = [], params = {}, _model) {
  const { base, apiKey } = cfg();
  if (!base) throw Object.assign(new Error("COMFYUI_BASE_URL 未配置"), { code: "unconfigured" });
  if (isCloud(base) && !apiKey) throw Object.assign(new Error("Cloud 需 COMFYUI_API_KEY"), { code: "unconfigured" });

  const prompt = workflowOrPrompt?.prompt && typeof workflowOrPrompt.prompt === "object"
    ? workflowOrPrompt.prompt
    : workflowOrPrompt;
  const client_id = workflowOrPrompt?.client_id || params.client_id || randomUUID();
  const body = { prompt, client_id };
  if (params.prompt_id) body.prompt_id = params.prompt_id;

  const r = await fetchJson(`${base}/prompt`, { method: "POST", body, apiKey, timeoutMs: 60_000 });
  if (!r.ok) {
    const msg = r.json?.error || r.json?.node_errors || r.text;
    throw Object.assign(new Error(`ComfyUI submit failed HTTP ${r.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`), {
      code: "submit_failed",
      status: r.status,
      detail: r.json,
    });
  }
  const job_id = r.json?.prompt_id;
  if (!job_id) throw Object.assign(new Error("ComfyUI 未返回 prompt_id"), { code: "submit_failed", detail: r.json });
  return { job_id, number: r.json?.number, client_id, base, submitted_at: new Date().toISOString() };
}

/** record — 返回可写入 params.json / meta.md 的记录块（调用方负责落盘） */
export function record(job, extra = {}) {
  return {
    platform: "comfyui",
    base_url: cfg().base || null,
    mode: isCloud(cfg().base || "") ? "cloud" : "local",
    job_id: job?.job_id || null,
    client_id: job?.client_id || null,
    queue_number: job?.number ?? null,
    submitted_at: job?.submitted_at || null,
    ...extra,
  };
}

/**
 * poll — 查 /history/{prompt_id}
 * @returns {{ status: 'queued'|'running'|'completed'|'failed'|'unknown', outputs?: object, error?: string, raw?: object }}
 */
export async function poll(job_id) {
  const { base, apiKey } = cfg();
  if (!base) throw Object.assign(new Error("COMFYUI_BASE_URL 未配置"), { code: "unconfigured" });
  const r = await fetchJson(`${base}/history/${job_id}`, { apiKey });
  if (!r.ok) {
    if (r.status === 404) return { status: "queued", job_id };
    return { status: "unknown", job_id, error: `history HTTP ${r.status}` };
  }
  const entry = r.json?.[job_id];
  if (!entry) return { status: "queued", job_id }; // 尚未进 history
  const statusStr = entry.status?.status_str || entry.status?.completed ? "success" : null;
  if (entry.status?.status_str === "error" || entry.status?.completed === false && entry.status?.status_str === "error") {
    return { status: "failed", job_id, error: JSON.stringify(entry.status?.messages || entry.status), raw: entry };
  }
  // 有 outputs 即完成
  const outputs = entry.outputs;
  if (outputs && Object.keys(outputs).length > 0) {
    return { status: "completed", job_id, outputs, raw: entry };
  }
  if (statusStr === "success" || entry.status?.completed === true) {
    return { status: "completed", job_id, outputs: outputs || {}, raw: entry };
  }
  return { status: "running", job_id, raw: entry };
}

/** 轮询直到完成/失败/超时 */
export async function wait(job_id, { timeoutMs = TIMEOUT_MS, pollMs = POLL_MS } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const p = await poll(job_id);
    if (p.status === "completed" || p.status === "failed") return p;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return { status: "failed", job_id, error: `timeout after ${timeoutMs}ms` };
}

/** 从 history outputs 抽取图片文件描述 */
export function listOutputImages(outputs) {
  const files = [];
  if (!outputs || typeof outputs !== "object") return files;
  for (const [nodeId, nodeOut] of Object.entries(outputs)) {
    const imgs = nodeOut?.images || [];
    for (const img of imgs) {
      files.push({
        node_id: nodeId,
        filename: img.filename,
        subfolder: img.subfolder || "",
        type: img.type || "output",
      });
    }
  }
  return files;
}

/** 下载单张图到 Buffer */
export async function downloadImage({ filename, subfolder = "", type = "output" }) {
  const { base, apiKey } = cfg();
  const q = new URLSearchParams({ filename, subfolder, type });
  const url = `${base}/view?${q}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60_000);
  try {
    const h = {};
    if (apiKey) h["X-API-Key"] = apiKey;
    const res = await fetch(url, { headers: h, signal: ac.signal });
    if (!res.ok) throw new Error(`view HTTP ${res.status} for ${filename}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } finally {
    clearTimeout(t);
  }
}

/**
 * recover — 下载产物并写入 destDir；返回写入的相对文件名列表
 */
export async function recover(job_id, destDir, { prefix = "output" } = {}) {
  const p = await poll(job_id);
  if (p.status !== "completed") {
    throw Object.assign(new Error(`job ${job_id} not completed: ${p.status} ${p.error || ""}`), { code: "not_ready", poll: p });
  }
  await fs.mkdir(destDir, { recursive: true });
  const imgs = listOutputImages(p.outputs);
  const written = [];
  let i = 0;
  for (const img of imgs) {
    i += 1;
    const ext = path.extname(img.filename) || ".png";
    const fname = imgs.length === 1 ? `${prefix}${ext}` : `${prefix}-${i}${ext}`;
    const buf = await downloadImage(img);
    await fs.writeFile(path.join(destDir, fname), buf);
    written.push({ filename: fname, source: img });
  }
  await fs.writeFile(
    path.join(destDir, "comfy-history.json"),
    JSON.stringify({ job_id, outputs: p.outputs, recovered_at: new Date().toISOString() }, null, 2),
  );
  return { job_id, files: written, status: "recovered" };
}

/**
 * retry — 换参重跑：把 workflow 里可覆盖的 seed/prompt 写回后重新 submit
 * @param {object} workflow API prompt graph
 * @param {object} newParams { seed?, positive?, negative?, overrides?: {nodeId: {inputs: {...}}} }
 */
export async function retry(workflow, newParams = {}) {
  const next = structuredClone(workflow?.prompt && typeof workflow.prompt === "object" ? workflow.prompt : workflow);
  if (newParams.overrides && typeof newParams.overrides === "object") {
    for (const [nid, patch] of Object.entries(newParams.overrides)) {
      if (!next[nid]) continue;
      next[nid].inputs = { ...(next[nid].inputs || {}), ...(patch.inputs || patch) };
    }
  }
  // 约定：节点 class_type === KSampler* 时写 seed；CLIPTextEncode 按 title/role 可选覆盖
  if (newParams.seed != null) {
    for (const node of Object.values(next)) {
      if (node?.class_type && String(node.class_type).startsWith("KSampler") && node.inputs) {
        node.inputs.seed = Number(newParams.seed);
      }
    }
  }
  if (typeof newParams.positive === "string") {
    for (const node of Object.values(next)) {
      if (node?.class_type === "CLIPTextEncode" && node?.meta?.role === "positive" && node.inputs) {
        node.inputs.text = newParams.positive;
      }
    }
  }
  if (typeof newParams.negative === "string") {
    for (const node of Object.values(next)) {
      if (node?.class_type === "CLIPTextEncode" && node?.meta?.role === "negative" && node.inputs) {
        node.inputs.text = newParams.negative;
      }
    }
  }
  return submit(next, [], { client_id: newParams.client_id });
}

export const LOCAL_DEFAULT_BASE = DEFAULT_LOCAL;
export default { isConfigured, health, submit, record, poll, wait, recover, retry, listOutputImages, downloadImage };
