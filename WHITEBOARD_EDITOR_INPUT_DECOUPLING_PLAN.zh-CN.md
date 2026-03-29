# Whiteboard Editor Input 解耦重构方案

## 1. 文档目标

这份文档只回答一个问题：

**`packages/whiteboard-editor` 当前输入链、手势链、交互 session 链混在一起时，怎样重构才是更解耦、更稳定、也更适合长期演进的结构。**

这里的“解耦”不是抽象层越多越好，也不是为了做一套通用手势框架而做框架，而是明确三件事：

1. 哪些属于原始输入。
2. 哪些属于通用手势识别。
3. 哪些属于 editor 业务交互。

最终目标不是“删除 gesture 概念”，而是让 gesture 降级为基础设施层，让 feature 只消费语义化的交互事件，而不再直接面对 DOM `PointerEvent` 和零散输入分支。

---

## 2. 当前结论

先给最终判断。

### 2.1 `createInputRuntime` 该不该对外暴露

不建议把 `createInputRuntime` 当作 public API 对外暴露。

原因不是它名字不好，而是它当前并不是一个稳定、纯净、边界清晰的“输入 runtime”。

它现在同时承担了：

1. pointer snapshot 更新
2. pointer down 解析
3. interaction start 路由
4. edge hover hint 分发
5. keyboard / blur 转发

这说明它本质上是一个 **editor 内部输入门面**，不是一个可复用的输入子系统。

从包导出看，它当前也并没有被真正 public export：

- `@whiteboard/editor` 只导出了根入口与若干子入口
- 没有导出 `runtime/input/runtime`

所以长期方向应该是：

- `createInputRuntime` 继续保持 internal
- 甚至后续应该改名或拆分
- 不要把它塑造成外部依赖的稳定构造器

### 2.2 `editor.internals.input.edge.input.pointerMove(...)` 是否别扭

是，确实别扭，而且不是单纯命名问题，而是层次问题。

这条调用链的别扭点在于：

1. `pointerMove` 是原始输入流事件名。
2. `edge.input` 看起来像 edge 编辑 session。
3. 但它实际做的是 idle 状态下的 edge hover hint。

也就是说，当前 `edge.input` 里混了两类完全不同的职责：

1. `startBody` / `startRoute`
   - 这是交互启动与 session 逻辑
2. `pointerMove` / `pointerLeave`
   - 这是被动 hover 投影逻辑

把 hover 和 active edit session 放在同一个模块里，会导致顶层输入门面天然知道 feature 内部实现细节，从而把输入层和业务层缠死。

### 2.3 最优方向是什么

最优方向不是“不要手势”，而是：

**把输入、手势、交互 session、host 副作用四层切开。**

更具体地说：

```ts
Raw Host Input
  -> Normalized Input
  -> Gesture Engine
  -> Interaction Driver
  -> Commands / Preview / Host Effects
```

其中：

1. 输入层只生产事实，不做业务写入。
2. 手势层只做通用 tap / hold / drag / hover / pan 识别，不知道 edge / node / selection。
3. editor feature 只消费语义化交互，不直接消费 DOM `PointerEvent`。
4. 副作用由 driver 或 effect runner 统一落地，而不是散在 resolver 里。

---

## 3. 当前结构的问题

## 3.1 `EditorInput` 不是完整输入系统，只是半套入口

当前 public `EditorInput` 只有：

- `pointerDown`
- `pointerMove`
- `pointerLeave`
- `cancel`
- `keyDown`
- `keyUp`
- `blur`

但这并不是完整输入面。

缺失的关键输入还包括：

- `pointerUp`
- `pointerCancel`
- `wheel`
- viewport pan pointer 流

实际 active interaction 的 `move/up/cancel` 是通过 `InteractionCoordinator + PointerContinuation` 在 window 上继续监听的，而不是继续从 `editor.input` 进入。

这说明当前输入面和真实交互流是断开的。

## 3.2 `createInputRuntime` 既像 dispatcher，又像 feature router，又像 hover broker

当前 `createInputRuntime` 的问题不是代码量大，而是职责不纯。

它的 `pointerDown` 路径：

1. 更新 pointer snapshot
2. 读取 `PointerDown`
3. 决定 `InteractionStart`
4. 直接调用某个 feature runtime 的 `start`

它的 `pointerMove` / `pointerLeave` 路径：

1. 更新 pointer snapshot
2. 直接把 move / leave 喂给 edge hover 模块

这使得输入层变成了一个知道 feature 细节的总控。

## 3.3 resolver 层存在状态写入，不够纯

