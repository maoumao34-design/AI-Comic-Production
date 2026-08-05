#!/usr/bin/env node
// Smoke: SELECT-VERSION-CONTRACT §3 / §6 BE — multi-version select, gates, audit.
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createEpisode, startRun, submitDecision, selectVersion,
  getStepCurrent, listStepVersions, getRun, META,
} from "../engine.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
  console.log("  ✓", msg);
}

const id = "EP-SV-" + Math.random().toString(36).slice(2, 6);
createEpisode({ episode_id: id, title: "select-version smoke" });
const started = await startRun(id, {});
const runId = started.run_id;

// 01: v1 → regenerate ×2 → v3 current
assert(getStepCurrent(id, "01")?.version === "v1", "start current=v1");
await submitDecision(id, "01", { action: "regenerate", params_override: { seed: 2 } });
assert(getStepCurrent(id, "01")?.version === "v2", "after regen current=v2");
await submitDecision(id, "01", { action: "regenerate", params_override: { seed: 3 } });
assert(getStepCurrent(id, "01")?.version === "v3", "after regen current=v3");

const versionsBefore = listStepVersions(id, "01");
assert(versionsBefore.length === 3, `3 versions (got ${versionsBefore.length})`);
const isLatestSnap = Object.fromEntries(versionsBefore.map((v) => [v.version, !!v.is_latest]));
assert(Object.values(isLatestSnap).every((x) => x === false), "no is_latest before approve");

const latestPath = path.join(META.ASSETS_DIR, id, META.STEP_DIR["01"], "latest", "README.md");
let latestBefore = null;
try { latestBefore = await fs.readFile(latestPath, "utf8"); } catch { /* optional */ }

// 选用 v1
const sel = await selectVersion(id, "01", { version: "v1", note: "回看初稿", operator: "maozh2" });
assert(sel.current_version === "v1", `select → current_version=v1 (got ${sel.current_version})`);
assert(sel.current_step === "01", `select does not change step (got ${sel.current_step})`);
assert(sel.status === "paused_at_checkpoint", `run still paused_at_checkpoint (got ${sel.status})`);

const cur = getStepCurrent(id, "01");
assert(cur?.version === "v1", `GET current = v1 (got ${cur?.version})`);
assert(cur?.status === "awaiting_review", `selected v1 awaiting_review (got ${cur?.status})`);

const versionsAfter = listStepVersions(id, "01");
assert(versionsAfter.length === 3, `still 3 versions after select (got ${versionsAfter.length})`);
for (const v of versionsAfter) {
  assert(!!v.is_latest === isLatestSnap[v.version], `is_latest unchanged for ${v.version}`);
}
const v3 = versionsAfter.find((v) => v.version === "v3");
assert(v3.status === "superseded", `old current v3 superseded (got ${v3.status})`);

for (const ver of ["v1", "v2", "v3"]) {
  await fs.access(path.join(META.ASSETS_DIR, id, META.STEP_DIR["01"], ver));
}
assert(true, "disk v1/v2/v3 dirs intact");
if (latestBefore != null) {
  const latestAfter = await fs.readFile(latestPath, "utf8");
  assert(latestAfter === latestBefore, "latest/ README unchanged by select");
}

const hist = cur.decision_history || [];
const last = hist[hist.length - 1];
assert(last?.action === "select_version", `audit action=select_version (got ${last?.action})`);
assert(last?.from === "v3" && last?.to === "v1", "audit from=v3 to=v1");
const metaTxt = await fs.readFile(path.join(META.ASSETS_DIR, id, META.STEP_DIR["01"], "v1", "meta.md"), "utf8");
assert(metaTxt.includes("select_version from=v3 to=v1"), "meta.md has select_version line");

// 同版幂等
const again = await selectVersion(id, "01", { version: "v1" });
assert(again.current_version === "v1", "idempotent same version → 200");
const hist2 = getStepCurrent(id, "01").decision_history;
assert(hist2.filter((d) => d.action === "select_version").length === 1, "idempotent skips extra audit");

let miss = false;
try { await selectVersion(id, "01", { version: "v99" }); } catch (e) { miss = e.status === 404; }
assert(miss, "missing version → 404");

let latestPseudo = false;
try { await selectVersion(id, "01", { version: "latest" }); } catch (e) { latestPseudo = e.status === 404; }
assert(latestPseudo, "version=latest → 404");

// approve 01 → 02；对 01 选用 → 错步 409
await submitDecision(id, "01", { action: "approve" });
assert(getStepCurrent(id, "02")?.status === "awaiting_review", "02 awaiting after approve 01");
let wrongStep = false;
try { await selectVersion(id, "01", { version: "v1" }); } catch (e) { wrongStep = e.status === 409; }
assert(wrongStep, "select on non-current step → 409");

// running → 409
const active = getRun(runId);
active.steps["02"].status = "running";
let runningBlocked = false;
try { await selectVersion(id, "02", { version: "v1" }); } catch (e) { runningBlocked = e.status === 409; }
assert(runningBlocked, "select while running → 409");
active.steps["02"].status = "awaiting_review";

// 02: regen → select v1 → approve（DecisionBar 打在选用版）
await submitDecision(id, "02", { action: "regenerate" });
assert(getStepCurrent(id, "02")?.version === "v2", "02 current=v2");
await selectVersion(id, "02", { version: "v1" });
assert(getStepCurrent(id, "02")?.version === "v1", "02 select back to v1");
const afterApprove = await submitDecision(id, "02", { action: "approve" });
assert(afterApprove.current_step === "03", `approve selected v1 → 03 (got ${afterApprove.current_step})`);
const v02 = listStepVersions(id, "02");
assert(v02.find((v) => v.version === "v1")?.is_latest === true, "approve selected v1 → is_latest");
assert(v02.find((v) => v.version === "v2")?.is_latest === false, "v2 not latest");

console.log("\nSMOKE select-version PASSED");
