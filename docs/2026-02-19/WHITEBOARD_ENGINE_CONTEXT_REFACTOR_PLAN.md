# Whiteboard Engine Context 重构方案（最优形态）

## 1. 目标

1. 用统一 `context` 消除跨层参数散传和重复转发。
2. 降低 `instance` 作为“万能依赖”的耦合，避免内部模块都依赖完整实例。
3. 保持高性能：热路径只读快照和 getter，不引入额外订阅与对象抖动。
4. 让调用链可读：打开生命周期或交互入口即可看清流程。

本方案不保留兼容层，按“可重构到最优架构”设计。

## 2. 当前复杂点（实锤点位）

1. 大量模块直接注入 `instance`，依赖面过大。
文件：`packages/whiteboard-engine/src/runtime/interaction/NodeDrag.ts`、`packages/whiteboard-engine/src/runtime/services/GroupAutoFit.ts`、`packages/whiteboard-engine/src/runtime/lifecycle/Lifecycle.ts`

2. 参数在输入层到交互层多次解包再包装。
文件：`packages/whiteboard-engine/src/runtime/lifecycle/bindings/windowBindings.ts`、`packages/whiteboard-engine/src/runtime/interaction/NodeTransform.ts`

3. 创建函数参数重复出现同一组依赖（`state/graph/query/config/syncGraph`）。
文件：`packages/whiteboard-engine/src/api/commands/index.ts`、`packages/whiteboard-engine/src/api/query/instance.ts`、`packages/whiteboard-engine/src/kernel/view/registry.ts`

4. 生命周期模块承担了太多组装细节，模块边界不够收敛。
文件：`packages/whiteboard-engine/src/runtime/lifecycle/Lifecycle.ts`

结论：当前复杂度核心不是算法，而是“缺少统一上下文模型导致依赖流混乱”。

## 3. Context 设计原则

1. 不直接把完整 `instance` 当内部 context。
2. context 分层：长期稳定依赖与每帧/每事件快照分离。
3. context 切面化：模块只拿自己需要的最小切面。
4. 纯计算函数禁止读 context，只接收显式参数。
5. hot path 优先 getter，不在 pointermove 里做状态订阅。

## 4. Context 模型（推荐）

## 4.1 Root：EngineContext（长生命周期）

```ts
type EngineContext = {
  state: State
  graph: GraphProjector
  query: Query
  view: View
  events: InstanceEvents
  commands: Commands
  apply: ApplyApi
  tx: TxApi
  config: InstanceConfig
  runtime: {
    viewport: ViewportApi
    docRef: RefLike<Document>
    containerRef: RefLike<HTMLDivElement | null>
    getContainer: () => HTMLDivElement | null
    platform: ShortcutContext['platform']
  }
  services: RuntimeServices
  schedulers: {
    raf: (cb: FrameRequestCallback) => number
    cancelRaf: (id: number) => void
    microtask: (cb: () => void) => void
    now: () => number
  }
}
```

说明：
1. `EngineContext` 是内部装配根，不直接暴露给外部使用者。
2. `instance` 仍是对外 facade，内部模块尽量不读 `instance`。

## 4.2 Slice：按职责切面（防止 God Object）

```ts
type KernelContext = Pick<EngineContext, 'state' | 'graph' | 'query' | 'config' | 'schedulers'>
type ChangeContext = Pick<EngineContext, 'apply' | 'tx' | 'graph' | 'runtime' | 'events' | 'schedulers'>
type CommandContext = Pick<EngineContext, 'state' | 'graph' | 'apply' | 'runtime' | 'query' | 'config'>
type InteractionContext = Pick<EngineContext, 'state' | 'graph' | 'query' | 'commands' | 'runtime' | 'config' | 'apply' | 'schedulers'>
type LifecycleContext = Pick<EngineContext, 'state' | 'commands' | 'runtime' | 'services' | 'events' | 'config'>
```

## 4.3 Frame：每帧快照（短生命周期）

```ts
type FrameContext = {
  tool: 'select' | 'edge'
  selectedNodeIds: Set<NodeId>
  hoveredGroupId?: NodeId
  viewportZoom: number
  docId?: string
}
```

说明：
1. `FrameContext` 在一次同步循环或一次交互更新中创建一次并复用。
2. 避免每个函数都单独 `state.read(...)`。

## 4.4 Event：输入归一化（替代散传 clientX/clientY）

```ts
type PointerInput = {
  pointerId: number
  client: { x: number; y: number }
  screen: { x: number; y: number }
  world: { x: number; y: number }
  button: 0 | 1 | 2
  modifiers: { alt: boolean; shift: boolean; ctrl: boolean; meta: boolean }
}
```

