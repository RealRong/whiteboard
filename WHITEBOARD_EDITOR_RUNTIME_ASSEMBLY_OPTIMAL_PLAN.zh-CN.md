# Whiteboard Editor Runtime 装配链长期最优方案

## 1. 文档目标

这份文档只回答两个问题：

1. `whiteboard-editor` 的 `Editor Runtime`，长期最优的装配链应该长什么样。
2. 当前最别扭的 `context`，如果完全按长期最优来做，最终到底应不应该存在于 runtime 中，以及最小模型到底是什么。

这里不讨论兼容层，不讨论过渡态，也不以“现有代码已经这样了”为前提做保守设计。

这份文档只写最终形态。

---

## 2. 核心结论

先把结论说死。

### 2.1 长期最优下，runtime 不应该拥有 `contextMenu` 子系统

也就是说，下面这些都不应该存在于最终的 `Editor Runtime` public API：

- `editor.contextMenu.open(...)`
- `editor.contextMenu.dismiss(...)`
- `editor.contextMenu.clear()`
- `editor.commands.context.*`
- `editor.read.context.*`

原因不是命名不够好，而是它们都在表达一件不属于 runtime 的事情：

- 菜单是否打开
- 菜单在哪里打开
- 菜单如何关闭
- 菜单如何组织

这些都是 host / React / presentation 的问题，不是 editor runtime 的问题。

### 2.2 所谓 `context`，底层其实不是一个独立 subsystem，而是 `selection semantics`

如果从语义上重新看待“context”，它本质上只是在回答下面这些问题：

- 当前选中了什么
- 当前 selection 的摘要是什么
- 当前 selection 能做哪些动作
- 当前 selection 的样式聚合是什么
- 当前 selection 的类型统计是什么

这些都不是“菜单状态”，而是 **selection 自己的稳定语义读模型**。

所以长期最优下：

- `context` 不应该是独立 namespace
- `selection` 才是主轴
- “menu” 只是 React 对 selection 语义的一种表现形式

### 2.3 runtime 的最小模型不是 `context service`，而是两类东西

第一类是稳定语义事实：

- `editor.read.selection`
- `editor.read.pick`
- `editor.read.node`
- `editor.read.edge`
- `editor.read.frame`
- `editor.read.tool`

第二类是语义写入口：

- `editor.commands.selection`
- `editor.commands.node`
- `editor.commands.edge`
- `editor.commands.frame`
- `editor.commands.tool`

除此之外，不需要再有一个 `context subsystem`。

### 2.4 菜单的打开、锚点、关闭、渲染全部属于 React/host

长期最优下，React 自己持有类似下面这样的本地状态即可：

```ts
type ContextUiState = {
  screen: Point
  world: Point
  pick: PointerPick
} | null
```

然后用这份 UI state 配合：

- `editor.read.selection`
- `editor.commands`
- `editor.registry`

去构造 context menu、selection toolbar、floating actions，或者任何其他 UI。

### 2.5 整个 Editor Runtime 装配链会因此明显变直

只要把 `context` 从 runtime 的 `read` 和 `commands` 里彻底删除，整条链会同时简化三层：

- `createBaseRuntimeRead -> createRuntimeRead` 这层 split 可以大幅收缩，甚至直接消失
- `createCoreCommands -> createPublicCommands` 这层 split 可以直接消失
- `createFeatureCapsules -> assembleFeatureCapsules` 的压力会明显下降，最终可以整体删除

一句话总结：

**`context` 不是唯一问题，但它是当前中间层最明显的耦合放大器。长期最优不是重做 `context service`，而是删除 runtime 的 `context subsystem`，把 selection 语义收回 `read.selection`，把菜单完全上移到 React/host。**

---

## 3. 当前为什么难受

这部分不谈“感觉绕”，只谈底层模型到底哪里错了。

## 3.1 当前把 4 层完全不同的东西混成了一个 `context`

现在所谓的 `context`，实际上混了下面 4 层。

### 第一层：secondary/context 触发后的选择策略

例如：

- 右键一个未选中的 node，要不要先替换 selection
- 右键背景，要不要先清空 selection
- 右键 frame 外节点，要不要先 exit frame

这层本质上是：

