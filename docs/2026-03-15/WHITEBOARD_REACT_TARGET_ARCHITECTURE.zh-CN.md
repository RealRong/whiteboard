# Whiteboard React 最优形态架构设计

## 目标

这份文档不考虑兼容成本，也不以“尽量少改代码”为目标。

它只回答一个问题：

如果以“实现同一目标时最大程度减少复杂度”为第一优先级，`packages/whiteboard-react` 的最佳架构应该是什么样。

这里的“复杂度”主要指：

- 需要理解的概念数量
- 同一个事实被表达的次数
- UI 自己拼状态的程度
- 事件链路跨模块跳转的长度
- 一个功能改动时需要同时碰多少层

## 结论摘要

最优形态不是继续在现有结构上做局部打磨，而是把 `whiteboard-react` 明确重构成一个 **editor runtime**：

- `engine` 只负责 committed document、geometry、index、commands
- `react runtime` 只负责 editor 自己的 state、draft、resolved view
- UI 只消费 resolved view
- 事件处理只写 raw state 和 draft
- `instance` 成为唯一运行时中轴

一句话总结：

**把“文档运行时”和“编辑器运行时”彻底分层，然后让 UI 不再自己拼 committed + selection + transient + interaction + scope。**

## 当前架构的根本问题

当前代码已经往正确方向收了很多，但从全局看，复杂度仍主要来自 5 个问题。

### 1. 真相层偏多

当前 UI 事实分散在：

- engine committed data
- `selection`
- `container/scope`
- `tool`
- `interaction`
- `toolbar menu`
- `context menu`
- `transient`

这些状态局部都合理，但全局缺少一个强中轴，导致 UI 常常要跨多个域理解同一件事。

### 2. UI 仍然经常自己拼状态

典型模式是：

- 从 engine 读 committed entry
- 从 transient 读 draft
- 从 selection 读选中态
- 从 interaction 读是否显示某个 overlay
- 从 scope 读当前是否在 container 内

然后在组件或 feature 里现场 merge。

这会导致：

- merge 规则分散
- 同一显示逻辑在多处重复
- 任意一个上游状态改动，都可能引发多处重算

### 3. runtime 没有完整挂在 instance 上

现在 instance 持有：

- engine
- uiStore
- 部分 state/read/commands

