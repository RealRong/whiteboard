# React 算法分层重构方案

## 结论

当前 `packages/whiteboard-react/src` 里仍然残留了一批“并不属于 React UI 本身”的算法。

它们主要分成三类：

- 文档关系算法
  - group ancestor
  - root selection
  - descendants 展开
- 几何投影算法
  - drag member offset
  - move preview
  - mindmap ghost / drop projector
  - selection bounds
- 查询 + 评分 + 选择算法
  - container target
  - edge follow
  - subtree drop target 前置投影

长期最优不是把这些统统塞进 engine，也不是新造一个笼统的 `algorithms/` 目录，而是继续按三层拆：

- `core`
  - 纯领域规则
  - 纯几何
  - 纯投影
  - 纯关系 helper
- `engine`
  - 基于文档快照和索引的 query/read 能力
  - canonical normalize/finalize
- `react`
  - DOM 输入
  - pointer session
  - preview store
  - UI policy

一句话说：

- `React` 不再拥有“文档规则”
- `engine` 不再重复实现“同一套 preview solver”
- `core` 成为真正唯一的规则与投影层

---

## 一. 目标

本文以以下前提为准：

- 不考虑兼容成本
- 优先长期最优
- 优先职责分离
- 优先复用
- 优先概念少
- 优先 API 短
- 优先不要长出太多小文件

因此本文不是“局部 patch 建议”，而是最终分层方案。

---

## 二. 当前主要异味

### 1. React 里仍有文档关系算法

最明显的是以下几处：

- `packages/whiteboard-react/src/features/node/drag/math.ts`
- `packages/whiteboard-react/src/runtime/selection/policy.ts`
- `packages/whiteboard-react/src/features/node/hooks/transform/session.ts`

这些文件里都各自维护了类似逻辑：

- 向上追 `groupId`
- 判断选中集合里是否存在祖先 group
- 从选中集合中过滤 root ids
- 展开 group descendants

这些不是 UI 逻辑，而是纯关系规则。

### 2. React preview 与 engine finalize 重复维护一套规则

最典型的是：

- React:
  - `packages/whiteboard-react/src/features/node/drag/math.ts`
- engine:
  - `packages/whiteboard-engine/src/write/normalize/finalize.ts`

两边都在维护：

- container reparent 判定
- edge route follow 判定
- same delta 规则

这不是“偶然重复”，而是写语义放错了位置。

当前真正的问题不是“同一套代码写了两遍”，而是：

- React 先根据 drag session 推导一次 move 结果
- 提交时却只发低语义的 `node.updateMany(...)`
- engine 再在 `finalize` 里根据 before/after 反推“刚才是不是一次整体 move”

于是 `finalize` 才会被迫承担本不属于它的职责：

- 推导 moved roots
- 推导 same delta
- 推导 container reparent
- 推导 edge route follow

所以，单纯把这套规则抽到 `core`，然后：

- React 用它做 preview
- engine 用它做 finalize

虽然比现在好，但仍然不是长期最优。

长期最优应该是：

- `core`
  - 提供唯一的 move 规则与 effect solver
- `engine`
  - 提供显式的 `commands.node.move(...)`
  - 直接调用 move solver 产出 operation
- `react`
  - drag preview 只做同一 solver 的 dry-run
- `finalize`
  - 不再承担 move-specific 规则

一句话说：

- 不是“preview + finalize 共用一套 solver”
- 而是“preview + command 共用一套 solver，finalize 退出这条链”

### 3. Selection box bounds 还在 React 自己拼

`packages/whiteboard-react/src/runtime/selection/state.ts` 现在为了算 selection box：

- 读取 selection source
- 读取 node/edge items
- 对 group 再展开 descendants
- 再自己算 bounds

这里的问题不是逻辑错，而是：

- React 在补做一个其实应该由 read/query 提供的能力

长期最优里，selection 仍是 UI state，但 selection 的几何 bounds 不该由 React 每次自己拼。

### 4. Mindmap drag 还停留在 React projector

