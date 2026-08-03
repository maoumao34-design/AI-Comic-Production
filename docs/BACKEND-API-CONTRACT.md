# 可视化产品 · 后端 Job/Task API 契约（草案 v0.4）

> 前后端对接契约。作者：ComfyUI 平台集成工程师（后端 owner）。
> 对齐依据：[PIPELINE-DESIGN.md](../PIPELINE-DESIGN.md) §1–§5（7 步状态机 / checkpoint 协议 / 版本归档 / 平台对接 / 失败重试）、总控的 per-step checkpoint 契约（**decision 动词语义已定稿，见 §2.3**）、各步内容数据模型（**七步 schema 已全部并入 §5**）、前端联调实测形状（**§4.6 固化**）。
> **v0.4 变更**：① 各步 content schema（编剧 01/02、图像视频 03/04/05、后期 06/07）并入 §5；② §4.6 增补 Run 状态枚举 / `Run.steps[step]` 字段 / `RunStepStatus` / decision 请求体 canonical 字段名（修正 `docs/PER-STEP-UI-SPEC.md`（fe/mvp-shell 分支）§5 的 `new_params` 命名变体）。
> **状态：草案，供前端工程师、总控、PM 评审；不改 main，走 PR。** 本文用 REST 描述，字段稳定后再补 OpenAPI。

---

## 0. 设计目标与范围

- 前端只管「展示每步产出 + 收集 maozh2 的 ✅/✏️/↩️/🔄 反馈 + 版本浏览」，**不直接调** ComfyUI / 视频模型 / TTS。
- 后端负责：驱动 7 步流水线（跑一步→归档→等确认→进/退/重生）、平台胶水（提交·参数记录·结果回收·失败重试·版本归档）、版本持久化、对前端暴露 Job/Task API。
- **按集号（episode）驱动，episode 无关**——能做任意集，不写死 3 集。
- MVP（Phase 1）：REST + 轮询即可跑通；后续可加 SSE/WebSocket 推送实时进度（§6）。

---

## 1. 架构总览

```
[前端 web UI]  ──HTTP/JSON──▶  [后端 Job/Task API]
                                   │
                                   ├──▶ [流水线编排引擎]  7 步状态机 + checkpoint
                                   │        │
                                   │        ├──▶ [平台胶水适配器]
                                   │        │      ├── ComfyUI（03 资产 / 04 关键帧 / 05 视频）
                                   │        │      ├── 视频模型 API（Seedance / Kling / Wan）
                                   │        │      └── ElevenLabs TTS（06 配音）
                                   │        │
                                   │        └──▶ [版本归档]  assets/<集号>/<步骤>/<版本>/
                                   │
                                   └──▶ [状态/任务存储]  episodes / runs / steps / versions / decisions
```

前后端**唯一耦合**就是本文的 Job/Task API。前端不感知平台细节。

---

## 2. 核心数据模型（通用外壳）

> 每步**具体内容**（解说词字段、分镜表字段、资产清单…）由该步 owner 定义（§5）；后端只定义通用外壳，把 `content` 当作各步约定的 JSON 透传/持久化。

### 2.1 Episode（集）
```json
{ "episode_id": "EP-01", "title": "第1集·Serena 身份暴露起点",
  "status": "in_progress",          // draft|in_progress|done|blocked
  "current_step": "03",             // 当前所在步骤 01–07
  "created_at": "...", "updated_at": "..." }
```

