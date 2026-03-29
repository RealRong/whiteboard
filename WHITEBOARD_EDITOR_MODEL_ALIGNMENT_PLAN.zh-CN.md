# Whiteboard Editor 底层模型对齐重构方案

## 1. 文档目标

这份文档只回答一个问题：

**如果要对 `packages/whiteboard-editor` 做一次真正的底层模型对齐，让交互链、临时状态、feature 模块和 editor 装配整体降复杂度，那么长期最优的重构方式是什么。**

这里说的“底层模型对齐”不是继续做零散清理，也不是只改命名，而是把 editor 内部最核心的四类东西彻底分开：

1. 输入事实
2. 交互启动
3. 活跃交互会话
4. 临时投影状态

如果这四类东西不分开，后面再怎么拆文件、换目录、改名字，复杂度都不会真正下降。

---

## 2. 核心结论

当前 `whiteboard-editor` 的复杂度，根源不是“没有 driver registry”，而是：

**driver 只统一了最外层“pointer down 启动谁”，但 feature 内部仍然把 driver、active interaction session、projection store 混在一起。**

这会导致三个直接问题：

1. `session` 这个词在工程里有多种含义。
2. 每个 feature 都在重复维护 `active + session + clear + commit + preview` 这一整套样板。
3. `editor.session` 这个名字本身就有误导性，因为 React 实际消费的是 projection，不是 interaction session。

所以真正的长期最优方向不是继续在现有结构上小修小补，而是把整个 editor 收敛到下面这条主链：

```ts
Host Input
  -> Resolved Input
  -> Passive Processors
  -> Interaction Drivers
  -> Active Interaction Session
  -> Projection Stores / Commands
```

一句话说：

**driver 要无状态，session 要一次一份，projection 要独立成层，gesture/planner 只做基础设施。**

---

## 3. 当前系统真正乱在哪里

## 3.1 `driver` 只统一了启动层，没有统一内部对象模型

现在顶层已经有了：

- interaction registry
- passive input runtime
- input router

这一步是对的，但它只统一了：

```ts
pointer down -> 启动哪个 feature
```

没有统一的是 feature 内部更关键的部分：

1. active session 状态放哪
2. 临时 preview / hover / hidden / patch 放哪
3. commit 怎么组织
4. 交互转换怎么表达

所以你现在会看到一个现象：

- 顶层看起来已经有 driver 了
- 但 feature 里面读起来还是乱

这是因为底层对象模型还没对齐。

## 3.2 `session` 一词在工程里至少有三种含义

这是当前最大的概念噪音来源之一。

### A. 真正的 active interaction session

这是 `InteractionCoordinator` 返回的那种一次性交互会话：

- 有 `move / up / cancel / blur / keydown / keyup`
- 生命周期从 start 到 finish/cancel

它才是真正意义上的 session。

### B. feature 级启动器，却也叫 session

例如：

- `createTransformSession`
- `createNodeDragSession`
- `createEdgeConnectSession`
- `createMarqueeSession`

这些模块很多对外其实暴露的是：

```ts
start(...)
cancel()
```

它们更接近 driver 或 session factory，而不是“当前活跃会话本身”。

### C. 临时视觉状态，也被叫 session

例如：

- `features/node/session/node.ts`

这里的 `NodeSession` 实际存的是：

- patch
- hovered
- hidden

这根本不是交互会话，而是 node projection entry。

也就是说，现在 `session` 这个词同时代表：

1. 活跃交互生命周期
2. feature 启动器
3. 临时投影状态

这就是为什么 node 那一组读起来会很乱。

## 3.3 feature 模块普遍把三层职责揉在一起

当前很多 feature 都在一个模块里同时做：

1. 交互启动
2. 活跃交互状态维护
3. projection 写入
4. commit
5. cleanup

典型例子：

- `features/node/session/transform.ts`
- `features/node/drag/session.ts`
- `features/edge/connectSession.ts`
- `features/draw/input.ts`

它们几乎都有同样的模式：

```ts
let active = null
let session = null

start() {
  const nextSession = interaction.start(...)
  active = ...
  session = nextSession
}

move() {
  写 preview / hidden / patch
}

up() {
  commit
}

cleanup() {
  clear projection
}
```

这说明系统里真正应该成为基础模型的东西，还没有被抽象到统一层。

## 3.4 `editor.session` 实际是 projection，不是 session

React 当前消费的是：

- `editor.session.drawPreview`
- `editor.session.edgePreview`
- `editor.session.marquee`
- `editor.session.mindmapDrag`
- `editor.session.snapGuides`

这些都不是 active interaction session。

