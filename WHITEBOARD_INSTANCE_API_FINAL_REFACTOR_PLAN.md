# Whiteboard Instance API 最终重构方案（无兼容层）

## 1. 文档目标

本方案用于指导 `whiteboard-engine` 从当前 `Instance` 结构重构到最终形态，目标是：

1. API 简洁、命名短且清晰。
2. 职责边界明确，禁止跨层泄漏。
3. 只保留最终接口，不保留兼容层。
4. 支持后续 React/Vue/Canvas/WebGL 薄适配。

本方案默认允许破坏性变更，初始开发期直接推到最优架构。

---

## 2. 设计原则（最终版）

1. 单一写入口：所有状态写入都经 `commands`。
2. 读写分离：`state` 表示源状态，`query/view` 表示派生读取。
3. 运行时内聚：`services` 仅内部可见，不暴露给 UI。
4. 实例边界稳定：`Instance` 是唯一公共入口，子命名空间短而语义化。
5. 空间 + 职责命名：如 `view/node.ts`，避免 `nodeViewRegistryService` 式重复命名。
6. 类型单一来源：同一语义类型只定义一次，禁止复制定义。

---

## 3. 当前核心问题（从 `types/instance/index.ts` 向下）

### 3.1 Instance 边界过宽

1. `State` 暴露 `store`，形成双写入口风险。  
文件：`packages/whiteboard-engine/src/types/instance/index.ts`
2. `runtime` 同时包含 `services`、`lifecycle`、`shortcuts`，职责混杂。  
文件：`packages/whiteboard-engine/src/types/instance/index.ts`
3. `types/instance/index.ts` 承载过多领域类型，文件语义过载。  
文件：`packages/whiteboard-engine/src/types/instance/index.ts`

### 3.2 类型重复与跨域泄漏

1. `MindmapDragDropTarget` 在 `state` 与 `services` 两处定义。  
文件：`packages/whiteboard-engine/src/types/state/model.ts`  
文件：`packages/whiteboard-engine/src/types/instance/services.ts`
2. React 组件直接依赖 `runtime.services.nodeSizeObserver`，穿透 engine 内部。  
文件：`packages/whiteboard-react/src/node/components/NodeItem.tsx`

### 3.3 API 形态仍可收敛

1. `Commands` 过大，且存在 world/client 双版本冗余（`*AtClient`）。  
文件：`packages/whiteboard-engine/src/types/commands.ts`
2. `View` 已做分组，但 `global.read('string-key')` 仍对 key 字符串敏感。  
文件：`packages/whiteboard-engine/src/types/instance/index.ts`
3. `Query` 混合业务线（canvas/snap/debug）但无显式子空间。  
文件：`packages/whiteboard-engine/src/types/instance/index.ts`

---

## 4. 最终目标接口（唯一公开形态）

```ts
type Instance = {
  state: StateApi
  commands: CommandsApi
  query: QueryApi
  view: ViewApi
  events: EventsApi
  runtime: RuntimeApi
  lifecycle: LifecycleApi
}
```

### 4.1 StateApi（纯源状态）

```ts
type StateApi = {
  setDoc(doc: Document | null): void
  read<K extends StateKey>(key: K): StateSnapshot[K]
  watch<K extends StateKey>(key: K, listener: () => void): Unsubscribe
  write<K extends WritableStateKey>(
    key: K,
    next: WritableStateSnapshot[K] | ((prev: WritableStateSnapshot[K]) => WritableStateSnapshot[K])
  ): void
  batch(action: () => void): void
  batchFrame(action: () => void): void
}
```

约束：

1. 不再公开 `store`。
2. `snapshot()` 不公开，避免全量读取误用。
3. 仅 engine 内部可访问底层 store。

### 4.2 RuntimeApi（运行时只读能力）

```ts
type RuntimeApi = {
  core: Core
  viewport: ViewportApi
  platform: Platform
  container: {
    ref: RefLike<HTMLDivElement | null>
    get(): HTMLDivElement | null
  }
}
```

约束：

1. `runtime.services` 不公开。
2. `runtime.lifecycle` 不公开，移动到 `instance.lifecycle`。
3. `runtime` 只保留“环境与转换能力”。

### 4.3 LifecycleApi（实例生命周期）

```ts
type LifecycleApi = {
  start(): void
  update(config: LifecycleConfig): void
  stop(): void
}
```

约束：

1. 生命周期位于 `instance.lifecycle`，不再挂到 `runtime`。
2. UI 仅负责调用 start/update/stop，不接触内部绑定链。

### 4.4 ViewApi（语义分组）

