# Whiteboard React Interactions 按 React 心智重构方案

## 目标

这份文档只讨论一件事：

**在不先重做整个中轴的前提下，如何把 `whiteboard-react` 里的 interactions 按 React 的心智模型重构。**

前提明确为：

- `editor` 只作为读写 runtime
- `editor` 提供 `read / state / commands`
- interactions 不再伪装成 editor runtime 的一部分
- 不做兼容
- 不考虑过渡
- 直接按长期最优实现

这里的核心判断是：

**interactions 不该继续长成一个“运行时框架”，而应该回到 React 里最自然的形态：事件绑定 + feature hooks + 本地 session refs + 少量共享 UI store。**

---

## 先说结论

如果严格按 React 心智来做，最终 interactions 应该长这样：

### 1. `editor` 的角色

`editor` 只负责：

- committed state
- runtime read
- commands
- 少量稳定 runtime state

它不负责：

- input dispatch
- active interaction
- session mode
- hover / leave / blur 的交互编排
- draw / selection / edge / transform 的 pointer 生命周期

一句话：

**editor 是 document runtime，不是 interaction runtime。**

### 2. interactions 的角色

interactions 是 React 宿主层的行为模块。

它们负责：

- 在 pointer / wheel / keyboard 事件里读取 editor
- 维护交互期的本地 session
- 把预览、hover、guide、ghost 写入 React 侧 interaction store
- 在 commit 时调用 `editor.commands`

一句话：

**interactions 是 React host 对 editor 的操作层。**

### 3. 最终形态

最终不应该是：

- `createInteractionRuntime`
- `InteractionFeature`
- `owner`
- `observe`
- `InteractionControl`
- `InteractionSessionMode`

而应该是：

- `useCanvasInteractions()`
- `useSelectionInteraction()`
- `useDrawInteraction()`
- `useEdgeInteraction()`
- `useTransformInteraction()`
- `useMindmapInteraction()`
- `useInsertInteraction()`
- `useViewportPanInteraction()`

以及一个非常薄的事件路由层：

- pointer down 时，按优先级尝试启动哪个 feature
- 有 active feature 时，后续 move/up/cancel 交给它
- 没有 active feature 时，执行 idle hover / leave / wheel

这不是“中轴框架”，只是 **surface event router**。

---

## 当前 interactions 最大的问题

## 1. 还在用 runtime 框架心智，而不是 React 心智

当前的主干是：

- `createWhiteboardRuntime`
- `createInteractionRuntime`
- `InteractionCtx`
- `InteractionFeature`
- `owner.observe`
- `InteractionSession`
- `InteractionControl`

这套模型本质上仍然是一个“小型交互运行时”。

它的问题不是不能工作，而是：

- 把 React 里本该简单的事件响应，包装成了框架协议
- feature 之间的共性被过度提炼
- 内部阶段被抬成全局概念
- session 需要 `control.update` / `control.finish` / `control.pan`

读起来不是：

- “鼠标按下了，selection 判断要不要接管”

而是：

- “interaction runtime 启动 owner，再创建 session，再通过 control 更新 mode”

这不符合 React 的自然心智。

---

## 2. feature 没有真正拥有自己的本地状态

比如现在 selection：

- `resolveSelectionPressState`
- `createPressInteraction`
- `createMoveInteraction`
- `createMarqueeInteraction`

这些函数能跑，但状态 ownership 不清楚。

因为：

- press state 不是真正挂在 React feature 自己下面
- move / marquee 是通过 session 切换表达的
- selection 的内部 phase 变成了 interaction runtime 的公共 mode

更合理的做法应该是：

- selection hook 自己维护 `pressRef`
- 自己维护 `dragRef`
- 自己决定何时从 `press` 进入 `move` 或 `marquee`
- 外部路由只知道“当前 active feature 是 selection”

也就是说：

**feature 的内部 phase 应该缩回 feature 自己，不该变成公共 interaction 协议。**

---

## 3. UI 预览状态还没有真正回到 React 侧

现在很多预览写法本质上还是：

- interaction 发生
- 写 editor overlay / transient
- scene 组件再通过 `editor.read.overlay` 去渲染

这在迁移阶段可以接受，但不是 React 最顺的形态。