它们都是：

- 临时预览
- 临时框选矩形
- 拖拽投影
- 吸附参考线

也就是说：

**`editor.session` 这个名字从语义上就是错位的。**

它应该叫：

- `editor.projection`
- 或 `editor.overlay`

我更建议叫 `projection`，因为它既包含 overlay，也包含临时几何投影。

## 3.5 raw DOM event 仍然大量泄漏到 feature 内部

当前 feature 内部大量直接吃：

- `PointerEvent`
- `preventDefault`
- `stopPropagation`
- `clientX/clientY`
- `target/currentTarget`

这不是说 DOM event 完全不能出现，而是说明当前 active interaction session 还没有完全建立稳定的标准化输入模型。

长期最优结构里应该是：

1. `pointer down` 用富语义 `ResolvedPointerDown`
2. `move/up/cancel` 用统一的 `ResolvedPointerFrameInput`
3. feature 只在极少数 host 特殊场景下读 `rawEvent`

---

## 4. 目标底层模型

我建议把 editor 的交互系统统一成下面六层。

## 4.1 第 1 层：Resolved Input

输入层只负责把宿主输入转成标准化事实。

### A. 启动输入

用于决定谁启动：

```ts
type ResolvedPointerDown = {
  phase: 'pointer/down'
  pointerId: number
  button: number
  buttons: number
  modifiers: InputModifiers
  point: ResolvedPoint
  pick: Pick
  tool: Tool
  frame: FrameScope
  frameExit: boolean
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
  capture: Element | null
  container: HTMLDivElement
  rawEvent: PointerEvent
}
```

### B. 活跃交互输入

用于 active session 的 move / up / cancel：

```ts
type ResolvedPointerFrameInput = {
  phase: 'pointer/move' | 'pointer/up' | 'pointer/cancel'
  pointerId: number
  buttons: number
  modifiers: InputModifiers
  point: ResolvedPoint
  target: Element | null
  rawEvent: PointerEvent
}
```

这里不必强行带完整 `pick`，因为多数 active session 根本不需要每一帧都重做 pick。

### C. Wheel / Keyboard / Blur

同理统一成标准化结构，而不是在 feature 中直接吃原始事件。

## 4.2 第 2 层：Passive Input Processor

这一层只处理 idle 状态的输入投影：

- hover
- hint
- cursor
- idle wheel special cases

它不参与 active interaction session。

例如：

- edge hover

应该永远停留在这一层。

## 4.3 第 3 层：Interaction Driver

这一层只负责：

1. 判断某个 feature 是否应该启动
2. 产出启动 payload
3. 基于 payload 创建 active interaction session

推荐接口：

```ts
type InteractionDriver<Start = unknown> = {
  kind: string
  priority?: number
  resolve: (
    input: ResolvedPointerDown,
    runtime: DriverRuntime
  ) => Start | null
  createSession: (
    start: Start,
    runtime: DriverRuntime
  ) => ActiveInteractionSession | null
}
```

关键点：

1. driver 是无状态的
2. driver 不持有模块级 `active/session`
3. 每次交互都创建一份新的 active session

## 4.4 第 4 层：Active Interaction Session

这一层表示真正的一次活跃交互。

推荐接口：

```ts
type InteractionCancelReason =
  | 'cancel'
  | 'escape'
  | 'blur'
  | 'pointer-cancel'
  | 'superseded'

type ActiveInteractionContext = {
  finish: () => void
  cancel: () => void
  replace: (next: ActiveInteractionSession) => boolean
  pan: (pointer: AutoPanPointer) => void
}

type ActiveInteractionSession = {
  mode: ActiveInteractionMode
  pointerId?: number
  capture?: Element | null
  chrome?: boolean
  pan?: AutoPanOptions | false
  enter?: (context: ActiveInteractionContext) => void
  move?: (input: ResolvedPointerFrameInput, context: ActiveInteractionContext) => void
  up?: (input: ResolvedPointerFrameInput, context: ActiveInteractionContext) => void
  keydown?: (input: ResolvedKeyboardInput, context: ActiveInteractionContext) => void
  keyup?: (input: ResolvedKeyboardInput, context: ActiveInteractionContext) => void
  blur?: (context: ActiveInteractionContext) => void
  cancel?: (reason: InteractionCancelReason, context: ActiveInteractionContext) => void
  cleanup?: () => void
}
```

这里最重要的不是 `move/up`，而是 `replace(next)`。

因为 selection press 这种两段式交互，本质上不是“一个 driver 启动另一个 driver”，而是：

**同一个 feature 内部先进入 press session，再在 drag threshold 后切换成 move/marquee session。**

