#!/usr/bin/env node
// Smoke: approve 01→07 to done, then rollback 07 → 06 (打回). No GUI.
import { createEpisode, startRun, submitDecision, getStepCurrent, getEpisode, getRun } from "../engine.mjs";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT FAIL: " + msg);
  console.log("  ✓", msg);
}

const id = "EP-RB-" + Math.random().toString(36).slice(2, 6);
createEpisode({ episode_id: id, title: "rollback-done smoke" });
const run = await startRun(id, {});
assert(run.current_step === "01", `start @01`);

for (const step of ["01", "02", "03", "04", "05", "06", "07"]) {
  const cur = getStepCurrent(id, step);
  assert(cur?.status === "awaiting_review", `${step} awaiting_review before approve`);
  const r = await submitDecision(id, step, { action: "approve" });
  if (step === "07") {
    assert(r.status === "done" && r.current_step === "07", `07 approve → done (got ${r.status}@${r.current_step})`);
  } else {
    const next = String(Number(step) + 1).padStart(2, "0");
    assert(r.current_step === next, `approve ${step} → ${next}`);
  }
}

const epDone = getEpisode(id);
assert(epDone.status === "done", `episode done`);
const cur07 = getStepCurrent(id, "07");
assert(cur07.status === "approved", `07 version approved (got ${cur07.status})`);

// 成片后打回
const after = await submitDecision(id, "07", { action: "rollback" });
assert(after.current_step === "06", `rollback 07 → 06 (got ${after.current_step})`);
assert(after.status === "paused_at_checkpoint", `run reopened paused_at_checkpoint (got ${after.status})`);
const ep = getEpisode(id);
assert(ep.status === "in_progress", `episode in_progress after rollback (got ${ep.status})`);
const cur06 = getStepCurrent(id, "06");
assert(cur06.status === "awaiting_review", `06 back to awaiting_review (got ${cur06.status})`);
const cur07b = getStepCurrent(id, "07");
assert(cur07b.status === "superseded", `07 version superseded (got ${cur07b.status})`);

// approved 步上不可再 approve/revise
let blocked = false;
try { await submitDecision(id, "07", { action: "approve" }); } catch (e) { blocked = e.status === 409; }
assert(blocked, `approve on superseded/approved 07 → 409`);

// 01 不可 rollback
createEpisode({ episode_id: id + "-01", title: "first-step" });
await startRun(id + "-01", {});
let firstBlocked = false;
try { await submitDecision(id + "-01", "01", { action: "rollback" }); } catch (e) { firstBlocked = e.status === 409; }
assert(firstBlocked, `rollback on 01 → 409`);

console.log("\nSMOKE rollback-after-done PASSED");
