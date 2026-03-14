# 右键菜单、Selection 与 Editing Chrome 设计研究

## 背景

当前右键菜单已经基本可用，但暴露出一个明显的交互问题：

- 在 node 上打开右键菜单并点击菜单项后，菜单会关闭
- 目标 node 会处于选中态
- transform handles 会立即出现

这件事在数据语义上不一定错误，但在交互语义上不够自然。用户执行的是“上下文命令”，不是“进入普通编辑态”，但界面表现却像完成了一次普通左键选中。

问题的根本原因不是某一个事件处理器写错了，而是当前系统把下面几件事耦合得太紧：

- 菜单命中的对象是谁
- 当前正式选区是谁
- handles / toolbar / edge controls 这类 editing chrome 是否应该显示

## 结论

最优设计不是“右键不改 selection”，也不是“右键后直接把目标变成普通编辑 selection”，而是把三件事明确拆开：

- `selection`
  - 正式编辑对象
  - 决定命令、快捷键、批量操作默认作用于谁

- `contextMenuTarget`
  - 当前右键菜单命中的上下文对象
  - 只为上下文菜单提供 target

- `chromeVisibility`
  - 当前是否允许显示 transform handles、toolbar、edge routing controls 等编辑 chrome

其中最关键的一条是：

**`contextMenuTarget` 不应直接等同于 `selection`，`selection` 也不应直接等同于 “显示 handles”。**

## 对当前行为的评价

### 哪部分是合理的

- 右键菜单需要明确 target，这一点是对的
- 右键未选中的 node 时，菜单知道当前目标是这个 node，这一点是对的
- 右键多选中的某个 node 时，菜单作用于整个 selection，这一点也是对的

### 哪部分不够理想

- 为了拿到菜单 target，直接改写正式 selection
- 菜单关闭后，所有依赖 selection 的 editing chrome 立即恢复
- 用户执行的是 menu action，但视觉上像进入了 normal edit mode

所以问题不在于“node 被选中”本身，而在于：

- `selection` 被同时拿来表达“命令 target”和“编辑态”
- UI 层没有单独的 chrome 可见性规则

## 设计目标

这套设计应该满足以下目标：

1. 右键菜单始终有明确 target
2. 菜单打开期间不显示不必要的 editing chrome
3. 菜单关闭后的 selection 结果可控，不受菜单打开方式绑架
4. UI 层不要自己拼装多份状态
5. handles / toolbar / edge controls 都通过统一规则显示
6. 后续扩展到 hover toolbar、二级菜单、keyboard dismiss 时不打架

## 术语

为避免概念混乱，建议统一使用下面几个词：

- `selection`
  - 当前正式选区

- `contextMenu`
  - 当前菜单状态

- `contextTarget`
  - 菜单命中的上下文对象

- `chrome`
  - 所有依赖“进入编辑态”才显示的 UI
  - 包括 node transform handles、node toolbar、edge endpoint handles、edge routing handles

- `resolved view`
  - UI 最终消费的、已经合并过规则的结果

## 推荐状态模型

建议使用平铺模型，不要继续嵌套太深。

```ts
type ContextTarget =
  | { kind: 'canvas'; world: Point }
  | { kind: 'node'; nodeId: NodeId; world: Point }
  | { kind: 'nodes'; nodeIds: readonly NodeId[]; primaryNodeId: NodeId; world: Point }
  | { kind: 'edge'; edgeId: EdgeId; world: Point }

type ContextMenuState =
  | { open: false }
  | {
      open: true
      screen: Point
      target: ContextTarget
      selectionBeforeOpen: SelectionSnapshot
    }

type SelectionSnapshot = {
  nodeIds: readonly NodeId[]
  edgeId?: EdgeId
}

type ChromeSuppressionReason =
  | 'context-menu'
  | 'drag'
  | 'transform'
  | 'edge-connect'
  | 'edge-routing'
  | 'text-editing'

type ChromeState = {
  suppressedBy?: ChromeSuppressionReason
}
```

这里的要点有两个：

- `selectionBeforeOpen` 要在菜单打开时记录
- `chrome` 是否显示，应该是单独决策，不从 selection 直接推出

## 最优交互语义

### 1. 右键空白画布

- 打开 canvas menu
- suppress chrome
- 不显示 node handles / toolbar / edge controls
- 关闭菜单后不应该凭空出现任何 chrome

