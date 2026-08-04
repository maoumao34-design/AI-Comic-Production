# AI 漫剧制作 · 可视化产品（前端）

把整条漫剧制作流水线变成一个可对话、可操作、可部署的网页：**对话区**驱动任务，**工作区**展示每步 checkpoint 产出并收 ✅/✏️/↩️/🔄 反馈，支持版本归档浏览与多集切换。

- 技术栈：**React + Vite + TypeScript**
- 契约对齐：[`docs/PER-STEP-UI-SPEC.md`](../docs/PER-STEP-UI-SPEC.md)（总控）、[`docs/BACKEND-API-CONTRACT.md`](../docs/BACKEND-API-CONTRACT.md) v0.2（ComfyUI 工程师）、各步 content schema（编剧 01/02 等）
- 状态：**MVP 骨架**——跑通「选集 → 发起 run → 某步 awaiting_review → ✅ 推进」主链路；后端未就绪，先用内置 mock，后端就绪后切真实 API，前端代码不改。

## 目录结构

```
frontend/
├─ src/
│  ├─ types.ts                 # 通用数据模型（对齐 BACKEND-API-CONTRACT §2）
│  ├─ api/
│  │  ├─ types.ts              # ComicApi 接口（= 后端 §4 端点）
│  │  ├─ mock.ts               # 内置 mock 后端 + decision 状态机（§2.3 语义）
│  │  ├─ client.ts             # 真实 REST 客户端（打 /api/v1）
│  │  └─ index.ts              # env 切换：VITE_USE_MOCK
│  ├─ data/mockData.ts         # EP-01/02 占位数据（含 01 beats、02 shots）
│  ├─ components/
│  │  ├─ StepView.tsx          # 通用 StepView 外壳（平台槽位/Header/Content/Decision/Version/接手面板）
│  │  ├─ StepContent.tsx       # 按步骤类型 switch（01–07 专用视图）
│  │  ├─ PlatformSlotPanel.tsx # 每步 ComfyUI/视频模型/ElevenLabs 接入入口 + 健康态
│  │  ├─ HandoffPanel.tsx      # archive/content/artifacts 接手 agent 可读
│  │  ├─ ArtifactGallery.tsx   # 图/视频/音频产物预览
│  │  ├─ DecisionBar.tsx       # ✅/✏️/🔄/↩️（revise 带修改意见、regenerate 带新 seed）
│  │  ├─ VersionBrowser.tsx    # 版本列表 + 切换
│  │  ├─ ChatPanel.tsx         # 对话区 stub（选/建集、发起 run、活动记录、步骤快跳）
│  │  └─ steps/                # 01–07 专用渲染
│  ├─ platformSlots.ts         # 每步平台槽位表（05 多候选 discuss-first）
│  ├─ App.tsx                  # 顶栏（集号+run 状态+平台健康）+ 左右布局 + 状态
│  └─ index.css
└─ test/mock.test.ts           # decision 状态机运行时测试
```

## 运行

```bash
cd frontend
npm install
npm run dev        # 开发：http://localhost:5173
npm run build      # 产物校验：tsc -b && vite build → dist/
npm run preview    # 预览生产构建：http://localhost:4173
```

## 接真实后端

后端（ComfyUI 工程师）就绪后，复制 `.env.example` 为 `.env`：

```
VITE_USE_MOCK=false
VITE_API_BASE=http://<后端>/api/v1
```

前端只依赖 [`ComicApi`](src/api/types.ts) 一个接口；mock 与真实实现都实现它，切换不改组件代码。

## 部署（GitHub Pages）

线上站：**https://maoumao34-design.github.io/AI-Comic-Production/**（MVP，内置 mock 后端，完整占位循环可演示）。

前端是静态产物，部署到 GitHub Pages 项目站点需带子路径 `base`。仓库的 `gh-pages` 分支即构建产物（含 `.nojekyll`），Pages 已配置为「分支 `gh-pages` / 根目录」。

重新发布（重建并推 `gh-pages`）：

```bash
cd frontend
# 默认走 mock（完整可演示）；接真后端另加 VITE_USE_MOCK=false VITE_API_BASE=https://<后端>/api/v1
VITE_BASE=/AI-Comic-Production/ npm run build
# 把 dist/ 作为孤儿分支 gh-pages 强推
cp -r dist ../dist-deploy && cd ../dist-deploy
git init -b gh-pages && touch .nojekyll && git add -A && git commit -m "deploy: pages build"
git push -f origin gh-pages
```

> mock 后端是会话级内存态（刷新重置）；真后端持久化与平台联调已在本地验证（见 `test/real.test.ts`），上真后端只需把 `gh-pages` 构建换成 `VITE_USE_MOCK=false` + `VITE_API_BASE`。

## MVP 范围（对齐 PER-STEP-UI-SPEC §6）

- ✅ 顶栏：集号 + run 状态 + 平台健康
- ✅ 对话区 stub：选/建集 → 发起/继续 run；步骤快跳；活动记录
- ✅ 工作区通用 StepView：步号/状态 + 按类型渲染（01 beats、02 shots、03–07 通用）+ ✅/✏️/🔄/↩️ + 版本浏览器
- ✅ decision 语义：approve 推进 / revise 带意见重跑当前步 / regenerate 换参重跑 / rollback 回上一步
- ✅ deployment：GitHub Pages 公网可访问（见上节「部署」）
