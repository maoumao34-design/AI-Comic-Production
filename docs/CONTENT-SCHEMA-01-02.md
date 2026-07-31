# 步骤 01 / 02 内容数据契约（Content Schema）

> 编剧·分镜 owner 出。供**后端按字段校验**步骤 01/02 产出、**前端按字段展示与评审**。
> 配套：[PIPELINE-DESIGN.md](../PIPELINE-DESIGN.md) §1–3、[TASK-SPEC.md](../TASK-SPEC.md) §4/§7/§10、[COLLABORATION.md](../COLLABORATION.md)、后端 Job/Task API 契约（`docs/BACKEND-API-CONTRACT.md`）。
> 与已存在的 **01 解说词模板**（分支 `script/step01-template`，`assets/_template/01-script/`）字段一致；本文件是它的"机器可读结构版"。

---

## 0. 定位与用法

- 这是流水线 **步骤 01（解说词）** 与 **步骤 02（分场分镜）** 的 content schema。
- 后端资源模型（`episode / run / step / version / decision`）里，`step=01-script|02-storyboard` 的产物 `content` 字段按本 schema 存储与校验。
- 产物归档路径：`assets/<集号>/01-script/<版本>/` 与 `assets/<集号>/02-storyboard/<版本>/`（与 01 模板一致）。
- 评审动作统一走后端 `decision` 端点（`approve / revise / rollback / regenerate`，词以总控定稿为准）。
- 待确认规格（旁白语言 / 单集时长 / 画幅 / 改编边界）未定前，schema 字段给默认值，定稿后校准——**不阻塞 schema 本身**。

---

## 1. 步骤 01 · 解说词文档 schema

### 1.1 文档级字段（doc-level）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `step` | string | ✓ | 固定 `"01-script"` |
| `episode` | string | ✓ | 集号，如 `"EP-01"` |
| `title` | string | | 本集标题 |
| `version` | string | ✓ | 如 `"v1"`；checkpoint 通过的标 `latest`（README 指针） |
| `date` | string | ✓ | `YYYY-MM-DD` |
| `narration_language` | string | ✓ | 默认 `"zh"`（待确认；样片是英文，仅形式参考） |
| `one_line_premise` | string | ✓ | 一句话主线（发生了什么 + 情绪落点） |
| `emotion_arc` | object | | `{opening, rising, turning, closing}` 情绪弧线 |
| `est_duration_sec` | number | | 预估口播时长（秒） |
| `word_count` | number | | 实际字数 |
| `word_count_target` | object | | `{min:210, max:480, chars_per_sec:"3.5–4"}`（1–2 分钟 × 3.5–4 字/秒） |
| `beats_count` | number | | 节拍数（= `beats.length`） |
| `retained_dialogues_count` | number | | 保留的关键对白数 |
| `source` | object | ✓ | `{primary:"english_docx", reference:"chinese_docx", primary_title, reference_title}` |
| `model` | object | | `{name, temperature}`（文字编排建议 Claude/GPT，保留人工校对） |
| `adaptation` | object | ✓ | `{boundary_confirmed:false, policy:"保守：仅必要口语化，不改情节/不删关键对白", changes:[]}` |
| `open_specs` | string[] | | 未定规格项，如 `["narration_language","duration","aspect_ratio","adaptation_boundary"]` |

### 1.2 节拍数组 `beats[]`（正文，口播体）

每条旁白 = 一个节拍（beat）。**铁律：每个 beat 都要留 `visual_hint` 给步骤 02 细化（每句旁白都要能对应到画面）。**

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `beat_id` | string | ✓ | 如 `"b1"`、`"b2"`；**02 分镜按它引用** |
| `scene_label` | string | | 场景 / 小标题 |
| `narration_text` | string | ✓ | 口播体正文（可直接念出、连贯） |
| `preserved_dialogue` | object[] | | 关键对白逐字保留：`[{text, character}]` |
| `emotion` | string | | 情绪点 |
| `visual_hint` | string | ✓（留口） | 画面要素提示 → 人物/动作/场景/证据，交给步骤 02 细化 |

### 1.3 JSON 范例（01）

