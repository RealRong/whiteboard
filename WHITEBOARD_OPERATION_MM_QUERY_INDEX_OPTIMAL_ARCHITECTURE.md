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

---

## 13. 详细实施方案（一步到位）

本章是可直接执行的实现清单，基于当前代码现状，不保兼容，不走双轨。

## 13.1 现状基线（对应当前代码）

1. 写入链路已稳定为：`commands -> WriteCoordinator -> MutationExecutor -> ProjectionStore`。
2. `MutationImpactAnalyzer` 已存在，但 `node.update` / `edge.update` 仍是粗粒度标记（见 `runtime/mutation/Analyzer.ts`）。
3. 读侧有两套能力并存：
   - `runtime/read/Store.ts`（Jotai 读模型 + edgePath revision atom）
   - `runtime/query/Store.ts`（索引惰性同步 + `ensureIndexes`）
4. `ProjectionStore.commit` 是当前唯一全局读侧触发点（见 `runtime/projection/Store.ts`）。

结论：可以在 `ProjectionStore.commit` 后同步更新 Materialized Model / Query Index，不需要额外事件 atom 中转。

## 13.2 目标骨架（最终调用顺序）

```text
commands
 -> operations
 -> reduce (docAfter)
 -> analyze impact
 -> projection.apply/replace (产出 commit)
 -> [sync] readModel.applyCommit(commit)  // materialized + indexes
 -> [sync] publish observable state (snapshot/revision atoms)
 -> query/getters/React 按需读取
```

约束：

1. `applyCommit` 必须同步执行并先于可观察 revision 发布。
2. `pointermove` 等热路径只走 `instance.query.*` 的 get，不触发写。
3. 无法安全增量时直接全量重建，不做“半正确”增量。

## 13.3 模块落位与文件改造

建议按下面的结构收敛（可在现有目录渐进搬迁，最终收敛到该形态）：

1. `packages/whiteboard-engine/src/runtime/read/materialized/`
   - `Model.ts`：Materialized Model 主入口（apply/rebuild/getter）。
   - `edgePath/`：edge path 物化维护（可迁移现有 `runtime/query/edgePath/*` 逻辑）。
   - `mindmap/`：mindmap 物化树维护。
2. `packages/whiteboard-engine/src/runtime/read/indexes/`
   - `QueryIndex.ts`：索引主入口（syncByImpact/rebuild/getter）。
   - `canvas/`：空间索引与命中查询。
   - `snap/`：吸附候选索引。
   - `incident/`：node-edge 反向索引。
3. `packages/whiteboard-engine/src/runtime/read/api/`
   - `QueryApi.ts`：对外纯读 API 聚合，供 `instance.query` 使用。
4. `packages/whiteboard-engine/src/runtime/mutation/`
   - 新增 `PatchClassifier.ts`：稳定 patch 语义分类。
   - `Analyzer.ts` 改为调用分类器，不直接写死规则。

## 13.4 Operation 稳定语义落地

### 13.4.1 新增 patch 分类器

新增统一分类接口，避免 feature 扩张时“到处补 if”：

```ts
type NodePatchClass = {
  affectsGeometry: boolean
  affectsOrder: boolean
  affectsStyleOnly: boolean
}

type EdgePatchClass = {
  affectsGeometry: boolean
  affectsOrder: boolean
  affectsStyleOnly: boolean
}

classifyNodePatch(patch: Partial<Node>): NodePatchClass
classifyEdgePatch(patch: Partial<Edge>): EdgePatchClass
```

### 13.4.2 改造 Analyzer 聚合规则

`MutationImpactAnalyzer` 只负责聚合，不持有字段细节：

1. `node.update` 调 `classifyNodePatch` 决定是否打 `geometry/order`。
2. `edge.update` 调 `classifyEdgePatch` 决定是否打 `geometry/order`。
3. `mindmap.*` 长期策略：继续映射到 `mindmap + geometry`，并补 `dirtyNodeIds`。
4. 未识别 operation 仍然降级 `full`。

### 13.4.3 规则文件化（防膨胀）

维护一份“字段到影响域”映射表（单文件），新增字段时只改一处。

## 13.5 Materialized Model 具体实现

