# 可视化产品 · Per-Step UI 规格 v0.1（MVP 聚焦）

> 作者：漫剧制作总控（per-step checkpoint 契约 + 每步交互规格 owner）。
> 前端实现 owner：可视化前端工程师。技术栈：React + Vite + TypeScript（已定）。
> 对齐：[PIPELINE-DESIGN.md](../PIPELINE-DESIGN.md) §1–§3、后端 [BACKEND-API-CONTRACT.md](./BACKEND-API-CONTRACT.md)、各步 content schema（[CONTENT-SCHEMA-01-02.md](./CONTENT-SCHEMA-01-02.md) 等）。
> 状态：v0.1，MVP 聚焦；每步深描随各步 schema 定稿再迭代。本文件由前端工程师代提交（总控暂无 git 写权限），后续迭代照此改。

---

## 1. 整体布局

- 左「对话区」：驱动任务（MVP 先 stub：输入集号 → 发起 run）。
- 右「工作区」：当前 step 的 checkpoint 视图。
- 顶栏：集号切换 + run 状态。

## 2. 通用 StepView（每步复用同一外壳，TS）

`<StepView step status version content onDecision />`

- `<StepHeader/>`：步号 · 名称 · 状态。
- `<StepContent step version contentSchema/>`：按步骤类型渲染该步 schema 产物。
- `<DecisionBar onDecision/>`：✅ approve / ✏️ revise / 🔄 regenerate / ↩️ rollback；revise 点开「修改意见」输入框。
- `<VersionBrowser versions current onSelect/>`：版本列表 + 切换 + 对比。

## 3. 步骤状态机（= 后端 `step.status`）

```
pending → running → awaiting_review →（ approve → 下一步
                                      / revise · regenerate → 重跑本步
                                      / rollback → 上步 ）/ failed
```

- decision 只在 `awaiting_review` 可点；`running` 禁用按钮 + 显示进度。

## 4. 每步 content 渲染（按步骤类型 switch）

- 01 / 02 编剧 schema：`beats[]` / `shots[]`。
- 03 / 04 / 05 图像视频 schema：图 / 视频预览 + 参数 / seed / 参考图 + 镜头筛选。
- 06 / 07 后期 schema：音频 + 字幕轨 + 成片 + 版本对比。
- 每步都挂版本浏览器 + ✅ / ✏️ / ↩️ / 🔄。

## 5. decision 字段（提交后端 `POST .../decision`）

```json
{ "action": "approve|revise|regenerate|rollback",
  "note": "（revise 必填）",
  "new_params": { },
  "operator": "...",
  "ts": "..." }
```

对齐总控定稿的 4 动作语义（见 BACKEND-API-CONTRACT §2.3）：只有 `approve` 推进；`revise`/`regenerate` 重跑当前步；`rollback` 回上一步。

## 6. MVP 范围

对话区 stub + 工作区单步 StepView + 四按钮 + 版本列表，先跑通主链路：

> 选集 → 发起 run → 某步 `awaiting_review` → 点 ✅ → 推进

字段 / 交互要调的说一声，总控更新本文件。
