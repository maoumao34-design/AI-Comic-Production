# EP-01 · 步骤 03 一致性资产 Prompt 包（本机/Comfy 可跑）

> 用途：在有 GPU 的机器上，配合 `workflows/03-assets/character-sheet.api.json` + `backend/platforms/comfyui.mjs` 出图，归档到 `assets/EP-01/03-assets/<version>/`。
> 角色名按剧名《The Heiress Blacklisted Her Husband》占位；定稿后以 01/02 人审通过的剧本/分镜为准替换描述。

## 资产清单（建议首轮）

| subject_id | subject_type | 说明 | 优先视图 |
|---|---|---|---|
| char-heiress | character | 女主（heiress） | front / side / back |
| char-husband | character | 男主（husband） | front / side / back |
| scene-estate | scene | 庄园/豪宅主场景 | establishing |
| prop-blacklist-notice | prop | 关键道具（黑名单通知/文件） | hero |

## 通用约束（所有条目追加）

- Medium: vertical comic / illustrated drama still, clean line, consistent character design
- Aspect: vertical 9:16 friendly (workflow 默认 832×1216)
- Consistency: same face, hair, outfit silhouette across views
- Negative（默认）：`blurry, low quality, deformed hands, extra limbs, watermark, text, logo, photorealistic`

## char-heiress

**positive（三视图一张 / character sheet）**

```
comic character reference sheet of a young heiress, elegant modern dress, cold confident expression, front view side view back view on one sheet, consistent face and outfit, clean white background, vertical composition, high detail
```

## char-husband

**positive**

```
comic character reference sheet of a young husband, sharp suit, restrained tense expression, front view side view back view on one sheet, consistent face and outfit, clean white background, vertical composition, high detail
```

## scene-estate

**positive**

```
comic establishing shot of a luxurious estate foyer, dramatic lighting, vertical composition, no people, consistent architecture for reuse, high detail
```

## prop-blacklist-notice

**positive**

```
comic prop sheet of a formal blacklist notice document on a table, readable silhouette not real text, clean product-style lighting, vertical composition, high detail
```

## 跑法（摘要）

见 [`docs/LOCAL-GPU-RUNBOOK.md`](../../docs/LOCAL-GPU-RUNBOOK.md)。把上表 positive 写入工作流节点 `4`（或 `node scripts/comfy-run-workflow.mjs --positive "..."`），出图后归档。
