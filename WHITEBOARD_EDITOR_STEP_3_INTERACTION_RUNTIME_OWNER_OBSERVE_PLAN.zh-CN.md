# WHITEBOARD_EDITOR_STEP_3_INTERACTION_RUNTIME_OWNER_OBSERVE_PLAN.zh-CN

## 文档定位

这份文档是
[WHITEBOARD_EDITOR_STEP_2_INTERACTION_MODEL_EXECUTION_PLAN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_EDITOR_STEP_2_INTERACTION_MODEL_EXECUTION_PLAN.zh-CN.md)
之后的下一步详细方案。

阶段 2 已经把 interaction 内部从“散乱 helper / phase”收成了：

- `owner + session`
- 最小 `InteractionCtx`

但 runtime 外壳还没有真正对齐这个方向。

当前 runtime 仍然把交互拆成两套机制：

- `pointerdown -> interaction registry`
- `pointermove / leave / blur / wheel -> passive runtime`

这会把同一个 owner 的逻辑硬拆成两半。

最典型的例子就是：

- `edge connect / edit` 属于 `edge` owner
- `edge hover` 却要作为 passive processor 单独挂出去

这不是长期最优。

阶段 3 的目标就是彻底收掉这个分裂：

- **重写 interaction runtime**
- **删除 active/passive 二分**
- **统一成 `owner + observe + session` 模型**

这一步是一步到位方案：

- 不保留兼容层
- 不保留过渡 API
- 不保留 `registry + passive` 双轨结构

---

## 当前结构的问题

当前 interaction runtime 的分裂点主要在下面这些文件：

- [packages/whiteboard-editor/src/runtime/input/passive.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/input/passive.ts)
- [packages/whiteboard-editor/src/runtime/interaction/registry.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/interaction/registry.ts)
- [packages/whiteboard-editor/src/runtime/interaction/coordinator.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/interaction/coordinator.ts)
- [packages/whiteboard-editor/src/runtime/editor/composeInput.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/editor/composeInput.ts)
- [packages/whiteboard-editor/src/runtime/input/router.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/input/router.ts)

当前链路大致是：

1. `composeInput` 组装两套 runtime
2. `pointerDown` 走 `interactions.start(...)`
3. `pointerMove` 在 `busy` 时走 `interaction.handlePointerMove(...)`
4. `pointerMove` 在 `idle` 时走 `runtime.passive.move(...)`
5. `wheel` 先走 passive，再 fallback 到 viewport
6. `leave / blur / cancel` 也分散在 passive 和 active 之间

这条线的问题有四个。

### 1. `active / passive` 不是产品概念

真实产品概念是：

- `selection`
- `edge`
- `draw`
- `viewport`
- `insert`

而不是：

- active interaction
- passive processor

`active / passive` 只是当前 runtime 的技术分层，不是稳定业务模型。

长期最优里，不应该把这种运行时实现细节变成系统主轴。

### 2. 同一个 owner 被迫拆成两份

以 `edge` 为例：

- `start` 部分在 [packages/whiteboard-editor/src/interactions/edge/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/edge/index.ts)
- `hover` 虽然逻辑上已经收回到 `edge` 文件内部，但对外装配仍然要通过 `passive`

这意味着 owner 的对外接口不是闭合的。

只要 runtime 仍然区分 active/passive，owner 就永远不能真正成为唯一边界。

### 3. `router` 知道太多 interaction 内部细节

当前 [packages/whiteboard-editor/src/runtime/input/router.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/input/router.ts)
里有太多“如果 busy 就走 A，否则走 B”的逻辑。

这说明：

- 事件分发规则没有收敛到 interaction runtime
- router 不只是做输入归一化
- router 还在承担交互调度判断

长期最优里，router 应该只是：

- 归一化 DOM 输入
- 写 pointer snapshot
- 调用 interaction runtime

而不是：

- 知道 active/passive 的分发差异

### 4. `when(context)` 是额外 DSL

当前 passive 有：

- `when(context)`
- `PassiveInputContext`

这又引入了一套新的判断协议。

