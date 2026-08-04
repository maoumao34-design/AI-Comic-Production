#!/usr/bin/env node
// 本机：提交 Comfy 工作流 → 轮询 → 下载 → 归档到 data/assets/<ep>/<step>/vN/
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as comfy from "../platforms/comfyui.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "..");
const ASSETS = process.env.ASSETS_DIR
  ? path.resolve(process.env.ASSETS_DIR)
  : path.join(BACKEND_ROOT, "data", "assets");

const STEP_DIR = {
  "03": "03-assets", "04": "04-keyframes", "05": "05-clips",
};

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}
function flag(name) {
  return process.argv.includes(`--${name}`);
}

function now() { return new Date().toISOString(); }

async function nextVersion(ep, stepDir) {
  const base = path.join(ASSETS, ep, stepDir);
  await fs.mkdir(base, { recursive: true });
  const ents = await fs.readdir(base).catch(() => []);
  const nums = ents.filter((e) => /^v\d+$/.test(e)).map((e) => Number(e.slice(1)));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `v${n}`;
}

async function main() {
  const workflowPath = path.resolve(arg("workflow", path.join(BACKEND_ROOT, "..", "workflows", "03-assets", "character-sheet.api.json")));
  const episode = arg("episode", "EP-01");
  const step = arg("step", "03");
  const subject = arg("subject", "char-heiress");
  const seed = arg("seed", null);
  const positive = arg("positive", null);
  const negative = arg("negative", null);
  const dry = flag("dry-run");

  const stepDir = STEP_DIR[step];
  if (!stepDir) {
    console.error(`unsupported step ${step}; use 03/04/05`);
    process.exit(2);
  }

  const raw = JSON.parse(await fs.readFile(workflowPath, "utf8"));
  const { _meta, ...workflow } = raw;
  let graph = structuredClone(workflow);
  if (seed != null) {
    for (const node of Object.values(graph)) {
      if (node?.class_type?.startsWith?.("KSampler") && node.inputs) node.inputs.seed = Number(seed);
    }
  }
  if (positive != null) {
    for (const node of Object.values(graph)) {
      if (node?.class_type === "CLIPTextEncode" && node?.meta?.role === "positive" && node.inputs) {
        node.inputs.text = positive;
      }
    }
  }
  if (negative != null) {
    for (const node of Object.values(graph)) {
      if (node?.class_type === "CLIPTextEncode" && node?.meta?.role === "negative" && node.inputs) {
        node.inputs.text = negative;
      }
    }
  }

  const posText = positive || raw?.["4"]?.inputs?.text || "";
  const paramsSeed = seed != null ? Number(seed) : (raw?.["7"]?.inputs?.seed ?? null);

  if (dry) {
    console.log(JSON.stringify({ dry_run: true, episode, step, subject, workflowPath, seed: paramsSeed, positive: posText.slice(0, 120), meta: _meta || null }, null, 2));
    return;
  }

  const h = await comfy.health();
  console.log("[health]", h);
  if (h.status !== "ok") {
    console.error("ComfyUI 未就绪。先设 COMFYUI_BASE_URL 并启动 ComfyUI，见 docs/LOCAL-GPU-RUNBOOK.md");
    process.exit(1);
  }

  // 提交前去掉 meta（Comfy 不需要）
  for (const node of Object.values(graph)) {
    if (node && node.meta) delete node.meta;
  }

  const job = await comfy.submit(graph);
  console.log("[submit]", job);
  const done = await comfy.wait(job.job_id);
  console.log("[wait]", { status: done.status, error: done.error || null, images: comfy.listOutputImages(done.outputs || {}).length });
  if (done.status !== "completed") {
    console.error("生成失败:", done.error || done);
    process.exit(1);
  }

  const version = await nextVersion(episode, stepDir);
  const dest = path.join(ASSETS, episode, stepDir, version);
  await fs.mkdir(dest, { recursive: true });
  await fs.mkdir(path.join(dest, "refs"), { recursive: true });

  const recovered = await comfy.recover(job.job_id, dest, { prefix: `output-${subject}` });
  const rec = comfy.record(job, {
    episode_id: episode,
    step,
    subject_id: subject,
    seed: paramsSeed,
    workflow: path.relative(BACKEND_ROOT, workflowPath).replace(/\\/g, "/"),
    model: raw?.["3"]?.inputs?.ckpt_name || null,
  });

  await fs.writeFile(path.join(dest, "prompt.md"), `# ${episode} step ${step} · ${subject}\n\n## positive\n\n${posText}\n`);
  await fs.writeFile(path.join(dest, "params.json"), JSON.stringify(rec, null, 2));
  await fs.writeFile(
    path.join(dest, "meta.md"),
    `# meta\n\n- platform: comfyui\n- job_id: ${job.job_id}\n- subject: ${subject}\n- seed: ${paramsSeed}\n- files: ${(recovered.files || []).map((f) => f.filename).join(", ")}\n- at: ${now()}\n`,
  );
  await fs.writeFile(
    path.join(dest, "output.json"),
    JSON.stringify({
      episode_id: episode,
      step,
      version,
      content: {
        assets: [{
          asset_id: subject,
          kind: "character_three_view",
          label: subject,
          files: (recovered.files || []).map((f) => f.filename),
        }],
      },
      params: rec,
    }, null, 2),
  );

  const latestDir = path.join(ASSETS, episode, stepDir, "latest");
  await fs.mkdir(latestDir, { recursive: true });
  await fs.writeFile(path.join(latestDir, "README.md"), `# latest\n\n→ ${version}\n\nrecovered at ${now()}\n`);

  console.log(JSON.stringify({
    ok: true,
    archive: `${episode}/${stepDir}/${version}/`,
    abs: dest,
    files: recovered.files,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