`packages/whiteboard-react/src/features/mindmap/hooks/drag/math.ts` 现在虽然已经复用了 core 的 `computeSubtreeDropTarget(...)`，但还保留了很多纯 projector：

- node rect map
- ghost rect
- root drag position
- next drag session projection

这些不依赖 DOM，不依赖 React，不该留在 UI 层。

### 5. 还有少量纯几何 helper 留在 React

例如：

- `packages/whiteboard-react/src/runtime/input/pointer.ts`
  - `buildSegmentRect`
- `packages/whiteboard-react/src/features/draw/useDrawInput.ts`
  - `readSampleEvents`
- `packages/whiteboard-react/src/features/draw/useEraserInput.ts`
  - `readSampleEvents`

这种虽然不大，但会持续制造重复和边界模糊。

---

## 三. 最终分层原则

### 1. Core 负责“规则”和“投影”

只要满足下面任一条件，就优先考虑下沉到 `core`：

- 不依赖 DOM
- 不依赖 React
- 不依赖 instance 的 command side effect
- 输入是普通数据
- 输出是普通数据

典型就是：

- ancestor / descendant / root id
- move projector
- route follow
- container target
- mindmap drag projector

### 2. Engine 负责“快照查询”

只要逻辑的复杂度来自：

- 文档快照
- index
- projection
- bounds query

就更适合进 `engine read`，而不是继续让 React 拼数据。

engine 不应该拥有 UI policy，但应该拥有：

- `bounds of targets`
- descendants 查询包装
- canvas / node / edge 的统一 query

除此之外，engine 还应该承接显式写语义。

也就是说：

- `node.updateMany(...)`
  - 是低语义 patch 写入
- `node.move(...)`
  - 是高语义移动写入

凡是 container reparent / edge follow / same delta 这类“属于 move 语义本身”的规则，都应该在 `command -> translate` 这一层解决，而不是继续放进 `finalize` 事后猜测。

### 3. React 只负责“输入与展示”

React 长期最优职责是：

- pointer down / move / up
- session 生命周期
- preview store
- UI policy
- DOM measure

它不应该继续拥有纯领域算法。

---

## 四. 文件级判断

## 1. 应该优先下沉的

### `packages/whiteboard-react/src/features/node/drag/math.ts`

这个文件当前混了四层职责：

- root/member 提取
- drag position 投影
- container hover 目标判定
- edge follow preview

最终拆法应该是：

- `core`
  - root/member 提取
  - position 投影
  - container target solver
  - edge follow patch solver
- `react`
  - session 生命周期
  - snap 调用
  - preview 写入

不要把整个文件原样搬到 engine。

### `packages/whiteboard-react/src/features/mindmap/hooks/drag/math.ts`

这个文件大部分已经是纯 projector：

- `buildNodeRectMap`
- `buildGhostRect`
- `resolveRootDragSession`
- `resolveSubtreeDragSession`
- `resolveNextMindmapDragSession`

这些应该下沉到 `core/mindmap` 域。

React 只保留：

- pointer session
- preview state write
- commands.mindmap.* 提交

### `packages/whiteboard-react/src/runtime/selection/state.ts`

这个文件不应该整体下沉，因为：

- selection source 是 UI state
- transform / presentation capability 依赖 React registry

但其中这部分应该收出去：

- selection targets 的 bounds 求解
- group content bounds 处理

长期最优里它应该调用 `engine read` 提供的 bounds query，而不是自己拉全量 node 再展开 descendants。

### `packages/whiteboard-react/src/runtime/input/pointer.ts`

这个文件整体应该留在 React，因为它是 DOM/input route。

但其中纯几何 helper 应该收出去：

- `buildSegmentRect`

它本质是 geometry，不属于 pointer route。

## 2. 应该继续留在 React 的

### `packages/whiteboard-react/src/runtime/selection/policy.ts`

这个文件必须留在 React。

因为它依赖的是 UI 语义：

- tap / drag / hold
- repeat click
- edit field
- chrome
- selection box press

但它内部重复的 group ancestor / nearest group helper 不应继续本地实现，而应调用 `core` 关系 helper。

### `packages/whiteboard-react/src/features/selection/gesture.ts`

