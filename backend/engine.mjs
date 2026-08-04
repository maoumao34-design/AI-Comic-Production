// engine.mjs — 可视化产品后端骨架（MVP）：7 步状态机 + 版本归档 + 占位产物
// 零依赖（纯 Node ESM）。实现 BACKEND-API-CONTRACT v0.2 的核心闭环。
// ComfyUI：platforms/comfyui.mjs 已接真实探活（设 COMFYUI_BASE_URL）；步骤产物默认仍占位，本机出图用 scripts/comfy-run-workflow.mjs。
// 视频模型 / ElevenLabs / 合成：入口已保留；未配置时如实 unconfigured，不伪造已连接。
// 归档默认对齐仓库根 assets/（与接手 agent / ep01-cli 同源），可用 ASSETS_DIR 覆盖。
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as comfyui from "./platforms/comfyui.mjs";
import * as video from "./platforms/video.mjs";
import * as elevenlabs from "./platforms/elevenlabs.mjs";
import * as compose from "./platforms/compose.mjs";
import { platformMap, slotForStep, STEP_PLATFORM_SLOTS } from "./platforms/registry.mjs";

// ---- 配置 ----
const STEPS = [
  { id: "01", name: "剧本准备" },
  { id: "02", name: "分场分镜" },
  { id: "03", name: "一致性资产" },
  { id: "04", name: "关键帧" },
  { id: "05", name: "分段视频" },
  { id: "06", name: "配音字幕" },
  { id: "07", name: "后期合成" },
];
const STEP_DIR = {
  "01": "01-script", "02": "02-storyboard", "03": "03-assets",
  "04": "04-keyframes", "05": "05-clips", "06": "06-voice-sub", "07": "07-final",
};
// 默认：仓库根 assets/（与 CLI / 总控约定一致），不再写 backend/data/assets
const ASSETS_DIR = process.env.ASSETS_DIR
  ? path.resolve(process.env.ASSETS_DIR)
  : path.join(import.meta.dirname, "..", "assets");
const FAIL_THRESHOLD = Number(process.env.FAIL_THRESHOLD || 3); // PIPELINE §5

// ---- 内存状态 ----
/** @type {Map<string, Episode>} */
const episodes = new Map();
/** @type {Map<string, Run>} */
const runs = new Map();
const queue = []; // 近期任务（可观测）

function nextId(prefix) {
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}
function now() { return new Date().toISOString(); }
function nextVersion(arr) {
  const n = (arr?.length || 0) + 1;
  return "v" + n;
}

// ---- 归档 ----
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }
async function writeArchive(episodeId, stepId, version, { prompt, params, meta, outputs }) {
  const dir = path.join(ASSETS_DIR, episodeId, STEP_DIR[stepId], version);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, "prompt.md"), prompt || "");
  await fs.writeFile(path.join(dir, "params.json"), JSON.stringify(params || {}, null, 2));
  await fs.writeFile(path.join(dir, "meta.md"), meta || "");
  const refsDir = path.join(dir, "refs"); await ensureDir(refsDir);
  const artifacts = [];
  for (const o of outputs || []) {
    const fname = o.filename || `output.${o.ext || "txt"}`;
    await fs.writeFile(path.join(dir, fname), o.content || "");
    artifacts.push({
      type: o.type || "text",
      label: o.label || fname,
      url: `/api/v1/artifacts?path=${episodeId}/${STEP_DIR[stepId]}/${version}/${fname}`,
      meta: o.meta || {},
    });
  }
  // latest 指针（README 形式，跨平台）
  const latestDir = path.join(ASSETS_DIR, episodeId, STEP_DIR[stepId], "latest");
  await ensureDir(latestDir);
  await fs.writeFile(path.join(latestDir, "README.md"), `# latest\n\n→ ${version}\n\napproved at ${now()}\n`);
  return { archive_path: `${episodeId}/${STEP_DIR[stepId]}/${version}/`, artifacts };
}

async function readArtifact(relPath) {
  const full = path.join(ASSETS_DIR, relPath);
  // 防目录穿越
  const norm = path.normalize(full);
  if (!norm.startsWith(path.normalize(ASSETS_DIR))) return null;
  try { return { abs: norm, buf: await fs.readFile(norm) }; } catch { return null; }
}

