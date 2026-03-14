# 右键菜单状态边界与落点审计

## 目标

本文只做一件事：

- 审计当前 `whiteboard-react` 里右键菜单、selection、handles、toolbar、edge controls 的真实依赖链
- 明确哪些边界是合理的，哪些耦合会继续制造 bug
- 给出最优的代码落点

本文不直接讨论具体交互结论，交互结论已经在 `CONTEXT_MENU_SELECTION_CHROME_DESIGN.zh-CN.md` 中说明。  
这里重点是“现在代码在哪里耦合了”和“下一步应该把什么放到哪里”。

## 当前结构审计

### 1. Selection domain

文件：

- `packages/whiteboard-react/src/selection/domain.ts`
- `packages/whiteboard-react/src/selection/hooks.ts`

当前职责：

- 保存正式 selection
- 提供：
  - `selectedNodeIds`
  - `selectedEdgeId`
  - `selectionSnapshot`
- 提供写操作：
  - `select`
  - `selectEdge`
  - `clear`
  - `selectAll`

当前特点：

- 这个 domain 很干净
- 它只表达“正式选区”
- 目前没有承担 context menu 的状态

评价：

- 这部分边界是对的
- 不建议把 context menu target 直接并回这里

### 2. Context menu domain

文件：

- `packages/whiteboard-react/src/context-menu/domain.ts`
- `packages/whiteboard-react/src/context-menu/ContextMenuFeature.tsx`
- `packages/whiteboard-react/src/context-menu/useContextMenuView.ts`

当前职责：

- 保存菜单是否打开
- 保存菜单 target
- 保存菜单屏幕位置
- 负责菜单事件绑定与打开关闭

当前状态模型：

```ts
type ContextMenuState =
  | { open: false }
  | {
      open: true
      screen: Point
      target: ContextMenuTarget
    }
```

问题：

- 这里只有 `target`
- 没有 `selectionBeforeOpen`
- 没有区分 `dismiss close` 和 `action close`
- 菜单关闭时缺少恢复语义

更关键的问题在 `ContextMenuFeature.tsx`：

- 右键 node / edge 时，为了让菜单获得正确 target，会直接改 selection
- 这意味着 context menu 打开动作会污染正式 selection

评价：

- context menu 独立建 domain 是对的
- 但这个 domain 还不完整
- 目前它只管“开关菜单”，还没有完整承担“上下文命令模式”的语义

### 3. Node handles

文件：

- `packages/whiteboard-react/src/node/components/NodeFeature.tsx`
- `packages/whiteboard-react/src/node/components/NodeTransformHandles.tsx`

当前核心逻辑：

- `NodeFeature` 直接读取 `useSelection()`
- `selectedNodeIds.map(...)` 直接渲染 `NodeTransformOverlayItem`
- 只额外受 `activeTool === 'select'` 限制

当前显示条件实际上接近：

```ts
tool === 'select' && selectedNodeIds.length > 0
```

然后再到单项里检查：

- `view` 是否存在
- `view.node.locked` 时不显示

问题：

- node handles 完全不知道 context menu 是否打开
- node handles 也不知道当前是不是“上下文命令模式”
- 它们只知道“这个 node 在 selection 里”

这就是为什么：

- 右键菜单一旦通过 selection 命中 node
- 菜单关闭后 handles 就会冒出来

评价：

- 当前设计不理想
- handles 不应该直接由 selection 驱动
- handles 应该消费 resolved chrome 结果

### 4. Node toolbar

文件：

- `packages/whiteboard-react/src/toolbar/useNodeToolbarView.ts`
- `packages/whiteboard-react/src/toolbar/NodeToolbarFeature.tsx`

当前核心逻辑：

- `useNodeToolbarView` 基于 selection 解析 toolbar 目标
- `NodeToolbarFeature` 额外读取 `useContextMenuOpen()`
- `contextMenuOpen === true` 时直接 `return null`

这意味着：

- toolbar 已经开始意识到“selection 不等于应该显示 toolbar”
- 它已经有了一层额外抑制条件

但问题在于：

- 这个规则只存在于 toolbar feature
- handles 和 edge controls 没有复用这套规则

评价：

- toolbar 的方向是对的
- 但它现在是 feature 内部各自补丁式处理
- 还没有上升成统一 resolved rule

### 5. Edge controls

文件：

- `packages/whiteboard-react/src/edge/components/EdgeLayer.tsx`
- `packages/whiteboard-react/src/edge/hooks/useSelectedEdgeView.ts`
- `packages/whiteboard-react/src/edge/components/EdgeFeature.tsx`