这个文件是 session executor。

它不是领域算法，应该保留在 React。

### `packages/whiteboard-react/src/features/node/text.ts`

这里大部分是：

- DOM 测量
- CSS 计算
- auto font 调度

这属于渲染边界，不应进 core/engine。

它最多只需要在 React 内部继续收成更清晰的 measure service，不属于本次跨层重构目标。

### `packages/whiteboard-react/src/runtime/interaction/autoPan.ts`

它是 interaction runtime，不是文档算法。

可以保留在 React。

如果未来要优化，只是把小的几何函数抽到 core geometry，不必整体迁移。

## 3. 可选下沉，但不是第一优先级

### `packages/whiteboard-react/src/features/node/session/node.ts`
### `packages/whiteboard-react/src/features/edge/preview.ts`

这里的：

- `projectNodeItem`
- `projectEdgeItem`

本质上是“文档项 + preview patch -> 投影项”的纯 projector。

它们未来可以下沉到 core 的 `read/project` 一侧，但当前优先级低于：

- drag/reparent/follow
- bounds query
- mindmap drag

原因很简单：

- 复用需求已经存在，但还没有前面几组那么急迫

---

## 五. 最小复用基建

长期最优不要做一个“大而全”的基础设施层，而是补 4 组非常小的共用能力。

### 1. Node relation helpers

建议优先放在现有：

- `packages/whiteboard-core/src/node/group.ts`

而不是新建：

- `relations.ts`
- ancestry.ts
- selectionRoots.ts

因为它们本质都属于 group/container 关系域。

建议补这类 helper：

- `hasGroupAncestor(node, ids, nodeById)`
- `findGroupAncestor(nodeId, nodeById, match?)`
- `filterRootIds(ids, nodeById)`
- `expandGroupMembers(nodes, rootIds)`

这一组 helper 会同时服务：

- selection policy
- node drag
- selection scale
- engine `node.move(...)`

### 2. Node move solver

这里单独增加一个文件是合理的，建议新增：

- `packages/whiteboard-core/src/node/move.ts`

这是本次唯一真正值得新建的 node 域文件。

它负责：

- `buildMoveSet(...)`
- `projectMovePositions(...)`
- `resolveMoveEffect(...)`

为什么这个文件值得存在：

- 它是独立领域，不适合塞进 `commands.ts`
- 也不适合继续堆在 React 的 `drag/math.ts`
- 它正好位于 React preview 和 engine `node.move(...)` 的公共交界

这里要特别明确：

- `move.ts` 不是给 `finalize` 准备的
- `move.ts` 是给显式 move command 准备的

`resolveMoveEffect(...)` 的职责应该一次性返回：

- 节点位置变更
- container 归属变更
- edge follow 变更
- preview 需要的共享元信息，例如 hovered container

这样 React preview 与 engine commit 看到的是同一个 move effect，只是一个写 preview，一个翻译成 operations。

### 3. Engine bounds query

建议补一个很薄的 read query，长期最优不需要很多 API。

推荐最终形态：

```ts
engine.read.bounds = {
  canvas: () => Rect | undefined,
  targets: (input: {
    nodeIds?: readonly NodeId[]
    edgeIds?: readonly EdgeId[]
    groups?: 'node' | 'content'
  }) => Rect | undefined
}
```

核心目标只有一个：

- 让 React 不再自己做 selection / subset bounds 拼装

这会复用到：

- selection box
- multi selection toolbar
- context menu target bounds
- fit to selection
- future minimap / export area

### 4. Pointer sample helper

这个不要进 core。

因为它依赖 DOM `PointerEvent`。

长期最优应该收在 React runtime input 层，且尽量不新增碎文件。

建议直接收进：

- `packages/whiteboard-react/src/runtime/input/pointer.ts`

提供一个统一 helper，例如：

- `readPointerSamples(event)`

然后：

- `useDrawInput.ts`
- `useEraserInput.ts`

都改为复用它。

---

## 六. 推荐最终 API

以下是长期最优的最终口径。

### 1. Core node move

