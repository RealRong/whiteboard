# Whiteboard 稳定 Operation 语义与 Materialized Model / Query Index 最优架构

## 1. 目标与边界

本方案用于当前 whiteboard engine 的下一阶段架构收敛，目标是：

1. 保持写入链路单一：`commands -> operations -> mutation -> doc`。
2. 将读侧分为两类基础设施：
   - Materialized Model（物化读模型）
   - Query Index（查询索引）
3. 保持热路径稳定：`pointermove` 等查询不触发 signal，不依赖 React render。
4. 避免“事件 atom 过度中转”，优先同步直连更新。

约束：

1. 不引入双写路径。
2. 不新增兼容层。
3. 读写边界明确：业务真相始终是 doc（或 doc 派生快照）。

---

## 2. 核心分层

## 2.1 Source of Truth（业务真相）

1. `doc` 是唯一业务真相。
2. 所有功能最终落到底层 `Operation[]`。
3. mutation/reducer 是唯一改写入口。

## 2.2 Materialized Model（物化读模型）

定义：

1. 为渲染和跨模块读取准备的预计算结构。
2. 不是业务真相，可由 doc 重建。

典型内容：

1. 分层后的 node 列表（`nodeIds`）。
2. edge path entry（`id -> { edge, path }`）。
3. mindmap 可视结构与连线结果。

## 2.3 Query Index（查询索引）

定义：

1. 服务高频查询的可变索引结构。
2. 主要用于纯 get 场景（如 hit-test、snap candidates、邻接查询）。

典型内容：

1. 节点空间索引（按 AABB/旋转外接盒）。
2. 节点到边的 incident 反向索引。
3. snap 候选索引。

---

## 3. 稳定 Operation 语义（必须收敛）

“增量是否简单”取决于 operation 是否稳定。建议固定语义层如下。

## 3.1 Canonical Operations

节点：

1. `node.create`
2. `node.update`
3. `node.delete`
4. `node.order.*`

边：

1. `edge.create`
2. `edge.update`
3. `edge.delete`
4. `edge.order.*`

其他：

1. `viewport.update`
2. `mindmap.*`（建议长期继续归约到 node/edge 基础操作，mindmap 只保留语义别名）

## 3.2 Patch 语义稳定化

对于 `node.update` / `edge.update`，需要稳定字段分类：

1. 几何相关：会影响位置、尺寸、锚点、路径。
2. 顺序相关：会影响 layer/order。
3. 样式/数据相关：通常不影响索引，可跳过重建。

建议提供统一分类函数：

```ts
classifyNodePatch(patch) => {
  affectsGeometry: boolean
  affectsOrder: boolean
  affectsLabelOnly: boolean
}
```

```ts
classifyEdgePatch(patch) => {
  affectsGeometry: boolean
  affectsOrder: boolean
  affectsStyleOnly: boolean
}
```

这样 feature 新增时只需要补分类规则，不需要在多个缓存里重复写 if-else。

---

## 4. Impact 合约（统一触发协议）

建议 `Impact` 作为唯一增量触发协议：

1. `tags`: `nodes|edges|order|geometry|mindmap|viewport|full`
2. `dirtyNodeIds`
3. `dirtyEdgeIds`

规则：

1. operation -> impact 的映射只存在一处（Analyzer）。
2. 新 operation 必须补 Analyzer；未补时显式降级 `full`。
3. `dirty*Ids` 允许 over-approximation（宁可多算，不可漏算）。

---

## 5. 最优更新流水线（同步直连，少中间层）

建议采用：

```text
commands
 -> operations
 -> mutation reduce (doc before -> doc after)
 -> analyze impact
 -> 同步更新 Materialized Model / Query Index
 -> 写 doc atom / snapshot atom / revision atoms
```

关键点：

1. 不额外引入“纯事件 atom”中转层。
2. 先更新索引/物化，再发布可观察 revision，保证同 tick 一致性。
3. 热查询只读 index，不触发任何 signal。

