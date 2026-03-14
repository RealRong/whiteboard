# Whiteboard React 降复杂度方案

## 目标

在尽量不影响现有功能的前提下，降低 `packages/whiteboard-react` 这一层的概念数量、状态数量和链路长度。

这里的“降复杂度”不是继续做零碎命名整理，而是收敛整条链路里的“真相层”：

1. 减少 UI 侧需要理解的状态形态。
2. 减少同一个事实被多次表达。
3. 降低 feature 组件自己拼状态的需求。
4. 缩小高频父组件的 rerender 扩散范围。

## 当前问题

现在的整体方向已经比早期版本清楚很多，但复杂度仍然主要来自下面几类问题：

1. 同一个事实有多种表达形式。
   - 例如 selection 既有 raw state，又有 `selectionView`，又有 `selectionActionView`。
   - interaction 既有多个 session atom，又有 `interactionView`。
   - overlay 显示逻辑分散在 `interactionView`、`toolbarView`、`contextMenuView`、feature 本地判断中。

2. 概念层数偏多。
   - raw state
   - resolved view
   - feature 本地再拼一层
   - command helper 再有一层语义

3. 有些聚合 view 用在了只需要单字段的地方，容易引入误订阅。
   - `selectionView` 很适合 toolbar。
   - 但 `NodeFeature`、`EdgeLayer` 这类只需要窄字段的高频层，不应被强制拉到聚合 view。

4. 某些大 feature 仍承担过多职责。
   - `NodeFeature` 同时负责 node list、transform handles、connect handles、scope overlay、guides。

## 目标状态

整条链路最终收敛成 4 类“真相”：

1. `document/index`
   - committed 文档和引擎索引。
   - 来源是 `instance.read.*` 和 engine runtime。

2. `selection`
   - 当前选中了什么。
   - 是 UI 与交互最基础的事实。

3. `session`
   - 当前正在进行哪种交互。
   - 只表达交互模式，不表达视觉预览。

4. `surface`
   - 当前打开了哪个表层 UI。
   - 比如 context menu、toolbar menu。

其他所有内容都尽量是派生：

- `canDelete / canGroup / canLock`
- `showToolbar / showEdgeControls / showSelectionBox`
- `primaryNode / rect / item list`
- `context menu sections / placement`
- `toolbar items / placement`

## 推荐的最终结构

### 1. Document / Runtime

- `instance.read.*`
- `instance.commands.*`
- `transient/*`

职责：

- `instance.read` 负责 committed 数据和 runtime index 读取。
- `instance.commands` 负责写入。
- `transient` 只负责交互过程中的视觉草稿。

### 2. Selection State

把当前的：

- `selection/domain.ts`
- `selection/view.ts`
- `selection/actionView.ts`

在概念上收敛成一个中心模型：

```ts
type SelectionState = {
  kind: 'none' | 'node' | 'nodes' | 'edge'
  nodeIds: readonly NodeId[]
  nodeIdSet: ReadonlySet<NodeId>
  edgeId?: EdgeId

  nodes: readonly Node[]
  primaryNode?: Node
  rect?: Rect

  canDelete: boolean
  canDuplicate: boolean
  canGroup: boolean
  canUngroup: boolean
  canLock: boolean
  canUnlock: boolean
  canClear: boolean
  canSelectAll: boolean
  lockLabel: string
}
```

说明：

- 不要求必须物理上只剩一个文件。
- 但对外应该形成一个统一心智模型：selection 的事实、语义、能力来自同一中心。
- 同时保留窄订阅入口，例如：
  - `useSelectedEdgeId()`
  - `useSelectedNodeIds()`
  - `useSelectionContains(nodeId)`

原则：

- 高层 UI 组件优先使用聚合 selection state。
- 高频层如果只需要一个窄字段，继续用最窄订阅，不强行统一。

### 3. Interaction Session

把当前多个 session atom：

- `selectionBoxSessionAtom`
- `nodeDragSessionAtom`
- `nodeTransformSessionAtom`
- `edgeConnectSessionAtom`
- `edgeRoutingSessionAtom`

收敛成一个联合类型：

```ts
type InteractionSession =
  | { kind: 'idle' }
  | { kind: 'selection-box' }
  | { kind: 'node-drag' }
  | { kind: 'node-transform' }
  | { kind: 'edge-connect' }
  | { kind: 'edge-routing' }
```

如果未来需要携带额外上下文，再在对应分支上补字段：

```ts
| { kind: 'node-transform'; nodeId: NodeId; handle: TransformHandle }
```

然后基于 `session.kind` 派生：

- `mode`
- `blocking`
- `suppressChrome`
- `allowCanvasSelection`
- `allowContextMenu`
- `allowToolbarMenu`

好处：

- 交互模式只保留一个真相。
- 避免多个布尔组合带来的认知成本。
- feature 不必理解“哪些布尔不能同时为 true”。

### 4. Surface State

`context-menu` 和 `toolbar-menu` 保持为 surface 级状态，不并入 session。

原因：

- 它们是表层 UI 的打开状态，不是交互手势本身。
- 它们和 `node-drag / edge-connect` 不属于同一种状态维度。

推荐保留：

- `contextMenuState`
- `nodeToolbarMenuState`

但尽量让 feature 只消费 resolve 后的 view，而不是自己拼 target、placement、sections。

### 5. Overlay View

引入一个只读聚合层，统一描述当前可见 overlay：

```ts
type OverlayView = {
  selectionBox?: Rect
  guides: readonly Guide[]
  nodeHandleNodeIds: readonly NodeId[]
  showNodeConnectHandles: boolean
  nodeToolbar?: NodeToolbarView
  edgeControls?: SelectedEdgeView
  contextMenu?: ContextMenuView
  activeContainer?: {
    nodeId: NodeId
    title: string
  }
}
```

