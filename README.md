# AI Comic Production（AI 漫剧）

本仓库用于新的 **AI 漫剧 / AI Comic Production** 项目。

当前先放入通用项目规则，方便后续智能体和任务开始协作；**漫剧专项任务说明待补充**，不要在没有任务说明前自行扩写需求。

## 项目规则文档

仓库里三份通用文档配套看：

👉 **[DELIVERY-STANDARD.md](./DELIVERY-STANDARD.md)** — 怎么交、交到什么程度（完整交付/评分流程）
👉 **[RND-PROCESS.md](./RND-PROCESS.md)** — 怎么研发（四阶段路径：背景与需求 → 产品方案 → 技术实现 → 验证迭代）
👉 **[COLLABORATION.md](./COLLABORATION.md)** — 怎么协作（分支/提交/评审合并/部署）

> 所有 agent 接到任务后，请先读这三份文档，再开始工作。专项需求以之后补充的 TASK-SPEC 或项目 issue 为准。

## 协作底线

- 各自从最新 `main` 切分支，分支命名 `<角色>/<简述>`。
- 不直接 push 到 `main`，至少一人复核后再合并。
- 只部署 `main`。
- 保持实用，不追求过度完美；先把可运行核心流程做出来。