owner 自己本来就能从 `ctx.read.tool.get()`、`ctx.interaction.state.get()` 得到所需信息。

如果还保留 `when(context)`，就会出现新的结构摇摆：

- 该把条件放到 runtime 里
- 还是放到 owner 里

长期最优里，不需要这层 DSL。

应该直接让 owner 在自己的 `observe` 内部判断是否早退。

---

## 阶段 3 的核心结论

阶段 3 的唯一正确方向是：

- **把 interaction 的注册单位统一成 `InteractionOwner`**
- **owner 既可以 `start session`，也可以 `observe idle input`**
- **session 继续保留，不做“observe 化”**

也就是说，长期最优不是：

- 删除 session

而是：

- 删除 `active/passive` 这个外层二分

最终模型应该是：

1. `InteractionCtx`
2. `InteractionOwner`
3. `InteractionSession`
4. `InteractionRuntime`

没有：

- `InteractionRegistration`
- `PassiveInputProcessor`
- `InteractionRegistry`
- `PassiveInputRuntime`

---

## 最终目标模型

## 1. `InteractionOwner`

`InteractionOwner` 是 interaction 的唯一对外注册单位。

建议最终类型：

```ts
type InteractionOwner = {
  key: string
  priority?: number
  start?: (
    input: PointerDown,
    control: InteractionControl
  ) => InteractionSession | null
  observe?: {
    move?: (input: PointerMove) => void
    leave?: () => void
    blur?: () => void
    cancel?: () => void
    wheel?: (input: ResolvedWheelInput) => boolean
  }
}
```

这里的关键点：

- `start` 和 `observe` 都属于同一个 owner
- `observe` 不是单独注册出去的 processor
- `observe` 是 owner 的补充职责，而不是另一套并列系统

### 为什么 `observe` 不需要 `when(context)`

因为 owner 本身已经闭合了。

例如 `edge.observe.move(...)` 完全可以自己写：

```ts
if (ctx.read.tool.get().type !== 'edge') return
if (ctx.interaction.state.get().mode !== 'idle') return
```

这比：

- `when(context)`
- 再由 runtime 传 context

更直接，也更少一层协议。

## 2. `InteractionSession`

当前的 `ActiveInteraction` 建议直接改名为 `InteractionSession`。

原因很简单：

- 它本质上就是一次正在进行中的 session
- “active” 是运行时视角
- “session” 是模型视角

建议最终类型：

```ts
type InteractionSession = {
  mode: InteractionSessionMode
  pointerId?: number
  chrome?: boolean
  autoPan?: AutoPanOptions
  move?: (input: PointerMove) => void
  up?: (input: PointerUp) => void
  keydown?: (input: EditorKeyboardInput) => void
  keyup?: (input: EditorKeyboardInput) => void
  blur?: () => void
  cancel?: () => void
  cleanup?: () => void
}
```

这里还有一个关键简化：

- `move / up` 直接使用 `PointerMove / PointerUp`
- 不再额外构造 `InteractionPointerInput`

也就是说：

- [packages/whiteboard-editor/src/runtime/input/router.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/input/router.ts)
里的 `toInteractionPointerInput(...)` 应该删除
- [packages/whiteboard-editor/src/types/runtime/interaction.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/types/runtime/interaction.ts)
里的 `InteractionPointerInput` 应该删除

长期最优里，session 与 observe 应共享同一份归一化后的 pointer event 类型。

这样整条线最直。

## 3. `InteractionRuntime`

当前的 `InteractionCoordinator` 建议升级并改名为 `InteractionRuntime`。

它的职责应该是：

- 管理当前 session
- 按 priority 调度 owner
- 在 idle 时分发 observe
- 管理 `mode / busy / chrome / space`
- 管理 auto pan

它不再只负责“active session 协调”，而是负责整个 interaction 分发。

建议最终类型：