说明：
1. DOM 绑定层只负责把浏览器事件转成 `PointerInput`。
2. 交互模块只吃 `PointerInput`，不再吃大对象 options。

## 5. 哪些模块最适合用 Context 降复杂度

## 5.1 一级优先（收益最大）

1. `packages/whiteboard-engine/src/instance/create.ts`
目标：增加 `createEngineContext`，所有工厂只收 context slice。

2. `packages/whiteboard-engine/src/runtime/interaction/*.ts`
目标：构造函数从 `constructor(instance)` 改为 `constructor(ctx: InteractionContext)`。

3. `packages/whiteboard-engine/src/runtime/lifecycle/Lifecycle.ts`
目标：构造函数从 `(instance, dom, emit)` 改为 `(ctx: LifecycleContext, dom: DomBindings)`，emit 走 `ctx.events`。

4. `packages/whiteboard-engine/src/runtime/lifecycle/bindings/windowBindings.ts`
目标：统一输出 `PointerInput`，删除重复 `{ pointerId, clientX, clientY, ... }` 转发模板。

5. `packages/whiteboard-engine/src/api/commands/index.ts`
目标：`createCommands(ctx: CommandContext)`，删除额外传 `graph/syncGraph` 的并行参数。

## 5.2 二级优先（结构收敛）

1. `packages/whiteboard-engine/src/api/query/instance.ts`
目标：`createQuery(ctx: KernelContext & { getContainer })`。

2. `packages/whiteboard-engine/src/kernel/view/registry.ts`
目标：`createViewRegistry(ctx: KernelContext & { platform })`。

3. `packages/whiteboard-engine/src/change/pipeline.ts`
目标：改为 `createChangePipeline(ctx: ChangeContext)`，减少回调拼接。

4. `packages/whiteboard-engine/src/runtime/services/GroupAutoFit.ts`
目标：从 `Instance` 依赖切为 `ServiceContext`（状态读、apply、events、config、docRef）。

5. `packages/whiteboard-engine/src/runtime/services/ViewportNavigation.ts`
目标：输入接口统一为 `PointerInput` + config getter。

## 5.3 三级优先（细节统一）

1. `packages/whiteboard-engine/src/runtime/lifecycle/input/canvas/viewport.ts`
2. `packages/whiteboard-engine/src/runtime/lifecycle/input/canvas/selection.ts`
3. `packages/whiteboard-engine/src/runtime/lifecycle/input/shortcut/handlers.ts`

目标：统一 Input 层 context，减少 `enabled/minZoom/maxZoom/...` 的临时注入散点。

## 6. API 设计与命名规范

## 6.1 命名规范

1. 类型：`PascalCase`，短名优先。
例：`EngineContext`、`InteractionContext`、`PointerInput`。

2. 变量：`camelCase`，尽量不重复父域语义。
例：`ctx`、`frame`、`input`，避免 `runtimeInteractionContext`。

3. 目录名表达空间，文件名表达职责。
例：`runtime/interaction/NodeDrag.ts`（不要 `NodeDragInteraction.ts`）。

4. context 文件集中在 `src/context`。
建议结构：
`context/types.ts`
`context/create.ts`
`context/slices.ts`
`context/frame.ts`
`context/input.ts`

## 6.2 API 约束

1. 内部模块禁止接收完整 `Instance`。
2. 允许接收 `ctx` 与 `frame`，但不允许“ctx + 一堆重复参数”并存。
3. interaction API 统一为输入对象：
`start(input)` / `update(input)` / `end(input)` / `cancel(input?)`
4. 纯计算保留为纯函数，不读 `ctx`。

## 7. 推荐重构后调用链

## 7.1 启动链路

1. `createEngine` 创建底层对象（state/graph/query/view/events/runtime/services）。
2. `createEngineContext` 聚合为 root context。
3. `createCommands(ctx.command)`、`createInteractions(ctx.interaction)`、`createLifecycle(ctx.lifecycle)`。
4. `lifecycle.start()` 启动输入与 watchers。

## 7.2 输入到交互链路

1. DOM 事件进入 binding。
2. binding 生成 `PointerInput`。
3. interaction 消费 `PointerInput`，通过 `ctx` 访问 query/commands/state。
4. 变更进入 apply/graph flush/pipeline，同步 view/query。

## 8. 分阶段落地计划

## Phase 0：建立 context 基础设施

1. 新增 `src/context` 目录和类型定义。
2. 新增 `createEngineContext` 与切面提取函数。
3. 不改行为，只改依赖注入路径。

## Phase 1：命令与变更管线切 ctx

1. `createCommands` 改为单参数 `ctx`。
2. `createTransient` 从 `(instance, graph, syncGraph)` 收敛为 `ctx`。
3. `createChangePipeline` 收敛为 `ctx`。

## Phase 2：交互层切 ctx + PointerInput

