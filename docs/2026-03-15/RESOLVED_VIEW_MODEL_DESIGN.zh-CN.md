# Whiteboard Resolved View Model 设计

## 背景

当前白板运行时已经有两类数据源：

- committed data：来自 `@whiteboard/engine` 的 document / projection / index / commands
- transient data：来自 `@whiteboard/react` 的交互期临时 overlay

这两层分开本身没有问题，问题出在消费方式。

现在一些 UI 逻辑不是直接消费“最终可渲染数据”，而是自己同时知道：

- committed entry / node / tree
- transient node / routing / selection / guides
- selection / tool 等 UI domain 状态

然后在组件或 feature 层现场拼装。

典型例子：

- [`packages/whiteboard-react/src/node/components/NodeItem.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/components/NodeItem.tsx) 同时读取 committed node item、selection、tool、transient node，再本地 resolve
- [`packages/whiteboard-react/src/edge/hooks/useEdgeEntry.ts`](/Users/realrong/whiteboard/packages/whiteboard-react/src/edge/hooks/useEdgeEntry.ts) 同时知道 committed edge、transient node、routing draft，并在同一个 hook 里做 overlay
- [`packages/whiteboard-react/src/edge/components/EdgeFeature.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/edge/components/EdgeFeature.tsx) 同时拼 selected edge、routing draft、connection preview、edge entry

这会导致一个结构性问题：

UI 组件没有只消费“resolved data”，而是承担了“理解多份源数据并做 merge”的职责。

这不是单点问题，而是一种扩散风险。

## 核心判断

### 1. 两份状态源是正常的

白板这种高交互系统里，`committed` 和 `transient` 不应该硬揉成一份：

- committed 负责正式文档真值
- transient 负责拖拽、框选、连接、路由等短生命周期预览

如果强行合并：

- history / undo-redo 边界会变脏
- 高频 pointermove 会污染 committed 数据流
- engine 会被迫理解 UI host 生命周期

所以问题不是“为什么有两份数据”，而是“为什么 UI 自己要拼两份数据”。

### 2. UI 不该广泛直接面对多源数据

一个好的 UI 层应该主要消费：

- resolved node view
- resolved edge view
- resolved selection view
- resolved mindmap view

而不是到处直接消费：

- engine read
- transient slice
- tool getter
- selection getter

如果组件自己拼 committed + transient，会带来：

- merge 规则分散
- 同样的 overlay 逻辑在多处重复
- feature 边界漂移
- 通用 read hook 反向依赖具体 interaction 模块

### 3. 真正需要统一的是“resolved 层”，不是“状态源”

推荐目标不是做单一状态树，而是做三层：

```text
committed source
  engine.read / ui domain committed state

transient overlay
  transient.node / transient.connection / transient.selection ...

resolved render model
  feature 内部统一解析后给 UI 消费
```

关键点：

- `committed` 和 `transient` 仍然分开
- UI 尽量不直接知道两者如何 merge
- merge 规则集中收口到 resolver / resolved hook

## 目标

目标不是让所有组件都变成 dumb component，而是让“多源拼装责任”从组件层退出，收口到 feature 内部的 resolved 层。

最终希望形成下面这个约束：

- component 只消费 resolved render model
- interaction hook 只维护 session，并写 transient / commit commands
- transient 只表达 overlay，不表达组件语义
- engine 只表达 committed truth，不理解 transient session

## 推荐分层

### A. Session 层

仅服务当前交互会话，不进入 shared store。

例如：

- pointerId
- start point
- drag origin
- resize drag state
- rotate drag state
- reconnect draft

放置位置：

- feature hook 内部 `useRef`
- 必要时配合 `interactionLock`

### B. Overlay 层

只描述“当前交互如何暂时覆盖 committed 数据”。

例如：

- `transient.node`
- `transient.guides`
- `transient.connection`
- `transient.routing`
- `transient.selection`
- `transient.mindmap`

特点：

- 可以跨 feature 消费
- 只表达覆盖事实，不表达渲染组件结构
- 不进入 history / collaboration / persistence

### C. Resolved 层

这是本方案的核心层。

它负责：

- 读取 committed source
- 读取必要的 transient overlay
- 读取必要的 committed UI domain 状态，例如 selection / tool
- 产出“组件可直接渲染”的 resolved model

组件应尽量只消费这一层。

## 设计原则

### 原则 1：resolver 依赖 overlay，不依赖 interaction session

好的依赖：