### 2.2 StepVersion（某步某版本产出，= checkpoint 展示单元）
```json
{ "episode_id": "EP-01", "step": "04", "version": "v2", "is_latest": true,
  "status": "awaiting_review",      // running|awaiting_review|approved|rejected|superseded
  "model": "<占位：视频模型名>", "seed": 12345,
  "params": { /* 该步参数，原样来自 params.json */ },
  "artifacts": [                    // 前端展示的产物（图/视频/音频/文本）
    { "type": "image", "url": "/assets/EP-01/04-keyframes/v2/output_01.png",
      "label": "关键帧 01", "meta": { "frame_id": "kf-01" } } ],
  "refs": [ "/assets/EP-01/03-assets/latest/...“ ],   // 引用的一致性资产/参考图
  "archive_path": "assets/EP-01/04-keyframes/v2/",
  "prompt_path": "assets/EP-01/04-keyframes/v2/prompt.md",
  "meta_path":   "assets/EP-01/04-keyframes/v2/meta.md",
  "content": { /* 各步 owner 定义的 step 专属内容 schema，§5 */ },
  "created_at": "...", "duration_ms": 8420,
  "failure": null }                 // 失败时 {code, reason, retryable}
```

### 2.3 Decision（maozh2 的反馈，= checkpoint 动作）
```json
{ "episode_id": "EP-01", "step": "04", "version": "v2",
  "action": "revise",               // approve ✅ | revise ✏️ | rollback ↩️ | regenerate 🔄
  "note": "关键帧 01 角色表情再严肃一点",
  "params_override": { "seed": 999, "prompt_patch": "..." },  // regenerate/revise 时可带
  "at": "..." }
```
> `action` 语义**已按总控定稿锁定**（2026-07-31，对齐 PIPELINE-DESIGN §2）：
> - `approve` ✅ → 归档为 latest，**推进下一步**
> - `revise` ✏️ → 带用户具体修改意见（哪句旁白/哪个镜头/哪个参数）**重跑当前步**（不推进）
> - `regenerate` 🔄 → 不指定改动、换参数/seed **重跑当前步**（不推进）
> - `rollback` ↩️ → 回**上一步** checkpoint 重做（当前版本保留归档）
>
> 只有 `approve` 推进；`revise`/`regenerate` 都重跑当前步（区别=revise 带编辑意见、regenerate 纯换参）；`rollback` 退上一步。每次 decision 记可回溯字段（动作 + 修改意见/新参数 + 操作人 + 时间）进 `meta.md`/`params.json`。

---

## 3. 版本归档（落地结构，对齐 PIPELINE-DESIGN §3）

```
assets/<集号>/<步骤>-<名称>/<版本>/
    prompt.md        本版 Prompt
    params.json      参数 / 模型 / seed / refs
    refs/            参考图（一致性资产 / 首尾帧）
    output.*         产出（图/视频/音频/文本）
    meta.md          说明 / 失败原因 / 耗时
assets/<集号>/<步骤>-<名称>/latest    → 指向当前通过版本（软链或 README 指针）
```
步骤目录名：`01-script 02-storyboard 03-assets 04-keyframes 05-clips 06-voice-sub 07-final`。
**前端通过 API 拿产物 URL，不直接拼路径**；后端保证 URL 与归档一致。

---

## 4. Job/Task API（REST，前端调用）

基址：`/api/v1`。所有写操作幂等（带 `client_request_id`）。错误统一 `{ "error": { "code", "message", "detail" } }`。

### 4.1 集（Episode）
| 方法 路径 | 说明 |
|---|---|
| `GET /episodes` | 列出所有集（含状态/当前步） |
| `POST /episodes` | 新建一集 `{ episode_id, title }`（或由后端按规则生成） |
| `GET /episodes/{episode_id}` | 集详情 + 当前 run/step 概览 |

### 4.2 运行（Run：驱动流水线）
| 方法 路径 | 说明 |
|---|---|
| `POST /episodes/{episode_id}/runs` | 启动/继续一次流水线：从当前步起跑；body 可带 `{ from_step, inputs }`（如剧本 DOCX 引用、规格） |
| `GET /runs/{run_id}` | run 状态（`running/paused_at_checkpoint/done/failed`）+ 各步进度 |

### 4.3 步骤与版本（checkpoint 展示）
| 方法 路径 | 说明 |
|---|---|
| `GET /episodes/{episode_id}/steps/{step}/current` | 当前步的 latest 版本（= 要你 review 的那版） |
| `GET /episodes/{episode_id}/steps/{step}/versions` | 该步所有版本（版本浏览器） |
| `GET /episodes/{episode_id}/steps/{step}/versions/{version}` | 某版本详情（含 artifacts/params/content） |
| `GET /artifacts?path=...` | 取产物文件（图/视频/音频）——鉴权后直读归档 |

