# 可视化产品 · 后端 Job/Task API 契约（草案 v0.2）

> 前后端对接契约草案。作者：ComfyUI 平台集成工程师（后端 owner）。
> 对齐依据：[PIPELINE-DESIGN.md](../PIPELINE-DESIGN.md) §1–§5（7 步状态机 / checkpoint 协议 / 版本归档 / 平台对接 / 失败重试）、总控的 per-step checkpoint 契约（**decision 动作词已定稿对齐，见 §2.3**）、各步内容数据模型（编剧 01/02 **已交**、图像视频 03/04/05 与后期 06/07 待交；本文只定**通用外壳**，见 §5）。
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

---

## 5. 各步内容 schema（通用外壳 + 步主定义）

后端对 `StepVersion.content` 只做通用外壳约束；**具体字段由该步 owner 定**，后端按其 schema 校验/存储：
- 01 解说词、02 分镜表 → 编剧分镜：✅ **已交** `docs/CONTENT-SCHEMA-01-02.md`（分支 `script/content-schema-01-02`）
- 03 一致性资产、04 关键帧、05 分段视频 → 图像视频生成执行：⏳ 待交
- 06 配音字幕、07 成片 → 后期合成：⏳ 交付中

> 各步 owner 把 content schema PR 进来后，后端据此定校验。通用外壳（episode/step/version/status/artifacts/params/meta）由本文锁定。

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
2. **各步 content schema**：编剧 01/02 ✅ 已交；图像视频 03/04/05、后期 06/07 待交，后端接入校验。
3. **delivery 规格**（画幅/时长/语言/导出）→ 影响 05/06/07 参数默认值；未定前用占位。
4. **平台 key**：03+ 真实生成的前置；未到之前后端只跑骨架 + 占位产物（不伪造）。
5. **鉴权/多用户**：MVP 假设单用户（maozh2），部署形态定了再补。

---

## 9. 下一步（后端 owner）
- 按本契约搭后端骨架（FastAPI/Node 自选，建议轻量）+ 内存/SQLite 状态存储 + 归档读写；先跑通「episode→run→step→decision→归档」闭环（占位产物）。
- 平台胶水先出桩（五件套接口 + model/key 占位），key 到位再接真实节点。
- 完成后开 PR，至少 1 人复核（默认 PM）才合 main（见 COLLABORATION.md）。