- selection normalization policy

它不是 menu session，也不是 menu view。

### 第二层：selection 语义能力摘要

例如：

- 能不能 group / ungroup
- 能不能 align / distribute
- 能不能 duplicate / delete / lock
- 当前选区的样式聚合
- 当前选区的类型统计

这层会被很多地方复用：

- shortcut
- selection chrome
- context menu
- floating toolbar

所以它不应该挂在 `context` 下，它应该挂在：

- `editor.read.selection`

### 第三层：菜单动作绑定

例如现在这类东西：

- `onSelect`
- `bindAction`
- `bindActionWithArgs`

这层本质是在做：

- UI item -> command invocation

这不是 editor runtime 语义，而是 presentation action binding。

### 第四层：菜单视图模型

例如：

- `ContextMenuView`
- `SelectionMenuView`
- `SelectionMenuItemView`
- `SelectionMenuGroupView`
- 各种 label / group / submenu / tone / disabled

这层已经是非常明确的 UI/presentation 结构，不应该继续留在 editor runtime。

---

## 3.2 `read.context.selection` 的错，不只是命名错

这一行之所以别扭：

```ts
const read = createRuntimeRead({
  base: baseRead,
  contextSelection: context.selectionMenu
})
```

不是因为 `contextSelection` 这个名字不好，而是因为：

**一个 UI menu 派生物被反向塞回了 runtime read 层。**

`read` 应该承载的是：

- 文档事实
- 稳定派生
- 可复用语义读模型

它不应该承载：

- 具体菜单结构
- 已绑定 `onSelect` 的菜单项树
- 任何为了某一种 UI 而构造出来的 view model

所以长期最优不是改名，而是：

- 删除 `read.context.selection`
- 把 selection 语义数据收回 `read.selection`
- 把 menu view 移出 runtime

---

## 3.3 `commands.context` 的错，是把 UI session 控制塞进命令系统

这一行之所以别扭：

```ts
const commands = createPublicCommands({
  core: coreCommands,
  context: context.commands
})
```

不是因为参数多，而是因为：

**context 从根上就不应该并进 commands。**

`commands` 的语义边界应该非常硬：

- 修改文档
- 修改 selection
- 修改 frame
- 修改 viewport
- 修改 tool
- 修改 draw preference

而 `context.open / dismiss / clear` 的语义是：

- 打开 UI
- 关闭 UI
- 清空 UI 临时状态

这根本不是 command domain。

所以长期最优不是换一种 merge 手法，而是：

- `createCommands(...)` 直接产出最终 commands
- `commands.context` 彻底删除

---

## 3.4 当前 `context` 让装配顺序出现了假循环

当前几个最典型的别扭点，其实都来自同一个环：

1. selection menu 需要 commands 才能绑定 menu item action
2. context runtime 需要最终 read / commands 才能产出 view
3. read 又因为要挂 `context.selection` 被迫等待 context
4. commands 又因为要挂 `commands.context` 被迫等待 context

最后就只能出现这些信号：

- `let commands!`
- `commands: () => commands`
- `baseRead / finalRead`
- `coreCommands / publicCommands`
- `capsule augment / assemble merge`

这不是“模块多了自然复杂”，而是：

**一个错误边界把整条链拧成了回环。**

---

## 3.5 当前 `context` 命名本身也已经错位

现在的 `context` 命名还藏着一个更基础的问题：

- 它里面混了 context menu
- 也混了 selection menu

但 selection menu 根本不是 context menu。

selection menu 更像：

- selection chrome
- floating toolbar
- selection actions UI

所以当前 `context` 这个 namespace 本身就过宽了。

长期最优下，应该直接拆成：

- `selection` 语义读模型
- React 侧的 context menu UI
- React 侧的 selection menu / floating toolbar UI

不要再用一个 `context` 词去兜三种东西。

---

## 4. 长期最优下，`context` 的最小模型到底是什么

这是这份文档最重要的部分。

## 4.1 在 runtime 内部，最小模型其实是“没有 context 模型”

这句话要解释清楚。

如果严格按长期最优去收，runtime 不应该再拥有一个单独的：

- `context service`
- `context state`
- `context session`
- `context read`
- `context commands`