### 4.4 决策（✅/✏️/↩️/🔄）= 推进流水线的唯一入口
| 方法 路径 | 说明 |
|---|---|
| `POST /episodes/{episode_id}/steps/{step}/decision` | 提交 Decision（§2.3，语义已锁定）。后端据 `action`：approve→归档为 latest 并进下一步；revise→带 note 重跑当前步出新版；regenerate→换参/seed 重跑当前步；rollback→回上一步重做（当前版本保留归档）。返回新的 run/step 状态。**失败/重生超阈值（PIPELINE-DESIGN §5，默认 3 次）→ 暂停并 escalation（不无限重跑）。** |

### 4.5 健康 / 可观测（对齐能力强化重点「可观测」）
| 方法 路径 | 说明 |
|---|---|
| `GET /health/platforms` | 各平台连接健康：ComfyUI server / 视频模型 / ElevenLabs 的 `ok/degraded/down/未配置(key 缺)` |
| `GET /queue` | 任务队列：进行中/排队/最近失败（model/seed/耗时/失败原因） |

> 平台 key 缺失时，`/health/platforms` 如实报「未配置」，后端**不伪造已连接**（铁律）。MVP 阶段 03+ 真实生成需 key 到位。

### 4.6 实测响应形状（v0.3 起 — 前后端联调已对齐，以 backend 实现为准）

> 本节固化 v0.2 实现的**实际**响应外壳与字段；前端 `fe/mvp-shell` 已按此适配并通过真后端联调。与前文有冲突时以本节为准。

- **所有响应包 envelope**（不返裸值）：
  - `GET /episodes` → `{ episodes: Episode[] }`
  - `POST /episodes` / `GET /episodes/{id}` → `{ episode: Episode }`
  - `POST /episodes/{id}/runs` / `GET /runs/{id}` → `{ run: Run }`
  - `GET .../steps/{step}/current` / `GET .../steps/{step}/versions/{version}` → `{ version: StepVersion }`
  - `GET .../steps/{step}/versions` → `{ versions: StepVersion[] }`
  - `POST .../steps/{step}/decision` → `{ result: { run_id, status, current_step, current_version } }`（**瘦身返回**；要完整 run 用 `run_id` 再 `GET /runs/{run_id}`）
  - `GET /health/platforms` → `PlatformHealth`（见下，无 envelope）
  - `GET /queue` → `{ queue: Job[] }`
- **step id = 短形式 `01`..`07`**（与 §2.2 示例 `"step":"04"` 一致；归档目录仍用全名 `04-keyframes`，由后端映射，前端不感知）。
- **`Run.steps` 是对象（按 step id 键），不是数组**：`{ "01": { status, versions:[], current_version, fail_count }, ... }`。
- **`is_latest`** 只在 `approve` 后标 `true`（§3 latest 指针语义）；当前待 review 的版本走 `GET .../current`（status=`awaiting_review`）。
- **PlatformHealth（嵌套）**：`{ comfyui:{status,detail}, video_models:{status,detail}, elevenlabs:{status,detail}, overall }`，每项 `status` ∈ `unconfigured|ok|degraded|down`（MVP：`unconfigured`，不伪造）。
- 写操作幂等：前端可带 `client_request_id`（后端目前透传、不强制）。
- **Run 状态枚举（v0.4 补）**：`Run.status` ∈ `running | paused_at_checkpoint | paused | done | failed`；一次 `POST .../runs` 后立即落在第一步的 `paused_at_checkpoint`（等 checkpoint）。`paused` 用于失败超阈值被暂停等升级。
- **`Run.steps[step]` 字段（v0.4 补）**：`{ status, versions: StepVersion[], current_version, fail_count }`；前端把 `current_version` 映射为它的 `latest_version`（FE 容错也读 `latest_version`）。未跑到的步 `status=pending`、`current_version=null`。
- **`RunStepStatus`（v0.4 补）**：`StepVersionStatus | 'pending'`（尚未跑到 = `pending`）。
- **decision 请求体 canonical 字段名（v0.4 锁定）**：后端 `submitDecision` 实读 `{ action, note?, params_override?, operator? }`（`episode_id`/`step` 在路径，`version` 在体里指定作用于哪版），`at` 由后端服务端打时间戳（不读请求体），`client_request_id?` 透传。⚠️ `docs/PER-STEP-UI-SPEC.md`（fe/mvp-shell 分支）§5 把参数写作 `new_params`、时间戳 `ts`——后端**不读** `new_params`（用 `params_override`）、不读 `ts`（服务端时间）；`operator` 后端可读（默认 `maozh2`）。**本契约以 `params_override`/`at` 为准，UI-SPEC 待同步。**

