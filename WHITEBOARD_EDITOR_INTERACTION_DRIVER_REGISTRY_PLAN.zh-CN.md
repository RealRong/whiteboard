# Whiteboard Editor Interaction Driver Registry 实施方案

## 1. 文档目标

这份文档只回答一个问题：

**如果 `whiteboard-editor` 采用 `interaction.register(...)` 这种思路，把输入层收成“只负责决定启动哪个交互”，那么长期最优的接口、运行时边界和实施顺序应该是什么。**

这份文档不是重复上一份输入解耦总方案，而是把一个更具体的问题写实：

1. `interaction.register('draw.stroke', { can, move, up, cancel })` 这个方向是否成立。
2. 如果成立，接口应该长什么样才稳。
3. 现有代码如何分阶段迁移到这套模型。

默认当前方向不变：

1. `whiteboard-react` 继续做 DOM 绑定与视图组合。
2. `whiteboard-editor` 继续做输入决策、交互 session、业务行为与 preview。
3. `InteractionCoordinator` 继续保留，作为 active interaction 的单一 owner。

---

## 2. 核心结论

## 2.1 `interaction.register(...)` 方向是对的

这个方向我认为是对的，而且比当前 `editor.internals.input.*` 的直接路径调用更接近长期最优。

它能解决的核心问题是：

1. 顶层输入层不再直接认识各个 feature 的具体实现路径。
2. feature 交互的后续 `move / up / cancel` 生命周期真正回到 feature 自己。
3. editor 可以形成“输入决策 -> 启动交互 -> coordinator 托管后续事件”的单一流水线。

换句话说，`interaction.register(...)` 是一个正确的收口方向。

## 2.2 但不建议停在 `can + move + up + cancel` 这个形状

如果直接设计成：

```ts
interaction.register('draw.stroke', {
  can(ctx) {},
  move(input) {},
  up(input) {},
  cancel() {}
})
```

我认为还不够好。

更推荐的形状是：

```ts
interaction.register('draw.stroke', {
  priority: 100,
  resolve(ctx) {
    return startPayloadOrNull
  },
  start(start, runtime) {
    return {
      mode: 'draw',
      capture: start.capture,
      move(input) {},
      up(input) {},
      cancel(reason) {},
      keydown?(input) {},
      keyup?(input) {},
      blur?() {},
      cleanup?() {}
    }
  }
})
```

也就是：

1. `resolve` 替代 `can`
2. `start` 返回当前这次交互专属的 `session`
3. `move / up / cancel` 属于 session，而不是全局注册对象

## 2.3 passive hover 不应该进这套 active interaction registry

像 edge tool 的 hover hint，不应该注册成 active interaction。

它不是：

- pointer down 后进入一个 session

而是：

- idle 状态下被动消费 `pointermove / pointerleave`

所以长期应该拆成两套注册：

1. `interaction registry`
   - 处理 active interaction
2. `passive input processor registry`
   - 处理 hover / cursor / hint / idle move 这类被动输入响应

## 2.4 最优边界不是“feature 自己绑 DOM 监听”

这里必须明确。

这份文档支持的是：

- feature 自己拥有交互语义和后续 `move/up/cancel`
- coordinator 统一托管 pointer capture、window continuation、blur、Escape、selection lock

这份文档不支持的是：

- 每个 feature 自己去 `addEventListener('pointermove')`
- 每个 feature 自己处理 window 级 `pointerup/pointercancel`

也就是说：

**feature 自己拥有 session，不等于 feature 自己直接监听浏览器事件。**

---

## 3. 为什么不是裸 `can + move + up + cancel`

## 3.1 `can` 返回布尔值太弱

当前很多 feature 在“是否可以启动”的判断过程中，已经顺手算出了大量启动时需要的数据。

例如：

1. `selection.press`
   - 会算出整套 `SelectionPressPlan`
2. `edge.route`
   - 会算出 route point、index、origin
3. `draw.stroke`
   - 会算出 draw style、owner、起始点
4. `node.transform`
   - 会算出 transform target 与 drag 初始状态

如果 `can` 只返回布尔值，那么接下来的 `start` 或 `move` 又必须把这些数据重新算一遍。

