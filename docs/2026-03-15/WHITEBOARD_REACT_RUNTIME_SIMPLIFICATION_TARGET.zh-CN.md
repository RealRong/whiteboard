# Whiteboard React Runtime 全局降复杂度目标设计

## 目标

这份文档讨论的不是“如何在现有结构上继续打补丁”，而是：

**如果不在乎重构成本，只追求在实现同一个目标时最大程度减少复杂度，`packages/whiteboard-react` 应该长成什么样。**

这里的复杂度主要指：

- 需要理解多少概念
- 同一个事实被表达多少次
- UI 是否需要自己拼多份状态
- 事件链路是否跨太多层
- 每个 feature 是否都在重复写订阅胶水

## 核心结论

最优形态不是继续优化局部 hook，而是把 `whiteboard-react` 明确重构成一个真正的 **editor runtime**。

整个系统只保留三类真相：

1. `engine`
2. `editor state`
3. `draft`

除此之外，UI 只能读取 `view`。

一句话总结：

**让 runtime 负责聚合，让 UI 只消费 resolved view，让交互只写 raw state 和 draft。**

---

## 当前复杂度的根因

### 1. 同一个事实被拆成太多层表达

现在一个 UI 结果经常会跨下面几层：

- engine committed read
- selection/scope/tool/session
- draft/transient
- feature 本地 merge
- hook 本地 memo

这会导致“理解一个结果”需要跨多个文件和多个概念。

### 2. `view` 还不是一等 runtime

当前虽然已经有 `instance.read.view`，方向是对的，但它仍然偏“getter 集合”。

真正复杂的地方还在 React hook 侧重复实现：

- 上游依赖有哪些
- 依赖如何订阅
- 何时重新计算
- 如何缓存 snapshot

结果就是每个 `useXxxView` 都在手写一遍 runtime adapter。

### 3. UI 仍然需要理解很多底层概念

现在 UI 虽然比以前好很多，但仍能感知到：

- selection
- scope
- session
- toolbar menu
- context menu
- transient/draft
- committed entry

UI 理论上不应该理解这么多层。

UI 最好只理解：

- `scene`
- `overlay`
- `surface`

### 4. editor runtime 仍然对外碎片化

现在 editor runtime 虽然已经基本挂在 `instance` 上，但对外仍然有很多平级概念：

- `selection domain`
- `container domain`
- `interaction session`
- `context-menu domain`
- `toolbar domain`
- `transient.*`

这些内部拆分可以保留，但不应该继续作为主要公共认知。

---

## 最优形态的总模型

最优结构应该收敛成：

```ts
type InternalWhiteboardInstance = {
  engine: EngineInstance
  viewport: WhiteboardViewport

  state: EditorStateRuntime
  draft: DraftRuntime
  view: EditorViewRuntime
  commands: EditorCommands

  read: EngineRead
  config: Readonly<EngineConfig>
  registry: NodeRegistry
  dispose(): void
}
```

这里最重要的变化是：

- `view` 成为和 `state`、`draft` 同级的一等 runtime
- React 不再自己写一堆 `view hook adapter`
- `instance.read.view` 可以最终收敛为 `instance.view`

也就是说：

- `read` 负责 engine committed read
- `view` 负责 editor resolved read

这是两种完全不同语义，最好不要继续混在一起。

---

## 三类真相

## 1. Engine

`engine` 只负责 committed world：

- document
- geometry
- projection
- index
- committed commands

它不负责：

- toolbar
- context menu
- selection box
- guides
- node drag preview
- edge routing preview

这些都不属于 document runtime，而属于 editor runtime。

## 2. Editor State

`state` 表示 editor 的原始 UI 状态，而不是最终 UI 结果。

推荐最终模型：

```ts
type EditorState = {
  tool: Tool
  selection: {
    nodeIds: readonly NodeId[]
    edgeId?: EdgeId
  }
  scope: {
    containerId?: NodeId
  }
  session:
    | { kind: 'idle' }
    | { kind: 'selection-box' }
    | { kind: 'node-drag' }
    | { kind: 'node-transform' }
    | { kind: 'edge-connect' }
    | { kind: 'edge-routing' }
    | { kind: 'mindmap-drag' }
  surface: {
    contextMenu?: {
      screen: Point
      target: ContextMenuTarget
      selectionBeforeOpen: SelectionSnapshot
    }
    toolbarMenu?: {
      key: NodeToolbarMenuKey
    }
  }
}
```

说明：

- `context menu` 和 `toolbar menu` 属于 `surface`
- `selection box` 是否正在交互属于 `session`
- `scope` 只是 editor state 的一个字段
- 不再把这些都强调为很多个平级 domain

内部当然仍然可以按 atom/domain 拆开实现，但对外应是统一的 `EditorStateRuntime`。

