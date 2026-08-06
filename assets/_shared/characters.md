# Series character bible（跨集人物 SSOT）

> Owner：编剧·分镜（姓名/稳定 ID/`ref_image_slot` 前缀）  
> 下游：步骤 03 一致性资产 · 系列库 `assets/<series>/characters/<id>/approved/latest`（工程侧落盘）  
> 来源：maozh2 2026-08-06 — 同剧不同集相同人物须连贯；终审素材保留作后续集参考。

## 规则

1. **稳定 ID 永不改名**。`char_id` / `ref_slot` 跨集固定；展示名可微调，ID 不可。
2. **02 分镜** `characters[]` 用下方「展示名」；`ref_image_slot` 里的 `char/<ref_slot>` 必须命中本表。
3. **03 出图** 默认挂系列库已 `approved` 的参考图 / seed / style refs；禁止无参考裸跑同角色。
4. **进系列库门槛**：仅 checkpoint 完全通过后挂 series 指针；未终审/回退候选只留集内 `assets/EP-xx/.../vN/`。
5. **新角色**：先在本文件加行 + PR，再写进分镜；不得在某一集临时发明无 ID 角色名。

## 本剧 cast（EP-01 已出场）

| char_id | 展示名（02 `characters[]`） | ref_slot | 一句话视觉锚 | EP-01 首出镜 | series approved 指针 |
|---|---|---|---|---|---|
| `serena` | Serena Harris | `char/serena` | 冷静掌控；钢色眼神；豪门继承人气质 | S1 | _pending EP-01 step03 人审_ |
| `james` | James Miller | `char/james` | 自信/自恋；告白姿态；中产成功感 | S1 | _pending EP-01 step03 人审_ |
| `amy` | Amy | `char/amy` | 勤勉学生；校园背包/书本；受资助气质 | S4 | _pending EP-01 step03 人审_ |
| `kate` | Kate | `char/kate` | 执行助理；听电话记笔记；办公场景 | S12 | _pending EP-01 step03 人审_ |

### 组合槽（仅作镜头 shorthand，不进系列库独立条目）

| combo_slot | 成员 char_id | 用途 |
|---|---|---|
| `char/serena+james` | serena, james | 双人同框（告白/对峙） |
| `char/james+amy` | james, amy | 窗下亲吻等 |

组合槽生成时仍应挂各成员的 series approved 单人参考。

## 与 EP-01 归档的对应

- 分镜：`assets/EP-01/02-storyboard/v1/`（已 ✅；`ref_image_slot` 已用上表前缀）
- 解说：`assets/EP-01/01-script/v1/`（已 ✅）
- 步骤 03 回灌后：把各 `char_id` 的 `series approved 指针` 改成真实路径（例：`assets/series/characters/serena/approved/latest`），**不改已通过的 01/02 正文**。

## 变更日志

| 日期 | 变更 | 作者 |
|---|---|---|
| 2026-08-06 | 初版：补齐 schema 已引用但缺失的本文件；锁定 EP-01 四角色 ID | 编剧分镜 |