说明：

- `OverlayView` 不是新的真相层。
- 它只是 `selection + session + surface + transient + scope` 的只读聚合视图。

用途：

- 让显示逻辑尽量集中。
- 减少 overlay 是否显示这类规则在多个 feature 中散落。

注意：

- 不要求所有 overlay 一次性全并进去。
- 可以从 node/edge/tool/context-menu 四类主要 overlay 开始。

## 组件层的目标形态

### NodeFeature

`NodeFeature` 应拆成更薄的层组件，哪怕都保留在同一个文件。

建议结构：

- `NodeItemsLayer`
- `NodeTransformLayer`
- `NodeConnectLayer`
- `ActiveContainerLayer`
- `NodeGuidesLayer`

原则：

- node list 只关心 node ids 和 selected set。
- transform layer 只关心 selected handle ids。
- connect layer 只关心 connect handle visibility。
- guides layer 只关心 transient guides。

目标：

- 降低父层 rerender 时整层 map 的扩散。
- 明确每层自己的订阅边界。

### EdgeFeature

保持现在的薄结构，但继续坚持：

- `EdgeLayer` 只订阅 edge ids 和 selected edge id。
- `SelectedEdgeControls` 只在需要时读 selected edge view。
- preview 继续只走 transient。

### ContextMenuFeature / NodeToolbarFeature

最终形态应是：

- feature 只做事件绑定和渲染。
- target resolve、placement resolve、sections/items resolve 都下沉到 state/view 层。

## 命令层的目标形态

当前已经有 [packages/whiteboard-react/src/node/actions.ts](packages/whiteboard-react/src/node/actions.ts)。

这个方向是对的，应继续坚持：

- 共享的 node 级语义动作，放在 node 域下。
- 不放在 context-menu、toolbar、shortcut 域下。

应收口到这里的动作包括：

- `selectNodeIds`
- `duplicateNodes`
- `deleteNodes`
- `setNodesLocked`
- `groupNodes`
- `ungroupNodes`

如果后面继续增加：

- `collapseGroups`
- `setGroupAutoFit`
- `arrangeNodes`

也建议优先进入 node 域，而不是再次散在 UI feature 下。

## 明确不做的事

为了避免“越重构越复杂”，下面这些事不建议做：

1. 不把 transient 塞回 engine。
   - transient 本质上是 UI runtime 预览态。
   - engine 保持 committed/runtime 基础能力即可。

2. 不引入全局状态机框架。
   - 当前问题不是缺状态机框架，而是真相层太多。
   - 一个简单的 `session union` 足够。

3. 不追求“所有 UI 一律只吃 resolved view”。
   - 这会导致误订阅。
   - 单字段场景仍然应该使用窄 hook。

4. 不为了整齐继续拆过多小文件。
   - 重点是减少概念和状态，不是制造更多文件跳转。

## 推荐迁移顺序

### Phase 1: Interaction Session 收口

目标：

- 多个 session atom 合并为一个 `session atom`。
- `interactionView` 只从 `session + selection + surface` 派生。

验收：

- `showSelectionBox / showNodeToolbar / showEdgeControls / allowContextMenu` 行为不变。
- drag/transform/connect/routing 的开始与结束逻辑不回退。

### Phase 2: Selection State 收口

目标：

- 在概念上把 `selectionView + selectionActionView` 合成一个中心模型。
- 保留窄 hook，不强推所有 consumer 使用聚合 state。

验收：

- toolbar、context-menu、shortcut 的能力判断一致。
- 单字段 consumer 不因统一而扩大订阅范围。

### Phase 3: NodeFeature 拆层

目标：

- `NodeFeature` 按层拆分。
- 让 node list 不再跟着 overlay 状态变化无谓重跑。

验收：

- selection、toolbar、handles、guides 的显示行为不变。
- 父层 rerender 时 `NodeItemsLayer` 不被无意义卷入。

### Phase 4: Overlay View 收口

目标：

- 聚合 overlay 显示规则。
- 让各 feature 更像纯 renderer。

验收：

- context-menu、toolbar、edge controls、selection box、guides 显示规则不回退。
- overlay 是否显示不再散落在多个 feature 本地判断里。

## 每阶段验证要求

每阶段至少做：

1. `pnpm --filter @whiteboard/react lint`
2. `pnpm --filter @whiteboard/react build`
3. `pnpm --filter @whiteboard/demo build`

行为回归重点：

1. 多选 node
2. 多选 lock/unlock
3. group / ungroup
4. 进入和退出 container scope
5. selection box
6. node drag / transform
7. edge select / routing / connect
8. toolbar / context-menu 打开关闭

## 当前建议

如果下一步开始正式落地，推荐从 `Interaction Session` 开始，而不是先碰 `Overlay View`。

原因：

- `session` 是交互模式的真相层。
- 先把交互模式收成一个真相，后面 `interactionView`、`overlayView`、feature 显示规则都会自然变简单。

也就是说，推荐的第一个真正落地 PR 是：

- `interaction/domain.ts`
- `selection/useSelectionBoxInteraction.ts`
- `node/hooks/useNodeInteractions.ts`
- `edge/hooks/connect/useEdgeConnect.ts`
- `edge/hooks/routing/useEdgeRouting.ts`

统一切到单一 `session atom`。

## 一句话结论

这套系统后续最有价值的降复杂度方向，不是继续做零碎整理，而是把：

- `interaction` 收成一个 `session`
- `selection` 收成一个中心 state
- `NodeFeature` 拆成几层
- overlay 显示规则收口成只读视图

这样可以在不明显影响功能的前提下，同时减少：

- 状态数量
- 概念数量
- feature 心智负担
- rerender 扩散范围