也就是说，**runtime 内不存在一个独立的 `context` 模型。**

runtime 内真正存在的，是：

- `selection` 的语义模型
- `pick` 的命中结果
- 若干语义写命令

至于“这次是不是要开菜单、菜单锚在哪、渲染哪组 items”，那不是 runtime 模型。

## 4.2 如果一定要说最小模型，它应该分成 runtime 和 host 两半

### Runtime 半边

runtime 提供：

```ts
type SelectionReadModel = {
  target: SelectionTarget
  summary: SelectionSummary
  capabilities: SelectionCapabilities
  types: readonly SelectionTypeStat[]
  style: SelectionStyleSnapshot | null
}
```

以及：

```ts
type PointerPick
```

### Host / React 半边

React 自己持有：

```ts
type ContextUiState = {
  screen: Point
  world: Point
  pick: PointerPick
} | null
```

这才是长期最优下真正最小、最干净的“context”整体模型。

也就是：

- runtime 负责语义事实
- host 负责 UI 锚点和 UI 生命周期

## 4.3 这意味着 `begin/finish/open/dismiss/clear` 全都不该在 runtime public API 中出现

这是直接推论。

既然 runtime 不拥有 menu session，那么 runtime 就不该公开：

- `begin(...)`
- `finish(...)`
- `open(...)`
- `dismiss(...)`
- `clear()`

这些 API 一旦存在，就说明 runtime 还在拥有“菜单会话”。

而菜单会话本来就不是 runtime 的职责。

## 4.4 React 侧的最小模型是什么

如果只讨论 React/host 侧，context UI 的最小状态其实很简单：

```ts
type ContextUiState =
  | null
  | {
      anchor: {
        screen: Point
        world: Point
      }
      pick: PointerPick
    }
```

这份状态只回答：

- 当前是否打开了 context UI
- 锚点在哪里
- 这次命中了什么目标

它不回答：

- selection 语义是什么
- 能不能 group
- 能不能 duplicate
- style summary 是什么

这些都应该继续从：

```ts
editor.read.selection
```

里读取。

## 4.5 `context` 的最小模型不是菜单，而是“selection semantics + UI anchor”

如果要把一句话说得最准确，我认为应该是：

**长期最优下，所谓 context 的最小模型，不是一个 runtime service，而是 `selection semantics + host-local UI anchor`。**

这比“做一个 contextMenu service”更接近本质。

---

## 5. selection 必须升级成完整语义读模型

如果不把 selection 模型补全，`context` 删除以后，问题还会回来。

因为当前很多“context 能力”，其实只是 selection 语义被挂错了地方。

## 5.1 `read.selection` 不能再只是 `SelectionSummary`

长期最优下，`read.selection` 不应该只是一个 `SelectionSummary`。

它应该直接成为完整的 selection semantic read model：

```ts
type SelectionReadModel = {
  target: SelectionTarget
  summary: SelectionSummary
  capabilities: SelectionCapabilities
  types: readonly SelectionTypeStat[]
  style: SelectionStyleSnapshot | null
}
```

这里各字段的语义：

- `target`
  当前选择目标本身

- `summary`
  几何、边界、box、transform、节点/边统计等稳定摘要

- `capabilities`
  当前 selection 允许做什么

- `types`
  当前 selection 中各节点类型的纯统计

- `style`
  当前 selection 的样式聚合摘要

## 5.2 `SelectionCapabilities` 应该替代当前的 `SelectionCan`

`SelectionCan` 这个名字明显偏 UI。

长期最优下更合理的名字是：

```ts
type SelectionCapabilities = {
  fill: boolean
  stroke: boolean
  text: boolean
  group: boolean
  align: boolean
  distribute: boolean
  makeGroup: boolean
  ungroup: boolean
  order: boolean
  filterByType: boolean
  lock: boolean
  copy: boolean
  cut: boolean
  duplicate: boolean
  delete: boolean
}
```

这个模型的关键点：

- 它不叫 `View`
- 它不叫 `Menu`
- 它不挂在 `context`

它是 selection 的稳定语义能力。

## 5.3 `SelectionTypeStat` 不应该再混 UI 元数据

当前类型统计里混了：

