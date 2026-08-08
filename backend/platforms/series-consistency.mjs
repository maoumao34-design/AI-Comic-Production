// series-consistency.mjs — 跨集一致性资产包（PIPELINE-DESIGN §3 / SCHEMA consistency_ref）
// 目录：assets/_series/<series_id>/subjects/<subject_safe>/ + manifest.json
// 规则：
//   - 仅步骤 03 ✅ 且有出图 → 晋升进系列历史参考
//   - ↩️ 使 03 不再处于「已确认」→ 撤出本集写入的系列条目
//   - 跨集才自动复用；本集 ✏️/🔄 始终可重出（不误吃自己刚锁的图）

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const ASSETS_DIR = process.env.ASSETS_DIR
  ? path.resolve(process.env.ASSETS_DIR)
  : path.join(REPO_ROOT, "assets");

const SERIES_ROOT_NAME = "_series";
const DEFAULT_SERIES_ID = process.env.SERIES_ID || "default";

function now() {
  return new Date().toISOString();
}

/** EP-01 / ep-02 → 默认同系列；可用 episode.series_id / SERIES_ID 覆盖 */
export function seriesIdFor(episodeId, episode = null) {
  if (episode?.series_id) return String(episode.series_id);
  if (process.env.SERIES_ID) return process.env.SERIES_ID;
  // 约定：同一仓库默认一部系列；多系列时 createEpisode 传 series_id
  return DEFAULT_SERIES_ID;
}

export function consistencyRef(seriesId, subjectId) {
  return `series:${seriesId}/${subjectId}`;
}

export function parseConsistencyRef(ref) {
  if (!ref || typeof ref !== "string") return null;
  const m = ref.match(/^series:([^/]+)\/(.+)$/);
  if (!m) return null;
  return { series_id: m[1], subject_id: m[2] };
}

function subjectSafe(subjectId) {
  return String(subjectId).replace(/\//g, "__");
}

function subjectTypeOf(subjectId) {
  const prefix = String(subjectId).split("/")[0];
  const map = {
    char: "character",
    costume: "costume",
    expr: "expression",
    scene: "scene",
    prop: "prop",
  };
  return map[prefix] || "character";
}

export function seriesDir(seriesId) {
  return path.join(ASSETS_DIR, SERIES_ROOT_NAME, seriesId);
}

export function subjectDir(seriesId, subjectId) {
  return path.join(seriesDir(seriesId), "subjects", subjectSafe(subjectId));
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

export async function loadManifest(seriesId) {
  const p = path.join(seriesDir(seriesId), "manifest.json");
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return {
      series_id: seriesId,
      updated_at: null,
      subjects: {},
      source_episodes: [],
    };
  }
}

async function saveManifest(seriesId, manifest) {
  const root = seriesDir(seriesId);
  await ensureDir(root);
  manifest.series_id = seriesId;
  manifest.updated_at = now();
  await fs.writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2));
  const readme = path.join(root, "README.md");
  try {
    await fs.access(readme);
  } catch {
    await fs.writeFile(
      readme,
      `# Series consistency pack · ${seriesId}\n\n` +
        `步骤 03 ✅ 通过后自动晋升到此目录，供同系列后续集 03/04 引用。\n\n` +
        `- manifest: \`manifest.json\`\n` +
        `- subjects: \`subjects/<type>__<id>/output.png\`\n` +
        `- consistency_ref 形如 \`series:${seriesId}/char/serena\`\n`,
    );
  }
  return manifest;
}

/** 在系列包中找锁定 PNG */
export async function findSeriesPng(seriesId, subjectId) {
  if (!seriesId || !subjectId) return null;
  const p = path.join(subjectDir(seriesId, subjectId), "output.png");
  try {
    await fs.access(p);
    return p;
  } catch {
    return null;
  }
}

/** 本集 03-assets 各版本里找 PNG（新→旧） */
export async function findEpisodeAssetPng(episodeId, subjectId) {
  const root = path.join(ASSETS_DIR, episodeId, "03-assets");
  let versions = [];
  try {
    versions = (await fs.readdir(root)).filter((v) => v.startsWith("v")).sort().reverse();
  } catch {
    return null;
  }
  for (const ver of versions) {
    const candidates = [
      path.join(root, ver, "outputs", subjectId, "output.png"),
      path.join(root, ver, "outputs", subjectSafe(subjectId), "output.png"),
    ];
    for (const p of candidates) {
      try {
        await fs.access(p);
        return p;
      } catch {
        /* next */
      }
    }
  }
  return null;
}

