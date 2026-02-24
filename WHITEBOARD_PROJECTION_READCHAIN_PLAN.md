# Whiteboard Projection Readchain Plan

## 1. 目标

- 收敛读链复杂度，保留性能。
- 明确单一提交事实源：`ProjectionStore.commit`。
- 让 Query / View 只消费 `revision + impact + snapshot`，不再重复推导变更语义。
- 收敛写入口语义：常规写入统一 `apply`，文档替换统一 `replace`。

## 2. 现状与问题

当前主链路：

`mutate -> ProjectionStore.apply/replace -> commit(snapshot+change) -> Query indexes 同步 + View domains 同步 -> UI 读取`

链路本身可接受，剩余复杂度主要来自三点：

- `ProjectionChange` 与 `MutationImpact` 并存，语义重复。
- Query / View 对投影变更各自做一套同步策略，缓存失效逻辑分散。
- `apply/replace` 的输入模型不够统一，读链追踪时要跨多个分支理解。

## 3. 目标链路

统一为：

`commands/input -> mutate -> core.reduceOperations -> impact -> ProjectionStore.commit -> Query/View consume commit -> UI read`

关键约束：

- `ProjectionStore` 是读链唯一提交入口。
- Query / View 不再解析 `operations`，只看 commit。
- commit 语义只保留两种：`apply`、`replace`。

## 4. 核心契约（命名与 API）

## 4.1 Impact 模型

沿用并强化 `runtime/mutation/Impact.ts`：

```ts
export type MutationImpactTag =
  | 'full'
  | 'nodes'
  | 'edges'
  | 'order'
  | 'geometry'
  | 'mindmap'
  | 'viewport'

export type MutationImpact = {
  tags: ReadonlySet<MutationImpactTag>
  dirtyNodeIds?: readonly NodeId[]
  dirtyEdgeIds?: readonly EdgeId[]
}
```

规则：

- `impact` 是唯一失效语义，不再在投影层引入第二套变化模型。
- 无法精确判断时直接降级 `full`。

## 4.2 Commit 模型

新增统一 commit 契约：

```ts
export type ProjectionCommit = {
  revision: number
  kind: 'apply' | 'replace'
  snapshot: ProjectionSnapshot
  impact: MutationImpact
}
```

说明：

- `revision` 用于读侧版本对齐。
- `kind` 用于区分常规 mutation 与整文档替换。
- 删除 `ProjectionChange`（`kind/source/projection flags`）这一层重复语义。

## 4.3 ProjectionStore API

建议收敛为：

```ts
export type ProjectionStore = {
  getSnapshot: () => ProjectionSnapshot
  getRevision: () => number
  subscribe: (listener: (commit: ProjectionCommit) => void) => () => void

  apply: (input: {
    doc: Document
    operations: readonly Operation[]
    impact?: MutationImpact
  }) => ProjectionCommit

  replace: (input: {
    doc: Document
    impact?: MutationImpact
  }) => ProjectionCommit

  readNodeOverrides: () => NodeViewUpdate[]
  patchNodeOverrides: (updates: NodeViewUpdate[]) => ProjectionCommit | undefined
  clearNodeOverrides: (ids?: readonly NodeId[]) => ProjectionCommit | undefined
}
```

说明：

- `doc` 显式入参，避免 `ProjectionStore` 隐式读取外部状态。
- `impact` 默认由 `MutationImpactAnalyzer` 推导，必要时允许外部显式传入。

## 4.4 Query 读侧契约

Query 不做“推送式多分支同步”，改为“revision 驱动按需同步”：

```ts
export type QueryIndexStore = {
  syncTo: (commit: ProjectionCommit) => void
  ensure: (revision: number, snapshot: ProjectionSnapshot) => void
}
```

规则：

- 订阅 commit 时只记录 `latestCommit` 与必要增量信息。
- 真正索引重建发生在 `query.*` 被调用时（`ensure`）。
- `ensure` 对比 `indexRevision` 与 `commit.revision`，决定增量或全量。

## 4.5 View 读侧契约

View 按 commit 驱动域同步，但统一入口，去掉多处分散判断：

```ts
export type ViewRegistry = {
  applyCommit: (commit: ProjectionCommit) => void
  getState: () => ViewState
  subscribe: (listener: () => void) => () => void
}
```

规则：

- 各 domain 只接受 `commit`，不再接收 `ProjectionChange`。
- `impact.tags` 决定是否同步对应域。
- 没有 listener 时仅标记 dirty；首次 `getState/subscribe` 再补算。

## 5. 模块职责调整

## 5.1 MutationExecutor