1. 改 `NodeDrag/NodeTransform/RoutingDrag/MindmapDrag/EdgeConnect` 构造签名。
2. 输入参数统一改为 `PointerInput` 与少量语义参数。
3. 删除 lifecycle 到 interaction 的重复参数包装。

## Phase 3：lifecycle 与 bindings 收敛

1. `Lifecycle` 构造函数改 `LifecycleContext`。
2. `windowBindings` 统一事件归一化。
3. `canvas input` 模块只关心 UI 事件路由，不拼业务参数。

## Phase 4：service 层切 ctx

1. `GroupAutoFit` 与 `ViewportNavigation` 切换为 `ServiceContext`。
2. 将调度器（raf/microtask/now）统一来自 `ctx.schedulers`。

## Phase 5：kernel/query/view 收敛

1. `createViewRegistry/createQuery` 改为收切面 context。
2. `FrameContext` 接入 node/edge/mindmap registry 热路径。

## 9. 性能与复杂度控制

1. `FrameContext` 对象在一次同步内复用，避免重复读取与临时对象分配。
2. `PointerInput` 在 binding 层生成一次，interaction 复用。
3. 纯计算函数继续下沉到 `kernel/*`，避免 context 污染算法层。
4. 继续使用现有 `bench:check` 作为门禁，重点看 `drag-frame` 与 `node-hint`。

## 10. Definition of Done

1. 内部新增/重构模块不再注入完整 `instance`。
2. interaction 与 lifecycle 不再散传 `clientX/clientY/pointerId/minSize/...`。
3. `create*` 工厂函数签名数量明显下降，依赖一眼可见。
4. lint 通过，性能门禁不退化。

## 11. 一句话结论

`context` 应该是“按职责切面的 engine 内部依赖容器”，不是完整 `instance`。  
通过 `EngineContext + SliceContext + FrameContext + PointerInput` 四层模型，可以在不牺牲性能的前提下，显著降低当前参数散传和调用链复杂度。

## 12. 当前落地进度（2026-02-19）

已完成：
1. `src/context/*` 基础设施已落地（`create/slices/frame/input`）。
2. `instance/create` 已切到 context 装配主链路（commands/change/interaction/lifecycle）。
3. commands 与 change pipeline 已切到 context slice。
4. 主要 interaction（`NodeDrag/NodeTransform/RoutingDrag/MindmapDrag/EdgeConnect`）已切到 `InteractionContext`，其中：
   - `NodeDrag/NodeTransform/RoutingDrag/MindmapDrag` 已在 start/update/end/cancel 全链路统一 `PointerInput`。
   - `EdgeConnect` 已完成 start/update/commit/hover/nodePointerDown 的 `PointerInput` 统一。
5. service 层已切到 `ServiceContext`：
   - `GroupAutoFit` 不再直接持有 `instance`，改为读 `context`（含 `events/schedulers/runtime/apply`）。
   - `ViewportNavigation` 不再直接持有 `instance`，改为读 `context`，且 `startPan/updatePan` 输入统一 `PointerInput`。
6. 生命周期 canvas viewport 输入已改为统一 `toPointerInput(...)`。
7. lifecycle 内部子模块已开始切最小依赖注入：
   - `Container`：改为 `getContainer/observe/unobserve/setContainerRect` 最小依赖。
   - `WindowKey`：改为仅注入 `setSpacePressed`。
   - `Cleanup`：改为注入取消与释放函数集合，不持有 `instance`。
   - `History`：改为注入 `getCore/writeHistoryState/configure/clear`。
8. `Lifecycle` 主类已切为优先通过 `LifecycleContext` 访问（不再持有本地 `instance` 成员）。
9. `createCanvasInput/createWindowBindings` 已从 `instance` 收敛到 `LifecycleContext` 切面；`selection/shortcut/viewport` 输入子模块同样收敛为 `context` 驱动。
10. `LifecycleContext.instance` 已移除，生命周期域已不再暴露完整实例。
11. `selectionEvents/stateEvents` watchers 已切到纯 `state + emit` 依赖（不再依赖 `Instance` 类型）。
12. `edgeConnect` 的 hover 内部计算已收敛为私有能力（移除 `updateHover` 对外 API）。
13. `pointerSession/selectionBox/windowBindings` 已切到更小依赖注入（`onWindow` + selectionBox 最小接口）。
14. `lint`（engine/core/react）与 `bench:check` 已通过，性能门禁维持通过。

剩余建议（下一步）：
1. 把 `SelectionBoxSession` 进一步标准化为 `pointerSession` 可复用协议（便于扩展更多交互会话）。
2. 对 lifecycle 下剩余 `bindings` 做一次命名与职责统一（减少 “window/container” 双向心智跳转）。