---

## 5. 各步内容 schema（StepVersion.content，七步已并入）

> **并入范围**：编剧 01/02、图像视频 03/04/05、后期 06/07 三步主均已交付 content schema，本节把七步字段**并入契约**作为前后端共同对接依据。各步详细 schema 以 owner 维护的文档为单一真源（SSOT）：[CONTENT-SCHEMA-01-02.md](./CONTENT-SCHEMA-01-02.md)、[STEP-CONTENT-SCHEMA-03-04-05.md](./STEP-CONTENT-SCHEMA-03-04-05.md)、[CONTENT-SCHEMA-06-07.md](./CONTENT-SCHEMA-06-07.md)；**owner 更新其文档时同步更新本节**避免漂移。
> **外壳原则（铁律）**：产物**文件本体**（旁白 mp3、字幕 srt、成片 mp4、剪辑工程文件、生成的图/视频…）一律走 `StepVersion.artifacts[]`（§2.2）；`content` 只放**结构化字段**（cue 表、参数、引用、元数据）。后端按本 schema 校验/存储 `content`，前端按它渲染。`content` 在通用外壳里是 `unknown`/联合类型，前端按 `step` narrow。

### 5.0 通用包装（每步每条 content 都带）
各步 content 都遵守：以 `episode_id` / `step`（短形式 `01`..`07`）/ `version` 定位。生成类步骤（03/04/05）额外统一 `prompt`（生成文本）/ `params:{model,seed,steps,cfg,...}` / `refs[]`（参考图路径/ID）/ `output:{url,type:image|video,thumbnail?}` / `meta:{note,created_at,...}`；其中 `output` 只给 url+type 便于渲染，**文件本体仍在 `artifacts[]`**，不重复存。归档路径统一 `assets/<集号>/<步骤>-<名称>/<版本>/`（步骤目录名见 §3）。

### 5.1 步骤 01 · 解说词（编剧 owner）
**doc-level**：`one_line_premise`✓（一句话主线+情绪落点）、`emotion_arc{opening,rising,turning,closing}`、`est_duration_sec`、`word_count`、`word_count_target{min:210,max:480,chars_per_sec:"3.5–4"}`（1–2 分钟 × 3.5–4 字/秒）、`narration_language`（默认 `zh`，待交付规格）、`source{primary,reference,primary_title,reference_title}`✓、`adaptation{boundary_confirmed,policy,changes[]}`✓、`open_specs[]`。
**正文 `beats[]`**（口播体，一条旁白 = 一拍）：

| 字段 | 必填 | 说明 |
|---|---|---|
| `beat_id` | ✓ | 如 `b1`；**02 按它引用** |
| `scene_label` | | 场景/小标题 |
| `narration_text` | ✓ | 口播体正文（可直接念出、连贯） |
| `preserved_dialogue[]` | | 逐字保留的关键对白 `{text,character}` |
| `emotion` | | 情绪点 |
| `visual_hint` | ✓（留口） | 画面要素提示 → 人物/动作/场景/证据，交 02 细化（**每句旁白都要能落到画面**） |