这会带来：

1. 重复读取 runtime
2. 重复计算
3. 逻辑漂移风险

所以推荐：

```ts
resolve(ctx): StartPayload | null
```

而不是：

```ts
can(ctx): boolean
```

## 3.2 缺少 `start`，session 边界不清晰

`move / up / cancel` 天然属于一次具体的交互 session，而不是“feature 的全局静态行为”。

如果没有 `start()`，常见结果会是：

1. 把 active state 藏在注册对象闭包里
2. 把 active state 放在外部 module 变量里
3. 多 editor 实例之间更容易串状态

更稳的模型是：

1. `resolve` 负责判断并产出 start payload
2. `start` 负责把 payload 转成 session
3. session 拥有自己的 `move/up/cancel`

## 3.3 `move / up / cancel` 应该是“当前 active interaction 的能力”

顶层应该只知道：

1. 当前有没有 active session
2. active session 是谁
3. 把后续事件转给它

顶层不应该继续知道：

1. draw 的 move 长什么样
2. edge route 的 up 长什么样
3. selection press 的 cancel 怎么做

否则 registry 只是换了个名字，耦合并没有真正降低。

## 3.4 冲突优先级需要一等公民

多个交互经常会竞争同一个 pointer down。

例如：

1. `node.transform`
2. `edge.route`
3. `edge.body-drag`
4. `selection.press`
5. `viewport.pan`

如果只是每个 feature 提供一个 `can()`，还必须额外定义：

1. 谁先试
2. 谁优先
3. 谁短路后续

所以 registry 里要么有：

- 显式注册顺序

要么有：

- `priority`

我更建议两个都保留，但以 `priority` 为主。

## 3.5 passive hover 与 active session 不是同一类东西

像：

- edge hover hint
- cursor 变体
- idle snap preview

这些都不是 active interaction。

它们不需要：

1. pointer capture
2. active mode
3. cancel reason
4. up 生命周期

所以不要把它们塞进 `interaction.register(...)`。

---

## 4. 推荐模型

## 4.1 总体结构

推荐的长期结构如下：

```ts
Raw Host Input
  -> Input Resolver
  -> Passive Input Processors
  -> Interaction Registry
  -> Interaction Coordinator
  -> Active Session
  -> Commands / Preview / Host Effects
```

其中：

1. 输入层只产出标准化输入事实
2. passive processors 处理 idle move / leave
3. interaction registry 只决定 pointer down 启动谁
4. coordinator 统一托管 active session 后续事件
5. feature driver 只负责业务交互逻辑

## 4.2 关键概念

### A. Resolved Input

标准化后的输入上下文。

### B. Interaction Driver

负责：

1. 解释某类交互的启动条件
2. 创建该交互的 active session

### C. Active Interaction Session

负责：

1. 接收 `move/up/cancel`
2. 持有本次交互状态
3. 在完成时提交 commands / preview

### D. Passive Input Processor

负责：

1. idle `pointermove`
2. `pointerleave`
3. hover / hint / cursor 这类被动输入投影

### E. Interaction Coordinator

负责：

1. active interaction 唯一 owner
2. pointer capture
3. window continuation
4. blur / Escape / keydown / keyup 转发
5. selection lock
6. auto pan

---

## 5. 推荐类型设计

下面的类型不是要求一次性精确照搬，而是推荐的目标形状。

## 5.1 输入上下文类型

