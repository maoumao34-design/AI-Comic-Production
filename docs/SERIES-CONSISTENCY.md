# 系列一致性资产（跨集复用）

对齐 [PIPELINE-DESIGN.md](../PIPELINE-DESIGN.md) §3「跨集复用」与 [STEP-CONTENT-SCHEMA-03-04-05.md](./STEP-CONTENT-SCHEMA-03-04-05.md) 的 `consistency_ref`。

## 规则（与 checkpoint 联动）

| 动作 | 系列包行为 |
|---|---|
| 步骤 **03 ✅** 且该版有 `output.png` | **写入**历史参考（先撤本集旧贡献，再晋升当前版） |
| 03 ✅ 但无出图（prompt_only） | **不写入**；并撤掉本集先前贡献 |
| **↩️** 从 03→02，或从 04→03 | **撤出**本集写入的全部系列条目（未确认不得留在历史参考） |
| 03 **✏️ / 🔄** | 先撤出本集贡献，再出图；改完需再次 ✅ 才会重新进入系列包 |
| 其他集 03 出图 | 仅复用「**其他集**已 ✅ 锁定」的条目；本集自己的锁定图不会挡住本集重生 |
| 04 出图 | 参考图：系列包 → 本集 03 |

要点：**只有你确认通过（✅）的 03 出图才会进历史参考；一回退或要改，系列包跟着撤，改完再 ✅ 才重新入库。**

## 目录

```
assets/_series/<series_id>/
  README.md
  manifest.json
  subjects/
    char__serena/
      output.png
      meta.json
```

`consistency_ref` 形如：`series:heiress/char/serena`。

## Episode 字段

创建时可选 `series_id`（默认 `SERIES_ID` 环境变量，否则 `default`；本机 EP-01 bootstrap 用 `heiress`）。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/series/consistency` | 默认系列包 |
| GET | `/api/v1/series/:id/consistency` | 指定系列包 |
| GET | `/api/v1/episodes/:id/series-refs` | 本集所属系列包 |

## 改某一个角色

在 03 待审时 ✏️，或 `params_override: { subject: "char/serena", force_new: true }` 后 🔄；再 ✅ 覆盖系列包同名条目。
