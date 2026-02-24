# Whiteboard Mutation Impact Plan

## 1. 背景与问题

当前复杂度主要集中在 `graph/view/query` 的同步链路：

- 同时存在 `hint`、`projection flags`、`dirty ids`、多级缓存。
- `GraphProjector -> View -> Query` 各层都在做“增量判断”，分支过多。
- 写入链路已经以 mutation 为最终产物，但失效信号还保留了 intent 风格的中间语义。

结果是：

- 链路长、调试难。
- 增量优化收益不稳定，但心智成本很高。
- 新人难以快速回答“改了一个 operation，到底哪些缓存会更新”。

## 2. 目标

- 以 `mutations/operations` 作为唯一失效信号源。
- 先收敛到“全量正确 + 简单链路”，再做热点增量。
- 明确职责边界：投影、同步编排、领域缓存各自独立。
- 一步到位，不保留兼容层。

## 3. 非目标

- 本阶段不引入状态机库。
- 不追求“每种 operation 都做到最细粒度增量”。
- 不在多个 actor 内重复解析 operations。

## 4. 总体架构（Mutation-First）

### 4.1 写入主链路

```txt
commands / input actors
  -> ChangeGateway.applyMutations(batch)
  -> core.reduceOperations(doc, operations)
  -> MutationImpactAnalyzer.analyze(operations) => impact
  -> ProjectionActor.sync(doc, impact) => projectionChange
  -> SyncCoordinator.sync({ impact, projectionChange }) // 同步直调
  -> QueryActor.apply(...)
  -> NodeActor.apply(...)
  -> EdgeActor.apply(...)
  -> MindmapActor.apply(...)
  -> ViewActor.apply(...)
```

### 4.2 角色划分

- `MutationImpactAnalyzer`：把 `operations` 转成统一 `impact`（唯一入口）。
- `ProjectionActor`：维护投影快照与投影缓存（只读模型）。
- `SyncCoordinator`：只做跨域编排（同步直调，不内部广播）。
- `Domain Actors`：只更新本域缓存与状态，不解析 operations。

## 5. 统一 Impact 模型

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

设计原则：

- 标签数量少，语义稳定。
- 无法确定时直接降级 `full`。
- `dirty ids` 仅作为可选优化提示，不作为正确性前提。

## 6. Operation 到 Impact 的推导规则

### 6.1 基础规则

- `node.create/delete` -> `nodes + order + geometry (+ mindmap 视情况)`
- `node.move/resize/rotate` -> `nodes + geometry`
- `node.update` -> 若 patch 字段不明确，直接 `full`
- `edge.create/delete` -> `edges + order`
- `edge.update/reconnect/routing` -> `edges + geometry`
- `order.*` -> `order`
- `mindmap.*` -> `mindmap + geometry`
- `viewport.*` -> `viewport`
- 未知 operation -> `full`

### 6.2 降级策略（必须）

- `operations.length > N`（例如 100） -> `full`
- `dirtyNodeIds.size > M`（例如 200） -> `full`
- 命中任意未知类型/未知 patch 结构 -> `full`

这保证实现先稳定，再逐步增量。

## 7. 缓存失效矩阵

| Impact Tag | ProjectionActor | Query | View | 说明 |
| --- | --- | --- | --- | --- |
| `full` | 全量重算 `visibleNodes/canvasNodes/visibleEdges` | 全量索引重建 | 各 slice 全量重算 | 默认兜底 |
| `nodes` | 节点投影失效 | canvas/snap 节点索引失效 | node items/handles 失效 | 节点集合变化 |
| `edges` | 可见边集合失效 | edge 相关查询失效 | edge paths/selection 失效 | 边集合变化 |
| `order` | 节点/边顺序重排 | order 索引失效 | ids/order 失效 | 不必改几何 |
| `geometry` | 可选局部重算 | snap/hit-test 几何失效 | edge path、handle、preview 失效 | 几何变化 |
| `mindmap` | 可见树相关投影失效 | mindmap 查询失效 | mindmap trees/drag 失效 | 脑图特有 |
| `viewport` | 无（doc 投影通常不变） | 无 | viewport transform | 视口状态变化 |

## 8. API 设计（简洁命名）

### 8.1 MutationImpactAnalyzer

```ts
export interface MutationImpactAnalyzer {
  analyze(operations: readonly Operation[]): MutationImpact
}
```

建议文件：

- `packages/whiteboard-engine/src/runtime/mutation/Impact.ts`
- `packages/whiteboard-engine/src/runtime/mutation/Analyzer.ts`

