# 步骤 03/04/05 内容 Schema（图像视频生成执行）

> 对齐 ComfyUI工程师的后端资源模型（episode/run/step/version/decision）与总控的 per-step checkpoint 契约。
> 本文件定义 03 一致性资产 / 04 关键帧 / 05 分段视频 三步的内容字段（后端校验、前端渲染用）。
> Owner：图像视频生成执行（883670e6）。action 动作词/流程以**总控**定稿为准（先按 approve/revise/rollback/regenerate 占位）。

## 通用包装（每步每条产物都带）
| 字段 | 说明 |
|---|---|
| `episode_id` | 集号 |
| `step` | "03" / "04" / "05" |
| `version` | v<N> |
| `status` | draft \| latest \| locked |
| `prompt` | 生成 prompt（文本） |
| `params` | `{model, seed, steps, cfg, ...}` |
| `refs` | 参考图路径/ID 数组 |
| `output` | `{url, type: image\|video, thumbnail?}` |
| `meta` | `{note, created_at, ...}` |

归档路径：`assets/<集号>/<step>-<name>/<subject_id>/v<N>/{prompt.md, params.json, refs/, output.*, meta.md}`；latest 用软链/指针。

## 03 一致性资产（subject 粒度，一个集可有多条）
- `subject_type`：character \| costume \| expression \| scene \| prop
- `subject_id`：角色/场景/道具 ID
- `views`：character 时 front / side / back（三视图，各一条 output，或一图多 view）
- `consistency_ref`：跨集基准资产 ID（定稿后复用，后续集 + 04/05 引用它）
- `consistency_check`：`{passed: bool, issues: []}`（角色一致性自检结果）
- 定稿后 `status=locked`，作为 04/05 的基准资产入口

## 04 关键帧（每帧一条）
- `kf_id`
- `source_shot_id`：来自 02 分镜表的行/镜头号
- `shot`：`{景别, angle, composition}`
- `asset_refs[]`：引用的 03 资产 ID（锁定角色一致性）
- `characters_in_frame[]`：入帧角色 ID

## 05 分段视频（每段一条，4–15s）
- `seg_id`
- `duration_s`：4–15
- `keyframe_refs`：`{first, last}`（首尾帧，衔接用）
- `prompt`：`{shot, action, dialogue, emotion, sfx}`
- `selection`：`{decision: adopt\|reject, reason, consistency_check}`（镜头筛选记录）

## 筛镜头（横跨 05）
对每条 05 生成结果记录 `selection`；跨镜头一致性不通过 → 标记 + regenerate，记 `meta`。采用/淘汰理由留痕，可回溯。

---
*需要我把本文件 PR 进 `docs/` 的话，给我仓库写权限或工程师直接搬。action 动作词以总控定稿为准，content schema 按上面这版起，要调整跟你说。*
