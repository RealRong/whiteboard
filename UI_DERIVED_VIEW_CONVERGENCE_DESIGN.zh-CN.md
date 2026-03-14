# Whiteboard UI 集中派生设计

## 背景

当前 `whiteboard-react` 的一个核心演进方向已经比较明确：

- 原始状态按领域拆开存
- UI 尽量不要自己拼多份原始状态
- 在中间增加一层集中派生
- 让组件尽量只消费 resolved 结果

这条路线在 `transient -> resolved view` 和最近的 `chromeView` 上已经验证过一次，方向是对的。

问题不在于 atom 太多，也不在于 hook 太多，而在于：

- 多个组件在消费端重复拼布尔条件
- 多个领域状态的组合语义没有收口
- 不同地方对同一个交互规则有各自版本

典型症状包括：

- `tool + selection + contextMenuOpen + transient` 在多个 UI 层各自判断
- 某个 UI chrome 是否显示，需要组件自己理解多份状态
- 同一条业务规则在 toolbar / context-menu / shortcut / handles 里重复出现

这份文档的目标是明确：

- 哪些地方适合继续做“集中派生”
- 哪些地方不适合
- 最优的数据形态是什么
- 推荐的实施顺序是什么

## 核心判断

### 什么时候应该集中派生

满足下面 4 条中的大部分，就应该考虑抽一层集中派生：

1. 有 2 个以上原始状态源
2. 有 2 个以上消费者
3. 消费方正在自己拼布尔逻辑或组合语义
4. 不同模块开始出现相近但不完全相同的判断

### 什么时候不应该集中派生

下面这些情况一般不值得集中：

1. 只有一个消费者
2. 只是局部布局细节
3. 只是短生命周期的交互中间值
4. 集中后并不会减少判断分叉

### 推荐原则

- 原始状态继续按领域存，不要硬合并成一个大 state
- UI 层尽量只读派生结果，不直接拼原始态
- 派生层优先表达“语义结论”，不是简单转发
- 真正互斥的交互模式才考虑状态机
- 非互斥的 UI 维度优先用“集中派生 view”，不要先上全局 machine

## 已验证方向

### 1. Resolved View

`committed + transient + preview` 合成一份 resolved view，让组件不自己拼数据，这条路线已经被证明是正确的。

适用场景：

- node rect / transform draft / preview 合并
- edge endpoint / routing / node draft 合并
- selection bbox 合并
- mindmap drag preview 与 committed tree 合并

这类数据的共同点是：

- 本质是“展示态”
- UI 只关心最终长什么样
- 如果组件自己拼，链路会越来越脆

### 2. Chrome View

最近已经把 `tool + selection + contextMenu` 集中派生成了 `chromeView`，这进一步证明“原始状态分开存，UI 消费集中派生”是当前最合适的路线。

它解决的是：

- handles 是否显示
- edge controls 是否显示
- toolbar 是否显示
- connect handles 是否显示

这个案例很重要，因为它说明：

- 不需要全局状态机
- 只需要把 UI 结论集中产出

## 继续适合集中派生的领域

下面按优先级列出最值得继续推进的区域。

## P0: Interaction View

### 为什么最优先

当前最容易继续失控的不是 document 数据，而是“当前到底在进行什么交互”。

现在已经存在或即将持续扩张的交互态包括：

- context menu open
- toolbar menu open
- marquee
- node drag
- node transform
- edge connect
- edge routing
- pan
- text editing
- container scope editing

这些状态如果继续分散在各 feature 自己判断，会持续出现下面几类问题：

- 一个交互开始时，另一个 UI chrome 没有及时隐藏
- Esc / outside pointerdown 的语义不一致
- 某些 pointer 行为应该互斥，但各模块不知道彼此存在
- 某个模式下 selection / toolbar / context menu 的规则分散

### 推荐形态

不建议一开始就上全局状态机。

先做一层 `interactionView` 或 `uiModeView`：

```ts
type InteractionMode =
  | 'idle'
  | 'context-menu'
  | 'toolbar-menu'
  | 'marquee'
  | 'node-drag'
  | 'node-transform'
  | 'edge-connect'
  | 'edge-routing'
  | 'pan'
  | 'text-edit'

type InteractionView = {
  mode: InteractionMode
  blocking: boolean
  suppressChrome: boolean
  suppressSelectionBox: boolean
  suppressCanvasCreate: boolean
  suppressHoverAffordance: boolean
}
```

### 该层负责什么

- 统一回答“当前模式是什么”
- 统一回答“当前哪些 UI 行为应该被 suppress”
- 统一回答“哪些交互入口当前不可用”

### 不该负责什么

- 不负责具体几何计算
- 不负责 node / edge resolved 数据
- 不负责 layout placement
- 不负责 command 执行

### 未来何时升级为状态机

如果后面这些模式需要：

- 明确的 enter / exit
- 明确的事件转移
- 复杂的冲突处理

