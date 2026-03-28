# Whiteboard Pointer -> Interaction / Selection 最简设计说明

## 1. 文档目标

这份文档回答一个更准确的问题：

- 在 `pointerdown` 发生之后，系统应该用什么**最少概念**来完成交互路由与 selection 处理

这里的“最简设计”强调的是：

1. 公共概念尽量少
2. 全局层只做路由，不做 feature 内部计划
3. 所有交互分支是平行关系，而不是嵌套层级
4. `hold` 的语义固定，不再做成泛化策略

本文覆盖的直接相关文件：

- `packages/whiteboard-editor/src/runtime/input/pointer.ts`
- `packages/whiteboard-editor/src/runtime/selection/state.ts`
- `packages/whiteboard-editor/src/runtime/selection/policy.ts`
- `packages/whiteboard-editor/src/features/selection/gesture.ts`
- `packages/whiteboard-editor/src/runtime/instance/createInstance.ts`
- `packages/whiteboard-react/src/canvas/useCanvasDown.ts`

---

## 2. 修订后的最终结论

这条链路最简的设计，不应该是：

- 全局先得到一个 `selection` 分支
- 然后在公共层继续展开 `SelectionDecision`
- 再把 `tap / drag / hold` 作为一套公共交互模型继续往下传

这会让概念层级变成：

- 全局交互决策
- selection 专属决策
- selection 专属动作

层数还是偏多。

更准确的最简设计应该是：

## 2.1 公共层只保留两个交互概念

1. `InteractionStart`
2. `InteractionDecision`

也就是说：

- 全局输入统一成一个 `InteractionStart`
- 全局输出统一成一个 `InteractionDecision`

## 2.2 selection 领域只保留两个状态概念

1. `SelectionTarget`
2. `SelectionSnapshot`

也就是说：

- selection 的持久状态只有 `SelectionTarget`
- selection 的只读派生只有 `SelectionSnapshot`

## 2.3 selection 不再公开自己的 decision 模型

也就是说，不再把下面这些当成公共概念继续扩散：

- `SelectionDecision`
- `SelectionAction`
- `SelectionPressContext`
- `SelectionPressSelection`
- `SelectionPressTarget`
- `SelectionPressIntent`
- `SelectionPressPlan`
- `SelectionTapMatch`

selection 如果内部还需要一个 press plan，它也应该只是：

- selection 模块内部的局部实现细节

不应成为系统公共交互模型的一部分。

## 2.4 `hold` 不再是公共决策分支

`hold` 的语义应该固定，而且明确：

- `clear selection`
- `contain marquee`

也就是说，`hold` 在 selection 内部只是一个布尔开关：

- 是否允许触发固定的 hold fallback

而不是：

- 一种可组合的 action
- 一种和 `tap / drag` 对称的公共决策分支

---

## 3. 最小公共模型

## 3.1 `InteractionStart`

全局输入应该统一成一个对象。

建议名称：

```ts
type InteractionStart = {
  container: HTMLDivElement
  event: PointerEvent
  capture: Element
  point: {
    client: Point
    screen: Point
    world: Point
  }
  pick: PointerPick
  tool: Tool
  frame: FrameScope
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
}
```

这个对象只包含一类信息：

- 事件发生当下，已经确定的事实

应该放进去的：

- 原始 event
- pointer 坐标
- pick 结果
- 当前 tool
- 当前 frame scope
- 是否 editable
- 是否 ignore input / selection

不应该放进去的：

- selection plan
- move frame
- tap match
- marquee base
- hold policy
- 任何 feature 专属中间计算结果

一句话概括：

`InteractionStart` 是**事实输入**，不是**解释结果**。

## 3.2 `InteractionDecision`

全局决策模型只做一件事：

- 回答这次起始点应该交给谁处理

建议结构：

```ts
type InteractionDecision =
  | { kind: 'reject' }
  | { kind: 'selection'; start: InteractionStart }
  | { kind: 'transform'; start: InteractionStart }
  | { kind: 'edge-create'; start: InteractionStart }
  | { kind: 'edge'; start: InteractionStart }
  | { kind: 'mindmap'; start: InteractionStart }
  | { kind: 'draw'; start: InteractionStart }
  | { kind: 'erase'; start: InteractionStart }
  | { kind: 'insert'; start: InteractionStart }
```

这里最重要的不是 union 本身，而是两个原则：

1. 所有分支都拿同一个 `start`
2. 所有分支都是平行的

