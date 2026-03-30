# Whiteboard Editor Interaction Kernel 简化状态模型方案

## 1. 文档目标

这份文档只回答一个问题：

**为什么像 `packages/whiteboard-editor/src/features/draw/interaction.ts` 这种文件以前会自己持有 `interaction`，以及从长期最优看，应该怎么把这层改成更简单、更直观的模型。**

这里不追求“更完整的抽象”，而是追求：

1. 更容易理解
2. 更容易实现
3. 更符合现在 `whiteboard-editor` 的代码现实

这份文档明确放弃使用下面这套更重的表达：

1. `payload`
2. `createSession(...)`
3. `active`

改用更直接的表达：

1. `can(...)`
2. `state`
3. `move / up / cancel / cleanup`

---

## 2. 先给结论

以前 `draw/interaction.ts` 这类文件还会自己持有 `interaction`，说明当时架构已经完成了：

1. 外层 pointer down 路由的统一
2. driver registry 的统一
3. coordinator 对 capture / cancel / blur / busy 的统一
4. projection 和 interaction 的初步拆分

但**还没有完成最后一层底层模型对齐**：

**feature 仍然在自己创建和持有 session，而不是由 interaction kernel 统一持有。**

更准确地说：

1. `driver` 这一层已经比较清楚
2. `projection` 这一层也在逐步清楚
3. **还没完全对齐的是 session ownership**

这就是为什么你现在会看到：

1. `draw/interaction.ts`
2. `edge/edit/interaction.ts`
3. `mindmap/drag/interaction.ts`
4. `node/drag/interaction.ts`

这些文件还会自己 `interaction.start(...)`。

---

## 3. 当前问题不是“有没有 interaction”

先把一个常见误区拿掉。

问题**不是**：

**“feature 文件里不能出现 interaction。”**

真正的问题是：

**“feature 不应该自己决定 session 何时开始、何时被 coordinator 托管。”**

现在的模式还是：

```ts
driver.resolve(pointerDown)
  -> feature.start(pointerDown)
  -> feature 内部调用 interaction.start(...)
```

这意味着：

1. driver 只负责找到 feature
2. 但真正启动 session 的仍然是 feature
3. kernel 还只是一个被调用的能力提供者

长期最优不应该这样。

长期最优应该是：

```ts
driver.resolve(pointerDown)
  -> kernel 选中 registration
  -> kernel 调 can(...)
  -> kernel 持有 state
  -> kernel 驱动 move / up / cancel / blur
```

也就是说：

**不是 feature 调 kernel 启动 session，而是 kernel 驱动 feature 暴露出来的交互定义。**

---

## 4. 为什么 `createSession(payload, ctx)` 不够好

这套表达并不是错的，但对现在这个工程来说，它有点重了。

它通常会把一件事拆成三层：

1. `payload`
2. `session`
3. `active`

例如：

```ts
createSession(payload, ctx) {
  const active = createSomething(payload, ctx)
  return {
    move() {},
    up() {}
  }
}
```

这套写法的问题不是功能不对，而是理解路径太长。

读代码的人必须先理解：

1. `payload` 是什么
2. `session` 是什么
3. `active` 又是什么
4. 三者之间谁拥有谁

对 `whiteboard-editor` 现在这个阶段，这个抽象层级偏高了。

尤其像 `draw` 这种交互，本质上只需要一个很直接的心智模型：

1. 能不能开始
2. 开始后当前状态是什么
3. move 时怎么改这个状态
4. up 时怎么提交
5. cleanup 时怎么清 projection

所以更好的模型不是更复杂，而是更直接。

---

## 5. 更简单的长期最优模型

我建议 interaction kernel 最终统一成下面这个形态：

```ts
interaction.register('draw.stroke', {
  mode: 'draw',
  can,
  start,
  move,
  up,
  cancel,
  cleanup
})
```

这里每个字段的意义都非常直接。

### 5.1 `can`

`can` 负责两件事：

1. 判断这次 pointer down 能不能启动这个交互
2. 如果能，返回这次交互的初始 `state`

如果不能，就返回 `null`。

也就是说：

**`can` 不只是判定，同时也是初始 state 构造器。**

### 5.2 `start`

`start` 是可选的。