### 13.5.1 最小接口

```ts
export type MaterializedModel = {
  applyCommit: (commit: ProjectionCommit) => void
  rebuild: (snapshot: ProjectionSnapshot) => void
  getNodeIds: () => readonly NodeId[]
  getEdgePathById: (id: EdgeId) => EdgePathEntry | undefined
  getMindmapTreeById: (id: NodeId) => MindmapViewTree | undefined
}
```

### 13.5.2 更新策略（按 impact）

1. `replace/full`：全量 `rebuild(snapshot)`。
2. `order`：重建排序相关结构（nodeIds、edge render order）。
3. `dirtyEdgeIds`：局部更新 edge path。
4. `dirtyNodeIds + geometry`：通过 incident 索引找受影响边，再局部更新 edge path。
5. `mindmap`：局部或全量更新 mindmap 物化树（按 `dirtyNodeIds` 优先）。

### 13.5.3 与现有实现对齐

1. 现有 `runtime/query/edgePath/Query.ts` 可直接作为 `materialized/edgePath` 核心实现迁移。
2. `runtime/read/Store.ts` 中 `edgePathRevisionAtom` 仅保留为“可观察桥接”，不承载业务逻辑。
3. 业务读取优先走 Materialized getter，atom 只负责“通知 React 可重读”。

## 13.6 Query Index 具体实现

### 13.6.1 索引职责

1. 空间命中（canvas hit-test）。
2. snap 候选（最近点、对齐线候选）。
3. 邻接关系（node -> edgeIds）。

### 13.6.2 同步接口

```ts
export type QueryIndex = {
  applyCommit: (commit: ProjectionCommit) => void
  rebuild: (snapshot: ProjectionSnapshot) => void
  hitTest: (point: Point) => NodeId | undefined
  collectSnapCandidates: (input: SnapInput) => SnapCandidate[]
  getIncidentEdgeIds: (nodeId: NodeId) => readonly EdgeId[]
}
```

### 13.6.3 热路径约束

1. `pointermove` 内仅调用 `queryIndex` getter。
2. 禁止在查询过程中 `set atom`、`write state`、`emit event`。
3. 若索引脏，必须在 commit 同步阶段已修复，查询阶段不补账。

## 13.7 Atom 与可观察层实施规则

原则：atom 承载“状态可观察”，不是事件链。

建议保留：

1. `projectionSnapshotAtom`（doc 派生快照根）。
2. `materializedRevisionAtom`（物化模型可变结构桥接）。
3. `indexRevisionAtom`（仅当查询索引也要驱动 UI 展示时保留）。

建议删除/避免：

1. `commitSignalAtom` 这类纯事件 atom。
2. `mutationMetaAtom -> subscriber -> revision` 的链式中转。

## 13.8 迁移步骤（执行顺序）

### 阶段 A：语义与触发协议收敛

1. 新增 `PatchClassifier.ts`，改 `Analyzer.ts` 接入分类器。
2. 补 operation->impact 单测（覆盖 node/edge update 字段分类）。
3. 保证未知 operation 自动 `full`。

### 阶段 B：抽离 Materialized Model

1. 从 `runtime/read/Store.ts` 抽出 edgePath/mindmap/nodeOrder 维护到 `runtime/read/materialized/*`。
2. 对外仅暴露 `applyCommit/rebuild/get*`，隐藏内部缓存结构。
3. `createReadRuntime` 改为组合 materialized，不再直接维护业务缓存。

### 阶段 C：抽离 Query Index

1. 将 `runtime/query/Store.ts` 的索引同步逻辑迁入 `runtime/read/indexes/*`。
2. 保留 `instance.query` API 不变，但底层改为读新 `QueryIndex`。
3. 删除 `ensureIndexes` 惰性补账逻辑，改 commit 同步更新。

### 阶段 D：收敛可观察原子

1. `projection.subscribe` 中固定顺序：
   - `materialized.applyCommit(commit)`
   - `queryIndex.applyCommit(commit)`
   - `store.set(projectionSnapshotAtom, commit.snapshot)`
   - 按需 `store.set(materializedRevisionAtom, +1)`
2. 清理不再需要的 revision/signal atom。