也就是说：

- `selection`
- `edge`
- `transform`
- `mindmap`
- `draw`
- `insert`

都只是“拿到同一个起始点以后，交给各自模块”。

这和当前 `EdgeDown / TransformDown / GestureDown / MindmapDown` 这类一串公共输入类型相比，概念面会小很多。

## 3.3 `SelectionTarget`

`SelectionTarget` 是唯一的持久选中状态：

```ts
type SelectionTarget = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}
```

职责：

- 存在于 `editor.state.selection`
- 被 `commands.selection.*` 写入
- 只表达“选中了谁”

不表达：

- 当前 box 是多少
- 是否可 resize
- 当前 pointerdown 后应该执行什么动作

## 3.4 `SelectionSnapshot`

`SelectionSnapshot` 是唯一的 selection 只读派生结果：

```ts
type SelectionSnapshot = {
  kind: 'none' | 'node' | 'nodes' | 'edge' | 'edges' | 'mixed'
  target: {
    nodeIds: readonly NodeId[]
    nodeSet: ReadonlySet<NodeId>
    edgeIds: readonly EdgeId[]
    edgeSet: ReadonlySet<EdgeId>
    edgeId?: EdgeId
  }
  items: {
    nodes: readonly Node[]
    edges: readonly Edge[]
    primaryNode?: Node
    primaryEdge?: Edge
    count: number
    nodeCount: number
    edgeCount: number
  }
  transform: {
    move: boolean
    resize: 'none' | 'resize' | 'scale'
  }
  box?: Rect
  boxInteractive: boolean
}
```

这里要明确一件事：

- `boxInteractive` 应该直接成为 snapshot 的字段

不要再让别的层各自调用：

- `isSelectionBoxInteractive(...)`

因为它本质上就是 selection 快照的一部分。

---

## 4. 全局层与领域层的职责边界

## 4.1 全局层只做路由

全局交互层只负责：

1. 读取起点
2. 做最小必要的 gating
3. 决定交给哪个 feature

也就是说，全局层只应该回答：

- 这次按下是 `selection`
- 还是 `edge`
- 还是 `transform`
- 还是 `mindmap`
- 还是直接 `reject`

全局层不应该继续回答：

- selection 里是 tap 还是 drag
- selection 是否允许 hold
- tap 之后是 select 还是 edit
- drag 之后是 move 还是 marquee

这些都应该留在 selection 内部。

## 4.2 selection / edge / transform / mindmap 是平行分支

这是这次修订最关键的点。

正确关系应该是：

```ts
InteractionDecision
  -> selection.down(start)
  -> edge.down(start)
  -> transform.down(start)
  -> mindmap.down(start)
  -> draw.down(start)
  -> insert.down(start)
```

而不是：

```ts
InteractionDecision
  -> selection decision
  -> selection action
```

前者是平行路由。
后者是全局层嵌套领域层。

为了概念最少，应该选前者。

## 4.3 模块内部可以有局部窄化，但不要继续公开一堆 `XxxDown`

全局层统一输入，不等于每个模块都直接裸用宽对象写一堆 `if`。

更合理的方式是：

- 公共层：只有 `InteractionStart`
- 模块内部：允许有私有 guard / narrow helper

例如 `transform` 内部可以有：

```ts
const isTransformStart = (start: InteractionStart) => (
  start.tool.type === 'select'
  && (start.pick.kind === 'node' || start.pick.kind === 'selection-box')
  && start.pick.part === 'transform'
  && Boolean(start.pick.handle)
)
```

但这个窄化结果不需要再作为公共导出类型：

- 不必继续公开 `TransformDown`
- 不必继续公开 `EdgeDown`
- 不必继续公开 `GestureDown`

这些更适合作为模块内部实现工具，而不是系统级交互概念。

---

## 5. 最简事件流

## 5.1 全局流

最简事件流应该是：

```ts
pointerdown
  -> readInteractionStart
  -> resolveInteractionDecision
  -> dispatchInteractionDecision
  -> feature.down(start)
```

这条链里，全局层只有两个对象：

1. `InteractionStart`
2. `InteractionDecision`

这已经足够。

## 5.2 selection 流

selection 一旦接管后，内部流程应该是：

```ts
selection.down(start)
  -> read selection snapshot
  -> resolve selection press plan
  -> press.start(...)
  -> run tap / drag
  -> onHold: clear selection + contain marquee
```

这里要注意：

