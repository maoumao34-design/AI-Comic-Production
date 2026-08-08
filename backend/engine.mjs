// engine.mjs — 可视化产品后端：7 步状态机 + 版本归档 + ComfyUI 真实出图（03/04）
// 零依赖（纯 Node ESM）。实现 BACKEND-API-CONTRACT v0.2 的核心闭环。
// 03/04：revise/regenerate → comfy-generate；首次进入可 prompt_only（展示已有 Prompt 包）。
// 视频模型 / ElevenLabs / 合成：入口已保留；未配置时如实 unconfigured，不伪造已连接。
// 归档默认对齐仓库根 assets/（与接手 agent / ep01-cli 同源），可用 ASSETS_DIR 覆盖。
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as comfyui from "./platforms/comfyui.mjs";
import * as comfyGen from "./platforms/comfy-generate.mjs";
import * as video from "./platforms/video.mjs";
import * as elevenlabs from "./platforms/elevenlabs.mjs";
import * as compose from "./platforms/compose.mjs";
import * as seriesConsistency from "./platforms/series-consistency.mjs";
import * as workspace from "./platforms/workspace-store.mjs";
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
/** 用过的系列 ID（写入 index.json） */
const knownSeries = new Set();

/** 把一集 + 当前 run 落到 assets/<ep>/episode.json 与 assets/index.json */
async function persistEpisodeState(episodeId) {
  const ep = episodes.get(episodeId);
  if (!ep) return;
  if (ep.series_id) knownSeries.add(ep.series_id);
  const run = activeRun(episodeId);
  try {
    await workspace.saveEpisodeDoc(ASSETS_DIR, ep, run);
    await workspace.saveIndex(ASSETS_DIR, {
      episodes: [...episodes.keys()],
      series_ids: [
        ...knownSeries,
        ...[...episodes.values()].map((e) => e.series_id).filter(Boolean),
      ],
    });
  } catch (e) {
    console.warn(`[engine] persist ${episodeId} failed:`, e?.message || e);
  }
}

function applySavedStepOverlay(st, saved) {
  if (!st || !saved) return;
  for (const sv of saved.versions || []) {
    if (!sv?.version) continue;
    let v = st.versions.find((x) => x.version === sv.version);
    if (!v) {
      st.versions.push({
        ...sv,
        decision_history: Array.isArray(sv.decision_history) ? [...sv.decision_history] : [],
        artifacts: Array.isArray(sv.artifacts) ? [...sv.artifacts] : [],
        refs: Array.isArray(sv.refs) ? [...sv.refs] : [],
      });
    } else {
      if (sv.status) v.status = sv.status;
      if (sv.is_latest != null) v.is_latest = !!sv.is_latest;
      if (sv.model != null) v.model = sv.model;
      if (sv.seed != null) v.seed = sv.seed;
      if (sv.params) v.params = sv.params;
      if (sv.failure !== undefined) v.failure = sv.failure;
      if (sv.content != null && (v.content == null || v.content === undefined)) v.content = sv.content;
      if (Array.isArray(sv.decision_history) && sv.decision_history.length) {
        v.decision_history = [...sv.decision_history];
      }
      if ((!v.artifacts || !v.artifacts.length) && sv.artifacts?.length) {
        v.artifacts = [...sv.artifacts];
      }
      if (sv.archive_path) v.archive_path = sv.archive_path;
      if (sv.created_at) v.created_at = sv.created_at;
    }
  }
  dedupeStepVersions(st);
  if (saved.current_version && st.versions.some((x) => x.version === saved.current_version)) {
    st.current_version = saved.current_version;
  }
  if (saved.status) st.status = saved.status;
  if (saved.fail_count != null) st.fail_count = saved.fail_count;
}

async function restoreEpisodeFromDoc(doc) {
  const meta = doc.episode;
  if (!meta?.episode_id) return null;
  const id = meta.episode_id;
  if (episodes.has(id)) return getEpisode(id);

  const ep = {
    episode_id: id,
    title: meta.title || id,
    series_id: meta.series_id || seriesConsistency.seriesIdFor(id),
    status: meta.status || "draft",
    current_step: meta.current_step || "01",
    created_at: meta.created_at || now(),
    updated_at: meta.updated_at || now(),
    runs: new Map(),
  };
  if (ep.series_id) knownSeries.add(ep.series_id);
  episodes.set(id, ep);

  const runDoc = doc.active_run;
  if (runDoc) {
    const run = {
      run_id: runDoc.run_id || nextId("run"),
      episode_id: id,
      status: runDoc.status || "paused_at_checkpoint",
      current_step: runDoc.current_step || ep.current_step || "01",
      created_at: runDoc.created_at || now(),
      steps: Object.fromEntries(
        STEPS.map((s) => [s.id, { status: "pending", versions: [], current_version: null, fail_count: 0 }]),
      ),
    };
    for (const s of STEPS) {
      const saved = runDoc.steps?.[s.id];
      if (!saved) continue;
      const st = run.steps[s.id];
      st.status = saved.status || "pending";
      st.current_version = saved.current_version || null;
      st.fail_count = saved.fail_count || 0;
      st.versions = (saved.versions || []).map((v) => ({
        ...v,
        decision_history: Array.isArray(v.decision_history) ? [...v.decision_history] : [],
        artifacts: Array.isArray(v.artifacts) ? [...v.artifacts] : [],
        refs: Array.isArray(v.refs) ? [...v.refs] : [],
      }));
    }
    runs.set(run.run_id, run);
    ep.runs.set(run.run_id, run);

    // 用磁盘归档补齐缺图/缺版，再叠回保存的指针与决策
    for (const s of STEPS) {
      const st = run.steps[s.id];
      const saved = runDoc.steps?.[s.id];
      if (s.id === "01" || s.id === "02") {
        if (!st.versions.length) await importDiskStepAsApproved(run, id, s.id);
        else {
          for (const v of st.versions) {
            const empty =
              !v.content ||
              (s.id === "02" && (!Array.isArray(v.content?.shots) || !v.content.shots.length)) ||
              (s.id === "01" && !v.content?.title && !Array.isArray(v.content?.beats) && !v.content?.text);
            if (empty) {
              const disk = await loadDiskTextStep(id, s.id, v.version || "v1");
              if (disk) {
                v.content = disk.content;
                v.model = v.model || disk.model;
                v.params = v.params || disk.params;
                if (!v.artifacts?.length && disk.artifacts_extra) {
                  v.artifacts = disk.artifacts_extra.map((a) => ({
                    type: a.type, label: a.label, url: a.url, meta: a.meta || {},
                  }));
                }
              }
            }
          }
        }
      } else if (s.id === "03" || s.id === "04") {
        await attachStepFromDisk(run, id, s.id, { asApproved: st.status === "approved" });
      }
      applySavedStepOverlay(st, saved);
    }
    ep.current_step = run.current_step;
  }
  return getEpisode(id);
}