selection 是否清空可以按产品偏好决定，但更推荐：

- 菜单只负责打开 canvas target
- dismiss 菜单时恢复到菜单前 selection

这样更稳定，也更符合“右键只是查看命令”的语义。

### 2. 右键未选中的单个 node

- 打开 node menu
- 当前菜单 target 是这个 node
- 菜单期间 suppress chrome

关闭菜单时分两种：

- `dismiss`
  - 恢复到 `selectionBeforeOpen`
  - 不因为打开过菜单就进入普通编辑态

- `execute`
  - 由 action 自己决定最终 selection

这是最重要的一条规则。  
右键菜单的打开本身不应该强行改变正式 selection。

### 3. 右键已选中的单个 node

- 菜单 target 直接指向当前 selection
- 菜单期间 suppress chrome
- 菜单关闭后恢复原 selection 的 chrome 状态

这个场景下，恢复 selection 是自然的，因为菜单本来就是基于当前编辑对象打开的。

### 4. 右键多选中的某个 node

- 菜单 target 应该是 `nodes`
- 目标集合是整个当前 selected nodes
- 不能因为右键命中了其中一个 node，就把多选收缩成单选

菜单关闭后：

- dismiss: 恢复多选
- execute: 由 action 决定是否继续多选

### 5. 右键 edge

- 菜单 target 是 edge
- 菜单期间 suppress chrome
- 不显示 node handles
- 菜单关闭后若保留 edge selection，只恢复 edge 对应的编辑 affordance

## 菜单项执行后的推荐规则

action 执行后的 selection 不应由“菜单打开方式”决定，而应由“action 语义”决定。

建议如下：

### node / nodes

- `Delete`
  - 清空受影响对象的 selection

- `Lock`
  - 可以保留 selection
  - 但 locked node 不应显示 transform handles

- `Unlock`
  - 可以保留 selection
  - chrome 是否出现，取决于统一 chrome 规则

- `Duplicate`
  - 通常应切到新创建的对象

- `Arrange`
  - 保留当前 selection

- `Group`
  - 切到新 group selection

- `Ungroup`
  - 选中解组后得到的子节点，或者按产品策略清空
  - 但必须是 action 明确决定，不要使用菜单默认逻辑兜底

### edge

- `Delete`
  - 清空 edge selection

### canvas

- `Create node`
  - 通常切到新创建 node selection

- `Undo / Redo`
  - 按历史结果决定
  - 不要额外叠加 context menu 的恢复逻辑

## 为什么不应该继续把右键 target 直接写进 selection

### 1. selection 的语义会被污染

selection 原本表达的是“当前正式编辑对象”，如果右键只是为了弹出上下文菜单就去写 selection，那么 selection 同时承担了：

- 菜单 target
- 编辑对象
- 快捷键目标
- chrome 显示条件

这会让 selection 变成一个过载概念。

### 2. UI 会被迫自己猜状态

当 UI 同时知道：

- committed selection
- context menu 是否打开
- 某个 node 是否 locked
- 某个 interaction 是否活跃

如果没有统一的 resolved 结果，最终每个 feature 都会写自己的判断：

- NodeFeature 一套
- NodeToolbar 一套
- EdgeFeature 一套

这就是后续 bug 的来源。

### 3. 打开菜单和进入编辑态不是同一件事

右键的心理模型是：

- “我想看这个对象能做什么”

左键选中再出现 handles 的心理模型是：

- “我准备直接编辑这个对象”

这两个模式应该分开。

## 推荐的 resolved 设计

UI 层不应该直接消费原始 selection + context menu + interaction flags，再自己拼。

应该提供一层 resolved view，例如：

```ts
type ResolvedNodeChrome = {
  nodeIds: readonly NodeId[]
  visible: boolean
}

type ResolvedEdgeChrome = {
  edgeId?: EdgeId
  visible: boolean
}

type ResolvedContextMenuView = {
  open: boolean
  target?: ContextTarget
  placement?: {
    left: number
    top: number
    transform?: string
  }
}
```

更直接一点，可以提供：

```ts
getVisibleNodeHandlesSelection()
getVisibleNodeToolbarSelection()
getVisibleEdgeControlsSelection()
```

或者 hook 风格：