- `name`
- `family`
- `icon`

这些其实都是 UI meta。

长期最优应该拆成纯统计：

```ts
type SelectionTypeStat = {
  type: string
  count: number
  nodeIds: readonly NodeId[]
}
```

然后 React 再用 `registry` 去解析：

- 名称
- 图标
- family

这样：

- runtime 更纯
- React 更灵活
- 非 React host 不会被 UI 元数据绑架

## 5.4 `SelectionStyleSnapshot` 应该成为稳定读模型的一部分

当前样式摘要不应该只为了 context menu 才存在。

它可以同时服务：

- context menu
- floating toolbar
- appearance inspector

所以它应该属于：

- `read.selection.style`

而不属于：

- 某个 menu view

## 5.5 shortcut 也应该直接读 `read.selection.capabilities`

当前 shortcut 读的是：

```ts
editor.read.context.selection.get()?.can
```

长期最优下应该直接变成：

```ts
editor.read.selection.get().capabilities
```

这件事很重要，因为它能证明：

**selection capability 本来就不是 context 数据。**

---

## 6. 菜单应该完全上移到 React / host

既然 runtime 不再拥有 context subsystem，那么菜单的 ownership 也要完全拉正。

## 6.1 context menu 的最终 owner 是 React/host

React 负责：

- 监听 `contextmenu`
- 监听右键 `pointerdown`
- 读取 `editor.read.pick.from(...)`
- 决定是否要先调整 selection
- 持有菜单开关状态
- 记录菜单锚点
- 渲染菜单组件
- 绑定菜单项 action

runtime 不负责任何一个环节。

## 6.2 selection menu / floating toolbar 也应该完全上移

selection menu 本质也是一样：

- 它是 selection 语义的一种 UI 表达

所以它也应该在 React/presentation 层生成，而不是在 runtime 里生成一个 `SelectionMenuView` 再喂给 React。

React 要的应该是：

- `editor.read.selection`
- `editor.commands`
- `editor.registry`

然后自己去构造：

- context menu
- selection toolbar
- floating actions
- 更多变种的操作 UI

## 6.3 action binding 也不应该继续留在 runtime

像下面这些：

- `bindAction`
- `bindActionWithArgs`
- `onSelect`

本质都是 UI action binding。

它们应该和菜单 presenter 在一起，而不是和 runtime read model 在一起。

### 正确分层

runtime 提供：

```ts
editor.commands.node.group.create(...)
editor.commands.node.duplicate(...)
editor.commands.selection.replace(...)
```

React 侧 presenter 负责：

```ts
{
  key: 'duplicate',
  label: 'Duplicate',
  disabled: !selection.capabilities.duplicate,
  onSelect: () => editor.commands.node.duplicate([...selection.target.nodeIds])
}
```

这个 `onSelect` 闭包不应该进入 runtime。

## 6.4 如果以后多 host 需要共享右键策略，应该抽纯 helper，不要抽 service

这里要特别强调。

删除 `context subsystem` 不代表所有和右键相关的逻辑都必须散落在组件里。

如果未来多个 host 都确实需要共享“右键时 selection 如何规范化”的策略，那么应该抽的是：

- **纯函数 helper**

而不是：

- 有状态的 context runtime

例如可以有：

```ts
type ContextSelectionIntent =
  | { kind: 'ignore' }
  | { kind: 'keep' }
  | { kind: 'clear'; exitFrame?: boolean }
  | { kind: 'replace'; target: SelectionTarget; exitFrame?: boolean }

resolveContextSelectionIntent(...)
```

这个 helper 可以放在：

- `whiteboard-core`
- 或 `whiteboard-editor` 的纯算法位置

但它必须满足：

- 输入 plain data
- 输出 plain data
- 不持有 session
- 不产生 view
- 不绑定 command

只有这样，才不会把 `context` 再次做回 subsystem。

---

## 7. 长期最优的 Editor Runtime 装配链

在上面的边界修正之后，整个装配链可以被拉直成非常简单的一条线。

## 7.1 最终装配顺序

我建议最终装配链固定为：

```ts
createEditor
  -> createKernel
  -> createProjectionStores
  -> createRead
  -> createSnap
  -> createCommands
  -> createInteractionFeatures
  -> createInput
  -> createLifecycle
  -> return editor
```