```json
{
  "step": "01-script", "episode": "EP-01", "version": "v1", "date": "2026-08-01",
  "narration_language": "zh",
  "one_line_premise": "Serena 隐藏的豪门身份第一次露出破绽。",
  "emotion_arc": {"opening": "平静", "rising": "警觉", "turning": "震动", "closing": "隐忍"},
  "est_duration_sec": 95, "word_count": 360,
  "word_count_target": {"min": 210, "max": 480, "chars_per_sec": "3.5–4"},
  "beats_count": 6, "retained_dialogues_count": 2,
  "source": {"primary": "english_docx", "reference": "chinese_docx", "primary_title": "Ep1", "reference_title": "第1集"},
  "adaptation": {"boundary_confirmed": false, "policy": "保守：仅必要口语化，不改情节/不删关键对白", "changes": []},
  "open_specs": ["narration_language", "duration", "aspect_ratio", "adaptation_boundary"],
  "beats": [
    {"beat_id": "b1", "scene_label": "开场·晚宴", "narration_text": "……（口播体）",
     "preserved_dialogue": [{"text": "You really don't know who I am, do you?", "character": "Serena"}],
     "emotion": "平静中藏锋", "visual_hint": "Serena 端杯/James 漫不经心/晚宴厅/桌上一张被忽略的请柬"}
  ]
}
```

---

## 2. 步骤 02 · 分场分镜表 schema

### 2.1 文档级字段（doc-level）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `step` | string | ✓ | 固定 `"02-storyboard"` |
| `episode` | string | ✓ | 集号 |
| `version` | string | ✓ | 如 `"v1"` |
| `date` | string | ✓ | `YYYY-MM-DD` |
| `source_narration` | object | ✓ | 指向所依据的 01 版本：`{episode, version}` |
| `shots_count` | number | | 镜头数（= `shots.length`） |
| `est_total_duration_sec` | number | | 预估总时长（秒） |
| `open_specs` | string[] | | 未定规格影响项（画幅等） |

### 2.2 镜头数组 `shots[]`（每条旁白 → 镜头）

**铁律：每条旁白都要对应到具体画面要素。** 每个 shot 通过 `linked_beat_id` 引用 01 的某个 beat；一个 beat 可拆 1 个或多个镜头。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `shot_id` | string | ✓ | 如 `"s1"` |
| `linked_beat_id` | string | ✓ | 外键 → 01 `beats[].beat_id`；**每条旁白至少 1 个镜头** |
| `shot_no` | string | ✓ | 镜头号，如 `"S1"`、`"S2"` |
| `characters` | string[] | ✓ | 出场人物（引用 `assets/_shared/characters.md`） |
| `action` | string | ✓ | 动作（可被生成/可拍到） |
| `scene` | string | ✓ | 场景 |
| `evidence_visual` | string | ✓ | 证据画面要素（具体、可生成） |
| `shot_type` | string | | 景别：特写/近景/中景/全景/远景 |
| `duration_sec` | number | | 本镜预估时长 |
| `ref_image_slot` | string\|null | | 参考图位 → 步骤 03/04 一致性资产引用（占位，资产定稿后回填） |
| `notes` | string | | 备注（衔接、音效点、字幕安全区提示等） |

### 2.3 JSON 范例（02）

```json
{
  "step": "02-storyboard", "episode": "EP-01", "version": "v1", "date": "2026-08-01",
  "source_narration": {"episode": "EP-01", "version": "v1"},
  "shots_count": 8, "est_total_duration_sec": 95, "open_specs": ["aspect_ratio"],
  "shots": [
    {"shot_id": "s1", "linked_beat_id": "b1", "shot_no": "S1",
     "characters": ["Serena", "James"], "action": "Serena 端起酒杯，目光掠过 James",
     "scene": "高档晚宴厅", "evidence_visual": "桌上被 James 忽略的豪门请柬特写",
     "shot_type": "中景", "duration_sec": 6, "ref_image_slot": null, "notes": "首镜；字幕安全区留底部"}
  ]
}
```

---

## 3. 01 ↔ 02 关联规则（后端/前端都要守）

- `shots[].linked_beat_id` 必须命中 01 某 `beats[].beat_id`（外键完整性）。
- **每个 beat 至少被 1 个 shot 引用**（不允许"有旁白无画面"）。
- 01 改版（v1→v2）后，02 的 `source_narration.version` 跟着升，并重检外键；02 产出归档到自己的版本目录。
- 前端评审：选中某镜头 → 高亮对应旁白（beat）；✏️ 修改要能回写到具体 beat/shot。

## 4. 待确认规格的影响

| 待确认项 | 默认 | 对 schema 的影响 |
|---|---|---|
| 旁白语言 | `zh` | `narration_language` 字段值；改语言重写 `beats[].narration_text` |
| 单集时长 | 1–2 分钟 | `word_count_target` / `est_duration_sec` 范围 |
| 画幅 | 竖屏 9:16 | 不影响 01/02 文本字段；影响 02 `shot_type` 倾向 + 步骤 03+ |
| 改编边界 | 保守 | `adaptation.boundary_confirmed` 与 `changes[]`；任何压缩/删改需在 `changes` 列出并等确认 |

---

> 评审/补充 welcome；字段如有调整我更新本文件并同步后端契约。剧本 DOCX + 集号一定，我就按本 schema 产出第 1 集解说词 v1。
