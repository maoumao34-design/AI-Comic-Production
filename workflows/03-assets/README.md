# Step 03 workflows

- `character-sheet.api.json` — RealVisXL 文生图（角色/场景/道具）。引擎默认。
- FaceID / IP-Adapter：已安装 `ComfyUI/custom_nodes/ComfyUI_IPAdapter_plus`。  
  还需下载权重到：
  - `models/ipadapter/`（如 `ip-adapter-faceid-plusv2_sdxl.bin`）
  - `models/clip_vision/`（对应 vision encoder）
  - `models/insightface/`（buffalo_l）  
  就绪后可再加 `face-lock.api.json`；当前一致性靠「先出角色表 → 04 img2img 引用」。

栈说明：`docs/PRODUCTION-STACK.md`