保留职责：

- `reduceOperations`
- 写入 document
- 调用 `projection.apply/replace`

移除职责：

- 组装 Projection 特有变化结构（例如 projection flags）。

## 5.2 ProjectionStore

保留职责：

- 维护 `snapshot`、`revision`
- 统一 commit 发布
- 管理 node override

移除职责：

- 向下游暴露“第二套变化语义”（`ProjectionChange`）。

## 5.3 QueryStore

保留职责：

- 索引构建与几何查询

新增约束：

- 只能从 commit 获取失效信息。
- 索引缓存必须有 `revision`，不允许无版本隐式复用。

## 5.4 ViewRegistry

保留职责：

- 组合 node/edge/mindmap/viewport 视图域

新增约束：

- 只消费 commit。
- 只处理 domain 投影，不承担 mutation 语义解释。

## 6. 分阶段实施

## Phase 1：冻结 commit 契约

改动点：

- `packages/whiteboard-engine/src/types/projection.ts`
- `packages/whiteboard-engine/src/runtime/projection/Store.ts`

动作：

- 新增 `revision/kind/impact` 到 `ProjectionCommit`。
- `ProjectionStore` 内部仍可暂时复用现有缓存算法，但对外只发新 commit。

验收：

- 编译通过。
- Query/View 全部改为读取新 commit 字段。

## Phase 2：删除 ProjectionChange 语义

改动点：

- `packages/whiteboard-engine/src/runtime/query/Store.ts`
- `packages/whiteboard-engine/src/runtime/view/Registry.ts`
- `packages/whiteboard-engine/src/types/projection.ts`

动作：

- 移除 `ProjectionChange` 类型与消费路径。
- Query/View 改成 `commit.impact` 驱动。

验收：

- 代码中不再出现 `ProjectionChange` 引用。

## Phase 3：Query revision 化

改动点：

- `packages/whiteboard-engine/src/runtime/query/Indexes.ts`
- `packages/whiteboard-engine/src/runtime/query/Store.ts`

动作：

- 为索引引入 `indexRevision`。
- `ensure()` 时依据 `revision` 与 `impact` 决定增量/全量更新。

验收：

- 读链在无 commit 时不重复重建索引。
- 大图 hit-test / snap 性能不回退。

## Phase 4：View 统一 commit 同步

改动点：

- `packages/whiteboard-engine/src/runtime/view/Registry.ts`
- `packages/whiteboard-engine/src/runtime/view/NodeDomain.ts`
- `packages/whiteboard-engine/src/runtime/view/EdgeDomain.ts`
- `packages/whiteboard-engine/src/runtime/view/MindmapDomain.ts`

动作：

- 统一 `applyCommit` 入口。
- 域内只按 `impact.tags` 做最小同步。

验收：

- `getState`、`subscribe` 输出行为一致。
- 无 listener 场景不做无效同步。

## Phase 5：收敛 apply/replace 入口语义

改动点：

- `packages/whiteboard-engine/src/runtime/write/MutationExecutor.ts`
- `packages/whiteboard-engine/src/runtime/write/WriteCoordinator.ts`

动作：

- 常规 mutation 仅调 `projection.apply`。
- 文档 reset/import 仅调 `projection.replace`。
- 移除 “partial/full + source” 混合分支。

验收：

- 写链可在一条路径追踪完成。

## 7. 风险与控制

风险：

- 增量策略收敛后，局部场景可能临时退化为 `full`。
- Query 改为按需 ensure 后，首次读可能出现单次抖动。

控制：

- 优先保证正确性；增量命中率作为第二阶段优化。
- 基准以热路径为准：`drag-frame`、`node-transform-frame`、`edge-routing-frame`。

## 8. 验收标准

功能：

- 节点拖拽、缩放、旋转。
- 连线创建、重连、路由点编辑。
- 框选、mindmap 拖拽、viewport 变更。
- undo/redo、doc reset/import。

工程：

- `pnpm -F @whiteboard/engine lint`
- `pnpm -F @whiteboard/engine build`
- `pnpm -F @whiteboard/engine bench:check`

性能：

- `drag-frame`、`node-transform-frame` 维持当前量级。
- `edge-routing-frame p95` 不高于既有阈值。

## 9. 完成定义（DoD）

- 对外只存在一套 commit 语义：`revision + kind + impact + snapshot`。
- Query / View 不再消费 `ProjectionChange`。
- `apply/replace` 语义清晰且入口单一。
- 读链追踪可在 5 分钟内向新人讲清：

`mutate -> reduce -> impact -> projection commit -> query/view consume -> UI read`