```ts
type InputModifiers = {
  shift: boolean
  alt: boolean
  ctrl: boolean
  meta: boolean
}

type ResolvedPoint = {
  client: Point
  screen: Point
  world: Point
}

type ResolvedPointerDown = {
  phase: 'pointer/down'
  pointerId: number
  button: number
  buttons: number
  detail: number
  modifiers: InputModifiers
  point: ResolvedPoint
  pick: Pick
  tool: Tool
  frame: FrameScope
  field?: EditField
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
  capture: Element | null
  host: {
    container: HTMLDivElement
  }
  rawEvent: PointerEvent
}

type ResolvedPointerMove = {
  phase: 'pointer/move'
  pointerId: number
  buttons: number
  modifiers: InputModifiers
  point: ResolvedPoint
  pick: Pick
  tool: Tool
  frame: FrameScope
  rawEvent: PointerEvent
}

type ResolvedPointerUp = {
  phase: 'pointer/up'
  pointerId: number
  button: number
  buttons: number
  modifiers: InputModifiers
  point: ResolvedPoint
  pick: Pick
  tool: Tool
  frame: FrameScope
  rawEvent: PointerEvent
}

type ResolvedPointerLeave = {
  phase: 'pointer/leave'
}

type ResolvedWheel = {
  phase: 'wheel'
  deltaX: number
  deltaY: number
  ctrl: boolean
  meta: boolean
  point: {
    client: Point
    screen: Point
    world: Point
  }
  rawEvent: WheelEvent
}
```

注意点：

1. 当前阶段保留 `rawEvent`
   - 方便渐进迁移
2. 但业务逻辑应逐步只依赖标准化字段
3. 最终可以让大多数 driver 不再直接依赖 `rawEvent`

## 5.2 Interaction Driver

```ts
type InteractionKind =
  | 'draw.stroke'
  | 'draw.erase'
  | 'insert.preset'
  | 'selection.press'
  | 'node.transform'
  | 'edge.connect'
  | 'edge.reconnect'
  | 'edge.route'
  | 'edge.body-drag'
  | 'mindmap.drag'
  | 'viewport.pan'

type InteractionResolveContext = {
  input: ResolvedPointerDown
  interactionMode: InteractionMode
}

type InteractionDriverRuntime = {
  commands: Editor['commands']
  read: Editor['read']
  state: Editor['state']
  viewport: Editor['viewport']
  config: EditorRuntime['config']
  internals: Pick<EditorRuntime['internals'], 'edge' | 'node' | 'snap' | 'mindmapDrag'>
}

type InteractionDriver<
  Kind extends InteractionKind = InteractionKind,
  Start = unknown
> = {
  kind: Kind
  priority?: number
  resolve: (ctx: InteractionResolveContext) => Start | null
  start: (
    start: Start,
    runtime: InteractionDriverRuntime
  ) => ActiveInteractionSession | null
}
```

## 5.3 Active Interaction Session

```ts
type InteractionCancelReason =
  | 'cancel'
  | 'escape'
  | 'blur'
  | 'pointer-cancel'
  | 'superseded'

type ActiveInteractionSession = {
  mode: ActiveInteractionMode
  pointerId?: number
  capture?: Element | null
  chrome?: boolean
  pan?: AutoPanOptions | false
  onStart?: () => void
  move?: (input: ResolvedPointerMove) => void
  up?: (input: ResolvedPointerUp) => void
  cancel?: (reason: InteractionCancelReason) => void
  keydown?: (input: KeyboardEvent) => void
  keyup?: (input: KeyboardEvent) => void
  blur?: () => void
  cleanup?: () => void
}
```

这里最关键的一点是：

`move/up/cancel` 挂在当前 session 上，而不是挂在 driver 的全局对象上。

## 5.4 Passive Input Processor

```ts
type PassiveInputProcessor = {
  kind: string
  priority?: number
  when?: (ctx: {
    mode: InteractionMode
    tool: Tool
  }) => boolean
  move?: (input: ResolvedPointerMove) => void
  leave?: () => void
  blur?: () => void
  cancel?: () => void
}
```

用于：

1. idle hover
2. hint
3. cursor
4. 非 active session 的被动输入响应

---

## 6. 推荐运行流程

## 6.1 pointer down

```ts
pointerdown
  -> resolvePointerDown()
  -> passive processors 不处理
  -> registry.resolveAll(ctx)
  -> 按 priority 取第一个命中的 driver
  -> driver.start(...)
  -> coordinator.start(session)
  -> session.onStart?()
```

这里：

1. registry 只处理启动
2. coordinator 只处理 session 托管
3. feature driver 只处理业务逻辑

## 6.2 pointer move

分两种：

### A. 当前存在 active session

```ts
pointermove
  -> resolvePointerMove()
  -> coordinator.activeSession.move(input)
```