// ---- 占位产物生成（stub；平台入口见 registry，不假装已真实出图）----
function placeholderGen(episodeId, stepId, inputs = {}) {
  const step = STEPS.find((s) => s.id === stepId);
  const slot = slotForStep(stepId);
  const seed = inputs.seed ?? Math.floor(Math.random() * 1e9);
  const platformId = slot?.primary || (slot?.candidates?.[0] ?? null);
  const model = platformId
    ? `<占位：${platformId} 未真实调用>`
    : `<占位：${stepId} 无外部生成平台>`;
  const params = {
    model, seed,
    platform: platformId,
    platform_slot: slot ? { primary: slot.primary, candidates: slot.candidates, status: slot.status } : null,
    ...(inputs.params_override || {}),
  };
  const note = inputs.note ? `\n\n## 用户修改意见\n${inputs.note}` : "";
  const prompt = `# ${step.name}（步骤 ${stepId}）占位 Prompt\n\n集号：${episodeId}\n平台槽：${platformId || "none"}（${slot?.status || "none"}）\n这是可视化产品占位产物；真实生成走对应平台入口或 GPU CLI。${note}`;
  const meta =
    `# ${step.name} v? meta\n\n- model: ${model}\n- seed: ${seed}\n- platform: ${platformId || "none"}\n` +
    `- platform_status: ${slot?.status || "none"}\n- 生成方式: 占位桩（stub）\n- entry: ${slot?.entry || "n/a"}\n` +
    `- 耗时(ms): ${Math.floor(20 + Math.random() * 80)}\n- 生成时间: ${now()}\n`;
  // 每步给一个占位文本产物，结构示意（真实字段由各步 content schema 定）
  const contentShape = {
    "01": { beats: [{ beat_id: "b1", narration_text: "（占位旁白）…", emotion: "neutral", visual_hint: "…" }] },
    "02": { shots: [{ shot_id: "s1", linked_beat_id: "b1", scene: "（占位场景）" }] },
    "03": { assets: [{ asset_id: "char-1", kind: "character_three_view", label: "（占位角色三视图）" }] },
    "04": { keyframes: [{ frame_id: "kf-1", label: "（占位关键帧）" }] },
    "05": { clips: [{ clip_id: "c1", duration_s: 5, label: "（占位分段视频）" }] },
    "06": { voiceover: { tts: "elevenlabs" }, subtitle_track: { cues: [{ index: 1, text: "（占位字幕）" }] } },
    "07": { final: { duration_s: 90, label: "（占位成片）" } },
  }[stepId] || {};
  const outputs = [
    { filename: "output.json", type: "json", label: `${step.name} 产出（占位）`,
      content: JSON.stringify({ episode_id: episodeId, step: stepId, platform: platformId, content: contentShape, params }, null, 2) },
  ];
  return { prompt, params, meta, outputs, model, seed, content: contentShape, platform: platformId, platform_slot: slot };
}

// ---- 状态机 ----
/** 跑一步：生成占位产物、归档、置为 awaiting_review。返回新版本对象。 */
async function runStep(run, stepId, inputs = {}) {
  const ep = episodes.get(run.episode_id);
  const sv = run.steps[stepId];
  const version = nextVersion(sv.versions);
  const t0 = Date.now();
  const gen = placeholderGen(run.episode_id, stepId, inputs);
  // 模拟偶发失败（演示 failed/重试链路）——默认不失败，可通过 inputs.force_fail 测试
  const fail = inputs.force_fail === true || (inputs.fail_rate && Math.random() < inputs.fail_rate);
  const dur_ms = Date.now() - t0 + Math.floor(Math.random() * 50);
  const base = {
    episode_id: run.episode_id, step: stepId, version, is_latest: false,
    status: fail ? "failed" : "awaiting_review",
    model: gen.model, seed: gen.seed, params: gen.params,
    platform: gen.platform || null,
    platform_slot: gen.platform_slot
      ? { primary: gen.platform_slot.primary, candidates: gen.platform_slot.candidates, status: gen.platform_slot.status, entry: gen.platform_slot.entry }
      : null,
    artifacts: [], refs: [], archive_path: "", prompt_path: "", meta_path: "",
    content: gen.content, created_at: now(), duration_ms: dur_ms,
    failure: fail ? { code: "placeholder_forced_fail", reason: "MVP 占位：模拟失败以演示重试/暂停", retryable: true } : null,
    decision_history: [],
  };
  if (!fail) {
    const arch = await writeArchive(run.episode_id, stepId, version, gen);
    base.artifacts = arch.artifacts;
    base.archive_path = arch.archive_path;
    base.prompt_path = `${arch.archive_path}prompt.md`;
    base.meta_path = `${arch.archive_path}meta.md`;
  }
  const prevCur = sv.versions.find((x) => x.version === sv.current_version);
  if (prevCur && prevCur.status === "awaiting_review") prevCur.status = "superseded";
  sv.versions.push(base);
  sv.current_version = version;
  sv.status = base.status;
  sv.fail_count = fail ? (sv.fail_count || 0) + 1 : 0;
  // 失败超阈值 → 暂停 escalation
  if (sv.fail_count >= FAIL_THRESHOLD) {
    sv.status = "paused";
    run.status = "paused";
  }
  queue.unshift({ job_id: nextId("job"), episode_id: run.episode_id, step: stepId, version,
    status: sv.status, model: gen.model, seed: gen.seed, duration_ms: dur_ms,
    failure: base.failure, at: now() });
  if (queue.length > 50) queue.pop();
  ep.updated_at = now();
  return base;
}

