# EP01 导演本机本地 agent 操作要点 + 步骤03回灌清单

> MAO-42 / 非 GPU 接驳。真出图只在**导演有显卡本机**的本地 agent + ComfyUI 上做；本 Iris Xe runtime **不伪造**已连接、不出真图。  
> 权威出图命令见 [`EP01-LOCAL-GPU-RUN.md`](./EP01-LOCAL-GPU-RUN.md)；底层胶水见 [`LOCAL-GPU-RUNBOOK.md`](./LOCAL-GPU-RUNBOOK.md)。

## 1. 路径约定（锁定）

归档根：`assets/EP-01/<步骤目录>/<版本>/`

| 步骤 | 目录名 | 真出图 / 生成 | 本机 CLI |
|---|---|---|---|
| 01 | `01-script` | 文本已通过 | — |
| 02 | `02-storyboard` | 文本已通过 | — |
| 03 | `03-assets` | **Comfy 真出图（主责：导演 GPU agent）** | `ep01-cli run --step 03` |
| 04 | `04-keyframes` | Comfy 真出图（需 03 outputs） | `ep01-cli run --step 04` |
| 05 | `05-clips` | 视频 API / 手工落盘 | stub / 手工 |
| 06 | `06-voice-sub` | TTS / 手工落盘 | stub / 手工 |
| 07 | `07-final` | 剪辑导出 | stub / 手工 |

> 目录名以本表与 `scripts/ep01-cli.mjs` 的 `STEP_DIR` 为准。后端契约里的 `05-clips` 与 CLI 对齐；早期文稿若写 `05-segments` 视为同义，新落盘一律用 **`05-clips`**。

每版本目录最少含：`prompt.md` · `params.json` · `meta.md` · `output.md` · `outputs/`（媒体）· 可选 `refs/`。

### 步骤03 单 subject 落盘命名

```
assets/EP-01/03-assets/v1/outputs/<subject_id>/
  output.png          # 或 Comfy recover 写入的同前缀图
  params.json         # job_id / seed / positive / negative
  prompt.md
  meta.md
```

`subject_id` 使用斜杠路径（与 `params.json` → `subjects_planned` 一致），例如 `char/serena`、`scene/villa-living`。  
Windows 下目录即字面 `char\serena`；**不要**把 `/` 改成 `__` 作为目录名（`__` 仅出现在个别调试文件名前缀）。

## 2. 导演本机：连 Comfy → 出图 → 落盘

在有 NVIDIA + ComfyUI 的机器上：

```powershell
cd AI-Comic-Production
$env:COMFYUI_BASE_URL = "http://127.0.0.1:8188"
$env:COMFYUI_CKPT = "your-model.safetensors"   # 或每次 --ckpt

node scripts/ep01-cli.mjs doctor
node scripts/ep01-cli.mjs run --episode EP-01 --step 03 --version v1 --dry-run   # 先看会出哪些 subject
node scripts/ep01-cli.mjs run --episode EP-01 --step 03 --version v1 --ckpt your-model.safetensors
```

- 健康检查不过 → 先起 ComfyUI，再 doctor；**不要**在无 Comfy 时宣称已连接。
- 单 subject 重跑：`--subject char/serena`。
- 03 人审 ✅ 后再跑 04（同样 `--step 04`）。

## 3. 步骤03 回灌清单（必须齐才算可 ✅）

与 `assets/EP-01/03-assets/v1/params.json` → `subjects_planned` 对齐，共 **20** 个 subject：

| 类 | subject_id |
|---|---|
| characters | `char/serena` · `char/james` · `char/amy` · `char/kate` |
| expressions | `expr/serena-controlled` · `expr/serena-steel` · `expr/serena-alone` |
| costumes | `costume/serena-villa-evening` · `costume/amy-campus` · `costume/kate-office` |
| scenes | `scene/villa-living` · `scene/campus` · `scene/prime-group-skyline` · `scene/kate-office` · `scene/villa-window-driveway` |
| props | `prop/scholarship-letter-100k` · `prop/bentley-keys-docs` · `prop/studio-share-papers` · `prop/wineglass-white-knuckle` · `prop/phone-split` |

回灌前自检：

```powershell
node scripts/ep01-cli.mjs handoff-check --episode EP-01 --version v1
```

期望：`03` 下每个 subject 目录内至少有一张可读图像；`params.json` 的 `images_generated=true`；`output.md` / `meta.md` 已更新。  
**禁止**用占位图冒充定稿。

回传方式（任选其一）：

1. 整夹 `assets/EP-01/03-assets/v1/` commit / PR 进仓库；或  
2. 打包/贴群给总控，由总控归档进同一路径。

## 4. 回灌后谁接棒

| 阶段 | Owner | 动作 |
|---|---|---|
| 03 真出图 + 落盘 | **导演本机本地 agent**（maozh2 GPU 机） | Comfy 出图 → `outputs/<subject_id>/` |
| 03 回灌入库 / 路径核对 | **ComfyUI 平台集成** | `handoff-check`、必要时修 meta；不代跑 GPU |
| 【CHECKPOINT 03】人审 | **maozh2** | ✅ / ✏️ / ↩️ / 🔄 |
| 角色晋升系列 canon | **ComfyUI 平台集成** | 人审 ✅ 后 `canon-promote`（见 [`SERIES-CHARACTER-CANON.md`](./SERIES-CHARACTER-CANON.md)），防跨集脸漂 |
| 04 关键帧生成 | 导演 GPU agent（或同机 CLI） | `ep01-cli --step 04`；引用已锁 03 |
| 04–07 筛选 / 归档 / 人审编排 | **总控** + maozh2 checkpoint | 按 PIPELINE 逐步推进 |
| 05–07 一键生成 | **缺口**（见下） | 手工落盘或等视频/TTS/成片胶水 |

## 5. 无真图时的接驳 dry-run（本机无 GPU 也可跑）

验证 04→07 路径与 CLI 接线（**不产生真图、不冒充定稿**）：

```powershell
node scripts/ep01-cli.mjs run --episode EP-01 --from 04 --to 07 --version v1 --dry-run
node scripts/ep01-cli.mjs handoff-check --episode EP-01 --version v1
```

- 04 dry-run：解析 16 镜 Prompt，打印目标 `outputs/S##/`，不要求已有 03 图。  
- 05–07 dry-run：脚手架 `prompt.md` / `params.json` / `meta.md` / `outputs/`，状态 `dry_run_scaffold`（诚实，非真生成）。  
- 真图回灌后：同一命令去掉 `--dry-run` 即可续跑（03/04 需 Comfy；05–07 仍可能 `not_implemented` 直至 Key/胶水就绪）。

## 6. 已知缺口（诚实）

| 项 | 状态 |
|---|---|
| 本 Iris Xe runtime 真出图 | **不做**（MAO-41 cancelled） |
| Pages / 公网后端切真 | **另闸**（本单不碰） |
| 05 视频 API | stub；需 Seedance/Kling/Wan Key + 胶水 |
| 06 ElevenLabs TTS | stub；Key 未配则 unconfigured |
| 07 成片 ffmpeg/剪辑 | stub |
| 03/04 无 GPU | doctor/down；只 dry-run / 等回灌 |

## 7. 证据与复测命令

```text
node scripts/ep01-cli.mjs handoff-check --episode EP-01 --version v1
node scripts/ep01-cli.mjs run --episode EP-01 --from 04 --to 07 --version v1 --dry-run
```

日志可重定向保存，例如 `logs/ep01-04-07-dry-run.log`。