### B. 当前没有 active session

```ts
pointermove
  -> resolvePointerMove()
  -> passiveProcessors.move(input)
```

## 6.3 pointer up / cancel / blur / key

```ts
pointerup
  -> resolvePointerUp()
  -> coordinator.activeSession.up(input)

pointercancel
  -> coordinator.activeSession.cancel('pointer-cancel')

blur
  -> passiveProcessors.blur()
  -> coordinator.activeSession.blur?() 或 cancel('blur')

keydown/keyup
  -> coordinator.activeSession.keydown/keyup
```

---

## 7. 推荐装配方式

## 7.1 registry 由 editor 装配层统一创建

虽然 driver 由各 feature 提供，但 registry 的装配顺序与优先级应由 editor 总装层控制。

原因：

1. 全局交互优先级是 editor 的单一知识点
2. 避免 feature 自己彼此竞争优先级
3. editor 更适合维护最终交互表

建议形态：

```ts
const interactionRegistry = createInteractionRegistry([
  createNodeTransformDriver(...),
  createEdgeReconnectDriver(...),
  createEdgeRouteDriver(...),
  createEdgeBodyDragDriver(...),
  createDrawStrokeDriver(...),
  createDrawEraseDriver(...),
  createMindmapDragDriver(...),
  createSelectionPressDriver(...),
  createViewportPanDriver(...)
])
```

## 7.2 passive processors 也由 editor 装配层统一创建

例如：

```ts
const passiveProcessors = createPassiveInputRegistry([
  createEdgeHoverProcessor(...),
  createViewportWheelProcessor(...)
])
```

注意：

1. `viewport.wheel` 可以理解为 passive processor
2. `viewport.pan` 是 active interaction

---

## 8. 与当前代码的映射关系

这里把当前已有模块映射到未来模型。

## 8.1 继续保留或强化的模块

### A. `InteractionCoordinator`

继续保留，职责基本不变。

它已经是合理的内核层：

1. active mode owner
2. pointer continuation
3. selection lock
4. auto pan
5. key / blur 转发

要改的不是它是否存在，而是它的输入来源要从“feature 自己调 `interaction.start`”逐步变成“registry 启动 driver session 后由 coordinator 接管”。

### B. `resolveInteractionStart`

这个思路也继续保留，但形态要升级。

当前更像：

1. 用 if/switch 决定 kind
2. 再手工分发到 `internals.input.*`

未来应该演进为：

1. registry 迭代所有 driver
2. 每个 driver `resolve(ctx)`
3. 取最优命中结果

### C. `SelectionPressPlan`

selection 当前已经比较接近目标形态：

1. 先 plan
2. 再用 press primitive 识别 tap/hold/drag start
3. 再执行业务 action

这部分应保留，甚至可作为其他 driver 的模式参考。

## 8.2 要拆开的模块

### A. `features/edge/input.ts`

应拆成：

1. edge hover processor
2. edge body drag driver
3. edge route driver

因为当前把：

1. active edit session
2. idle hover hint

混在了一个文件里。

### B. `runtime/input/runtime.ts`

应瘦身为：

1. 输入 dispatcher
2. pointer snapshot 更新
3. 调用 resolver
4. 调用 passive processors
5. 调用 interaction registry

不再直接访问：

- `editor.internals.input.draw`
- `editor.internals.input.edge.input`
- `editor.internals.input.selection.press`

### C. `EditorInputInternals`

当前这棵树：

```ts
internals.input.draw
internals.input.selection.press
internals.input.node.transform
internals.input.edge.connect
internals.input.edge.input
internals.input.mindmap.drag
```

长期应收敛成：

```ts
internals.interactionRegistry
internals.passiveInputProcessors
internals.gesture
```

---

## 9. 详细实施方案

下面给出建议的迁移顺序。顺序设计原则是：

1. 先搭桥，不先改行为
2. 先收口启动路由，再收口 move/up 生命周期
3. 先拆 passive hover，再做更纯的 payload
4. 最后再收缩 public API

## 9.1 阶段 0：文档与命名确认

目标：

