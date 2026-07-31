# Checkpoint Decision Contract（漫剧制作总控 P0 · 定稿 v1）

> 每个 step 产出后摆给 maozh2 验收；decision 挂在「当前要 review 的 version」上。
> 前后端 + 前端统一对这套（对齐 PIPELINE-DESIGN §2、后端 BACKEND-API-CONTRACT）。

## 4 个 decision 动作

| 动作 | 图标 | 语义 | 流转 |
|---|---|---|---|
| `approve` | ✅通过 | 当前版本通过 | 推进到下一步 |
| `revise` | ✏️修改 | 用户给具体修改意见（哪句旁白 / 哪个镜头 / 哪个参数） | 带意见重跑当前步（不推进） |
| `regenerate` | 🔄重生 | 不指定改动、换参数 / seed | 重跑当前步（不推进） |
| `rollback` | ↩️回退 | 回到上一步 checkpoint | 重做上一步（当前版本保留归档） |

## 流程规则

- 只有 `approve` 推进到下一步；`revise` / `regenerate` 都重跑当前步（区别：revise 带用户编辑意见，regenerate 纯换参数 / seed）；`rollback` 退到上一步。
- decision 只在 `step.status = awaiting_review` 时可提交；`running` 时禁用。
- 每次 decision 记可回溯字段（见下）进 `meta.md` / `params.json`。

## decision 字段（提交后端 `POST .../decision`）

```json
{
  "action": "approve | revise | regenerate | rollback",
  "note": "string  (revise 必填：修改意见)",
  "new_params": "object (regenerate 可选：新参数/seed)",
  "operator": "string",
  "ts": "ISO8601"
}
```

## 失败 / 重试

- 失败 / 重生超阈值（PIPELINE §5，默认 3 次）→ 暂停 escalation（找总控或 maozh2），后端置 `paused`，不无限重跑。

## 每步 content schema

- 各步 owner 给（编剧 01/02、图像视频 03/04/05、后期 06/07）；本契约只定义通用 decision，每步展示字段见各步 schema + `docs/PER-STEP-UI-SPEC.md`。
