# EP-01 Local GPU Runbook（离线跑通）

> 目标：本机无 GPU / Cloud Free 无 API 时，在**有显卡的机器**上 `git clone` 本仓库，用仓库 CLI **快速跑通 EP01 生成步（03→07）**。  
> **人审仍走 checkpoint**：CLI 只负责生成与落盘，不自动跳步；每步产物回传/贴群后，等 maozh2 ✅/✏️/↩️/🔄。  
> **路径锁定（2026-08-04）**：Comfy Cloud / 付费 API **暂搁**；权威路径 = 本地 GPU + 仓库接入说明 + CLI。

## 0. 仓库里已备好的（无需云端）

| 步骤 | 路径 | 状态 |
|---|---|---|
| 01 剧本 | `assets/EP-01/01-script/v1/` | ✅ maozh2 已通过 |
| 02 分镜 | `assets/EP-01/02-storyboard/v1/` | ✅ maozh2 已通过（5 场 / 16 镜） |
| 03 Prompt 包 | `assets/EP-01/03-assets/v1/` | Prompt/params 已备；**图像待本地出** |
| 04 Prompt 草稿 | `assets/EP-01/04-keyframes/v1/` | 16 镜关键帧 Prompt 草稿（引用 03 subject） |
| 样片参考 | `references/07-样片-sample.mp4` | 画幅/节奏参考（9:16） |
| 剧本源 | `references/scripts/english-script.docx` | 制作权威（全英文） |

> 归档根目录固定为 `assets/EP-01/<步骤>/<版本>/`。步骤 03 目录名是 **`03-assets`**（不是 `03-consistency`）。

## 1. 本机环境（有 GPU 的机器）

1. Clone：`https://github.com/maoumao34-design/AI-Comic-Production`（含本 runbook 的分支/PR 合入后用 main，或先 `git checkout zongkong/ep01-local-gpu-pack` / 合入后的 main）。
2. 安装并启动 **本地 ComfyUI**（本机显卡），默认 `http://127.0.0.1:8188`。
3. 配置本地入口（勿把 Key 提交进 git）：
   - `COMFYUI_BASE_URL=http://127.0.0.1:8188`（或你的本机端口）
   - 本地跑一般**不需要** Cloud API Key；若胶水仍读 `COMFYUI_API_KEY`，可留空。
4. 用仓库 CLI（§1.5 / 工程师 PR #8）。亦可手工在 ComfyUI 加载 `workflows/03-assets/` 等价工作流，按 §2 清单出图并落到 `assets/` 归档路径。

## 1.5 本地 CLI 接入（工程师 PR #8 已落地；导演本机调用）

目标体验（maozh2 确认）：到有显卡机器后，**少数命令**即可按步生成并落盘。  
工程侧说明：`docs/LOCAL-GPU-RUNBOOK.md`（PR https://github.com/maoumao34-design/AI-Comic-Production/pull/8 ）。  
内容包 + 人审标准：本文件 + `assets/EP-01/03-assets|04-keyframes/...`（PR #7）。

### 当前可用命令（先打通 03；整集 01→07 下一迭代）

```bash
# 0) 起本地 ComfyUI 后
export COMFYUI_BASE_URL=http://127.0.0.1:8188   # Windows: set / $env:

# 1) 按需改 workflows/03-assets/character-sheet.api.json 内 checkpoint 名
cd backend
node scripts/comfy-health.mjs
node scripts/comfy-run-workflow.mjs --episode EP-01 --step 03 --subject char-heiress
# 对其余 subject 按工程师文档 / params.json subjects_planned 逐个跑
```

### CLI / 落盘必须遵守

| 项 | 约定 |
|---|---|
| 读入 | 优先 `assets/EP-01/<step>/v1/prompt.md` + `params.json`（及上游锁定 outputs） |
| 写出（人审归档） | 最终须在 **`assets/EP-01/<step>/v1/outputs/...`**；更新同目录 `meta.md` / `output.md` |
| 工程缓存 | 若 CLI 暂写 `backend/data/assets/EP-01/...`，跑完**拷贝/同步**到上表 `assets/` 树再开 checkpoint |
| 不跳审 | 不得在无 ✅ 时改写上游已通过版本；重生用新 `vN` 或新 seed 记入 `params.json` |
| 不伪造 | 生成失败则标 `pending`/`failed`，禁止占位图冒充定稿 |
| 环境 | 只读本机 `COMFYUI_BASE_URL`；**禁止**把 Cloud Key 写入仓库 |

### 实现归属

- **内容包 / 验收标准 / 路径契约**：总控（PR #7）
- **ComfyUI workflow JSON + `backend/scripts/comfy-*.mjs`**：平台集成工程师（PR #8；整集一键后续迭代）

## 2. 跑通顺序

### Step 03 — 一致性资产（先出图）

输入：`assets/EP-01/03-assets/v1/prompt.md` + `params.json`  
必出清单（与 `params.json` → `subjects_planned` 一致）：

- Characters 三视图：`char/serena` · `char/james` · `char/amy` · `char/kate`
- Expressions：`expr/serena-controlled` · `expr/serena-steel` · `expr/serena-alone`
- Costumes：`costume/serena-villa-evening` · `costume/amy-campus` · `costume/kate-office`
- Scenes：`scene/villa-living` · `scene/campus` · `scene/prime-group-skyline` · `scene/kate-office` · `scene/villa-window-driveway`
- Props：`prop/scholarship-letter-100k` · `prop/bentley-keys-docs` · `prop/studio-share-papers` · `prop/wineglass-white-knuckle` · `prop/phone-split`

落盘：

```
assets/EP-01/03-assets/v1/outputs/<subject_id>/...
```

#### 【CHECKPOINT 步骤 03】验收标准（maozh2 人审）

- [ ] 上表 **全部 subject** 均有可读图像文件（缺一则不可 ✅）
- [ ] 角色三视图脸/发型/体态可辨且四人互不串脸
- [ ] 服装/场景/道具与分镜用途一致（别墅客厅、校园、Prime 天际、Kate 办公室、车道窗景；奖学金信/Bentley 钥匙文件/工作室股权文件/酒杯/对半分屏手机）
- [ ] 画幅可裁进 **9:16** 竖屏（允许生成时略宽，成片再裁）
- [ ] `params.json` 中 `images_generated=true`，`output.md`/`meta.md` 列出实际文件；无占位图冒充

通过后才开 04。✏️ 指出具体 subject；🔄 换 seed 重生当前步；↩️ 回 02（已通过分镜保留）。

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
- Cloud 路径仍可选（以后改主意再开）：Standard+ + custom_env 后由工程师健康检查；与本地路径二选一或并行。

## 4. 已知缺口（不挡本机先跑 03）

- 整集一键（01→07）与全部 subject 批跑：工程师下一迭代；当前可按 §1.5 逐 subject 跑 03。
- subject id 映射（工程侧如 `char-heiress` ↔ 内容包 `char/serena` 等）：出图后在 `output.md` 标明对应关系即可验收。
- 成片目标时长 / 分辨率：仍 soft；草稿跟样片 9:16。
