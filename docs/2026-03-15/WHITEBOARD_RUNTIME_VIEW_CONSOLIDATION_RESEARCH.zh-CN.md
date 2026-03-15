# `packages/whiteboard-react/src/runtime/view` 收敛研究

## 目标

本文只研究 `packages/whiteboard-react/src/runtime/view` 下面这套 view 的职责边界和字段形态，判断：

- 每个 view 是否过宽
- 哪些字段是重复派生
- 哪些字段只在少量场景使用，是否应该下沉
- 哪些 view 应该保留原样，不要为了“更短”牺牲语义

本文不直接改代码，只给最优收敛方向。

## 总结结论

当前 `runtime/view` 这套体系整体方向是对的：

- UI 读的是 resolved view，而不是自己拼 committed + transient + UI state
- `selection / scope / interaction / overlay / surface / node / edge` 的职责大体清晰
- `node` / `edge` keyed view 和上层 value view 的分层也是合理的

真正的问题不在于“有没有 view”，而在于以下三点：

1. `selection / interaction / overlay` 三层之间有一部分重复派生。
2. `node view` 明显过胖，塞了太多既偏 domain 又偏 render 的字段。
3. `surface view` 有一层不必要的包装壳，`toolbar.value + toolbar.menuKey` 读起来不直。

我的总体建议：

- 保留 `view` 体系，不回退到 UI 自己拼数据。
- 保留语义化 comparator，不改成通用 deep-equal。
- 重点做“字段收敛”和“边界重划分”，不是把 view 合并成一个 mega view。

最优形态不是减少 view 的数量，而是让每个 view 只承载一种明确职责：

- `selection`: 只负责 selection 语义和 action capability
- `scope`: 只负责 container scope
- `interaction`: 只负责 interaction gate / mode
- `overlay`: 只负责真正画在 overlay layer 上的东西
- `surface`: 只负责浮层 surface
- `node`: 只负责 node resolved render model
- `edge`: 只负责 edge resolved render model

---

## 逐个分析

## 1. `selection`

文件：

- [selection.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/view/selection.ts)

当前字段：

- `kind`
- `nodeIds`
- `nodeCount`
- `hasGroup`
- `allLocked`
- `canDelete`
- `canDuplicate`
- `canGroup`
- `canUngroup`
- `canLock`
- `canUnlock`
- `lockLabel`
- `nodeIdSet`
- `edgeId`
- `nodes`
- `primaryNode`
- `rect`
- `hasNodeSelection`
- `hasEdgeSelection`
- `hasSelection`
- `activeScopeId`
- `hasActiveScope`
- `canSelectAll`
- `canClear`

真实消费者观察：

- `NodeSceneLayer` / `NodeOverlayLayer` 主要用 `nodeIdSet`
- toolbar / context menu / shortcut dispatch 会用：
  - `nodeIds`
  - `nodeCount`
  - `nodes`
  - `primaryNode`
  - `rect`
  - 一批 `canXxx`
- `context-menu/view.ts` 会用 `nodeIdSet`
- shortcut dispatch 会用 `canSelectAll`、`canClear`

### 存在的问题

`selection` 现在混了三类东西：

1. 原始 resolved selection data
   - `nodeIds`
   - `nodeIdSet`
   - `edgeId`
   - `nodes`
   - `primaryNode`
   - `rect`
2. 状态摘要
   - `kind`
   - `nodeCount`
   - `hasNodeSelection`
   - `hasEdgeSelection`
   - `hasSelection`
   - `activeScopeId`
   - `hasActiveScope`
   - `hasGroup`
   - `allLocked`
3. capability / label
   - `canDelete`
   - `canDuplicate`
   - `canGroup`
   - `canUngroup`
   - `canLock`
   - `canUnlock`
   - `canSelectAll`
   - `canClear`
   - `lockLabel`

这里最大的问题不是字段太多，而是“摘要字段有一部分重复”。

### 可以收敛的字段

建议删掉或逐步停止新增以下这类重复布尔：

- `hasNodeSelection`
- `hasEdgeSelection`
- `hasSelection`
- `hasActiveScope`

原因：

- 都能由 `kind`、`edgeId`、`nodeCount`、`activeScopeId` 直接推出
- 这些字段增加 comparator 和维护噪音
- 它们本身不承载额外语义

建议保留：

