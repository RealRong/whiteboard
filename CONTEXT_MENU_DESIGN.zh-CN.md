# Whiteboard 右键菜单设计

## 目标

为 `packages/whiteboard-react` 增加一套稳定、可扩展、不会把现有结构再次搞散的右键菜单系统。

目标不是“把 toolbar 再做一份”，而是补齐下面三类能力：

- 结构性操作：删除、复制、锁定、编组、解组、层级调整
- 画布入口：在点击位置创建常用 node
- 上下文操作：根据 node / nodes / edge / canvas 目标给出不同菜单

同时满足下面几个架构约束：

- 右键菜单属于 UI chrome，不属于 transient overlay
- 不把右键事件处理塞进 `instance`
- UI 尽量消费 resolved view，不自己拼 selection / node / edge 多份数据
- 不提前抽成“全局菜单 DSL 基建”，先做清晰直接的一版

---

## 核心判断

### 1. 右键菜单不应该放到 transient

`transient` 适合表达拖拽、连接、路由、框选这类“会临时覆盖 committed 渲染”的状态。

右键菜单不是这类状态：

- 它不覆盖 node / edge 几何
- 它不参与渲染 merge
- 它本质是一个浮层 UI
- 它的生命周期由 open / close 驱动，而不是 pointermove session 驱动

所以右键菜单应该放在 **UI domain**，和 `selection`、`tool` 同级，而不是放进 `transient`。

### 2. 右键菜单不应该直接复用 toolbar 渲染体系

toolbar 和右键菜单虽然都属于“上下文操作入口”，但交互性质不同：

- toolbar 是 node 上方的常驻轻操作入口，偏样式编辑
- context menu 是一次性列表菜单，偏结构与上下文操作

如果强行共享 render 层：

- item 语义会被拉宽
- toolbar 的 icon-first 设计会污染 context menu
- context menu 的 section / disabled / subtitle / submenu 需求会反向拖复杂 toolbar

更好的方式：

- **不共享 render 层**
- 可以复用一部分 command 级能力判断和 action 实现思路
- 但 menu item / section / 布局 / 状态模型分开

### 3. 右键菜单优先做“结构操作 + 创建入口”，不要先做“样式编辑镜像”

现在已经有 node toolbar 负责：

- fill
- stroke
- text
- group settings

所以右键菜单第一版不应该再把 fill/stroke/text 原样搬进去，否则会让两个系统职责重叠。

右键菜单第一版应该优先承载：

- Duplicate
- Delete
- Lock / Unlock
- Group / Ungroup
- Bring to front / send to back / bring forward / send backward
- Add text / sticky / shape at pointer
- Undo / Redo
- Select all / clear selection

如果后续需要，再给 context menu 补一个 `Appearance...` 子菜单，但不建议第一版就做。

---

## 交互设计

## 目标对象

右键菜单需要区分四类 target：

```ts
type ContextMenuTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; nodeId: NodeId; world: Point }
  | { kind: 'nodes'; nodeIds: readonly NodeId[]; primaryNodeId: NodeId; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }
```

其中：

- `canvas` 用于空白区域
- `node` 用于单个 node
- `nodes` 用于多选 node
- `edge` 用于选中的边

这里的 `world` 必须保留，因为画布右键菜单里的“创建 node”需要直接用该坐标落点。

---

## 右键行为规则

### 1. 右键单个未选中 node

行为：

- 阻止浏览器默认菜单
- 先执行 `selection.select([nodeId], 'replace')`
- 再打开 `node` 菜单

原因：

- 菜单内容应该和当前操作目标一致
- 避免出现“菜单是 A，selection 还是 B”的错位

### 2. 右键已选中的单个 node

行为：

- 保持当前 selection
- 打开 `node` 菜单

### 3. 右键多选中的某个 node

行为：

- 如果该 node 已在当前 selection 中，则保持当前多选
- 打开 `nodes` 菜单

### 4. 右键未选中的另一个 node，而当前有多选

行为：

- 切换为该 node 的单选
- 打开 `node` 菜单

### 5. 右键 edge

行为：

- 若该 edge 未选中，则执行 `selection.selectEdge(edgeId)`
- 打开 `edge` 菜单

### 6. 右键空白 canvas

行为：

- 推荐：清空当前 selection
- 打开 `canvas` 菜单

原因：

- 空白画布菜单应该表达“对画布做什么”，而不是“对旧 selection 做什么”
- 这和绝大多数白板工具行为一致，也更少歧义

### 7. 右键 toolbar / context menu 自身

行为：

- 阻止事件冒泡
- 不重新打开新菜单

需要给这些浮层元素加上：

- `data-context-menu-ignore`

---

