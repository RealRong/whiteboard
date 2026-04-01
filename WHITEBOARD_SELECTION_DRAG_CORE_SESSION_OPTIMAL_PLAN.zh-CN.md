# WHITEBOARD_SELECTION_DRAG_CORE_SESSION_OPTIMAL_PLAN.zh-CN

## 结论

如果允许改 `whiteboard-core`，那么
`packages/whiteboard-editor/src/interactions/selection/drag.ts`
这条线的长期最优，不是继续在 editor 内部做瘦身，而是：

- 把“节点拖拽会话”整体下沉到 `whiteboard-core`
- `selection press` 只产出最小的拖拽意图
- `editor` 只负责读取输入、提供 snap、映射 overlay、派发 commands

也就是说，长期最优不是：

- 继续把 `drag.ts` 切成更多 helper
- 继续把 editor 里的 `NodeDragState / NodeDragStart / NodeDragInput` 改名
- 继续做 `compute / apply / project` 这一类中间胶水

而是：

- **把 move session 变成 core 的一等模型**

这是这条线真正能降复杂度、降传参、降中间层、增强可读性的做法。

---

## 为什么现在的 `selection/drag.ts` 读起来还是重

当前文件的复杂度，不主要来自拖拽业务本身，而来自 editor 在承担本不该由它承担的“会话构建职责”。

现在的 `drag.ts` 同时在做这些事：

- 从 selection target 推导真正要移动的节点集
- 读取全量 nodes，构建 `MoveSet`
- 计算拖拽原点与 frame size
- 分类 selected edges 与 related edges
- 读取 pointer world
- 调用 snap
- 计算 delta
- 调 core preview 算法
- 把 preview 再映射成 overlay patch
- pointer up 时再把 delta 和 edge patch 重新翻译成 command

这导致它出现了多层中间形状：

- `NodeDragInput`
- `NodeDragStart`
- `NodeDragState`
- `computeNodeDragProjection(...)`
- `applyNodeDragProjection(...)`
- `projectNodeDragPreview(...)`

这些对象和 helper 并不是产品层真正稳定的概念。

它们只是 editor 为了把“一个拖拽过程”拼出来，不得不临时制造出来的装配层。

问题不在于这些 helper 写得差。

问题在于：

- **editor 本来就不该拥有这条会话主逻辑**

---

## 当前复杂度的根源

把根因讲清楚很重要，否则后续还会回到“继续拆 helper”的老路。

### 1. move 还不是稳定中轴，只是零散工具函数

现在 `whiteboard-core/src/node/move.ts` 已经有很好的基础能力：

- `buildMoveSet`
- `projectMovePositions`
- `resolveMoveEffect`
- `projectMovePreview`
- `buildMoveCommit`

但它们仍然停留在“低层工具函数”层面。

缺的不是更多 helper。

缺的是：

- 一个完整、可连续 step 的 `move session`

于是 editor 只能自己补上：

- session state
- pointer delta
- bounds/origin
- edge 分类
- snap 输入组织
- commit 组织

也就是现在 `drag.ts` 里的那一坨。

### 2. `SelectionDragAction` 携带了太多 editor 时代的形状

当前 `SelectionDragAction['move']` 里有：

- `frame`
- `anchorId`
- `target`
- `nextSelection?`

这不是长期最优。

这里面只有一部分是真正稳定的交互语义，另一部分只是旧 editor 装配链的中间产物。

其中最典型的是：

- `frame`

`frame` 本质上是“拖拽会话启动时的几何快照”。
它应该由 move session 在启动阶段自己从 nodes 推导，而不是由 `selection press` 预先塞进去。

`selection press` 的职责是决定：

- 按下后要不要改 selection
- 这是 move 还是 marquee

它不应该承担：

- 提前替 move session 组织几何输入

### 3. editor 里仍然存在“算法输入形状”和“overlay 形状”的混杂

当前 `drag.ts` 同时维护三类信息：

- core 算法输入
- editor session 状态
- overlay 映射结果

这三类信息的生命周期并不一致。

把它们揉在一个文件里，结果就是：

- 一眼看不出哪部分是纯业务
- 哪部分是纯输入
- 哪部分是纯显示

长期最优应该是：

- core 会话负责纯拖拽推导
- editor 负责 UI runtime 接线