- `kind`
- `nodeIds`
- `nodeIdSet`
- `edgeId`
- `nodes`
- `primaryNode`
- `rect`
- `nodeCount`
- `activeScopeId`
- `hasGroup`
- `allLocked`
- 所有 `canXxx`
- `lockLabel`

### 最优形态

`SelectionState` 最好收成两层语义：

- `selection data`
  - `kind`
  - `nodeIds`
  - `nodeIdSet`
  - `nodeCount`
  - `nodes`
  - `primaryNode`
  - `edgeId`
  - `rect`
  - `activeScopeId`
  - `hasGroup`
  - `allLocked`
- `selection actions`
  - `canDelete`
  - `canDuplicate`
  - `canGroup`
  - `canUngroup`
  - `canLock`
  - `canUnlock`
  - `canSelectAll`
  - `canClear`
  - `lockLabel`

不一定要拆成两个对象，但语义上应该按这个标准收。

### 结论

`selection view` 不需要拆文件或拆 view，主要是删掉重复布尔，保留 capability。

---

## 2. `scope`

文件：

- [container.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/view/container.ts)

当前字段：

- `activeId`
- `activeTitle`
- `createParentId`
- `nodeIds`
- `hasNode`
- `hasEdge`

真实消费者观察：

- context menu open / canvas section 会用：
  - `activeId`
  - `createParentId`
  - `hasNode`
  - `hasEdge`
- overlay 会用：
  - `activeId`
  - `activeTitle`

### 存在的问题

`createParentId` 和 `activeId` 目前恒等。

也就是说，`scope view` 里现在为了调用端“语义方便”保留了两个字段，但实际并没有两套语义来源。

### 可以收敛的字段

建议：

- 删掉 `createParentId`
- 所有创建节点时需要 parent 的地方直接读 `activeId`

原因：

- 现在两者没有区别
- 以后如果真的出现“当前 active scope”和“新建目标 parent”不同，再重新引入更明确的字段也不迟
- 当前保留它只是在扩散概念数

### 不建议删的字段

- `hasNode`
- `hasEdge`

这两个虽然是函数，但语义明确，而且是 context menu / scope leave 判定的高价值接口。它们比把 `nodeIds` / `nodeSet` 暴露给 UI 再自己判断更好。

### 最优形态

`ScopeView` 最好是：

- `activeId`
- `activeTitle`
- `nodeIds`
- `hasNode`
- `hasEdge`

### 结论

`scope view` 已经很薄，唯一明显可砍的是 `createParentId`。

---

## 3. `interaction`

文件：

- [interaction.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/view/interaction.ts)

当前字段：

- `showSelectionBox`
- `canCanvasSelect`
- `canOpenContextMenu`
- `canOpenToolbarMenu`
- `nodeHandleNodeIds`
- `showNodeConnectHandles`
- `showNodeToolbar`
- `showEdgeControls`

真实消费者观察：

- `CanvasContextMenuInput` 用 `canOpenContextMenu`
- selection interaction 用 `canCanvasSelect`
- `NodeToolbarSurface` 用：
  - `showNodeToolbar`
  - `canOpenToolbarMenu`
- `EdgeOverlayLayer` 用 `showEdgeControls`
- overlay 会继续使用：
  - `showSelectionBox`
  - `nodeHandleNodeIds`
  - `showNodeConnectHandles`
  - `showEdgeControls`

### 存在的问题

这里最大的重复不是字段内部，而是和 `overlay` 有一部分重复转抄：

- `nodeHandleNodeIds`
- `showNodeConnectHandles`
- `showEdgeControls`

`overlay` 现在只是把这些字段再搬运一次。

### 可以收敛的方向

`interaction` 自己不需要明显减字段。它的问题是：

- 现在它同时承担了“interaction gate”与“overlay display source”

建议：

- `interaction` 保持原样，不急着删字段
- 但把 `overlay` 里那几个纯搬运字段未来往 `interaction` 直读上收

### 不建议改成什么

不建议把 `interaction` 改成只暴露 `mode`，让 UI 自己推：

- `showNodeToolbar`
- `canOpenContextMenu`
- `showEdgeControls`

这样会把 UI 又拉回自己拼逻辑，反而倒退。

### 最优形态

`InteractionView` 保持“已经 resolve 好的 gate/result”最合适。

如果未来要进一步收敛，优先考虑：

- 新增 `mode`
- 保留这些 gate/result

但不是删掉这些 gate/result。

### 结论

`interaction view` 基本不用减字段，主要是要避免下游重复转抄。

---

## 4. `overlay`

