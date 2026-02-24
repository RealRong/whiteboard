# Whiteboard Single Projection Snapshot Plan

## 1. 目标

- 用一份集中 `ProjectionSnapshot` 取代分散缓存。
- 按 domain 切片（slice）组织数据，但只允许统一提交（single commit）。
- 写入走函数式 pipeline，读侧只读快照，不做副作用计算。
- 在不明显影响功能与性能的前提下降低复杂度。

## 2. 核心结论

当前复杂度主要来自：
- 各模块各自持有缓存、各自失效、各自重算。
- 同一种变化在多个层重复推导（impact、projection、query/view）。

目标结构：
- `mutations -> projectors -> next ProjectionSnapshot -> commit once`
- 所有 query/view 从同一快照读取。

## 3. Snapshot 模型（单一事实源）

```ts
export type ProjectionSnapshot = {
  revision: number
  docId?: string
  nodes: NodeSlice
  edges: EdgeSlice
  mindmap: MindmapSlice
  indexes: IndexSlice
}
```

```ts
export type NodeSlice = {
  order: NodeId[]
  byId: ReadonlyMap<NodeId, Node>
  rectById: ReadonlyMap<NodeId, CanvasNodeRect>
}

export type EdgeSlice = {
  order: EdgeId[]
  byId: ReadonlyMap<EdgeId, Edge>
  endpointsById: ReadonlyMap<EdgeId, EdgeEndpoints>
  pathById: ReadonlyMap<EdgeId, EdgePathEntry>
}

export type MindmapSlice = {
  order: NodeId[]
  byId: ReadonlyMap<NodeId, MindmapViewTree>
}

export type IndexSlice = {
  nodeToEdgeIds: ReadonlyMap<NodeId, ReadonlySet<EdgeId>>
}
```

说明：
- 结构按 domain 分 slice，但生命周期统一。
- 每次写入只生成一个新 `ProjectionSnapshot`，并一次性发布。

## 4. 写入 Pipeline（函数式）

```ts
type ProjectionProjector = (
  prev: ProjectionSnapshot,
  ctx: ProjectionContext
) => ProjectionSlicePatch
```

```ts
type ProjectionContext = {
  doc: Document
  impacts: MutationImpact
  now: number
}
```

```ts
type ProjectionSlicePatch = {
  nodes?: NodeSlice
  edges?: EdgeSlice
  mindmap?: MindmapSlice
  indexes?: IndexSlice
  changed: {
    slices: ProjectionSliceKey[]
    nodeIds?: NodeId[]
    edgeIds?: EdgeId[]
    nodeOrderChanged?: boolean
    edgeOrderChanged?: boolean
  }
}
```

固定阶段：
1. `reduceOperations` 产出 `doc + impacts`
2. `NodeProjector`（节点和矩形）
3. `EdgeProjector`（端点和路径）
4. `MindmapProjector`
5. `IndexProjector`（`nodeToEdgeIds` 等索引）
6. 合并 patch，生成 `nextSnapshot`
7. `commit(nextSnapshot, changedSet)` 一次提交

## 5. Store API（简洁）

```ts
export type ProjectionCommit = {
  snapshot: ProjectionSnapshot
  changed: ProjectionSlicePatch['changed']
}

export class ProjectionStore {
  get(): ProjectionSnapshot
  apply(input: { doc: Document; impacts: MutationImpact; now: number }): ProjectionCommit
  replace(doc: Document, now: number): ProjectionCommit
  subscribe(listener: (commit: ProjectionCommit) => void): () => void
}
```

约束：
- `get()` 纯读取，不触发重算。
- 只有 `apply/replace` 可改 snapshot。
- 不允许 query/view 内部偷偷持久化二级缓存。

## 6. 读侧约束（降复杂关键）

- Query：
- 只读 `ProjectionSnapshot`（和 `changed`）。
- 不持有跨调用可变缓存（或只持有轻量 memo，不做数据真相）。

- View：
- 只消费 `snapshot + changed`。
- 只做选择性映射，不做隐式全量重建。

## 7. 性能策略（避免回退）

- 结构共享：未变化 slice 复用旧引用。
- changed set 驱动：按 `nodeIds/edgeIds` 做增量更新。
- 禁止 hidden full read：dirty 循环不得触发全量 snapshot 计算。
- 热路径仅使用 `changed` 与 slice map，避免多层扫描。

## 8. 对当前代码的落地映射

- `runtime/projection/Store.ts`：
- 升级为唯一提交入口，移除读取时重算行为。

- `runtime/query/EdgePath.ts`：
- 拆掉内部“失效+索引+缓存+预览”混合逻辑。
- 主路径改为直接读 `snapshot.edges.pathById`。
- reconnect 仅做临时覆盖计算，不回写主缓存。

- `runtime/view/*`：
- `Node/Edge/Mindmap` 域只基于 snapshot 做视图拼装。
- 不再各自维护独立真相缓存。

## 9. 迁移步骤（一次切换，不保留双写）

1. 先定义新 `ProjectionSnapshot` 与 `ProjectionCommit` 类型。
2. 实现 `ProjectionStore.apply/replace/get/subscribe` 新模型。
3. 迁移 Node projector 到新 snapshot。
4. 迁移 Edge projector（含 endpoints/path）到新 snapshot。
5. 迁移 query/view 到“只读 snapshot + changed”。
6. 删除旧分散缓存与对应失效逻辑。

## 10. 验收标准

- 功能一致：
- 节点拖拽/缩放/旋转、连线创建、重连、路由点编辑、框选与视图更新保持一致。

- 性能不回退：
- 大图拖拽与连线交互帧耗时不劣化（建议阈值 `±3%`）。
- `ProjectionCache.read`/路径重算次数明显下降。

- 复杂度下降：
- `EdgePath` 不再承担多职责状态机。
- 投影链路可在 1 条主路径追踪：`apply -> projectors -> commit -> subscribers`。