如果没有 `replace`，feature 会继续自己套 coordinator，模型就还是散的。

## 4.5 第 5 层：Projection Store

这一层专门存放临时视觉/几何投影状态。

它和 interaction session 必须彻底分开。

推荐统一命名为 `projection`，不要再叫 `session`。

例如：

```ts
type EditorProjection = {
  draw: ReadStore<DrawProjection | null>
  edge: {
    patch: ReadStore<EdgePatchMap>
    hint: ReadStore<EdgeHint | undefined>
    emptyPatch: EdgePatch
  }
  marquee: {
    rect: ReadStore<Rect | undefined>
    match: ReadStore<MarqueeMatch | undefined>
  }
  mindmapDrag: ReadStore<MindmapDragProjection | undefined>
  snapGuides: ReadStore<SnapGuides>
}
```

内部还可以有不直接暴露给 React 的 projection：

- node projection store

它主要作用于 `read` 层投影，而不是直接作为 overlay。

## 4.6 第 6 层：Commands / Commit

所有最终写入都通过 commands 落地。

active session 只负责：

1. 更新 projection
2. 在合适时机调用 commit

不要让 projection store 自己负责 commit，也不要让 driver 自己长期持有 document state。

---

## 5. 统一术语与命名规则

## 5.1 术语强制定义

### `driver`

只表示交互启动器。

它的职责只有：

1. `resolve`
2. `createSession`

### `session`

只表示一次 active interaction。

只有 coordinator 正在托管的那份东西，才允许叫 session。

### `projection`

只表示临时视觉/几何投影状态。

例如：

- draw preview
- edge patch/hint
- node patch/hidden/hovered
- marquee rect
- mindmap drag preview
- snap guides

### `plan`

只表示纯规划逻辑，不写状态。

### `primitive`

只表示基础交互时序工具。

例如：

- press primitive

不要再用泛称 `gesture.ts`。

## 5.2 命名对齐规则

### 当前名字要改的核心对象

- `NodeSession` -> `NodeProjectionEntry`
- `NodeSessionStore` -> `NodeProjectionStore`
- `NodeFeatureRuntime` -> `NodeProjectionRuntime`
- `NodeTransformSession` -> `NodeTransformDriver`
- `NodeDragSession` -> `NodeDragDriver`
- `SelectionPressRuntime` -> `SelectionPressDriver`
- `DrawInputRuntime` -> `DrawDriver`
- `EdgeInputRuntime` -> `EdgeEditDriver`
- `EdgeConnectSession` -> `EdgeConnectDriver`
- `EditorSession` -> `EditorProjection`
- `editor.session` -> `editor.projection`

### 目录层规则

- `runtime/`
  只放 kernel、resolver、registry、coordinator、editor composition
- `features/`
  只放业务 driver、session factory、projection、planner

---

## 6. 当前模块到目标模块的映射

下面是最关键的一批映射。

## 6.1 Node

### 当前

- `features/node/session/node.ts`
- `features/node/session/transform.ts`
- `features/node/drag/session.ts`

### 目标

```ts
features/node/
  projection/
    store.ts
    project.ts
  drag/
    driver.ts
    session.ts
    commit.ts
    projection.ts
  transform/
    driver.ts
    session.ts
    commit.ts
    projection.ts
    resolve.ts
```

### 语义变化

- `projection/store.ts`
  负责 node patch / hovered / hidden
- `drag/driver.ts`
  只负责 resolve + createSession
- `drag/session.ts`
  只负责本次拖拽的 active state
- `transform/driver.ts`
  同理

## 6.2 Selection

### 当前

- `runtime/selection/press.ts`
- `features/selection/gesture.ts`
- `features/selection/marquee.ts`

### 目标

```ts
features/selection/
  press/
    plan.ts
    driver.ts
    session.ts
  marquee/
    projection.ts
    session.ts
  contextMenu/
    schema.ts
    operations.ts
    read.ts
```

### 语义变化

- `plan.ts`
  保留纯 selection press 规划
- `driver.ts`
  只负责 pointer down 命中 selection 时创建 press session
- `session.ts`
  通过 `replace(next)` 在 press -> move / marquee 间切换
- `marquee/projection.ts`
  专门维护框选矩形与匹配模式

## 6.3 Edge

### 当前

- `features/edge/connectSession.ts`
- `features/edge/input.ts`
- `features/edge/preview.ts`
- `features/edge/hoverProcessor.ts`

### 目标

```ts
features/edge/
  projection/
    store.ts
  connect/
    driver.ts
    session.ts
    commit.ts
  edit/
    driver.ts
    bodySession.ts
    routeSession.ts
    commit.ts
  hover/
    processor.ts
```