对 React 来说，更自然的边界是：

- document runtime 在 editor
- interaction preview 在 React interaction store

例如这些状态：

- draw preview
- selection marquee
- move preview
- edge hover guide
- edge reconnect patch
- transform projection
- mindmap drag ghost
- busy / chrome / transforming / space

都更像 React 侧的交互态，而不是 editor runtime 的一部分。

---

## 4. `InteractionCtx` 还是一种手工依赖注入

当前 feature 大多依赖：

- `ctx.read`
- `ctx.commands`
- `ctx.overlay`
- `ctx.snap`
- `ctx.config`
- `ctx.state`

这虽然比把 editor internals 暴露出去要好，但它仍然是一种“框架式传参”。

React 里更自然的做法是：

- hook 自己拿 `editor`
- hook 自己拿 `config`
- hook 自己拿 interaction store
- 热路径直接 event-time read

也就是说：

**不要再人为维护一层 `InteractionCtx`。**

在 React 里，feature hook 直接闭包依赖就够了。

---

## React 心智下 interactions 的重新定义

## 1. interaction 不是 runtime object，而是 feature hook

最终每个 interaction feature 都应是一个 React hook。

例如：

- `useSelectionInteraction`
- `useDrawInteraction`
- `useEdgeInteraction`
- `useTransformInteraction`

这些 hook 的职责是：

- 读取 editor 当前状态
- 维护自己内部的 `useRef` session
- 暴露事件处理函数
- 写 interaction UI state
- commit 时调用 commands

而不是返回一个 runtime feature 对象给别的 runtime 去解释。

---

## 2. hot path 用 `useRef`，render state 用 React 侧 store

这是最关键的一条。

React 交互里有两类状态：

### 2.1 高频、瞬时、不需要驱动大量渲染的状态

用 `useRef`：

- 当前 pointer session
- 起始点
- press state
- drag 过程中的内部 phase
- 最新 pointer id
- auto pan 需要的最新 client point

### 2.2 需要渲染消费的状态

用 React 侧共享 store：

- marquee rect
- draw preview
- selection move preview
- transform projection
- edge guide / patch
- mindmap drag feedback
- `busy/chrome/transforming/space`

这部分不应该再塞回 editor。

一句话：

**session 在 ref，UI preview 在 React store，commit 在 editor.commands。**

这就是 React 交互最自然的三段式。

---

## 3. surface 只做事件绑定和路由，不做 feature 逻辑

最终 `Surface` 或 `SurfaceBindings` 只负责：

- DOM 监听
- 事件语义化
- 把事件发给 interactions

它不应该知道：

- draw 怎么采样
- selection 怎么 press/marquee
- edge 怎么 connect/route

这些都属于 feature hook。

它只做：

- `pointerdown` 试启动 feature
- `pointermove` 分发给 active feature 或 idle handlers
- `pointerup/cancel/leave/blur/wheel/keydown/keyup` 路由

所以它不是 interaction runtime，只是 **event router**。

---

## 最终架构

## 1. editor

保留：

- `read`
- `state`
- `commands`

不再让 React 内部依赖：

- `editor.input`
- `editor.state.interaction`

如果将来还存在这两个字段，也只是迁移遗留，不应再被 React interaction 主链依赖。

---

## 2. React interaction store

新增 React 侧 interaction state。

建议是一个聚合 store，而不是很多碎小状态。

例如：

```ts
type InteractionViewState = {
  active: {
    key?: 'selection' | 'draw' | 'edge' | 'transform' | 'mindmap' | 'viewport'
    busy: boolean
    chrome: boolean
    transforming: boolean
    space: boolean
  }
  draw: {
    preview?: DrawPreview
  }
  selection: {
    marquee?: Rect
    move?: SelectionMovePreview
    hovered?: NodeId
  }
  transform: {
    projection?: TransformProjection
  }
  edge: {
    guide?: EdgeGuide
    patches?: readonly EdgeOverlayEntry[]
  }
  mindmap: {
    drag?: MindmapDragFeedback
  }
}
```

关键点：

- interaction 预览状态留在 React
- scene/chrome 组件直接读 React interaction store
- editor 不再是 interaction preview 的承载体