`resolvePointerDown()` 当前不只是解析输入，它还会在 frame 不匹配时直接：

- `editor.commands.frame.exit()`

这是不理想的。

“解析输入”这一层应该只回答：

- 当前命中了什么
- 当前在哪个 frame 上下文里
- 如果这个 frame 上下文需要被修正，修正建议是什么

它不应该在 resolver 阶段直接改 editor state。

否则你后面想做：

- 可测试的 planner
- 输入录制 / 回放
- 非 DOM host
- 更纯的 interaction pipeline

都会被 resolver 中的写操作卡住。

## 3.4 gesture 概念已经存在，但不统一

当前代码里已经有 gesture 的雏形：

1. `createPressRuntime`
   - 识别 tap / drag start / hold
2. `InteractionCoordinator`
   - 管 active session、pointer capture、window continuation、selection lock、keydown / blur
3. `MarqueeSession`
   - 管 drag + auto pan

但 viewport pan 完全在 React 层直接调用 `interaction.start({ mode: 'viewport-pan' })`，而 edge hover 又从 `editor.input.pointerMove` 侧路进入。

这说明：

1. 手势能力已经出现
2. 但没有形成“唯一输入流水线”

## 3.5 feature session 暴露了过多 DOM 形状

当前很多 feature runtime / session 接口仍然直接吃：

- `PointerEvent`
- `capture: Element`
- `preventDefault`
- `stopPropagation`

这会带来两个问题：

1. feature 很难脱离浏览器事件对象测试
2. 业务交互逻辑与 host 副作用混在一起

---

## 4. 重构目标

## 4.1 一级目标

长期最优结构应满足下面约束：

1. editor 只有一条统一输入入口。
2. 输入标准化之后，不再让 feature 直接依赖 DOM 原始事件。
3. 手势识别成为 editor 内部基础设施，而不是 feature 自己拼。
4. hover、press、drag、pan、wheel 都走统一 pipeline。
5. resolver / planner 尽量纯，不直接写 editor state。
6. feature 交互只负责业务语义，不负责 host 续传与全局事件接管。

## 4.2 二级目标

在不一次性推翻现有实现的前提下，保留这些已经合理的方向：

1. `InteractionCoordinator` 继续作为 active session owner。
2. `resolveInteractionStart()` 继续作为 down 决策 planner。
3. `SelectionPressPlan` 继续保持“先规划、后执行”的模式。
4. viewport runtime 继续保持独立。

## 4.3 非目标

这次不把目标定成：

1. 做通用跨产品手势框架。
2. 一次性把所有 feature 改成 reducer + effect system。
3. 彻底去掉所有 `PointerEvent` 使用。

更现实的目标是：

**先把边界切干净，再决定哪些模块值得继续纯化。**

---

## 5. 推荐分层

我建议把输入与交互拆成四层。

## 5.1 第 1 层：Input Adapter

职责：

1. 接收宿主输入
2. 做最薄的 host 适配
3. 把原始事件转为统一输入包

这一层关心：

- DOM 事件注册
- container rect
- focus
- pointer capture 的宿主实现
- wheel passive / non-passive
- window blur

这一层不应该关心：

- selection
- edge
- draw
- node transform
- 哪个 feature 该启动

建议概念：

```ts
type RawEditorInput =
  | { kind: 'pointer/down'; ... }
  | { kind: 'pointer/move'; ... }
  | { kind: 'pointer/leave'; ... }
  | { kind: 'pointer/up'; ... }
  | { kind: 'pointer/cancel'; ... }
  | { kind: 'wheel'; ... }
  | { kind: 'key/down'; ... }
  | { kind: 'key/up'; ... }
  | { kind: 'blur' }
```

React 层应该尽量只负责把 DOM 事件交给 editor，而不是自己直接做 viewport pan session。

## 5.2 第 2 层：Input Resolver

职责：

1. 读取 viewport / pick / tool / frame / target flags
2. 生成标准化输入上下文
3. 只产出事实，不直接做业务写入

建议核心产物：

```ts
type ResolvedPointerInput = {
  phase: 'down' | 'move' | 'up' | 'leave' | 'cancel'
  pointerId?: number
  button?: number
  buttons?: number
  modifiers: {
    shift: boolean
    alt: boolean
    ctrl: boolean
    meta: boolean
  }
  point: {
    client: Point
    screen: Point
    world: Point
  }
  pick: Pick
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
  tool: Tool
  frame: FrameScope
  capture: Element | null
}
```

如果 frame 需要退出，不在 resolver 里直接写：

```ts
type ResolveEffect =
  | { kind: 'frame/exit' }
```

或者更保守一点，先由 planner 决定是否执行。

