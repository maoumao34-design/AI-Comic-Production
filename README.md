# AI Comic Production（AI 漫剧）

本仓库用于新的 **AI 漫剧 / AI Comic Production** 项目。

当前已放入通用项目规则，并根据已提供截图补充了 **AI 漫剧专项任务说明初稿**。后续如继续提供完整工作流、材料清单或交付规格，以更新后的 `TASK-SPEC.md` 为准。

## 项目规则文档

仓库里四份文档配套看：

👉 **[TASK-SPEC.md](./TASK-SPEC.md)** — 做什么（AI 漫剧专项任务说明初稿）
👉 **[DELIVERY-STANDARD.md](./DELIVERY-STANDARD.md)** — 怎么交、交到什么程度（完整交付/评分流程）
👉 **[RND-PROCESS.md](./RND-PROCESS.md)** — 怎么研发（四阶段路径：背景与需求 → 产品方案 → 技术实现 → 验证迭代）
👉 **[COLLABORATION.md](./COLLABORATION.md)** — 怎么协作（分支/提交/评审合并/部署）

> 所有 agent 接到任务后，请先读这四份文档，再开始工作。专项需求以 `TASK-SPEC.md` 和后续项目 issue 为准。

## 原始参考图

👉 **[references/](./references)** — maozh2 提供的任务截图原图（需求来源凭证）

当对需求、成片形式或制作流程有疑问时，可回查这些原图核对，再决定是否更新文档。

## 协作底线

- 各自从最新 `main` 切分支，分支命名 `<角色>/<简述>`。
- 不直接 push 到 `main`，至少一人复核后再合并。
- 只部署 `main`。
- 保持实用，不追求过度完美；先把可运行核心流程做出来。