如果实现时要遵循当前项目的 React 约束，这部分应使用聚合 Jotai atoms 或等价的 React 侧 external store，而不是再加 provider 链。

---

## 3. event router

最上层只保留一个很薄的事件路由 hook：

```ts
useCanvasInteractions()
```

它内部维护：

- `activeFeatureRef`
- `activeSessionRef`
- `spacePressedRef`
- `pointerCapture/session lock`

它负责：

- 组合各个 feature hook
- 按优先级试启动 feature
- 把 move/up/cancel/blur/wheel 路由给 active 或 idle handlers
- 在开始/结束时同步 `InteractionViewState.active`

它不持有任何 feature 业务逻辑。

它不是“interaction runtime”，只是一个 React hook。

---

## 4. feature hook

每个 feature hook 只负责自己的行为和预览态。

推荐统一成下面这种最小协议：

```ts
type ActiveInteractionSession = {
  pointerId: number
  chrome?: boolean
  transforming?: boolean
  move?: (input: PointerMoveInput) => void
  up?: (input: PointerUpInput) => void
  cancel?: () => void
  blur?: () => void
  cleanup?: () => void
  autoPanFrame?: (pointer: { clientX: number; clientY: number }) => void
}

type InteractionFeatureBinding = {
  key: string
  priority: number
  tryStart?: (input: PointerDownInput) => ActiveInteractionSession | 'handled' | null
  idleMove?: (input: PointerMoveInput) => void
  idleLeave?: () => void
  idleWheel?: (input: WheelInput) => boolean
  keyDown?: (input: KeyboardInput) => boolean
  keyUp?: (input: KeyboardInput) => boolean
  clear?: () => void
}
```

这个协议和当前模型的区别是：

- 没有 `owner`
- 没有 `observe`
- 没有 `InteractionControl`
- 没有 `mode`
- 没有 `control.update`

只保留 event router 真正需要的那一点点协议。

---

## 5. feature 内部 phase 缩回本地

这条非常重要。

### selection

selection 内部完全可以有：

- `phase = 'press' | 'move' | 'marquee'`

但这只是 selection hook 自己的 `useRef` 状态。

event router 不需要知道。

### edge

edge 内部可以有：

- `phase = 'connect' | 'reconnect' | 'route'`

但对外只需要表现为：

- 当前 active feature 是 edge

### draw

draw 内部可以有：

- `phase = 'stroke' | 'erase'`

也只在 draw hook 自己内部存在。

原则：

**feature 自己的 phase，不要抬成全局 interaction 概念。**

---

## 按 feature 看最终该怎么改

## 1. selection

selection 是最应该按 React 心智重写的。

当前最大的问题：

- `press -> move/marquee` 被表达成 runtime session 切换
- press state 不是 selection 自己完整拥有

最终应该变成：

- `useSelectionInteraction()`

内部持有：

- `pressRef`
- `activeDragRef`
- `holdTaskRef`

对外暴露：

- `tryStart`
- `idleMove`
- `idleLeave`
- `keyDown`
- `clear`

行为上：

- `tryStart` 只初始化 selection 本地 press state，并返回一个 active session
- 这个 active session 的 `move` 内部自己判断何时进入 `move` 或 `marquee`
- `up` 时自己根据 press/release 规则执行 selection command 或 edit command
- marquee / move preview 直接写 React interaction store

也就是说：

**selection 不再“创建 press interaction / move interaction / marquee interaction”，而是一个 hook 自己管理 press、move、marquee。**

这是最符合 React 心智的。

---

## 2. draw

draw 当前已经接近可收敛状态，但仍然是 runtime session 写法。

最终应该是：

- `useDrawInteraction()`

内部用：

- `strokeRef`
- `eraseRef`

对外：

- `tryStart`
- active session 的 `move/up/cancel`
- `clear`

关键改法：

- draw preview 写 React interaction store
- `commitStrokeSession` / `commitEraseSession` 仍然可以调用 core 纯函数再写 commands
- draw / erase 仍然可以保留两个内部 helper 文件，但不再暴露成 runtime interaction factory

所以最终目录可以是：

```txt
interactions/draw/
  useDrawInteraction.ts
  stroke.ts
  erase.ts
```

而不是：

- `createDrawInteraction`
- `InteractionFeature`

