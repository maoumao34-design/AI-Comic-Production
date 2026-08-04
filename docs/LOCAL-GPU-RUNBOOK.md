# 本机 GPU 跑通指南（Local ComfyUI）

> 场景：运行时机器**没有**可达的远程 GPU / Comfy Cloud 付费 API；你在**另一台有显卡的机器**上 clone 本仓库，本机起 ComfyUI，用仓库 CLI 完成步骤 03/04 出图与归档。
>
> **首选入口**：[`docs/EP01-LOCAL-GPU-RUN.md`](./EP01-LOCAL-GPU-RUN.md)（内容包 + 验收 + `node scripts/ep01-cli.mjs`）。本文是底层胶水/单工作流调试补充。
>
> Owner：ComfyUI 平台集成工程师。密钥/路径只放本机环境变量，**不要贴群、不要提交仓库**。

## 0. 你需要什么

| 项 | 说明 |
|---|---|
| GPU 机器 | Windows/Linux，已装 NVIDIA 驱动 + 能跑 ComfyUI |
| Node.js | ≥ 20（跑 `backend/server.mjs` / 脚本） |
| 本仓库 | `git clone https://github.com/maoumao34-design/AI-Comic-Production`，建议 `main` 或已合并本 PR 的分支 |
| 检查点模型 | 放入 ComfyUI `models/checkpoints/`，并把工作流里的 `REPLACE_WITH_YOUR_CHECKPOINT.safetensors` 改成真实文件名 |

## 1. 起本地 ComfyUI

1. 安装/打开 [ComfyUI](https://github.com/comfyanonymous/ComfyUI)（或你常用的整合包）。
2. 启动后默认监听：`http://127.0.0.1:8188`。
3. 浏览器能打开 UI 即可；**不要**依赖我们这边的运行时去连你的内网 GPU。

## 2. 配置本仓库环境变量（本机 shell / `.env` 自行 export）

```bash
# 必填：指向本机 ComfyUI
set COMFYUI_BASE_URL=http://127.0.0.1:8188
# 本地一般不需要 Key；若你开了 Comfy 鉴权再设 COMFYUI_API_KEY

# 可选
set COMFYUI_POLL_MS=1500
set COMFYUI_TIMEOUT_MS=300000
```

PowerShell：

```powershell
$env:COMFYUI_BASE_URL = "http://127.0.0.1:8188"
```

> Comfy Cloud 路径仍可用：`COMFYUI_BASE_URL=https://cloud.comfy.org` + `COMFYUI_API_KEY`（需 Standard+；Free 无 API）。与本地二选一。

## 3. 健康检查（先过这一关）

```bash
cd backend
node scripts/comfy-health.mjs
```

期望：打印 `comfyui: ok` 且带 `local ok (http://127.0.0.1:8188)`。  
失败时脚本非 0 退出，并打印真实原因（连不上 / 模型目录无关，只看 HTTP 探活）。

同时也可起后端后访问：

```bash
node server.mjs
# 另开终端
curl http://127.0.0.1:8000/api/v1/health/platforms
```

未设 `COMFYUI_BASE_URL` → `comfyui.status=unconfigured`（诚实，不装成功）。  
已设且探活成功 → `ok`。

## 4. 改工作流模型名

编辑 [`workflows/03-assets/character-sheet.api.json`](../workflows/03-assets/character-sheet.api.json)：

- 节点 `3.inputs.ckpt_name` → 改成你 `models/checkpoints/` 里真实存在的文件名。

Prompt 文案见 [`prompts/EP-01/03-assets/PROMPT-PACK.md`](../prompts/EP-01/03-assets/PROMPT-PACK.md)。

## 5. 推荐：按内容包批量出 03（ep01-cli）

```bash
# 仓库根目录
set COMFYUI_BASE_URL=http://127.0.0.1:8188
node scripts/ep01-cli.mjs doctor
node scripts/ep01-cli.mjs run --episode EP-01 --step 03 --version v1 --ckpt your-model.safetensors
```

读入 `assets/EP-01/03-assets/v1/{prompt.md,params.json}`，按 `subjects_planned` 逐个出图，落到：

```
assets/EP-01/03-assets/v1/outputs/<subject_id>/output.png
```

并更新同目录 `meta.md` / `output.md` / `params.json`（`images_generated`）。

## 5b. 底层单次调试（comfy-run-workflow）

```bash
cd backend
node scripts/comfy-run-workflow.mjs ^
  --workflow ../workflows/03-assets/character-sheet.api.json ^
  --episode EP-01 ^
  --step 03 ^
  --subject char-serena ^
  --positive "comic character reference sheet of Serena, ..."
```

写入 `backend/data/assets/...`（调试用）。**正式归档以仓库根 `assets/EP-01/...` + ep01-cli 为准。**

## 6. 和可视化产品后端的关系

- `GET /health/platforms` 已接真实 Comfy 探活（见 `platforms/comfyui.mjs`）。
- 步骤 01–07 的 decision 状态机仍可用；**步骤 03 的「一键从 UI 真实出图」**可先用本脚本跑通归档，再把同一胶水接到 `engine.mjs` 的 `runStep`（后续迭代）。
- 视频模型 / ElevenLabs 仍 `unconfigured`，不影响本机先把 03 资产跑出来。

## 7. 验收清单（本机）

- [ ] ComfyUI `8188` 可开
- [ ] `node scripts/comfy-health.mjs` → ok
- [ ] 工作流 ckpt 名已替换且能出图
- [ ] `data/assets/EP-01/03-assets/vN/output*.png` 存在且可复现（params.json 含 job_id/seed/prompt）
- [ ] maozh2 checkpoint 人审通过后把该版本标 latest / 合入仓库

## 8. 常见失败

| 现象 | 处理 |
|---|---|
| health `down` / ECONNREFUSED | ComfyUI 没起，或端口不是 8188 |
| submit 报 checkpoint not found | 改 `ckpt_name` 或把模型放进 checkpoints |
| Cloud 401 | Free 档无 API，或 Key 错；本地路径不需要 Cloud |
| 运行时 agent 连不上你的 GPU 机 | **预期如此**——出图只在 GPU 本机做，产物用 git/文件回传 |