## 5.3 第 3 层：Gesture Engine

职责：

1. 把标准化输入流识别成通用手势
2. 与 editor 业务语义解耦
3. 持有通用 session 状态

它只知道这些抽象：

- hover
- press
- tap
- hold
- drag
- pan
- wheel
- cancel

它不应该知道：

- selection marquee
- edge reconnect
- node resize
- draw stroke

换句话说，gesture engine 是“输入时序解释器”，不是 editor 业务路由器。

### 5.3.1 `createPressRuntime` 可以保留，但要降级为 engine 内部 primitive

`createPressRuntime` 当前方向是对的，但它还只是一个局部工具。

长期应该让它属于统一 gesture engine，而不是由 selection feature 直接持有。

### 5.3.2 `InteractionCoordinator` 继续做 active interaction owner

`InteractionCoordinator` 当前承担的职责是合理的：

1. active mode owner
2. pointer continuation
3. selection lock
4. blur / keydown / keyup
5. auto pan

长期应该保留，但定位要更明确：

- 它不是 feature runtime
- 它是 gesture / interaction session kernel

## 5.4 第 4 层：Interaction Drivers

职责：

1. 消费 gesture 或语义化 interaction start
2. 执行业务逻辑
3. 发出 commands / preview / context / selection 变更

这一层是 editor 业务层。

建议 driver 形态按业务分组，而不是按输入事件名分组：

- `selectionPressDriver`
- `nodeTransformDriver`
- `nodeDragDriver`
- `drawDriver`
- `edgeConnectDriver`
- `edgeRouteDriver`
- `edgeBodyDragDriver`
- `mindmapDragDriver`
- `viewportPanDriver`
- `insertPresetDriver`

driver 吃的是语义化输入，而不是原始 DOM 事件。

例如不是：

```ts
start(input: PointerDown)
```

而更像：

```ts
start(input: {
  pointerId: number
  point: ResolvedPoint
  pick: Pick
  tool: Tool
  modifiers: Modifiers
  capture: Element | null
})
```

这样 feature 就不必携带 `PointerEvent` 的浏览器方法与字段。

---

## 6. 对当前模块的重新归位建议

## 6.1 `createInputRuntime`

当前不建议继续保留“runtime”这种命名语义。

更合适的方向：

- `createEditorInput`
- `createInputDispatcher`
- `createInputRouter`

它的职责应该被收窄成：

1. 接受统一输入包
2. 调用 resolver
3. 调用 passive processors
4. 调用 gesture / interaction planner

它不应该直接知道：

- `edge.input.pointerMove`
- `selection.press.start`
- `mindmap.drag.start`

这些都是 driver registry 或 interaction start runner 的职责。

## 6.2 `runtime/input/interactionStart.ts`

这个文件当前方向是对的，应该保留，并继续强化成：

**pointer down -> 唯一交互启动计划**

但它应该只决定：

1. 进入哪一个 interaction
2. 需要什么 start payload
3. 需要哪些预处理 effect

它不应该直接依赖一个层层穿透的 `internals.input.*` 结构。

建议改成：

```ts
type InteractionStart =
  | { kind: 'draw/stroke'; input: DrawStartInput }
  | { kind: 'draw/erase'; input: DrawEraseInput }
  | { kind: 'insert/preset'; input: InsertPresetStartInput }
  | { kind: 'selection/press'; input: SelectionPressStartInput }
  | { kind: 'node/transform'; input: NodeTransformStartInput }
  | { kind: 'edge/connect'; input: EdgeConnectStartInput }
  | { kind: 'edge/reconnect'; input: EdgeReconnectStartInput }
  | { kind: 'edge/route'; input: EdgeRouteStartInput }
  | { kind: 'edge/body-drag'; input: EdgeBodyDragStartInput }
  | { kind: 'mindmap/drag'; input: MindmapDragStartInput }
  | { kind: 'viewport/pan'; input: ViewportPanStartInput }
```

然后统一交给 driver registry 执行。

## 6.3 `features/edge/input.ts`

建议拆成两个模块。

### A. `edgeHoverProjector`

职责：

1. 在 idle + edge tool 下消费 hover
2. 计算 snap hint
3. 写 edge preview hint

这个模块不属于 edge edit session。

### B. `edgeEditDriver`

职责：

1. body drag
2. route edit
3. 相关 active session

拆完之后，`pointerMove` / `pointerLeave` 就不会再以 `edge.input.pointerMove()` 的方式出现。

## 6.4 `SelectionPressRuntime`

这个模块当前设计其实已经比较接近推荐模型：