### 5.2 步骤 02 · 分场分镜（编剧 owner）
**doc-level**：`source_narration{episode,version}`✓（指回 01 依据版本）、`shots_count`、`est_total_duration_sec`、`open_specs[]`。**`shots[]`**（每条旁白 → ≥1 镜头）：

| 字段 | 必填 | 说明 |
|---|---|---|
| `shot_id` | ✓ | 如 `s1` |
| `linked_beat_id` | ✓ | 外键 → 01 `beats[].beat_id` |
| `shot_no` | ✓ | 镜头号，如 `S1` |
| `characters[]` | ✓ | 出场人物（引用 `assets/_shared/characters.md`） |
| `action` / `scene` / `evidence_visual` | ✓ | 动作/场景/证据画面（具体、可生成） |
| `shot_type` | | 景别：特写/近景/中景/全景/远景 |
| `duration_sec` | | 本镜时长 |
| `ref_image_slot` | | → 03/04 一致性资产引用位（资产定稿后回填） |
| `notes` | | 衔接/音效点/字幕安全区 |

### 5.3 步骤 03 · 一致性资产（图像视频 owner，subject 粒度）
一个集可有多条 subject。字段：`subject_type`（`character|costume|expression|scene|prop`）、`subject_id`、`views`（character 时 front/side/back 三视图，各一 output 或一图多 view）、`consistency_ref`（跨集基准资产 ID，定稿后 04/05 复用）、`consistency_check{passed:bool,issues[]}`（角色一致性自检）。**定稿 `status=locked`，作为 04/05 的基准资产入口。** 归档：`assets/<集号>/03-assets/<subject_id>/v<N>/`。

### 5.4 步骤 04 · 关键帧（图像视频 owner，每帧一条）
`kf_id`、`source_shot_id`（来自 02 分镜的镜头号）、`shot{景别,angle,composition}`、`asset_refs[]`（引用 03 资产 ID，锁角色一致性）、`characters_in_frame[]`（入帧角色 ID）。

### 5.5 步骤 05 · 分段视频（图像视频 owner，每段 4–15s）
`seg_id`、`duration_s`（4–15）、`keyframe_refs{first,last}`（首尾帧，衔接用，→ 04 `kf_id`）、`prompt{shot,action,dialogue,emotion,sfx}`、`selection{decision:adopt|reject, reason, consistency_check}`。**镜头筛选横跨 05**：对每条生成结果记 `selection`；跨镜头一致性不过 → 标记 + regenerate，采用/淘汰理由留痕 `meta`，可回溯。

### 5.6 步骤 06 · 配音字幕（后期 owner）
输入：01 解说词(latest) + 05 分段视频(latest)。产出：旁白音频（ElevenLabs TTS）+ 节奏对齐字幕轨。
- `voiceover{ tts:"elevenlabs", model:"eleven_multilingual_v2", voice_id, language, speed:1.0, stability:0.5, similarity_boost:0.75, audio:{type:"audio", url, duration_ms} }`（音色/语速/稳定性/相似度；mp3 本体在 `artifacts[]`，这里给 url+时长）
- `subtitle_track{ format:"srt", language, burn_in:true, file_url, cues[{index,start_ms,end_ms,text}] }`（前端用 `cues[]` 画字幕轨 + 随旁白同步预览；srt 本体在 `artifacts[]`）
- `script_ref`（→ 01 latest）、`clips_ref`（→ 05 latest），保证可追溯

### 5.7 步骤 07 · 后期合成（后期 owner）
输入：05 分段视频(latest) + 06 声音字幕(latest)。产出：成片（拼接/节奏统一/字幕/音乐/音效/调色/导出）。
- `cut{ duration_ms, aspect:"9:16", resolution:[1080,1920], fps:30, video:{type:"video", url, container:"mp4", vcodec:"h264", acodec:"aac"} }`（成片 mp4 本体在 `artifacts[]`，这里给 url+几何/编码元数据）
- `tracks{ voiceover_ref(→06), clips_ref(→05), music[{url,label,gain_db}], sfx[{url,at_ms,label}] }`
- `subtitle{burn_in, language}`、`color{lut, grade}`
- `edit_project{ tool:"ffmpeg", project_file_url, export_params }`（**铁律：剪辑工程 + 导出参数一并归档，可回退可复现，不丢工程文件**）
- `delivery_spec_id`（成片规格定稿后回填，占位）