async function stepDirHasPng(episodeId, stepId) {
  const root = path.join(ASSETS_DIR, episodeId, STEP_DIR[stepId]);
  async function walk(dir) {
    let ents = [];
    try { ents = await fs.readdir(dir, { withFileTypes: true }); } catch { return false; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (await walk(p)) return true;
      } else if (/^output\.(png|jpg|jpeg|webp)$/i.test(e.name)) return true;
    }
    return false;
  }
  return walk(root);
}

/** 无 episode.json 的旧资产目录 → 推断一集并挂盘（不 demote 系列） */
async function migrateEpisodeFromAssets(episodeId) {
  if (episodes.has(episodeId)) return getEpisode(episodeId);
  const title = episodeId === "EP-01" ? "EP-01 · The Heiress（本地 GPU）" : episodeId;
  createEpisode({
    episode_id: episodeId,
    title,
    series_id: process.env.SERIES_ID || seriesConsistency.seriesIdFor(episodeId),
  });
  const ep = episodes.get(episodeId);
  const runId = nextId("run");
  // 推断当前步：01/02 有 archive 即可；03/04 必须有出图，避免空 prompt 包把进度推过真实工作步
  let guessStep = "01";
  for (const s of STEPS) {
    const root = path.join(ASSETS_DIR, episodeId, STEP_DIR[s.id]);
    let names = [];
    try {
      names = (await fs.readdir(root)).filter((v) => /^v\d+$/i.test(v));
    } catch { continue; }
    if (!names.length) continue;
    if (s.id === "03" || s.id === "04") {
      if (await stepDirHasPng(episodeId, s.id)) guessStep = s.id;
    } else {
      guessStep = s.id;
    }
  }
  const run = {
    run_id: runId,
    episode_id: episodeId,
    status: "paused_at_checkpoint",
    current_step: guessStep,
    created_at: now(),
    steps: Object.fromEntries(
      STEPS.map((s) => [s.id, { status: "pending", versions: [], current_version: null, fail_count: 0 }]),
    ),
  };
  runs.set(runId, run);
  ep.runs.set(runId, run);
  ep.current_step = guessStep;
  ep.status = "in_progress";

  for (const s of STEPS) {
    const idx = STEPS.findIndex((x) => x.id === s.id);
    const curIdx = STEPS.findIndex((x) => x.id === guessStep);
    if (idx < curIdx) await importDiskStepAsApproved(run, episodeId, s.id);
    else if (idx === curIdx) {
      if (s.id === "01" || s.id === "02") await importDiskStepAsApproved(run, episodeId, s.id);
      else await attachStepFromDisk(run, episodeId, s.id, { asApproved: false });
      const st = run.steps[s.id];
      if (st.versions.length && st.status === "approved") {
        const cur = st.versions.find((v) => v.version === st.current_version) || st.versions[st.versions.length - 1];
        if (cur) cur.status = "awaiting_review";
        st.status = "awaiting_review";
      }
    }
  }
  await persistEpisodeState(episodeId);
  console.log(`[engine] migrated ${episodeId} from assets/ at step ${guessStep}`);
  return getEpisode(episodeId);
}

/**
 * 启动时加载工作区：index + 各集 episode.json + 扫描 assets/。
 * 重启后保留集列表、当前步、审阅指针、决策与系列。
 */
export async function loadWorkspace() {
  const idx = await workspace.loadIndex(ASSETS_DIR);
  for (const s of idx.series_ids || []) knownSeries.add(s);

  const dirs = await workspace.scanEpisodeDirs(ASSETS_DIR);
  const ids = [...new Set([...(idx.episodes || []), ...dirs])];
  let loaded = 0;
  for (const id of ids) {
    try {
      const doc = await workspace.loadEpisodeDoc(ASSETS_DIR, id);
      if (doc?.episode) {
        await restoreEpisodeFromDoc(doc);
        loaded++;
      } else {
        await migrateEpisodeFromAssets(id);
        loaded++;
      }
    } catch (e) {
      console.warn(`[engine] load episode ${id} failed:`, e?.message || e);
    }
  }

  // 兼容：仅有 BOOTSTRAP 且尚无 EP-01 时，仍可预载（随后立刻持久化）
  if (process.env.BOOTSTRAP_EP01 !== "0" && !episodes.has("EP-01")) {
    try {
      await fs.access(path.join(ASSETS_DIR, "EP-01"));
      await bootstrapLocalEpisode("EP-01");
      loaded++;
    } catch {
      /* no EP-01 assets */
    }
  }

  await workspace.saveIndex(ASSETS_DIR, {
    episodes: [...episodes.keys()],
    series_ids: [
      ...knownSeries,
      ...[...episodes.values()].map((e) => e.series_id).filter(Boolean),
    ],
  });
  console.log(`[engine] workspace loaded: ${episodes.size} episode(s) (restored/migrated ${loaded})`);
  return { episodes: listEpisodes(), series_ids: await listSeriesIds() };
}

function nextId(prefix) {
  return prefix + "_" + crypto.randomBytes(6).toString("hex");
}
function now() { return new Date().toISOString(); }
function versionNum(name) {
  const m = String(name || "").match(/^v(\d+)$/i);
  return m ? Number(m[1]) : 0;
}
/** 下一版号：取内存 + 磁盘已有 vN 的最大值 + 1（不能用数组长度——磁盘回载的 v3 再生成会撞成第二个 v3） */
async function nextVersion(episodeId, stepId, arr) {
  let max = 0;
  for (const x of arr || []) max = Math.max(max, versionNum(x.version));
  const root = path.join(ASSETS_DIR, episodeId, STEP_DIR[stepId] || "");
  try {
    for (const name of await fs.readdir(root)) max = Math.max(max, versionNum(name));
  } catch { /* no archive yet */ }
  return "v" + (max + 1);
}
/** 同名 vN 只保留一份（多图优先，其次较新） */
function dedupeStepVersions(step) {
  if (!step?.versions?.length) return;
  const score = (v) => {
    const imgs = (v.artifacts || []).filter((a) => a.type === "image").length;
    const t = Date.parse(v.created_at || "") || 0;
    return imgs * 1e15 + t;
  };
  const by = new Map();
  for (const v of step.versions) {
    const prev = by.get(v.version);
    if (!prev || score(v) >= score(prev)) by.set(v.version, v);
  }
  step.versions = [...by.values()].sort((a, b) => versionNum(a.version) - versionNum(b.version));
  if (step.current_version && !by.has(step.current_version)) {
    const last = step.versions[step.versions.length - 1];
    step.current_version = last?.version || null;
  }
}