### 8.2 ProjectionActor（原 GraphProjector 语义收敛）

```ts
export interface ProjectionActor {
  read(): ProjectionSnapshot
  readNode(nodeId: NodeId): Node | undefined
  sync(doc: Document, impact: MutationImpact): ProjectionChange
  patchNodeOverrides(updates: NodeViewUpdate[]): ProjectionChange | undefined
  clearNodeOverrides(ids?: readonly NodeId[]): ProjectionChange | undefined
}
```

说明：

- `sync()` 内部自行决定 full/partial。
- 不再暴露 `applyHint/flush` 这种两段式 API。
- 对外只保留“输入 doc + impact，输出 change”。

### 8.3 SyncCoordinator

```ts
export interface DomainSyncPort {
  apply(input: {
    impact: MutationImpact
    projection: ProjectionChange
  }): void
}

export interface SyncCoordinator {
  sync(input: {
    impact: MutationImpact
    projection: ProjectionChange
  }): void
}
```

说明：

- 仅编排路由，不持有业务缓存，不做事件监听注册。
- 统一单点通知 view subscribers。
- 内部采用固定顺序同步直调，示例：

```ts
sync(input) {
  query.apply(input)
  node.apply(input)
  edge.apply(input)
  mindmap.apply(input)
  view.apply(input)
}
```

## 8.4 调用模式约束（关键）

- Engine 内部跨域同步只允许 `Coordinator -> Actor` 直接调用。
- 不引入 `register/listen/onImpact` 这一类内部监听机制。
- `Impact` 是调用参数模型，不是内部事件协议。
- `EventCenter` 只用于对外事件（debug/插件/UI），不承载内部主写链路。
- 任何跨域调用若不经过 coordinator，视为架构违规。

## 9. 立刻降复杂度的删减清单（Phase 1）

以下可直接删除或并入，不保留兼容：

1. 两段式 hint 流程：`applyHint + flush`。
2. 以 `GraphChangeView/Policy` 为核心的分支扩散。
3. Query/View 内部“各自再解析一次 graph change”的重复逻辑。
4. `syncDirty` 失败后回退 `syncFull` 的双路径样板代码（统一走 coordinator 策略）。

## 10. 分阶段实施（推荐顺序）

### Phase 1：收口信号源（最优先）

- 新增 `MutationImpactAnalyzer`。
- `ChangeGateway` 在 `reduceOperations` 之后直接 `analyze(operations)`。
- 先输出保守标签（宁可 full）。

验收标准：

- 所有写入路径都经过同一 `analyze()`。

### Phase 2：Projection API 收敛

- `GraphProjector` 重构为 `ProjectionActor.sync(doc, impact)`。
- 删除 `PendingState` 和 hint 累积态。
- `ProjectionChange` 仅保留 coordinator 需要的最小字段。

验收标准：

- 无 `applyHint/flush` 依赖。

### Phase 3：Coordinator 统一路由

- `SyncCoordinator` 成为唯一跨域同步入口。
- `Query/View/Node/Edge/Mindmap` 不再直接解析 operations。
- 移除内部 `listen/register` 代码路径（若存在）。

验收标准：

- “写入后同步”只出现一处主调用。

### Phase 4：热点增量回补（可选）

- 仅对真实热点增加 `dirty ids` 快速路径。
- 任何不确定情况仍回退 `full`。

验收标准：

- 性能提升可量化；复杂度不明显回升。

## 11. 命名与目录规范

- 类型用语统一：`Impact`、`Projection`、`Coordinator`。
- 避免重复后缀：同目录下不使用 `ProjectionActorImpl` 这类命名。
- class 文件采用 PascalCase（如 `Analyzer.ts` 若是 class，可改 `Analyzer.ts` + `export class Analyzer`）。

建议目录：

- `packages/whiteboard-engine/src/runtime/mutation/`
- `packages/whiteboard-engine/src/runtime/projection/`
- `packages/whiteboard-engine/src/runtime/sync/`

## 12. 为什么这条路线更优

- mutation 是最终事实，比 intent 更稳定。
- 先 full 后 incremental，能快速降低维护成本。
- “单点分析 + 单点编排”让链路可视化，排障更直接。
- 领域 actor 只处理本域，不再承担跨域推导责任。

## 13. 下一步建议（紧接可执行）

1. 先落 Phase 1：新增 `MutationImpactAnalyzer` 并接入 `ChangeGateway`。
2. 同步重命名 `GraphProjector -> ProjectionActor`，合并 `applyHint/flush`。
3. 让 `SyncCoordinator` 接管 `view/query` 的 graph 同步分发。
