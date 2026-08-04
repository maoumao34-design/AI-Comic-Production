# EP-01 Local GPU Runbook（离线跑通）

> 目标：本机无 GPU / Cloud Free 无 API 时，在**有显卡的机器**上 `git clone` 本仓库，按归档 Prompt 顺序跑通 03→07。  
> 人审仍走 checkpoint：每步产物回传/贴群后，等 maozh2 ✅/✏️/↩️/🔄，不自动跳步。

## 0. 仓库里已备好的（无需云端）

| 步骤 | 路径 | 状态 |
|---|---|---|
| 01 剧本 | `assets/EP-01/01-script/v1/` | ✅ maozh2 已通过 |
| 02 分镜 | `assets/EP-01/02-storyboard/v1/` | ✅ maozh2 已通过（5 场 / 16 镜） |
| 03 Prompt 包 | `assets/EP-01/03-assets/v1/` | Prompt/params 已备；**图像待本地出** |
| 04 Prompt 草稿 | `assets/EP-01/04-keyframes/v1/` | 16 镜关键帧 Prompt 草稿（引用 03 subject） |
| 样片参考 | `references/07-样片-sample.mp4` | 画幅/节奏参考（9:16） |
| 剧本源 | `references/scripts/english-script.docx` | 制作权威（全英文） |

## 1. 本机环境（有 GPU 的机器）

1. Clone：`https://github.com/maoumao34-design/AI-Comic-Production`（含本 runbook 的分支/PR 合入后用 main，或先 checkout 该分支）。
2. 安装并启动 **本地 ComfyUI**（本机显卡）。
3. 配置本地入口（勿把 Key 提交进 git）：
   - `COMFYUI_BASE_URL=http://127.0.0.1:8188`（或你的本机端口）
   - 若胶水仍要 Key，可放空或用本地 dummy；**不要**把 Cloud API Key 写进仓库。
4. 使用仓库内 ComfyUI 工程师提供的胶水/工作流（`backend/` 或工程师文档）。若本地工作流 JSON 尚未合入，先在本机 ComfyUI 手工加载等价工作流，按下面清单出图，再把文件落到归档路径。

## 2. 跑通顺序

### Step 03 — 一致性资产（先出图）

输入：`assets/EP-01/03-assets/v1/prompt.md` + `params.json`  
必出清单（与 `params.json` → `subjects_planned` 一致）：

- Characters 三视图：`char/serena` · `char/james` · `char/amy` · `char/kate`
- Expressions：`expr/serena-controlled` · `expr/serena-steel` · `expr/serena-alone`
- Costumes：`costume/serena-villa-evening` · `costume/amy-campus` · `costume/kate-office`
- Scenes：`scene/villa-living` · `scene/campus` · `scene/prime-group-skyline` · `scene/kate-office` · `scene/villa-window-driveway`
- Props：`prop/scholarship-letter-100k` · `prop/bentley-keys-docs` · `prop/studio-share-papers` · `prop/wineglass-white-knuckle` · `prop/phone-split`

落盘建议：

```
assets/EP-01/03-assets/v1/outputs/<subject_id>/...
```

完成后更新同目录 `meta.md` / `output.md`，把图或截图交 maozh2 → **【CHECKPOINT 步骤 03】**。

### Step 04 — 关键帧

输入：`assets/EP-01/04-keyframes/v1/prompt.md`（S1–S16）+ 已锁定的 03 参考图。  
每镜至少 1 张关键帧；落盘 `assets/EP-01/04-keyframes/v1/outputs/S##/` → checkpoint。

### Step 05 — 分段视频

按分镜时长（约 5–12s/镜，总约 148s；若目标 60–90s 先 ✏️ 裁旁白）生成 4–15s 段；首尾帧对齐 04。  
落盘 `assets/EP-01/05-segments/v1/` → checkpoint。

### Step 06 — 配音字幕

旁白全文：`assets/EP-01/01-script/v1/output.md`（English VO）。  
TTS（ElevenLabs 或本机等价）+ 字幕 SRT；节奏对齐分镜 → checkpoint。

### Step 07 — 合成导出

剪辑拼接 / 字幕 / 音乐音效 / 调色；画幅 **9:16**；时长与分辨率导出前由 maozh2 锁定 → 成片 + checkpoint。

## 3. 回传约定

- 每步只推进一档；本地跑完把 `assets/EP-01/<step>/vN/` 整夹 commit/PR，或把图/视频贴群给总控归档。
- **不伪造**：缺图就标 pending；不要用占位图冒充定稿。
- Cloud 路径仍可选：Standard+ + custom_env 后由工程师健康检查，与本地路径二选一或并行。

## 4. 已知缺口（不挡 Prompt 准备）

- 本地 ComfyUI 工作流 JSON / 一键脚本：归平台集成工程师合入仓库后，本 runbook §1.4 可改为「一条命令」。
- 成片目标时长 / 分辨率：仍 soft；草稿跟样片 9:16。