它只做“开始瞬间的副作用”，例如：

1. 写一次初始 preview
2. 做一次 selection replace
3. 做一次 preventDefault 之外的业务初始化

如果不需要，就可以没有。

### 5.3 `move`

`move` 接收当前 `state`，更新它，然后决定：

1. 是否写 projection
2. 是否更新内部状态
3. 是否触发 auto-pan

### 5.4 `up`

`up` 负责最终提交：

1. commit command
2. 写最终 projection
3. `session.finish()`

### 5.5 `cancel`

`cancel` 处理被中断时的业务逻辑。

### 5.6 `cleanup`

`cleanup` 只做收尾：

1. 清 preview
2. 清 hint
3. 清 hidden

不要把 commit 混进 cleanup。

---

## 6. 这个模型里最关键的变化

这个模型比 `createSession(payload, ctx)` 更简单，关键就在两点。

### 6.1 不再需要 `payload`

`can(...)` 直接返回初始 `state`。

所以不再需要：

1. 先构造 `payload`
2. 再把 `payload` 交给 `createSession`
3. 再从里面构造 `active`

### 6.2 不再需要 `active`

统一直接叫 `state`。

原因很简单：

1. 对大多数 feature 来说，这就是“当前交互状态”
2. `active` 这个词没有增加太多信息
3. 反而容易让人误以为它是某种特殊对象

所以更建议统一叫：

1. `state`
2. 或者 `draft`

但不要再叫 `active`。

---

## 7. kernel 到底持有什么

interaction kernel 真正需要持有的东西其实很少。

我建议就是这一份：

```ts
type RunningInteraction = {
  key: string
  mode: ActiveInteractionMode
  pointerId?: number
  capture?: Element | null
  state: unknown
  registration: InteractionRegistration<unknown>
}
```

这就够了。

kernel 负责：

1. 持有当前 running interaction
2. 绑定 pointer continuation
3. 调 `move / up / cancel / blur / keydown / keyup`
4. finish / replace / auto-pan / cleanup

feature 不再直接碰这些底层控制能力。

---

## 8. 推荐接口定义

为了保持简单，我建议最终把 registration 设计成下面这个样子：

```ts
type InteractionRegistration<State> = {
  key: string
  mode: ActiveInteractionMode
  priority?: number
  can: (
    input: PointerDownInput,
    ctx: InteractionResolveContext
  ) => State | null
  start?: (
    state: State,
    input: PointerDownInput,
    ctx: InteractionRuntimeContext,
    session: RuntimeSession
  ) => void
  move?: (
    state: State,
    input: SessionPointerInput,
    ctx: InteractionRuntimeContext,
    session: RuntimeSession
  ) => void
  up?: (
    state: State,
    input: SessionPointerInput,
    ctx: InteractionRuntimeContext,
    session: RuntimeSession
  ) => void
  cancel?: (
    state: State,
    ctx: InteractionRuntimeContext,
    session: RuntimeSession
  ) => void
  cleanup?: (
    state: State | null,
    ctx: InteractionRuntimeContext
  ) => void
}
```

这里故意保持很朴素。

没有：

1. `payload`
2. `createSession`
3. `InteractionSessionSpec`

因为这些东西在这个项目当前阶段不是必须的。

---

## 9. `can` 为什么可以同时负责判定和 state 初始化

这个地方看起来像是“职责混合”，但实际上是合理的。

因为对交互来说，“能不能开始”和“开始时的初始状态”本来就是一体的。

例如 `draw.stroke`：

1. 只有在 `tool.type === 'draw'`
2. 且不是 eraser
3. 且点在 background

时才能开始。

而一旦能开始，初始状态马上就能确定：

1. `ownerId`
2. `kind`
3. `points`
4. `lastScreen`
5. `lengthScreen`

所以直接让 `can` 返回初始 `state`，比拆成：

1. `canStart`
2. `payload`
3. `createSession`

更自然。

---

## 10. `draw` 的最优样子

`draw` 是最值得作为第一批样板的 feature。

因为它的问题非常典型：

1. 文件名叫 `input.ts`
2. 实际上同时做启动、session、projection、commit
3. 当前混合度高，但业务本身又不算最复杂

### 10.1 目标接口