### 语义变化

- `edge projection`
  统一 patch/hint
- `connect driver`
  无状态
- `edit driver`
  只创建 body / route active session

## 6.4 Draw

### 当前

- `features/draw/input.ts`
- `features/draw/state.ts`

### 目标

```ts
features/draw/
  projection/
    store.ts
  stroke/
    session.ts
    commit.ts
  erase/
    session.ts
    commit.ts
  driver.ts
  state.ts
```

### 语义变化

- `driver.ts`
  resolve draw.stroke / draw.erase
- `stroke/erase session`
  各自返回 active interaction session
- `projection/store.ts`
  单独维护 draw preview

## 6.5 Mindmap

### 当前

- `features/mindmap/dragSession.ts`
- `features/mindmap/session/drag.ts`

### 目标

```ts
features/mindmap/
  drag/
    driver.ts
    session.ts
    projection.ts
  commands.ts
```

### 语义变化

- `drag/session.ts`
  是 active interaction session
- `drag/projection.ts`
  是拖拽投影 store

---

## 7. Interaction Coordinator 的目标形态

当前 coordinator 已经是正确方向，但还缺一个能力：

**session transition**

也就是：

```ts
press session -> node drag session
press session -> marquee session
```

如果没有这个能力，feature 内部就会继续：

1. 自己 start 一个 session
2. 再在回调里手动 start 下一个 session

这会导致 feature 和 coordinator 的边界继续不清。

所以 coordinator 应该升级成：

```ts
type InteractionHandle = {
  finish(): void
  cancel(): void
  pan(pointer): void
  replace(next: ActiveInteractionSession): boolean
}
```

其中 `replace(next)` 的语义是：

1. 结束当前 session
2. 不丢失当前 pointer capture / host continuation 上下文
3. 无缝切到下一段交互

这对 selection press 非常关键。

---

## 8. Gesture Primitive 的位置

`press` 这个概念应该继续保留，但定位必须更明确：

- 它不是 feature driver
- 它不是 feature runtime
- 它是 interaction primitive

推荐把当前 `createPressRuntime` 改成：

```ts
createPressSession(...)
```

或：

```ts
createPressPrimitive(...)
```

它的产物应该是：

- 一个 active interaction session
- 或一个 session factory

而不是长期持有自己的 coordinator 状态。

换句话说：

**gesture primitive 只负责时序解释，不负责 feature 生命周期总控。**

---

## 9. Projection 模型的统一方式

当前 projection 至少分成两类：

## 9.1 直接给 React 读的 projection

例如：

- draw preview
- edge hint
- edge patch
- marquee rect
- mindmap drag
- snap guides

这类应该统一收敛成：

```ts
editor.projection
```

供 React 直接消费。

## 9.2 进入 read 层投影的 projection

例如：

- node patch / hidden / hovered

这类不一定直接对外暴露，而是通过 `read.node`、`read.index.node` 的 projection 进入 scene layer。

所以更清晰的设计是：

```ts
internals.projections = {
  model: {
    node: NodeProjectionStore
  },
  overlay: {
    draw: ...
    edge: ...
    marquee: ...
    mindmapDrag: ...
    snap: ...
  }
}
```

然后：

- `editor.projection`
  只暴露 React 真正需要读的 overlay projection
- `internals.projections.model.node`
  作为 read 层内部投影源

---

## 10. `createEditor.ts` 的最终职责

在底层模型对齐后，`createEditor.ts` 应该只做五件事：

1. 创建 kernel services
2. 创建 projections
3. 创建 feature drivers / passive processors
4. 创建 runtime read / commands
5. 总装 editor 实例

推荐拆成以下 helper：

```ts
createEditorKernelServices()
createEditorProjectionStores()
createEditorDrivers()
createEditorPassiveProcessors()
createEditorProjectionView()
```

这样 `createEditor.ts` 自己只保留 wiring，不再承载 feature 级概念细节。

---

## 11. 推荐的最终 editor 结构

## 11.1 Public Editor

```ts
type Editor = {
  read: EditorRead
  state: EditorState
  commands: EditorCommands
  input: EditorInput
  viewport: EditorViewport
  configure(config: EditorConfig): void
  dispose(): void
}
```

## 11.2 Runtime Editor

```ts
type EditorRuntime = Editor & {
  engine: EngineInstance
  interaction: InteractionCoordinator
  pick: PickRuntime
  projection: EditorProjection
  internals: {
    platform: EditorPlatform
    viewport: ViewportRuntime
    snap: SnapRuntime
    input: EditorInputInternals
    projections: EditorProjectionInternals
  }
}
```