```ts
type MoveMember = {
  id: NodeId
  offset: Point
}

type MoveSet = {
  rootIds: readonly NodeId[]
  members: readonly MoveMember[]
}

type MoveEffect = {
  nodes: readonly {
    id: NodeId
    position: Point
  }[]
  containers: readonly {
    id: NodeId
    containerId?: NodeId
  }[]
  edges: readonly {
    id: EdgeId
    patch: EdgePatch
  }[]
  hoveredContainerId?: NodeId
}

buildMoveSet(...)
projectMovePositions(...)
resolveMoveEffect(...)
```

这里不要做：

- `drag runtime`
- `move session`
- `preview manager`

这些都属于 React。

这里也不要做：

- `finalize move analyzer`
- `after/before diff 推导 move`

因为 move solver 的输入应该是明确的 move intent，而不是事后分析 patch 结果。

### 2. Engine node move command

```ts
instance.commands.node.move({
  ids,
  delta
})
```

设计要点：

- `ids`
  - 是 UI 已经决定好的移动目标
  - command 内部再通过 core helper 过滤 root / 展开 members
- `delta`
  - 是唯一必要的移动输入
  - 不需要把 selection、anchor、press 语义带进 engine

然后 engine 内部执行链应为：

1. 读取当前 document
2. `core/node/move.ts` 解析 move set
3. `core/node/move.ts` 计算 move effect
4. translate 成 `node.update` / `edge.update`
5. 进入通用 sanitize / finalize

其中第 5 步里的 `finalize` 不再补做 move-specific 规则。

### 3. Engine bounds query

```ts
engine.read.bounds.targets({
  nodeIds,
  edgeIds,
  groups: 'content'
})
```

这里不要做：

- `selection.bounds`
- `marquee.bounds`

因为那会把 UI 语义带进 engine。

engine 只提供通用 query。

### 4. React drag preview

React drag session 的长期最优职责应该非常薄：

1. pointer -> delta
2. snap 修正 delta
3. 调同一份 `resolveMoveEffect(...)` 做 dry-run
4. 写 preview store
5. pointerup 调 `instance.commands.node.move(...)`

也就是说，React 不应该再在 preview 阶段单独维护：

- container target 规则
- edge follow 规则
- same delta 规则

它只负责把 pointer 输入喂给同一份 solver。

### 5. Core mindmap drag projector

```ts
createRootDrag(...)
createSubtreeDrag(...)
projectMindmapDrag(...)
```

这里同样不要做：

- React session
- preview store
- command submit

---

## 七. 不建议做的事情

### 1. 不要建立一个新的 `algorithms/`

这会让“职责分离”看起来更干净，但实际上会制造第四层概念。

长期最优里只有三层：

- core
- engine
- react

不要再加一层抽象壳。

### 2. 不要做大一统 solver framework

不要为了复用而设计：

- `solve({ kind: 'drag' | 'selection' | 'drop' | ... })`
- planner/executor 通用框架
- generic candidate engine

这类抽象很容易让 API 更短，但让概念更多。

长期最优里应该共享的是小基建：

- ancestor helper
- bounds query
- nearest picker
- move projector

不是一个大而全的框架。

### 3. 不要把 UI policy 下沉到 core/engine

例如：

- hold -> contain marquee
- repeat click -> edit
- chrome show/hide
- selection box press

这些都必须留在 React。

---

## 八. 具体文件去向

## 1. `features/node/drag/math.ts`

最终应拆成：

- 下沉到 `core/node/move.ts`
  - root/member 提取
  - positions 投影
  - move effect
- 保留在 React session
  - pointer lifecycle
  - snap 调用
  - preview store write

拆完后 React 里的 drag session 应只剩下：

1. 读 pointer
2. 调 core solver
3. 写 preview
4. pointerup 提交 `node.move(...)`

与此同时，engine 里的：

- `analyzeNodeMoves(...)`
- `collectReparentOps(...)`
- `collectEdgeFollowOps(...)`

应从 `finalize.ts` 退出。

它们不属于 finalize，而属于 move command。

## 2. `features/mindmap/hooks/drag/math.ts`