文件：

- [overlay.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/view/overlay.ts)

当前字段：

- `selectionBox`
- `guides`
- `activeScope`
- `nodeHandleNodeIds`
- `showNodeConnectHandles`
- `showEdgeControls`

真实消费者观察：

- `SelectionBoxOverlay` 只用 `selectionBox`
- `NodeOverlayLayer` 用：
  - `guides`
  - `activeScope`
  - `nodeHandleNodeIds`
  - `showNodeConnectHandles`

没有看到任何消费者直接用 `overlay.showEdgeControls`

### 存在的问题

`overlay` 现在混了两类东西：

1. 真正属于 overlay layer 的视觉数据
   - `selectionBox`
   - `guides`
   - `activeScope`
   - `nodeHandleNodeIds`
   - `showNodeConnectHandles`
2. 不属于 overlay 的 interaction flag
   - `showEdgeControls`

而且 `nodeHandleNodeIds`、`showNodeConnectHandles` 来自 `interaction`，只是搬运。

### 可以收敛的字段

建议删除：

- `showEdgeControls`

原因：

- 真实消费者不在 `overlay` 层
- `EdgeOverlayLayer` 已经直接用 `interaction.showEdgeControls`
- 这个字段放在 `overlay` 里只是在扩大 overlay 的职责

### 可以考虑继续收敛的方向

有两个方向可选：

1. 保守收敛
   - 仅删除 `showEdgeControls`
   - 其余保留

2. 更彻底的职责切分
   - `overlay` 只保留真正的 overlay visuals：
     - `selectionBox`
     - `guides`
     - `activeScope`
   - `NodeOverlayLayer` 直接从 `interaction` 读：
     - `nodeHandleNodeIds`
     - `showNodeConnectHandles`

我更倾向第二种，因为它更干净：

- `overlay` 只放视觉层数据
- `interaction` 只放 interaction 结果

### 最优形态

最优 `OverlayView`：

- `selectionBox`
- `guides`
- `activeScope`

然后：

- transform handles 来源：`interaction.nodeHandleNodeIds`
- connect handles gate：`interaction.showNodeConnectHandles`

### 结论

`overlay view` 是当前最值得收窄的 value view，至少可以先砍 `showEdgeControls`，更理想是把 interaction 派生字段全部拿出去。

---

## 5. `surface`

文件：

- [surface.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/view/surface.ts)

当前字段：

- `toolbar?: { value: NodeToolbarView; menuKey?: NodeToolbarMenuKey }`
- `contextMenu?: ContextMenuView`

真实消费者观察：

- `NodeToolbarSurface` 接的是 `SurfaceView['toolbar']`
- `ContextMenuSurface` 接的是 `SurfaceView['contextMenu']`

### 存在的问题

这里的主要问题不是字段太多，而是 `toolbar` 多了一层包装：

- `toolbar.value`
- `toolbar.menuKey`

它把一个“node toolbar resolved view”和一个“surface chrome state”套在一起，导致调用方读起来不直。

### 可以收敛的方向

建议把 `toolbar` 收平为：

- `toolbar?: NodeToolbarSurfaceView`

例如概念上：

- `NodeToolbarSurfaceView = NodeToolbarView & { activeMenuKey?: NodeToolbarMenuKey }`

这样调用方就不用写：

- `view?.value`
- `view?.menuKey`

而是直接：

- `toolbar?.items`
- `toolbar?.anchor`
- `toolbar?.activeMenuKey`

### 是否应该拆成两个 view

可以，但不一定必须：

1. 保持 `surface` 一个 view
   - `toolbar?`
   - `contextMenu?`

2. 拆成两个 parameterized/value view
   - `toolbarSurface`
   - `contextMenuSurface`

从职责纯度上看，拆开更好；但当前 `SurfaceFeature` 已经作为单个 surface composition 使用，一个 `surface view` 也能接受。

所以我不把“拆 view”列为高优先级，只建议把字段形态收平。

### 最优形态

`SurfaceView` 最好是：

- `toolbar?: NodeToolbarSurfaceView`
- `contextMenu?: ContextMenuView`

其中 `NodeToolbarSurfaceView` 直接平铺：

- `mode`
- `nodeIds`
- `nodes`
- `primaryNode`
- `primarySchema`
- `items`
- `placement`
- `anchor`
- `activeMenuKey?`

### 结论

`surface` 不一定要拆，但 `toolbar.value + menuKey` 这一层包装应该收平。

