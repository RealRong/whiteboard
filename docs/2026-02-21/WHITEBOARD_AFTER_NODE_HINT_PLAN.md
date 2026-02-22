# WHITEBOARD_AFTER_NODE_HINT_PLAN

## 1. 前提（nodeHint 已完成的状态）

默认你已经完成这些事项：

1. `nodeHint` 从 `runtime/lifecycle/watchers` 迁到 `graph/hint`。
2. 引入 `HintContext + HintPipeline + rules`，并保持行为与旧版一致。
3. `change/pipeline` 不再内联 `syncGraphByOperations`，改由独立 `graphSync` 组件处理。
4. bench 与命名同步迁移（`CanvasNodeDirtyHint` 等历史命名已收敛）。

---

## 2. 做完 nodeHint 以后，优先做什么

建议按 **P0 -> P1 -> P2** 顺序推进，不要并行大改。

### P0：先稳住（必须先做）

目标：确认“只是重构，不改语义”。

1. 建立对照回归：
   - 同一组 operations，旧实现与新实现的 `dirtyNodeIds/orderChanged/fullSync` 完全一致。
2. 跑性能门槛：
   - 保持 `bench:node-hint:check` 与 `bench:drag-frame:check` 都通过。
3. 修正脚本路径：
   - `packages/whiteboard-engine/package.json` 里的 `bench:node-hint` 路径改为新文件路径。
4. 补最小单测：
   - `type` 切换、`parentId` 变更、group 折叠、order、create、delete。

Done 标准：

1. 行为对照全通过。
2. bench 无回退。
3. CI 可复现。

---

### P1：收口 graph 写入协议（下一阶段核心）

目标：降低“外部知道太多 graph 内部细节”的复杂度。

1. 在 graph 层提供单入口：
   - `graph.applyHint(hint, source)`。
2. 逐步替换外部三连调用：
   - `reportDirty + reportOrderChanged + requestFullSync` -> `applyHint`。
3. `change/graphSync` 只保留“翻译 + 调度”，不再拼装底层细节。
4. 保留 `flush(source)`，但让“如何累计 pending”只在 graph 内部可见。

Done 标准：

1. 变更管线对 graph 的写入调用点显著减少。
2. 新人不需要理解 graph pending 细节也能改业务。

---

### P1.5：统一 GraphChange 协议（建议紧跟）

目标：减少 query/view/edge 各处 if 分支重复。

现状问题是 `GraphChange` 用多个可选布尔字段，组合态多，调用方都在写判断分支。

建议改为判别联合（示例语义）：

1. `full`
2. `dirty`（含 dirty ids，可带 order）
3. `order`
4. `noop`

迁移策略：

1. 先做适配层，旧字段与新结构并存一段时间。
2. query/view/edge 逐模块切到新协议。
3. 最后删旧字段。

Done 标准：

1. `query/projector`、`KernelPipeline`、`edge/pathCache` 的图变更分支明显减少。
2. GraphChange 类型阅读成本下降。

---

### P2：拆分 GraphCache 内部复杂度（谨慎推进）

目标：在不丢增量性能的情况下提升可维护性。

当前 `GraphCache` 同时做了多件事：

1. viewNodes + override 增量。
2. visible/canvas 推导。
3. visibleEdges 缓存。
4. snapshot 引用稳定控制。

建议拆成 3 个内部模块（先内部文件拆分，不改对外 API）：

1. `viewNodesCache`（节点与 override）
2. `visibility`（visible/canvas 推导）
3. `edgeCache`（visible edges）

Done 标准：

1. `graph/cache.ts` 体量下降，职责边界清晰。
2. 性能指标无明显回退。

---

## 3. 推荐执行顺序（最小风险）

1. **第 1 步**：P0 全完成（回归 + bench + 测试）。
2. **第 2 步**：P1 `applyHint` 收口。
3. **第 3 步**：P1.5 GraphChange 协议统一。
4. **第 4 步**：P2 拆分 GraphCache 内部实现。

不要跳步：

1. 不建议在未完成 P0 前直接改 GraphChange 协议。
2. 不建议在协议未收敛前就大拆 `GraphCache`。

---

## 4. 并行产物（建议一起补齐）

1. 一页“Graph 数据流总览图”（输入 -> hint -> graph -> query/view）。
2. 一页“GraphChange 协议速查表”。
3. 一页“常见问题（为什么会 fullSync）”。

这样新同学看文档即可快速上手，不需要先通读大量源码。

---

## 5. 最终目标（完成上述阶段后）

达到以下状态才算真正“nodeHint 重构成功并落地”：

1. nodeHint 已不是孤立函数，而是稳定的 hint 子系统。
2. graph 写入接口收口，外部模块耦合下降。
3. GraphChange 协议统一，query/view/edge 同步逻辑简化。
4. 性能门槛持续可验证，重构可持续推进。

