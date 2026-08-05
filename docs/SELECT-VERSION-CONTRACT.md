# 选用旧版契约增量（指回历史 vN）

> 作者 / owner：漫剧制作总控。依据 maozh2 seq208 + 总控 seq210 三分法。  
> 对齐：[CHECKPOINT-CONTRACT.md](./CHECKPOINT-CONTRACT.md)、[PER-STEP-UI-SPEC.md](./PER-STEP-UI-SPEC.md)、[BACKEND-API-CONTRACT.md](./BACKEND-API-CONTRACT.md)（本文件为增量；BE owner 合入 API 表）。  
> 状态：v1 可执行契约。本单只定契约，**不要求本 PR 实现完成**；FE/BE 下一小步按本文开工。

---

## 0. 三分法（先分清，再动手）

| # | 名称 | 做什么 | 不做什么 |
|---|---|---|---|
| 1 | ↩️ `rollback` | 退到**上一步**人审（`current_step` − 1） | 不删本步任何 `vN` |
| 2 | 历史归档 | 每步每次产出落 `assets/<集>/<步>/vN/` | **永不覆盖 / 永不删除** |
| 3 | 选用旧版 `select_version` | **同一步**内把某历史 `vN` 设为当前审阅版 | 不退步；不删更新的 `vN`；不立刻改 `latest` |

现网 `VersionBrowser` 仅「预览历史版、决策仍打在当前审阅版」——**预览 ≠ 选用**。本增量补上「选用此版」。

---

## 1. 两个指针（必须拆开）

后端已有（`engine.mjs` / `BACKEND-API-CONTRACT` §4.6），产品文案必须区分：

| 指针 | 字段 / 落盘 | 谁移动它 | 含义 |
|---|---|---|---|
| **审阅指针** | `step.current_version`；`GET .../steps/{step}/current` | 新产出、`select_version` | 导演正在审、DecisionBar 作用的那一版 |
| **通过指针** | `version.is_latest` + `assets/.../latest/` | **仅** `approve` | 下游步消费的「已通过」版 |

铁律：

- DecisionBar 的 ✅/✏️/🔄/↩️ **永远**作用于 `current_version`（`GET .../current`），**从不**作用于预览态，也**不**要求该版已经是 `is_latest`。
- `select_version` **只**改审阅指针；**不**改 `is_latest` / `latest/`。
- 只有随后的 `approve` 才把通过指针挪到当前审阅版，并推进下一步。

错误旧表述（作废）：「决策作用于 latest」。应改为：「决策作用于当前审阅版（`current`）。」

---

## 2. 状态机增量

在既有：

```
pending → running → awaiting_review →（approve → 下一步
                                    / revise·regenerate → 重跑本步出新 vN
                                    / rollback → 上步）/ failed
```

增加同一步内边：

```
awaiting_review ──select_version(vK)──▶ awaiting_review
   current_version := vK
   （step 不变；归档全保留；is_latest / latest/ 不变）
```

选用后可再走四决策：

| 选用后动作 | 效果 |
|---|---|
| ✅ `approve` | 当前审阅版（刚选用的 vK）→ `approved` + `is_latest=true`，写 `latest/`，推进下一步 |
| ✏️ `revise` | 以 vK 内容 + `note` 为基线重跑 → 新建 `vN+1`，`current_version=vN+1`，仍 `awaiting_review` |
| 🔄 `regenerate` | 以 vK 参数（可 `params_override`）重跑 → 新建 `vN+1`，同上 |
| ↩️ `rollback` | 语义不变：退上一步；本步全部 `vN`（含比 vK 新的）仍保留 |

`revise` / `regenerate` 出的新版继续累加版本号（`vN+1`），**绝不**覆盖被选用的旧档。

---

## 3. API 增量（BE 实现）

### 3.1 端点（推荐独立写接口，不挤进 DecisionBar 四键）

```
POST /api/v1/episodes/{episode_id}/steps/{step}/select-version
```

Request：

```json
{
  "version": "v2",
  "note": "optional：为何改回此版",
  "operator": "maozh2",
  "client_request_id": "uuid"
}
```

Response（与 `POST .../decision` 同形，瘦身）：

```json
{
  "result": {
    "run_id": "...",
    "status": "paused_at_checkpoint",
    "current_step": "03",
    "current_version": "v2"
  }
}
```

Envelope / 幂等 / 错误形与 `BACKEND-API-CONTRACT` §4.6 一致。

### 3.2 服务端规则

1. `episode.current_step == step`，否则 **409**（只能改当前步审阅指针）。
2. 该步 `status`（或 `current_version.status`）∈ `awaiting_review`（与 ✅✏️🔄 同门禁）；`running` → **409**。  
   - ↩️ 任意态门禁（#13/#14）**不**自动套用到选用旧版；选用只在人审态。