// ---- 归档 ----
async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }
async function writeArchive(episodeId, stepId, version, { prompt, params, meta, outputs, artifacts_extra }) {
  const dir = path.join(ASSETS_DIR, episodeId, STEP_DIR[stepId], version);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, "prompt.md"), prompt || "");
  await fs.writeFile(path.join(dir, "params.json"), JSON.stringify(params || {}, null, 2));
  await fs.writeFile(path.join(dir, "meta.md"), meta || "");
  const refsDir = path.join(dir, "refs"); await ensureDir(refsDir);
  const artifacts = [];
  for (const o of outputs || []) {
    if (o.already_on_disk) continue;
    const fname = o.filename || `output.${o.ext || "txt"}`;
    const abs = path.join(dir, fname);
    await ensureDir(path.dirname(abs));
    await fs.writeFile(abs, o.content ?? "");
    artifacts.push({
      type: o.type || "text",
      label: o.label || fname,
      url: `/api/v1/artifacts?path=${encodeURIComponent(`${episodeId}/${STEP_DIR[stepId]}/${version}/${fname}`)}`,
      meta: o.meta || {},
    });
  }
  for (const a of artifacts_extra || []) {
    artifacts.push({
      type: a.type || "image",
      label: a.label,
      url: a.url,
      meta: a.meta || {},
    });
  }
  // latest 指针（README 形式，跨平台）
  const latestDir = path.join(ASSETS_DIR, episodeId, STEP_DIR[stepId], "latest");
  await ensureDir(latestDir);
  await fs.writeFile(path.join(latestDir, "README.md"), `# latest\n\n→ ${version}\n\napproved at ${now()}\n`);
  // archive_path 带 assets/ 前缀，对齐契约与 Pages/mock；artifacts?path= 仍用 ASSETS_DIR 相对路径（无前缀）
  return { archive_path: `assets/${episodeId}/${STEP_DIR[stepId]}/${version}/`, artifacts };
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

/** 是否应走 Comfy 真实出图（🔄/✏️）；approve 推进下一步默认先 prompt_only，避免长阻塞 */
function wantComfyGenerate(stepId, inputs = {}) {
  if (stepId !== "03" && stepId !== "04") return false;
  if (inputs.force_placeholder) return false;
  if (inputs.prompt_only) return false;
  if (inputs.generate === true) return true;
  if (inputs.note != null || inputs.params_override != null || inputs.seed != null) return true;
  return process.env.COMFYUI_AUTO_GENERATE === "1";
}

/** 从磁盘装入 01/02 已定稿内容（回退/重生时禁止用空占位覆盖） */
async function loadDiskTextStep(episodeId, stepId, preferredVer = "v1") {
  if (stepId !== "01" && stepId !== "02") return null;
  const stepDir = STEP_DIR[stepId];
  const base = path.join(ASSETS_DIR, episodeId, stepDir);
  for (const ver of [preferredVer, "v1"]) {
    const dir = path.join(base, ver);
    try {
      let prompt = `# step ${stepId}\n`;
      try { prompt = await fs.readFile(path.join(dir, "prompt.md"), "utf8"); } catch { /* */ }
      let params = {};
      try { params = JSON.parse(await fs.readFile(path.join(dir, "params.json"), "utf8")); } catch { /* */ }
      let content = null;
      try {
        const out = JSON.parse(await fs.readFile(path.join(dir, "output.json"), "utf8"));
        content = out.content || out;
      } catch {
        try {
          content = { text: await fs.readFile(path.join(dir, "output.md"), "utf8") };
        } catch { content = null; }
      }
      if (!content) continue;
      // 拒绝占位壳：02 必须有 shots[]
      if (stepId === "02" && !Array.isArray(content.shots)) continue;
      const modelLabel = typeof params.model === "string"
        ? params.model
        : (params.model?.name || "disk-import");
      return {
        prompt,
        params: { ...params, source: `disk:${episodeId}/${stepDir}/${ver}`, mode: "disk_reload" },
        meta: `# reloaded from disk ${stepDir}/${ver}\n\n- at: ${now()}\n`,
        outputs: [{
          filename: "output.json",
          type: "json",
          label: `${stepDir}（磁盘定稿）`,
          content: JSON.stringify({ episode_id: episodeId, step: stepId, content, params }, null, 2),
        }],
        artifacts_extra: [{
          type: "text",
          label: `${stepDir}/${ver}`,
          url: `/api/v1/artifacts?path=${encodeURIComponent(`${episodeId}/${stepDir}/${ver}/output.md`)}`,
          meta: { from_disk: true },
          already_on_disk: true,
        }],
        model: modelLabel,
        seed: typeof params.seed === "number" ? params.seed : 0,
        content,
        platform: null,
        platform_slot: null,
        disk_version: ver,
      };
    } catch { /* try next */ }
  }
  return null;
}

async function buildStepGen(episodeId, stepId, version, inputs = {}) {
  const slot = slotForStep(stepId);
  if (wantComfyGenerate(stepId, inputs)) {
    try {
      const gen = await comfyGen.generateStepImages(episodeId, stepId, version, inputs);
      gen.platform_slot = slot;
      return { gen, fail: null };
    } catch (e) {
      console.error(`[engine] comfy generate failed step=${stepId}:`, e.message || e);
      return {
        gen: null,
        fail: {
          code: e.code || "comfy_generate_failed",
          reason: e.message || String(e),
          retryable: true,
          detail: e.failures || e.health || null,
        },
      };
    }
  }
  if (stepId === "03" || stepId === "04") {
    const pack = await comfyGen.loadPromptOnlyVersion(episodeId, stepId, version, inputs);
    if (pack) {
      pack.platform_slot = slot;
      return { gen: pack, fail: null };
    }
  }
  // 01/02：优先磁盘定稿，绝不在有档案时用空占位冒充
  if (stepId === "01" || stepId === "02") {
    const disk = await loadDiskTextStep(episodeId, stepId, "v1");
    if (disk) {
      disk.platform_slot = slot;
      if (inputs.note) disk.prompt = `${disk.prompt}\n\n## 用户修改意见\n${inputs.note}`;
      return { gen: disk, fail: null };
    }
  }
  // 05–07 或无 pack：占位（诚实标明）
  return { gen: placeholderGen(episodeId, stepId, inputs), fail: null };
}