```ts
type ViewApi = {
  global: {
    viewportTransform(): ViewportTransformView
    watchViewportTransform(listener: () => void): Unsubscribe
    shortcutContext(): ShortcutContext
    watchShortcutContext(listener: () => void): Unsubscribe
    edgePreview(): EdgePreviewView
    watchEdgePreview(listener: () => void): Unsubscribe
  }
  node: {
    ids(): NodeId[]
    watchIds(listener: () => void): Unsubscribe
    item(id: NodeId): NodeViewItem | undefined
    watchItem(id: NodeId, listener: () => void): Unsubscribe
    handles(id: NodeId): NodeTransformHandle[] | undefined
    watchHandles(id: NodeId, listener: () => void): Unsubscribe
  }
  edge: {
    ids(): EdgeId[]
    watchIds(listener: () => void): Unsubscribe
    path(id: EdgeId): EdgePathEntry | undefined
    watchPath(id: EdgeId, listener: () => void): Unsubscribe
  }
  mindmap: {
    ids(): NodeId[]
    watchIds(listener: () => void): Unsubscribe
    tree(id: NodeId): MindmapViewTree | undefined
    watchTree(id: NodeId, listener: () => void): Unsubscribe
  }
  debug: ViewDebug
}
```

约束：

1. 最终移除 `global.read/watch(key)` 字符串 key 风格。
2. 高频 key 提供语义函数，减少 typo 与认知成本。

### 4.5 QueryApi（纯计算查询）

```ts
type QueryApi = {
  canvas: {
    nodeRects(): CanvasNodeRect[]
    nodeRect(id: NodeId): CanvasNodeRect | undefined
    nodeIdsInRect(rect: Rect): NodeId[]
    watchNodes(listener: (nodeIds: NodeId[]) => void): Unsubscribe
  }
  snap: {
    candidates(): SnapCandidate[]
    candidatesInRect(rect: Rect): SnapCandidate[]
  }
  geometry: {
    anchorFromPoint(rect: Rect, rotation: number, point: Point): EdgeConnectAnchorResult
    nearestEdgeSegment(pointWorld: Point, pathPoints: Point[]): number
  }
  debug: QueryDebug
}
```

约束：

1. `query` 不含写操作。
2. 命名避免 `get*` 前缀，统一短语义动词/名词。

### 4.6 EventsApi（统一事件入口）

```ts
type EventsApi<M> = {
  on<K extends keyof M>(type: K, listener: (payload: M[K]) => void): Unsubscribe
  off<K extends keyof M>(type: K, listener: (payload: M[K]) => void): void
}
```

约束：

1. 只保留 `on/off`，不引入别名。
2. 事件名统一 `domain.action`，动作过去式。

---

## 5. 命名规范（最终执行标准）

### 5.1 文件与目录

1. 目录名：空间 + 职责。示例：`view/node.ts`、`query/snap.ts`。
2. Class 文件：PascalCase。示例：`Lifecycle.ts`、`NodeDrag.ts`。
3. 函数文件：camelCase。示例：`createInstance.ts`、`bindViewSources.ts`。
4. 避免父子重复。示例：`view/events/events.ts` 禁止。
5. 单文件目录默认收敛到上一层。

### 5.2 API 命名

1. 分组名词：`node`、`edge`、`mindmap`、`global`。
2. 操作短名：`ids/item/path/tree/handles/watchIds/watchItem`。
3. 禁止冗余前缀：如 `getNodeItemById`。
4. 坐标空间通过参数名表达：`pointWorld`、`pointScreen`。

---

## 6. 目标目录结构（Instance 根）

```text
packages/whiteboard-engine/src/
  instance/
    create.ts
    index.ts
  lifecycle/
    Lifecycle.ts
    config.ts
    bindings/
  runtime/
    core.ts
    viewport.ts
    platform.ts
    container.ts
  commands/
    index.ts
    node.ts
    edge.ts
    selection.ts
    mindmap.ts
    transient.ts
  query/
    index.ts
    canvas.ts
    snap.ts
    geometry.ts
    projector.ts
    indexes.ts
  view/
    index.ts
    global.ts
    node.ts
    edge.ts
    mindmap.ts
    bindings.ts
    metrics.ts
  events/
    index.ts
    map.ts
    bus.ts
  types/
    instance/
      index.ts
      state.ts
      runtime.ts
      commands.ts
      query.ts
      view.ts
      lifecycle.ts
      events.ts
```

说明：

1. `runtime` 只保留运行时基础能力。
2. `lifecycle` 从 `runtime` 脱离。
3. `services` 转内部实现目录，不进入公开 `types/instance`。

---

## 7. 逐模块重构清单（无兼容）

## 7.1 Instance 层

