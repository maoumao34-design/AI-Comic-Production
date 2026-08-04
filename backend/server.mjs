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
      const v = api.getStepCurrent(r[1], r[3]); if (!v) return fail(res, 404, "no current version");
      return json(res, 200, { version: v });
    }
    // GET /episodes/:id/steps/:step/versions
    if (m === "GET" && r[0] === "episodes" && r[2] === "steps" && r[4] === "versions" && !r[5]) {
      return json(res, 200, { versions: api.listStepVersions(r[1], r[3]) });
    }
    // GET /episodes/:id/steps/:step/versions/:version
    if (m === "GET" && r[0] === "episodes" && r[2] === "steps" && r[4] === "versions" && r[5] && !r[6]) {
      const v = api.getStepVersion(r[1], r[3], r[5]); if (!v) return fail(res, 404, "version not found");
      return json(res, 200, { version: v });
    }
    // POST /episodes/:id/steps/:step/decision
    if (m === "POST" && r[0] === "episodes" && r[2] === "steps" && r[4] === "decision" && !r[5]) {
      const b = await readJsonBody(req);
      if (!b.action) return fail(res, 400, "missing action", "approve|revise|regenerate|rollback");
      const result = await api.submitDecision(r[1], r[3], b);
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
      const ct = Q.path.endsWith(".json") ? "application/json" : (Q.path.endsWith(".png") || Q.path.endsWith(".jpg") ? "application/octet-stream" : "text/plain; charset=utf-8");
      return send(res, 200, f.buf, { "Content-Type": ct });
    }

    return fail(res, 404, "route not found", p);
  } catch (e) {
    const status = e?.status || 500;
    return fail(res, status, e?.message || "internal error", e?.detail || (process.env.NODE_ENV !== "production" ? String(e?.stack || e) : null));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[backend] AI 漫剧可视化产品后端 (MVP) listening on http://${HOST}:${PORT}/api/v1`);
  console.log(`[backend] contract: docs/BACKEND-API-CONTRACT.md v0.2 | assets: ${api.META.ASSETS_DIR}`);
  console.log(`[backend] 平台槽: GET /api/v1/pipeline/platforms ；健康: GET /api/v1/health/platforms`);
  console.log(`[backend] 步骤产物默认占位；真实 Comfy 出图用 ep01-cli / comfy-run-workflow（CLI≠产品）。`);
});