## 菜单功能设计

## 第一版必须支持

### Canvas 菜单

- `Add text`
- `Add sticky`
- `Add rectangle`
- `Add ellipse`
- `Add diamond`
- `Add triangle`
- `Add callout`
- `Add arrow sticker`
- `Add highlight`
- `Undo`
- `Redo`
- `Select all`

备注：

- “Paste” 可以先不做，除非已经有明确 clipboard 方案
- “Reset view” 不是刚需，可以后补

### Single node 菜单

- `Duplicate`
- `Delete`
- `Lock` / `Unlock`
- `Bring to front`
- `Bring forward`
- `Send backward`
- `Send to back`

按 node 类型追加：

- group node:
  - `Collapse` / `Expand`
  - `Auto fit: expand-only / manual`
- mindmap node:
  - 后续可补 `Add child`
  - 后续可补 `Add sibling`

### Multi node 菜单

- `Duplicate`
- `Delete`
- `Lock selected` / `Unlock selected`
- `Group`
- `Ungroup`
- `Bring to front`
- `Bring forward`
- `Send backward`
- `Send to back`

说明：

- `Group` 只有 `selectedNodeIds.length >= 2` 时启用
- `Ungroup` 可以只要存在 group selection 就启用，或第一版先简单做成“有 node selection 即显示，内部命令自行 no-op”

### Edge 菜单

- `Delete`

第一版先尽量短，不要在 edge 菜单里引入过多 routing / style 编辑。

如果后续 edge 能力继续增强，再加：

- `Add routing point`
- `Remove routing point`
- `Reverse direction`
- `Arrow start / end`

---

## 不建议第一版做的功能

- 样式镜像菜单：fill / stroke / text 全量复制 toolbar
- 复杂多级子菜单系统
- 原生系统菜单桥接
- 长按触摸菜单
- 剪贴板全套 copy / cut / paste
- 插件式 menu 注册系统

这些都不是不能做，而是不应该在第一版把结构做复杂。

---

## 视觉与交互建议

## 视觉方向

右键菜单应是：

- 轻量文本菜单
- 一列为主
- 可带 section 分组
- 少量二级 submenu

不要做成：

- icon-only 菜单
- 和 toolbar 完全一样的浮层
- 超宽的面板式菜单

推荐层级：

- 一级菜单：文本为主，图标可选
- section header：灰色小字
- destructive item：红色文本
- disabled item：透明度降低

## 关闭规则

打开后，在以下情况关闭：

- pointerdown 到菜单外
- `Escape`
- 执行动作完成
- 视口滚动 / resize
- selection 被外部替换且 target 失效

## 与 toolbar 的关系

建议菜单打开时：

- 隐藏 node toolbar

理由：

- 避免屏幕上同时出现两个上下文系统
- 避免点击 toolbar 时又触发 context menu target 冲突

实现方式：

- `NodeToolbarFeature` 读取 `contextMenu.open`
- `open === true` 时直接 `return null`

---

## 代码设计

## 推荐目录

新增目录：

```text
packages/whiteboard-react/src/context-menu/
  index.ts
  ContextMenuFeature.tsx
  useContextMenuView.ts
  model.ts
  domain.ts
  sections/
    CanvasSection.tsx
    NodeSection.tsx
    NodesSection.tsx
    EdgeSection.tsx
    renderContextMenu.tsx
```

为什么这样组织：

- `domain.ts`：UI state
- `model.ts`：target / item / action / resolve rules
- `useContextMenuView.ts`：resolved view
- `ContextMenuFeature.tsx`：事件绑定 + 浮层渲染
- `sections/*`：具体菜单块渲染

这样结构比把逻辑散在 toolbar、selection、canvas handler 里更直。

---

## UI state 设计

右键菜单建议单独一个 UI domain，不要复用 selection domain，也不要放进 transient。

### state

```ts
type ContextMenuState =
  | { open: false }
  | {
      open: true
      screen: Point
      target: ContextMenuTarget
    }
```

### commands

```ts
type ContextMenuCommands = {
  open: (payload: { screen: Point; target: ContextMenuTarget }) => void
  close: () => void
}
```

### hooks

```ts
useContextMenu()
useContextMenuOpen()
```

说明：

- state 只存最小必要信息：`screen + target`
- 不要把 resolved node / edge / menu items 存进 atom
- resolved 数据放到 `useContextMenuView`

---

## resolved view 设计

`useContextMenuView` 负责把：

- `contextMenu` state
- `selection` snapshot
- committed node / edge read
- transient node / edge read（只在确有需要时）

统一 resolve 成 UI 可直接消费的数据。

推荐输出：

