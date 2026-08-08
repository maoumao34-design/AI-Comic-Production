// platforms/comfy-generate.mjs — 步骤 03/04 真实出图（供 engine runStep 调用）
// 复用 workflows/03-assets/character-sheet.api.json + comfyui 五件套。
// 环境：COMFYUI_BASE_URL、COMFYUI_CKPT；可选 COMFYUI_MAX_SUBJECTS（默认全量）。

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as comfy from "./comfyui.mjs";
import * as seriesConsistency from "./series-consistency.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_NEG =
  "cartoon, anime, comic, illustration, deformed hands, extra fingers, watermark, subtitle burn-in, logo spam, inconsistent face across views, blurry, low quality, plastic skin";
const DEFAULT_STYLE =
  "photorealistic cinematic still, vertical 9:16 composition, natural skin texture, shallow depth of field, film lighting, high detail";

const STEP_DIR = {
  "03": "03-assets",
  "04": "04-keyframes",
};
const WORKFLOW_PATH = {
  "03": path.join(REPO_ROOT, "workflows", "03-assets", "character-sheet.api.json"),
  "04": path.join(REPO_ROOT, "workflows", "04-keyframes", "keyframe-i2i.api.json"),
};

function now() {
  return new Date().toISOString();
}

function flattenSubjects(params) {
  const planned = params?.subjects_planned;
  if (!planned || typeof planned !== "object") return [];
  const out = [];
  for (const list of Object.values(planned)) {
    if (Array.isArray(list)) out.push(...list);
  }
  return out;
}

export function parsePromptPack(md) {
  const styleMatch = md.match(/Style lock[^:\n]*:\s*([^\n]+)/i);
  let styleLock = styleMatch ? styleMatch[1].trim() : DEFAULT_STYLE;
  // 方案锁定：样片为 AI 真人，强制去掉 comic 默认
  styleLock = styleLock.replace(/cinematic comic-realism/gi, "photorealistic cinematic").replace(/\bcomic\b/gi, "photoreal");
  const negMatch = md.match(/Negative[^:\n]*:\s*([^\n]+)/i);
  const negative = negMatch ? negMatch[1].trim() : DEFAULT_NEG;
  const subjects = new Map();
  for (const m of md.matchAll(/^\s*[-*]\s+\*\*([a-z]+\/[a-z0-9-]+)\*\*\s*:\s*(.+)$/gim)) {
    subjects.set(m[1], m[2].trim());
  }
  const parts = md.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const firstLine = part.split(/\n/)[0] || "";
    const idMatch = firstLine.match(/^([a-z]+\/[a-z0-9-]+)/i);
    if (!idMatch) continue;
    const id = idMatch[1];
    const body = part
      .split(/\n/)
      .slice(1)
      .join("\n")
      .replace(/^---+\s*$/gm, "")
      .trim();
    if (!body) continue;
    const cleaned = body
      .split(/\n(?=\s*[-*]\s+\*\*[a-z]+\/)/i)[0]
      .replace(/\*\*/g, "")
      .replace(/\n+/g, " ")
      .trim();
    if (cleaned) subjects.set(id, cleaned);
  }
  return { styleLock, negative, subjects };
}

