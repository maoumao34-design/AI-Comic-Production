#!/usr/bin/env node
/**
 * EP-01 local GPU CLI — matches docs/EP01-LOCAL-GPU-RUN.md §1.5
 * Handoff / 回灌: docs/EP01-GPU-AGENT-HANDOFF.md
 *
 *   node scripts/ep01-cli.mjs doctor [--base-url http://127.0.0.1:8188]
 *   node scripts/ep01-cli.mjs handoff-check --episode EP-01 --version v1
 *   node scripts/ep01-cli.mjs run --episode EP-01 --step 03 --version v1
 *   node scripts/ep01-cli.mjs run --episode EP-01 --from 04 --to 07 --dry-run
 *   node scripts/ep01-cli.mjs run --episode EP-01 --from 03 --to 07 --pause-each-step
 *
 * Reads assets/<ep>/<stepDir>/<ver>/{prompt.md,params.json}
 * Writes assets/<ep>/<stepDir>/<ver>/outputs/<subject>/...
 * Never fakes images. Steps 05–07 stay honest stubs until video/TTS glue lands.
 * --dry-run scaffolds 05–07 archive dirs without claiming real generation.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline";
import * as comfy from "../backend/platforms/comfyui.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

/** Canonical step dirs — align with PIPELINE-DESIGN / backend engine (05-clips). */
const STEP_DIR = {
  "03": "03-assets",
  "04": "04-keyframes",
  "05": "05-clips",
  "06": "06-voice-sub",
  "07": "07-final",
};

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

const DEFAULT_NEG =
  "deformed hands, extra fingers, watermark, subtitle burn-in, logo spam, inconsistent face across views, blurry, low quality";

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return def;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}
function now() {
  return new Date().toISOString();
}