`draw.stroke` 更适合写成：

```ts
interaction.register('draw.stroke', {
  mode: 'draw',

  can(input, ctx) {
    if (input.tool.type !== 'draw') return null
    if (input.tool.kind === 'eraser') return null
    if (input.pick.kind !== 'background') return null

    return {
      ownerId: input.frame.id ?? ctx.read.node.frameAt(input.point.world),
      kind: input.tool.kind,
      style: ctx.draw.readStyle(input.tool.kind),
      points: [input.point.world],
      lastScreen: input.point.screen,
      lengthScreen: 0
    }
  },

  move(state, input, ctx) {
    appendStrokePoints(state, input)
    ctx.projection.draw.set(toDrawPreview(state))
  },

  up(state, input, ctx, session) {
    appendStrokePoints(state, input, true)
    const stroke = finishStroke(state)
    if (stroke) {
      ctx.commands.node.create(toDrawNodeInput(stroke))
    }
    session.finish()
  },

  cleanup(_state, ctx) {
    ctx.projection.draw.clear()
  }
})
```

这里的优点很明显：

1. `draw` 不再自己调用 `interaction.start(...)`
2. `draw` 不再自己持有 interaction slot
3. kernel 才是唯一 session owner
4. `state` 的结构一眼就能看懂

### 10.2 `draw.erase` 也同理

```ts
interaction.register('draw.erase', {
  mode: 'draw',

  can(input) {
    if (input.tool.type !== 'draw') return null
    if (input.tool.kind !== 'eraser') return null

    return {
      ids: new Set<NodeId>(),
      lastWorld: input.point.world
    }
  },

  start(state, input, ctx) {
    collectErasePoint(state, input.point.world, ctx)
    ctx.projection.nodeHidden.set([...state.ids])
  },

  move(state, input, ctx) {
    collectEraseEvent(state, input, ctx)
    ctx.projection.nodeHidden.set([...state.ids])
  },

  up(state, input, ctx, session) {
    collectEraseEvent(state, input, ctx)
    if (state.ids.size > 0) {
      ctx.commands.node.delete([...state.ids])
    }
    session.finish()
  },

  cleanup(_state, ctx) {
    ctx.projection.nodeHidden.clear()
  }
})
```

这已经足够清楚，不需要再多套一层 `createSession`。

---

## 11. `edge / node / mindmap / selection / viewport` 应该统一成同一协议

这套模型不是 draw 专用的。

下面这些都应该统一到同一种 registration 协议：

1. `draw.stroke`
2. `draw.erase`
3. `edge.create`
4. `edge.reconnect`
5. `edge.body`
6. `edge.route`
7. `node.transform`
8. `node.drag`
9. `mindmap.drag`
10. `selection.press`
11. `selection.marquee`
12. `viewport.pan`

不同之处只在：

1. `state` 长什么样
2. `move / up / cancel / cleanup` 如何实现

而不应该再有不同的 session ownership 模型。

---

## 12. 标准化输入应该由 kernel 提供

虽然这个模型更简单，但有一个地方仍然要统一：

**feature 不应该直接依赖裸 DOM event。**

kernel 更适合统一提供标准化输入：

```ts
type SessionPointerInput = {
  pointerId: number
  client: Point
  screen: Point
  world: Point
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  buttons: number
  raw?: PointerEvent
}
```

这样能统一：

1. viewport 坐标换算
2. coalesced event 采样
3. pointerId 传递
4. modifier key 读取

这才是真正的“输入层统一”。

---

## 13. transition 怎么办

简单模型不代表不支持 transition。

像：

1. `press -> node.drag`
2. `press -> marquee`

这种切换，仍然可以由 kernel 原生支持。

但接口也应该尽量保持简单。

我建议不要引入很重的 transition object，而是直接支持：

```ts
session.replace({
  key: 'node.drag',
  state: nextState
})
```

或者：

```ts
session.replace('node.drag', nextState)
```

这里的原则还是一样：

1. 让 kernel 负责切换
2. 不让 feature 自己重新 `interaction.start(...)`

但表达形式保持轻量。

---

## 14. projection 在这个模型里的位置

如果改成这种更简单的 registration + state 模型，projection 的位置会更清楚。