## 3. Draft

`draft` 表示交互中的视觉覆盖层。

推荐最终模型：

```ts
type DraftState = {
  node: KeyedStore<NodeId, NodeDraft>
  edge: KeyedStore<EdgeId, EdgeDraft>
  selectionBox?: Rect
  guides: readonly Guide[]
  connection?: ConnectionDraft
  mindmap?: MindmapDraft
}
```

注意：

- `draft` 不表示 selection
- `draft` 不表示 session
- `draft` 不表示 toolbar/context menu open
- `draft` 只表示视觉覆盖事实

内部依然可以保留性能优化：

- node draft 按 `nodeId` 订阅
- edge draft 按 `edgeId` 订阅
- guides 用 atom
- selectionBox 用 external store

但这些只是实现细节，不应该成为系统主概念。

---

## `view` 应该如何重设计

这是全局降复杂度收益最高的部分。

## 核心判断

现在最浪费复杂度的，不是某个 view 写得长，而是：

**每个 view 都要重复写一份“订阅哪些源 + 如何缓存 snapshot + React 如何接入”的胶水代码。**

这部分应该从 React hook 中抽离，变成 runtime 基础设施。

## 推荐的基础接口

```ts
type ValueView<T> = {
  get(): T
  subscribe(listener: () => void): () => void
}

type KeyedView<K, T> = {
  get(key: K): T
  subscribe(key: K, listener: () => void): () => void
}
```

然后整个 editor view runtime 长成这样：

```ts
type EditorViewRuntime = {
  selection: ValueView<SelectionView>
  overlay: ValueView<OverlayView>
  surface: ValueView<SurfaceView>
  scene: {
    node: KeyedView<NodeId, NodeSceneView | undefined>
    edge: KeyedView<EdgeId, EdgeSceneView | undefined>
    mindmap: KeyedView<NodeId, MindmapSceneView | undefined>
  }
}
```

## 这样做的直接收益

### 1. React 侧不再重复写 adapter

React 只需要两个极薄 hook：

```ts
useView(instance.view.overlay)
useKeyedView(instance.view.scene.node, nodeId)
```

而不是每个 view 各自写：

- `useNodeView`
- `useEdgeView`
- `useOverlayView`
- `useSurfaceView`
- `useSelectionState`

这些 hook 要么消失，要么退化为一层极薄别名。

### 2. 订阅依赖从分散实现变成统一基础设施

依赖哪些源，是 runtime 的职责，不是组件职责。

例如：

- `scene.node(nodeId)` 内部自己知道要订阅 committed node + node draft
- `scene.edge(edgeId)` 内部自己知道要订阅 committed edge + source/target node draft + edge draft
- `overlay` 内部自己知道要订阅 selection/session/surface/scope/guides/selectionBox
- `surface` 内部自己知道要订阅 selection/contextMenu/toolbarMenu/viewport

UI 完全不需要理解这件事。

### 3. `view` 真正成为系统中轴

到这一步后，系统就清楚了：

- `state` 是 raw UI truth
- `draft` 是 visual truth
- `view` 是 resolved truth

而不是现在这种“部分 resolved 在 read 里，部分 resolved 在 hook 里，部分 resolved 在组件里”。

---

## 推荐的 `view` 结构

## 1. Scene View

`scene` 负责实体渲染所需的最终结果。

```ts
type NodeSceneView = {
  nodeId: NodeId
  node: Node
  rect: Rect
  rotation: number
  hovered: boolean
  selected: boolean
  definition?: NodeDefinition
  renderProps: NodeRenderProps
  nodeStyle: CSSProperties
  transformStyle: CSSProperties
  shouldAutoMeasure: boolean
}

type EdgeSceneView = {
  edgeId: EdgeId
  edge: Edge
  endpoints: EdgeEndpoints
  points?: readonly Point[]
  selected: boolean
}
```

原则：

- 这里自动合并 committed + draft
- UI 不再手动 apply draft

## 2. Overlay View

`overlay` 负责编辑叠层的 resolved 结果。

```ts
type OverlayView = {
  selectionBox?: Rect
  guides: readonly Guide[]
  activeScope?: {
    nodeId: NodeId
    title: string
    rect: Rect
  }
  nodeHandleNodeIds: readonly NodeId[]
  showNodeConnectHandles: boolean
  showEdgeControls: boolean
}
```

原则：

- overlay 是集中出口
- 内部可以拆多个 resolver
- 对外不要泄漏很多 overlay 子概念

## 3. Surface View

`surface` 负责 toolbar/context menu 这种浮层。

```ts
type SurfaceView = {
  toolbar?: {
    value: NodeToolbarView
    menuKey?: NodeToolbarMenuKey
  }
  contextMenu?: ContextMenuView
}
```