/**
 * 解析参考图：系列锁定包优先，再本集 03。
 * @returns {{ subject, path, source: 'series'|'episode', consistency_ref? } | null}
 */
export async function resolveAssetPng(episodeId, subjectId, seriesId = null) {
  const sid = seriesId || seriesIdFor(episodeId);
  const seriesPath = await findSeriesPng(sid, subjectId);
  if (seriesPath) {
    return {
      subject: subjectId,
      path: seriesPath,
      source: "series",
      consistency_ref: consistencyRef(sid, subjectId),
    };
  }
  const epPath = await findEpisodeAssetPng(episodeId, subjectId);
  if (epPath) {
    return { subject: subjectId, path: epPath, source: "episode", consistency_ref: null };
  }
  return null;
}

/** 产物 URL（走 /api/v1/artifacts?path=） */
export function seriesArtifactUrl(seriesId, subjectId, filename = "output.png") {
  const rel = `${SERIES_ROOT_NAME}/${seriesId}/subjects/${subjectSafe(subjectId)}/${filename}`;
  return `/api/v1/artifacts?path=${encodeURIComponent(rel)}`;
}

async function listOutputPngs(archiveAbs) {
  const outs = path.join(archiveAbs, "outputs");
  const found = [];
  let entries = [];
  try {
    entries = await fs.readdir(outs, { withFileTypes: true });
  } catch {
    return found;
  }
  // outputs 可能是 char/serena 两层，或 char__serena 一层
  async function walk(dir, prefix = "") {
    let kids = [];
    try {
      kids = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const k of kids) {
      const abs = path.join(dir, k.name);
      const rel = prefix ? `${prefix}/${k.name}` : k.name;
      if (k.isDirectory()) {
        const png = path.join(abs, "output.png");
        try {
          await fs.access(png);
          found.push({ subject_id: rel.replace(/\\/g, "/"), png });
        } catch {
          await walk(abs, rel);
        }
      }
    }
  }
  await walk(outs);
  // 兼容扁平 char__serena
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const png = path.join(outs, e.name, "output.png");
    try {
      await fs.access(png);
      const sid = e.name.includes("__") ? e.name.replace(/__/g, "/") : e.name;
      if (!found.some((f) => f.subject_id === sid)) {
        found.push({ subject_id: sid, png });
      }
    } catch {
      /* nested handled by walk */
    }
  }
  return found;
}

/**
 * 步骤 03 approve：把当前审阅版 outputs 晋升进系列包并写 consistency_ref。
 * 会原地更新 versionObj.content（subjects + assets）。
 */