// ---- 对外 API（供 server.mjs 调用）----
export function listEpisodes() {
  return [...episodes.values()].map(({ runs, ...e }) => e);
}
export function getEpisode(id) {
  const e = episodes.get(id); if (!e) return null;
  const { runs, ...rest } = e;
  return { ...rest, runs: [...runs.values()].map((r) => ({ run_id: r.run_id, status: r.status, current_step: r.current_step })) };
}
export function createEpisode({ episode_id, title }) {
  const id = episode_id || nextId("EP");
  if (episodes.has(id)) throw { status: 409, message: "episode exists" };
  const ep = { episode_id: id, title: title || `Episode ${id}`, status: "draft", current_step: "01", created_at: now(), updated_at: now(), runs: new Map() };
  episodes.set(id, ep);
  return getEpisode(id);
}

export async function startRun(episodeId, { inputs } = {}) {
  const ep = episodes.get(episodeId);
  if (!ep) throw { status: 404, message: "episode not found" };
  const runId = nextId("run");
  /** @type {Run} */
  const run = { run_id: runId, episode_id: episodeId, status: "paused_at_checkpoint",
    current_step: ep.current_step || "01", created_at: now(),
    steps: Object.fromEntries(STEPS.map((s) => [s.id, { status: "pending", versions: [], current_version: null, fail_count: 0 }])) };
  runs.set(runId, run); ep.runs.set(runId, run); ep.status = "in_progress";
  // 跑当前步到 awaiting_review
  await runStep(run, run.current_step, inputs || {});
  run.status = (run.steps[run.current_step].status === "paused") ? "paused" : "paused_at_checkpoint";
  ep.updated_at = now();
  return run;
}
export function getRun(runId) {
  const r = runs.get(runId); if (!r) return null;
  return r;
}
export function getStepCurrent(episodeId, stepId) {
  const r = activeRun(episodeId); if (!r) return null;
  const sv = r.steps[stepId]; if (!sv) return null;
  return sv.current_version ? { ...versionView(sv, sv.current_version), run_status: r.status } : null;
}
export function listStepVersions(episodeId, stepId) {
  const r = activeRun(episodeId); if (!r) return [];
  const sv = r.steps[stepId]; if (!sv) return [];
  return sv.versions.map((v) => versionView(sv, v.version));
}
export function getStepVersion(episodeId, stepId, version) {
  const r = activeRun(episodeId); if (!r) return null;
  const v = r.steps[stepId]?.versions.find((x) => x.version === version);
  return v ? versionView(sv(r, stepId), version) : null;
}
function sv(r, stepId) { return r.steps[stepId]; }
function activeRun(episodeId) {
  const ep = episodes.get(episodeId); if (!ep) return null;
  const arr = [...ep.runs.values()];
  return arr[arr.length - 1] || null;
}
function versionView(svObj, version) {
  const v = svObj.versions.find((x) => x.version === version);
  if (!v) return null;
  return { ...v };
}

/**
 * 提交 decision（唯一推进流水线的入口）。语义=总控定稿（见 BACKEND-API-CONTRACT §2.3）。
 * approve→推进下一步；revise→带 note 重跑当前步；regenerate→换参重跑当前步；rollback→回上一步。
 */
