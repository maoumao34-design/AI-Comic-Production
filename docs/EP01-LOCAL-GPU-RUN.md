# EP-01 Local GPU Runbook（离线跑通）

> 目标：本机无 GPU / Cloud Free 无 API 时，在**有显卡的机器**上 `git clone` 本仓库，用仓库 CLI **快速跑通 EP01 生成步（03→07）**。  
> **人审仍走 checkpoint**：CLI 只负责生成与落盘，不自动跳步；每步产物回传/贴群后，等 maozh2 ✅/✏️/↩️/🔄。  
> **路径锁定（2026-08-04）**：Comfy Cloud / 付费 API **暂搁**；权威路径 = 本地 GPU + 仓库接入说明 + CLI。  
> **导演本机操作要点 + 步骤03回灌清单**：[`EP01-GPU-AGENT-HANDOFF.md`](./EP01-GPU-AGENT-HANDOFF.md)（MAO-42）。

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

1. Clone 并切到含 CLI 的分支（PR #8 合 main 前）：
   ```bash
   git clone https://github.com/maoumao34-design/AI-Comic-Production
   cd AI-Comic-Production
   git fetch origin
   git checkout agent/comfyui/30fedd2d   # 含内容包 + ep01-cli + Comfy 胶水
   ```
2. 安装并启动 **本地 ComfyUI**（本机显卡），默认 `http://127.0.0.1:8188`。
3. 把检查点模型放进 ComfyUI `models/checkpoints/`，记下真实文件名。
4. 配置本地入口（PowerShell 示例；勿把 Key 提交进 git）：
   ```powershell
   $env:COMFYUI_BASE_URL = "http://127.0.0.1:8188"
   $env:COMFYUI_CKPT = "your-model.safetensors"   # 或每次 --ckpt 传入
   ```
   本地跑**不需要** Cloud API Key。

## 1.5 本地 CLI（真实入口）

目标体验（maozh2 确认）：到有显卡机器后，**少数命令**即可按步生成并落盘。

```bash
# 0) 回灌/接驳自检（不连 Comfy、不出图）
node scripts/ep01-cli.mjs handoff-check --episode EP-01 --version v1

# 0b) 可选：只检查会生成哪些 subject，不连 Comfy、不出图
node scripts/ep01-cli.mjs run --episode EP-01 --step 03 --version v1 --dry-run

# 0c) 无真图时验证 04→07 路径接驳（脚手架，不冒充定稿）
node scripts/ep01-cli.mjs run --episode EP-01 --from 04 --to 07 --version v1 --dry-run

# 1) 健康检查：本地 ComfyUI 可达
node scripts/ep01-cli.mjs doctor --base-url http://127.0.0.1:8188

# 2) 按步跑 EP01（推荐一次一步，便于 checkpoint）
node scripts/ep01-cli.mjs run --episode EP-01 --step 03 --version v1 --ckpt your-model.safetensors
# 单 subject 重跑：
node scripts/ep01-cli.mjs run --episode EP-01 --step 03 --version v1 --subject char/serena --ckpt your-model.safetensors

node scripts/ep01-cli.mjs run --episode EP-01 --step 04 --version v1 --ckpt your-model.safetensors   # 需 03 已有 outputs

# 05–07：无 --dry-run 时诚实返回 not_implemented（缺视频 API / TTS / 成片流水线），勿期望一键出片
node scripts/ep01-cli.mjs run --episode EP-01 --step 05 --version v1
node scripts/ep01-cli.mjs run --episode EP-01 --step 06 --version v1
node scripts/ep01-cli.mjs run --episode EP-01 --step 07 --version v1

# 可选：03→04 连续跑，每步结束后暂停等人审
node scripts/ep01-cli.mjs run --episode EP-01 --from 03 --to 04 --pause-each-step --ckpt your-model.safetensors
```

底层胶水（调试用）：`backend/scripts/comfy-health.mjs`、`backend/scripts/comfy-run-workflow.mjs`；工作流：`workflows/03-assets/character-sheet.api.json`。

### CLI 必须遵守

| 项 | 约定 |
|---|---|
| 读入 | `assets/EP-01/<step>/v1/prompt.md` + `params.json`（及上游锁定 outputs） |
| 写出 | `assets/EP-01/<step>/v1/outputs/...`；更新同目录 `meta.md` / `output.md` 的文件清单与状态 |
| 不跳审 | 不得在无 ✅ 时改写上游已通过版本；重生用新 `vN` 或同目录新 seed 记录进 `params.json` |
| 不伪造 | 生成失败则标 `pending`/`failed`，禁止占位图冒充定稿；05–07 未接线时明确 `not_implemented` |
| 环境 | 只读本机 `COMFYUI_BASE_URL` / `COMFYUI_CKPT`（及可选 Key）；**禁止**把 Cloud Key 写入仓库 |

### 实现归属

- **内容包 / 验收标准 / 本约定**：总控（`assets/EP-01/03-assets|04-keyframes/...`）
- **ComfyUI workflow JSON + `scripts/ep01-cli.mjs`**：平台集成工程师（本分支）

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
落盘 `assets/EP-01/05-clips/v1/` → checkpoint。（目录名与 PIPELINE / 后端 `05-clips` 对齐）

### Step 06 — 配音字幕

旁白全文：`assets/EP-01/01-script/v1/output.md`（English VO）。  
TTS（ElevenLabs 或本机等价）+ 字幕 SRT；节奏对齐分镜 → checkpoint。

### Step 07 — 合成导出

剪辑拼接 / 字幕 / 音乐音效 / 调色；画幅 **9:16**；时长与分辨率导出前由 maozh2 锁定 → 成片 + checkpoint。

## 3. 回传约定

- 每步只推进一档；本地跑完把 `assets/EP-01/<step>/vN/` 整夹 commit/PR，或把图/视频贴群给总控归档。
- **不伪造**：缺图就标 pending；不要用占位图冒充定稿。
- 步骤03 完整 subject 回灌清单与接棒表：见 [`EP01-GPU-AGENT-HANDOFF.md`](./EP01-GPU-AGENT-HANDOFF.md)。
- Cloud 路径仍可选（以后改主意再开）：Standard+ + custom_env 后由工程师健康检查；与本地路径二选一或并行。

## 4. 已知缺口

- **03 / 04**：本机 ComfyUI + `ep01-cli` 可跑；缺 GPU / 缺 checkpoint 文件则出不了图（不伪造）。无 GPU 机用 `--dry-run` / `handoff-check` 验接驳。
- **05 视频 / 06 TTS / 07 成片**：CLI 入口已留，实现仍待视频模型 Key + TTS + 剪辑链路；在此之前请手工落盘或等下一迭代。
- 成片目标时长 / 分辨率：仍 soft；草稿跟样片 9:16。