---

## 6. Materialized Model 设计

## 6.1 职责

1. 面向渲染的共享只读模型。
2. 面向 domain/query 的跨模块读模型。

## 6.2 更新策略

1. 优先按 impact 增量更新。
2. 在以下情况全量重建：
   - `replace`
   - `full`
   - 无法判定增量范围
3. 提供 `rebuildFromDoc(doc)` 兜底能力。

## 6.3 API 形态（建议）

内部（runtime）:

1. `applyOperations(operations, impact, docBefore, docAfter)`
2. `applyCommit(commit)`
3. `rebuild(doc)`

外部（query/read）:

1. `getNodeIds()`
2. `getEdgePathById(edgeId)`
3. `getMindmapTreeById(treeId)`

---

## 7. Query Index 设计

## 7.1 职责

1. 服务高频纯查询（hit-test/snap/邻接）。
2. 不承载 UI 语义状态。

## 7.2 更新策略

1. `dirtyNodeIds`：局部更新节点索引。
2. `dirtyEdgeIds`：局部更新边索引。
3. `order/full/replace`：按策略全量同步。

## 7.3 热路径规则

1. `pointermove` 仅读取 index：`query.index.*`。
2. 查询过程无 set、无 signal、无 atom 写入。
3. 如需屏幕/世界坐标转换，使用 runtime viewport getter。

---

## 8. Atom 边界（何时用，何时不用）

原则：atom 用于“可观察状态”，不用作“纯事件总线”。

建议保留：

1. `doc/snapshot` 读根 atom。
2. 必要的 revision atom（当底层缓存是可变结构时）。

建议避免：

1. 仅用于触发 subscriber 的 event-only atom。
2. 多级 signal atom 链式转发。

判定准则：

1. 若缓存更新采用不可变 set 新引用，可不需要单独 revision atom。
2. 若缓存是可变 Map/Index 原地更新，必须有 revision/version 桥接。

---

## 9. 复杂度控制与反膨胀策略

## 9.1 防止 dirtyEdgeIds 规则膨胀

1. 不在 feature 层手写脏边逻辑。
2. 统一在 Analyzer + patch 分类器维护。
3. 对候选边允许小范围二次校验（fingerprint），但禁止全量遍历。

## 9.2 帧合并策略

1. 在高频交互中可按帧合并 impact（Set union）。
2. 合并后执行一次索引/物化更新。
3. 保证顺序：同一 revision 只处理一次。

## 9.3 降级策略

1. 无法安全增量时立即 `full rebuild`。
2. rebuild 保证正确性优先于局部性能。

---

## 10. 推荐模块边界

1. `runtime/write/*`：生成 operations，产出 impact。
2. `runtime/read/materialized/*`：维护物化读模型。
3. `runtime/read/indexes/*`：维护查询索引。
4. `runtime/read/api/*`：对外只读 getter 聚合。
5. `instance.query`：唯一对外查询入口。

不建议：

1. `instance.cache.read('xxx')` 字符串式 API 暴露。
2. 在 React `useMemo` 内做全局 edgePath/nodeLayer 主计算。

---

## 11. 验收标准

## 11.1 正确性

1. 所有 mutation 后查询结果与渲染一致。
2. `replace/full` 后可完全恢复一致状态。
3. 新 feature 仅通过 operation + patch 分类接入，不需多处修改。

## 11.2 性能

1. `bench:check` 全通过。
2. 大图拖拽与路由场景无明显抖动回退。
3. pointermove 热路径无写操作。

## 11.3 架构一致性

1. 写入链路唯一：`commands -> mutate`。
2. 查询入口唯一：`instance.query`。
3. atom 仅承载可观察状态，不作为事件总线。

---

## 12. 一句话架构准则

1. 维护指令驱动（operation/impact）。
2. 消费数据驱动（query/getter/derived atom）。
3. 正确性由可全量重建兜底。