// ---- 状态机 ----
/** 跑一步：生成产物、归档、置为 awaiting_review。返回新版本对象。 */
async function runStep(run, stepId, inputs = {}) {
  const ep = episodes.get(run.episode_id);
  const sv = run.steps[stepId];
  dedupeStepVersions(sv);
  const version = await nextVersion(run.episode_id, stepId, sv.versions);
  const t0 = Date.now();
  const withSeries = {
    ...inputs,
    series_id: inputs.series_id || ep?.series_id || seriesConsistency.seriesIdFor(run.episode_id, ep),
  };
  const forcedFail = withSeries.force_fail === true || (withSeries.fail_rate && Math.random() < withSeries.fail_rate);
  let { gen, fail } = forcedFail
    ? { gen: placeholderGen(run.episode_id, stepId, withSeries), fail: { code: "placeholder_forced_fail", reason: "MVP 占位：模拟失败以演示重试/暂停", retryable: true } }
    : await buildStepGen(run.episode_id, stepId, version, withSeries);
  if (!gen && fail) {
    gen = placeholderGen(run.episode_id, stepId, { ...inputs, note: `出图失败：${fail.reason}` });
  }
  const dur_ms = Date.now() - t0;
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
    failure: fail,
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
  await persistEpisodeState(run.episode_id);
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
export function createEpisode({ episode_id, title, series_id } = {}) {
  const id = episode_id || nextId("EP");
  if (episodes.has(id)) throw { status: 409, message: "episode exists" };
  const ep = {
    episode_id: id,
    title: title || `Episode ${id}`,
    series_id: series_id || seriesConsistency.seriesIdFor(id),
    status: "draft",
    current_step: "01",
    created_at: now(),
    updated_at: now(),
    runs: new Map(),
  };
  if (ep.series_id) knownSeries.add(ep.series_id);
  episodes.set(id, ep);
  void persistEpisodeState(id);
  return getEpisode(id);
}

/**
 * 从磁盘把某步定稿灌进 run（浏览历史 / 新 run 补齐先验步骤）。
 * 已有 versions 则跳过。01/02 优先完整 JSON；其它步有 archive 也尽量挂上。
 */
async function importDiskStepAsApproved(run, episodeId, stepId) {
  const step = run.steps[stepId];
  if (!step || (step.versions && step.versions.length > 0)) return false;

  if (stepId === "01" || stepId === "02") {
    const disk = await loadDiskTextStep(episodeId, stepId, "v1");
    if (!disk) return false;
    const verName = disk.disk_version || "v1";
    const ver = {
      episode_id: episodeId, step: stepId, version: verName, is_latest: true,
      status: "approved",
      model: disk.model,
      seed: disk.seed,
      params: disk.params,
      platform: null,
      platform_slot: slotForStep(stepId),
      artifacts: (disk.artifacts_extra || []).map((a) => ({
        type: a.type, label: a.label, url: a.url, meta: a.meta || {},
      })),
      refs: [],
      archive_path: `assets/${episodeId}/${STEP_DIR[stepId]}/${verName}/`,
      prompt_path: `assets/${episodeId}/${STEP_DIR[stepId]}/${verName}/prompt.md`,
      meta_path: `assets/${episodeId}/${STEP_DIR[stepId]}/${verName}/meta.md`,
      content: disk.content,
      created_at: now(),
      duration_ms: 0,
      failure: null,
      decision_history: [{ action: "approve", note: "hydrated from disk for browse", operator: "system", at: now() }],
    };
    step.versions.push(ver);
    step.current_version = verName;
    step.status = "approved";
    return true;
  }

  // 03+：磁盘最佳版本（含嵌套 char/*/output.png）挂到内存，不新建空档
  return attachStepFromDisk(run, episodeId, stepId, { asApproved: true });
}

/** 把磁盘上已有的 03/04… 全部 vN 挂进 run（去重；刷新后图还在；列表不会出现两个相同 v3） */
async function attachStepFromDisk(run, episodeId, stepId, { asApproved = false } = {}) {
  const step = run.steps[stepId];
  if (!step) return false;
  const root = path.join(ASSETS_DIR, episodeId, STEP_DIR[stepId]);
  let names = [];
  try {
    names = (await fs.readdir(root)).filter((v) => /^v\d+$/i.test(v))
      .sort((a, b) => versionNum(a) - versionNum(b));
  } catch {
    dedupeStepVersions(step);
    return step.versions?.length > 0;
  }
  if (!names.length) {
    dedupeStepVersions(step);
    return step.versions?.length > 0;
  }

  let bestName = null;
  let bestImgs = -1;
  for (const verName of names) {
    const prefer = (n, name) => {
      if (n > bestImgs || (n === bestImgs && versionNum(name) > versionNum(bestName))) {
        bestImgs = n; bestName = name;
      }
    };
    if (step.versions.some((x) => x.version === verName)) {
      const existing = step.versions.find((x) => x.version === verName);
      const n = (existing?.artifacts || []).filter((a) => a.type === "image").length;
      prefer(n, verName);
      continue;
    }
    const pack = await comfyGen.loadPromptOnlyVersion(episodeId, stepId, verName, {
      pack_version: verName,
    });
    if (!pack) continue;
    const imgs = (pack.artifacts_extra || []).filter((a) => a.type === "image").length;
    prefer(imgs, verName);
    const isCurrentCandidate = verName === names[names.length - 1] || imgs > 0;
    step.versions.push({
      episode_id: episodeId,
      step: stepId,
      version: verName,
      is_latest: false,
      status: "superseded",
      model: pack.model,
      seed: pack.seed,
      params: pack.params,
      platform: pack.platform,
      platform_slot: pack.platform_slot || slotForStep(stepId),
      artifacts: (pack.artifacts_extra || []).map((a) => ({
        type: a.type, label: a.label, url: a.url, meta: a.meta || {},
      })),
      refs: [],
      archive_path: `assets/${episodeId}/${STEP_DIR[stepId]}/${verName}/`,
      prompt_path: `assets/${episodeId}/${STEP_DIR[stepId]}/${verName}/prompt.md`,
      meta_path: `assets/${episodeId}/${STEP_DIR[stepId]}/${verName}/meta.md`,
      content: pack.content,
      created_at: now(),
      duration_ms: 0,
      failure: null,
      decision_history: [{
        action: asApproved ? "approve" : "regenerate",
        note: asApproved ? "hydrated from disk" : "restored disk outputs after restart",
        operator: "system",
        at: now(),
      }],
      _hydrate_rank: isCurrentCandidate ? imgs : -1,
    });
  }

  dedupeStepVersions(step);
  if (!step.versions.length) return false;

  for (const v of step.versions) delete v._hydrate_rank;

  // 已有审阅指针且仍有效：只补齐缺档，不改指针（避免 list 时覆盖「选用此版」）
  if (step.current_version && step.versions.some((x) => x.version === step.current_version)) {
    return true;
  }

  // 首次挂载：出图最多的版；并列取最新 vN
  if (!bestName) {
    bestName = [...step.versions].sort((a, b) => {
      const ia = (a.artifacts || []).filter((x) => x.type === "image").length;
      const ib = (b.artifacts || []).filter((x) => x.type === "image").length;
      return ib - ia || versionNum(b.version) - versionNum(a.version);
    })[0]?.version;
  }
  for (const v of step.versions) {
    if (v.version === bestName) {
      v.status = asApproved ? "approved" : "awaiting_review";
      if (asApproved) v.is_latest = true;
    } else if (v.status === "awaiting_review") {
      v.status = "superseded";
    }
  }
  step.current_version = bestName;
  step.status = asApproved ? "approved" : "awaiting_review";
  return true;
}

async function hydratePriorSteps(run, episodeId) {
  const curIdx = STEPS.findIndex((s) => s.id === run.current_step);
  const end = curIdx < 0 ? STEPS.length : curIdx;
  for (let i = 0; i < end; i++) {
    await importDiskStepAsApproved(run, episodeId, STEPS[i].id);
  }
}

export async function startRun(episodeId, { inputs } = {}) {
  const ep = episodes.get(episodeId);
  if (!ep) throw { status: 404, message: "episode not found" };

  // 已有暂停中的 run：复用并补齐历史步，避免「再点发起」造出缺 01/02 的空壳 run
  const existing = activeRun(episodeId);
  if (existing && (existing.status === "paused_at_checkpoint" || existing.status === "paused")) {
    await hydratePriorSteps(existing, episodeId);
    const curSv = existing.steps[existing.current_step];
    if (!curSv?.versions?.length) {
      await runStep(existing, existing.current_step, inputs || {});
      existing.status = (existing.steps[existing.current_step].status === "paused")
        ? "paused" : "paused_at_checkpoint";
    }
    ep.updated_at = now();
    await persistEpisodeState(episodeId);
    return existing;
  }

  const runId = nextId("run");
  /** @type {Run} */
  const run = { run_id: runId, episode_id: episodeId, status: "paused_at_checkpoint",
    current_step: ep.current_step || "01", created_at: now(),
    steps: Object.fromEntries(STEPS.map((s) => [s.id, { status: "pending", versions: [], current_version: null, fail_count: 0 }])) };
  runs.set(runId, run); ep.runs.set(runId, run); ep.status = "in_progress";
  await hydratePriorSteps(run, episodeId);
  // 跑当前步到 awaiting_review
  await runStep(run, run.current_step, inputs || {});
  run.status = (run.steps[run.current_step].status === "paused") ? "paused" : "paused_at_checkpoint";
  ep.updated_at = now();
  await persistEpisodeState(episodeId);
  return run;
}
export function getRun(runId) {
  const r = runs.get(runId); if (!r) return null;
  return r;
}
export async function getStepCurrent(episodeId, stepId) {
  const r = activeRun(episodeId); if (!r) return null;
  const step = r.steps[stepId]; if (!step) return null;
  if (!step.current_version || !step.versions?.length) {
    await importDiskStepAsApproved(r, episodeId, stepId);
  }
  return step.current_version
    ? { ...versionView(step, step.current_version), run_status: r.status, browsing: stepId !== r.current_step }
    : null;
}
export async function listStepVersions(episodeId, stepId) {
  const r = activeRun(episodeId); if (!r) return [];
  const step = r.steps[stepId]; if (!step) return [];
  if (!step.versions?.length) {
    await importDiskStepAsApproved(r, episodeId, stepId);
  } else if (stepId === "03" || stepId === "04") {
    // 补齐磁盘上有、内存缺的 vN，并去掉撞名重复
    await attachStepFromDisk(r, episodeId, stepId, { asApproved: step.status === "approved" });
  }
  dedupeStepVersions(step);
  return step.versions.map((v) => ({ ...v }));
}
export async function getStepVersion(episodeId, stepId, version) {
  const r = activeRun(episodeId); if (!r) return null;
  const step = r.steps[stepId]; if (!step) return null;
  if (!step.versions?.length) {
    await importDiskStepAsApproved(r, episodeId, stepId);
  }
  const v = step.versions.find((x) => x.version === version);
  return v ? versionView(step, version) : null;
}
function sv(r, stepId) { return r.steps[stepId]; }
function activeRun(episodeId) {
  const ep = episodes.get(episodeId); if (!ep) return null;
  const arr = [...ep.runs.values()];
  // 优先选「历史步更完整」的 run，避免误挂缺 01 的空壳
  if (arr.length <= 1) return arr[0] || null;
  let best = arr[arr.length - 1];
  let bestScore = -1;
  for (const r of arr) {
    let score = 0;
    for (const s of STEPS) {
      const st = r.steps[s.id];
      if (st?.versions?.length) score += 10;
      if (st?.status === "approved") score += 3;
    }
    if (r.status === "paused_at_checkpoint" || r.status === "paused") score += 1;
    if (score >= bestScore) { bestScore = score; best = r; }
  }
  return best;
}
function versionView(svObj, version) {
  const v = svObj.versions.find((x) => x.version === version);
  if (!v) return null;
  return { ...v };
}

/** 可打回态：人审中 / 已通过 / 失败（成片 done 后仍可 ↩️） */
const ROLLBACKABLE = new Set(["awaiting_review", "approved", "failed"]);

/**
 * 选用旧版（SELECT-VERSION-CONTRACT §3）：同一步内改审阅指针 current_version。
 * 不退步、不删/覆盖任何 vN、不改 is_latest / latest/。
 * 门禁 ≠ 任意态↩️：仅当前步 + awaiting_review（running/错步 → 409；缺版 → 404）。
 */
export async function selectVersion(episodeId, stepId, body = {}) {
  const ep = episodes.get(episodeId); if (!ep) throw { status: 404, message: "episode not found" };
  const r = activeRun(episodeId); if (!r) throw { status: 404, message: "no active run" };
  const svObj = r.steps[stepId]; if (!svObj) throw { status: 404, message: "step not found" };

  const targetVer = body.version;
  if (!targetVer || typeof targetVer !== "string") {
    throw { status: 400, message: "missing version", detail: "body.version required (e.g. v2)" };
  }
  if (targetVer === "latest") {
    throw { status: 404, message: "version not found", detail: "latest is a pointer dir, not a selectable version" };
  }

  // 只能改当前步审阅指针
  if (r.current_step !== stepId) {
    throw { status: 409, message: `not current step (now ${r.current_step})` };
  }

  const cur = svObj.versions.find((x) => x.version === svObj.current_version);
  const verStatus = cur?.status || svObj.status;
  if (svObj.status === "running" || verStatus === "running") {
    throw { status: 409, message: `step is running` };
  }
  if (svObj.status !== "awaiting_review" && verStatus !== "awaiting_review") {
    throw { status: 409, message: `step not awaiting_review (now ${verStatus})` };
  }

  const target = svObj.versions.find((x) => x.version === targetVer);
  if (!target) throw { status: 404, message: "version not found", detail: targetVer };

  const fromVer = svObj.current_version;
  // 同版幂等：不改状态、跳过 audit
  if (fromVer === targetVer) {
    return { run_id: r.run_id, status: r.status, current_step: r.current_step, current_version: fromVer };
  }

  // 旧审阅版 → superseded（归档保留）；目标版 → awaiting_review
  if (cur && cur.status === "awaiting_review" && cur !== target) {
    cur.status = "superseded";
  }
  target.status = "awaiting_review";
  svObj.current_version = targetVer;
  svObj.status = "awaiting_review";
  // 不改任何版 is_latest；不写 latest/；不改 current_step

  const at = now();
  const operator = body.operator || "maozh2";
  const rec = {
    action: "select_version",
    note: body.note || null,
    from: fromVer,
    to: targetVer,
    operator,
    at,
    client_request_id: body.client_request_id || null,
  };
  target.decision_history.push(rec);

  // meta.md 追加一行（磁盘归档存在时）
  if (target.archive_path) {
    const metaAbs = path.join(ASSETS_DIR, episodeId, STEP_DIR[stepId], targetVer, "meta.md");
    const line = `select_version from=${fromVer} to=${targetVer} by=${operator} at=${at}` +
      (body.note ? ` note=${JSON.stringify(body.note)}` : "") + "\n";
    try {
      await fs.appendFile(metaAbs, line);
    } catch {
      // 缺档不阻断指针切换（内存态已生效）
    }
  }

  ep.updated_at = at;
  await persistEpisodeState(episodeId);
  return { run_id: r.run_id, status: r.status, current_step: r.current_step, current_version: targetVer };
}

/**
 * 提交 decision（唯一推进流水线的入口）。语义=总控定稿（见 BACKEND-API-CONTRACT §2.3）。
 * approve→推进下一步；revise→带 note 重跑当前步；regenerate→换参重跑当前步；rollback→回上一步。
 * rollback 例外：approved/failed/done 仍可打回（maozh2 2026-08-05）；✅✏️🔄 仍仅 awaiting_review。
 */
export async function submitDecision(episodeId, stepId, decision) {
  const ep = episodes.get(episodeId); if (!ep) throw { status: 404, message: "episode not found" };
  const r = activeRun(episodeId); if (!r) throw { status: 404, message: "no active run" };
  const svObj = r.steps[stepId]; if (!svObj) throw { status: 404, message: "step not found" };
  const cur = svObj.versions.find((x) => x.version === svObj.current_version);
  if (!cur) throw { status: 404, message: "no current version" };

  const action = decision.action;
  const verStatus = cur.status;
  if (action === "rollback") {
    if (!ROLLBACKABLE.has(verStatus) && !ROLLBACKABLE.has(svObj.status)) {
      throw { status: 409, message: `step not rollbackable (now ${verStatus})` };
    }
  } else if (action === "approve" || action === "revise" || action === "regenerate") {
    if (svObj.status !== "awaiting_review" && verStatus !== "awaiting_review") {
      throw { status: 409, message: `step not awaiting_review (now ${verStatus})` };
    }
  } else {
    throw { status: 400, message: `unknown action: ${action}` };
  }

  const rec = { action, note: decision.note || null,
    params_override: decision.params_override || null, operator: decision.operator || "maozh2", at: now() };
  cur.decision_history.push(rec);

  if (action === "approve") {
    cur.status = "approved"; cur.is_latest = true;
    svObj.status = "approved";
    // 旧 latest 取消
    for (const x of svObj.versions) if (x !== cur) x.is_latest = false;

    // 03 ✅ 且确有出图 → 写入系列历史参考（先清本集旧贡献再晋升，避免半成品残留）
    if (stepId === "03") {
      try {
        await seriesConsistency.demoteEpisodeContributions(episodeId, { seriesId: ep.series_id });
        const promo = await seriesConsistency.promoteApprovedAssets(episodeId, cur, {
          seriesId: ep.series_id,
        });
        cur.params = {
          ...(cur.params || {}),
          series_promoted: !promo.skipped,
          series_id: promo.series_id,
          series_promoted_count: promo.promoted?.length || 0,
          series_promote_skip_reason: promo.skipped ? promo.reason : null,
        };
        console.log(
          `[engine] series promote ${promo.series_id}: ` +
            (promo.skipped ? promo.reason : `${promo.promoted.length} subjects locked`),
        );
      } catch (e) {
        console.warn("[engine] series promote failed:", e?.message || e);
      }
    }

    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx >= STEPS.length - 1) { r.status = "done"; ep.status = "done"; }
    else {
      const nextId_ = STEPS[idx + 1].id;
      r.current_step = nextId_; ep.current_step = nextId_;
      const nextSv = r.steps[nextId_];
      // 01→02：若下一步已有磁盘/内存定稿，禁止再写空占位（否则回退后 ✅ 会「记录没了」）
      const reuse =
        (nextId_ === "01" || nextId_ === "02")
          ? (
              nextSv.versions.find((x) => x.is_latest) ||
              [...nextSv.versions].reverse().find((x) => {
                if (nextId_ === "02") return Array.isArray(x.content?.shots) && x.content.shots.length > 1;
                return Array.isArray(x.content?.beats) && x.content.beats.length > 0;
              })
            )
          : null;
      if (reuse) {
        for (const x of nextSv.versions) {
          if (x !== reuse && x.status === "awaiting_review") x.status = "superseded";
        }
        reuse.status = "awaiting_review";
        // 占位版勿抢 is_latest
        if (!reuse.is_latest && !nextSv.versions.some((x) => x.is_latest)) reuse.is_latest = true;
        nextSv.current_version = reuse.version;
        nextSv.status = "awaiting_review";
        r.status = "paused_at_checkpoint";
      } else {
        // 进入 03：先把系列锁定资产种进本集 refs/，供审阅与出图引用
        if (nextId_ === "03") {
          try {
            await seriesConsistency.seedEpisodeSeriesRefs(episodeId, ep.series_id);
          } catch (e) {
            console.warn("[engine] seed series refs failed:", e?.message || e);
          }
        }
        // 推进到 03/04 时先落 Prompt 包，避免 approve 卡住数十分钟；出图用 🔄
        // 01/02 无内存定稿时 buildStepGen 会从磁盘重载
        await runStep(r, nextId_, (nextId_ === "03" || nextId_ === "04") ? { prompt_only: true } : {});
        r.status = (r.steps[nextId_].status === "paused") ? "paused" : "paused_at_checkpoint";
      }
    }
  } else if (action === "revise" || action === "regenerate") {
    // 03 改脸：先撤出本集系列贡献，再出图（历史参考不得挡住修改）
    if (stepId === "03") {
      try {
        const dem = await seriesConsistency.demoteEpisodeContributions(episodeId, {
          seriesId: ep.series_id,
        });
        seriesConsistency.clearLockedStamps(cur);
        console.log(`[engine] series demote before ${action}: removed=${dem.removed.length}`);
      } catch (e) {
        console.warn("[engine] series demote before revise failed:", e?.message || e);
      }
    }
    // 01/02：有定稿时 🔄 只把审阅指针拨回定稿（不写空占位、不覆盖磁盘）
    if ((stepId === "01" || stepId === "02") && action === "regenerate") {
      const good =
        svObj.versions.find((x) => x.is_latest) ||
        [...svObj.versions].reverse().find((x) => {
          if (x.status === "approved") return true;
          if (stepId === "02") return Array.isArray(x.content?.shots) && x.content.shots.length > 0;
          return Array.isArray(x.content?.beats) || !!x.content?.title || !!x.content?.narration_text || !!x.content?.text;
        });
      const usable = good && (
        (stepId === "02" && Array.isArray(good.content?.shots) && good.content.shots.length > 0) ||
        (stepId === "01" && (Array.isArray(good.content?.beats) || good.content?.title || good.content?.text || good.content?.narration_text))
      );
      if (usable) {
        for (const x of svObj.versions) {
          if (x !== good && x.status === "awaiting_review") x.status = "superseded";
        }
        good.status = "awaiting_review";
        if (decision.note) {
          good.decision_history.push({
            action: "regenerate", note: decision.note, operator: decision.operator || "operator", at: now(),
          });
        }
        svObj.current_version = good.version;
        svObj.status = "awaiting_review";
        r.status = "paused_at_checkpoint";
        ep.updated_at = now();
        await persistEpisodeState(episodeId);
        return { run_id: r.run_id, status: r.status, current_step: r.current_step, current_version: good.version };
      }
    }
    // 重跑当前步；03/04 默认触发出图（generate:true）；01/02 无内存定稿时走磁盘重载
    // 03 ✏️ 默认 force_new；🔄 也可在 params_override.force_new / subject 指定改某一个
    const po = { ...(decision.params_override || {}) };
    if (stepId === "03" && action === "revise" && po.force_new == null) po.force_new = true;
    await runStep(r, stepId, {
      note: decision.note,
      params_override: po,
      seed: po.seed,
      generate: po.prompt_only ? false : true,
      prompt_only: po.prompt_only === true,
      subject: po.subject,
      ckpt: po.ckpt,
      force_new: po.force_new === true,
    });
    r.status = (r.steps[stepId].status === "paused") ? "paused" : "paused_at_checkpoint";
  } else if (action === "rollback") {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx <= 0) throw { status: 409, message: "already at first step; cannot rollback" };
    cur.status = "superseded";
    svObj.status = "superseded";
    const prev = STEPS[idx - 1].id;
    // ↩️ 离开「03 已确认」状态 → 系列历史参考跟着撤（从 03 回 02，或从 04 回 03）
    if (stepId === "03" || prev === "03") {
      try {
        const dem = await seriesConsistency.demoteEpisodeContributions(episodeId, {
          seriesId: ep.series_id,
        });
        const step03 = r.steps["03"];
        if (step03) {
          for (const v of step03.versions) {
            if (v.is_latest || v.status === "approved" || v.status === "awaiting_review") {
              seriesConsistency.clearLockedStamps(v);
            }
            if (prev === "03" && (v.is_latest || v.status === "approved")) {
              v.is_latest = false;
            }
          }
        }
        console.log(
          `[engine] series demote on rollback ${stepId}→${prev}: removed=${dem.removed.length}`,
        );
      } catch (e) {
        console.warn("[engine] series demote on rollback failed:", e?.message || e);
      }
    }
    r.current_step = prev; ep.current_step = prev;
    const prevSv = r.steps[prev];
    // 回退优先指回「已通过 / is_latest」定稿，避免停在空占位 vN 上像「记录没了」
    let preferred =
      prevSv.versions.find((x) => x.is_latest) ||
      [...prevSv.versions].reverse().find((x) => x.status === "approved") ||
      [...prevSv.versions].reverse().find((x) => {
        if (prev === "02") return Array.isArray(x.content?.shots) && x.content.shots.length > 1;
        if (prev === "01") return Array.isArray(x.content?.beats) && x.content.beats.length > 0;
        return false;
      }) ||
      prevSv.versions.find((x) => x.version === prevSv.current_version) ||
      prevSv.versions[prevSv.versions.length - 1];
    // 若内存里只剩占位，从磁盘灌回 01/02 定稿内容
    if (prev === "01" || prev === "02") {
      const looksEmpty =
        !preferred ||
        (prev === "02" && (!Array.isArray(preferred.content?.shots) || preferred.content.shots.length <= 1)) ||
        (prev === "01" && !Array.isArray(preferred.content?.beats));
      if (looksEmpty) {
        const disk = await loadDiskTextStep(r.episode_id, prev, "v1");
        if (disk) {
          const v1 = prevSv.versions.find((x) => x.version === "v1");
          if (v1) {
            v1.content = disk.content;
            v1.model = disk.model;
            v1.params = disk.params;
            v1.artifacts = disk.artifacts_extra?.map((a) => ({
              type: a.type, label: a.label, url: a.url, meta: a.meta || {},
            })) || v1.artifacts;
            preferred = v1;
          } else {
            preferred = {
              episode_id: r.episode_id, step: prev, version: "v1", is_latest: true,
              status: "awaiting_review", model: disk.model, seed: disk.seed,
              params: disk.params, platform: null, platform_slot: slotForStep(prev),
              artifacts: (disk.artifacts_extra || []).map((a) => ({
                type: a.type, label: a.label, url: a.url, meta: a.meta || {},
              })),
              refs: [], archive_path: `assets/${r.episode_id}/${STEP_DIR[prev]}/v1/`,
              prompt_path: `assets/${r.episode_id}/${STEP_DIR[prev]}/v1/prompt.md`,
              meta_path: `assets/${r.episode_id}/${STEP_DIR[prev]}/v1/meta.md`,
              content: disk.content, created_at: now(), duration_ms: 0, failure: null,
              decision_history: [{ action: "rollback", note: "restored from disk", operator: "system", at: now() }],
            };
            prevSv.versions.unshift(preferred);
          }
        }
      }
    }
    if (preferred) {
      for (const x of prevSv.versions) {
        if (x !== preferred && x.status === "awaiting_review") x.status = "superseded";
      }
      preferred.status = "awaiting_review";
      prevSv.current_version = preferred.version;
    }
    prevSv.status = "awaiting_review";
    if (r.status === "done" || ep.status === "done") ep.status = "in_progress";
    r.status = "paused_at_checkpoint";
  }
  ep.updated_at = now();
  await persistEpisodeState(episodeId);
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
  const out = { episode_id: episodeId, step: stepId, root: `assets/${episodeId}/${stepDir}/`, versions: [] };
  let entries = [];
  try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return out; }
  for (const ent of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ent.name === "latest") continue; // pointer dir, not a version archive
    const verPath = path.join(root, ent.name);
    // files[].path / artifacts?path 保持 ASSETS_DIR 相对（无 assets/），供 readArtifact 拼接
    const files = await walkRelFiles(verPath, `${episodeId}/${stepDir}/${ent.name}`);
    out.versions.push({
      version: ent.name,
      archive_path: `assets/${episodeId}/${stepDir}/${ent.name}/`,
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

/**
 * 本机启动时预载 EP-01：01/02 已通过内容 + 03 Prompt 包待出图。
 * 前端打开即可在步骤 03 点 🔄 触发出图，无需从空占位走完 01/02。
 */
export async function getSeriesPack(seriesId) {
  return seriesConsistency.listSeriesPack(seriesId || seriesConsistency.META.DEFAULT_SERIES_ID);
}

export async function getEpisodeSeriesRefs(episodeId) {
  const ep = episodes.get(episodeId);
  const sid = ep?.series_id || seriesConsistency.seriesIdFor(episodeId, ep);
  return seriesConsistency.listSeriesPack(sid);
}

export async function bootstrapLocalEpisode(episodeId = "EP-01") {
  if (episodes.has(episodeId)) return getEpisode(episodeId);
  const title = episodeId === "EP-01" ? "EP-01 · The Heiress（本地 GPU）" : episodeId;
  createEpisode({
    episode_id: episodeId,
    title,
    series_id: process.env.SERIES_ID || "heiress",
  });
  const ep = episodes.get(episodeId);
  ep.current_step = "03";
  const runId = nextId("run");
  const run = {
    run_id: runId,
    episode_id: episodeId,
    status: "paused_at_checkpoint",
    current_step: "03",
    created_at: now(),
    steps: Object.fromEntries(
      STEPS.map((s) => [s.id, { status: "pending", versions: [], current_version: null, fail_count: 0 }]),
    ),
  };
  runs.set(runId, run);
  ep.runs.set(runId, run);
  ep.status = "in_progress";

  // 01 / 02：从磁盘装入为已通过
  for (const stepId of ["01", "02"]) {
    await importDiskStepAsApproved(run, episodeId, stepId);
  }

  // 03 尚未 ✅：不得保留本集写入的系列历史参考（与回退规则一致）
  try {
    await seriesConsistency.demoteEpisodeContributions(episodeId, { seriesId: ep.series_id });
  } catch (e) {
    console.warn("[engine] bootstrap series demote:", e?.message || e);
  }

  // 03：优先挂回磁盘上已有出图（避免重启后「图没了」）；没有再落 prompt 包
  const restored = await attachStepFromDisk(run, episodeId, "03", { asApproved: false });
  if (!restored) {
    await runStep(run, "03", { prompt_only: true });
  }
  const nImg = (run.steps["03"].versions.find((v) => v.version === run.steps["03"].current_version)
    || run.steps["03"].versions[run.steps["03"].versions.length - 1]
  )?.artifacts?.filter((a) => a.type === "image").length || 0;
  ep.updated_at = now();
  await persistEpisodeState(episodeId);
  console.log(
    `[engine] bootstrapped ${episodeId} at step 03` +
      (restored ? ` (restored ${nImg} images from disk)` : " (prompt pack)") +
      ". 🔄 regenerate to generate via ComfyUI.",
  );
  return getEpisode(episodeId);
}

/** 已知系列列表（index + _series/ + 内存） */
export async function listSeriesIds() {
  const root = path.join(ASSETS_DIR, seriesConsistency.META.SERIES_ROOT_NAME);
  const fromDisk = [];
  try {
    for (const e of await fs.readdir(root, { withFileTypes: true })) {
      if (e.isDirectory()) fromDisk.push(e.name);
    }
  } catch { /* */ }
  const fromEps = [...episodes.values()].map((e) => e.series_id).filter(Boolean);
  const set = new Set([
    seriesConsistency.META.DEFAULT_SERIES_ID,
    process.env.SERIES_ID || "heiress",
    ...knownSeries,
    ...fromDisk,
    ...fromEps,
  ]);
  return [...set].sort();
}

export function setEpisodeSeries(episodeId, seriesId) {
  const ep = episodes.get(episodeId);
  if (!ep) throw { status: 404, message: "episode not found" };
  const sid = String(seriesId || "").trim();
  if (!sid) throw { status: 400, message: "series_id required" };
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(sid)) {
    throw { status: 400, message: "series_id must be alphanumeric / _ / -" };
  }
  ep.series_id = sid;
  knownSeries.add(sid);
  ep.updated_at = now();
  void persistEpisodeState(episodeId);
  return getEpisode(episodeId);
}

export const META = {
  STEPS, STEP_DIR, ASSETS_DIR, FAIL_THRESHOLD, STEP_PLATFORM_SLOTS,
  SERIES_ROOT: seriesConsistency.META.SERIES_ROOT_NAME,
  DEFAULT_SERIES_ID: seriesConsistency.META.DEFAULT_SERIES_ID,
};