---

## 6. `node`

文件：

- [node.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/view/node.ts)

当前字段：

- `nodeId`
- `node`
- `rect`
- `hovered`
- `rotation`
- `hasResizePreview`
- `shouldAutoMeasure`
- `canRotate`
- `nodeStyle`
- `transformStyle`
- `renderProps`
- `definition`

真实消费者观察：

- `NodeItem` 用：
  - `node`
  - `rect`
  - `shouldAutoMeasure`
  - `nodeStyle`
  - `transformStyle`
  - `renderProps`
  - `definition`
- `useNodeOverlayView` / overlay handles 用：
  - `node`
  - `rect`
  - `hovered`
  - `rotation`
  - `canRotate`
  - `transformStyle`
- toolbar 读取单节点时用：
  - `rect`
  - `node`
  - `definition`

### 存在的问题

`node view` 明显同时承担了三层职责：

1. resolved node model
   - `node`
   - `rect`
   - `rotation`
   - `hovered`
   - `hasResizePreview`
2. render pipeline helper
   - `nodeStyle`
   - `transformStyle`
   - `renderProps`
   - `definition`
3. component convenience flags
   - `shouldAutoMeasure`
   - `canRotate`

这是整个 `runtime/view` 里最胖、最混杂的一个 view。

### 可以收敛的字段

优先考虑删除或下沉：

- `renderProps`
- `shouldAutoMeasure`

原因：

#### `renderProps`

这是最典型的“为了调用方便，把一整套 component props 提前塞进 view”。

问题：

- 它把 React render contract 带进了 runtime view
- 它与 `node / rect / hovered / selected / commands / read` 高度重复
- `NodeItem` 后面又基于 `renderProps` 再加一层 `containerProps`

更好的边界：

- `node view` 只提供 resolved node render model
- `NodeItem` 自己在组件层组装 `NodeRenderProps`

#### `shouldAutoMeasure`

它本质是：

- `definition?.autoMeasure && !hasResizePreview`

这是典型的组件层 convenience 派生，不是核心 resolved data。

它应该：

- 要么内联在 `NodeItem`
- 要么变成 `useNodeMeasurementEnabled(view)` 这类局部 hook

### 建议保留的字段

- `nodeId`
- `node`
- `rect`
- `hovered`
- `rotation`
- `canRotate`
- `nodeStyle`
- `transformStyle`
- `definition`

### `hasResizePreview` 是否保留

这个字段当前外部几乎不直接消费，但它承载了一个很真实的 resolved 语义：

- 当前 node 正处于 size draft preview 中

它不一定要暴露在最终公开 view 上，但至少在内部 resolve 阶段有价值。

如果继续收，可以：

- 先把它变成内部中间值，不作为 `NodeView` 对外字段

### 最优形态

`NodeView` 最好收成：

- `nodeId`
- `node`
- `rect`
- `hovered`
- `rotation`
- `canRotate`
- `nodeStyle`
- `transformStyle`
- `definition`

内部中间值允许存在：

- `hasResizePreview`

不要再把：

- `renderProps`
- `shouldAutoMeasure`

留在最终 view 上。

### 结论

`node view` 是当前最值得继续瘦身的 keyed view。

---

## 7. `edge`

文件：

- [edge.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/view/edge.ts)

当前形态：

- `type EdgeView = EdgeEntry`

也就是整个 `EdgeEntry` 直接作为 view 暴露。

真实消费者观察：

- `useEdgeView` 下游主要使用：
  - `edge`
  - `endpoints`

`SelectedEdgeView` 会继续派生：

- `edgeId`
- `endpoints`
- `routingHandles`

### 存在的问题

`EdgeView = EdgeEntry` 虽然简单，但过于宽。

问题在于：

- view 层没有声明自己真正想暴露的 render contract
- 一旦 `EdgeEntry` 在 engine 侧扩大，react view 也被动扩大
- 它不如 `NodeView` 那样有明确的 UI 边界

### 可以收敛的方向

建议显式定义最小 `EdgeView`，而不是直接复用 `EdgeEntry`。

最小形态应当至少明确：

- `edge`
- `endpoints`

如果还有别的字段确实被 UI 用到，再加。

### 最优形态

`EdgeView` 推荐显式化为：

- `edge`
- `endpoints`

不要直接别名为 `EdgeEntry`。

### 结论

`edge view` 不是字段太多，而是“边界太松”。这里更应该做显式最小化。

---