### 4. `tool.is('select')` 这种判断不该继续混在 move 热路径里

当前 snap 调用里有：

- `disabled: !ctx.read.tool.is('select')`

这说明“拖拽逻辑”和“当前 owner 是否启用 snap”还没完全对齐。

长期最优里，move session 不应该知道什么是 `tool`。

它只应该接收：

- 当前 step 是否启用 snap
- 若启用，snap resolver 是什么

这类能力开关应该由 owner 决定，而不是塞进算法内部。

---

## 长期最优：move session 下沉到 core

最终应该把这条线改成下面的分工。

### `whiteboard-core` 负责

- 根据 selection target 构建 move members
- 计算 root ids / member ids / member positions
- 计算拖拽基准 bounds
- 在 step 时根据 pointer world 计算 raw delta
- 调用外部注入的 snap resolver
- 产出 preview effect
- 产出 commit effect

### `whiteboard-editor` 负责

- 读取 pointer 输入并做 client/world 转换
- 提供 node/edge 快照给 core session
- 提供 snap resolver 给 core session
- 把 preview effect 映射到 overlay
- 在 pointer up 时把 commit effect 派发为 commands
- 做 selection replace 这一类 editor command 副作用

### `selection press` 负责

- 根据按下目标和 modifier，决定：
  - 是 `move`
  - 还是 `marquee`
- 如果是 `move`，返回最小的 move intent
- 如果按下前需要切 selection，给出 `prepareSelection`

### overlay 负责

- 只保存临时显示状态
- 不再参与任何 move session 推导

---

## `SelectionDragAction` 的长期最优形状

当前 `move` action 带的信息太重。

长期最优里，它应该只表达：

- 要拖谁
- 拖之前是否需要切 selection

也就是：

```ts
type SelectionDragAction =
  | {
      kind: 'move'
      target: SelectionTarget
      prepareSelection?: SelectionTarget
    }
  | {
      kind: 'marquee'
      match: 'touch' | 'contain'
      mode: SelectionMode
      base: SelectionTarget
    }
```

这里明确去掉：

- `frame`
- `anchorId`

原因很直接。

### `frame` 不该存在

拖拽 frame 是 move session 自己的启动几何数据，不是 press 语义。

把它放在 `SelectionDragAction` 里，等于把 session 内部状态提前泄漏到了 policy 层。

### `anchorId` 大多数情况下也不该存在

如果 `target` 已经准确表达“当前要移动的 selection target”，那 move session 就不需要再依赖 `anchorId` 去补齐 ids。

长期最优应该是：

- `press` 产出完整 target
- `move session` 只消费 target

如果未来某类交互真的需要 `anchorId`，那也应该把它放进特定 interaction 的私有输入，而不是把它做成通用 move 语义的一部分。

---

## core move session 的最终 API

长期最优不需要在 core 里再造一个重型 OO runtime。

也不需要搞一套新的 framework。

最简单的做法是：

- 一组围绕 session state 的纯函数

建议 API 形态如下：

```ts
type MoveIntent = {
  target: SelectionTarget
}

type MoveSession = {
  target: SelectionTarget
  move: MoveSet
  origin: Point
  bounds: Rect
  startWorld: Point
  delta: Point
  selectedEdges: readonly Edge[]
  relatedEdges: readonly Edge[]
}

type MoveSnapResolver = (input: {
  rect: Rect
  excludeIds: readonly NodeId[]
  allowCross: boolean
}) => {
  rect: Rect
  guides: readonly Guide[]
}

type MoveStepResult = {
  session: MoveSession
  preview: MoveEffect
  guides: readonly Guide[]
}

declare function startMoveSession(input: {
  nodes: readonly Node[]
  edges: readonly Edge[]
  intent: MoveIntent
  startWorld: Point
  nodeSize: Size
}): MoveSession | null

declare function stepMoveSession(input: {
  session: MoveSession
  pointerWorld: Point
  nodeSize: Size
  allowCross: boolean
  snap?: MoveSnapResolver
}): MoveStepResult

declare function finishMoveSession(session: MoveSession): MoveCommit
```

这个 API 的关键点是：

- `session` 只保存真正需要跨 step 复用的数据
- `step` 接收当前 pointer world 和当前 step 的能力开关
- `snap` 是注入能力，不是 session 内建依赖
- `finish` 不再重新组织输入，只消费 session