function usage() {
  console.log(`Usage:
  node scripts/ep01-cli.mjs doctor [--base-url http://127.0.0.1:8188]
  node scripts/ep01-cli.mjs handoff-check --episode EP-01 --version v1
  node scripts/ep01-cli.mjs run --episode EP-01 --step 03 --version v1 [--subject char/serena] [--ckpt FILE] [--dry-run] [--seed N]
  node scripts/ep01-cli.mjs run --episode EP-01 --from 04 --to 07 --version v1 --dry-run
  node scripts/ep01-cli.mjs run --episode EP-01 --from 03 --to 07 --pause-each-step [--version v1]

Env: COMFYUI_BASE_URL (required for generate), optional COMFYUI_API_KEY / COMFYUI_CKPT
Docs: docs/EP01-GPU-AGENT-HANDOFF.md · docs/EP01-LOCAL-GPU-RUN.md · docs/LOCAL-GPU-RUNBOOK.md`);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listImageFiles(dir) {
  const out = [];
  async function walk(d) {
    let ents;
    try {
      ents = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (IMAGE_EXT.has(path.extname(e.name).toLowerCase())) out.push(full);
    }
  }
  await walk(dir);
  return out;
}

async function ensureBaseUrl(cliBase) {
  if (cliBase) process.env.COMFYUI_BASE_URL = cliBase.replace(/\/+$/, "");
  if (!process.env.COMFYUI_BASE_URL) {
    process.env.COMFYUI_BASE_URL = comfy.LOCAL_DEFAULT_BASE;
  }
}

async function cmdDoctor() {
  await ensureBaseUrl(arg("base-url"));
  const h = await comfy.health();
  console.log(JSON.stringify({ command: "doctor", ...h, base_url: process.env.COMFYUI_BASE_URL }, null, 2));
  process.exit(h.status === "ok" ? 0 : 1);
}

/**
 * Non-GPU handoff probe: step-03 回灌清单 + 04–07 archive readiness.
 * Does not claim Comfy connected; does not invent images.
 */
async function cmdHandoffCheck() {
  const episode = arg("episode", "EP-01");
  const version = arg("version", "v1");
  const step03Root = path.join(REPO_ROOT, "assets", episode, STEP_DIR["03"], version);
  const paramsPath = path.join(step03Root, "params.json");
  const report = {
    command: "handoff-check",
    episode,
    version,
    doc: "docs/EP01-GPU-AGENT-HANDOFF.md",
    step03: { root: path.relative(REPO_ROOT, step03Root).replace(/\\/g, "/"), subjects: [], missing: [], present: 0, planned: 0 },
    steps: {},
    ready_for_human_checkpoint_03: false,
    dry_run_hint: `node scripts/ep01-cli.mjs run --episode ${episode} --from 04 --to 07 --version ${version} --dry-run`,
  };

  let params = null;
  if (await pathExists(paramsPath)) {
    params = JSON.parse(await fs.readFile(paramsPath, "utf8"));
    const planned = flattenSubjects(params);
    report.step03.planned = planned.length;
    report.step03.images_generated = !!params.images_generated;
    report.step03.status = params.status || null;
    for (const sid of planned) {
      const dest = path.join(step03Root, "outputs", sid);
      const images = await listImageFiles(dest);
      const row = { subject: sid, path: path.relative(REPO_ROOT, dest).replace(/\\/g, "/"), images: images.length };
      report.step03.subjects.push(row);
      if (images.length) report.step03.present += 1;
      else report.step03.missing.push(sid);
    }
  } else {
    report.step03.error = `missing ${path.relative(REPO_ROOT, paramsPath).replace(/\\/g, "/")}`;
  }

  report.ready_for_human_checkpoint_03 =
    report.step03.planned > 0 &&
    report.step03.missing.length === 0 &&
    report.step03.present === report.step03.planned;

  for (const [num, dir] of Object.entries(STEP_DIR)) {
    const root = path.join(REPO_ROOT, "assets", episode, dir, version);
    const outputs = path.join(root, "outputs");
    const hasRoot = await pathExists(root);
    const hasPrompt = await pathExists(path.join(root, "prompt.md"));
    const hasParams = await pathExists(path.join(root, "params.json"));
    const hasOutputs = await pathExists(outputs);
    let outputEntries = 0;
    if (hasOutputs) {
      try {
        outputEntries = (await fs.readdir(outputs)).length;
      } catch {
        outputEntries = 0;
      }
    }
    report.steps[num] = {
      dir,
      root: path.relative(REPO_ROOT, root).replace(/\\/g, "/"),
      exists: hasRoot,
      prompt_md: hasPrompt,
      params_json: hasParams,
      outputs_dir: hasOutputs,
      outputs_entries: outputEntries,
    };
  }

  console.log(JSON.stringify(report, null, 2));
  // exit 0 always for probe; missing images are listed, not a hard fail (GPU handoff pending)
  process.exit(0);
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

/** Parse subject prompts from prompt.md (## id or - **id**: body) */
function parsePromptPack(md) {
  const styleMatch = md.match(/Style lock[^:\n]*:\s*([^\n]+)/i);
  const styleLock = styleMatch ? styleMatch[1].trim() : "vertical 9:16, cinematic comic-realism";
  const negMatch = md.match(/Negative[^:\n]*:\s*([^\n]+)/i);
  const negative = negMatch ? negMatch[1].trim() : DEFAULT_NEG;

  const subjects = new Map();

  // Bullet form: - **expr/serena-controlled**: text
  for (const m of md.matchAll(/^\s*[-*]\s+\*\*([a-z]+\/[a-z0-9-]+)\*\*\s*:\s*(.+)$/gim)) {
    subjects.set(m[1], m[2].trim());
  }

  // Heading form: ## char/serena — ...
  const parts = md.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const firstLine = part.split(/\n/)[0] || "";
    const idMatch = firstLine.match(/^([a-z]+\/[a-z0-9-]+)/i);
    if (!idMatch) continue;
    const id = idMatch[1];
    if (subjects.has(id) && !firstLine.includes(id)) continue;
    const body = part
      .split(/\n/)
      .slice(1)
      .join("\n")
      .replace(/^---+\s*$/gm, "")
      .trim();
    // stop at next thematic section without id (Expressions / Costumes are containers)
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

/** Parse KF-S## keyframe blocks from step-04 prompt.md */
function parseKeyframes(md) {
  const styleMatch = md.match(/Style lock[^:\n]*:\s*([^\n]+)/i);
  const styleLock = styleMatch ? styleMatch[1].trim() : "vertical 9:16, cinematic comic-realism";
  const negMatch = md.match(/Global negative:\s*([^\n]+)/i);
  const negative = negMatch ? negMatch[1].trim() : DEFAULT_NEG;
  const subjects = new Map();
  const blocks = md.split(/^##\s+/m).slice(1);
  for (const block of blocks) {
    const head = (block.split(/\n/)[0] || "").trim();
    const idMatch = head.match(/^(KF-S\d+)/i) || head.match(/\b(S\d+)\b/i);
    if (!idMatch) continue;
    const id = idMatch[1].toUpperCase().startsWith("KF-")
      ? idMatch[1].toUpperCase().replace(/^KF-S/, "S")
      : idMatch[1].toUpperCase();
    const shotId = id.startsWith("S") ? id : `S${id}`;
    const body = block
      .split(/\n/)
      .slice(1)
      .join("\n")
      .replace(/\*\*/g, "")
      .replace(/\n+/g, " ")
      .trim();
    if (body) subjects.set(shotId, body);
  }
  return { styleLock, negative, subjects };
}

function buildPositive(styleLock, subjectId, body) {
  return [
    styleLock,
    `subject_id=${subjectId}`,
    body,
    "vertical composition, high detail, comic illustrated drama still",
  ]
    .filter(Boolean)
    .join(". ");
}

async function loadWorkflow(ckpt) {
  const wfPath = path.join(REPO_ROOT, "workflows", "03-assets", "character-sheet.api.json");
  const raw = JSON.parse(await fs.readFile(wfPath, "utf8"));
  const { _meta, ...graph } = raw;
  const ckptName = ckpt || process.env.COMFYUI_CKPT || null;
  if (ckptName && graph["3"]?.inputs) graph["3"].inputs.ckpt_name = ckptName;
  return { raw, graph, _meta, wfPath };
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

async function generateOne({ graph, subjectId, positive, negative, seed, destDir, dry }) {
  if (dry) {
    return { dry_run: true, subject: subjectId, positive: positive.slice(0, 160), dest: destDir };
  }
  await fs.mkdir(destDir, { recursive: true });
  let g = applyTextAndSeed(graph, { positive, negative, seed });
  g = stripMeta(g);
  // filename prefix per subject
  if (g["9"]?.inputs) {
    g["9"].inputs.filename_prefix = `EP01_${subjectId.replace(/\//g, "_")}`;
  }
  const job = await comfy.submit(g);
  const done = await comfy.wait(job.job_id);
  if (done.status !== "completed") {
    throw new Error(`generate failed for ${subjectId}: ${done.error || done.status}`);
  }
  const safeName = subjectId.replace(/\//g, "__");
  const recovered = await comfy.recover(job.job_id, destDir, { prefix: "output" });
  const rec = comfy.record(job, {
    subject_id: subjectId,
    seed: seed != null ? Number(seed) : null,
    positive,
    negative,
  });
  await fs.writeFile(path.join(destDir, "params.json"), JSON.stringify(rec, null, 2));
  await fs.writeFile(
    path.join(destDir, "prompt.md"),
    `# ${subjectId}\n\n## positive\n\n${positive}\n\n## negative\n\n${negative}\n`,
  );
  await fs.writeFile(
    path.join(destDir, "meta.md"),
    `# meta\n\n- subject: ${subjectId}\n- job_id: ${job.job_id}\n- files: ${(recovered.files || []).map((f) => f.filename).join(", ")}\n- at: ${now()}\n`,
  );
  return { subject: subjectId, job_id: job.job_id, files: recovered.files, dest: destDir, safeName };
}

async function updateStepMeta(stepRoot, results, params) {
  const ok = results.filter((r) => r && !r.error && !r.dry_run);
  const failed = results.filter((r) => r?.error);
  const lines = [
    `# output`,
    ``,
    `- generated_at: ${now()}`,
    `- ok: ${ok.length}`,
    `- failed: ${failed.length}`,
    ``,
    `## files`,
    ``,
  ];
  for (const r of ok) {
    const names = (r.files || []).map((f) => f.filename).join(", ");
    lines.push(`- \`${r.subject}\` → \`${path.relative(stepRoot, r.dest).replace(/\\/g, "/")}/\` (${names})`);
  }
  for (const r of failed) {
    lines.push(`- FAILED \`${r.subject}\`: ${r.error}`);
  }
  await fs.writeFile(path.join(stepRoot, "output.md"), lines.join("\n") + "\n");
  await fs.writeFile(
    path.join(stepRoot, "meta.md"),
    `# meta\n\n- status: ${failed.length ? "partial_or_failed" : "images_ready"}\n- ok: ${ok.length}\n- failed: ${failed.length}\n- at: ${now()}\n`,
  );

  const next = { ...params };
  next.images_generated = failed.length === 0 && ok.length > 0;
  next.status = failed.length ? "partial_or_failed" : ok.length ? "images_ready" : params.status;
  next.last_cli_run_at = now();
  next.cli = "scripts/ep01-cli.mjs";
  await fs.writeFile(path.join(stepRoot, "params.json"), JSON.stringify(next, null, 2));
}

async function runStep03({ episode, version, onlySubject, dry, seed, ckpt }) {
  const stepDir = STEP_DIR["03"];
  const stepRoot = path.join(REPO_ROOT, "assets", episode, stepDir, version);
  const promptPath = path.join(stepRoot, "prompt.md");
  const paramsPath = path.join(stepRoot, "params.json");
  const promptMd = await fs.readFile(promptPath, "utf8");
  const params = JSON.parse(await fs.readFile(paramsPath, "utf8"));
  const { styleLock, negative, subjects: parsed } = parsePromptPack(promptMd);
  let list = flattenSubjects(params);
  if (!list.length) list = [...parsed.keys()];
  if (onlySubject) list = list.filter((s) => s === onlySubject);
  if (!list.length) throw new Error("no subjects to generate (check params.json subjects_planned / --subject)");

  const { graph } = await loadWorkflow(ckpt);
  const results = [];
  for (const subjectId of list) {
    const body = parsed.get(subjectId) || `comic asset sheet for ${subjectId}, consistent design, vertical composition`;
    const positive = buildPositive(styleLock, subjectId, body);
    const destDir = path.join(stepRoot, "outputs", subjectId);
    const subSeed = seed != null ? Number(seed) + results.length : undefined;
    try {
      console.error(`[03] generating ${subjectId} ...`);
      const r = await generateOne({
        graph,
        subjectId,
        positive,
        negative,
        seed: subSeed,
        destDir,
        dry,
      });
      results.push(r);
      console.error(`[03] ok ${subjectId}`);
    } catch (e) {
      console.error(`[03] FAIL ${subjectId}: ${e.message || e}`);
      results.push({ subject: subjectId, error: String(e.message || e), dest: destDir });
    }
  }
  if (!dry) await updateStepMeta(stepRoot, results, params);
  return { step: "03", episode, version, results };
}

async function runStep04({ episode, version, onlySubject, dry, seed, ckpt }) {
  const stepDir = STEP_DIR["04"];
  const stepRoot = path.join(REPO_ROOT, "assets", episode, stepDir, version);
  const promptMd = await fs.readFile(path.join(stepRoot, "prompt.md"), "utf8");
  const params = JSON.parse(await fs.readFile(path.join(stepRoot, "params.json"), "utf8"));
  const { styleLock, negative, subjects } = parseKeyframes(promptMd);

  // prerequisite: at least one 03 output
  const assets03 = path.join(REPO_ROOT, "assets", episode, "03-assets", version, "outputs");
  let has03 = false;
  try {
    const ents = await fs.readdir(assets03);
    has03 = ents.length > 0;
  } catch {
    has03 = false;
  }
  if (!has03 && !dry) {
    throw new Error(`step 04 needs step 03 outputs under assets/${episode}/03-assets/${version}/outputs/ — run step 03 first`);
  }

  let list = [...subjects.keys()];
  if (onlySubject) list = list.filter((s) => s === onlySubject || s === `S${onlySubject}`);
  const { graph } = await loadWorkflow(ckpt);
  const results = [];
  for (const shotId of list) {
    const body = subjects.get(shotId);
    const positive = buildPositive(styleLock, shotId, body);
    const destDir = path.join(stepRoot, "outputs", shotId);
    const subSeed = seed != null ? Number(seed) + results.length : undefined;
    try {
      console.error(`[04] generating ${shotId} ...`);
      const r = await generateOne({
        graph,
        subjectId: shotId,
        positive,
        negative,
        seed: subSeed,
        destDir,
        dry,
      });
      results.push(r);
      console.error(`[04] ok ${shotId}`);
    } catch (e) {
      console.error(`[04] FAIL ${shotId}: ${e.message || e}`);
      results.push({ subject: shotId, error: String(e.message || e), dest: destDir });
    }
  }
  if (!dry) await updateStepMeta(stepRoot, results, params);
  return { step: "04", episode, version, results };
}

async function ensureStepScaffold(stepRoot, step, episode, version, extraParams = {}) {
  await fs.mkdir(path.join(stepRoot, "outputs"), { recursive: true });
  const promptPath = path.join(stepRoot, "prompt.md");
  const paramsPath = path.join(stepRoot, "params.json");
  const metaPath = path.join(stepRoot, "meta.md");
  const outputMd = path.join(stepRoot, "output.md");

  if (!(await pathExists(promptPath))) {
    await fs.writeFile(
      promptPath,
      `# ${episode} / step ${step} / ${version}\n\nScaffold only. Real prompts land here when generation is wired.\n`,
    );
  }
  if (!(await pathExists(paramsPath))) {
    await fs.writeFile(
      paramsPath,
      JSON.stringify(
        {
          episode,
          step: STEP_DIR[step],
          version,
          status: "dry_run_scaffold",
          images_generated: false,
          real_generation: false,
          cli: "scripts/ep01-cli.mjs",
          created_at: now(),
          ...extraParams,
        },
        null,
        2,
      ) + "\n",
    );
  }
  if (!(await pathExists(metaPath))) {
    await fs.writeFile(
      metaPath,
      `# meta\n\n- status: dry_run_scaffold\n- note: placeholder archive for 04–07 handoff; NOT real generation\n- at: ${now()}\n`,
    );
  }
  if (!(await pathExists(outputMd))) {
    await fs.writeFile(
      outputMd,
      `# output\n\n- status: dry_run_scaffold\n- files: (none — awaiting real generation or manual drop)\n`,
    );
  }
}

async function runStepStub(step, episode, version, { dry = false } = {}) {
  const stepDir = STEP_DIR[step];
  const stepRoot = path.join(REPO_ROOT, "assets", episode, stepDir, version);
  const msg = {
    "05": "step 05 (video clips) needs Seedance/Kling/Wan glue + keys — not wired for local one-click yet. Place clips under assets/.../05-clips/<ver>/outputs/ manually or wait for video adapter.",
    "06": "step 06 (voice+sub) needs ElevenLabs (or local TTS) — not wired. Put VO/SRT under assets/.../06-voice-sub/<ver>/ when ready.",
    "07": "step 07 (final edit) needs local edit tool / ffmpeg pipeline — not wired. Export 9:16 final into assets/.../07-final/<ver>/ after maozh2 locks duration/resolution.",
  };

  if (dry) {
    await ensureStepScaffold(stepRoot, step, episode, version, {
      handoff: "docs/EP01-GPU-AGENT-HANDOFF.md",
      detail: msg[step],
    });
    // refresh meta to mark this dry-run pass
    await fs.writeFile(
      path.join(stepRoot, "meta.md"),
      `# meta\n\n- status: dry_run_scaffold\n- note: ep01-cli --dry-run scaffold; not real generation\n- at: ${now()}\n`,
    );
    return {
      step,
      episode,
      version,
      status: "dry_run_scaffold",
      real_generation: false,
      detail: msg[step],
      archive: path.relative(REPO_ROOT, stepRoot).replace(/\\/g, "/") + "/",
    };
  }

  return {
    step,
    episode,
    version,
    status: "not_implemented",
    detail: msg[step],
    archive_hint: `assets/${episode}/${stepDir}/${version}/`,
  };
}

async function pause(msg) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise((resolve) => rl.question(msg, () => { rl.close(); resolve(); }));
}

async function cmdRun() {
  await ensureBaseUrl(arg("base-url"));
  const episode = arg("episode", "EP-01");
  const version = arg("version", "v1");
  const onlySubject = arg("subject");
  const dry = flag("dry-run");
  const seed = arg("seed");
  const ckpt = arg("ckpt");
  const pauseEach = flag("pause-each-step");

  let from = arg("from");
  let to = arg("to");
  const step = arg("step");
  if (step) {
    from = step;
    to = step;
  }
  if (!from) {
    usage();
    process.exit(2);
  }
  to = to || from;

  const order = ["03", "04", "05", "06", "07"];
  const start = order.indexOf(String(from).padStart(2, "0").slice(-2));
  const end = order.indexOf(String(to).padStart(2, "0").slice(-2));
  if (start < 0 || end < 0 || end < start) {
    console.error("invalid --step/--from/--to; use 03..07");
    process.exit(2);
  }

  if (!dry && ["03", "04"].some((_, i) => order[start + i] && order.indexOf(order[start]) <= order.indexOf("04"))) {
    // only health-check when we will hit comfy steps
    const needComfy = order.slice(start, end + 1).some((s) => s === "03" || s === "04");
    if (needComfy) {
      const h = await comfy.health();
      console.error("[doctor]", h);
      if (h.status !== "ok") {
        console.error("ComfyUI not ready. Start local ComfyUI and set COMFYUI_BASE_URL. See docs/EP01-LOCAL-GPU-RUN.md");
        process.exit(1);
      }
    }
  }

  const summary = [];
  for (let i = start; i <= end; i++) {
    const s = order[i];
    let result;
    if (s === "03") result = await runStep03({ episode, version, onlySubject, dry, seed, ckpt });
    else if (s === "04") result = await runStep04({ episode, version, onlySubject, dry, seed, ckpt });
    else result = await runStepStub(s, episode, version, { dry });
    summary.push(result);
    console.log(JSON.stringify(result, null, 2));
    if (pauseEach && i < end) {
      await pause(`\n[checkpoint] step ${s} done — review outputs, then press Enter for next (or Ctrl+C to stop)... `);
    }
  }

  if (dry) {
    console.error(`[dry-run] ok steps ${from}→${to}; no real media written as final. See docs/EP01-GPU-AGENT-HANDOFF.md`);
    process.exit(0);
  }

  // honest: single-step stub without dry-run exits 2 (not implemented)
  if (from === to && ["05", "06", "07"].includes(String(from))) process.exit(2);
  if ((summary[0]?.results || []).every((x) => x?.error)) process.exit(1);
  process.exit(0);
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === "-h" || cmd === "--help") {
    usage();
    process.exit(cmd ? 0 : 2);
  }
  if (cmd === "doctor") return cmdDoctor();
  if (cmd === "handoff-check") return cmdHandoffCheck();
  if (cmd === "run") return cmdRun();
  console.error(`unknown command: ${cmd}`);
  usage();
  process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