1. 先用 `resolveSelectionPressPlan()` 规划
2. 再交给 `press` runtime 做时序识别
3. 然后执行 tap / drag / hold 的业务动作

长期建议是：

1. 保留 plan 层
2. 把 `press` runtime 从 feature 依赖改成统一 gesture engine primitive
3. 让 selection driver 只关心 `tap / dragStart / hold`

## 6.5 viewport pan

当前 viewport pan 直接在 React 中：

1. 判断 `space` / `hand tool`
2. 直接 `interaction.start({ mode: 'viewport-pan' })`
3. 直接调用 `viewport.input.panScreenBy`

这条链路不应该长期留在 React。

长期建议：

1. React 只上报 raw input
2. planner 决定是否进入 `viewport/pan`
3. viewport pan 也是一个 interaction driver

否则 editor 永远拿不到完整输入所有权。

---

## 7. 最优 API 方向

## 7.1 public editor 只暴露统一输入入口

长期 public `Editor` 最好保持一个统一输入门面，但这个门面背后应当是真正完整的输入系统。

建议长期形态：

```ts
type EditorInputEvent =
  | PointerInputEvent
  | WheelInputEvent
  | KeyboardInputEvent
  | BlurInputEvent

type EditorInput = {
  dispatch: (event: EditorInputEvent) => boolean | void
  cancel: () => void
}
```

如果不想一步改动太大，也可以保留兼容 facade：

```ts
type EditorInput = {
  pointerDown: (...)
  pointerMove: (...)
  pointerLeave: (...)
  wheel: (...)
  keyDown: (...)
  keyUp: (...)
  blur: (...)
  cancel: (...)
}
```

但内部实现应统一走 `dispatch()`。

## 7.2 internal 不再暴露 `internals.input.*` feature tree

当前 internal tree：

```ts
internals.input.draw
internals.input.selection.press
internals.input.node.transform
internals.input.edge.connect
internals.input.edge.input
internals.input.mindmap.drag
```

这个结构的问题是：

1. 顶层知道过多 feature 细节
2. 输入层通过路径访问 feature 具体实现
3. feature 能力分类是“实现分类”，不是“交互分类”

更合适的是：

```ts
internals.interactionDrivers
internals.passiveInputProcessors
internals.gesture
```

例如：

```ts
type PassiveInputProcessors = {
  pointerHover: Array<PointerHoverProcessor>
  pointerLeave: Array<PointerLeaveProcessor>
}

type InteractionDrivers = {
  start: (start: InteractionStart) => boolean
  cancel: () => void
}
```

这样顶层不需要知道 edge hover 是谁实现的。

---

## 8. 能否做到“纯输入 -> 处理 -> 输出”

可以，但要区分“长期最优”和“短期最优”。

## 8.1 长期最优

长期最优当然是：

```ts
Input
  -> Pure Resolve
  -> Pure Plan
  -> Effectful Execute
```

也就是：

1. 输入层纯事实
2. planner 纯决策
3. 执行层应用 commands / preview / host effects

这是最适合测试、录制回放、多宿主的模型。

## 8.2 短期最优

短期不建议一步做成完整 effect system。

因为现在有太多行为直接依赖：

- `preventDefault`
- `stopPropagation`
- `capture`
- `window` 级 pointer continuation
- 定时器
- raf 预览刷新

如果一次性全改成声明式 effect runner，成本太高，回归风险也大。

更现实的方案是分阶段纯化：

### 阶段 A

先把 resolver 中的写操作拿掉。

### 阶段 B

让 feature start input 不再直接依赖 DOM `PointerEvent`。

### 阶段 C

把 host effect 统一收口：

- consume event
- request pointer capture
- request focus
- schedule timer / raf

### 阶段 D

再决定哪些 driver 值得继续纯 reducer 化。

换句话说：

**可以朝“纯输入 -> 处理 -> 输出”走，但不应该一开始就用大而全 effect system 把自己压死。**

---

## 9. 推荐迁移顺序

这里给一条从低风险到高收益的迁移顺序。

## 9.1 第一步：统一 editor 输入面

目标：

1. 把 viewport pan / wheel 从 React 侧特殊路径收回 editor
2. 让 editor 拿到完整输入所有权

具体做法：

1. 给 `EditorInput` 增加 `wheel`
2. 给内部输入入口补上 `pointerUp/pointerCancel`
3. React 只做 DOM 订阅与输入转发
4. React 不再直接调用 `interaction.start({ mode: 'viewport-pan' })`

收益：

1. 输入不再一半在 editor、一半在 React
2. 后续 gesture engine 才有唯一入口

