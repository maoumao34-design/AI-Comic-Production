#!/usr/bin/env node
// 探活 ComfyUI（本地或 Cloud）。exit 0=ok，1=unconfigured/down
import { health, isConfigured, LOCAL_DEFAULT_BASE } from "../platforms/comfyui.mjs";

const h = await health();
console.log(JSON.stringify({
  configured: isConfigured(),
  hint_local: LOCAL_DEFAULT_BASE,
  comfyui: h,
  env: {
    COMFYUI_BASE_URL: process.env.COMFYUI_BASE_URL ? "[set]" : "[missing]",
    COMFYUI_API_KEY: process.env.COMFYUI_API_KEY ? "[set]" : "[missing]",
  },
}, null, 2));

if (h.status !== "ok") process.exit(1);