### 5.8 跨步引用链（后端校验完整性 / 前端高亮跳转）
```
01 beats[].beat_id   ──(linked_beat_id)──────────▶  02 shots[]
02 shots[].shot_no   ──(source_shot_id)──────────▶  04 keyframes
03 assets            ──(asset_refs / consistency_ref)──▶  04 / 05
04 keyframes         ──(keyframe_refs{first,last})────▶  05 segments
01 script + 05 clips ──(script_ref / clips_ref)──────▶  06 voice-sub
05 clips + 06 voice   ──(clips_ref / voiceover_ref)───▶  07 final
```
**铁律**：`02.shots[].linked_beat_id` 必须命中 01 某 `beat_id`，且**每个 beat 至少被 1 个 shot 引用**（不允许"有旁白无画面"）；01 改版（v1→v2）→ 02 `source_narration.version` 跟升并重检外键，02 产出归档到自己的版本目录。前端：选镜头→高亮对应旁白（beat），✏️ 修改回写到具体 beat/shot。

> 各步待确认规格（旁白语言 / 单集时长 / 画幅 / 改编边界 / delivery 编码）只影响默认值，未定前用占位，**不阻塞 schema 本身**。

---

## 6. 实时进度（Phase 2，先不强求）
- `GET /runs/{run_id}/events`（SSE）或 WS：推送 `step_started / artifact_ready / step_failed / checkpoint_ready`。
- Phase 1 前端用轮询 `GET /runs/{run_id}` 即可。

---

## 7. 平台胶水适配器（后端内部，前端不直接用）
统一接口（五件套），model 可热替换：
```
submit(workflow_or_prompt, refs, params, model) -> job_id
record(job_id) -> 写 params.json/meta.md
poll(job_id) -> status + 产物
recover(job_id) -> 下载并归档到 assets/.../<版本>/
retry(job_id, new_params) -> 换参重跑（失败分类：内容不符/平台错误/超时）
```
覆盖：ComfyUI API（03/04 + 部分 05）、视频模型 API（Seedance/Kling/Wan，05）、ElevenLabs TTS（06）。
> key 走 custom_env，绝不进代码/仓库。

---

## 8. 待对齐 / 待确认（请评审）
1. ~~checkpoint 动作词与流程~~ ✅ **已对齐总控定稿**（approve/revise/rollback/regenerate，见 §2.3）。
2. **各步 content schema**：✅ 七步 schema 已全部并入本契约 §5（编剧 01/02、图像视频 03/04/05、后期 06/07；owner 文档为 SSOT）。后端据此给 `content` 做结构化校验（跨步外键完整性见 §5.8）。仍待：delivery 规格（画幅/时长/语言/编码）定稿后校准各步默认值。
3. **delivery 规格**（画幅/时长/语言/导出）→ 影响 05/06/07 参数默认值；未定前用占位。
4. **平台 key**：03+ 真实生成的前置；未到之前后端只跑骨架 + 占位产物（不伪造）。
5. **鉴权/多用户**：MVP 假设单用户（maozh2），部署形态定了再补。

---

## 9. 下一步（后端 owner）
- ✅ 后端 MVP 骨架已落地（`backend/`，Node；episode→run→step→decision→归档 闭环跑通，占位产物；前后端真后端联调通过）。
- 按 §5 各步 schema 给 `content` 加结构化校验（外键完整性：02→01 beat、04→03 asset、05→04 keyframe、06/07→上游 ref）。
- 平台胶水先出桩（五件套接口 + model/key 占位），key 到位再接真实节点（03+ 真实生成前置 = 平台 key）。
- 完成后开 PR，至少 1 人复核（默认 PM）才合 main（见 COLLABORATION.md）。