```ts
useNodeHandlesView()
useNodeToolbarView()
useEdgeControlsView()
```

关键点不是命名，而是：

- UI 只消费 resolved 结果
- UI 不自己决定“菜单开着时要不要显示 handles”

## 推荐的 chrome 显示规则

统一规则应接近下面这样：

### node handles

显示条件：

- 当前 `selection` 恰好是 node selection
- 当前没有 `contextMenu.open`
- 当前没有 active drag / transform / other suppress reason
- 目标 node 可编辑
- 若多选，则显示多选对应 handles
- 若单选且 locked，则不显示 transform handles

### node toolbar

显示条件：

- 当前 `selection` 存在且适合显示 toolbar
- 当前没有 `contextMenu.open`
- 当前没有其他 suppress reason

### edge controls

显示条件：

- 当前 `selection.edgeId` 有值
- 当前没有 `contextMenu.open`
- 当前没有 active routing / other suppress reason

### context menu

显示条件：

- `contextMenu.open === true`

一旦 context menu 打开：

- node handles 隐藏
- node toolbar 隐藏
- edge controls 隐藏

这条规则应该全局统一，不要分散到每个组件里手写。

## 推荐的关闭语义

context menu 的关闭应该区分两类：

### dismiss close

来源：

- 点击空白处
- 按 `Escape`
- 再次右键其他位置时切换菜单

行为：

- 关闭菜单
- 恢复 `selectionBeforeOpen`
- 解除 `context-menu` 对 chrome 的 suppress

### action close

来源：

- 点击菜单项

行为：

- 先执行 action
- 再关闭菜单
- 最终 selection 由 action 结果决定
- 解除 `context-menu` 对 chrome 的 suppress

这里最重要的是：

**`dismiss close` 和 `action close` 不应共用同一套 selection 收尾逻辑。**

如果共用，最终就会出现：

- 菜单动作执行完
- 菜单关闭
- selection 被无脑恢复或无脑保留
- handles 突然弹出

## 当前项目里的最佳落点

结合当前 `whiteboard-react` 架构，推荐这样放：

### 状态归属

- `selection`
  - 继续属于 selection domain

- `contextMenu`
  - 继续属于独立 context-menu domain

- `chrome visibility resolved rules`
  - 单独做一层 resolved view
  - 不塞进 instance
  - 不塞进 engine
  - 不让每个 feature 自己重复推导

### 哪些东西不建议做

- 不建议把右键菜单 target 全部并入 selection
- 不建议让 `NodeFeature`、`NodeToolbarFeature`、`EdgeFeature` 分别自己判断 menu open
- 不建议在 component 内把“selection 是否存在”直接写成“handles 是否显示”

## 对现有方案的最优演进方向

从当前代码出发，最优方向不是大规模重写，而是先把职责切干净。

### 第一步

明确两种 selection：

- `selectionBeforeOpen`
- `selectionAfterAction`

不要再让“菜单打开时临时改 selection”承担全部职责。

### 第二步

把 chrome 的显示规则上收成 resolved 层：

- `useNodeHandlesView`
- `useNodeToolbarView`
- `useEdgeControlsView`

这几个 resolved hook 内部统一消费：

- selection
- context menu open
- locked state
- 当前 interaction 状态

### 第三步

让 action 明确声明 selection 结果，而不是靠菜单收尾时猜。

例如：

- duplicate action 自己选择新对象
- delete action 自己清空
- arrange action 自己保留原 selection

### 第四步

如果后续还要做 hover toolbar、右键二级菜单、inline text editing，就继续沿用这套模型，不要退回去把状态都塞回 selection。

## 最终建议

最优解可以概括为三句话：

1. 右键菜单需要独立 `contextTarget`
2. 正式编辑对象继续由 `selection` 表达
3. handles / toolbar / edge controls 统一由 resolved chrome 规则决定

换句话说：

- 菜单 target 是“命令上下文”
- selection 是“正式编辑对象”
- chrome 是“编辑态视觉结果”

这三者相关，但不相等。

## 一句话结论

当前“点击右键菜单项后菜单关闭，node 被选中并弹出 transform handles”的行为，不是彻底错误，但不是最优交互。  
最优方案是把 `contextMenuTarget`、`selection` 和 `editing chrome visibility` 明确拆开，并让 UI 只消费 resolved 结果。