export function parseKeyframes(md) {
  const styleMatch = md.match(/Style lock[^:\n]*:\s*([^\n]+)/i);
  let styleLock = styleMatch ? styleMatch[1].trim() : DEFAULT_STYLE;
  styleLock = styleLock.replace(/cinematic comic-realism/gi, "photorealistic cinematic").replace(/\bcomic\b/gi, "photoreal");
  const negMatch = md.match(/Global negative:\s*([^\n]+)/i);
  const negative = negMatch ? negMatch[1].trim() : DEFAULT_NEG;
  const subjects = new Map();
  const refs = new Map();
  const blocks = md.split(/^##\s+/m).slice(1);
  for (const block of blocks) {
    const head = (block.split(/\n/)[0] || "").trim();
    const idMatch = head.match(/^(KF-S\d+)/i) || head.match(/\b(S\d+)\b/i);
    if (!idMatch) continue;
    let id = idMatch[1].toUpperCase().startsWith("KF-")
      ? idMatch[1].toUpperCase().replace(/^KF-S/, "S")
      : idMatch[1].toUpperCase();
    if (!id.startsWith("S")) id = `S${id}`;
    const body = block.split(/\n/).slice(1).join("\n").replace(/\*\*/g, "").replace(/\n+/g, " ").trim();
    if (body) subjects.set(id, body);
    const refLine = block.match(/Asset refs:\s*`?([^`\n]+)`?/i);
    if (refLine) {
      const ids = [...refLine[1].matchAll(/([a-z]+\/[a-z0-9-]+)/gi)].map((m) => m[1]);
      if (ids.length) refs.set(id, ids);
    }
  }
  return { styleLock, negative, subjects, refs };
}

function buildPositive(styleLock, subjectId, body) {
  return [styleLock || DEFAULT_STYLE, `subject_id=${subjectId}`, body, "photorealistic cinematic drama still, vertical composition, high detail"]
    .filter(Boolean)
    .join(". ");
}

async function loadWorkflow(stepId, ckpt) {
  const wfPath = WORKFLOW_PATH[stepId] || WORKFLOW_PATH["03"];
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(wfPath, "utf8"));
  } catch {
    raw = JSON.parse(await fs.readFile(WORKFLOW_PATH["03"], "utf8"));
  }
  const { _meta, ...graph } = raw;
  const ckptName =
    ckpt ||
    process.env.COMFYUI_CKPT ||
    "RealVisXL_V5.0_fp16.safetensors";
  if (!ckptName || ckptName.includes("REPLACE_WITH")) {
    throw Object.assign(new Error("COMFYUI_CKPT 未设置或仍是占位名；请指向 models/checkpoints 里真实文件名"), {
      code: "unconfigured",
    });
  }
  if (graph["3"]?.inputs) graph["3"].inputs.ckpt_name = ckptName;
  return { graph, ckptName, wfPath, _meta };
}

/** 系列包优先，再本集 03 outputs */
async function findAssetPng(episodeId, subjectId, seriesId = null) {
  const hit = await seriesConsistency.resolveAssetPng(episodeId, subjectId, seriesId);
  return hit?.path || null;
}

async function resolveRefForShot(episodeId, shotId, refIds = [], seriesId = null) {
  for (const id of refIds) {
    const hit = await seriesConsistency.resolveAssetPng(episodeId, id, seriesId);
    if (hit) return hit;
  }
  // 回退：任意角色脸（系列 → 本集）
  for (const id of ["char/serena", "char/james", "char/amy", "char/kate"]) {
    const hit = await seriesConsistency.resolveAssetPng(episodeId, id, seriesId);
    if (hit) return hit;
  }
  return null;
}

function stripMeta(graph) {
  const g = structuredClone(graph);
  for (const node of Object.values(g)) {
    if (node?.meta) delete node.meta;
  }
  return g;
}

function applyTextAndSeed(graph, { positive, negative, seed }) {
  const g = structuredClone(graph);
  for (const node of Object.values(g)) {
    if (node?.class_type === "CLIPTextEncode" && node?.meta?.role === "positive" && positive != null) {
      node.inputs.text = positive;
    }
    if (node?.class_type === "CLIPTextEncode" && node?.meta?.role === "negative" && negative != null) {
      node.inputs.text = negative;
    }
    if (node?.class_type?.startsWith?.("KSampler") && seed != null && node.inputs) {
      node.inputs.seed = Number(seed);
    }
  }
  return g;
}

async function generateOne({ graph, subjectId, positive, negative, seed, destDir, refLocalPath = null }) {
  await fs.mkdir(destDir, { recursive: true });
  let g = applyTextAndSeed(graph, { positive, negative, seed });
  if (refLocalPath) {
    const uploaded = await comfy.uploadImage(refLocalPath, {
      filename: `ref_${subjectId.replace(/\//g, "_")}${path.extname(refLocalPath) || ".png"}`,
    });
    for (const node of Object.values(g)) {
      if (node?.class_type === "LoadImage" && node.inputs) {
        node.inputs.image = uploaded.name;
      }
    }
  }
  g = stripMeta(g);
  if (g["9"]?.inputs) {
    g["9"].inputs.filename_prefix = `comic_${subjectId.replace(/\//g, "_")}`;
  }
  const job = await comfy.submit(g);
  const done = await comfy.wait(job.job_id);
  if (done.status !== "completed") {
    throw new Error(`generate failed for ${subjectId}: ${done.error || done.status}`);
  }
  const recovered = await comfy.recover(job.job_id, destDir, { prefix: "output" });
  const rec = comfy.record(job, {
    subject_id: subjectId,
    seed: seed != null ? Number(seed) : null,
    positive,
    negative,
    ref_image: refLocalPath || null,
  });
  await fs.writeFile(path.join(destDir, "params.json"), JSON.stringify(rec, null, 2));
  return { subject: subjectId, job_id: job.job_id, files: recovered.files, dest: destDir, ref: refLocalPath };
}