统一这次改造的术语，避免实现过程中名称漂移。

约定：

1. `driver`
   - 指一种交互类别的启动器
2. `session`
   - 指某次具体 active interaction
3. `passive processor`
   - 指 idle 输入处理器
4. `resolver`
   - 指原始输入标准化，不做业务写入

产出：

1. 本文档
2. 与上一份输入解耦方案互相引用

## 9.2 阶段 1：引入 registry 骨架，但不改变现有 feature session

目标：

先把 pointer down 的启动分发统一到 registry 上，但底层仍然调用现有的 `start(...)` 方法，不立即改 move/up 逻辑。

### 需要新增的文件

1. `packages/whiteboard-editor/src/runtime/interaction/registry.ts`
2. `packages/whiteboard-editor/src/runtime/interaction/driver.ts`

### 需要修改的文件

1. `packages/whiteboard-editor/src/runtime/interaction/index.ts`
2. `packages/whiteboard-editor/src/runtime/interaction/types.ts`
3. `packages/whiteboard-editor/src/runtime/input/interactionStart.ts`
4. `packages/whiteboard-editor/src/runtime/input/runtime.ts`
5. `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`
6. `packages/whiteboard-editor/src/types/internal/editor.ts`

### 这一阶段的做法

1. 定义 `InteractionDriver` 类型与 registry。
2. 先写一组“适配型 driver”。

例如：

```ts
interaction.register('draw.stroke', {
  resolve(ctx) {
    return currentDrawStrokeStartOrNull
  },
  start(start, runtime) {
    return runtime.legacy.draw.startStroke(start)
      ? null
      : null
  }
})
```

这里的关键不是接口完美，而是先把：

- “谁能启动”
- “启动分发”

从 `internals.input.*` 穿透访问里抽出来。

### 这一阶段允许的过渡性妥协

1. driver.start 先内部调用旧 session runtime
2. session 仍然可能内部再去 `interaction.start(...)`
3. `PointerDown` 仍然可以直接作为 start payload

### 验收标准

1. 顶层 `pointerDown` 不再直接 `switch -> editor.internals.input.*`
2. 全部 down 启动改由 registry 负责
3. 行为无明显变化

## 9.3 阶段 2：把 edge hover 拆为 passive processor

目标：

消除当前最明显的结构异味：

- `editor.internals.input.edge.input.pointerMove(...)`
- `editor.internals.input.edge.input.pointerLeave()`

### 需要新增的文件

1. `packages/whiteboard-editor/src/runtime/input/passive.ts`
2. `packages/whiteboard-editor/src/features/edge/hoverProcessor.ts`

### 需要修改的文件

1. `packages/whiteboard-editor/src/features/edge/input.ts`
2. `packages/whiteboard-editor/src/runtime/input/runtime.ts`
3. `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`
4. `packages/whiteboard-editor/src/types/internal/editor.ts`

### 这一阶段的做法

1. 从 `features/edge/input.ts` 把：
   - `pointerMove`
   - `pointerLeave`
   - hover hint 相关状态
   抽到 `edge/hoverProcessor.ts`

2. `edge/input.ts` 只保留：
   - `startBody`
   - `startRoute`
   - `cancel`

3. `runtime/input/runtime.ts` 的 `pointerMove/Leave` 改成：
   - 更新 pointer snapshot
   - 当没有 active session 时调用 passive processors

### 验收标准

1. `edge.input` 不再暴露 `pointerMove/pointerLeave`
2. passive hover 通过独立 registry 生效
3. 顶层输入层不再直接知道 edge edit session 的 hover 细节

## 9.4 阶段 3：把各 feature session 改成 driver + session 返回模型

目标：

真正进入你提的核心模型：

- driver 负责启动
- session 负责后续 `move/up/cancel`

### 推荐改造顺序

1. `selection.press`
2. `draw`
3. `mindmap.drag`
4. `node.transform`
5. `edge.connect`
6. `edge.route`
7. `edge.body-drag`

为什么这样排：

1. `selection.press` 已经有 plan + press primitive，最接近目标
2. `draw` 与 `mindmap.drag` 启动条件相对单一
3. `node.transform` 中等复杂
4. `edge` 相关最混合、最多特判，放后面

