# Whiteboard View Actor Simplify Plan

## 1. 目标

- 从 `get + watch` 碎片接口切换到单一 `Store(getState + subscribe)`。
- 从 `common/view` 通用 derivation 框架切换到 `ViewActor + 领域子 actor`。
- `ViewActor` 作为唯一网关：统一接 graph/state 变化并同步各视图域。
- 一步到位，不保留兼容层。

## 2. 核心判断

- 目前复杂度高的根因不是字段数量，而是“通用框架 + 领域缓存”双轨并存。
- `get + watch` 对外 API 过碎，React 层需要重复绑定，心智负担高。
- 最优模式是 `单一 View Store + 统一 selector`：Engine 对外只提供一个 `View` Store，React 统一通过 selector 消费，领域内部缓存实现保持内聚且不外露。

## 3. 最终结构

- `ViewActor`：唯一协调者，只负责分发同步，不持有业务规则。
- `ViewportViewActor`：维护 viewport 视图状态。
- `NodeViewActor`：维护 node 视图状态（ids/items/handles）。
- `EdgeViewActor`：维护 edge 视图状态（ids/paths/preview/selection）。
- `MindmapViewActor`：维护 mindmap 视图状态（ids/trees/drag）。
- 不再使用 `GlobalViewActor`。

## 4. 统一 Store 协议

```ts
export type ReadonlyStore<TState> = {
  getState: () => TState
  subscribe: (listener: () => void) => () => void
}
```

说明：
- `getState + subscribe` 是 Redux/Zustand 风格的常见只读协议，认知成本最低。
- `useSyncExternalStore` 需要的 `getSnapshot` 由 React 侧 hook 内部适配，不暴露到业务 API。

## 5. 对外 View API（推荐）

```ts
export type ViewState = {
  viewport: ViewportSlice
  nodes: NodeSlice
  edges: EdgeSlice
  mindmap: MindmapSlice
  metrics: ViewMetrics
}

export type View = ReadonlyStore<ViewState>
```

```ts
export type ViewportSlice = {
  transform: ViewportTransformView
}

export type NodeSlice = {
  order: NodeId[]
  items: ReadonlyMap<NodeId, NodeViewItem>
  handles: ReadonlyMap<NodeId, readonly NodeTransformHandle[]>
}

export type EdgeSlice = {
  order: EdgeId[]
  paths: ReadonlyMap<EdgeId, EdgePathEntry>
  preview: EdgePreviewView
  selection: {
    endpoints: EdgeEndpoints | undefined
    routing: EdgeSelectedRoutingView
  }
}

export type MindmapSlice = {
  order: NodeId[]
  trees: ReadonlyMap<NodeId, MindmapViewTree>
  drag: MindmapDragView | undefined
}

export type ViewMetrics = {
  nodes: {
    items: ViewDebugMetric
    handles: ViewDebugMetric
  }
  edges: {
    paths: ViewDebugMetric
  }
  mindmap: {
    trees: ViewDebugMetric
  }
}
```

## 6. ViewActor API（网关）

```ts
export class ViewActor {
  start(): void
  stop(): void
  onGraphChange(change: GraphChange | undefined): void
  onStateChange(key: StateKey): void
  toView(): View
}
```

路由规则：
- `onGraphChange`：
- `viewport.syncGraph(change)`（通常可空实现）
- `node.syncGraph(change)`
- `edge.syncGraph(change)`
- `mindmap.syncGraph(change)`
- `onStateChange`：
- `viewport` -> `viewport.syncState('viewport')` + `node.syncState('viewport')`
- `selection/groupHovered/tool` -> `node.syncState(key)`
- `edgeConnect/edgeSelection/tool` -> `edge.syncState(key)`
- `mindmapLayout/mindmapDrag` -> `mindmap.syncState(key)`

## 7. React 接入（统一 selector）

```ts
export function useViewSelector<TState, TSelected>(
  store: ReadonlyStore<TState>,
  selector: (state: TState) => TSelected,
  isEqual: (a: TSelected, b: TSelected) => boolean = Object.is
): TSelected
```

用法示例：

```ts
const edgePreview = useViewSelector(instance.view, (s) => s.edges.preview)
const nodeItem = useViewSelector(instance.view, (s) => s.nodes.items.get(nodeId))
const viewportTransform = useViewSelector(instance.view, (s) => s.viewport.transform)
```

结果：
- React 不再为每个字段手写 `watchX`。
- 所有订阅入口一致，学习成本显著下降。

## 8. 删除清单（一步到位）

删除目录 `packages/whiteboard-engine/src/runtime/common/view/` 全部文件：
- `Derivation.ts`
- `Derivations.ts`
- `DerivedRegistry.ts`
- `Registry.ts`
- `RevisionStore.ts`
- `ViewPipeline.ts`
- `register.ts`
- `index.ts`
- `metrics.ts`
- `shared.ts`

说明：
- 若 `metrics/shared` 仍需复用，迁移到 `packages/whiteboard-engine/src/runtime/actors/view/shared/` 后删除原文件，不保留双份。

## 9. 实施步骤

1. 新建 `packages/whiteboard-engine/src/runtime/actors/view/` 下 5 个文件：
- `Actor.ts`
- `Viewport.ts`
- `Node.ts`
- `Edge.ts`
- `Mindmap.ts`
2. 把现有 node/edge/mindmap view registry 的缓存与同步逻辑迁入对应 actor（同名领域收口）。
3. 在 `EdgeViewActor` 中收口 `preview/selectedEndpoints/selectedRouting`，不再放“全局域”。
4. 在 `createActorRuntime` 中创建并返回新的 `viewActor`（不再返回转发 `ViewActor`）。
5. 在 `instance/create.ts` 删除 `createView(...)` 装配，改为 `instance.view = actors.view.toView()`。
6. `ChangeGateway` 保持 `graph.syncAfterMutations -> view.onGraphChange` 直连。
7. `ViewActor.start()` 内部订阅 `state.watchChanges` 并路由到各子 actor。
8. 删除 `runtime/common/view` 全目录引用并清理导出。
9. 构建验证 `@whiteboard/core`、`@whiteboard/engine`、`@whiteboard/react`。

## 10. 链路（收敛后）

1. 写入：
`commands/actor -> mutate -> ChangeGateway -> graph.syncAfterMutations -> view.onGraphChange`
2. 读订阅：
`react -> useViewSelector(instance.view, selector)`
3. 状态：
`state.write -> ViewActor.onStateChange -> 对应领域 actor`

## 11. 边界约束

- `ViewActor` 只协调，不写业务状态。
- 子 actor 只维护本领域视图状态，不跨域持有其他 actor。
- 对外只暴露单一 `ReadonlyStore<ViewState>`，不暴露缓存失效/依赖签名等内部概念。
- 命名保持简短：`Viewport/Node/Edge/Mindmap/Actor`，避免冗余前后缀。