这比当前 editor 的做法简单得多，因为它把“拖拽过程”的主模型收敛成了一个真正稳定的 domain 概念。

---

## 为什么这是最简单的形式

这里需要强调，最简单不等于最少函数数。

最简单是：

- 一个稳定 session
- 两个稳定阶段函数
- 一个稳定 commit 函数

也就是：

- `startMoveSession`
- `stepMoveSession`
- `finishMoveSession`

而不是现在这种：

- editor 自己造 state
- editor 自己造 projection
- editor 自己造 commit input
- core 只提供零散工具函数

后者表面上函数也不多，但职责边界是错的，所以总复杂度更高。

---

## `startMoveSession(...)` 里应该做什么

`startMoveSession(...)` 应该一次性把下面这些工作做完：

- 基于 `intent.target.nodeIds` 构建 `MoveSet`
- 过滤 root ids
- 展开 group/frame 成员
- 计算 move bounds
- 记录 `startWorld`
- 记录 `origin`
- 记录 `selectedEdges`
- 记录 `relatedEdges`
- 初始化 `delta = { x: 0, y: 0 }`

也就是说，当前 editor 里 `gatherNodeDragState(...)` 做的事情，本质上应该进入 core。

只要这一步下沉成功，editor `drag.ts` 会立刻薄一大截。

---

## `stepMoveSession(...)` 里应该做什么

`stepMoveSession(...)` 是整条链路的核心。

它应该做：

1. 根据 `pointerWorld - startWorld` 计算 raw position
2. 根据 `origin + delta` 计算 raw rect
3. 如果有 `snap`，调用 snap resolver
4. 根据最终 rect 反推最终 delta
5. 基于 delta 计算 preview
6. 返回新的 session 与 preview/guides

对应的伪代码应接近：

```ts
const nextRect = snap
  ? snap({
      rect: rawRect,
      excludeIds: session.move.members.map((member) => member.id),
      allowCross
    }).rect
  : rawRect

const delta = {
  x: nextRect.x - session.origin.x,
  y: nextRect.y - session.origin.y
}

const preview = projectMovePreview({
  nodes: sessionNodes,
  relatedEdges: session.relatedEdges,
  selectedEdges: session.selectedEdges,
  move: session.move,
  delta,
  nodeSize
})
```

这里最重要的一点是：

- `allowCross` 作为 step 输入，而不是 session 主体的一部分

这是因为它本质上是当前 step 的修饰条件，不是拖拽会话本身的身份。

这能直接消掉当前 `state.allowCross = next.modifiers.alt` 这类别扭更新。

---

## `finishMoveSession(...)` 里应该做什么

`finishMoveSession(...)` 不应该再重新读取外部数据。

它只应该基于 session 的最终 delta 得出 commit：

```ts
declare function finishMoveSession(
  session: MoveSession
): MoveCommit
```

内部只做两件事：

- 如果 delta 为零，不返回 node move delta
- 如果有 selected edges，根据 delta 生成 edge patch

这样 commit 阶段就非常直接：

- editor 不再重新组装 delta
- editor 不再知道 selected edge patch 该怎么推导

---

## 是否需要 `cancelMoveSession(...)`

不需要专门为了对称性再做一个 API。

原因很简单：

- cancel 不产生 domain commit
- cleanup 是 editor runtime 的责任

也就是说：

- `cleanup overlay`
- `结束 interaction session`

这些都不属于 core move domain。

所以长期最优里只保留：

- `start`
- `step`
- `finish`

不要为了形式工整再引入一个无意义的 `cancel`。

---

## editor 侧最终应该薄成什么样子

`packages/whiteboard-editor/src/interactions/selection/drag.ts`
最终应该只是一个很薄的 adapter。

它的职责只剩：

1. 从 `ctx.read` 读取 nodes/edges 快照
2. 如果需要，先 `ctx.commands.selection.replace(...)`
3. 用 `startMoveSession(...)` 启动 core session
4. 在 `move` / `autoPan.frame` 里做：
   - pointer -> world
   - step session
   - 写 overlay
5. 在 `up` 里：
   - `finishMoveSession(...)`
   - 派发 node / edge commands
6. 在 `cleanup` 里清空 overlay slice

伪代码应接近：

