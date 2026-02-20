# Engine Headless Input 长期最优重构方案

## 核心结论

你提的方向是长期最优：

- `engine` 不处理 DOM 事件绑定。
- `engine` 只处理规范化输入事件（Normalized Input Event）。
- React/DOM 宿主只做事件采集与副作用执行（绑定、capture、preventDefault、cursor 等）。

一句话边界：

`Host Adapter 负责“事件从哪里来”，Engine 负责“事件意味着什么”。`

## 设计目标

### 功能目标

- 保证拖拽、框选、变换、连线在复杂指针路径下行为一致。
- 保证交互结束路径统一（up/cancel/blur/escape）。
- 支持未来非 React 宿主复用同一套交互语义。

### 架构目标

- 移除 engine 内部对 DOM target/window listener 的直接依赖。
- 统一输入协议：pointer、wheel、key、focus、composition。
- 统一输出协议：capture、release、preventDefault、cursor、请求重绘。

### 工程目标

- 交互状态机可单测（无浏览器环境）。
- adapter 可替换（React、Canvas host、Electron host）。
- 生命周期复杂度显著下降。

## 现状问题（为何要改）

当前链路大意：

`State.watch -> interaction handlers -> WindowBindings -> PointerHub -> selectionBox adapter -> Lifecycle`

主要问题：

- 状态监听被用于“事件源管理”，职责反转。
- `WindowBindings` 和 `selectionBox` 通过 getter 注入，层次过深。
- 多处事件语义夹杂 DOM 细节（如 target 判定）。
- 会话调度、绑定策略、业务交互耦合。

这导致：

- 新手很难判断“哪层负责什么”。
- 小改动容易跨层扩散。
- 非 React 宿主接入成本高。

## 新边界设计

## 1. Engine（Headless Core）

职责：

- 接收规范化输入事件。
- 维护交互状态机与会话仲裁。
- 输出语义指令（而不是直接操作 DOM）。

不负责：

- `addEventListener/onWindow/onContainer`
- 原生事件对象生命周期
- `preventDefault/setPointerCapture` 的直接调用

## 2. Host Adapter（React/DOM）

职责：

- 绑定宿主事件并标准化。
- 调用 `engine.input.dispatch(...)`。
- 执行 engine 输出的副作用命令。

不负责：

- 交互业务语义（拖拽判定、选择策略、边连接规则）

## 架构分层

建议目录（可在同包内先分层，不强制拆包）：

- `packages/whiteboard-engine/src/input/core/`
  - `InputPort.ts`
  - `InputRouter.ts`
  - `PointerSessionEngine.ts`
  - `NormalizedEvents.ts`
  - `InputCommands.ts`
- `packages/whiteboard-engine/src/input/sessions/`
  - `NodeDrag.ts`
  - `NodeTransform.ts`
  - `SelectionBox.ts`
  - `EdgeConnect.ts`
  - `RoutingDrag.ts`
  - `MindmapDrag.ts`
- `packages/whiteboard-react/src/common/instance/input/`
  - `createDomInputAdapter.ts`
  - `normalizePointerEvent.ts`
  - `applyInputCommands.ts`

## 规范化输入协议

核心要求：协议里不出现 DOM Event 类型。

```ts
export type InputEvent =
  | PointerInputEvent
  | WheelInputEvent
  | KeyInputEvent
  | FocusInputEvent
  | CompositionInputEvent

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel'

export type PointerInputEvent = {
  kind: 'pointer'
  phase: PointerPhase
  pointerId: number
  pointerType: 'mouse' | 'pen' | 'touch' | 'unknown'
  button: number
  buttons: number
  screen: { x: number; y: number }
  modifiers: {
    shift: boolean
    alt: boolean
    ctrl: boolean
    meta: boolean
    space: boolean
  }
  target: {
    surface: 'canvas' | 'overlay' | 'ui' | 'unknown'
    role?: 'node' | 'edge' | 'handle' | 'background'
    entityId?: string
  }
  timestamp: number
  source: 'container' | 'window' | 'program'
}
```

说明：

- `screen` 坐标由 adapter 提供，engine 用 viewport 变换到 world。
- `target` 是语义目标，不是 DOM 节点。
- `source` 保留来源信息，便于调试和边界策略。

## Engine 输出协议（副作用命令）

engine 不直接操作 DOM，只输出命令：

```ts
export type InputCommand =
  | { type: 'capturePointer'; pointerId: number }
  | { type: 'releasePointer'; pointerId: number }
  | { type: 'setWindowPointerTracking'; enabled: boolean }
  | { type: 'preventDefault'; reason: string }
  | { type: 'setCursor'; cursor: string }
  | { type: 'requestRender'; reason: string }
```

adapter 负责执行：

- `setPointerCapture/releasePointerCapture`
- window fallback 监听开关
- `event.preventDefault()`
- 宿主 cursor 写入

## 输入引擎核心模型

## InputPort

```ts
interface InputPort {
  dispatch(event: InputEvent): InputDispatchResult
}

type InputDispatchResult = {
  commands: InputCommand[]
}
```

## PointerSession

```ts
interface PointerSession<T = unknown> {
  kind: 'nodeDrag' | 'nodeTransform' | 'selectionBox' | 'edgeConnect' | 'routingDrag' | 'mindmapDrag'
  priority: number
  canStart(event: PointerInputEvent, ctx: SessionContext): boolean
  start(event: PointerInputEvent, ctx: SessionContext): T | null
  update(event: PointerInputEvent, state: T, ctx: SessionContext): T
  end(event: PointerInputEvent, state: T, ctx: SessionContext): void
  cancel(reason: CancelReason, state: T, ctx: SessionContext): void
}
```