1. `Instance` 类型改为 `state/commands/query/view/events/runtime/lifecycle` 七块。
2. `runtime.lifecycle` 删除，改 `instance.lifecycle`。
3. `runtime.services` 删除公开类型，内部私有化。

涉及文件：

1. `packages/whiteboard-engine/src/types/instance/index.ts`
2. `packages/whiteboard-engine/src/instance/create.ts`
3. `packages/whiteboard-react/src/Whiteboard.tsx`

## 7.2 State 层

1. `State.store` 从公开类型中删除。
2. 删除 `State.snapshot()`。
3. 确认所有写路径仅经 `commands`。

涉及文件：

1. `packages/whiteboard-engine/src/types/instance/state.ts`（新增）
2. `packages/whiteboard-engine/src/state/factory/index.ts`
3. 所有 `instance.state.store` 引用点（需清零）

## 7.3 Runtime / Services 层

1. `types/instance/services.ts` 改为 internal types，不对外 export。
2. React 中 `runtime.services.*` 调用替换为：
   1) `commands` 能力。
   2) 或 `lifecycle binding` 能力。
3. `NodeSizeObserver` 使用桥接 hook，而非组件直连 service。

涉及文件：

1. `packages/whiteboard-engine/src/types/instance/services.ts`
2. `packages/whiteboard-react/src/node/components/NodeItem.tsx`

## 7.4 View 层

1. 移除 `global.read/watch(key)`。
2. 保留语义化 getter/watcher。
3. `ViewSnapshot` 仅作为内部导出类型，不作为 UI 主使用模式。

涉及文件：

1. `packages/whiteboard-engine/src/types/instance/view.ts`（新增）
2. `packages/whiteboard-engine/src/kernel/view/registry.ts`
3. `packages/whiteboard-react/src/common/hooks/useWhiteboardView.ts`（改为语义 hook）

## 7.5 Query 层

1. `query` 分为 `canvas/snap/geometry` 三命名空间。
2. `watchNodeChanges` 归入 `query.canvas.watchNodes`。
3. debug 保留但结构化。

涉及文件：

1. `packages/whiteboard-engine/src/types/instance/query.ts`（新增）
2. `packages/whiteboard-engine/src/api/query/*`

## 7.6 Commands 层

1. 统一 world 参数，移除 `*AtClient` 变体。
2. `nodeTransform` 与 `node` 重叠能力去重。
3. `commands` 只表达业务意图，不承载转换分支。

涉及文件：

1. `packages/whiteboard-engine/src/types/commands.ts`
2. `packages/whiteboard-engine/src/api/commands/*`
3. React 事件处理器调用点（Node/Edge 组件）

## 7.7 Events 层

1. 仅 `on/off`。
2. 事件名与 payload 收紧为核心 union。
3. 补齐文档与类型一致性。

涉及文件：

1. `packages/whiteboard-engine/src/types/instance/events.ts`
2. `packages/whiteboard-engine/src/kernel/events/*`
3. `packages/whiteboard-engine/src/runtime/lifecycle/watchers/*`

---

## 8. 迁移阶段（一次性破坏式）

## Phase A：类型拆分与边界切断

1. 拆 `types/instance/index.ts` 为多文件。
2. 删除旧平铺 API 类型。
3. 编译失败即修（不加兼容 alias）。

## Phase B：Engine 组装重构

1. `createEngine` 输出新 `Instance`。
2. `runtime` 仅保留基础能力。
3. `lifecycle` 挪到 `instance.lifecycle`。

## Phase C：React 薄适配迁移

1. 所有组件改新 API。
2. 移除组件对 `runtime.services` 直接访问。
3. 引入必要桥接 hook（只在 react 层）。

## Phase D：清理与收口

1. 删除废弃类型与导出。
2. 收紧 index 导出面。
3. 更新架构文档与示例。

---

## 9. 验收标准（DoD）

1. `Instance` 不再暴露 `runtime.services` 与 `state.store`。
2. `runtime.lifecycle` 不存在，改为 `instance.lifecycle`。
3. React 目录内无 `runtime.services` 访问。
4. `types/instance/index.ts` 变为组合入口，不含大段领域细节。
5. `commands` 无 `*AtClient` 接口。
6. `view` 无字符串 key 读写入口。
7. `pnpm --filter @whiteboard/engine run lint` 通过。
8. `pnpm --filter @whiteboard/react run lint` 通过。
9. 关键性能基线不回退（拖拽 P95 保持达标）。

---

## 10. 实施顺序建议（本仓库）

1. 先做 Phase A + B（引擎 API 定型）。
2. 再做 Phase C（React 迁移）。
3. 最后做 Phase D（清理导出和文档）。

原因：

1. 先定 `Instance` 边界，避免 React 侧反复改。
2. 保证 engine-first，UI 仅做薄适配。

