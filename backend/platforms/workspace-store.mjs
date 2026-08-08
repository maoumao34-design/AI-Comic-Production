// workspace-store.mjs — 工作区持久化（集列表 / run / 审阅指针 / 决策 / 系列）
// assets/index.json + assets/<episode_id>/episode.json
import { promises as fs } from "node:fs";
import path from "node:path";

const INDEX_NAME = "index.json";
const EPISODE_FILE = "episode.json";

function now() {
  return new Date().toISOString();
}

export function indexPath(assetsDir) {
  return path.join(assetsDir, INDEX_NAME);
}

export function episodeJsonPath(assetsDir, episodeId) {
  return path.join(assetsDir, episodeId, EPISODE_FILE);
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

export async function writeJsonAtomic(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/** 版本落盘：保留审阅/决策/元数据；content 一并存（01/02 必需） */
export function serializeVersion(v) {
  if (!v) return null;
  return {
    episode_id: v.episode_id,
    step: v.step,
    version: v.version,
    is_latest: !!v.is_latest,
    status: v.status,
    model: v.model ?? null,
    seed: v.seed ?? null,
    params: v.params ?? {},
    platform: v.platform ?? null,
    platform_slot: v.platform_slot
      ? {
          primary: v.platform_slot.primary,
          candidates: v.platform_slot.candidates,
          status: v.platform_slot.status,
          entry: v.platform_slot.entry,
        }
      : null,
    artifacts: (v.artifacts || []).map((a) => ({
      type: a.type,
      label: a.label,
      url: a.url,
      meta: a.meta || {},
    })),
    refs: v.refs || [],
    archive_path: v.archive_path || "",
    prompt_path: v.prompt_path || "",
    meta_path: v.meta_path || "",
    content: v.content ?? null,
    created_at: v.created_at || now(),
    duration_ms: v.duration_ms || 0,
    failure: v.failure ?? null,
    decision_history: Array.isArray(v.decision_history) ? v.decision_history : [],
  };
}

export function serializeRun(run) {
  if (!run) return null;
  const steps = {};
  for (const [sid, st] of Object.entries(run.steps || {})) {
    steps[sid] = {
      status: st.status || "pending",
      current_version: st.current_version || null,
      fail_count: st.fail_count || 0,
      versions: (st.versions || []).map(serializeVersion),
    };
  }
  return {
    run_id: run.run_id,
    episode_id: run.episode_id,
    status: run.status,
    current_step: run.current_step,
    created_at: run.created_at || now(),
    steps,
  };
}

export function serializeEpisode(ep, activeRun) {
  const { runs: _r, ...rest } = ep;
  return {
    schema: 1,
    saved_at: now(),
    episode: {
      episode_id: rest.episode_id,
      title: rest.title,
      series_id: rest.series_id || null,
      status: rest.status,
      current_step: rest.current_step,
      created_at: rest.created_at,
      updated_at: rest.updated_at,
    },
    active_run: serializeRun(activeRun),
  };
}

export async function loadIndex(assetsDir) {
  const idx = await readJson(indexPath(assetsDir), null);
  if (idx && Array.isArray(idx.episodes)) return idx;
  return { schema: 1, updated_at: null, episodes: [], series_ids: [] };
}

export async function saveIndex(assetsDir, { episodes, series_ids }) {
  const doc = {
    schema: 1,
    updated_at: now(),
    episodes: [...new Set(episodes)].sort(),
    series_ids: [...new Set(series_ids.filter(Boolean))].sort(),
  };
  await writeJsonAtomic(indexPath(assetsDir), doc);
  return doc;
}

export async function saveEpisodeDoc(assetsDir, ep, activeRun) {
  const doc = serializeEpisode(ep, activeRun);
  await writeJsonAtomic(episodeJsonPath(assetsDir, ep.episode_id), doc);
  return doc;
}

export async function loadEpisodeDoc(assetsDir, episodeId) {
  return readJson(episodeJsonPath(assetsDir, episodeId), null);
}

/** 扫描 assets/ 下像 EP-* 的目录（兼容无 index 的旧数据） */
export async function scanEpisodeDirs(assetsDir) {
  const out = [];
  let ents = [];
  try {
    ents = await fs.readdir(assetsDir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of ents) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith("_") || e.name.startsWith(".")) continue;
    // 约定集号：EP-01 / ep-02 / 任意含步骤子目录的文件夹
    const epRoot = path.join(assetsDir, e.name);
    const hasJson = await readJson(episodeJsonPath(assetsDir, e.name), null);
    let hasSteps = false;
    try {
      const sub = await fs.readdir(epRoot);
      hasSteps = sub.some((n) => /^\d{2}-/.test(n));
    } catch {
      /* */
    }
    if (hasJson || hasSteps) out.push(e.name);
  }
  return out.sort();
}

export default {
  INDEX_NAME,
  EPISODE_FILE,
  loadIndex,
  saveIndex,
  saveEpisodeDoc,
  loadEpisodeDoc,
  scanEpisodeDirs,
  serializeEpisode,
  serializeRun,
  serializeVersion,
};