```ts
type InteractionRuntime = {
  mode: ReadStore<InteractionMode>
  busy: ReadStore<boolean>
  chrome: ReadStore<boolean>
  state: ReadStore<InteractionState>
  space: ReadStore<boolean>
  handlePointerDown: (input: PointerDown) => boolean
  handlePointerMove: (input: PointerMove) => boolean
  handlePointerUp: (input: PointerUp) => boolean
  handlePointerCancel: (input: { pointerId: number }) => boolean
  handlePointerLeave: () => void
  handleWheel: (input: ResolvedWheelInput) => boolean
  handleKeyDown: (input: EditorKeyboardInput) => boolean
  handleKeyUp: (input: EditorKeyboardInput) => boolean
  cancel: () => void
  handleBlur: () => void
}
```

注意：

- `InteractionRegistry` 删除
- `PassiveInputRuntime` 删除
- `composeInput` 不再组装两套 runtime

---

## 最终事件流

这一步真正要统一的是事件流，而不是只统一类型名字。

## 1. `pointerDown`

最终规则：

1. 如果已有 session，直接返回 `false`
2. 否则按 `priority` 从高到低遍历 owners
3. 调用 owner 的 `start(input, control)`
4. 第一个返回 session 的 owner 成为当前 active owner
5. runtime 在 session 成功启动后，立即对所有 owners 执行一次 `observe.cancel?.()`

第 5 条很重要。

原因是：

- idle observe 可能留下 hover / guide / preview
- 一旦 session 启动，这些 idle 态投影应该立即清掉

否则 `edge hover` 这类效果容易残留。

## 2. `pointerMove`

最终规则：

1. 如果当前有 session，只把事件交给当前 session 的 `move`
2. 如果当前没有 session，按 priority 遍历 owners，依次调用 `observe.move`

这里不建议让 observe 在 active session 期间继续跑。

原因是：

- session 是独占的
- observe 是 idle 行为
- 两者同时运行会重新制造状态竞争

也就是说：

- `observe.move` 只在 `idle` 运行

## 3. `pointerUp`

最终规则：

- 只有 active session 接收 `up`
- owner observe 不参与

## 4. `wheel`

最终规则：

1. 如果 active session 存在，直接返回 `true`
2. 如果没有 active session，按 priority 遍历 owners 的 `observe.wheel`
3. 只要有任意 owner 返回 `true`，runtime 返回 `true`
4. 如果全部返回 `false`，由 router fallback 到 viewport wheel

`wheel` 是 observe 唯一需要返回 handled 的事件。

因为它和 viewport 默认行为存在竞争关系。

## 5. `leave`

最终规则：

- 不分 busy / idle，统一 fan-out 给所有 owners 的 `observe.leave`

`leave` 主要用于：

- 清 hover
- 清 guide
- 清 pointer 附着的 idle 可视效果

session 通常不需要 `leave`。

如果未来真的需要，再显式为 session 增加 `leave`，但这不是当前步骤的一部分。

## 6. `blur`

最终规则：

1. 清 `space`
2. 先 fan-out 给所有 owners 的 `observe.blur`
3. 再处理 active session：
   - 如果 session 自己实现了 `blur`，调用它
   - 否则 runtime 触发 `cancel`

这里 observe 要先于 session。

因为 observe 是环境态清理，应该先做掉。

## 7. `cancel`

最终规则：

1. 先 fan-out 给所有 owners 的 `observe.cancel`
2. 再取消 active session

这样 `Escape`、外部 cancel、pointer cancel 都能统一清理 idle overlay 与 active overlay。

---

## 目标文件结构

阶段 3 做完后，interaction runtime 相关文件建议整理成这样。

## 1. 保留并重写

- [packages/whiteboard-editor/src/runtime/interaction/coordinator.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/interaction/coordinator.ts)

建议直接重写并改名为：

- `packages/whiteboard-editor/src/runtime/interaction/runtime.ts`

它成为唯一 interaction runtime。

## 2. 删除

- [packages/whiteboard-editor/src/runtime/input/passive.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/input/passive.ts)
- [packages/whiteboard-editor/src/runtime/interaction/registry.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/interaction/registry.ts)

这两个文件的存在前提就是 active/passive 二分。

阶段 3 后不再成立。

## 3. 改薄