### 需要新增的文件建议

1. `packages/whiteboard-editor/src/features/selection/interactionDriver.ts`
2. `packages/whiteboard-editor/src/features/draw/interactionDriver.ts`
3. `packages/whiteboard-editor/src/features/mindmap/interactionDriver.ts`
4. `packages/whiteboard-editor/src/features/node/transformDriver.ts`
5. `packages/whiteboard-editor/src/features/edge/connectDriver.ts`
6. `packages/whiteboard-editor/src/features/edge/routeDriver.ts`
7. `packages/whiteboard-editor/src/features/edge/bodyDragDriver.ts`

### 需要修改的旧文件

1. `packages/whiteboard-editor/src/features/selection/gesture.ts`
2. `packages/whiteboard-editor/src/features/draw/input.ts`
3. `packages/whiteboard-editor/src/features/mindmap/dragSession.ts`
4. `packages/whiteboard-editor/src/features/node/session/transform.ts`
5. `packages/whiteboard-editor/src/features/edge/connectSession.ts`
6. `packages/whiteboard-editor/src/features/edge/input.ts`

### 这一阶段的拆法

每个旧 session 文件都往下拆成两层：

1. `driver.resolve`
   - 负责判断是否可以启动
   - 负责产出 start payload
2. `driver.start`
   - 负责返回 `ActiveInteractionSession`

例如 `draw.stroke`：

```ts
resolve(ctx) -> DrawStrokeStart | null
start(start) -> {
  mode: 'draw',
  move(input) {},
  up(input) {},
  cancel(reason) {}
}
```

### 实施策略

第一轮不要求把全部内部逻辑纯化。

只要求做到：

1. 不再让 feature 自己去调用 `editor.interaction.start(...)`
2. 由 driver 返回 session 描述
3. coordinator 统一启动并托管

### 验收标准

1. 大多数 feature 的 active interaction 不再自行 `interaction.start(...)`
2. coordinator 成为唯一 session 启动入口
3. `move/up/cancel` 逻辑都由当前 active session 持有

## 9.5 阶段 4：把 viewport pan / wheel 收回 editor 输入系统

目标：

让 editor 拿回完整输入所有权。

### 需要新增或修改的文件

1. `packages/whiteboard-editor/src/features/viewport/panDriver.ts`
2. `packages/whiteboard-editor/src/runtime/input/runtime.ts`
3. `packages/whiteboard-editor/src/types/public/editor.ts`
4. `packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts`
5. `packages/whiteboard-react/src/canvas/usePointer.ts`

### 这一阶段的做法

1. `viewport-pan` 变成 registry 中的一个 interaction driver。
2. `wheel` 变成 editor input 的一个正式输入分支。
3. React 不再直接：
   - `interaction.start({ mode: 'viewport-pan' })`
   - `viewport.input.wheel(...)`

而是统一调用：

```ts
editor.input.pointerDown(...)
editor.input.pointerMove(...)
editor.input.pointerLeave(...)
editor.input.wheel(...)
```

### 验收标准

1. React 侧不再直接起 `viewport-pan` interaction
2. wheel 也进入 editor 输入面
3. editor 真正拥有完整输入所有权

## 9.6 阶段 5：收缩 internal tree，移除 `internals.input.*`

目标：

把当前 feature 路径式的 `internals.input.*` 改成 registry 式内部结构。

### 需要修改的文件

1. `packages/whiteboard-editor/src/types/internal/editor.ts`
2. `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`
3. 所有依赖 `EditorInputInternals` 的地方

### 目标结构

从：

```ts
internals.input.draw
internals.input.selection.press
internals.input.node.transform
internals.input.edge.connect
internals.input.edge.input
internals.input.mindmap.drag
```

到：

```ts
internals.input: {
  interactionRegistry
  passiveProcessors
  gesture
}
```

更进一步甚至可以是：

```ts
internals.interactionRegistry
internals.passiveProcessors
internals.gesture
```

### 验收标准

1. 输入层不再通过 feature 路径访问具体实现
2. editor 总装层持有 registry，而不是 feature session tree

