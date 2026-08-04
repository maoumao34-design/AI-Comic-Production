// platforms/compose.mjs — 后期合成入口（步骤 07：ffmpeg 等本机工具）
// MVP：入口 + 健康检查；未装工具如实 unconfigured/degraded。

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function health() {
  const bin = (process.env.FFMPEG_PATH || "ffmpeg").trim();
  try {
    const { stdout, stderr } = await execFileAsync(bin, ["-version"], { timeout: 5000 });
    const line = String(stdout || stderr || "").split(/\r?\n/)[0] || "ffmpeg present";
    return { status: "ok", detail: `local_compose: ${line.slice(0, 120)}` };
  } catch (e) {
    return {
      status: "unconfigured",
      detail: `ffmpeg 不可用（${e?.message || e}）。设 FFMPEG_PATH 或安装到 PATH；步骤 07 入口已保留`,
    };
  }
}

export async function submit() {
  throw Object.assign(new Error("compose submit not_implemented"), { code: "not_implemented" });
}
export function record() {
  throw Object.assign(new Error("compose record not_implemented"), { code: "not_implemented" });
}
export async function poll() {
  throw Object.assign(new Error("compose poll not_implemented"), { code: "not_implemented" });
}
export async function recover() {
  throw Object.assign(new Error("compose recover not_implemented"), { code: "not_implemented" });
}
export async function retry() {
  throw Object.assign(new Error("compose retry not_implemented"), { code: "not_implemented" });
}
