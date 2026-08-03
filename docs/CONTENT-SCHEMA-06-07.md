# 步骤 06 / 07 · Content Schema

> 作者：后期合成（步骤 06 配音字幕 / 07 后期合成 owner）。
> 对齐：[BACKEND-API-CONTRACT.md](./BACKEND-API-CONTRACT.md) §2.2 / §5（通用外壳锁定，本文件只定义 `StepVersion.content` 的 06/07 专属字段）、[PIPELINE-DESIGN.md](../PIPELINE-DESIGN.md) §1（06/07 输入输出）§3（版本归档）、[CHECKPOINT-CONTRACT.md](./CHECKPOINT-CONTRACT.md)（decision 动作词）。
> 状态：草案 v0.1，供 ComfyUI 工程师（后端校验）、可视化前端工程师（渲染）、PM 复核。**delivery 规格（画幅/时长/语言/编码）未定前相关字段用占位/默认值，maozh2 拍板后校准——不阻塞 schema。**
> 约定（同 BACKEND-API-CONTRACT §2.2）：产物**文件**（旁白 mp3、字幕 srt、成片 mp4、剪辑工程文件等）走 `artifacts[]`；`content` 只放**结构化字段**（cue 表、参数、引用、元数据），后端按本 schema 校验/存储，前端按它渲染。

---

## 0. 归档路径（对齐 PIPELINE-DESIGN §3）

- 06 配音字幕：`assets/<集号>/06-voice-sub/<版本>/{prompt.md, params.json, refs/, output.*, meta.md}`
- 07 后期合成：`assets/<集号>/07-final/<版本>/{prompt.md, params.json, refs/, output.*, meta.md}`
- 每步 `latest` 指针 → 当前 approve 通过的版本。

---

## 1. 步骤 06 · 配音字幕 content

输入：`01 解说词`（latest）+ `05 分段视频`（latest）。产出：旁白音频（ElevenLabs TTS）+ 节奏对齐字幕轨。

```json
{
  "voiceover": {
    "tts": "elevenlabs",
    "model": "eleven_multilingual_v2",
    "voice_id": "<占位，选定音色后填>",
    "language": "<占位：旁白语言，待交付规格>",
    "speed": 1.0,
    "stability": 0.5,
    "similarity_boost": 0.75,
    "audio": {
      "type": "audio",
      "url": "assets/<集号>/06-voice-sub/<版本>/output_voiceover.mp3",
      "duration_ms": 0
    }
  },
  "subtitle_track": {
    "format": "srt",
    "language": "<占位：字幕语言，待交付规格>",
    "burn_in": true,
    "file_url": "assets/<集号>/06-voice-sub/<版本>/output_subs.srt",
    "cues": [
      { "index": 1, "start_ms": 0, "end_ms": 0, "text": "" }
    ]
  },
  "script_ref": "assets/<集号>/01-script/latest/",
  "clips_ref":  "assets/<集号>/05-clips/latest/"
}
```

字段说明：
- `voiceover.*`：TTS 参数（音色/语速/稳定性/相似度），音色选择归档可复现；`audio` 是旁白音频产物（文件本体在 `artifacts[]`，这里给 url+时长）。
- `subtitle_track.cues[]`：字幕时间轴，前端用它画字幕轨 + 随旁白同步预览；`start_ms/end_ms` 对齐到旁白（和分段视频）的节奏点。
- `script_ref` / `clips_ref`：回指上游 01 解说词与 05 分段视频的 latest 版本，保证可追溯。
- 字幕文件本体（srt）与旁白（mp3）走 `artifacts[]`，`content` 只存结构化 cue 表 + 参数 + 引用。

---

## 2. 步骤 07 · 后期合成 content

输入：`05 分段视频`（latest）+ `06 声音字幕`（latest）。产出：成片（剪辑拼接 / 节奏统一 / 字幕 / 音乐 / 音效 / 调色 / 导出）。

```json
{
  "cut": {
    "duration_ms": 0,
    "aspect": "<占位 9:16>",
    "resolution": [1080, 1920],
    "fps": 30,
    "video": {
      "type": "video",
      "url": "assets/<集号>/07-final/<版本>/output_final.mp4",
      "container": "mp4",
      "vcodec": "h264",
      "acodec": "aac"
    }
  },
  "tracks": {
    "voiceover_ref": "assets/<集号>/06-voice-sub/latest/",
    "clips_ref":     "assets/<集号>/05-clips/latest/",
    "music": [ { "url": "", "label": "BGM", "gain_db": -18 } ],
    "sfx":   [ { "url": "", "at_ms": 0, "label": "" } ]
  },
  "subtitle": { "burn_in": true, "language": "<占位>" },
  "color": { "lut": "", "grade": "" },
  "edit_project": {
    "tool": "ffmpeg",
    "project_file_url": "assets/<集号>/07-final/<版本>/edit_project.json",
    "export_params": {}
  },
  "delivery_spec_id": "<占位，成片规格定后回填>"
}
```

字段说明：
- `cut.*`：成片几何/编码参数（时长/画幅/分辨率/fps/容器/编码），成片 mp4 本体走 `artifacts[]`，这里给 url+元数据；这些字段随交付规格定稿校准。
- `tracks.*`：混音/合层轨道——旁白 ref（→06）、分段视频 ref（→05）、背景音乐 `music[]`（带增益）、音效 `sfx[]`（带时间点）。
- `subtitle.burn_in`：字幕是否烧录进成片（对齐样片"烧录字幕"形式参考）。
- `color.*`：调色（LUT / grade 名称），便于复现。
- `edit_project`（铁律落地）：**剪辑工程 + 导出参数一并归档**，工具用 ffmpeg/剪映/PR 等；保证可回退、可复现，不丢工程文件。
- `delivery_spec_id`：指向确认后的成片交付规格版本；规格未定前占位。

---

## 3. 与 checkpoint 的关系

- 06 / 07 各自作为一个 checkpoint 步骤，挂在 BACKEND-API-CONTRACT 的 `StepVersion` 上；maozh2 用 `approve / revise / regenerate / rollback`（CHECKPOINT-CONTRACT）反馈。
- `revise`/`regenerate` 重跑当前步出新版本（旧版 `superseded`，归档保留）；只有 `approve` 推进到下一步、并标记 `latest`。
- 成片（07）终版需 maozh2 显式 `approve` 确认，不自行定终版。

---

## 4. 待确认（不阻塞 schema）

1. **delivery 规格**：旁白/字幕语言、单集时长、画幅（样片为竖屏，形式参考）、分辨率、导出格式/编码 → 影响 06 `voiceover.language` / `subtitle_track.language` 与 07 `cut.*` 默认值。
2. **ElevenLabs 账号/Key**：06 TTS 前置（走 ComfyUI 工程师胶水代码，key 走 custom_env）。
3. 字幕时间轴对齐策略（按旁白节拍 vs 按分段视频切点）→ 06 `cues[]` 精确生成规则，出第一集时定。