注意：

- 这里已经没有 `context service`
- 这里也没有 `read.context`
- 这里也没有 `commands.context`

## 7.2 第一步：`createKernel`

`kernel` 只保留 editor 基础设施。

长期最优下它只负责：

- `engine`
- `registry`
- `history`
- `viewport`
- `pick`
- `interaction`
- `clipboard`
- `inputPolicy`
- `tool`
- `edit`
- `frame`
- `selection`

它不负责：

- menu state
- context session
- feature projections
- feature builders

也就是说，`kernel` 是 infra root，不是 runtime 总袋子。

## 7.3 第二步：`createProjectionStores`

这一层只创建 feature 需要的临时投影存储：

```ts
const projection = {
  node: createNodeProjectionRuntime(),
  edge: createEdgeProjection(),
  mindmapDrag: createMindmapDragProjectionStore()
}
```

这里仍然建议保留 `projection` 分组。

原因很简单：

- 这是一个真实语义边界
- 不应该为了“扁平”而把它打平

## 7.4 第三步：`createRead`

长期最优下，这里不应该再分：

- `createBaseRuntimeRead`
- `createRuntimeRead`

如果 `context` 已经从 read 里退出，那么 `read` 就应该一次性直接创建最终形态。

建议最终变成：

```ts
const read = createRead({
  engineRead: engine.read,
  registry,
  tool: kernel.tool,
  history: kernel.history,
  drawPreferences: draw.store,
  selection: kernel.selection.source,
  frame: kernel.frame.store,
  pick: kernel.pick,
  viewport: kernel.viewport.read,
  projection
})
```

这里的关键点：

- `read` 不再依赖 `context`
- `read` 不再包含 `context.selection`
- `read.selection` 自己就是完整的选择语义读模型

## 7.5 第四步：`createSnap`

`snap` 的位置不变，但语义要写清楚。

它是：

- spatial runtime

它不是：

- feature capsule
- public projection assemble item
- context subsystem

长期最优下：

- `snap` 继续由 `createEditor` 直接创建
- interaction features 通过 `ctx.spatial.snap` 消费
- public editor 通过 `projection.snap = snap.node.guides` 暴露只读 overlay

它不需要有自己的一层 feature builder。

## 7.6 第五步：`createCommands`

长期最优下，这一步也应该一步到位，不再拆：

- `createCoreCommands`
- `createPublicCommands`

因为只要 `context` 不再并进 commands，`commands` 本身就已经是最终形态。

也就是说：

```ts
const commands = createCommands({
  engine,
  read,
  state,
  tool: kernel.tool,
  history: kernel.history,
  edit: kernel.edit.commands,
  selection: kernel.selection,
  frame: kernel.frame,
  viewportCommands: kernel.viewport.commands,
  viewportRead: kernel.viewport.read,
  draw,
  nodeProjection: projection.node,
  clipboard: ...
})
```

这里没有：

- `let commands!`
- `commands: () => commands`
- `commands.context`

## 7.7 第六步：`createInteractionFeatures`

这一步只装真正的 interaction features：

- draw
- selection
- node
- edge
- mindmap
- viewport
- insert

这里不再混入：

- context
- snap

`context` 已经被删除，`snap` 则是 spatial runtime。

## 7.8 第七步：`createInput`

这一步继续负责：

- interaction registry
- passive runtime
- input router

但它不应该开始掺杂 context menu。

context menu 触发来自 host/React 侧：

- `contextmenu`
- 右键 `pointerdown`

然后由 React 自己决定：

- 读 `pick`
- 调整 selection
- 打开本地菜单 UI

## 7.9 第八步：`createLifecycle`

`lifecycle` 负责清理所有 runtime 临时状态：

- input active state
- edit
- selection
- frame
- feature projections / preview

但它不需要清理：

- context menu state

因为菜单 UI 状态已经不属于 runtime。

---

## 8. feature 装配层的长期最优模型

这部分继续回答前面你一直追问的另一个核心问题：

为什么 `createEditor` 里明明已经有 feature 所需对象了，最后还要绕一圈 `capsule -> assemble`。