那时再把 `interactionView` 背后升级成局部状态机。

但 machine 的作用域应该只覆盖“交互模式”，不应该统管整个 whiteboard UI。

## P1: Scope View

### 为什么值得集中

`container scope` 已经有一部分集中能力，例如：

- `instance.read.container.activeId()`
- `instance.read.container.nodeIds()`
- `instance.read.container.hasNode()`
- `instance.read.container.hasEdge()`

但 UI 侧仍然可能继续自己拼：

- 当前 badge title
- 当前是否在 scope 内
- 当前创建默认 parentId
- 当前 select all 是否应该限定在 scope 内
- 当前点击外部对象时是否需要 exit scope

这说明 scope 虽然已有读模型，但“UI 语义结论”还没有完全收口。

### 推荐形态

```ts
type ScopeView = {
  activeContainerId?: NodeId
  activeContainerTitle?: string
  nodeIds: readonly NodeId[]
  createParentId?: NodeId
  hasNode: (nodeId: NodeId) => boolean
  hasEdge: (edgeId: EdgeId | Edge) => boolean
}
```

### 该层负责什么

- 当前是否存在 active container
- 当前 UI 是否处在 scoped mode
- 当前创建节点默认 parentId 是谁
- 当前 select all 的目标集合
- 当前 badge 应显示什么

### 预期收益

- context-menu、selection、edge click、badge、create 入口统一消费同一份 scope 语义
- 减少 “activeContainerId + descendants + title + parentId” 在各模块散落

## P1: Selection View

### 为什么值得集中

selection 本身已经有集中 state，但它更偏“原始选中态”，还不是“UI 语义结果”。

很多消费者其实关心的是下面这些问题：

- 当前是单选 node 还是多选 node
- 当前 primary node 是谁
- 当前是否选中了 edge
- 当前 selection bbox 是什么
- 当前 selection 是否为空
- 当前是否只有 container descendants

这些结论如果散落在 toolbar、context-menu、shortcut、handles、property editor 里重复判断，会越来越乱。

### 推荐形态

```ts
type SelectionView = {
  empty: boolean
  mode: 'none' | 'node-single' | 'node-multi' | 'edge-single'
  nodeIds: readonly NodeId[]
  nodeIdSet: ReadonlySet<NodeId>
  edgeId?: EdgeId
  primaryNodeId?: NodeId
  bbox?: Rect
}
```

### 该层负责什么

- 从原始 selection 产出更高层语义
- 提供统一的 selection mode
- 提供 selection 的可视化相关聚合数据

### 和 `chromeView` 的关系

- `chromeView` 更像 “该显示什么”
- `selectionView` 更像 “当前选中了什么、选中的语义是什么”

二者可以并存，不冲突。

## P1: Selection Action View

### 为什么值得集中

当前很多地方都在回答“当前 selection 能做什么”：

- context menu item disabled
- toolbar item visible / disabled
- shortcut 可触发性
- 未来 property editor 的字段可编辑性

如果这些判断散落在各处，很快会出现：

- toolbar 说能 group
- shortcut 说不能 group
- context-menu 说能 ungroup

这类问题最适合用一层 `selectionActionView` 收口。

### 推荐形态

```ts
type SelectionActionView = {
  canDelete: boolean
  canDuplicate: boolean
  canGroup: boolean
  canUngroup: boolean
  canLock: boolean
  canUnlock: boolean
  canEditText: boolean
  canChangeFill: boolean
  canChangeStroke: boolean
}
```

### 最适合的消费者

- context menu
- toolbar
- shortcut dispatch
- property editor

### 推荐边界

- 这层只负责能力判断
- 不负责菜单长什么样
- 不负责 item 排布

## P1: Property View

### 为什么值得集中

后面如果做通用属性编辑，UI 最不应该做的事就是自己去拼：

- 当前 selection 的 schema
- 多选属性交集
- mixed value
- 只读/禁用状态
- 当前应该显示哪些属性分组

这类场景天然需要一层 `propertyView`。

### 推荐形态

```ts
type PropertyFieldView = {
  key: string
  label: string
  visible: boolean
  disabled: boolean
  mixed: boolean
  value?: string | number | boolean
}

type PropertyView = {
  mode: 'none' | 'single' | 'multi'
  sections: readonly {
    key: string
    title?: string
    fields: readonly PropertyFieldView[]
  }[]
}
```

### 最适合的来源

- selectionView
- selectionActionView
- node schema
- capability 判断

### 价值

它能让 property editor 彻底变成“纯渲染层”，而不是又一个状态拼装器。

## P2: Capability View

### 为什么值得做

随着 node type 越来越多，toolbar / context-menu / property editor 会越来越依赖“这个 node 支持什么能力”。

例如：

- supportsFill
- supportsStroke
- supportsText
- supportsCollapse
- supportsAutoFit
- supportsAspectRatio
- supportsContainer