- [packages/whiteboard-editor/src/runtime/editor/composeInput.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/editor/composeInput.ts)
- [packages/whiteboard-editor/src/runtime/input/router.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/input/router.ts)
- [packages/whiteboard-editor/src/runtime/editor/types.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/editor/types.ts)
- [packages/whiteboard-editor/src/types/runtime/interaction.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/types/runtime/interaction.ts)

其中：

- `composeInput` 只负责创建一个 interaction runtime
- `router` 只负责归一化输入和 pointer snapshot
- `editor/types.ts` 删除 `interactions + passive` 双轨 internals
- `types/runtime/interaction.ts` 删除 `InteractionRegistration`、`InteractionRegistry`、`InteractionPointerInput`

---

## owner 层最终应如何改

阶段 3 完成后，每个 interaction 文件的对外接口都应该统一成：

```ts
type OwnerFactoryResult = {
  owner: InteractionOwner
  clear: () => void
}
```

也就是说：

- owner 是唯一注册单元
- clear 是 lifecycle 重置手段

### 1. `edge`

[packages/whiteboard-editor/src/interactions/edge/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/edge/index.ts)
应该变成：

- `owner.start` 负责 connect / reconnect / route / move body
- `owner.observe.move` 负责 hover
- `owner.observe.leave / blur / cancel` 负责清 hover / guide

这是阶段 3 最容易验证的一条线。

因为它能最清楚地体现：

- 同一个 owner 终于真正闭合

### 2. `selection`

[packages/whiteboard-editor/src/interactions/selection.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection.ts)
大概率仍然只有 `start`，暂时不需要 observe。

未来如果要做普通 node hover / selection hover，再加 observe，不需要再改 runtime 结构。

### 3. `draw`

[packages/whiteboard-editor/src/interactions/draw/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/draw/index.ts)
当前也基本只需要 `start`。

### 4. `viewport`

[packages/whiteboard-editor/src/interactions/viewport.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/viewport.ts)
只需要 `start`。

### 5. `insert`

[packages/whiteboard-editor/src/interactions/insert.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/insert.ts)
只需要 `start`。

---

## `composeInput` 与 `router` 的最终形态

## 1. `composeInput`

当前 `composeInput` 同时装配：

- interaction registry
- passive runtime

阶段 3 后应该直接变成：

```ts
const interaction = createInteractionRuntime({
  owners,
  getViewport: ...
})
```

然后交给 router。

也就是说：

- `composeInput` 只装配一个 interaction runtime

## 2. `router`

`router` 应该进一步瘦身成：

1. 归一化 pointer / wheel 输入
2. 写 pointer snapshot
3. 委托给 interaction runtime
4. 只有 wheel fallback 到 viewport 时，router 才知道 viewport

最终 router 不应该再判断：

- busy / idle 怎么分发
- passive 还是 active

这些都应该收回 interaction runtime。

---

## 命名最终建议

为了让这一步真正长期最优，建议顺手做下面这些命名统一。

## 1. 删除“Registration / Registry / Passive”词汇

删除：

- `InteractionRegistration`
- `InteractionRegistry`
- `PassiveInputProcessor`
- `PassiveInputRuntime`
- `PassiveInputContext`

保留：

- `InteractionOwner`
- `InteractionSession`
- `InteractionRuntime`

## 2. `ActiveInteraction` 改名为 `InteractionSession`

这是最重要的命名修正。

因为当前阶段 2 以后，interaction 内部已经是 owner + session 模型了。

外层 runtime 继续叫 `ActiveInteraction`，语义没有对齐。

## 3. `observe` 直接作为 owner 字段

不要再出现：

- `passive`
- `processor`
- `observer runtime`

只保留：

- `owner.observe`

这才符合“owner 是闭合边界”的目标。

---

## 实施顺序

阶段 3 应该按下面顺序一步到位完成。

## 第 1 步：重写 interaction 类型层

修改：

- [packages/whiteboard-editor/src/types/runtime/interaction.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/types/runtime/interaction.ts)

目标：

- `ActiveInteraction` 改为 `InteractionSession`
- `InteractionRegistration` 删除
- `InteractionRegistry` 删除
- `InteractionPointerInput` 删除
- 新增 `InteractionOwner`
- `InteractionCoordinator` 改为 `InteractionRuntime`

