// server.mjs — 可视化产品后端 HTTP 层（零依赖 Node ESM）。
// 实现 BACKEND-API-CONTRACT v0.2 的 REST 端点。启动：node server.mjs
import { createServer } from "node:http";
import * as api from "./engine.mjs";

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "127.0.0.1";

function send(res, status, body, headers = {}) {
  const h = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers,
  };
  res.writeHead(status, h);
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function json(res, status, obj) { send(res, status, obj, { "Content-Type": "application/json; charset=utf-8" }); }
function fail(res, status, message, detail) { json(res, status, { error: { code: status, message, detail: detail || null } }); }

async function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

const server = createServer(async (req, res) => {
  const u = new URL(req.url, `http://${HOST}`);
  const p = u.pathname.replace(/\/+$/, "") || "/";
  const m = req.method;
  const seg = p.split("/").filter(Boolean); // e.g. ["api","v1","episodes","EP-01","steps","04","decision"]
  const Q = Object.fromEntries(u.searchParams);

  if (m === "OPTIONS") return send(res, 204, "");
  if (p === "/" || p === "/health") {
    return json(res, 200, { service: "ai-comic-visualization-backend", version: "0.3.0-mvp",
      contract: "docs/BACKEND-API-CONTRACT.md", base: "/api/v1", steps: api.META.STEPS.map((s) => s.id + "-" + s.name),
      assets_dir: api.META.ASSETS_DIR,
      platform_map: "/api/v1/pipeline/platforms" });
  }

  // 路由前缀 /api/v1
  if (seg[0] !== "api" || seg[1] !== "v1") return fail(res, 404, "not found", p);
  const r = seg.slice(2); // 去掉 api/v1

  try {
    // GET /episodes
    if (m === "GET" && r[0] === "episodes" && !r[1]) return json(res, 200, { episodes: api.listEpisodes() });
    // POST /episodes
    if (m === "POST" && r[0] === "episodes" && !r[1]) {
      const b = await readJsonBody(req);
      return json(res, 201, { episode: api.createEpisode(b) });
    }
    // GET /episodes/:id
    if (m === "GET" && r[0] === "episodes" && r[1] && !r[2]) {
      const e = api.getEpisode(r[1]); if (!e) return fail(res, 404, "episode not found");
      return json(res, 200, { episode: e });
    }
    // POST /episodes/:id/runs
    if (m === "POST" && r[0] === "episodes" && r[1] === "runs" && !r[2]) {
      // 注意：/episodes/:id/runs → r = ["episodes", :id, "runs"]
    }
    if (m === "POST" && r[0] === "episodes" && r[2] === "runs" && !r[3]) {
      const b = await readJsonBody(req);
      const run = await api.startRun(r[1], { inputs: b.inputs || b });
      return json(res, 201, { run });
    }
    // GET /runs/:id
    if (m === "GET" && r[0] === "runs" && r[1] && !r[2]) {
      const run = api.getRun(r[1]); if (!run) return fail(res, 404, "run not found");
      return json(res, 200, { run });
    }
    // GET /episodes/:id/steps/:step/current
    if (m === "GET" && r[0] === "episodes" && r[2] === "steps" && r[4] === "current" && !r[5]) {
      const v = await api.getStepCurrent(r[1], r[3]); if (!v) return fail(res, 404, "no current version");
      return json(res, 200, { version: v });
    }
    // GET /episodes/:id/steps/:step/versions
    if (m === "GET" && r[0] === "episodes" && r[2] === "steps" && r[4] === "versions" && !r[5]) {
      return json(res, 200, { versions: await api.listStepVersions(r[1], r[3]) });
    }
    // GET /episodes/:id/steps/:step/versions/:version
    if (m === "GET" && r[0] === "episodes" && r[2] === "steps" && r[4] === "versions" && r[5] && !r[6]) {
      const v = await api.getStepVersion(r[1], r[3], r[5]); if (!v) return fail(res, 404, "version not found");
      return json(res, 200, { version: v });
    }
    // POST /episodes/:id/steps/:step/decision
    if (m === "POST" && r[0] === "episodes" && r[2] === "steps" && r[4] === "decision" && !r[5]) {
      const b = await readJsonBody(req);
      if (!b.action) return fail(res, 400, "missing action", "approve|revise|regenerate|rollback");
      const result = await api.submitDecision(r[1], r[3], b);
      return json(res, 200, { result });
    }
    // POST /episodes/:id/steps/:step/select-version — 选用旧版（审阅指针；≠ rollback）
    if (m === "POST" && r[0] === "episodes" && r[2] === "steps" && r[4] === "select-version" && !r[5]) {
      const b = await readJsonBody(req);
      if (!b.version) return fail(res, 400, "missing version", "body.version required (e.g. v2)");
      const result = await api.selectVersion(r[1], r[3], b);
      return json(res, 200, { result });
    }
    // GET /health/platforms
    if (m === "GET" && r[0] === "health" && r[1] === "platforms" && !r[2]) {
      return json(res, 200, await api.health());
    }
    // GET /pipeline/platforms — 每步平台接入槽（FE / 接手 agent）
    if (m === "GET" && r[0] === "pipeline" && r[1] === "platforms" && !r[2]) {
      return json(res, 200, api.getPlatformMap());
    }
    // GET /series — 已知系列 ID 列表
    if (m === "GET" && r[0] === "series" && !r[1]) {
      return json(res, 200, { series: await api.listSeriesIds() });
    }
    // GET /series/:id/consistency — 系列锁定资产包（跨集参考）
    if (m === "GET" && r[0] === "series" && r[1] && r[2] === "consistency" && !r[3]) {
      return json(res, 200, { pack: await api.getSeriesPack(r[1]) });
    }
    // GET /series/consistency — 默认系列
    if (m === "GET" && r[0] === "series" && r[1] === "consistency" && !r[2]) {
      return json(res, 200, { pack: await api.getSeriesPack() });
    }
    // GET /episodes/:id/series-refs — 本集所属系列的锁定参考
    if (m === "GET" && r[0] === "episodes" && r[2] === "series-refs" && !r[3]) {
      return json(res, 200, { pack: await api.getEpisodeSeriesRefs(r[1]) });
    }
    // PATCH/POST /episodes/:id/series — 改本集所属系列
    if ((m === "POST" || m === "PATCH") && r[0] === "episodes" && r[2] === "series" && !r[3]) {
      const b = await readJsonBody(req);
      if (!b.series_id) return fail(res, 400, "missing series_id");
      return json(res, 200, { episode: api.setEpisodeSeries(r[1], b.series_id) });
    }
    // POST /episodes 已支持 body.series_id（见 createEpisode）
    // GET /episodes/:id/steps/:step/archive — 磁盘归档树（含 outputs/）
    if (m === "GET" && r[0] === "episodes" && r[2] === "steps" && r[4] === "archive" && !r[5]) {
      return json(res, 200, await api.listArchiveTree(r[1], r[3]));
    }
    // GET /queue
    if (m === "GET" && r[0] === "queue" && !r[1]) return json(res, 200, { queue: api.queueView() });

    // GET /artifacts?path=<rel>
    if (m === "GET" && r[0] === "artifacts" && !r[1]) {
      if (!Q.path) return fail(res, 400, "missing ?path=");
      const f = await api.artifact(Q.path);
      if (!f) return fail(res, 404, "artifact not found", Q.path);
      const lower = Q.path.toLowerCase();
      let ct = "application/octet-stream";
      if (lower.endsWith(".json")) ct = "application/json; charset=utf-8";
      else if (lower.endsWith(".png")) ct = "image/png";
      else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) ct = "image/jpeg";
      else if (lower.endsWith(".webp")) ct = "image/webp";
      else if (lower.endsWith(".mp4")) ct = "video/mp4";
      else if (lower.endsWith(".mp3") || lower.endsWith(".wav")) ct = "audio/mpeg";
      else if (lower.endsWith(".md") || lower.endsWith(".txt")) ct = "text/plain; charset=utf-8";
      return send(res, 200, f.buf, { "Content-Type": ct, "Cache-Control": "public, max-age=60" });
    }

    return fail(res, 404, "route not found", p);
  } catch (e) {
    const status = e?.status || 500;
    return fail(res, status, e?.message || "internal error", e?.detail || (process.env.NODE_ENV !== "production" ? String(e?.stack || e) : null));
  }
});

async function main() {
  try {
    // 重启恢复：集列表 / 当前步 / 审阅指针 / 决策 / 系列（assets/index.json + <ep>/episode.json）
    await api.loadWorkspace();
  } catch (e) {
    console.warn("[backend] loadWorkspace failed:", e?.message || e);
  }
  server.listen(PORT, HOST, () => {
    console.log(`[backend] AI 漫剧可视化产品后端 listening on http://${HOST}:${PORT}/api/v1`);
    console.log(`[backend] contract: docs/BACKEND-API-CONTRACT.md | assets: ${api.META.ASSETS_DIR}`);
    console.log(`[backend] 平台槽: GET /api/v1/pipeline/platforms ；健康: GET /api/v1/health/platforms`);
    console.log(`[backend] 03/04：网页 🔄 重生 → ComfyUI 真实出图（需 COMFYUI_BASE_URL + COMFYUI_CKPT）`);
    console.log(`[backend] 工作区持久化: assets/index.json + assets/<集>/episode.json`);
  });
}
main();
