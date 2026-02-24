# Whiteboard CQRS Mutation Architecture

## 1. 目标

- 以 `mutation` 作为唯一写入事实源（source of truth）。
- Engine 内部跨域同步统一走 `Coordinator` 同步直调，不使用内部事件监听链。
- 缓存按职责拆分，单一 owner 持有，避免重复缓存与重复失效判断。
- 一步到位重构，不保留兼容层。

## 2. 核心原则

1. `commands` 是入口协议，不是持久化事实；`mutations/operations` 才是最终事实。
2. 内部链路固定可追踪：`Gateway -> Analyzer -> Projection -> Coordinator -> Actors`。
3. `Impact` 是参数模型，不是事件协议。
4. 不确定增量时直接 `full`，正确性优先于局部优化。
5. 同一语义数据只能在一个 store 中缓存。

## 3. 最终架构

### 3.1 写入面（Command Side）

```txt
instance.commands.*
  -> DomainActor.handle(command)
  -> MutationBuilder.build(command) => operations
  -> ChangeGateway.applyMutations(operations)
  -> core.reduceOperations(doc, operations)
  -> MutationImpactAnalyzer.analyze(operations) => impact
  -> ProjectionStore.sync(doc, impact) => projectionChange
  -> SyncCoordinator.sync({ impact, projectionChange })
  -> QueryStore.apply(...)
  -> ViewStore.apply(...)
```

### 3.2 读取面（Query/View Side）

- `ProjectionStore`：文档投影读模型（`visibleNodes/canvasNodes/visibleEdges`）。
- `QueryStore`：几何/吸附/命中索引。
- `ViewStore`：React 消费快照（viewport/nodes/edges/mindmap）。

对外 API：

- `instance.query.*` 读 `QueryStore`
- `instance.view.getState/subscribe` 读 `ViewStore`

## 4. 组件职责与边界

### 4.1 ChangeGateway

职责：

- 提交 `operations` 到 core reducer。
- 统一触发 analyzer、projection、coordinator。
- 维护文档与历史。

禁止：

- 不再包含“意图级别的缓存失效判断”。

### 4.2 MutationImpactAnalyzer

职责：

- 输入 `operations[]`，输出统一 `MutationImpact` 标签。

约束：

- 任何未知 operation 或未知 patch 结构直接返回 `full`。
- 大批量变更超过阈值直接 `full`。

### 4.3 ProjectionStore

职责：

- 维护投影缓存与投影快照。
- 对外只暴露 `read/readNode/sync/patchOverrides/clearOverrides`。

禁止：

- 不做跨域业务分发。

### 4.4 SyncCoordinator

职责：

- 按固定顺序同步直调各域 `apply(...)`。
- 汇总是否变更并单点通知 view subscribers。

固定顺序建议：

1. `QueryStore.apply`
2. `NodeViewDomain.apply`
3. `EdgeViewDomain.apply`
4. `MindmapViewDomain.apply`
5. `ViewStore.commit`

禁止：

- 不支持 `register/listen/onImpact` 内部订阅机制。

### 4.5 Domain Actors

职责：

- 仅处理本域规则与本域临时状态。
- command 转 mutation 在本域完成。

禁止：

- 不跨域直接读写他域缓存。
- 不解析全局 operations 做跨域决策。

## 5. 统一数据契约

### 5.1 MutationImpact

```ts
export type ImpactTag =
  | 'full'
  | 'nodes'
  | 'edges'
  | 'order'
  | 'geometry'
  | 'mindmap'
  | 'viewport'

export type MutationImpact = {
  tags: ReadonlySet<ImpactTag>
  dirtyNodeIds?: readonly NodeId[]
  dirtyEdgeIds?: readonly EdgeId[]
}
```

### 5.2 ProjectionChange

```ts
export type ProjectionChange = {
  kind: 'full' | 'partial'
  nodesChanged: boolean
  edgesChanged: boolean
  orderChanged: boolean
}
```

说明：

- 保留最小字段，避免重复携带同义信息。
- `dirty ids` 仅做优化提示，不作为正确性依赖。

### 5.3 Coordinator 端口

```ts
export type SyncInput = {
  impact: MutationImpact
  projection: ProjectionChange
}

export interface DomainSyncPort {
  apply(input: SyncInput): boolean
}

export interface SyncCoordinator {
  sync(input: SyncInput): void
}
```

## 6. 缓存 Owner 划分（最终态）

1. `ProjectionStore`
- 拥有：`visibleNodes/canvasNodes/visibleEdges/canvasNodeById/nodeOverrides`

2. `QueryStore`
- 拥有：`NodeRectIndex/SnapIndex/EdgePathIndex`

3. `ViewStore`
- 拥有：`viewport transform / node items & handles / edge view / mindmap view`