/** 递归收集 outputs 下 subject/output.png（支持 char/serena 两层） */
async function listOutputImages(outsRoot) {
  const found = [];
  async function walk(dir, prefix = "") {
    let kids = [];
    try {
      kids = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const k of kids) {
      if (!k.isDirectory()) continue;
      const abs = path.join(dir, k.name);
      const rel = prefix ? `${prefix}/${k.name}` : k.name;
      const png = path.join(abs, "output.png");
      try {
        await fs.access(png);
        found.push({ subject_id: rel.replace(/\\/g, "/"), abs: png });
      } catch {
        await walk(abs, rel);
      }
    }
  }
  await walk(outsRoot);
  return found;
}

async function countOutputImages(versionRoot) {
  return (await listOutputImages(path.join(versionRoot, "outputs"))).length;
}

/**
 * 读取 prompt 包：优先 preferredVersion；否则选「有图最多」的 vN（刷新后不丢出图）。
 */
async function readPack(episodeId, stepId, preferredVersion) {
  const stepDir = STEP_DIR[stepId];
  const base = path.join(REPO_ROOT, "assets", episodeId, stepDir);
  let versions = [];
  try {
    versions = (await fs.readdir(base)).filter((v) => /^v\d+$/.test(v));
  } catch {
    return null;
  }
  versions.sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));

  const ordered = [];
  if (preferredVersion) ordered.push(preferredVersion);
  // 无指定时按出图数量排序，并列取较新版本
  const scored = [];
  for (const ver of versions) {
    if (preferredVersion && ver === preferredVersion) continue;
    const root = path.join(base, ver);
    try {
      await fs.access(path.join(root, "prompt.md"));
      scored.push({ ver, n: await countOutputImages(root) });
    } catch {
      /* skip */
    }
  }
  scored.sort((a, b) => b.n - a.n || Number(b.ver.slice(1)) - Number(a.ver.slice(1)));
  for (const s of scored) ordered.push(s.ver);
  if (!ordered.length && versions.length) ordered.push(...versions);

  for (const ver of ordered) {
    const root = path.join(base, ver);
    try {
      const promptMd = await fs.readFile(path.join(root, "prompt.md"), "utf8");
      let params = {};
      try {
        params = JSON.parse(await fs.readFile(path.join(root, "params.json"), "utf8"));
      } catch {
        /* optional */
      }
      return { packRoot: root, packVersion: ver, promptMd, params };
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * 真实出图：把图写入 assets/<ep>/<step>/<outVersion>/outputs/，并返回 engine 可用的 gen 结构。
 */
export async function generateStepImages(episodeId, stepId, outVersion, inputs = {}) {
  if (stepId !== "03" && stepId !== "04") {
    throw Object.assign(new Error(`comfy-generate only supports 03/04, got ${stepId}`), { code: "bad_step" });
  }
  const h = await comfy.health();
  if (h.status !== "ok") {
    throw Object.assign(new Error(`ComfyUI not ready: ${h.detail || h.status}`), { code: "comfy_down", health: h });
  }

  const pack = await readPack(episodeId, stepId, inputs.pack_version);
  if (!pack) {
    throw Object.assign(new Error(`no prompt pack under assets/${episodeId}/${STEP_DIR[stepId]}/`), {
      code: "missing_pack",
    });
  }

  const parsed = stepId === "03" ? parsePromptPack(pack.promptMd) : parseKeyframes(pack.promptMd);
  let list =
    stepId === "03"
      ? flattenSubjects(pack.params)
      : [...parsed.subjects.keys()];
  if (!list.length) list = [...parsed.subjects.keys()];

  const only = inputs.subject || inputs.params_override?.subject;
  if (only) list = list.filter((s) => s === only || s === `S${only}`);

  // 默认先出角色三视图，避免 UI 一次卡太久；params_override.max_subjects / COMFYUI_MAX_SUBJECTS / "all"
  const maxRaw = inputs.params_override?.max_subjects ?? process.env.COMFYUI_MAX_SUBJECTS ?? "characters";
  if (stepId === "03" && maxRaw === "characters") {
    list = list.filter((s) => String(s).startsWith("char/"));
  } else if (maxRaw !== "all" && maxRaw != null && maxRaw !== "") {
    const n = Number(maxRaw);
    if (Number.isFinite(n) && n > 0) list = list.slice(0, n);
  }

  if (!list.length) {
    throw Object.assign(new Error("no subjects to generate"), { code: "empty_subjects" });
  }

  const seriesId = inputs.series_id || seriesConsistency.seriesIdFor(episodeId);

  if (stepId === "04") {
    const probe = await resolveRefForShot(episodeId, "S1", ["char/serena"], seriesId);
    if (!probe) {
      throw Object.assign(
        new Error("step 04 needs series-locked or episode step-03 image outputs first"),
        { code: "missing_upstream" },
      );
    }
  }

  // 04 优先 i2i；若无 LoadImage 图则回退 03 txt2img 工作流
  let { graph, ckptName } = await loadWorkflow(stepId, inputs.params_override?.ckpt || inputs.ckpt);
  const stepDir = STEP_DIR[stepId];
  const outRoot = path.join(REPO_ROOT, "assets", episodeId, stepDir, outVersion);
  await fs.mkdir(outRoot, { recursive: true });
  await fs.writeFile(path.join(outRoot, "prompt.md"), pack.promptMd);
  const seedBase = inputs.seed ?? inputs.params_override?.seed ?? Math.floor(Math.random() * 1e9);
  const forceNew = inputs.params_override?.force_new === true || inputs.force_new === true;

  const results = [];
  const artifacts = [];
  const contentAssets = [];

  for (let i = 0; i < list.length; i++) {
    const subjectId = list[i];
    const body =
      parsed.subjects.get(subjectId) ||
      parsed.subjects.get(subjectId.replace(/^S/, "KF-S")) ||
      `photorealistic asset for ${subjectId}, consistent design, vertical composition`;
    const positive = buildPositive(parsed.styleLock, subjectId, body);
    const destDir = path.join(outRoot, "outputs", subjectId);
    const subSeed = Number(seedBase) + i;
    let refLocalPath = null;
    let useGraph = graph;

    // 03：系列已锁定的 subject 默认复用（跨集一致）；force_new 才重出图
    if (stepId === "03" && !forceNew) {
      const reused = await seriesConsistency.reuseSeriesSubjectIntoEpisode(
        episodeId, subjectId, outVersion, seriesId,
      );
      if (reused) {
        console.log(`[comfy-generate] 03 ${subjectId} reused from series ${seriesId}`);
        results.push(reused);
        artifacts.push(reused.artifact);
        contentAssets.push(reused.content_asset);
        continue;
      }
    }

    if (stepId === "04") {
      const refIds = parsed.refs?.get(subjectId) || [];
      const ref = await resolveRefForShot(episodeId, subjectId, refIds, seriesId);
      if (ref?.path) {
        refLocalPath = ref.path;
      } else {
        // 无参考则回退 txt2img
        const fb = await loadWorkflow("03", inputs.params_override?.ckpt || inputs.ckpt);
        useGraph = fb.graph;
        ckptName = fb.ckptName;
      }
    } else if (stepId === "03") {
      // 本集重生时也可把系列脸当 img2img 锚（若工作流含 LoadImage；当前 character-sheet 为 txt2img 则忽略）
      const seriesRef = await seriesConsistency.findSeriesPng(seriesId, subjectId);
      if (seriesRef && graph && Object.values(graph).some((n) => n?.class_type === "LoadImage")) {
        refLocalPath = seriesRef;
      }
    }
    console.log(`[comfy-generate] ${stepId} ${subjectId} (${i + 1}/${list.length}) seed=${subSeed} ref=${refLocalPath || "none"}`);
    try {
      const r = await generateOne({
        graph: useGraph,
        subjectId,
        positive,
        negative: parsed.negative || DEFAULT_NEG,
        seed: subSeed,
        destDir,
        refLocalPath,
      });
      results.push(r);
      for (const f of r.files || []) {
        const rel = `${episodeId}/${stepDir}/${outVersion}/outputs/${subjectId}/${f.filename}`.replace(/\\/g, "/");
        artifacts.push({
          type: "image",
          label: subjectId,
          url: `/api/v1/artifacts?path=${encodeURIComponent(rel)}`,
          meta: { subject_id: subjectId, job_id: r.job_id, seed: subSeed },
          // writeArchive 额外字段：已落盘，跳过再写
          already_on_disk: true,
          disk_rel: rel,
        });
      }
      contentAssets.push({
        asset_id: subjectId,
        kind: stepId === "03" ? "consistency_asset" : "keyframe",
        label: subjectId,
        output: {
          url: `/api/v1/artifacts?path=${encodeURIComponent(`${episodeId}/${stepDir}/${outVersion}/outputs/${subjectId}/output.png`)}`,
          type: "image",
        },
      });
    } catch (e) {
      console.error(`[comfy-generate] FAIL ${subjectId}:`, e.message || e);
      results.push({ subject: subjectId, error: String(e.message || e) });
    }
  }

  const ok = results.filter((r) => r && !r.error);
  const failed = results.filter((r) => r?.error);
  const reusedCount = results.filter((r) => r?.reused).length;
  const params = {
    model: ckptName,
    seed: seedBase,
    platform: "comfyui",
    series_id: seriesId,
    images_generated: failed.length === 0 && ok.length > 0,
    subjects_requested: list,
    ok: ok.length,
    failed: failed.length,
    reused_from_series: reusedCount,
    failures: failed.map((f) => ({ subject: f.subject, error: f.error })),
    pack_version: pack.packVersion,
    note: inputs.note || null,
    ...(inputs.params_override || {}),
  };
  await fs.writeFile(path.join(outRoot, "params.json"), JSON.stringify(params, null, 2));
  const meta =
    `# ${stepId} ${outVersion} meta\n\n- platform: comfyui\n- model: ${ckptName}\n- seed: ${seedBase}\n` +
    `- ok: ${ok.length}\n- failed: ${failed.length}\n- at: ${now()}\n` +
    (inputs.note ? `- note: ${inputs.note}\n` : "");
  await fs.writeFile(path.join(outRoot, "meta.md"), meta);

  if (!ok.length) {
    throw Object.assign(new Error(`all ${list.length} subjects failed`), {
      code: "generate_failed",
      failures: failed,
    });
  }

  const content =
    stepId === "03"
      ? { assets: contentAssets }
      : { keyframes: contentAssets.map((a) => ({ frame_id: a.asset_id, label: a.label, output: a.output })) };

  // 文本产物（output.json）由 engine writeArchive 写入；图片已在 outputs/
  const outputs = [
    {
      filename: "output.json",
      type: "json",
      label: `${stepId} 产出清单`,
      content: JSON.stringify(
        { episode_id: episodeId, step: stepId, platform: "comfyui", content, params },
        null,
        2,
      ),
    },
  ];

  return {
    prompt: pack.promptMd,
    params,
    meta,
    outputs,
    artifacts_extra: artifacts,
    model: ckptName,
    seed: seedBase,
    content,
    platform: "comfyui",
    platform_slot: null,
    archive_prewritten: true,
    archive_root: outRoot,
  };
}

/** 仅从磁盘 prompt 包装成可审阅版本（不出图）——用于 bootstrap / 缺 Comfy 时诚实展示 */
export async function loadPromptOnlyVersion(episodeId, stepId, outVersion, inputs = {}) {
  const pack = await readPack(episodeId, stepId, inputs.pack_version);
  if (!pack) return null;
  const parsed = stepId === "03" ? parsePromptPack(pack.promptMd) : parseKeyframes(pack.promptMd);
  let list = stepId === "03" ? flattenSubjects(pack.params) : [...parsed.subjects.keys()];
  if (!list.length) list = [...parsed.subjects.keys()];

  const stepDir = STEP_DIR[stepId];
  const artifacts = [];
  const contentAssets = [];
  // 若已有历史 outputs（含 char/serena 嵌套），挂上预览——刷新/重启不丢图
  const imgs = await listOutputImages(path.join(pack.packRoot, "outputs"));
  for (const { subject_id } of imgs) {
    const rel = `${episodeId}/${stepDir}/${pack.packVersion}/outputs/${subject_id}/output.png`.replace(/\\/g, "/");
    artifacts.push({
      type: "image",
      label: subject_id,
      url: `/api/v1/artifacts?path=${encodeURIComponent(rel)}`,
      meta: { subject_id, from_pack: true },
      already_on_disk: true,
    });
    contentAssets.push({
      asset_id: subject_id,
      kind: stepId === "03" ? "consistency_asset" : "keyframe",
      label: subject_id,
      status: "draft",
      output: { url: `/api/v1/artifacts?path=${encodeURIComponent(rel)}`, type: "image" },
    });
  }

  const seed = inputs.seed ?? 0;
  const params = {
    model: artifacts.length
      ? (pack.params?.model || process.env.COMFYUI_CKPT || "disk-reload")
      : "<prompt_only — 点 🔄 重生触发出图>",
    seed: typeof pack.params?.seed === "number" ? pack.params.seed : seed,
    platform: "comfyui",
    images_generated: artifacts.length > 0,
    subjects_planned_count: list.length,
    pack_version: pack.packVersion,
    mode: artifacts.length ? "disk_reload" : "prompt_only",
  };
  const content =
    stepId === "03"
      ? {
          assets: contentAssets.length
            ? contentAssets
            : list.map((id) => ({
                asset_id: id,
                kind: "consistency_asset",
                label: id,
                prompt_excerpt: (parsed.subjects.get(id) || "").slice(0, 200),
              })),
          subjects: contentAssets.map((a) => ({
            subject_id: a.asset_id,
            label: a.label,
            status: "draft",
            output: a.output,
            subject_type: String(a.asset_id).startsWith("char/") ? "character" : undefined,
          })),
        }
      : {
          keyframes: contentAssets.length
            ? contentAssets.map((a) => ({ frame_id: a.asset_id, label: a.label, output: a.output }))
            : list.map((id) => ({
                frame_id: id,
                label: id,
                prompt_excerpt: (parsed.subjects.get(id) || "").slice(0, 200),
              })),
        };

  return {
    prompt: pack.promptMd,
    params,
    meta: `# ${stepId} prompt pack\n\n- mode: prompt_only\n- subjects: ${list.length}\n- existing_images: ${artifacts.length}\n- at: ${now()}\n`,
    outputs: [
      {
        filename: "output.json",
        type: "json",
        label: "Prompt 包（待出图）",
        content: JSON.stringify({ episode_id: episodeId, step: stepId, content, params }, null, 2),
      },
    ],
    artifacts_extra: artifacts,
    model: params.model,
    seed,
    content,
    platform: "comfyui",
    platform_slot: null,
  };
}

export default { generateStepImages, loadPromptOnlyVersion, parsePromptPack, parseKeyframes };