当前核心逻辑：

- `EdgeLayer` 用 `useSelection().edgeId` 决定哪条边被选中
- `useSelectedEdgeView` 用 `useSelection().edgeId` 决定是否返回当前 edge 的 endpoints / routing handles
- `EdgeFeature` 只要 `selectedEdgeView` 存在，就直接渲染 endpoint handles 和 routing handles

问题：

- edge controls 也完全不知道 context menu 是否打开
- 所以如果后续右键 edge 并保留 selection，这里同样会出现“菜单关闭后编辑 chrome 立即出现”的问题

评价：

- edge 这边和 node handles 是同一类问题
- 只是目前用户先在 node 场景感受到了

## 当前耦合图

可以把当前依赖关系简化成下面这样：

```text
selection
  -> NodeFeature handles
  -> NodeToolbarView
  -> EdgeLayer selected style
  -> useSelectedEdgeView
  -> EdgeFeature controls

contextMenuOpen
  -> NodeToolbarFeature only

contextMenuTarget
  -> ContextMenuFeature / useContextMenuView only
```

这张图说明两个问题：

1. `selection` 承担了过多职责
2. `contextMenu` 对 editing chrome 的影响没有统一出口

## 当前最核心的问题

不是“菜单有没有独立状态”，而是：

**editing chrome 没有自己的 resolved 层。**

于是现在代码只能这样演化：

- toolbar 发现有问题，于是自己读 `contextMenuOpen`
- handles 还没接，于是行为不一致
- edge controls 还没接，于是行为也不一致

如果继续沿这个方向写，会越来越像：

- A feature 自己补一个 `if (contextMenuOpen) return null`
- B feature 再补一个
- C feature 再补一个

最后系统会变成“每个 feature 都知道 context menu 的细节”，这是不对的。

## 最优边界

### Selection domain 继续只管正式选区

保留在：

- `packages/whiteboard-react/src/selection/`

职责不变：

- 正式选区
- selection commands
- selection snapshot

不要塞进去：

- context menu target
- chrome visibility

### Context menu domain 继续只管上下文菜单

保留在：

- `packages/whiteboard-react/src/context-menu/`

但状态要补全，至少应当具备：

```ts
type ContextMenuState =
  | { open: false }
  | {
      open: true
      screen: Point
      target: ContextTarget
      selectionBeforeOpen: SelectionSnapshot
    }
```

职责：

- 菜单 target
- 菜单开关
- 菜单打开前的 selection 快照
- 区分 dismiss / action 的关闭语义

### Editing chrome 应该独立成一个 resolved 层

这是当前最缺的一层。  
建议新建目录：

- `packages/whiteboard-react/src/chrome/`

这个目录不负责渲染，只负责把下面这些原始输入整合成 UI 可直接消费的 resolved 结果：

- selection
- context menu open
- context menu target
- locked state
- active tool
- 当前 interaction 抑制状态

推荐文件结构：

```text
packages/whiteboard-react/src/chrome/
  useNodeHandlesView.ts
  useNodeToolbarChrome.ts
  useEdgeControlsView.ts
  useChromeSuppressed.ts
```

如果后续觉得目录太轻，也可以把它命名成：

- `packages/whiteboard-react/src/editor-chrome/`

但我更倾向 `chrome/`，更短，也更通用。

## 为什么不是把这套逻辑继续留在 toolbar / node / edge 目录里

因为这不是单个 feature 的私有逻辑，而是跨 feature 的统一显示规则。

如果继续分散：

- node handles 会有自己的“是否显示”规则
- toolbar 会有自己的“是否显示”规则
- edge controls 会有自己的“是否显示”规则

最后即使三边都修好了，未来再加：

- text inline editor
- comment anchor
- connection affordance

又会重来一遍。

这类规则本质上是“编辑态 chrome 协调层”，应该有单独落点。

## 推荐的 resolved hook 设计

### 1. Node handles

建议新增：

- `packages/whiteboard-react/src/chrome/useNodeHandlesView.ts`

返回值示例：

```ts
type NodeHandlesView =
  | {
      visible: false
    }
  | {
      visible: true
      nodeIds: readonly NodeId[]
    }
```

内部统一判断：

- 当前 tool 是否是 `select`
- context menu 是否打开
- selection 是否是 node selection
- node 是否 locked
- 是否有其他 suppress reason

然后 `NodeFeature` 不再自己用 `selection.nodeIds` 直接渲染 handles，而是改成消费 `useNodeHandlesView()`

### 2. Node toolbar

建议现有：

- `packages/whiteboard-react/src/toolbar/useNodeToolbarView.ts`