## PointerSessionEngine

核心状态：

- `activeSession`：当前会话
- `activePointerId`：当前指针
- `trackingEnabled`：是否需要 window fallback

策略：

- `down`：按优先级扫描 session，第一命中即 start。
- `move`：仅路由给 active + pointerId 匹配。
- `up`：调用 end，统一清理。
- `cancel/focusLost/escape`：调用 cancel，统一清理。

## SessionContext（只给语义能力）

```ts
type SessionContext = {
  state: Pick<State, 'read' | 'write' | 'batch'>
  commands: EngineCommands
  query: EngineQuery
  runtime: {
    viewport: {
      screenToWorld: (p: { x: number; y: number }) => { x: number; y: number }
      getZoom: () => number
    }
  }
  config: InstanceConfig
}
```

不暴露：DOM/container/window 引用。

## React Adapter 设计

## Adapter 输入

- 监听容器 `pointerdown/move/up`。
- 在必要时监听 window `pointermove/up/cancel`（由 engine 命令驱动）。
- 监听 wheel/key/focus 等并标准化。

## Adapter 输出执行

- 执行 `InputCommand`。
- 在 Debug 模式记录命令日志和事件日志。

## Adapter 与 Engine 的桥

```ts
const result = engine.input.dispatch(normalizedEvent)
applyInputCommands(result.commands, domRuntime)
```

## Lifecycle 重构后职责

`Lifecycle` 仅做：

- 创建 `inputAdapter` 与 `engine.input`。
- `start/stop/update` 期间调用 adapter 生命周期。

移除：

- `WindowBindings`
- `createPointerWindowHub`
- `createSelectionBoxHandler`
- `getSelectionBox: () => this.input.selectionBox`

## 与现有模块映射

旧模块到新模型：

- `createNodeTransformHandler.watch(...)` -> `NodeTransform.canStart/start/update/end`
- `createSelectionBoxHandler(...)` -> `SelectionBox`
- `WindowBindings + pointerSession` -> `DomInputAdapter + PointerSessionEngine`
- `state.watch` 控制绑定 -> adapter 常驻绑定 + engine 命令驱动 fallback

## 行为与策略细节

## Pointer Capture 与 Window Fallback

推荐策略：

- 主路径：`capturePointer`。
- 兜底：window `up/cancel` + `blur`。
- 由 engine 输出命令开关，不由 adapter“猜测”。

## 多会话冲突

默认单活，按 `priority` 仲裁。

建议优先级（可调）：

1. `nodeTransform`
2. `edgeConnect`
3. `routingDrag`
4. `nodeDrag`
5. `mindmapDrag`
6. `selectionBox`

## 性能原则

- pointermove 热路径禁止 state 订阅风暴。
- session 内使用 runtime getter，不做多余对象分配。
- adapter 仅做轻量 normalize，不做业务判定。

## 一步到位迁移计划（无兼容保留）

## Phase 1：建立新协议与输入端口

- 新增 `NormalizedEvents.ts`、`InputCommands.ts`、`InputPort.ts`。
- 新增 `PointerSessionEngine` 空骨架。

验收：

- 编译通过，input 端口可接收空事件流。

## Phase 2：实现 React DOM Adapter

- 新增 `createDomInputAdapter.ts`。
- 实现 pointer/wheel/key/focus 标准化。
- 实现命令执行器 `applyInputCommands.ts`。

验收：

- adapter 可独立运行，日志可观测。

## Phase 3：迁移两条关键交互

- 先迁 `SelectionBox`、`NodeTransform`。
- 删旧链路对应实现。

验收：

- 框选、变换全通过，跨容器边界连续。

## Phase 4：迁移其余交互

- `nodeDrag/edgeConnect/routingDrag/mindmapDrag`。

验收：

- pointer 交互全部由 session engine 驱动。

## Phase 5：删除旧机制

- 删除 `WindowBindings`、`pointerSession.ts`、相关 interaction watchers。
- 删除 `selectionBox` 旧 adapter 接口。

验收：

- 全局搜索无旧链路符号。

## 验收清单

### 功能正确性

- pointer 离开容器后交互不断。
- 所有交互都有 up/cancel 收尾。
- 切 tool、切配置、doc.reset 后状态不残留。

### 架构边界

- engine 核心层不导入 DOM 类型。
- adapter 层不包含业务交互规则。
- 生命周期不参与 pointer 路由细节。

### 可测试性

- `PointerSessionEngine` 具备事件序列单测。
- 每个 session 至少有 start/update/end/cancel 测试。

## 风险与缓解

- 风险：target 语义标准化不完整。
  缓解：先定义最小 target 协议（surface + role + entityId），按场景扩展。

- 风险：capture 在不同平台表现差异。
  缓解：保留 window fallback 命令通道。

- 风险：一次性迁移回归面大。
  缓解：按 session 分阶段替换，但不保留长期双轨。

## 推荐命名规范

- 核心：`InputPort`、`PointerSessionEngine`、`SessionContext`
- 协议：`InputEvent`、`InputCommand`
- 会话：`NodeDrag`、`SelectionBox`、`NodeTransform`
- 适配层：`DomInputAdapter`、`ReactInputAdapter`

命名原则：

- 同目录减少重复前后缀。
- 名称表达职责而非实现手段。

## 最终形态（目标）

目标调用链：

`React/DOM native event -> Adapter.normalize -> engine.input.dispatch -> commands/effects -> Adapter.apply`

最终收益：

- engine 语义稳定、宿主可替换。
- 复杂度从“跨层绑定机制”收敛为“输入协议 + 会话状态机”。
- 新人可以从 `InputEvent -> Session -> Command` 一条主线读懂系统。