export async function submitDecision(episodeId, stepId, decision) {
  const ep = episodes.get(episodeId); if (!ep) throw { status: 404, message: "episode not found" };
  const r = activeRun(episodeId); if (!r) throw { status: 404, message: "no active run" };
  const svObj = r.steps[stepId]; if (!svObj) throw { status: 404, message: "step not found" };
  if (svObj.status !== "awaiting_review") throw { status: 409, message: `step not awaiting_review (now ${svObj.status})` };
  const cur = svObj.versions.find((x) => x.version === svObj.current_version);
  const rec = { action: decision.action, note: decision.note || null,
    params_override: decision.params_override || null, operator: decision.operator || "maozh2", at: now() };
  cur.decision_history.push(rec);

  if (decision.action === "approve") {
    cur.status = "approved"; cur.is_latest = true;
    // 旧 latest 取消
    for (const x of svObj.versions) if (x !== cur) x.is_latest = false;
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx >= STEPS.length - 1) { r.status = "done"; ep.status = "done"; }
    else {
      const nextId_ = STEPS[idx + 1].id;
      r.current_step = nextId_; ep.current_step = nextId_;
      await runStep(r, nextId_, {});
      r.status = (r.steps[nextId_].status === "paused") ? "paused" : "paused_at_checkpoint";
    }
  } else if (decision.action === "revise" || decision.action === "regenerate") {
    // 重跑当前步（revise 带 note；regenerate 纯换参）
    await runStep(r, stepId, { note: decision.note, params_override: decision.params_override, seed: decision.params_override?.seed });
    r.status = (r.steps[stepId].status === "paused") ? "paused" : "paused_at_checkpoint";
  } else if (decision.action === "rollback") {
    cur.status = "superseded";
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx > 0) {
      const prev = STEPS[idx - 1].id;
      r.current_step = prev; ep.current_step = prev;
      r.steps[prev].status = "awaiting_review"; // 回到上一步重做（重新评审）
    }
    r.status = "paused_at_checkpoint";
  } else {
    throw { status: 400, message: `unknown action: ${decision.action}` };
  }
  ep.updated_at = now();
  return { run_id: r.run_id, status: r.status, current_step: r.current_step,
    current_version: r.steps[r.current_step]?.current_version };
}

export async function health() {
  // 铁律：不伪造「已连接平台」。各入口如实探活 / unconfigured。
  const [comfy, video_models, tts, local_compose] = await Promise.all([
    comfyui.health(),
    video.health(),
    elevenlabs.health(),
    compose.health(),
  ]);
  const statuses = [comfy.status, video_models.status, tts.status, local_compose.status];
  const overall = statuses.every((s) => s === "ok")
    ? "ok"
    : statuses.some((s) => s === "ok" || s === "degraded")
      ? "degraded"
      : "degraded";
  return {
    comfyui: comfy,
    video_models,
    elevenlabs: tts,
    local_compose,
    overall,
    step_slots: STEP_PLATFORM_SLOTS,
  };
}
export function getPlatformMap() { return platformMap(); }
export function queueView() { return queue.slice(0, 20); }
export async function artifact(relPath) { return readArtifact(relPath); }

/** 列出某集某步磁盘归档（含 outputs/），供接手 agent / FE 发现产物 */
export async function listArchiveTree(episodeId, stepId) {
  const stepDir = STEP_DIR[stepId];
  if (!stepDir) throw { status: 400, message: "unknown step" };
  const root = path.join(ASSETS_DIR, episodeId, stepDir);
  const out = { episode_id: episodeId, step: stepId, root: `${episodeId}/${stepDir}/`, versions: [] };
  let entries = [];
  try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ent.name === "latest") continue; // pointer dir, not a version archive
    const verPath = path.join(root, ent.name);
    const files = await walkRelFiles(verPath, `${episodeId}/${stepDir}/${ent.name}`);
    out.versions.push({
      version: ent.name,
      archive_path: `${episodeId}/${stepDir}/${ent.name}/`,
      files: files.map((rel) => ({
        path: rel,
        url: `/api/v1/artifacts?path=${encodeURIComponent(rel)}`,
      })),
    });
  }
  return out;
}

async function walkRelFiles(absDir, relPrefix) {
  const acc = [];
  async function walk(dir, rel) {
    let ents = [];
    try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const a = path.join(dir, e.name);
      const r = `${rel}/${e.name}`.replace(/\\/g, "/");
      if (e.isDirectory()) await walk(a, r);
      else acc.push(r);
    }
  }
  await walk(absDir, relPrefix);
  return acc;
}

export const META = { STEPS, STEP_DIR, ASSETS_DIR, FAIL_THRESHOLD, STEP_PLATFORM_SLOTS };