## 9.7 阶段 6：让 start payload 脱离 `PointerDown`

目标：

让 feature driver 真正只消费它需要的启动数据。

### 需要修改的文件

1. `packages/whiteboard-editor/src/runtime/input/pointer.ts`
2. `packages/whiteboard-editor/src/runtime/input/interactionStart.ts`
3. 各 feature driver 文件

### 这一阶段的做法

从：

```ts
start(input: PointerDown)
```

逐步变成：

```ts
start(input: DrawStrokeStart)
start(input: SelectionPressStart)
start(input: EdgeRouteStart)
```

这样可以显著减少：

1. 重复 guard
2. feature 对原始输入上下文的过度依赖
3. 与 DOM 字段的耦合

### 验收标准

1. 多数 driver 的 `start` 不再直接吃 `PointerDown`
2. `resolve` 成为真正的 payload 生产者

## 9.8 阶段 7：把 resolver 中的写操作移出

目标：

让输入解析真正纯净。

### 需要修改的文件

1. `packages/whiteboard-editor/src/runtime/input/pointer.ts`
2. `packages/whiteboard-editor/src/runtime/input/runtime.ts`
3. `packages/whiteboard-editor/src/runtime/input/interactionStart.ts`

### 当前问题

`resolvePointerDown()` 会直接触发 `commands.frame.exit()`。

长期应改成：

1. resolver 返回 frame correction 建议
2. planner / start pre-effect 决定是否应用

### 验收标准

1. resolver 不再直接写 editor state
2. 输入解析可以独立测试

---

## 10. 文件级实施清单

下面给出一版更细的文件清单。

## 10.1 新增文件建议

### runtime 层

1. `packages/whiteboard-editor/src/runtime/interaction/driver.ts`
2. `packages/whiteboard-editor/src/runtime/interaction/registry.ts`
3. `packages/whiteboard-editor/src/runtime/input/passive.ts`
4. `packages/whiteboard-editor/src/runtime/input/types.ts`

### feature 层

1. `packages/whiteboard-editor/src/features/selection/interactionDriver.ts`
2. `packages/whiteboard-editor/src/features/draw/interactionDriver.ts`
3. `packages/whiteboard-editor/src/features/mindmap/interactionDriver.ts`
4. `packages/whiteboard-editor/src/features/node/transformDriver.ts`
5. `packages/whiteboard-editor/src/features/edge/connectDriver.ts`
6. `packages/whiteboard-editor/src/features/edge/routeDriver.ts`
7. `packages/whiteboard-editor/src/features/edge/bodyDragDriver.ts`
8. `packages/whiteboard-editor/src/features/edge/hoverProcessor.ts`
9. `packages/whiteboard-editor/src/features/viewport/panDriver.ts`

## 10.2 重点修改文件

1. `packages/whiteboard-editor/src/runtime/input/runtime.ts`
2. `packages/whiteboard-editor/src/runtime/input/pointer.ts`
3. `packages/whiteboard-editor/src/runtime/interaction/coordinator.ts`
4. `packages/whiteboard-editor/src/runtime/interaction/types.ts`
5. `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`
6. `packages/whiteboard-editor/src/types/internal/editor.ts`
7. `packages/whiteboard-editor/src/types/public/editor.ts`
8. `packages/whiteboard-react/src/canvas/usePointer.ts`
9. `packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts`

## 10.3 建议保留但内部改造的文件

1. `packages/whiteboard-editor/src/features/selection/gesture.ts`
2. `packages/whiteboard-editor/src/features/draw/input.ts`
3. `packages/whiteboard-editor/src/features/mindmap/dragSession.ts`
4. `packages/whiteboard-editor/src/features/node/session/transform.ts`
5. `packages/whiteboard-editor/src/features/edge/connectSession.ts`
6. `packages/whiteboard-editor/src/features/edge/input.ts`

这些文件不一定要马上删除。

更现实的做法是：

1. 第一轮让它们作为“session implementation”
2. 外面套上 driver
3. 等 registry 稳定后再进一步内联或拆细

---

## 11. 推荐的第一轮落地范围