## 第 2 步：实现单一 `InteractionRuntime`

新增或改名：

- `packages/whiteboard-editor/src/runtime/interaction/runtime.ts`

目标：

- 内部保留 current session 与 auto pan
- 外部同时处理 `start + observe`
- 内部统一完成 owner priority 调度
- 统一处理 `pointerDown / move / up / cancel / leave / wheel / blur / key`

## 第 3 步：删除双轨 runtime

删除：

- [packages/whiteboard-editor/src/runtime/input/passive.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/input/passive.ts)
- [packages/whiteboard-editor/src/runtime/interaction/registry.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/interaction/registry.ts)

## 第 4 步：改造 `composeInput`

修改：

- [packages/whiteboard-editor/src/runtime/editor/composeInput.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/editor/composeInput.ts)
- [packages/whiteboard-editor/src/runtime/editor/types.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/editor/types.ts)

目标：

- internals 只剩一个 interaction runtime
- 不再有 `interactions + passive` 两套字段

## 第 5 步：改薄 `router`

修改：

- [packages/whiteboard-editor/src/runtime/input/router.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/input/router.ts)

目标：

- 删除 `toInteractionPointerInput(...)`
- 删除 busy/idle 分叉调度
- 所有输入统一调用 interaction runtime
- router 仅在 `wheel` 未被 interaction runtime 处理时 fallback 到 viewport

## 第 6 步：改造各 owner 对外接口

修改：

- [packages/whiteboard-editor/src/interactions/draw/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/draw/index.ts)
- [packages/whiteboard-editor/src/interactions/edge/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/edge/index.ts)
- [packages/whiteboard-editor/src/interactions/insert.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/insert.ts)
- [packages/whiteboard-editor/src/interactions/selection.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection.ts)
- [packages/whiteboard-editor/src/interactions/viewport.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/viewport.ts)

目标：

- 统一返回 `owner`
- `edge hover` 并回 `edge.observe`

## 第 7 步：改造 `assembleInteractions`

修改：

- [packages/whiteboard-editor/src/runtime/editor/assembleInteractions.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/editor/assembleInteractions.ts)

目标：

- 返回 `owners`
- 不再返回 `passive`

## 第 8 步：验证

至少执行：

1. `pnpm -C packages/whiteboard-editor exec tsc --noEmit`
2. `pnpm -C packages/whiteboard-react exec tsc --noEmit`
3. `pnpm -C packages/whiteboard-editor build`
4. `pnpm -C packages/whiteboard-react build`

然后手工检查至少这些行为：

1. `edge` 工具 hover guide 是否正常
2. `edge` body shift/double click insert route 是否正常
3. `selection` press -> marquee / drag / transform 是否正常
4. `draw` stroke / erase 是否正常
5. `viewport` 拖拽与 wheel 是否正常
6. `blur / cancel / leave` 后 hover / guide 是否无残留

---

## 这一步完成后的收益

阶段 3 做完之后，interaction 这条线会出现三个明显变化。

### 1. owner 真正成为唯一边界

以后不会再有这种情况：

- 逻辑上属于 `edge`
- 对外却要拆成 `interaction + passive`

### 2. runtime 主轴真正变直

从：

- router
- composeInput
- registry
- passive runtime
- coordinator

变成：

- router
- interaction runtime
- owner
- session

### 3. 后续功能扩展会更自然

以后如果新增：

- node hover
- selection hover
- insert preview
- tool specific wheel behavior

都只需要加到对应 owner 的 `observe` 里。

不需要再扩一个并列 runtime。

---

## 最终结论

阶段 3 应该做，而且必须做。

它不是“又一次重构 runtime 命名”，而是把阶段 2 已经建立起来的：

- `owner + session`

真正推进到 runtime 外壳上。

这一步完成之后，whiteboard-editor 的 interaction 线才算真正对齐为：

- `InteractionCtx`
- `InteractionOwner`
- `InteractionSession`
- `InteractionRuntime`

这才是长期最优，而且不会过度设计。