---

## 3. edge

edge 当前的异味主要在：

- `start` 和 `observe` 被拆开
- hover guide 依赖 `observe.move/leave/blur/cancel`

按 React 心智，edge 应该是一个 hook 同时拥有：

- idle hover
- active connect/reconnect/route session

最终应该是：

- `useEdgeInteraction()`

内部持有：

- `hoverRef`
- `activeRef`
- `hoverTaskRef`

对外：

- `tryStart`
- `idleMove`
- `idleLeave`
- `blur`
- `clear`

关键点：

- hover guide 是 edge 自己的 idle state，不应该被塞进 `observe`
- active route/connect 也是 edge 自己的 active session
- edge hover guide / patches 直接写 React interaction store

所以：

**edge 的 hover 和 active edit 应该在同一个 hook 内部统一。**

---

## 4. transform

transform 是最容易收的。

最终应该是：

- `useTransformInteraction()`

内部持有：

- `transformRef`
- `latestProjectionRef`

对外：

- `tryStart`
- active session 的 `move/up/cancel`
- `clear`

projection 仍然可以用 core / pure helper 做：

- start
- project
- commit

但 hook 自己负责：

- session 生命周期
- projection state 写入 React store

---

## 5. mindmap

mindmap 也很适合收成一个 hook。

最终：

- `useMindmapInteraction()`

内部：

- `dragRef`

对外：

- `tryStart`
- active session `move/up/cancel`
- `clear`

mindmap drag feedback 直接写 React interaction store。

---

## 6. insert

insert 不需要 session。

最优模型就是：

- `tryStart`
- 立即执行 `editor.commands.insert.preset`
- 成功后切回 `selectTool`

它是最典型的“stateless interaction feature”。

---

## 7. viewport pan

viewport pan 本身也不需要复杂 runtime。

最终：

- `useViewportPanInteraction()`

内部：

- `panRef`

对外：

- `tryStart`
- active session `move/up/cancel`

它只依赖：

- `space pressed`
- `tool === hand`
- `inputPolicy.panEnabled`

这里的 `space pressed` 可以放在 interaction active state 里，而不需要做成 runtime store。

---

## React 侧状态到底该怎么放

这个问题要说清楚，否则 interactions 还是会绕回 editor。

## 1. editor 里放什么

editor 放：

- document committed state
- read model
- commands
- 与文档逻辑强相关的 runtime state

## 2. React interaction store 放什么

放：

- 当前 active feature
- busy/chrome/transforming/space
- 各种 preview / guide / ghost / marquee / projection

## 3. feature hook 的 ref 里放什么

放：

- 当前 session 的内部计算状态
- start point
- hold task
- 最近一次 pointer
- 内部 phase

一句话：

- **document state 在 editor**
- **preview state 在 React interaction store**
- **session state 在 feature refs**

这个归属一旦理顺，interaction 代码会一下顺很多。

---

## 事件流最终应该是什么样

## 1. pointerdown

`SurfaceBindings`：

- 解析 DOM event -> semantic input
- 依次调用 feature 的 `tryStart`
- 第一个返回 session 的 feature 成为 active
- 第一个返回 `'handled'` 的 feature 直接截断

如果 active 建立成功：

- 记录 `activeFeatureRef`
- 记录 `activeSessionRef`
- 同步 `InteractionViewState.active`
- 开启 pointer capture / selection lock

## 2. pointermove

如果有 active session：

- 调用 active `move`
- 如果 session 有 `autoPanFrame`，驱动 auto pan

如果没有 active session：

- 依次执行 feature 的 `idleMove`

## 3. pointerup

如果有 active session：

- 调用 active `up`
- 释放 capture / lock
- 调用 `cleanup`
- 清空 active

## 4. pointercancel / blur

如果有 active session：

- 调用 `cancel` 或 `blur`
- 调用 `cleanup`
- 清空 active

同时通知所有 feature 清理 idle 态。

## 5. pointerleave

没有 active session 时：

- 执行所有 feature 的 `idleLeave`

## 6. wheel

先给 feature 的 `idleWheel`

- 如果有 feature 消费，结束
- 否则走默认 viewport wheel

这才是最自然的 React 事件流。

---

## 为什么这比当前模型更简单