- `resolve selection press plan` 只是 selection 内部的局部实现步骤
- 它不再是一个系统公共模型

所以 selection 内部如果还要保留一个 plan，建议只是局部类型，例如：

```ts
type SelectionPressPlan = {
  chrome: boolean
  tap?: SelectionTapAction
  drag?: SelectionDragAction
  allowHold: boolean
}
```

它的定位应该很明确：

- 这是 `selection.down(...)` 的内部局部计划
- 不是对外导出的统一交互概念

## 5.3 `hold` 的固定语义

`hold` 必须彻底做简单。

明确规则：

- `hold` 不继承 modifier
- `hold` 不继承当前 selection
- `hold` 不参与 add/toggle/subtract
- `hold` 不再抽象成通用 action

`hold` 唯一语义就是：

```ts
commands.selection.clear()
startMarquee({
  match: 'contain',
  mode: 'replace',
  base: EMPTY_SELECTION
})
```

所以在 selection 内部，它更像：

```ts
allowHold: boolean
```

而不是：

```ts
hold?: SomePublicDecisionBranch
```

这一步会极大降低 selection press 模型的概念复杂度。

---

## 6. 对当前公共概念的删减建议

为了达到这版最简设计，建议删除或下沉下面这些概念。

## 6.1 删除公共 `SelectionDecision`

原因：

- 它会让全局层和 selection 层形成嵌套决策模型
- 会让 `selection` 看起来比其他 feature 多一层公共协议

selection 如果还需要 decision，它也应该只是模块内部局部类型。

## 6.2 删除公共 `SelectionAction`

原因：

- `SelectionAction` 对 selection 内部执行是有用的
- 但把它升格成公共模型没有必要

如果保留，也应该只保留在 selection 模块内部。

## 6.3 删除 `SelectionPressContext / SelectionPressSelection / SelectionPressTarget / SelectionTapMatch`

原因：

- 这些都是 selection press 内部的中间解释结果
- 它们不应该泄漏到系统公共层

其中最明显的是：

- `SelectionPressSelection` 和 `SelectionTarget / SelectionSnapshot` 高度重叠
- `SelectionTapMatch` 只是 tap 验证信息
- `SelectionPressTarget` 只是 pointer 命中解释

这三类东西都更适合作为 `selection.down(...)` 内部局部变量。

## 6.4 删除 `host.selection.planPress`

这是一条典型的回绕链：

- `gesture.down`
- `host.selection.planPress`
- `policy.ts`
- 再回 `gesture`

最简设计下应当直接变成：

- `selection.down(start)`
- selection 内部自己计划
- selection 内部自己执行

所以：

- `host` 不应再暴露 `planPress`

## 6.5 删除公共 `XxxDown` 输入家族

建议不再把下面这些继续作为系统公共输入模型：

- `EdgeCreateDown`
- `DrawDown`
- `EraserDown`
- `InsertDown`
- `TransformDown`
- `EdgeDown`
- `MindmapDown`
- `GestureDown`

全局层只保留：

- `InteractionStart`

模块内部如果需要窄化，可以自行定义私有 helper。

---

## 7. 建议的模块落点

## 7.1 `runtime/input/pointer.ts`

建议逐步收成三个主入口：

```ts
readInteractionStart(...)
resolveInteractionDecision(...)
dispatchInteractionDecision(...)
```

职责分别是：

- `readInteractionStart`
  读取起点并补齐 frame / tool / pick / flags
- `resolveInteractionDecision`
  只做归属决策
- `dispatchInteractionDecision`
  调用对应 feature 的 `down(start)`

## 7.2 `runtime/selection/state.ts`

只负责：

- `SelectionTarget`
- `SelectionSnapshot`
- normalize / equality / resolve

并且把：

- `boxInteractive`

直接收进 `SelectionSnapshot`。

## 7.3 `runtime/selection/press.ts`

如果保留一个 selection press 纯逻辑文件，建议它的定位是：

- selection 内部私有 press 规划器

它只被 `selection.down(...)` 使用。

不建议继续用 `policy.ts` 这种泛名字，也不建议继续对外公开一堆 press 中间模型。

## 7.4 `features/selection/gesture.ts`

这个文件的长期角色应该非常明确：

- 接收 `start`
- 读取 `SelectionSnapshot`
- 解析局部 press plan
- 启动 `press runtime`
- 执行 tap / drag
- 在 `onHold` 时固定执行 `clear + contain marquee`