## 9.2 第二步：拆出 passive hover processors

目标：

把 `edge.input.pointerMove/pointerLeave` 从 edge edit 模块中剥离。

具体做法：

1. 新建 `runtime/input/hover` 或 `features/edge/hover`
2. `pointerMove/pointerLeave` 不再进 `edge.input`
3. 输入层只调用 `passiveInputProcessors`

收益：

1. 输入层不再直接认识 edge edit session
2. hover 与 active interaction 分开

## 9.3 第三步：把 `InteractionStart` 改成 typed start payload

目标：

不再把所有 feature start 都写成 `start(input: PointerDown)`。

具体做法：

1. 保留 `resolveInteractionStart`
2. 让它输出 feature-specific start payload
3. runner 只做类型分发，不做再解析

收益：

1. feature start 输入更小、更稳定
2. 减少重复 guard

## 9.4 第四步：把 resolver 副作用移出

目标：

让 `resolvePointerDown` 真正变成纯输入解析。

具体做法：

1. 把 frame 退出改成 planner effect 或 driver pre-effect
2. resolver 只返回 next frame context 或 effect suggestion

收益：

1. 输入可测试性提高
2. planner 更容易复用

## 9.5 第五步：把 `press` 收成统一 gesture primitive

目标：

`SelectionPressRuntime` 不再直接持有自己的一套局部 press runtime 思维，而是消费统一 gesture primitive。

具体做法：

1. gesture engine 提供 `press/tap/hold/dragStart`
2. selection driver 只做业务 plan 与 action 执行

收益：

1. selection 模式可以成为其他 feature 的模板
2. 手势与业务边界真正清晰

## 9.6 第六步：抽象 interaction driver registry

目标：

顶层输入层不再依赖 `internals.input.<feature>` 树。

具体做法：

1. 新建 driver registry
2. `runInteractionStart()` 只做 registry dispatch
3. `cancel()` 统一下发给 active/passive driver

收益：

1. 顶层装配不再硬编码 feature 路径
2. 后续新增 feature 时不必继续扩张 `internals.input`

---

## 10. 推荐命名调整

下面是建议的命名收口。

## 10.1 `createInputRuntime`

建议替换为：

- `createEditorInput`
- `createInputDispatcher`

不建议继续叫：

- `createInputRuntime`

因为它更像输入入口和路由器，而不是一个独立 runtime 域。

## 10.2 `edge.input`

建议拆成：

- `edge.hover`
- `edge.edit`

或者：

- `edge.projector`
- `edge.driver`

总之不要继续保留：

- `edge.input.pointerMove`
- `edge.input.pointerLeave`

这种“输入事件名挂在 feature session 上”的形式。

## 10.3 `internals.input`

建议逐步演进为：

- `internals.inputDispatcher`
- `internals.gesture`
- `internals.interactionDrivers`
- `internals.passiveInputProcessors`

---

## 11. 最终推荐结构

长期更理想的 editor 输入结构可以收敛成这样：

```ts
Editor
  .input.dispatch(rawInput)
    -> inputAdapter.normalize(rawInput)
    -> inputResolver.resolve(...)
    -> passiveProcessors.handle(...)
    -> gestureEngine.handle(...)
    -> interactionPlanner.plan(...)
    -> interactionDrivers.start(...)
    -> commands / preview / host effects
```

更具体一点：

```ts
RawInput
  -> ResolvedInput
  -> {
       passive: hover / cursor / hint
       active: press / drag / pan / wheel / key
     }
  -> Driver
  -> Editor Commands + Preview
```

这个结构里：

1. hover 是 passive 输入处理，不再伪装成 edge session 方法。
2. pan 是 interaction driver，不再留在 React 侧直接起 session。
3. feature 只拿语义化 start/update/finish 输入。
4. `InteractionCoordinator` 是 session kernel，不直接暴露业务感知。

---

## 12. 一句话结论

这条线的长期最优解不是“把所有东西都叫 input”，也不是“完全去掉 gesture”，而是：

**让输入层只负责输入，让手势层只负责时序解释，让 driver 层只负责业务交互，让 host effect 回到统一边界。**

具体到当前代码，最该先动的不是某个名字，而是下面三件事：

1. 把 viewport pan / wheel 收回 editor，建立唯一输入入口。
2. 把 `edge.input.pointerMove/pointerLeave` 拆成独立 passive hover processor。
3. 把 `internals.input.*` 逐步收敛成 planner + driver registry，而不是 feature 路径穿透。

做到这三步之后，后面再去追求“纯输入 -> 处理 -> 输出”，才会是顺势而为，而不是强行上框架。