## 1. 没有 runtime 框架

不用再理解：

- owner
- observe
- session
- control
- mode

只需要理解：

- feature hook
- active session ref
- interaction store

## 2. state ownership 非常清晰

- session 是 feature 自己的
- preview 是 React 的
- commit 是 editor 的

## 3. selection / edge 这类复杂 feature 不再把内部 phase 泄漏到全局

这样中间层自然变薄。

## 4. 更符合 React 的“局部拥有状态”

React 最自然的写法一直是：

- 本地 ref
- 本地 hook
- 共享 store
- 组件订阅

而不是在 React 里再造一个 runtime framework。

---

## 最终目录建议

这份方案只聚焦 interactions，所以目录先按 interaction 维度重排，不碰更大的 board/surface 总体结构。

建议最终目录：

```txt
packages/whiteboard-react/src/
  interactions/
    useCanvasInteractions.ts
    state.ts
    types.ts
    autoPan.ts

    selection/
      useSelectionInteraction.ts
      press.ts
      move.ts
      marquee.ts

    draw/
      useDrawInteraction.ts
      stroke.ts
      erase.ts

    edge/
      useEdgeInteraction.ts
      connect.ts
      route.ts
      hover.ts

    transform/
      useTransformInteraction.ts
      start.ts
      project.ts
      commit.ts

    mindmap/
      useMindmapInteraction.ts

    insert/
      useInsertInteraction.ts

    viewport/
      useViewportPanInteraction.ts
```

命名规则：

- React 层统一 `useXxxInteraction`
- 内部纯 helper 才用 `start / project / commit / hover`
- 不再使用 `createXxxInteraction`

---

## 一步到位实施顺序

下面是严格按这份方案落地的顺序。

## 第 1 步：先建立 React interaction store

先把下面这些从 editor overlay 迁出来：

- draw preview
- selection preview
- edge guide / edge patches
- transform projection
- mindmap drag feedback
- active interaction state

目的：

- 先切断 “interaction 写 editor overlay” 这条线

这一步一旦完成，editor 就更像纯 store + commands。

## 第 2 步：把 `createInteractionRuntime` 改成 `useCanvasInteractions`

目标：

- 先去掉 runtime 框架心智

做法：

- 新建 `useCanvasInteractions`
- 用 `useRef` 管 active feature/session
- surface 直接调用它返回的 handlers

此时哪怕 feature 还没全改，主干心智也已经从 runtime 变成 React hook 了。

## 第 3 步：selection 先整体重写

因为 selection 最复杂，也最能验证这套模型是否真的顺。

目标：

- 把 `press/move/marquee` 收成一个 hook 内部状态机

做到：

- event router 只知道 active = selection
- selection 内部自己管理 phase

## 第 4 步：重写 edge

目标：

- 把 hover 和 active edit 合并到一个 hook
- 去掉 `observe`

因为 edge 是当前 `observe` 味道最重的地方。

## 第 5 步：重写 draw / transform / mindmap / viewport / insert

这些 feature 相对直接。

统一改成：

- `useXxxInteraction`
- 本地 refs
- 写 React interaction store
- commit 用 editor.commands

## 第 6 步：最后清理旧协议

删掉：

- `InteractionCtx`
- `InteractionFeature`
- `InteractionControl`
- `InteractionSessionMode`
- `createInteractionRuntime`
- `createWhiteboardRuntime` 对 interaction 的包装依赖
- `editor.input`
- `editor.state.interaction`

这一步做完，interaction 才算真正完成 React 化。

---

## 最后一句话

如果严格按 React 心智来看，这条线最正确的重构方向不是继续优化 interaction runtime，而是：

- **让 feature hook 自己拥有 session**
- **让 React store 持有 preview state**
- **让 event router 只做最薄分发**
- **让 editor 回到纯 read + commands**

所以这次 interactions 的长期最优答案是：

**从“runtime framework”重写成“React hooks + local refs + shared interaction store + thin event router”。**

这比继续在 `InteractionFeature / owner / observe / control` 这套模型上打磨，要直接得多，也更接近你说的那种：

- React 里 `useState/useRef`
- pointermove 时算
- 写预览
- 最后 commit

本质上就是把这件事做干净、做完整。