它不再负责：

- 构造公共交互模型
- 通过 host 调 planner
- 向系统暴露 selection 专属 decision 类型

---

## 8. 推荐伪代码

## 8.1 全局层

```ts
const start = readInteractionStart(instance, container, event)
const decision = resolveInteractionDecision(instance, start)

switch (decision.kind) {
  case 'selection':
    return selection.down(decision.start)
  case 'transform':
    return transform.down(decision.start)
  case 'edge-create':
    return edge.create(decision.start)
  case 'edge':
    return edge.down(decision.start)
  case 'mindmap':
    return mindmap.down(decision.start)
  case 'draw':
    return draw.down(decision.start)
  case 'erase':
    return eraser.down(decision.start)
  case 'insert':
    return insert.down(decision.start)
  case 'reject':
    return false
}
```

## 8.2 selection 内部

```ts
const down = (start: InteractionStart) => {
  const snapshot = instance.read.selection.get()
  const plan = resolveSelectionPressPlan({
    start,
    snapshot,
    getNode,
    getOwnerId,
    getNodeFrame,
    getNodeRole
  })

  if (!plan) {
    return false
  }

  return press.start({
    chrome: plan.chrome,
    onTap: plan.tap
      ? (event) => runTap(plan.tap!, event)
      : undefined,
    onDragStart: plan.drag
      ? (event) => runDrag(plan.drag!, event)
      : undefined,
    onHold: plan.allowHold
      ? () => {
          instance.commands.selection.clear()
          startContainMarquee(start)
        }
      : undefined
  })
}
```

这段伪代码刻意表达三件事：

1. selection 拿的是统一的 `InteractionStart`
2. selection 内部 plan 只是局部实现
3. `hold` 永远固定为 `clear + contain marquee`

---

## 9. 为什么这是更准确的“最简”

如果只看 selection 自己，公开一个 `SelectionDecision` 好像也不算太复杂。

但一旦放回整条交互链里，就会产生一个问题：

- `selection` 比其他 feature 多了一层公共协议

这会带来两个后果：

1. 全局模型不对称
   `edge / transform / mindmap` 是“交给模块”
   `selection` 却变成“交给 selection decision 再交给模块”
2. 公共概念被 selection 内部实现反向牵引
   系统会逐渐围绕 selection press 模型长出更多专属类型

所以真正最简的公共模型应该是：

- `InteractionStart`
- `InteractionDecision`
- `SelectionTarget`
- `SelectionSnapshot`

其中：

- 前两个属于全局交互层
- 后两个属于 selection 状态层

selection 的 press plan 不再升格成公共协议。

---

## 10. 迁移顺序

如果要从当前实现迁到这版模型，建议按下面顺序来。

## Step 1：先统一公共输入

目标：

- 把 `CanvasDown / EdgeDown / GestureDown / TransformDown ...` 逐步收成一个公共 `InteractionStart`

注意：

- 模块内部暂时可以继续保留窄化 helper
- 但不再新增新的公共 `XxxDown`

## Step 2：建立统一交互决策

目标：

- 在 `pointer.ts` 中建立 `resolveInteractionDecision(...)`

它只负责：

- route
- gate
- frame normalize

不负责：

- selection 领域计划

## Step 3：把 selection 计划彻底下沉到 selection 内部

目标：

- 删除 `host.selection.planPress`
- 让 `selection.down(start)` 自己读取 snapshot、自己决定 tap/drag/allowHold

## Step 4：把 `hold` 做死

目标：

- `hold` 不再参与 generic intent / decision 模型
- `hold` 永远固定为 `clear selection + contain marquee`

## Step 5：收掉多余公共 press 概念

目标：

- 删除 `SelectionPressContext`
- 删除 `SelectionPressSelection`
- 删除 `SelectionPressTarget`
- 删除 `SelectionTapMatch`
- 删除公共 `SelectionDecision / SelectionAction`

如果 selection 内部还需要局部类型，可以保留在内部文件里。

---

## 11. 最终判断

这次修订后的结论可以压成一句话：

**全局层只保留 `InteractionStart -> InteractionDecision`，所有 feature 都以同一个起始点平行接管；selection 内部不再公开自己的 decision 模型，`hold` 永远固定为 `clear selection + contain marquee`。**

对当前仓库来说，这就是 `pointer -> selection` 以及整条 pointer interaction 链最少概念、最少回绕、最容易长期维护的设计。