projection 只负责输出。

也就是说：

1. `state` 是交互内部状态
2. `projection` 是视觉输出
3. `commands` 是最终提交

不要再让 projection 反过来承担 session lifecycle。

所以最合理的流向是：

```ts
pointer input
  -> update state
  -> write projection
  -> commit commands
```

而不是：

```ts
pointer input
  -> projection store
  -> 再反推 session
```

---

## 15. 为什么这个模型比现在更好

### 15.1 比当前模式更简单

当前模式：

1. driver 找 feature
2. feature `start(...)`
3. feature 内部 `interaction.start(...)`
4. feature 自己持有 session slot

新模型：

1. driver 找 registration
2. kernel 调 `can(...)`
3. kernel 持有 `state`
4. kernel 驱动 `move / up / cancel / cleanup`

链路更短。

### 15.2 比 `createSession(payload)` 更容易理解

因为它只剩一层核心事实：

**这次交互的当前状态是什么。**

### 15.3 更适合逐步落地

因为可以从一个 feature 一个 feature 地迁移，不需要先引入太多新概念。

---

## 16. 命名应该怎么改

如果按这套模型往下走，命名也应该一起更诚实。

### 16.1 `input.ts`

如果它其实是交互定义，不应该再叫 `input.ts`。

### 16.2 旧的 `session.ts`

如果它不是“当前运行中的交互状态”，也不应该叫 `session.ts`。

### 16.3 更推荐的命名

更建议：

1. `driver.ts` 或 `drivers.ts`
2. `interaction.ts`
3. `projection.ts`
4. `state.ts`
5. `core/*.ts`

---

## 17. 分阶段实施建议

## 第 1 阶段：先定义最小 registration 协议

先只定这几个字段：

1. `key`
2. `mode`
3. `can`
4. `start?`
5. `move?`
6. `up?`
7. `cancel?`
8. `cleanup?`

不要一开始就引入更重的 `payload / createSession / spec`。

## 第 2 阶段：先拿 `draw` 做完整样板

原因：

1. `draw` 当前混合度高
2. 但业务形态单纯
3. 最容易看出“kernel 持 state”是否真的更清楚

## 第 3 阶段：迁移 `mindmap.drag`

它仍然是单 session 模型，适合第二批验证。

## 第 4 阶段：迁移 `edge` 相关交互

这里验证：

1. patch / hint projection
2. route edit
3. reconnect / create

是否都能稳定落到同一种协议上。

## 第 5 阶段：迁移 `selection.press -> drag / marquee`

这一阶段验证 transition 是否足够简单、足够稳。

## 第 6 阶段：最后迁移 `viewport.pan`

这一步检验宿主级交互是否也能统一进入同一个模型。

---

## 18. 明确不建议做的事

### 18.1 不建议让 feature 自己监听 `pointermove / pointerup`

这会把 capture、cancel、blur、busy、auto-pan 全部分散回去。

### 18.2 不建议做万能 interaction 基类

这会把局部清晰换成全局抽象。

### 18.3 不建议继续使用更重的术语

在当前阶段，不建议再把新模型表述成：

1. `payload`
2. `createSession`
3. `active`
4. `session spec`

因为这几层概念并不会让实现更清楚，只会提高理解成本。

---

## 19. 最终结论

如果只回答一句话：

**如果 `draw/interaction.ts` 这类文件还需要自己持有 `interaction`，说明底层虽然部分对齐了，但 session ownership 还没有彻底对齐。**

真正更好的长期最优，不是：

1. feature 自己监听 `pointermove / pointerup`
2. feature 自己主动 `interaction.start(...)`
3. 再包一层 `createSession(payload, ctx)`

而是：

**interaction kernel 成为唯一 session owner，feature 只暴露 `register({ mode, can, start?, move, up, cancel, cleanup })`。**

一旦这层真正完成：

1. `draw/interaction.ts` 这种仍然混合启动/状态/提交的文件会继续被压薄
2. driver / state / projection / command 的边界会更清楚
3. transition、cancel、busy、blur、auto-pan 会全部回到 kernel
4. feature 会更接近真正简单的“输入、处理、输出”模型
5. 整个 `whiteboard-editor` 的底层交互模型才算真正对齐