4. `Domain Actor`（可选临时状态）
- 拥有：交互 session、拖拽中间态、临时选区上下文

硬约束：

- 同一语义缓存不能同时在两个 store 持有可写副本。

## 6.1 缓存迁移总表（当前 -> 目标）

| 当前缓存 | 当前位置 | 目标归属 | 迁移动作 |
| --- | --- | --- | --- |
| `GraphCache` | `runtime/actors/graph/cache/GraphCache.ts` | `ProjectionStore` | 保留能力，改名收口到 `runtime/projection/Store.ts` |
| `NodeOverrideState` | `runtime/actors/graph/cache/NodeOverrideState.ts` | `ProjectionStore` | 保留，内聚为 `Overrides` 子模块 |
| `ViewNodesState` | `runtime/actors/graph/cache/ViewNodesState.ts` | `ProjectionStore` | 保留，作为节点投影子缓存 |
| `VisibleEdgesState` | `runtime/actors/graph/cache/VisibleEdgesState.ts` | `ProjectionStore` | 保留，作为边投影子缓存 |
| `SnapshotState` | `runtime/actors/graph/cache/SnapshotState.ts` | `ProjectionStore` | 保留，统一管理 snapshot 引用复用 |
| `NodeRectIndex` | `api/query/indexes.ts` | `QueryStore` | 保留，迁到 `runtime/query/` 并由 coordinator 驱动 |
| `SnapIndex` | `api/query/indexes.ts` | `QueryStore` | 保留，迁到 `runtime/query/` 并由 coordinator 驱动 |
| `EdgePathStore` | `runtime/actors/edge/view/query/pathCache.ts` | `QueryStore` | 从 edge/view 私有缓存提升为 query 域缓存 |
| `nodeItemsById/nodeHandlesById` | `runtime/actors/node/view/Registry.ts` | `ViewStore` | 从 Node registry 迁到 `ViewStore.NodeDomain` |
| `edgeIndex/edgePreview/edgeSelection` | `runtime/actors/view/Registry.ts` | `ViewStore` | 保留，拆为 `ViewStore.EdgeDomain` |
| `mindmapIndex/mindmapDrag/treeCache` | `runtime/actors/view/Registry.ts` + `mindmap/view/Derivation.ts` | `ViewStore` | 合并为 `ViewStore.MindmapDomain` |
| `normalizedKeyCache/compiled` | `input/shortcut/manager.ts` | `DomainActor(Shortcut)` | 保留在输入域，不进入 projection/query/view |
| `observed/lastSize/pending` | `runtime/actors/node/services/NodeSizeObserver.ts` | `DomainActor(Node)` | 保留在 Node 域服务 |
| `GroupAutoFit snapshot` | `runtime/actors/node/services/GroupAutoFit.ts` | `DomainActor(Node)` | 保留在 Node 域服务 |
| `WritableStore pendingKeys` | `state/store/WritableStore.ts` | `State` | 保留，不参与缓存迁移 |
| `Scheduler timers` | `runtime/Scheduler.ts` | `Runtime` | 保留，不参与缓存迁移 |

## 6.2 迁移规则（必须遵守）

1. **同语义只留一份**
- 例如边路径缓存只能留在 `QueryStore`，`ViewStore` 只消费结果，不再重复缓存路径几何。

2. **按写后同步更新，不做被动监听**
- 所有缓存更新由 `SyncCoordinator.sync(...)` 直调触发。

3. **先迁 owner，再做增量优化**
- 先把缓存放对位置并跑通 full 路径，再启用 `dirty ids` 快速路径。

4. **不确定即 full**
- 迁移初期任何难以证明正确的局部更新一律降级全量重算。

## 6.3 分阶段缓存迁移顺序

### Step A：Projection 缓存收口

- 把 `GraphCache/*State` 迁到 `runtime/projection/`。
- 删除 `applyHint + flush` 双段更新，改 `ProjectionStore.sync(doc, impact)`。
- 产出统一 `ProjectionChange`。

完成判定：

- `GraphProjector/PendingState` 不再是主写路径依赖。

### Step B：Query 缓存收口

- `NodeRectIndex/SnapIndex/EdgePathStore` 统一迁到 `QueryStore`。
- 由 `SyncCoordinator` 固定顺序调用 `QueryStore.apply`。
- 移除 Query 内部对 operation/graph-change 的重复解析入口。

完成判定：

- Query 缓存更新入口只剩 `QueryStore.apply`。

### Step C：View 缓存收口

- `node/edge/mindmap` 的 view 缓存合并进 `ViewStore` 子域。
- `ViewStore` 只消费 projection/query 结果，不自行重算几何索引。
- `ViewActor` 退化为 `ViewStore` 外观层（`getState/subscribe`）。