如果只做一个可控 PR，我建议第一轮范围定成这样：

## 11.1 只做启动收口，不动所有 move/up 细节

包含：

1. interaction registry 骨架
2. draw / selection / transform / edge / mindmap 的适配型 driver
3. `pointerDown` 改为通过 registry 启动

不包含：

1. edge hover 拆分
2. viewport pan / wheel 收回
3. session 内部纯化
4. payload 脱离 `PointerDown`

这样能先把最大收益拿到：

1. 启动路径收口
2. `internals.input.*` 访问减少
3. 为后续 driver/session 模型铺路

## 11.2 第二个 PR 再拆 passive hover

原因：

1. 结构收益很高
2. 风险可控
3. 它是当前最明显的设计异味

## 11.3 第三个 PR 才去动 viewport pan / wheel

原因：

1. 会同时动 editor 与 react 层
2. 容易引入宿主行为回归
3. 更适合在 registry 已经稳定后再做

---

## 12. 风险点与规避策略

## 12.1 风险：优先级变化导致交互回归

例如：

1. transform 与 selection press 的先后
2. edge route 与 edge body 的先后
3. hand / space pan 与其他 down 的先后

规避：

1. 第一轮保留当前 `resolveInteractionStart` 的顺序语义
2. registry 的初始 priority 按现有顺序映射
3. 先做行为对齐，再谈抽象优化

## 12.2 风险：session ownership 不清楚

如果一边保留旧 session `interaction.start(...)`，一边引入 coordinator 托管的新 session，很容易双轨混乱。

规避：

1. 阶段 1 明确只是“启动路由收口”
2. 阶段 3 才正式把 session 启动收回 coordinator
3. 迁移 feature 时一次迁移一个完整 interaction

## 12.3 风险：把 passive hover 误塞进 active interaction

规避：

1. 明确建立 `passive input processor` 注册概念
2. 文档和类型层都单独区分

## 12.4 风险：抽象过度

规避：

1. 第一轮只做 registry 骨架
2. 第二轮只拆 edge hover
3. 第三轮再做 session 返回模型
4. 保持现有 feature 内部逻辑尽量不动

---

## 13. 最终推荐接口

如果只保留一个最值得实现的目标接口，我推荐下面这套。

## 13.1 registry

```ts
interaction.register('draw.stroke', {
  priority: 100,
  resolve(ctx) {
    return drawStrokeStartOrNull
  },
  start(start, runtime) {
    return {
      mode: 'draw',
      pointerId: start.pointerId,
      capture: start.capture,
      move(input) {},
      up(input) {},
      cancel(reason) {},
      cleanup() {}
    }
  }
})
```

## 13.2 passive

```ts
input.registerPassive('edge.hover', {
  when(ctx) {
    return ctx.mode === 'idle' && ctx.tool.type === 'edge'
  },
  move(input) {},
  leave() {},
  blur() {}
})
```

## 13.3 coordinator

```ts
const session = driver.start(start, runtime)
if (session) {
  interactionCoordinator.start(session)
}
```

这个模型同时满足：

1. `input` 只负责决定启动谁
2. feature 自己拥有 `move/up/cancel`
3. coordinator 仍然掌握唯一 active interaction 与底层宿主接管

---

## 14. 一句话结论

你提的 `interaction.register(...)` 方向我赞成，但长期最优形态不应停在裸 `can + move + up + cancel`。

最稳的落点是：

**`resolve -> start -> session(move/up/cancel)` + `passive processors` + `coordinator` 统一托管宿主事件。**

具体到实施顺序，建议按下面这条线走：

1. 先引入 registry 骨架，收口 pointer down 启动路径。
2. 再拆 edge hover，建立 passive processor 概念。
3. 再把各 feature session 逐步改成 driver 返回 session。
4. 再把 viewport pan / wheel 收回 editor 输入系统。
5. 最后去掉 `internals.input.*` 路径树，收缩成 registry 驱动的内部结构。

这条线能在不推翻现有代码的前提下，把 editor 从“输入总控 + feature 路径穿透”稳步收成“registry + coordinator + driver”的长期结构。