但 transient 仍在 [`packages/whiteboard-react/src/Whiteboard.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/Whiteboard.tsx) 里创建，然后作为 prop 继续透传。

这意味着真正的 editor runtime 被拆成两部分：

- `instance`
- React 组件树

这是一个错误边界。

### 4. transient 是实现细节，但暴露成了公共概念

现在存在：

- `transient.node`
- `transient.edge`
- `transient.guides`
- `transient.connection`
- `transient.selection`
- `transient.mindmap`

这些内部拆分在性能上没问题，但对外暴露成多个概念，会放大理解成本。

对外真正需要的概念只有一个：

- `draft`

### 5. UI 的分层仍按“对象”而不是“职责”

当前顶层 feature 更接近：

- NodeFeature
- EdgeFeature
- SelectionFeature
- NodeToolbarFeature
- ContextMenuFeature

这会让某些 feature 同时承担：

- scene 渲染
- overlay 渲染
- 事件绑定
- 状态选择
- resolved merge

这不是一个最简结构。

## 最优架构的设计原则

### 原则 1：只保留三类真相

整个 editor runtime 最多只保留三类 source of truth：

1. `document`
2. `editor state`
3. `draft`

其他全部都是派生。

### 原则 2：engine 不理解 UI runtime

`engine` 负责：

- document
- projection
- geometry
- index
- committed commands

`engine` 不负责：

- context menu
- toolbar
- selection box
- guides
- node drag preview
- routing preview

这些都属于 editor runtime。

### 原则 3：UI 尽量只读 resolved view

UI 组件不应该到处自己拼：

- committed
- selection
- scope
- draft
- session
- surface

UI 应该优先读：

- scene view
- overlay view
- surface view

### 原则 4：事件处理只写 raw state 和 draft

事件 handler 不负责直接组织 UI。

它只做三件事：

1. 读取 committed read/index 和 raw editor state
2. 写入 session / surface / selection / scope / draft
3. 在提交点调用 engine commands

### 原则 5：instance 是唯一运行时中轴

所有跨 feature 的 editor runtime 都应挂到 instance 上。

不再允许：

- 在组件树中额外创建 runtime 子系统
- 再通过 props 透传到各个 feature

## 最优分层

最优形态可以拆成 4 层：

1. `document/runtime`
2. `editor state`
3. `draft`
4. `view`

其中只有前三层是真相。

### A. Document / Runtime

这一层继续由 `engine` 提供：

- `read.node`
- `read.edge`
- `read.index`
- `read.viewport`
- `commands.node`
- `commands.edge`
- `commands.document`
- `commands.history`

职责：

- committed 文档
- 几何和索引
- 真正写入文档的命令

### B. Editor State

这是 editor 自己的原始 UI 状态。

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
  surface: {
    contextMenu?: {
      screen: Point
      target: ContextMenuTarget
      restoreSelection: Selection
    }
    toolbarMenu?: {
      key: NodeToolbarMenuKey
    }
  }
}
```

说明：

- `selection / scope / tool / session / surface` 是同一个 runtime 的不同字段
- `context menu` 和 `toolbar menu` 是 surface，不是 session
- 不需要再每个 feature 各自建一个完整 domain 子系统

### C. Draft

这是所有交互期视觉草稿的统一层。

推荐最终模型：

```ts
type DraftState = {
  nodeById: ReadonlyMap<NodeId, NodeDraft>
  edgeById: ReadonlyMap<EdgeId, EdgeDraft>
  connection?: ConnectionDraft
  selectionBox?: Rect
  guides: readonly Guide[]
  mindmap?: MindmapDraft
}
```

说明：

- `draft` 只表示视觉覆盖
- `draft` 不表示 selection
- `draft` 不表示 toolbar/context-menu open
- `draft` 不表示交互模式

对外暴露时，统一叫 `draft`。

内部实现仍然可以按性能需求拆成：

- keyed store
- value store
- external store
- atom

但这些都是实现细节，不应该成为外部概念。

### D. View

这一层是整个架构的关键中轴。

它负责把：

- document
- editor state
- draft

解析成 UI 可直接消费的结果。

推荐最终模型：

```ts
type EditorView = {
  scene: {
    node: (nodeId: NodeId) => NodeSceneItem | undefined
    edge: (edgeId: EdgeId) => EdgeSceneItem | undefined
    mindmap: (rootId: NodeId) => MindmapSceneItem | undefined
  }
  overlay: {
    selectionBox?: Rect
    guides: readonly Guide[]
    nodeHandleNodeIds: readonly NodeId[]
    showNodeConnectHandles: boolean
    showEdgeControls: boolean
    activeScope?: {
      nodeId: NodeId
      title: string
      rect: Rect
    }
  }
  surface: {
    toolbar?: NodeToolbarView
    contextMenu?: ContextMenuView
  }
}
```

说明：

- `scene` 只负责实体渲染所需数据
- `overlay` 只负责叠层可见结果
- `surface` 只负责表层 UI

UI 组件只消费这一层，不再关心底下用了哪些 raw state 和 draft。

## 最优 instance API

如果不考虑重构成本，`InternalWhiteboardInstance` 应该重设计为下面的结构：

```ts
type InternalWhiteboardInstance = {
  engine: EngineInstance
  uiStore: Store
  viewport: WhiteboardViewport

  state: {
    tool: {
      get(): Tool
    }
    selection: {
      get(): Selection
      contains(nodeId: NodeId): boolean
    }
    scope: {
      get(): ScopeState
    }
    session: {
      get(): InteractionSession
    }
    surface: {
      getContextMenu(): ContextMenuState | undefined
      getToolbarMenu(): ToolbarMenuState | undefined
    }
  }

  draft: {
    node: KeyedDraftReader<NodeId, NodeDraft>
    edge: KeyedDraftReader<EdgeId, EdgeDraft>
    connection: ValueDraftReader<ConnectionDraft | undefined>
    selectionBox: ValueDraftReader<Rect | undefined>
    guides: ValueDraftReader<readonly Guide[]>
    mindmap: ValueDraftReader<MindmapDraft | undefined>
    clear(): void
  }

  read: {
    ...EngineRead
    container: ContainerRead
    view: {
      selection(): SelectionView
      sceneNode(nodeId: NodeId): NodeSceneItem | undefined
      sceneEdge(edgeId: EdgeId): EdgeSceneItem | undefined
      overlay(): OverlayView
      toolbar(): NodeToolbarView | undefined
      contextMenu(): ContextMenuView | undefined
    }
  }

  commands: {
    ...EngineCommands
    tool: {
      set(tool: Tool): void
    }
    selection: {
      select(nodeIds: readonly NodeId[], mode?: SelectionMode): void
      selectEdge(edgeId?: EdgeId): void
      clear(): void
    }
    scope: {
      enter(nodeId: NodeId): void
      exit(): void
    }
    session: {
      beginSelectionBox(): void
      beginNodeDrag(): void
      beginNodeTransform(): void
      beginEdgeConnect(): void
      beginEdgeRouting(): void
      end(): void
    }
    surface: {
      openContextMenu(payload: ContextMenuOpenPayload): void
      closeContextMenu(mode: 'dismiss' | 'action'): void
      openToolbarMenu(key: NodeToolbarMenuKey): void
      toggleToolbarMenu(key: NodeToolbarMenuKey): void
      closeToolbarMenu(): void
    }
    draft: {
      clear(): void
    }
  }
}
```

### 这个 API 的关键收益

- 所有 editor runtime 都挂在 instance 上
- UI 和 handler 都只面对一个中轴
- `transient` 不再需要从组件树透传
- `selection / scope / session / surface / draft / view` 边界清晰

## 最优 UI 分层

当前按 feature 对象拆顶层组件不是最简结构。

更优的方式是按职责分层。

### 1. Scene

职责：

- committed 实体和 resolved scene item 渲染

推荐包含：

- `NodeLayer`
- `EdgeLayer`
- `MindmapLayer`

### 2. Overlay

职责：

- 编辑叠层渲染

推荐包含：

- selection box
- guides
- node transform handles
- node connect handles
- edge selected controls
- active scope outline

### 3. Surface

职责：

- 浮层 UI

推荐包含：

- toolbar
- context menu

### 4. Input

职责：

- 绑定 DOM 事件
- 驱动 handler

推荐包含：

- canvas input
- node input
- edge input
- shortcut input

## 顶层组件的最优形态

推荐最终顶层结构：

```tsx
<WhiteboardRoot>
  <InputFeature />
  <ViewportScene>
    <SceneFeature />
    <OverlayFeature />
  </ViewportScene>
  <SurfaceFeature />
</WhiteboardRoot>
```

进一步展开：

```tsx
<WhiteboardRoot>
  <ShortcutInput />
  <CanvasInput />
  <ViewportScene>
    <NodeLayer />
    <EdgeLayer />
    <MindmapLayer />
    <SelectionBoxOverlay />
    <GuidesOverlay />
    <NodeHandlesOverlay />
    <EdgeControlsOverlay />
    <ScopeOverlay />
  </ViewportScene>
  <NodeToolbarSurface />
  <ContextMenuSurface />
</WhiteboardRoot>
```

### 这个结构的意义

- scene 和 overlay 的职责清晰
- surface 不再混在实体 feature 里
- input 只负责事件，不负责 UI
- 每层订阅边界更稳定

## 推荐的数据流

以 node drag 为例，理想链路应该是：

1. `NodeInput` 捕获 pointerdown
2. handler 读取：
   - `instance.state.selection`
   - `instance.read.index.node`
   - `instance.read.container`
3. handler 写入：
   - `instance.commands.session.beginNodeDrag()`
4. pointermove 期间只写：
   - `instance.draft.node`
   - `instance.draft.guides`
5. `instance.read.view.sceneNode(nodeId)` 自动合并 committed node 和 node draft
6. `instance.read.view.overlay()` 自动给出 handles/guides 等显示结果
7. UI 渲染 scene + overlay
8. pointerup 时提交 engine command
9. 清空 draft
10. `session -> idle`

这里 UI 不再需要知道：

- node draft 来自哪里
- guides 是 atom 还是 external store
- 当前 interaction 是否 suppress chrome

UI 只知道：

- scene node view
- overlay view

## 对现有结构的裁剪建议

如果按最优形态重构，建议做下面这些“概念级删除”。

### 应删除的暴露面

1. 删除组件层创建 transient runtime 的方式
   - `createTransient()` 不再在 `Whiteboard.tsx` 中调用

2. 删除将 transient 作为 prop 透传的方式
   - `NodeFeature transient`
   - `EdgeFeature node/edge/connection`
   - `SelectionFeature selection`

3. 删除“很多 feature 各自维护自己的 view 中轴”的方向
   - 保留局部 view helper
   - 但引入更高一级的 `instance.read.view`

4. 删除“同一层里既有行为又有叠层又有实体渲染”的大 feature
   - 特别是 `NodeFeature`

5. 删除“transient 作为公共认知”
   - 对外统一为 `draft`

### 应保留的东西

1. 保留 `engine` 的 committed read/commands
2. 保留 `selection` 的窄订阅入口
3. 保留 `session` 联合类型设计
4. 保留 per-node / per-edge draft 的性能优化
5. 保留 resolved view 的方向

## 命名建议

为了减少概念量，建议统一使用下面这些词，不再混用：

- `state`
  - editor 原始 UI 状态
- `draft`
  - 交互中的视觉草稿
- `view`
  - resolved 结果
- `scene`
  - 实体渲染层
- `overlay`
  - 编辑叠层
- `surface`
  - toolbar/context-menu 这类浮层
- `input`
  - DOM 事件接入层

不建议继续扩大这些词的使用：

- `transient`
- `resolved`
- `chrome`
- `feature`

这些词不是不能用，而是容易让体系越长越抽象。

## 目录结构建议

如果允许重构目录，建议最终收成：

```txt
packages/whiteboard-react/src/
  runtime/
    instance.ts
    state.ts
    draft.ts
    view.ts
    commands.ts
  scene/
    NodeLayer.tsx
    EdgeLayer.tsx
    MindmapLayer.tsx
  overlay/
    OverlayFeature.tsx
    NodeHandlesOverlay.tsx
    EdgeControlsOverlay.tsx
    GuidesOverlay.tsx
    SelectionBoxOverlay.tsx
    ScopeOverlay.tsx
  surface/
    SurfaceFeature.tsx
    toolbar/
    context-menu/
  input/
    CanvasInput.tsx
    NodeInput.tsx
    EdgeInput.tsx
    ShortcutInput.tsx
  node/
  edge/
  viewport/
  common/
```

### 如果不想大改目录

即使不调整目录，也至少应该在概念上做到：

- `runtime` 成为唯一中轴
- `scene/overlay/surface/input` 成为顶层职责分层

目录只是表现，关键是边界。

## 性能约束下的实现建议

最优架构不能牺牲 hot path。

因此下面这些点要明确保留。

### 1. draft 继续支持细粒度订阅

例如：

- node draft 仍然可以按 `nodeId` 订阅
- edge draft 仍然可以按 `edgeId` 订阅

只是对外不要再暴露成很多概念。

### 2. view 允许“集中 API + 内部分级订阅”

也就是说，对外是：

```ts
instance.read.view.sceneNode(nodeId)
```

但内部仍然可以：

- 订阅 committed node entry
- 订阅 node draft
- 做 memo/cache

### 3. 高频 handler 优先 event-time read

例如拖拽和 hit-test 路径，仍优先读取：

- `instance.read.viewport`
- `instance.read.index.node`
- `instance.read.container`

而不是在 handler 组合层广泛订阅 atom。

### 4. overlay view 可以分裂实现，统一出口

`overlay()` 对外是统一概念，但内部可以按模块派生：

- handles overlay
- guides overlay
- selection box overlay
- edge controls overlay

核心是统一出口，而不是必须合成一个巨大的 atom。

## 迁移原则

虽然本文不考虑兼容成本，但落地时仍建议按下面顺序做。

### Phase 1: instance 接管 runtime

目标：

- 把 transient 从 `Whiteboard.tsx` 收回 instance
- 增加 `instance.draft`

### Phase 2: 建立统一 view 中轴

目标：

- 增加 `instance.read.view`
- 把 `selection / toolbar / context-menu / overlay` 的集中派生挂到这层

### Phase 3: 重构顶层组件分层

目标：

- 从 `NodeFeature / EdgeFeature / ...` 调整为
  - scene
  - overlay
  - surface
  - input

### Phase 4: 删除旧暴露面

目标：

- 删除 transient props 透传
- 删除多余的 feature 本地 merge
- 删除重复 view 中间层

## 最终判断

如果只从“全局最省复杂度”的角度看，最优答案不是：

- 把所有东西塞进 engine
- 把所有东西做成 jotai atom
- 把所有东西做成一个大 hook
- 把所有组件都变 dumb

最优答案是：

1. `engine` 只管 committed document/runtime
2. `react runtime` 只管 editor state + draft + view
3. `instance` 成为唯一中轴
4. UI 只读 resolved view
5. handler 只写 raw state 和 draft
6. 目录和组件结构按 `scene / overlay / surface / input` 分层

这套结构比当前方案更激进，但它能真正减少概念数，而不是只把复杂度从一个文件挪到另一个文件。