最终应下沉到 `core/mindmap` 域。

可以有两种实现路径：

- 直接并入现有 `mindmap/dropTarget.ts`
- 或者新增 `mindmap/drag.ts`

在“尽量少文件”的前提下，更推荐：

- 先并入 `dropTarget.ts`
- 如果文件明显失控，再独立成 `drag.ts`

## 3. `runtime/selection/state.ts`

最终保留：

- selection source -> view
- transform capability
- kind / items / target 语义

最终移除：

- 手工 selection bounds 组装

改为依赖：

- `engine.read.bounds.targets(...)`

## 4. `runtime/selection/policy.ts`

最终保留在 React。

但内部不再自己写：

- nearest group 查找
- ancestor 判断

改为调用 core helper。

## 5. `runtime/input/pointer.ts`

最终保留在 React。

其中：

- `buildSegmentRect`
  - 下沉到 core geometry
- coalesced event 读取
  - 统一收成 input helper

## 6. `features/node/session/node.ts` / `features/edge/preview.ts`

短期先保留。

中期如果 preview projector 继续增多，再考虑下沉纯 projector。

---

## 九. 分阶段实施

### 阶段 1

先做最值钱的统一：

- 把 group ancestor / root filter / descendants 展开收进 core node 关系 helper
- 把 node drag 的 move projector 与 effect solver 收进 core
- 新增 `engine.commands.node.move(...)`
- 让 React drag preview 改为 dry-run 同一份 move solver
- 把 `finalize.ts` 里的 move-specific 逻辑删掉

阶段 1 完成后，最大的重复会消失。

### 阶段 2

补 engine bounds query：

- `read.bounds.targets(...)`

然后简化：

- `runtime/selection/state.ts`
- 任何手工 subset bounds 逻辑

阶段 2 完成后，selection 几何计算会明显收敛。

### 阶段 3

把：

- `features/mindmap/hooks/drag/math.ts`

下沉到 core mindmap 域。

阶段 3 完成后，mindmap drag 会与 node drag 一样形成：

- core projector
- react session

的统一模型。

### 阶段 4

收尾小基建：

- pointer sample helper
- segment bounds helper

阶段 4 主要是去重复，不是结构性改造。

### 阶段 5

最后再决定是否下沉 preview projector：

- `projectNodeItem`
- `projectEdgeItem`

这一阶段不是必须立即做。

---

## 十. 建议的最终目录形态

在“职责清楚”和“不要太多小文件”之间，建议收成下面这样：

```ts
packages/whiteboard-core/src/node/
  group.ts
  move.ts
  snap.ts
  transform.ts
  selection.ts

packages/whiteboard-core/src/mindmap/
  dropTarget.ts

packages/whiteboard-engine/src/read/store/
  index.ts

packages/whiteboard-react/src/runtime/input/
  pointer.ts

packages/whiteboard-react/src/runtime/selection/
  policy.ts
  state.ts
```

这里故意避免新增：

- `relations.ts`
- `selectionRoots.ts`
- `moveHelpers.ts`
- `boundsHelpers.ts`

因为这些都会把文件拆得过碎。

唯一真正值得新增的新核心文件是：

- `packages/whiteboard-core/src/node/move.ts`

---

## 十一. 最终判断

这次继续收敛的核心，不是“还有哪些 `math.ts` 没搬”，而是：

- React 里还残留了多少文档规则
- engine 是否还在 `finalize` 里反推本应由 command 明确表达的写语义
- 哪些查询能力应该变成 engine read

按长期最优判断：

- `node drag` 这条链必须继续收
- `node move` 必须提升成显式 command
- `mindmap drag` 这条链值得继续收
- `selection bounds` 必须补 engine query
- `selection policy` 继续留在 React，但关系 helper 要外提
- `text measure`、`autoPan`、`pointer route` 应留在 React

也就是说，下一步最正确的方向不是继续“拆 hook”，而是继续把：

- 关系
- 投影
- bounds query

这三块从 React 行为层拿掉。

同时把：

- move 语义

从 `finalize` 里拿掉，收回到显式 command。