```ts
const session = startMoveSession({
  nodes: ctx.read.index.node.all().map((entry) => entry.node),
  edges: ctx.read.index.edge.all().map((entry) => entry.edge),
  intent: {
    target: action.target
  },
  startWorld: input.start.world,
  nodeSize: ctx.config.nodeSize
})

if (!session) return null

if (action.prepareSelection) {
  ctx.commands.selection.replace(action.prepareSelection)
}

const project = (pointerWorld: Point, allowCross: boolean) => {
  const result = stepMoveSession({
    session,
    pointerWorld,
    nodeSize: ctx.config.nodeSize,
    allowCross,
    snap: ({ rect, excludeIds, allowCross }) =>
      ctx.snap.node.move({
        rect,
        excludeIds,
        allowCross
      })
  })
  session = result.session
  writeMoveOverlay(ctx.overlay, result.preview, result.guides)
}

return {
  move: (next) => {
    project(readViewport(ctx).pointer(next).world, next.modifiers.alt)
  },
  up: () => {
    const commit = finishMoveSession(session)
    applyMoveCommit(ctx.commands, action.target, commit)
  },
  cleanup: () => {
    clearMoveOverlay(ctx.overlay)
  }
}
```

上面这个形态，才是 editor 该有的复杂度级别。

---

## overlay 在这条线里的最小职责

overlay 不应该再参与任何 move 推导。

它只负责承载 step 结果。

这条线里最小化后的 overlay 写入应只有两类：

- node selection overlay
- edge selection overlay
- snap guides

也就是：

- `preview.nodes -> node.selection.patches`
- `preview.hovered -> node.selection.hovered`
- `preview.edges -> edge.selection`
- `guides -> guides.snap`

overlay 不应该知道：

- move set 怎么来的
- raw delta 怎么算
- selected edges 和 related edges 怎么分

这些都应该在 core session 里结束。

---

## commands 在这条线里的最小职责

commands 只负责最终写入，不负责推导。

因此 `selection drag` 的 commit 阶段应该只有：

- `commands.node.move({ ids, delta })`
- `commands.edge.updateMany(edges)`

其中：

- `ids` 来自 `action.target.nodeIds`
- `delta` 与 `edges` 来自 `finishMoveSession(...)`

也就是说，commit 阶段只做“纯派发”。

如果 commit 阶段还要重新读取 nodes/edges 或重新做分类，那说明 session 设计还不够完整。

---

## `whiteboard-core` 内部应该如何收敛

长期最优不是在 `move.ts` 旁边继续堆更多零散 helper。

更好的组织方式是：

- `move.ts` 保留底层纯算法工具
- 新增 `moveSession.ts` 承载会话 API

建议分层如下。

### `move.ts`

保留这些可复用的低层能力：

- `buildMoveSet`
- `projectMovePositions`
- `resolveMoveEffect`
- `projectMovePreview`
- `buildMoveCommit`

### `moveSession.ts`

新增这些真正给 editor 消费的高层 API：

- `startMoveSession`
- `stepMoveSession`
- `finishMoveSession`
- `MoveIntent`
- `MoveSession`
- `MoveStepResult`
- `MoveSnapResolver`

这样一来：

- 低层算法仍可独立复用
- editor 不再直接拼装低层算法
- 核心会话能力有了稳定出口

这才是清晰的 core 对外模型。

---

## `selection press` 应该如何配合收敛

`selection press` 这条线也要顺手对齐，否则 move session 下沉后，上游还是会继续泄漏旧形状。

最终应做这两件事。

### 1. 把 `nextSelection` 改名为 `prepareSelection`

原因是 `nextSelection` 这个名字太偏“状态结果”，不够准确。

这里真正的意思是：

- 开始 move 之前，需要先把 selection 切到某个 target

所以更准确的命名应是：

- `prepareSelection`

### 2. `press` 不再返回 `frame`

`press` 只返回交互意图，不再返回拖拽几何预计算结果。

这样 `press` 的职责就会稳定很多：

- 它是 selection policy
- 不是 move session pre-builder

---

## 实施后，`selection/drag.ts` 会删掉什么

按这个方案落地后，当前 `drag.ts` 里这些东西都应该消失：

- `NodeDragState`
- `NodeDragStart`
- `NodeDragInput` 里的 `frame`
- `gatherNodeDragState(...)`
- `computeNodeDragProjection(...)`
- `applyNodeDragProjection(...)`
- `projectNodeDragPreview(...)`