## 横向问题

## 1. `selection / interaction / overlay` 的职责交叉

当前这三层的关系大致是：

- `selection`: selection resolved state + actions
- `interaction`: interaction gate
- `overlay`: overlay visual data + 一部分 interaction 搬运

最优边界应该是：

- `selection`: 选中了什么、允许做什么
- `interaction`: 当前允许打开什么、显示什么交互 affordance
- `overlay`: 真正画在 overlay layer 的视觉数据

也就是说：

- `overlay` 不应该再带 `showEdgeControls`
- 最理想状态下，`overlay` 也不带 `nodeHandleNodeIds` / `showNodeConnectHandles`

---

## 2. `node view` 太靠近组件

`node view` 目前已经开始承担：

- resolved domain model
- style resolution
- render props prebuild
- registry definition 暴露

其中最不该在 view 层存在的是：

- `renderProps`

这是 React 组件装配层的职责，不是 runtime read model 的职责。

---

## 3. `surface view` 的 wrapper 噪音

`toolbar: { value, menuKey }` 是一种典型的“为了凑 shape 而包一层对象”，但这个 wrapper 本身不表达业务概念。

更好的做法是：

- 把 toolbar 自己扩成 surface 需要的最终 shape

---

## 4. value view 和 keyed view 的收敛优先级不同

优先级建议：

1. 先收 `overlay`
2. 再收 `node`
3. 再收 `surface`
4. 然后补 `selection`
5. 最后再处理 `edge`

原因：

- `overlay` 是明显的职责错位，收益最大
- `node` 是最大噪音来源
- `surface` 主要是 shape 噪音
- `selection` 虽然字段多，但很多确实有用
- `edge` 目前问题更像边界松，不是急性复杂度问题

---

## 建议的目标形态

## `SelectionState`

建议保留：

- `kind`
- `nodeIds`
- `nodeIdSet`
- `nodeCount`
- `nodes`
- `primaryNode`
- `edgeId`
- `rect`
- `activeScopeId`
- `hasGroup`
- `allLocked`
- `canDelete`
- `canDuplicate`
- `canGroup`
- `canUngroup`
- `canLock`
- `canUnlock`
- `canSelectAll`
- `canClear`
- `lockLabel`

建议删除：

- `hasNodeSelection`
- `hasEdgeSelection`
- `hasSelection`
- `hasActiveScope`

## `ScopeView`

建议保留：

- `activeId`
- `activeTitle`
- `nodeIds`
- `hasNode`
- `hasEdge`

建议删除：

- `createParentId`

## `InteractionView`

建议保留：

- `showSelectionBox`
- `canCanvasSelect`
- `canOpenContextMenu`
- `canOpenToolbarMenu`
- `nodeHandleNodeIds`
- `showNodeConnectHandles`
- `showNodeToolbar`
- `showEdgeControls`

不建议主动砍字段。

## `OverlayView`

保守收敛建议：

- 删除 `showEdgeControls`

理想收敛建议：

- 只保留：
  - `selectionBox`
  - `guides`
  - `activeScope`

其余 interaction 派生直接回到 `interaction view`。

## `SurfaceView`

建议保留：

- `contextMenu`
- `toolbar`

但把：

- `toolbar?: { value, menuKey }`

改成：

- `toolbar?: NodeToolbarSurfaceView`

其中 `activeMenuKey` 直接平铺。

## `NodeView`

建议保留：

- `nodeId`
- `node`
- `rect`
- `hovered`
- `rotation`
- `canRotate`
- `nodeStyle`
- `transformStyle`
- `definition`

建议下沉或删除：

- `renderProps`
- `shouldAutoMeasure`

建议内部化：

- `hasResizePreview`

## `EdgeView`

建议显式化为：

- `edge`
- `endpoints`

不要再直接 `type EdgeView = EdgeEntry`。

---

## 最终判断

如果只从“减少字段、减少概念、减少重复派生”的角度看，当前 `runtime/view` 最该做的不是合并 view，而是：

1. 让 `overlay` 回到真正 overlay data。
2. 让 `node view` 停止输出组件装配层字段。
3. 让 `surface.toolbar` 收平。
4. 让 `selection` 删除重复布尔。
5. 让 `edge view` 摆脱 `EdgeEntry` 直通。

一句话总结：

`runtime/view` 这套架构不需要推翻，但每个 view 都应该更“像 read model”，更少夹带组件 convenience 字段和跨层搬运字段。