原则：

- surface 统一承接浮层语义
- context menu / toolbar 不再以 feature 本地逻辑散落

---

## React 层应简化到什么程度

React 层理想上只做三件事：

1. 绑定 DOM 生命周期
2. 订阅 view
3. 渲染 JSX

### 期望的通用 hook

```ts
function useView<T>(view: ValueView<T>): T
function useKeyedView<K, T>(view: KeyedView<K, T>, key: K): T
```

### 期望的组件关系

```tsx
const overlay = useView(instance.view.overlay)
const surface = useView(instance.view.surface)
const nodeView = useKeyedView(instance.view.scene.node, nodeId)
```

这样 React 组件几乎退化成纯渲染层。

### 不再推荐的大量模式

- hook 内部自己拼 committed + draft + selection
- hook 为了重算而订阅一串别的 hook
- 组件本地再做一层 resolved merge

---

## 事件链路应如何收口

交互复杂度的第二个来源，是 handler 分散在太多 feature/hook 里。

我不建议现在引入完整全局状态机，而建议收敛成 **interaction runtime**。

## 推荐结构

```txt
packages/whiteboard-react/src/runtime/interactions/
  selectionBox.ts
  nodeDrag.ts
  nodeTransform.ts
  edgeConnect.ts
  edgeRouting.ts
  mindmapDrag.ts
```

每个 interaction 模块只做：

1. event-time read
2. write state/draft
3. commit engine command

### 以 node drag 为例

理想链路：

1. `NodeInput` 收到 `pointerdown`
2. 调 `runtime.interactions.nodeDrag.begin(...)`
3. begin 内部读取：
   - `engine.read.index.node`
   - `instance.state.getSelection()`
   - `instance.state.getScope()`
   - `instance.viewport`
4. pointermove 内部只写：
   - `instance.draft.node`
   - `instance.draft.guides`
5. UI 通过 `instance.view.scene.node` 和 `instance.view.overlay` 自动反映变化
6. pointerup 时：
   - 调 engine command commit
   - `draft.clear()`
   - `session -> idle`

### 这条链路的意义

UI 不再知道：

- preview 从哪里来
- guides 从哪里来
- toolbar 是否要 suppress
- edge endpoint 是否要跟着 node draft 走

这些都由 runtime 通过 state/draft/view 自动收敛。

---

## 顶层组件的最优职责分层

当前按 `scene / overlay / surface / input` 分层是对的，但还可以再明确一点。

## 推荐结构

```tsx
<WhiteboardRoot>
  <InputLayer />
  <ViewportStage>
    <SceneLayer />
    <OverlayLayer />
  </ViewportStage>
  <SurfaceLayer />
</WhiteboardRoot>
```

进一步拆开：

```tsx
<WhiteboardRoot>
  <ShortcutInput />
  <CanvasInput />
  <NodeInput />
  <EdgeInput />

  <ViewportStage>
    <NodeSceneLayer />
    <EdgeSceneLayer />
    <MindmapSceneLayer />

    <SelectionBoxOverlay />
    <GuidesOverlay />
    <NodeHandlesOverlay />
    <EdgeControlsOverlay />
    <ScopeOverlay />
  </ViewportStage>

  <NodeToolbarSurface />
  <ContextMenuSurface />
</WhiteboardRoot>
```

## 各层职责

### `input`

- 只绑定事件
- 只调用 interaction runtime
- 不处理 UI 合成逻辑

### `scene`

- 只渲染 scene entity
- 只读 `instance.view.scene.*`

### `overlay`

- 只渲染 overlay
- 只读 `instance.view.overlay`

### `surface`

- 只渲染 toolbar/context menu
- 只读 `instance.view.surface`

---

## 推荐的最终目录结构

最理想的结构：

```txt
packages/whiteboard-react/src/
  runtime/
    instance/
      create.ts
      types.ts
    state/
      index.ts
      selection.ts
      scope.ts
      session.ts
      surface.ts
      tool.ts
    draft/
      index.ts
      node.ts
      edge.ts
      guides.ts
      selectionBox.ts
      connection.ts
      mindmap.ts
    view/
      index.ts
      types.ts
      scene/
        node.ts
        edge.ts
        mindmap.ts
      overlay.ts
      surface.ts
    interactions/
      nodeDrag.ts
      nodeTransform.ts
      edgeConnect.ts
      edgeRouting.ts
      selectionBox.ts
      mindmapDrag.ts

  scene/
    NodeSceneLayer.tsx
    EdgeSceneLayer.tsx
    MindmapSceneLayer.tsx

  overlay/
    OverlayLayer.tsx
    SelectionBoxOverlay.tsx
    GuidesOverlay.tsx
    NodeHandlesOverlay.tsx
    EdgeControlsOverlay.tsx
    ScopeOverlay.tsx

  surface/
    SurfaceLayer.tsx
    toolbar/
    context-menu/

  input/
    CanvasInput.tsx
    NodeInput.tsx
    EdgeInput.tsx
    ShortcutInput.tsx
```