- `useNodeView(nodeId)` 依赖 committed node + `transient.node`
- `useEdgeView(edgeId)` 依赖 committed edge + `transient.node` + 可能的 edge overlay

不好的依赖：

- `useEdgeEntry()` 直接依赖 `useEdgeRouting` 的 active session draft
- 通用 read hook 反向 import 某个具体 interaction 目录里的 math / session 类型

一句话：

resolved 层只认“可共享的覆盖事实”，不认“某次交互会话里的内部过程态”。

### 原则 2：overlay 尽量是领域态，不是组件态

好的 overlay：

- `nodeId -> patch/hovered`
- `edgeId -> routing point preview`
- `selection rect`

不好的 overlay：

- `showBlueOutline`
- `renderAsGhost`
- `shouldMountHandles`

也就是：

overlay 应该表达事实，组件语义由 resolved 层推导。

### 原则 3：resolved model 应按 feature/实体收口

不要做一个全局巨大的 `useResolvedWhiteboard()`。

推荐做法：

- node：`useNodeView(nodeId)`
- edge：`useEdgeView(edgeId)`
- selection：`useSelectionBoxView()`
- mindmap：`useMindmapTreeView(treeId)`

每个 feature 自己维护自己的 resolved 入口。

### 原则 4：组件拿最终值，不拿原料

组件 props / hook 返回值里，优先出现：

- `entry`
- `view`
- `renderModel`
- `handles`
- `overlay`

尽量不要出现：

- `nodeDraft`
- `routingDraft`
- `selectionState`
- `tool`

如果组件还在同时拿 committed + transient 原料，通常说明 resolved 层还没收好。

## 推荐目录

建议在 `packages/whiteboard-react/src/` 内引入一层明确的 resolved/view 目录，但不要做成全局 mega module。

推荐两种方式，优先第一种。

### 方案 A：按 feature 放本地 resolved hooks

```text
node/
  hooks/
    useNodeView.ts
edge/
  hooks/
    useEdgeView.ts
selection/
  hooks/
    useSelectionBoxView.ts
mindmap/
  hooks/
    useMindmapTreeView.ts
```

优点：

- 依赖边界清晰
- 更符合 feature 本地语义
- 不容易演变成全局 read 拼装中心

### 方案 B：集中到 `view/`

```text
view/
  node.ts
  edge.ts
  selection.ts
  mindmap.ts
```

只有当多 feature 明显共享一套 resolved 逻辑时再考虑。

在当前阶段，不建议先建全局 `view/` 层。

## Node 的推荐做法

node 是当前最接近目标状态的 feature。

已有基础：