答案还是一样：

这是中间协议过多，不是 feature 数量过多。

## 8.1 应该保留的 feature 边界

应该保留：

- `ctx.projection.*`
- `ctx.spatial.*`

因为这两个分组是真实语义边界。

不应该保留：

- `ctx.host`
- `ctx.featureState`

因为它们只是 dependency bag。

## 8.2 feature env 的长期最优形态

长期最优下，interaction feature 应该直接拿一个清晰的 env：

```ts
type FeatureEnv = {
  read: EditorRead
  commands: EditorCommands
  state: EditorState
  config: EditorConfig
  viewport: EditorViewportRuntime
  interaction: InteractionCoordinator
  registry: NodeRegistry
  inputPolicy: ValueStore<EditorInputPolicy>
  projection: {
    node: NodeProjectionRuntime
    edge: EdgeProjection
    mindmapDrag: MindmapDragProjectionStore
  }
  spatial: {
    pick: PickRuntime
    snap: SnapRuntime
  }
  draw: DrawFeatureState
}
```

注意这里已经没有：

- `host`
- `featureState.contextMenu`

## 8.3 不需要 `EditorFeatureCapsule`

长期最优下，不需要再有统一 capsule 协议：

```ts
type EditorFeatureCapsule = {
  interactions?: ...
  passive?: ...
  read?: ...
  commands?: ...
  projections?: ...
  lifecycle?: ...
}
```

它的问题不是“类型不好看”，而是它试图把异构产物硬塞成统一结构。

正确做法是让 feature 直接返回自己真实的结果。

例如：

### `draw` feature

返回：

```ts
{
  interactions,
  preview,
  reset,
  dispose
}
```

### `selection` feature

返回：

```ts
{
  interactions,
  marquee,
  reset,
  dispose
}
```

### `edge` feature

返回：

```ts
{
  interactions,
  passive,
  reset,
  dispose
}
```

然后由 `createInteractionFeatures(...)` 明确拼装最终结果：

```ts
const features = createInteractionFeatures(env)
```

而不是：

```ts
const capsules = createFeatureCapsules(ctx)
const features = assembleFeatureCapsules(capsules)
```

## 8.4 `context` 和 `snap` 都不应该参与 feature assemble

这点要区分清楚。

### `context`

已经删除，不存在 feature assemble 问题。

### `snap`

它本质是 spatial runtime，不是 feature。

所以：

- `snap` 直接由 `createEditor` 管
- interaction feature 通过 `ctx.spatial.snap` 消费

不要再把它塞进 feature assembly。

---

## 9. public Editor API 的长期最优形态

上面的边界重做之后，最终 public API 应该更接近下面这样。

## 9.1 最终顶层结构

```ts
type Editor = {
  read: EditorRead
  state: EditorState
  commands: EditorCommands
  input: EditorInput
  viewport: EditorViewportRuntime
  projection: EditorProjection
  interaction: InteractionCoordinator
  registry: NodeRegistry
  pick: PickRuntime
  config: BoardConfig
  configure: (config: EditorConfigInput) => void
  dispose: () => void
}
```

关键点有两个：

第一，没有 `contextMenu` service。  
第二，也没有 `read.context` 和 `commands.context`。

## 9.2 `EditorRead` 的最终边界

`EditorRead` 应该只包含：

- engine/document facts
- runtime stable derived models
- feature-neutral read helpers

它不应该再包含：

- context menu view
- selection menu view
- 菜单 action 闭包

所以最终应该删除：

```ts
read.context.menu
read.context.selection
```

## 9.3 `EditorCommands` 的最终边界

`EditorCommands` 应该只包含：

- tool
- draw
- edit
- selection
- frame
- viewport
- edge
- node
- mindmap
- clipboard
- insert
- history

它不应该再包含：

```ts
commands.context
```

因为那不是 command domain。

## 9.4 `EditorProjection` 的最终边界

`projection` 仍然保留，并保持纯 overlay 输出：

- `marquee`
- `draw`
- `edge`
- `mindmapDrag`
- `snap`

这里不要把 context 再塞进去。

context menu 不是 projection。

---

## 10. React/host 侧最终应该怎么用