注意：

1. `session` 全部改成 `projection`
2. `node` 不再以 `NodeFeatureRuntime` 的形式挂在 internals 上
3. `edge.preview` 也归位到 `projections`

---

## 12. 这次重构的关键收益

如果这套底层模型对齐完成，收益会非常直接。

## 12.1 `session` 概念只剩一种含义

以后只要看到 `session`，就知道是：

**当前活跃交互。**

这会让整个代码库的理解成本立刻下降。

## 12.2 driver 真正无状态

driver 不再持有：

- module-level `active`
- module-level `session`
- 自己的 cancel routing

每次交互都是新建 session，对象边界更清楚。

## 12.3 projection 从交互中剥离

这会让你能清楚回答：

- 哪些是暂时写给 UI 的
- 哪些是最终 commit 到 document 的

而不是像现在这样，在一个文件里来回切换 preview / active / commit 语义。

## 12.4 feature 内部模式会统一

以后 draw / edge / node / selection / mindmap 都是：

```ts
resolve -> createSession -> write projection -> commit -> cleanup
```

不再是每个 feature 一套自己的对象模型。

## 12.5 React 消费面更清晰

React 看到的是：

```ts
editor.projection
```

而不是误导性的：

```ts
editor.session
```

---

## 13. 一步到位的实施顺序

如果明确不做兼容层，我建议按下面顺序一次完成。

## 第 1 步：先改类型与名词系统

先落下面几个强约束：

1. 引入 `ActiveInteractionSession`
2. 引入 `InteractionHandle.replace`
3. 引入 `EditorProjection`
4. 引入 `NodeProjectionStore`
5. 停止在类型层使用含糊的 `FeatureRuntime/Session` 命名

这是后续所有代码调整的地基。

## 第 2 步：把 projection 从 feature session 里拆出来

优先拆：

1. node projection
2. draw projection
3. edge projection
4. marquee projection
5. mindmap drag projection

拆完之后：

1. projection store 是长生命周期对象
2. active interaction session 是一次性交互对象

## 第 3 步：把 feature 启动器改成 stateless driver

优先改：

1. node transform
2. node drag
3. draw
4. edge connect
5. edge edit
6. selection press
7. mindmap drag

每个 driver 只保留：

1. `resolve`
2. `createSession`

## 第 4 步：升级 coordinator 支持 `replace(next)`

这一步是把 selection press 等两段式交互彻底收干净的关键。

没有它，selection 还会继续自己嵌套调度下一个 session。

## 第 5 步：重写 `runtime/input/interactionStart.ts`

最终它不该再叫 `interactionStart`，而应该变成：

- `createEditorDrivers.ts`
- 或 `drivers.ts`

它只负责：

1. 汇总 driver 列表
2. 设置 priority

## 第 6 步：重命名 `editor.session` -> `editor.projection`

这一步必须做，因为这是整个模型对齐的最终落点之一。

React 改动会比较机械，但语义收益非常大。

## 第 7 步：压薄 `createEditor.ts`

当前面都对齐后，再把装配拆成 helper。

这样 `createEditor.ts` 的变薄就不只是“文件拆小了”，而是真正反映新的模型。

---

## 14. Node 这一组为什么是最值得先改的样板

你提的 node 是非常好的切口，因为它恰好把所有问题都暴露出来了：

1. `node/session/node.ts`
   名字是 session，实际是 projection store
2. `node/session/transform.ts`
   名字是 session，实际是 driver + active session builder + projection writer + commit
3. `node/drag/session.ts`
   名字也是 session，实际同样是 driver + active session builder + projection writer + commit

如果把 node 这一组先对齐：

- 词汇就会立刻统一
- 模式就会被证明可行
- 后面 draw / edge / mindmap 都能照着落

所以从工程策略上说：

**node 不是局部问题，而是最好的底层模型样板。**

---

## 15. 最终建议

如果只给一个判断，那就是：

**这次 editor 的下一轮完整重构，不应该再从“整理文件”开始，而应该从“统一底层对象模型”开始。**

真正要先钉死的是下面这四件事：

1. driver 是无状态启动器
2. active interaction session 是一次一份的交互对象
3. projection store 是独立的临时状态层
4. planner / primitive 只做基础设施，不再混入 feature runtime

只要这四件事钉住了：

1. 命名会自然统一
2. 文件会自然变薄
3. `createEditor.ts` 会自然收口
4. React 消费面也会自然更清楚

这才是 `whiteboard-editor` 真正的一次底层模型对齐。