3. `version` 必须已存在于该步 `versions[]`，且不是 `latest` 伪目录；否则 **404**。
4. 若 `version == current_version` → **200 幂等**（不改状态、可记 audit 也可跳过）。
5. 效应：
   - 旧 `current_version`：若 `status == awaiting_review` 且 ≠ 目标 → 置 `superseded`（归档保留）。
   - 目标版：`status = awaiting_review`；`current_version = version`。
   - **不**改任何版的 `is_latest`；**不**重写 `assets/.../latest/`。
   - **不**删除 / 覆盖任何 `vN/`。
   - **不**改 `current_step`。
6. 审计：写入 decision/audit 日志（建议 `action: "select_version"`），并追加该版 `meta.md` 一行：`select_version from=vX to=vK by=… at=…`。  
   - 不新增 DecisionBar 第五键；审计 action 与四决策并列入库即可。

### 3.3 与 `GET .../current` / `is_latest`

- `GET .../current` → 始终返回 `current_version`（选用后即目标旧版）。
- 列表里可同时出现：某旧版带「审阅」标记（`version == current_version`），另一版带 `is_latest`（上次通过的）。两者可以不是同一版——这是预期。

### 3.4 （可选）决策体兼容

若 BE 希望单入口，也可接受：

```json
POST .../decision
{ "action": "select_version", "target_version": "v2", "client_request_id": "..." }
```

但 FE 须走 VersionBrowser「选用此版」，**不要**把该 action 放进 DecisionBar。契约以 §3.1 独立端点为权威；双入口需行为完全一致。

---

## 4. UI 增量（FE 实现）

### 4.1 VersionBrowser

保留点击 = **预览**（本地 state，不打 API）。

新增：

- 预览非当前审阅版时：主操作钮 **「选用此版」** → 调 `POST .../select-version`。
- 当前审阅版：徽标 **「审阅」**（或 `current`）；`is_latest` 仍显示 **「latest」**（通过指针）。两徽标可并存于不同行，也可同版双标。
- 禁用「选用此版」当：`busy` / step 非 `awaiting_review` / 已是当前审阅版。

### 4.2 StepView 文案

作废：

> 正在预览历史版本…决策作用于 latest …

改为：

> 正在预览 `vX`（只读）。点「选用此版」后，✅/✏️/🔄 将作用于该版；不会删除更新的版本，也不会退到上一步。

选用成功后：`current` prop 刷新为 API 返回的 `current_version`，预览复位到该版；DecisionBar 立即对该版生效。

### 4.3 组件签名（建议）

```ts
<VersionBrowser
  versions={versions}
  current={current}           // = GET .../current
  preview={preview}           // 本地预览，可 null
  onPreview={setPreview}
  onSelectVersion={(v) => api.selectVersion(ep, step, v.version)}  // 写操作
  busy={busy}
/>
```

`onSelect` 若仍存在：语义升级为「选用」或拆成 `onPreview` / `onSelectVersion`，避免预览误触发写库。

---

## 5. 归档 / meta 约定

- 路径不变：`assets/<集号>/<步骤目录>/vN/`；`latest/` 仅 approve 时更新 README/指针。
- `select_version` **不**新建目录、**不**拷贝产物；只改审阅指针 + 审计。
- 各步 README 可增加一行：`reviewing: vK`（可选；以 API `current_version` 为准）。

---

## 6. 验收清单（给 FE/BE 联调）

- [ ] 同一步存在 v1…v3，`current=v3` 时选用 v1 → `GET .../current` 为 v1；v2/v3 目录仍在。
- [ ] 选用后 `is_latest` / `latest/` 仍指向选用前的通过版（若尚无 approve 过则为无/旧值），直到对 v1 ✅。
- [ ] 选用 v1 后 ✅ → v1 变 `is_latest`，推进下一步；下游读 `latest` 得 v1。
- [ ] 选用 v1 后 ✏️/🔄 → 出现 v4（或下一号），内容/参数基线来自 v1；v1 归档保留。
- [ ] 选用 ≠ ↩️：`current_step` 不变。
- [ ] 预览历史版不调 select API；只有「选用此版」才写。
- [ ] `running` / 非当前步 选用 → 409。

---

## 7. 非目标（本增量不做）

- 跨步「把 04 的某版接到 03」——用 ↩️，不用选用。
- 删除/隐藏历史版、版本 squash。
- Diff/对比 UI（仍可后续做；不阻塞选用）。
- 已推进到下游后再改上游 `latest` 的级联重跑策略（沿用现有 rollback 语义即可）。

---

## 8. 文档挂载

| 文件 | 本增量要改什么 |
|---|---|
| `CHECKPOINT-CONTRACT.md` | 增加「版本指针 + select_version」节；四决策不变 |
| `PER-STEP-UI-SPEC.md` | VersionBrowser：预览 vs 选用；文案与双徽标 |
| `BACKEND-API-CONTRACT.md` | §4.x 增加 `POST .../select-version`（BE owner 可在实现 PR 合入，或随本 PR 由总控加表项） |

---

## 修订

| 版本 | 日期 | 说明 |
|---|---|---|
| v1 | 2026-08-05 | 首版可执行契约（seq208/210） |