### 阶段 E：回归与性能签收

1. `pnpm --filter @whiteboard/engine lint`
2. `pnpm --filter @whiteboard/react lint`
3. `pnpm -r build`
4. `pnpm --filter @whiteboard/engine run bench:check`
5. 手工回归：drag/transform、edge routing、mindmap、viewport 手势。

## 13.9 最小代码骨架（示意）

```ts
projection.subscribe((commit) => {
  materialized.applyCommit(commit)
  queryIndex.applyCommit(commit)
  store.set(projectionSnapshotAtom, commit.snapshot)
  store.set(materializedRevisionAtom, (x) => x + 1)
})
```

```ts
const edgeByIdAtom = (id: EdgeId) =>
  atom((get) => {
    get(materializedRevisionAtom)
    return materialized.getEdgePathById(id)
  })
```

## 13.10 验收门槛（实施版）

1. 功能正确性：
   - 任意 mutation 后，`instance.query` 结果与渲染一致。
   - `replace/full` 后索引与物化模型完全恢复一致。
2. 复杂度：
   - 新增 feature 只需改 `Operation + PatchClassifier +（必要时）materialized/index handler`，不允许跨 4+ 模块散改。
3. 性能：
   - `bench:check` 全通过。
   - pointermove 火焰图中无 state/atom 写调用。
4. 架构一致性：
   - 写入入口仅 `instance.commands`。
   - 查询入口仅 `instance.query`。
   - 无 event-only atom 中转链。

## 13.11 当前落地进度（2026-02-27）

1. 阶段 A 已完成：
   - 已新增 `runtime/mutation/PatchClassifier.ts`。
   - `MutationImpactAnalyzer` 已改为基于 patch 分类输出 `geometry/order/dirty*Ids`。
   - `node/edge` 样式类更新不再默认触发几何增量链路。
2. 阶段 B 部分完成：
   - 已新增 `runtime/read/materialized/Model.ts`，承接 `nodeIds/edgePath/mindmap` 读侧物化维护。
   - `runtime/query/EdgePath.ts` 与 `runtime/query/edgePath/*` 已物理迁移至 `runtime/read/materialized/`。
   - `runtime/read/Store.ts` 已改为组合 Materialized Model，不再内联维护上述缓存逻辑。
3. 阶段 C 核心完成：
   - 已新增 `runtime/read/indexes/QueryIndex.ts`，抽离 Query Index 同步策略。
   - `runtime/query/Indexes.ts` 已物理迁移至 `runtime/read/indexes/Indexes.ts`，索引实现与读侧分层一致。
   - `runtime/query/Store.ts` 已改为 commit 同步更新索引，删除 `ensureIndexes` 惰性补账。
   - `runtime/query/Canvas.ts`、`runtime/query/Snap.ts` 已改为纯 getter，不再触发补账同步。
4. 阶段 D 部分完成：
   - `runtime/read/Store.ts` 的 revision 信号已收敛为 `materializedRevisionAtom`。
   - 仅在 `full/edges/mindmap/geometry/dirty*` 相关 commit 上递增 revision，避免每次 commit 无差别写 atom。
   - 已进一步剔除 `node.order` 对 edgePath/materialized revision 的无效触发，降低无效重算。
5. 命名与转发层清理已完成一轮：
   - `runtime/read/Store.ts` 重命名为 `runtime/read/Runtime.ts`。
   - `runtime/query/Store.ts` 重命名为 `runtime/query/Runtime.ts`。
   - `runtime/read/indexes/Indexes.ts` 重命名为 `runtime/read/indexes/QueryIndexes.ts`。
   - `runtime/read/indexes/QueryIndex.ts` 重命名为 `runtime/read/indexes/QueryIndexRuntime.ts`。
   - `runtime/read/materialized/Model.ts` 重命名为 `runtime/read/materialized/MaterializedModel.ts`。
   - 已删除单行转发文件：`instance/index.ts`、`runtime/read/materialized/EdgePath.ts`。
6. 已通过验证：
   - `pnpm --filter @whiteboard/engine lint`
   - `pnpm --filter @whiteboard/react lint`
   - `pnpm -r build`
   - `pnpm --filter @whiteboard/engine run bench:check`