这部分很重要，因为当前 React 真实消费了：

- `editor.read.context.menu`
- `editor.read.context.selection`
- `editor.commands.context.*`

长期最优不是简单删掉，而是把消费方式完全改正。

## 10.1 ContextMenu 组件的最终职责

ContextMenu 组件应该自己负责：

- 监听右键事件
- 计算 anchor
- 保存本地 `ContextUiState`
- 读取 `editor.read.selection`
- 基于 selection 语义和 pick 生成菜单模型
- 渲染菜单
- 点击菜单项时直接调用 `editor.commands.*`

它不应该再去调用：

- `editor.commands.context.open(...)`
- `editor.commands.context.dismiss(...)`

## 10.2 推荐的 React 流程

我建议最终流程明确写成：

1. 监听 `contextmenu` 或右键 `pointerdown`
2. 调用 `editor.read.pick.from(event, container)` 得到 `pick`
3. 根据 `pick` 和当前 selection 决定是否要先规范化 selection
4. 记录本地 `ContextUiState`
5. 读取 `editor.read.selection`
6. 调用 presenter 构造菜单模型
7. 渲染菜单
8. 菜单关闭时清空本地 `ContextUiState`

整个过程中：

- runtime 不拥有菜单状态
- runtime 不拥有菜单生命周期
- runtime 不拥有菜单项结构

## 10.3 右键时 selection 是否需要变化

这里要给出长期最优判断。

我的建议是：

- runtime 不拥有这条策略
- host 自己决定，并在需要共享时才抽纯 helper

也就是说，React 可以有自己的规则：

- 右键未选中的 node/edge：先 replace selection
- 右键背景：先 clear selection
- 特殊场景：保持当前 selection

但这些都不应该通过 runtime 的有状态 context service 来完成。

如果多个 host 都需要一致策略，才抽：

```ts
resolveContextSelectionIntent(...)
```

这样的纯函数。

## 10.4 shortcut 最终怎么读

当前：

```ts
const can = editor.read.context.selection.get()?.can
```

最终：

```ts
const selection = editor.read.selection.get()
const can = selection.capabilities
```

这样 shortcut、selection chrome、context menu 会依赖同一份 selection semantic model。

这才是长期稳定的共享基础。

---

## 11. 最终文件结构建议

长期最优下，我建议把 ownership 直接改成下面这样。

## 11.1 editor runtime

```txt
packages/whiteboard-editor/src/runtime/editor/
  createEditor.ts
  createInput.ts
  createLifecycle.ts
  kernel.ts
  features/
    createInteractionFeatures.ts
    draw.ts
    selection.ts
    node.ts
    edge.ts
    mindmap.ts
    viewport.ts
    insert.ts
```

这里没有：

- `contextMenu/`
- `context/`

因为 runtime 不再拥有 context subsystem。

## 11.2 runtime read

```txt
packages/whiteboard-editor/src/runtime/read/
  index.ts
  selection.ts
  node.ts
  edge.ts
  frame.ts
  pick.ts
  tool.ts
  ...
```

其中：

- `selection.ts` 升级为完整 selection semantic read model
- 不再有 `read/context.ts`

## 11.3 editor types

当前的：

```txt
packages/whiteboard-editor/src/types/context.ts
```

混了 session type、view type、menu type、selection menu type，长期最优不应该继续保留这种混装。

建议拆解为两类：

### editor 包内保留的

- `SelectionCapabilities`
- `SelectionTypeStat`
- `SelectionStyleSnapshot`
- 右键策略相关纯 helper 的输入输出类型

### editor 包内删除的

- `ContextMenuView`
- `SelectionMenuView`
- `SelectionMenuItemView`
- `SelectionMenuGroupView`
- `SelectionMoreMenuSectionView`
- `ContextRuntime`
- `ContextDismissMode`

## 11.4 React / presentation

```txt
packages/whiteboard-react/src/features/selection/context/
  buildContextMenuModel.ts
  buildSelectionMenuModel.ts
  menuTypes.ts
  resolveContextUiState.ts
```

也就是说：

- editor runtime 提供 selection 语义数据和命令
- React 提供菜单 view model、action binding 和组件

---

## 12. 当前这些文件/结构为什么最终都应该消失