这些判断如果继续散在：

- toolbar model
- context-menu sections
- property editor
- NodeItem

长期一定会失控。

### 推荐形态

```ts
type NodeCapabilityView = {
  supportsText: boolean
  supportsFill: boolean
  supportsStroke: boolean
  supportsContainer: boolean
  supportsCollapse: boolean
  supportsAutoFit: boolean
}
```

### 注意

这层应该是“能力语义”，不是 node schema 的机械转抄。

## P2: Overlay View

### 为什么有价值

现在很多 overlay 是否显示、显示给谁，已经开始跨领域：

- transform handles
- connect handles
- selection box
- active container overlay
- toolbar
- edge controls

这些内容有一部分已经进入 `chromeView`，但还没形成完整的 overlay 语义层。

如果未来 overlay 更多，可以进一步抽成：

```ts
type OverlayView = {
  showSelectionBox: boolean
  showNodeHandles: boolean
  showConnectHandles: boolean
  showToolbar: boolean
  showEdgeControls: boolean
  showScopeOverlay: boolean
}
```

### 是否现在就做

不一定。

当前 `chromeView` 已经覆盖了一大半，除非 overlay 继续扩张，否则不需要急着再单拆一层。

## P2: Mindmap View

### 为什么值得关注

mindmap 当前已经有自己的一套 resolved 数据，但随着交互增多，也会遇到相同问题：

- attach target
- drag preview
- insert line
- ghost
- action affordance

如果后面 mindmap 的交互变复杂，它也应该有自己的集中派生层，而不是继续让组件自己拼：

- tree
- drag state
- hover state
- selection state

### 建议

优先让 mindmap 继续沿用 resolved view 思路，不要过早跟普通 node UI 混成一个大派生层。

## 不建议集中派生的区域

下面这些区域一般不应该为了“统一”硬抽层。

## 1. 局部布局细节

例如：

- toolbar 像素级 placement
- context menu 左右翻转
- submenu anchor 位置
- 某个浮层实际宽高估算

这些值通常：

- 生命周期很短
- 只有一个消费者
- 与 DOM 测量强绑定

适合留在组件附近。

## 2. 高频热路径中间值

例如 pointermove 过程中的：

- snap 候选
- drag delta
- connect 临时路径
- 路由试算中间结果

这些东西如果集中成全局 atom 或全局 view，可能反而损失性能并扩大依赖范围。

## 3. 单组件专属开关

例如：

- toolbar 当前展开哪个 submenu
- context menu 当前 hover 哪个 item
- color picker 当前 open/close

这种状态留在局部组件更自然。

## 全局状态机是否需要

### 结论

不建议现在引入“统管整个 whiteboard UI 的全局状态机”。

### 原因

因为当前大部分 UI 状态不是互斥态，而是正交维度：

- selection
- active tool
- scope
- context menu
- toolbar submenu
- transient drag
- transient routing

把这些全部塞进一个 machine，极容易出现状态组合爆炸。

### 更合理的方式

- 原始状态继续分领域保存
- 增加按主题划分的集中派生 view
- 只有“真正互斥的交互模式”才考虑 machine

### 最可能适合 machine 的地方

不是整个 UI，而是 pointer / interaction session：

- idle
- marquee
- node-drag
- node-transform
- edge-connect
- edge-routing
- pan

如果以后要上 machine，应该先从这一层开始。

## 推荐实施顺序

建议按下面顺序推进。

## 1. Interaction View

优先级最高，因为它最能防止交互继续失控。

完成标准：

- 当前主交互模式有统一语义出口
- chrome / selection / hover / create 等 suppress 规则不再分散

## 2. Scope View

原因：

- 它已经有一部分基础
- 消费面广
- 与 selection / context-menu / create 入口强相关

完成标准：

- scope 相关 UI 不再自己拼 active id / descendants / create parent

## 3. Selection Action View

原因：

- 它能直接统一 toolbar / context-menu / shortcut 的 enable/disable 语义

完成标准：

- 同一 selection 下，各入口的能力判断一致

## 4. Property View

原因：

- 属性编辑是最容易膨胀成“组件自己拼状态”的模块

完成标准：

- property editor 基本只负责渲染字段，不自己拼 mixed / visible / disabled

## 5. Capability View

原因：

- 当 node type 继续增多时，它能减少特判扩散

完成标准：

- toolbar / context-menu / property editor 的 node 支持能力判断有统一来源

## 一句话总结

最优路线不是：

- 把所有 UI 状态做成一个全局状态机

而是：

- 原始状态按领域分开
- 在容易扩散的交界处建立集中派生 view
- 让 UI 组件只消费最终语义结果
- 只有真正互斥的交互模式再考虑 machine

当前最值得继续做的三块是：

1. `interactionView`
2. `scopeView`
3. `selectionActionView`

这是后续最能减少 UI 侧状态拼装、同时又不会引入过度架构的三处。