如果不想大规模移动目录，至少要做到概念上的一致：

- `runtime` 是唯一中轴
- `scene / overlay / surface / input` 是唯一顶层职责划分

---

## 哪些现有结构应继续保留

下面这些不是问题，不需要因为追求“更简短”而删掉。

### 1. draft 内部细粒度订阅

保留：

- node draft 按 `nodeId` 订阅
- edge draft 按 `edgeId` 订阅

这是 hot path 性能基础。

### 2. event-time read

保留：

- `instance.read.index.node`
- `instance.read.index.snap`
- `instance.viewport`
- `instance.read.container`

拖拽、命中测试、路由等热路径不应该转成广泛 React 订阅。

### 3. Jotai 作为 state 存储底座

保留：

- Jotai 原子实现 state
- 但对外统一成 runtime 概念，不把 atom 暴露成系统主认知

---

## 哪些现有结构应逐步删除

## 1. `read.view` 和 `useXxxView` 的双层体系

当前最该删的是“getter 在 runtime，订阅胶水在 hook”这套分裂。

最终应收成：

- `instance.view.xxx.get`
- `instance.view.xxx.subscribe`

React 只保留通用 `useView/useKeyedView`。

## 2. feature 本地 merge

要逐步删除：

- NodeItem/EdgeItem 本地再 apply draft
- overlay/surface 本地再拼 selection/session/scope
- 各 feature 本地判断同一套显示规则

这些都应回到 runtime view。

## 3. 把很多 domain 当作主要对外概念

内部可以继续保留：

- `selection.ts`
- `scope.ts`
- `session.ts`

但对外最好统一成：

- `instance.state`

而不是让每个调用点都面对一堆平级子系统。

## 4. `transient` 作为公共语言

统一改成：

- 对外：`draft`
- 内部：可以保留 transient 实现细节

`transient` 适合当内部实现词，不适合继续当全局架构词。

---

## 我认为最值的一刀

如果只能做一个全局收益最大的重构，我会选：

**把 `instance.read.view` 重做成真正的 `instance.view` runtime，并统一提供 subscribe 能力。**

原因：

- 它能砍掉大量重复的 view hook 胶水
- 它能让 UI 真正只消费 resolved data
- 它能让 state/draft/view 边界彻底清楚
- 它能减少“一个事实在 getter、hook、组件里被重复拼装”的问题

这是全局复杂度最高收益的收口点。

---

## 建议迁移顺序

## Phase 1：定义统一 view 基础接口

目标：

- 引入 `ValueView / KeyedView`
- 引入 `useView / useKeyedView`

产物：

- `instance.view.selection`
- `instance.view.overlay`
- `instance.view.surface`
- `instance.view.scene.node`
- `instance.view.scene.edge`

## Phase 2：逐步替换 React 侧 view hook

目标：

- `useOverlayView`、`useSurfaceView`、`useNodeView`、`useEdgeView` 退化或删除

结果：

- React 层不再理解复杂订阅逻辑

## Phase 3：统一 state 语义出口

目标：

- 把对外 editor runtime 语义收成统一 `instance.state`
- `context menu`/`toolbar menu` 收口到 `surface`

结果：

- handler 和 runtime 读取路径更短

## Phase 4：interaction runtime 收口

目标：

- 把 nodeDrag / nodeTransform / edgeConnect / edgeRouting / selectionBox / mindmapDrag 收成 runtime interaction 模块

结果：

- 事件链路从 feature/hook 分散实现变成统一 runtime 行为

## Phase 5：删除历史概念壳

目标：

- 删掉 feature 本地 merge
- 删掉历史 `useXxxView/useXxxState`
- 删掉对外的 `transient` 认知

结果：

- 架构真正收敛成：
  - engine
  - state
  - draft
  - view
  - commands

---

## 最终判断

从全局角度看，最优方案不是：

- 把一切塞进 engine
- 把一切做成 atom
- 把一切做成一个 mega hook
- 在现有 feature 上不停打补丁

最优方案是：

1. `engine` 只管 committed document/runtime
2. `state` 只管 raw editor UI state
3. `draft` 只管交互期视觉覆盖
4. `view` 作为一等 runtime 统一产出 resolved UI 结果
5. `input` 只驱动 interaction runtime
6. `scene / overlay / surface` 只消费 resolved view

如果做到这一步，复杂度不是“从一个文件挪到另一个文件”，而是从根本上减少：

- 概念数量
- 订阅胶水数量
- 状态拼装层数
- feature 间认知耦合

