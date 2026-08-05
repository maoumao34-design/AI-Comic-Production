# Checkpoint Decision Contract（漫剧制作总控 P0 · 定稿 v1.1）

> 每个 step 产出后摆给 maozh2 验收；decision 挂在「当前要 review 的 version」上（= `current_version`，见下「版本指针」）。
> 前后端 + 前端统一对这套（对齐 PIPELINE-DESIGN §2、后端 BACKEND-API-CONTRACT）。
> **v1.1（2026-08-05）**：补版本指针三分法 + 选用旧版；详见 [SELECT-VERSION-CONTRACT.md](./SELECT-VERSION-CONTRACT.md)。

## 4 个 decision 动作

| 动作 | 图标 | 语义 | 流转 |
|---|---|---|---|
| `approve` | ✅通过 | 当前审阅版通过 | 推进到下一步；该版成为 `is_latest` / `latest/` |
| `revise` | ✏️修改 | 用户给具体修改意见（哪句旁白 / 哪个镜头 / 哪个参数） | 带意见重跑当前步（不推进） |
| `regenerate` | 🔄重生 | 不指定改动、换参数 / seed | 重跑当前步（不推进） |
| `rollback` | ↩️回退 | 回到上一步 checkpoint | 重做上一步（当前步全部 `vN` 保留归档） |

> 选用旧版 **不是** 第五个 DecisionBar 按钮；见下方「版本指针」与 [SELECT-VERSION-CONTRACT.md](./SELECT-VERSION-CONTRACT.md)。

## 版本指针（审阅 vs 通过）与选用旧版

| 概念 | 行为 |
|---|---|
| 审阅指针 `current_version` | `GET .../current`；DecisionBar 作用对象 |
| 通过指针 `is_latest` + `latest/` | **仅** `approve` 移动；下游步消费 |
| 历史归档 `assets/.../vN/` | 每次产出新目录；**永不覆盖 / 永不删除** |
| 选用旧版 `select_version` | 同一步内把某历史 `vN` 设为 `current_version`；不退步、不删档、不改 `latest/` 直至再次 ✅ |

- ↩️ ≠ 选用旧版：↩️ 改 `current_step`；选用只改同一步的审阅指针。
- 预览 ≠ 选用：VersionBrowser 点击预览不写库；「选用此版」才 `POST .../select-version`。
- 选用后可再 ✅ / ✏️ / 🔄 / ↩️（语义同四决策；✏️🔄 以选用版为基线出新 `vN+1`）。

## 流程规则

- 只有 `approve` 推进到下一步；`revise` / `regenerate` 都重跑当前步（区别：revise 带用户编辑意见，regenerate 纯换参数 / seed）；`rollback` 退到上一步。
- decision（✅✏️🔄）只在 `step.status = awaiting_review` 时可提交；`running` 时禁用。↩️ 门禁见任意态回退实现（#13/#14）：`awaiting_review|approved|failed` 等可打回。
- `select_version` 门禁与 ✅✏️🔄 相同：仅当前步 + `awaiting_review`。
- 每次 decision / select_version 记可回溯字段进 `meta.md` / `params.json` / audit。

## decision 字段（提交后端 `POST .../decision`）

```json
{
  "action": "approve | revise | regenerate | rollback",
  "note": "string  (revise 必填：修改意见)",
  "params_override": "object (regenerate 可选：新参数/seed，与前后端实现一致)",
  "operator": "string",
  "ts": "ISO8601"
}
```

选用旧版走独立写接口（权威）：

```json
POST /api/v1/episodes/{episode_id}/steps/{step}/select-version
{ "version": "v2", "note": "optional", "operator": "...", "client_request_id": "uuid" }
```

## 失败 / 重试

- 失败 / 重生超阈值（PIPELINE §5，默认 3 次）→ 暂停 escalation（找总控或 maozh2），后端置 `paused`，不无限重跑。

## 每步 content schema

- 各步 owner 给（编剧 01/02、图像视频 03/04/05、后期 06/07）；本契约只定义通用 decision + 版本指针，每步展示字段见各步 schema + `docs/PER-STEP-UI-SPEC.md`。