- committed：`useNode(nodeId)`
- overlay：`useTransientNode(...)`
- resolver：[`resolveNodeViewItemWithDraft(...)`](/Users/realrong/whiteboard/packages/whiteboard-react/src/transient/node.ts#L195)

当前问题是：

- [`NodeItem.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/components/NodeItem.tsx) 仍然同时知道 committed、transient、selection、tool，并在组件体内现场拼

推荐目标：

```ts
type ResolvedNodeView = {
  node: NodeViewItem['node']
  rect: NodeViewItem['rect']
  rotation: number
  hovered: boolean
  selected: boolean
  hasResizePreview: boolean
  canRotate: boolean
  shouldAutoMeasure: boolean
  shouldMountTransform: boolean
  shouldMountConnectHandles: boolean
  nodeStyle: CSSProperties
  transformStyle: CSSProperties
  connectHandleOverlayStyle: CSSProperties
}
```

然后：

- `useNodeView(nodeId)` 内部统一读取 committed node、transient node、selection、tool、registry
- `NodeItem` 只拿 `view`

示意：

```ts
const view = useNodeView(nodeId)
if (!view) return null
return <NodeItemView view={view} ...handlers />
```

这样组件不再知道 `draft` 的存在。

## Edge 的推荐做法

edge 是当前问题最明显的 feature。

### 当前问题

[`useEdgeEntry.ts`](/Users/realrong/whiteboard/packages/whiteboard-react/src/edge/hooks/useEdgeEntry.ts) 同时处理：

- committed edge entry
- node transient 对 endpoints 的影响
- routing draft 对 path points 的影响

这里最大的分层问题是：

- `useEdgeEntry` 这种基础 read hook，不该直接依赖 routing 交互语义

`node transient` 是共享 overlay，进基础 resolver 合理。  
`routingDraft` 更像某次 interaction session 产生的局部 preview，不该落进基础 entry 解析层。

### 推荐拆分

先拆成两层：

#### 1. Base resolved edge

```ts
useEdgeBase(edgeId)
```

职责：

- 读取 committed edge entry
- 应用 `transient.node`
- 返回最终 endpoints 修正后的 base entry

#### 2. Routing overlay

```ts
resolveEdgeViewWithRoutingOverlay(base, routingOverlay)
```

职责：

- 只在当前 edge 命中 routing overlay 时，覆盖 routing points

也就是说：

- `useEdgeBase` 不知道 routing session
- `EdgeFeature` / `EdgeItemById` 本地决定要不要叠加 routing overlay

### 更长期的演化

如果未来 edge 也像 node 一样，需要稳定的共享渲染覆盖层，则应考虑引入：

```ts
transient.edge
```

而不是让 `useEdgeEntry` 一路知道各种 interaction draft。

长期正确方向应是：

- `useEdgeView(edgeId)` 读取 committed edge + `transient.node` + `transient.edge`
- routing session 只负责写 `transient.edge`

但在当前阶段，不建议一步到位扩出 `transient.edge`，先收依赖方向。

## Selection 的推荐做法

selection 目前已经比较清晰：

- session 在 [`useSelectionBoxInteraction.ts`](/Users/realrong/whiteboard/packages/whiteboard-react/src/selection/useSelectionBoxInteraction.ts) 内
- overlay 在 `transient.selection`
- UI 在 [`SelectionFeature.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/selection/SelectionFeature.tsx) 内渲染 box

这里可以进一步收成：

```ts
useSelectionBoxView()
```

返回：

```ts
type ResolvedSelectionBoxView = {
  visible: boolean
  rect?: Rect
}
```

它内部统一判断：

- 当前 tool
- 当前 transient.selection

然后 `SelectionFeature` 只渲染 resolved box。

## Mindmap 的推荐做法

mindmap 目前也是 committed tree + drag preview 混合消费。

[`MindmapFeature.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/mindmap/components/MindmapFeature.tsx) 里：

- 读取 committed tree
- 读取 transient mindmap drag
- 再把 drag 按 `treeId` 分发给 `MindmapTreeView`

推荐目标：

```ts
useMindmapTreeView(treeId)
```

返回：

```ts
type ResolvedMindmapTreeView = {
  treeId: NodeId
  rootId: MindmapNodeId
  nodes: readonly ResolvedMindmapNodeView[]
  drag?: {
    activeNodeId: MindmapNodeId
    attachTargetId?: MindmapNodeId
  }
}
```

再由树视图组件直接消费。

这样 `MindmapTreeView` / `MindmapNodeItem` 不需要知道 committed tree 和 transient drag 是怎么 merge 的。

## 如何做到“UI 只消费 resolved 数据”

这里的“UI”指组件和组件组合层，而不是 interaction hook。

建议使用下面这条规则：

### 规则 1：组件中禁止直接合并 committed + transient

允许：

- 组件拿一个 `view`
- 组件拿少量 event handlers
- 组件拿纯视觉 props

不建议：

- 组件里同时 `useNode(...)` 和 `useTransientNode(...)`
- 组件里根据 `tool + selection + draft` 多重判断 mount 逻辑
- 组件里知道 patch/origin/session 等原料概念

### 规则 2：feature 入口只做组合，不做拼装

例如 `NodeFeature` / `EdgeFeature` 应主要负责：

- 遍历 ids
- 绑定 interaction handlers
- 把 id 交给 resolved hook

而不是在 feature 顶层层层处理 raw draft。

### 规则 3：resolved hook 是唯一 merge 入口

每个实体最多保留一个主要 resolved 入口：

- node：`useNodeView(nodeId)`
- edge：`useEdgeView(edgeId)`
- selection：`useSelectionBoxView()`
- mindmap：`useMindmapTreeView(treeId)`

其它地方不要重复实现相同 merge。

### 规则 4：session 与 overlay 不跨层泄漏

interaction hook 可以知道：

- pointerId
- drag start
- lock token
- current active handle

但这些不应该进入 component 层。

component 最多知道：

- `isDragging`
- `isHovered`
- `activeRoutingIndex`

且最好这些都来自 resolved model，而不是 session 原始字段。

## 推荐 API 形状

### Node

```ts
type ResolvedNodeView = {
  nodeId: NodeId
  node: NodeViewItem['node']
  rect: Rect
  rotation: number
  selected: boolean
  hovered: boolean
  canRotate: boolean
  hasResizePreview: boolean
  shouldMountTransform: boolean
  shouldMountConnectHandles: boolean
  shouldAutoMeasure: boolean
  containerStyle: CSSProperties
  transformStyle: CSSProperties
  connectHandleOverlayStyle: CSSProperties
}

declare function useNodeView(
  nodeId: NodeId
): ResolvedNodeView | undefined
```

### Edge

```ts
type ResolvedEdgeView = {
  edgeId: EdgeId
  entry: EdgeEntry
  selected: boolean
  routing: {
    activeIndex: number | null
    points: readonly Point[]
  }
}

declare function useEdgeView(
  edgeId: EdgeId
): ResolvedEdgeView | undefined
```

注意：

- 如果当前阶段不想引入 `transient.edge`
- 那 `useResolvedEdgeView` 可以内部读取 base entry，再在本地应用 routing overlay
- 但 routing overlay 的来源应停在 edge feature/domain，不要让基础 read hook 直接依赖 routing interaction

### Selection

```ts
type ResolvedSelectionBoxView = {
  visible: boolean
  rect?: Rect
}
```

### Mindmap

```ts
type ResolvedMindmapNodeView = {
  id: MindmapNodeId
  rect: Rect
  shiftX: number
  shiftY: number
  label: string
  dragActive: boolean
  attachTarget: boolean
  showActions: boolean
  dragPreviewActive: boolean
}
```

## 与 transient 设计的关系

这个方案不是要替代 [`TRANSIENT_RUNTIME_DESIGN.zh-CN.md`](/Users/realrong/whiteboard/TRANSIENT_RUNTIME_DESIGN.zh-CN.md)。

两者关系应是：

- `TRANSIENT_RUNTIME_DESIGN.zh-CN.md` 解决“transient 放哪里、长什么样、谁来拥有”
- 本文解决“UI 如何消费 committed + transient，而不是自己到处拼装”

一句话：

- transient 解决 source of overlay
- resolved view 解决 consumption boundary

## 迁移建议

按收益和风险排序，建议下面这个顺序。

### 第一阶段：收 `edge`

原因：

- 当前 `routingDraft` 已经明显越界到基础 read hook
- edge 是多源拼装最重的地方

步骤：

1. `useEdgeEntry` 去掉 `routingDraft`
2. 保留 node overlay 对 endpoint 的修正
3. 在 `EdgeFeature` 或 `EdgeItemById` 本地应用 routing overlay
4. 收敛成 `useResolvedEdgeView(edgeId)` 或 `resolveEdgeView(...)`

### 第二阶段：收 `node`

原因：

- 逻辑目前已接近 resolved 模式
- 只是 merge 责任还留在 `NodeItem`

步骤：

1. 抽 `useResolvedNodeView(nodeId)`
2. 把 selection/tool/registry/transient node 的 merge 收进去
3. `NodeItem` 改成只消费 `view`

### 第三阶段：收 `selection`

把 `SelectionFeature` 收成只消费 resolved box。

### 第四阶段：收 `mindmap`

把 tree + drag preview 的 merge 收进 `useResolvedMindmapTreeView(treeId)`。

## 不建议做的事

### 1. 不建议把 committed + transient 真正合并成一个全局 store

这会打穿 engine / react runtime 边界。

### 2. 不建议把所有 resolved 逻辑集中到一个总的 mega hook

例如：

```ts
useWhiteboardResolvedState()
```

这会变成新的大泥球。

### 3. 不建议让 `instance` 直接暴露一个通用 resolved 总线

resolved 是 UI/render 组合层语义，不是 instance 的稳定 runtime API。

instance 更适合暴露：

- committed read
- commands
- viewport
- 少量 imperative getter

resolved 应优先留在 feature 层。

### 4. 不建议让基础 read hook 依赖具体 interaction 模块

例如：

- `useEdgeEntry` import `routing/math`
- `useNodeEntry` import 某个 drag session 类型

这会让依赖方向倒置。

## 最终建议

从全局角度，最佳方向不是“消灭 transient”，也不是“把一切塞进 engine”。

最佳方向是：

1. 保持 committed 和 transient 分层
2. 保持 session、overlay、resolved 三层分工
3. 让 UI 主要消费 resolved model
4. 把 merge 规则收口到 feature 本地的 resolved hooks / resolvers

一句话总结：

多源数据不是问题，分散拼装才是问题。  
正确做法不是合并状态源，而是建立一层明确的 resolved view boundary，让组件只消费最终渲染数据。
