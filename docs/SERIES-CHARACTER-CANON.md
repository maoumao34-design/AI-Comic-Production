# 系列角色/素材 Canon（跨集连贯性）

> 响应导演（maozh2）要求：同一部剧不同集的相同人物必须连贯；**每集最终采用的素材保留，供后续集作参考**，避免角色漂移。  
> Owner：ComfyUI 平台集成（路径/胶水/归档）；出图仍走有 GPU 的本机 agent。  
> 对齐：`PIPELINE-DESIGN.md` §3 · `STEP-CONTENT-SCHEMA-03-04-05.md`（`consistency_ref`）· EP01 handoff。  
> 文本侧角色 bible（编剧）：`assets/_shared/characters.md`（branch `script/series-character-bible`）——本文件管**定稿图像资产**晋升与引用，不替代文字设定。

## 1. 原则

1. **集内定稿 ≠ 可删**：EP-0N 步骤 03 人审 ✅ 后，角色类 subject **必须晋升**到系列 canon，不得只留在单集目录。
2. **后续集优先引用 canon**：EP-02+ 的 03/04/05 生成时，`refs/` / `consistency_ref` 指向系列 canon，而不是从零抽卡。
3. **不覆盖历史**：晋升写新版本目录或更新 `latest` 指针；旧 canon 版本保留可回退。
4. **诚实状态**：无真图时只建索引/指针，`status=awaiting_source_images`；禁止用占位图冒充定稿。

## 2. 目录布局

```
assets/_series/<series_id>/
  index.json                          # 系列索引（角色/场景等登记）
  characters/<subject_id>/            # subject_id 用字面路径，如 char/serena
    latest -> vN/                     # 软链或 README 指针
    v1/
      source_episode.json             # 来源集/版本/路径
      params.json
      meta.md
      output.* | outputs/             # 定稿媒体（晋升后）
      refs/                           # 可选：三视图补充
  costumes/… · scenes/… · props/…     # 可选扩展（同规则）
```

- `series_id` 本剧锁定：`heiress-blacklisted`（《The Heiress Blacklisted Her Husband》）。
- 单集仍落在 `assets/EP-0N/03-assets/<ver>/`；canon 是**跨集复用入口**，不是替代集内归档。

## 3. `consistency_ref` 约定

步骤 03/04/05 内容里：

| 字段 | 含义 |
|---|---|
| `consistency_ref` | 系列 canon 路径，如 `assets/_series/heiress-blacklisted/characters/char/serena/latest/` |
| `source_episode` | 首次定稿来源，如 `EP-01/03-assets/v1` |
| `status` | `locked`（可复用）\| `awaiting_source_images` \| `draft` |

EP-02+ 开跑 03 前：对每个复用角色跑 `canon-check`；缺 canon → 先晋升或明示 blocker，禁止静默新画一张「另一个脸」。

## 4. CLI（`scripts/ep01-cli.mjs`）

```powershell
# 初始化系列索引（无图也可）
node scripts/ep01-cli.mjs canon-init --series heiress-blacklisted

# 将某集 03 角色 subject 晋升到系列 canon（有图才写 locked）
node scripts/ep01-cli.mjs canon-promote --series heiress-blacklisted --episode EP-01 --version v1

# 检查后续集可引用的 canon 是否齐
node scripts/ep01-cli.mjs canon-check --series heiress-blacklisted --episode EP-01
```

`handoff-check` 会附带 `series_canon` 摘要（不阻断 GPU 回灌等待）。

## 5. 接棒（与 EP01 handoff 衔接）

| 阶段 | Owner | 动作 |
|---|---|---|
| EP-01 步骤03 真出图 + 人审 ✅ | 导演 GPU agent → maozh2 | 定稿 |
| 晋升角色到系列 canon | **ComfyUI 平台集成** | `canon-promote`；核对 `index.json` |
| EP-02+ 开跑 | 总控 / 图像执行 | 生成前 `canon-check`；refs 指向 canon |
| 角色改款 | maozh2 拍板 | 新 canon 版本 + 更新 `latest`；旧版保留 |

## 6. 当前状态（EP01）

- 系列索引已脚手架：`assets/_series/heiress-blacklisted/index.json`
- EP-01 步骤03 仍 `images_generated=false` → 角色条目为 `awaiting_source_images`
- GPU 回灌并人审通过后执行 `canon-promote`，再开 EP-02+

---
*不伪造平台已连接；无真图不写 locked。*