保留下来的只应该是：

- 一个很薄的 interaction adapter
- overlay 映射
- command 派发

这会直接让文件的阅读路径从：

- “先理解一堆中间状态，再理解 move”

变成：

- “启动 session -> step -> overlay -> finish”

这才符合长期最优的可读性。

---

## 一步到位的最终改造方案

这次不考虑兼容和过渡，应该直接按最终形态改。

### 第 1 步

在 `whiteboard-core/src/node` 新增 `moveSession.ts`。

新增：

- `MoveIntent`
- `MoveSession`
- `MoveSnapResolver`
- `MoveStepResult`
- `startMoveSession`
- `stepMoveSession`
- `finishMoveSession`

### 第 2 步

把 `MoveSession` 需要的低层逻辑从 editor 搬进 core：

- move bounds 计算
- selected / related edges 分类
- session origin 初始化
- delta 更新

### 第 3 步

调整 `whiteboard-core/src/selection/press.ts` 的 `SelectionDragAction`：

- 删除 `frame`
- 删除 `anchorId`
- `nextSelection` 改为 `prepareSelection`

### 第 4 步

调整 `whiteboard-core/src/selection` 的公开导出，使 `move` action 只暴露最小 intent 语义。

### 第 5 步

重写
`packages/whiteboard-editor/src/interactions/selection/drag.ts`
为薄 adapter：

- 读 snapshot
- 启动 core session
- step 时写 overlay
- finish 时派发 commands

### 第 6 步

清理 editor 内所有只为旧 drag session 服务的中间类型和 helper。

### 第 7 步

检查 `selection/press.ts` 与 `selection/index.ts`，确保它们不再依赖任何 `frame` 风格的旧输入。

---

## 这次改造的边界

为了避免再次过度设计，这个方案明确不做下面这些事。

### 1. 不把 snap 也做成 core 内建 runtime

snap 的查询依赖 editor/engine 的空间索引。

因此长期最优不是把 snap 查询强行塞进 core，
而是：

- core 定义 snap resolver 接口
- editor 注入具体实现

### 2. 不把 overlay 逻辑下沉到 core

overlay 是 editor 的 UI runtime 状态，不是 domain。

core 只产出 preview effect，不知道 overlay slice。

### 3. 不在 move session 里引入多余生命周期方法

不需要：

- `pause`
- `resume`
- `cancel`
- `dispose`

这些都不是当前 domain 真需求。

### 4. 不为“以后可能会有别的拖拽”提前抽象总线

先把 node move 这条线做直。

如果后续 transform、mindmap drag 也证明能抽成同类 session，再分别下沉。

不要一开始就造泛化拖拽框架。

---

## 为什么这是“允许动 core”后的最优路线

因为它不是把复杂度转移到新的中间层，而是把复杂度放回它真正所属的 domain。

当前复杂度错位在这里：

- `editor` 在维护 move domain session

最终应该变成：

- `core` 维护 move domain session
- `editor` 维护 interaction runtime 与 UI overlay

这样之后：

- `selection/drag.ts` 会明显变短
- `SelectionDragAction` 会明显变干净
- 传参会明显减少
- 会话主线会变成真正可读的 `start -> step -> finish`
- 后续若要把 transform / edge reconnect / draw stroke 继续下沉，也会有统一参考

这不是“为了漂亮”而重构。

这是这条线真正能降系统复杂度的唯一正确方向。

---

## 最终状态检查标准

当这条线改到长期最优后，应满足下面这些标准。

### editor 侧

- `selection/drag.ts` 不再定义 drag state 结构
- `selection/drag.ts` 不再做 move set 构建
- `selection/drag.ts` 不再做 edge 分类
- `selection/drag.ts` 不再持有 `frame` 风格的输入对象
- `selection/drag.ts` 只保留 session adapter、overlay、commands

### core 侧

- move session 有稳定对外 API
- `SelectionDragAction['move']` 只表达最小意图
- move preview 与 move commit 都能直接从 session 得出

### 整体阅读体验

- 看 `press.ts` 时，看到的是 selection policy
- 看 `moveSession.ts` 时，看到的是 node move domain
- 看 `drag.ts` 时，看到的是 editor adapter

这三层清楚分开后，这条链路才算真正顺。