这部分把“该删什么”写透。

## 12.1 应该删除

```txt
packages/whiteboard-editor/src/runtime/context/selection/read.ts
packages/whiteboard-editor/src/runtime/context/selection/view.ts
packages/whiteboard-editor/src/runtime/context/menu/view.ts
packages/whiteboard-editor/src/runtime/read/context.ts
```

原因：

- 它们都在生产 UI view model
- 或者在把 UI view model 重新塞回 runtime read

## 12.2 应该删除

```txt
packages/whiteboard-editor/src/runtime/context/
```

如果未来还需要保留右键策略复用，应该只保留纯 helper，不保留一个有状态 runtime 子系统。

## 12.3 应该删除

```txt
packages/whiteboard-editor/src/runtime/editor/features/capsules.ts
packages/whiteboard-editor/src/runtime/editor/features/assemble.ts
packages/whiteboard-editor/src/types/runtime/editor/capsule.ts
```

原因：

- 它们是为了合并异构产物而发明的中间协议
- 在 context 退出 read/commands 后，这层价值会进一步降低

## 12.4 应该收敛

```txt
packages/whiteboard-editor/src/runtime/read/index.ts
```

最终应该只负责 assemble read model，不再接受：

```ts
contextSelection: ...
```

## 12.5 应该收敛

```txt
packages/whiteboard-editor/src/runtime/commands/index.ts
```

最终应该直接返回最终 commands，不再需要：

- context command placeholder
- public command merge

---

## 13. 不应该再出现的代码味道

长期最优落地后，下面这些味道应该全部消失。

## 13.1 不再有

```ts
let commands!: Editor['commands']
```

## 13.2 不再有

```ts
commands: () => commands
```

## 13.3 不再有

```ts
createRuntimeRead({
  base,
  contextSelection: ...
})
```

## 13.4 不再有

```ts
createPublicCommands({
  core,
  context
})
```

## 13.5 不再有

```ts
editor.read.context.menu
editor.read.context.selection
editor.commands.context.open(...)
editor.commands.context.dismiss(...)
editor.contextMenu.open(...)
editor.contextMenu.dismiss(...)
```

## 13.6 不再有

```ts
type SelectionMenuItemView = {
  ...
  onSelect?: () => unknown
}
```

因为把闭包塞进 runtime read/view model，本身就是强耦合信号。

## 13.7 不再有

```ts
type ContextMenuView = ...
type SelectionMenuView = ...
```

这些类型如果继续存在，也应该存在于 React/presentation 包，而不是 editor runtime。

---

## 14. 最终推荐的一步到位重构方向

如果完全按长期最优执行，不考虑兼容和过渡，我建议顺序如下。

### 第一步

先把 `context` 从 runtime 里彻底删掉：

- 删 `read.context.*`
- 删 `commands.context.*`
- 删 `editor.contextMenu.*`
- 删 runtime `context/` 目录

### 第二步

把 selection capability / style / type stats 收回 `read.selection`

### 第三步

把 `ContextMenuView` 和 `SelectionMenuView` 整体移出 editor runtime

### 第四步

让 React/host 侧直接根据：

- `ContextUiState`
- `editor.read.selection`
- `editor.commands`
- `editor.registry`

构造菜单 UI

### 第五步

删 `baseRead/finalRead` 和 `coreCommands/publicCommands` 这两层人工 split

### 第六步

删 `capsule/assemble`

### 第七步

如果多个 host 真有共享右键策略需求，再补一个纯 helper：

- `resolveContextSelectionIntent(...)`

但不要重新引入 context service。

### 第八步

最终把 runtime/editor 收成：

- kernel
- read
- commands
- interaction features
- input
- lifecycle

这就是长期最小闭环。

---

## 15. 一句话结论

**长期最优不是把当前 `context` 改叫 `contextMenu` 或再做一层更薄的 service，而是彻底删除 runtime 的 `context subsystem`，让 runtime 只保留 `selection semantics + pick + commands`，把菜单的锚点、打开关闭、view model、action binding 全部上移到 React/host；这样整个 Editor Runtime 装配链才能真正拉直，`read`、`commands`、`features` 的边界才会稳定。**