```ts
type ContextMenuView =
  | undefined
  | {
      screen: Point
      placement: {
        left: number
        top: number
        transform?: string
      }
      target:
        | { kind: 'canvas'; world: Point }
        | { kind: 'node'; node: Node; nodeId: NodeId }
        | { kind: 'nodes'; nodes: readonly Node[]; nodeIds: readonly NodeId[] }
        | { kind: 'edge'; edgeId: EdgeId }
      sections: ContextMenuSectionView[]
    }
```

这里最关键的是：

- `ContextMenuFeature` 不自己拼 selection / node / edge
- 只拿一个 `view` 去渲染

这和当前收 resolved view 的方向是一致的。

---

## 事件绑定设计

### 不要挂到 instance

右键菜单只有 React 画布容器这个消费者。

所以建议：

- 在 `ContextMenuFeature` 里监听 `containerRef.current` 的 `contextmenu`
- 不要新增 `instance.commands.contextMenu` 或 `instance.api.*`

这符合当前仓库的架构方向：

- 容器级事件在顶层 feature 组合
- 多消费者之前不随便升到 instance

### 打开流程

```ts
onContextMenu(event):
  1. 如果 target 在 [data-context-menu-ignore] 内，return
  2. event.preventDefault()
  3. 通过 closest('[data-node-id]') / closest('[data-edge-id]') 判断目标
  4. 必要时先同步更新 selection
  5. 计算 screen point / world point
  6. contextMenu.commands.open(...)
```

### 关闭流程

在 `ContextMenuFeature` 内绑定：

- `window.pointerdown` capture
- `window.keydown`
- 可选 `viewport.subscribe`

统一 close。

---

## target 解析规则

为了不让每个 feature 都去知道右键菜单，建议直接复用 DOM data attributes：

- node: `data-node-id`
- edge: `data-edge-id`
- ignore: `data-context-menu-ignore`

当前 node / edge 已经有前两者，右键菜单只需要补第三类。

建议在以下元素上统一加：

- node toolbar root
- node toolbar menu
- 未来 context menu 自己
- 任何不应触发右键菜单重开的浮层

---

## action 设计

不要一开始抽“跨 toolbar / context-menu 的全局 action DSL”。

第一版更推荐：

- `context-menu/model.ts` 内直接定义 item key 和 action resolver
- toolbar 继续保持自己的 model

原因：

- 两者展示形式不同
- 两者启用规则不同
- 两者的信息密度不同

可以共享的只是“命令级思路”，不是整个 UI 模型。

例如：

- duplicate / delete / group / ungroup / order / lock

这些动作可以在 context menu 内部直接写清楚，不需要先抽象成统一 registry。

等未来真的出现第三个消费面，例如：

- top menubar
- slash menu
- command palette

再考虑抽公共 action 层。

---

## 与现有能力的映射

当前仓库已存在可直接复用的命令：

- `instance.commands.selection.select`
- `instance.commands.selection.selectEdge`
- `instance.commands.selection.clear`
- `instance.commands.selection.selectAll`
- `instance.commands.node.duplicate`
- `instance.commands.node.deleteCascade`
- `instance.commands.node.group.create`
- `instance.commands.node.group.ungroupMany`
- `instance.commands.node.order.*`
- `instance.commands.node.updateMany`
- `instance.commands.edge.delete`
- `instance.commands.history.undo`
- `instance.commands.history.redo`

因此第一版右键菜单不需要补 engine 基建，主要是 UI 组织和 target 解析。

---

## 推荐落地顺序

### Phase 1：最小闭环

实现：

- `context-menu` domain
- `ContextMenuFeature`
- canvas / node / nodes / edge 四类 target
- 菜单项：
  - canvas: add common node, undo, redo, select all
  - node/nodes: duplicate, delete, lock, arrange, group/ungroup
  - edge: delete

这一阶段就已经能解决大部分用户预期。

### Phase 2：类型特化

追加：

- group 专属项
- mindmap 专属项
- edge routing 专属项

### Phase 3：更高级能力

追加：

- clipboard
- submenu
- keyboard menu key / Shift+F10
- touch long press

---

## 最终建议

最优方案不是把右键菜单做成“另一个 toolbar”，而是：

- 在 `whiteboard-react/src/context-menu` 下独立建一套系统
- 状态放 UI domain，不放 transient，不放 engine
- 事件绑定留在顶层 `ContextMenuFeature`
- 组件只消费 `useContextMenuView` 产出的 resolved view
- 第一版只做结构性操作和创建入口，不复制样式编辑菜单

一句话总结：

**右键菜单应该是一个独立的、selection-aware、target-aware 的 UI feature，而不是 toolbar 的变体，也不是 transient 的一部分。**