export async function promoteApprovedAssets(episodeId, versionObj, { seriesId } = {}) {
  const sid = seriesId || seriesIdFor(episodeId);
  const archiveRel = (versionObj.archive_path || "").replace(/^assets\//, "").replace(/\/$/, "");
  // archive_path 形如 assets/EP-01/03-assets/v2/
  let archiveAbs = archiveRel
    ? path.join(ASSETS_DIR, archiveRel)
    : path.join(ASSETS_DIR, episodeId, "03-assets", versionObj.version || "v1");

  const pngs = await listOutputPngs(archiveAbs);
  if (!pngs.length) {
    return {
      series_id: sid,
      promoted: [],
      skipped: true,
      reason: "no output.png under 03 archive",
    };
  }

  const manifest = await loadManifest(sid);
  const promoted = [];

  for (const { subject_id, png } of pngs) {
    const dest = subjectDir(sid, subject_id);
    await ensureDir(dest);
    const destPng = path.join(dest, "output.png");
    await fs.copyFile(png, destPng);

    // 附带 prompt / params（若有）
    const srcDir = path.dirname(png);
    for (const fname of ["prompt.md", "params.json", "meta.md"]) {
      try {
        await fs.copyFile(path.join(srcDir, fname), path.join(dest, fname));
      } catch {
        /* optional */
      }
    }

    const ref = consistencyRef(sid, subject_id);
    const entry = {
      subject_id,
      subject_type: subjectTypeOf(subject_id),
      consistency_ref: ref,
      status: "locked",
      source_episode: episodeId,
      source_version: versionObj.version,
      source_archive: versionObj.archive_path || null,
      image: `${SERIES_ROOT_NAME}/${sid}/subjects/${subjectSafe(subject_id)}/output.png`,
      promoted_at: now(),
      model: versionObj.model || null,
      seed: versionObj.seed ?? null,
    };
    await fs.writeFile(path.join(dest, "meta.json"), JSON.stringify(entry, null, 2));
    manifest.subjects[subject_id] = entry;
    promoted.push(entry);
  }

  if (!manifest.source_episodes.includes(episodeId)) {
    manifest.source_episodes.push(episodeId);
  }
  await saveManifest(sid, manifest);

  // 回写 content：schema subjects + 兼容 assets
  const byId = new Map(promoted.map((p) => [p.subject_id, p]));
  const prevAssets = Array.isArray(versionObj.content?.assets) ? versionObj.content.assets : [];
  const prevSubjects = Array.isArray(versionObj.content?.subjects) ? versionObj.content.subjects : [];

  const subjects = [];
  const seen = new Set();
  for (const p of promoted) {
    seen.add(p.subject_id);
    subjects.push({
      subject_type: p.subject_type,
      subject_id: p.subject_id,
      label: p.subject_id,
      status: "locked",
      consistency_ref: p.consistency_ref,
      consistency_check: { passed: true, issues: [] },
      output: { url: seriesArtifactUrl(sid, p.subject_id), type: "image" },
    });
  }
  for (const s of prevSubjects) {
    const id = s.subject_id || s.asset_id;
    if (!id || seen.has(id)) continue;
    subjects.push(s);
  }

  const assets = prevAssets.length
    ? prevAssets.map((a) => {
        const id = a.asset_id || a.subject_id;
        const hit = byId.get(id);
        if (!hit) return a;
        return {
          ...a,
          status: "locked",
          consistency_ref: hit.consistency_ref,
          output: a.output || { url: seriesArtifactUrl(sid, id), type: "image" },
        };
      })
    : subjects.map((s) => ({
        asset_id: s.subject_id,
        kind: "consistency_asset",
        label: s.label,
        status: "locked",
        consistency_ref: s.consistency_ref,
        output: s.output,
      }));

  versionObj.content = {
    ...(versionObj.content || {}),
    series_id: sid,
    subjects,
    assets,
  };
  versionObj.refs = [
    ...(versionObj.refs || []).filter((r) => !String(r).includes(`_series/${sid}/`)),
    ...promoted.map((p) => `assets/${p.image}`),
  ];

  return { series_id: sid, promoted, skipped: false, manifest };
}

/**
 * 撤出某集写入系列包的条目（↩️ 或本集准备改脸时）。
 * 只删 source_episode === episodeId 的条目；其他集贡献保留。
 * @param {{ seriesId?: string, versions?: string[] }} [opts] versions 若给则只撤这些 version
 */
export async function demoteEpisodeContributions(episodeId, { seriesId, versions } = {}) {
  const sid = seriesId || seriesIdFor(episodeId);
  const manifest = await loadManifest(sid);
  const removed = [];
  const verSet = Array.isArray(versions) && versions.length ? new Set(versions) : null;

  for (const [id, entry] of Object.entries(manifest.subjects || {})) {
    if (!entry || entry.source_episode !== episodeId) continue;
    if (verSet && !verSet.has(entry.source_version)) continue;
    delete manifest.subjects[id];
    removed.push({ subject_id: id, source_version: entry.source_version || null });
    try {
      await fs.rm(subjectDir(sid, id), { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  const stillFrom = new Set(
    Object.values(manifest.subjects || {}).map((s) => s.source_episode).filter(Boolean),
  );
  manifest.source_episodes = (manifest.source_episodes || []).filter((ep) => stillFrom.has(ep));
  await saveManifest(sid, manifest);

  // 清掉本集 refs/series 里对应文件（避免 UI 仍显示已撤销参考）
  if (removed.length) {
    const refsRoot = path.join(ASSETS_DIR, episodeId, "03-assets", "refs", "series");
    for (const r of removed) {
      try {
        await fs.rm(path.join(refsRoot, `${subjectSafe(r.subject_id)}.png`), { force: true });
      } catch {
        /* ignore */
      }
    }
  }

  return { series_id: sid, removed, remaining: Object.keys(manifest.subjects || {}).length };
}

/** 从 version.content 去掉 locked / consistency_ref（回退到待审时） */
export function clearLockedStamps(versionObj) {
  if (!versionObj?.content) return versionObj;
  const strip = (arr) =>
    (Array.isArray(arr) ? arr : []).map((x) => ({
      ...x,
      status: x.status === "locked" ? "draft" : x.status,
      consistency_ref: null,
    }));
  versionObj.content = {
    ...versionObj.content,
    subjects: strip(versionObj.content.subjects),
    assets: strip(versionObj.content.assets),
  };
  versionObj.params = {
    ...(versionObj.params || {}),
    series_promoted: false,
    series_demoted: true,
  };
  return versionObj;
}

/**
 * 是否允许从系列包复用到本集：
 * 仅当锁定条目来自「其他集」且未 force_new。本集自己贡献的绝不自动复用。
 */
export async function canReuseSeriesSubject(episodeId, subjectId, seriesId = null) {
  const sid = seriesId || seriesIdFor(episodeId);
  const manifest = await loadManifest(sid);
  const entry = manifest.subjects?.[subjectId];
  if (!entry) return false;
  if (entry.source_episode === episodeId) return false;
  const png = await findSeriesPng(sid, subjectId);
  return !!png;
}

/** 列表 API / 前端展示 */
export async function listSeriesPack(seriesId = DEFAULT_SERIES_ID) {
  const manifest = await loadManifest(seriesId);
  const subjects = Object.values(manifest.subjects || {}).map((s) => ({
    ...s,
    artifact_url: seriesArtifactUrl(seriesId, s.subject_id),
  }));
  return {
    series_id: seriesId,
    updated_at: manifest.updated_at,
    source_episodes: manifest.source_episodes || [],
    subject_count: subjects.length,
    subjects,
  };
}

/**
 * 新集进入 03 时：把系列锁定角色拷进本集 refs/series/，并返回可并入 content 的提示。
 */
export async function seedEpisodeSeriesRefs(episodeId, seriesId = null) {
  const sid = seriesId || seriesIdFor(episodeId);
  const pack = await listSeriesPack(sid);
  if (!pack.subjects.length) return { series_id: sid, seeded: [] };

  const refsRoot = path.join(ASSETS_DIR, episodeId, "03-assets", "refs", "series");
  await ensureDir(refsRoot);
  const seeded = [];
  for (const s of pack.subjects) {
    const src = await findSeriesPng(sid, s.subject_id);
    if (!src) continue;
    const dest = path.join(refsRoot, `${subjectSafe(s.subject_id)}.png`);
    await fs.copyFile(src, dest);
    seeded.push({
      subject_id: s.subject_id,
      consistency_ref: s.consistency_ref,
      path: `${episodeId}/03-assets/refs/series/${subjectSafe(s.subject_id)}.png`,
      artifact_url: `/api/v1/artifacts?path=${encodeURIComponent(`${episodeId}/03-assets/refs/series/${subjectSafe(s.subject_id)}.png`)}`,
    });
  }
  return { series_id: sid, seeded, pack };
}

/**
 * 03 生成前：若系列已锁定该 subject，复制到本集 outputs（复用，不出图）。
 * @returns true 若已复用
 */
export async function reuseSeriesSubjectIntoEpisode(episodeId, subjectId, outVersion, seriesId = null) {
  const sid = seriesId || seriesIdFor(episodeId);
  // 本集贡献 / 未跨集锁定 → 不复用（保证 ✏️🔄 可改）
  if (!(await canReuseSeriesSubject(episodeId, subjectId, sid))) return null;
  const src = await findSeriesPng(sid, subjectId);
  if (!src) return null;

  const destDir = path.join(ASSETS_DIR, episodeId, "03-assets", outVersion, "outputs", subjectId);
  await ensureDir(destDir);
  await fs.copyFile(src, path.join(destDir, "output.png"));
  const ref = consistencyRef(sid, subjectId);
  const meta = {
    subject_id: subjectId,
    mode: "reused_from_series",
    consistency_ref: ref,
    series_id: sid,
    at: now(),
  };
  await fs.writeFile(path.join(destDir, "meta.md"), `# reused from series\n\n- ref: ${ref}\n- at: ${now()}\n`);
  await fs.writeFile(path.join(destDir, "params.json"), JSON.stringify(meta, null, 2));
  const rel = `${episodeId}/03-assets/${outVersion}/outputs/${subjectId}/output.png`;
  return {
    subject: subjectId,
    reused: true,
    consistency_ref: ref,
    series_id: sid,
    files: [{ filename: "output.png" }],
    dest: destDir,
    artifact: {
      type: "image",
      label: `${subjectId}（系列复用）`,
      url: `/api/v1/artifacts?path=${encodeURIComponent(rel)}`,
      meta: { subject_id: subjectId, consistency_ref: ref, reused_from_series: true },
      already_on_disk: true,
      disk_rel: rel,
    },
    content_asset: {
      asset_id: subjectId,
      kind: "consistency_asset",
      label: subjectId,
      status: "locked",
      consistency_ref: ref,
      output: { url: `/api/v1/artifacts?path=${encodeURIComponent(rel)}`, type: "image" },
    },
  };
}

export const META = {
  SERIES_ROOT_NAME,
  DEFAULT_SERIES_ID,
  ASSETS_DIR,
};
