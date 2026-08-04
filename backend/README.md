# AI 漫剧可视化产品 · 后端（MVP 骨架）

> owner：ComfyUI 平台集成工程师（后端）。对齐 [`docs/BACKEND-API-CONTRACT.md`](../docs/BACKEND-API-CONTRACT.md) v0.2。
> **零依赖**（纯 Node ESM，Node ≥20）。步骤产物默认**占位**；ComfyUI 已接真实探活与本机出图脚本（见 [`docs/LOCAL-GPU-RUNBOOK.md`](../docs/LOCAL-GPU-RUNBOOK.md)）。

## 跑起来
```bash
cd backend
node server.mjs            # 默认 http://127.0.0.1:8000
# 可选环境变量： PORT / HOST / ASSETS_DIR / FAIL_THRESHOLD
# Comfy：COMFYUI_BASE_URL=http://127.0.0.1:8188（本地）或 Cloud URL + COMFYUI_API_KEY
```
无 `npm install`，直接 `node server.mjs` 即起。

本机 GPU 出图（步骤 03）：
```bash
set COMFYUI_BASE_URL=http://127.0.0.1:8188
node scripts/comfy-health.mjs
node scripts/comfy-run-workflow.mjs --workflow ../workflows/03-assets/character-sheet.api.json --episode EP-01 --step 03 --subject char-heiress
```

## 它实现了什么（MVP 闭环）
- **7 步状态机**（01剧本→02分镜→03资产→04关键帧→05分段视频→06配音字幕→07成片）
- **4 个 decision**（总控定稿）：`approve`✅推进 / `revise`✏️带意见重跑当前步 / `regenerate`🔄换参重跑当前步 / `rollback`↩️回上一步（仅 approve 推进）
- **版本归档**：`data/assets/<集号>/<步骤>/<版本>/{prompt.md,params.json,refs/,output.*,meta.md}` + `latest` 指针
- **失败/重试**：超 `FAIL_THRESHOLD`(默认3) → `paused`（escalation，不无限重跑）
- **占位产物**：每步生成一个 `output.json`（含该步 content 结构示意），真实平台未接

## 端点（`/api/v1`）
| 方法 路径 | 说明 |
|---|---|
| `GET /` | 服务信息 |
| `GET /episodes` · `POST /episodes` · `GET /episodes/{id}` | 集管理 |
| `POST /episodes/{id}/runs` `{inputs?}` | 启动/继续流水线（跑当前步到 awaiting_review） |
| `GET /runs/{id}` | run 状态 + 各步进度 |
| `GET /episodes/{id}/steps/{step}/current` | 当前步 latest 版本（要 review 的） |
| `GET /episodes/{id}/steps/{step}/versions` · `/{version}` | 版本浏览 |
| `POST /episodes/{id}/steps/{step}/decision` `{action,note?,params_override?}` | ✅✏️🔄↩️（唯一推进入口） |
| `GET /health/platforms` | 平台连接健康（Comfy：按 env 真实探活；其它未配置则 unconfigured） |
| `GET /queue` | 近期任务（可观测） |
| `GET /artifacts?path=<集号>/<步骤>/<版本>/<文件>` | 取产物 |

> CORS 已放开（前端 dev 跨端口直连）。

## 冒烟测试（一次完整循环）
```bash
BASE=http://127.0.0.1:8000/api/v1
# 1) 建集 + 起 run（自动跑到 01 awaiting_review）
curl -s -X POST $BASE/episodes -H 'Content-Type: application/json' -d '{"episode_id":"EP-01","title":"第1集"}'
curl -s -X POST $BASE/episodes/EP-01/runs -d '{}'
# 2) 看当前步
curl -s $BASE/episodes/EP-01/steps/01/current
# 3) ✅ 推进 → 自动跑 02
curl -s -X POST $BASE/episodes/EP-01/steps/01/decision -H 'Content-Type: application/json' -d '{"action":"approve"}'
# 4) 🔄 换参重跑当前步 / ✏️ 带意见重跑 / ↩️ 回上一步
curl -s -X POST $BASE/episodes/EP-01/steps/02/decision -d '{"action":"regenerate","params_override":{"seed":999}}'
curl -s -X POST $BASE/episodes/EP-01/steps/02/decision -d '{"action":"revise","note":"镜头 1 再紧凑"}'
curl -s $BASE/episodes/EP-01/steps/02/versions
```

## 目录
```
backend/
  server.mjs              HTTP 路由（零依赖 http）
  engine.mjs              状态机 + 归档 + 占位生成 + decision 逻辑
  platforms/comfyui.mjs   ComfyUI 五件套（submit/record/poll/recover/retry）+ health
  scripts/comfy-*.mjs     本机健康检查 / 工作流出图归档
  .env.example            COMFYUI_* 示例（勿提交真实 Key）
  data/assets/            运行时产物（gitignore，不提交）
```

## 接真实平台
- **ComfyUI**：已实现 `platforms/comfyui.mjs`；本机用 `COMFYUI_BASE_URL=http://127.0.0.1:8188`，Cloud 另需 `COMFYUI_API_KEY`。详见 `docs/LOCAL-GPU-RUNBOOK.md`。
- **视频模型 / ElevenLabs**：仍待 key；health 如实 unconfigured。key 走 env/`custom_env`，不进代码。
