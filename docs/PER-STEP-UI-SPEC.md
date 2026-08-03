# 可视化产品 · Per-Step UI 规格 v0.1（MVP 聚焦）

> 作者 / owner：漫剧制作总控（per-step checkpoint 契约 + 每步交互规格 owner）。
> 前端实现 owner：可视化前端工程师。技术栈：React + Vite + TypeScript（已定）。
> 对齐：[PIPELINE-DESIGN.md](../PIPELINE-DESIGN.md) §1–§3、后端 [BACKEND-API-CONTRACT.md](./BACKEND-API-CONTRACT.md)、各步 content schema（[CONTENT-SCHEMA-01-02.md](./CONTENT-SCHEMA-01-02.md) 等）、[CHECKPOINT-CONTRACT.md](./CHECKPOINT-CONTRACT.md)。
> 状态：v0.1，MVP 聚焦；每步深描随各步 schema 定稿再迭代。
>
> 注：本文件为总控定稿的权威副本。`fe/mvp-shell` 分支早期曾由前端工程师代提交过一版（当时总控暂无 git 写权限），那版的 §5 decision 字段写的是 `new_params`，**已在此定稿版统一为 `params_override`**（与 `CHECKPOINT-CONTRACT.md`、前端 `types.ts`/`DecisionBar`、后端实现一致）。合并两分支时本文件为准。

---

## 1. 整体布局

- 顶栏：集号切换 + run 状态 + 平台健康（ComfyUI / 视频模型 / ElevenLabs）+ MOCK/LIVE 标识。
- 左「对话区」：驱动任务（MVP 先 stub：选/建集号 → 发起 run，并展示 run 日志）。
- 右「工作区」：当前 step 的 checkpoint 视图。

## 2. 通用 StepView（每步复用同一外壳，TS）

`<StepView current versions busy onDecision />`（`current` = 当前要 review 的 latest 版本）

- `<StepHeader/>`：步号 · 名称 · 状态 · 版本号 · latest 标 · 模型/seed · 失败信息。
- `<StepContent step version contentSchema/>`：按步骤类型渲染该步 schema 产物。
- `<DecisionBar onDecision/>`：✅ approve / ✏️ revise / 🔄 regenerate / ↩️ rollback；revise 点开「修改意见」输入框，regenerate 点开「换 seed」输入框。
- `<VersionBrowser versions current onSelect/>`：版本列表 + 切换（点历史版本预览，决策仍作用于 latest）+ 对比（MVP 先做列表+切换，对比留待后续）。

## 3. 步骤状态机（= 后端 `step.status`）

```
pending → running → awaiting_review →（ approve → 下一步
                                      / revise · regenerate → 重跑本步（出新版）
                                      / rollback → 上步 ）/ failed
```

- decision 只在 `awaiting_review` 可点；`running` 时按钮禁用 + 显示进度/状态提示。

## 4. 每步 content 渲染（按步骤类型 switch）

- 01 / 02 编剧 schema：`beats[]` / `shots[]`（已实现 `Script01View` / `Storyboard02View`）。
- 03 / 04 / 05 图像视频 schema：图 / 视频预览 + 参数 / seed / 参考图 + 镜头筛选。
- 06 / 07 后期 schema：音频 + 字幕轨 + 成片 + 版本对比。
- 03–07 在各步 schema 定稿前先用 `GenericStepView` 占位（已实现），定稿后逐步替换。
- 每步都挂版本浏览器 + ✅ / ✏️ / ↩️ / 🔄。

## 5. decision 字段（提交后端 `POST .../decision`）

```json
{
  "version": "v3",
  "action": "approve | revise | regenerate | rollback",
  "note": "（revise 必填：具体修改意见）",
  "params_override": { "seed": 999 },
  "client_request_id": "uuid（幂等）"
}
```

- 字段名 **`params_override`**：与 `CHECKPOINT-CONTRACT.md`、前端 `Decision.params_override`、后端实现一致（regenerate 可选，用来换 seed/参数）。
- 语义对齐总控定稿的 4 动作（见 [CHECKPOINT-CONTRACT.md](./CHECKPOINT-CONTRACT.md)）：只有 `approve` 推进；`revise`/`regenerate` 重跑当前步（出新版，仍 `awaiting_review`）；`rollback` 回上一步（当前版本置 `superseded` 保留归档）。
- 只在 `step.status = awaiting_review` 可提交；`running` 等状态后端返 409。

## 6. MVP 范围

对话区 stub + 工作区单步 StepView + 四按钮 + 版本列表，先跑通主链路：

> 选/建集 → 发起 run → 某步 `awaiting_review` → 点 ✅ → 推进

附：内置 mock 后端（`api/mock.ts`）完整模拟上述 decision 语义，后端未就绪也能跑通主链路；后端就绪切 `api/client.ts`（RealApi，打 `/api/v1`），前端代码无需改。

字段 / 交互要调的说一声，总控更新本文件。