保留“toolbar 内容解析”职责，但把“是否允许显示 toolbar”上收。

新增：

- `packages/whiteboard-react/src/chrome/useNodeToolbarChrome.ts`

或者更统一地直接叫：

- `packages/whiteboard-react/src/chrome/useNodeToolbarView.ts`

然后把：

- selection
- context menu open
- tool
- resolved placement

一起合并成最终 toolbar view。

这样 `NodeToolbarFeature` 就不需要自己额外读 `useContextMenuOpen()`。

### 3. Edge controls

建议新增：

- `packages/whiteboard-react/src/chrome/useEdgeControlsView.ts`

返回：

```ts
type EdgeControlsView =
  | { visible: false }
  | {
      visible: true
      edgeId: EdgeId
      endpoints: ...
      routingHandles: ...
    }
```

然后：

- `EdgeLayer` 是否高亮 selected edge 可以继续直接依赖 selection
- 但 endpoint handles / routing handles 不应再直接依赖 selection
- 应该改为依赖 `useEdgeControlsView()`

这是一个很重要的区分：

- edge 的“被选中高亮”属于 selection 视觉
- edge 的“编辑 handles”属于 editing chrome

这两者不应该再混为一谈。

## Context menu feature 自身的最佳职责

`ContextMenuFeature.tsx` 最优只负责：

- 从事件中解析 `contextTarget`
- 打开菜单
- 关闭菜单
- 将 action click 转换为 command 调用

它不应该再负责：

- 为了菜单打开而强行写 selection
- 决定 handles 是否显示
- 决定 toolbar 是否隐藏

换句话说，它只应该管理“上下文命令模式”，不应该直接接管“编辑态 UI”。

## 右键打开时 selection 怎么处理

从代码边界上，推荐这样做：

### 打开菜单时

- 读取当前 selection
- 存入 `selectionBeforeOpen`
- 只记录 `contextTarget`
- 不立即强制写正式 selection

### 关闭菜单时

- `dismiss close`
  - 恢复 `selectionBeforeOpen`

- `action close`
  - 由 action 自己提交最终 selection

如果某些 action 需要“先有 selection 才能复用现有命令”：

- 应该优先改 action 层，显式接受 target
- 不要再让 context menu 借道“临时改 selection”去驱动业务

## 推荐的迁移顺序

如果后续落代码，最稳的顺序是：

### 第一步

补全 context menu state：

- `selectionBeforeOpen`
- `dismiss close` / `action close` 语义

### 第二步

抽出 `chrome/` resolved 层

先做三个入口：

- `useNodeHandlesView`
- `useNodeToolbarView` 或 `useNodeToolbarChrome`
- `useEdgeControlsView`

### 第三步

改三个消费点：

- `NodeFeature`
- `NodeToolbarFeature`
- `EdgeFeature`

让它们只消费 resolved 结果，不再自己组合 selection 与 context menu

### 第四步

最后再回头清理 `ContextMenuFeature` 里“为了菜单打开去改 selection”的逻辑

这样做风险最小，因为：

- 先把“显示逻辑”统一
- 再调整“打开语义”
- 可以避免中途 UI 行为更乱

## 哪些东西现在不用动

以下部分当前不用为这个问题重构：

- `selection/domain.ts` 的数据结构
- `selection/hooks.ts` 的基础导出
- `useNodeToolbarView` 里对单选/多选 toolbar 内容的解析
- `useSelectedEdgeView` 里对 endpoints / routing handles 的解析细节

这些都不是当前问题的根源。  
问题在于“它们被谁调用、调用前是否经过统一的 chrome rule”。

## 最终建议

从代码组织角度，最优形态是：

### 保留

- `selection/`
  - 正式选区

- `context-menu/`
  - 上下文菜单

- `toolbar/`
  - toolbar 内容模型与渲染

- `edge/`
  - edge 视图与交互

- `node/`
  - node 视图与交互

### 新增

- `chrome/`
  - 跨 feature 的 editing chrome resolved 规则

### 核心原则

- selection 不直接等于 handles
- context menu target 不直接等于 selection
- UI feature 不自己拼状态
- 所有编辑 chrome 统一消费 resolved view

## 一句话结论

当前最该新增的不是更多菜单逻辑，而是一个独立的 `chrome` resolved 层。  
它应该放在 `packages/whiteboard-react/src/chrome/`，作为 `selection` 和 `context-menu` 之间的协调层，统一决定 node handles、toolbar、edge controls 的显示，而不是继续让各个 feature 自己读原始状态拼规则。