完成判定：

- `runtime/actors/view/Registry.ts` 的跨域重算逻辑被拆除。

### Step D：Domain 临时缓存隔离

- 保留输入/交互类缓存（shortcut/node observer/group autofit）在各 DomainActor。
- 禁止 DomainActor 直接写 projection/query/view 缓存。

完成判定：

- Domain 缓存仅服务本域交互，不承担跨域同步职责。

## 6.4 迁移后缓存流向（最终）

```txt
mutations
  -> MutationImpactAnalyzer
  -> ProjectionStore.sync
  -> SyncCoordinator.sync
     -> QueryStore.apply
     -> ViewStore.applyNodeDomain
     -> ViewStore.applyEdgeDomain
     -> ViewStore.applyMindmapDomain
     -> ViewStore.commit + notify
```

## 7. 目录与命名方案

建议目录：

- `packages/whiteboard-engine/src/runtime/mutation/`
  - `Impact.ts`
  - `Analyzer.ts`
- `packages/whiteboard-engine/src/runtime/projection/`
  - `Store.ts`
  - `Snapshot.ts`
  - `Overrides.ts`
- `packages/whiteboard-engine/src/runtime/sync/`
  - `Coordinator.ts`
  - `types.ts`
- `packages/whiteboard-engine/src/runtime/view/`
  - `Store.ts`
  - `NodeDomain.ts`
  - `EdgeDomain.ts`
  - `MindmapDomain.ts`

命名约束：

- class 文件 PascalCase。
- 同目录避免冗余后缀，如 `ActorImpl`、`ManagerService`。

## 8. 实施计划（无兼容层）

### Phase 1：统一影响分析入口

1. 新增 `MutationImpactAnalyzer`。
2. `ChangeGateway` 统一调用 `analyze(operations)`。
3. 删除现有 hint 累积式入口（如 `applyHint + flush` 双段逻辑）。

完成标准：

- 所有写路径都由 analyzer 产出 impact。

### Phase 2：Projection 收口

1. `GraphProjector/GraphCache` 收口为 `ProjectionStore`。
2. 删除 pending/hint 中间状态，改 `sync(doc, impact)` 一步完成。
3. 保留 override API，但统一由 ProjectionStore 产出 `ProjectionChange`。

完成标准：

- 无 `hint pipeline`。

### Phase 3：Coordinator 直调收口

1. 新增 `SyncCoordinator`，固定顺序直调 domain 端口。
2. Query/View 不再自行解析 `operations` 或 graph-change 细分协议。
3. 移除内部 listen/register 的分发路径。

完成标准：

- 写入后同步只有一个入口调用。

### Phase 4：Domain Command 收口

1. `instance.commands.*` 只做参数校验与调用路由。
2. 领域逻辑进入各 `DomainActor`。
3. `DomainActor` 只产出 mutation，不直接操作跨域缓存。

完成标准：

- command 路径短且一致。

### Phase 5：性能回补（仅热点）

1. 基于 profile 确认瓶颈（大文档 drag/resize/edge reconnect）。
2. 仅在热点加 `dirty ids` 快速路径。
3. 任意异常场景回退 `full`。

完成标准：

- 性能提升可量化且无架构回退。

## 9. 可删除清单（方向）

- 旧的 hint/graph-change 细粒度分发协议。
- Query/View 内部重复失效判断层。
- 内部 actor 监听注册机制（如存在）。
- 多处重复 `syncDirty -> fallback syncFull` 样板代码。

## 10. 验收标准

1. 可追踪性：
- 任意 command 可在 1 条链路内定位到最终缓存更新。

2. 职责清晰：
- 每个缓存有唯一 owner。

3. 稳定性：
- 全量回退路径在任意未知 operation 下可用。

4. 可测试性：
- analyzer、projection、coordinator 三层可独立单测。

## 11. 测试建议

1. Analyzer 单测：
- operation -> impact 映射覆盖已知类型与未知降级。

2. Projection 单测：
- full/partial 输入下快照引用复用与正确性。

3. Coordinator 单测：
- 调用顺序、最少通知次数、异常兜底。

4. 端到端：
- command -> mutation -> view snapshot 一致性回归。

## 12. 风险与规避

风险：

- 首轮 full 重算可能带来局部性能回退。
- 迁移期间 API 面变化较大。

规避：

- 先保证语义正确，再对热点增量优化。
- 用集成回归用例锁住 command/view 行为。

## 13. 下一步执行建议

1. 先落地 Phase 1 + Phase 2（信号源和 projection 收口）。
2. 再落地 Phase 3（coordinator 直调收口）。
3. 最后执行 Phase 4（command 与 actor 边界彻底清理）。
