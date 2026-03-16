# Whiteboard Runtime Read / Session Boundary Design

## 1. 结论

这轮讨论之后，长期最优模型可以直接定成下面这版：

- `engine`
  - 只负责 `committed` 以及 `committed` 的派生
- `whiteboard-react/runtime.session`
  - 只负责 UI/runtime 持有的交互期原始临时态
- `whiteboard-react/runtime.read`
  - 只负责“领域对象的最终展示态 read”
- `feature hook / feature helper`
  - 只负责单 feature、单消费点、强 UI 语义的局部推导

这意味着有两个明确边界：

1. `session/draft` 不进入 `engine`
2. `overlay / selected / toolbar / preview` 这类单 feature UI 模型，不进入核心 `runtime.read`

一句话概括：

- `engine.read = committed read`
- `runtime.session = transient raw state`
- `runtime.read = final domain presentation read`
- `feature hook = local ui derivation`

---

## 2. 目标

这个设计的目标不是把所有推导集中到一个地方，而是把不同层次的推导重新归位。

需要达到的结果：

- `engine` 保持纯粹，只表达 committed truth
- `runtime.read` 只承载“值得统一”的领域级最终读模型
- `runtime.session` 只承载交互期原始状态，不承载过厚的 UI view model
- feature 级别的局部 UI 推导继续留在 feature 自己，不挤进核心 runtime API
- React 组件不再自己拼 `committed + session`

明确不做：

- 不把 `session/draft` 放到 `engine`
- 不把所有可推导对象都塞进 `runtime.read`
- 不把单组件消费的 overlay model 做成全局核心 read contract
- 不让组件或 hook 在消费点重复拼 `committed + session`

---

## 3. 当前问题

### 3.1 `useEdgeView` 暴露了边界未收拢

以 [packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts) 为例，当前逻辑里存在：

```ts
const sourceEntry = instance.read.index.node.get(entry.edge.source.nodeId)
const targetEntry = instance.read.index.node.get(entry.edge.target.nodeId)
if (!sourceEntry || !targetEntry) {
  return entry
}

const source = applyCanvasDraft(sourceEntry, sourceDraft)
const target = applyCanvasDraft(targetEntry, targetDraft)
const endpoints = resolveEdgeEndpoints({
  edge: entry.edge,
  source,
  target
})
```

这段逻辑在当前实现下是功能上正确的，因为：

- `instance.read.edge.item` 目前本质上还是 committed read
- node drag / resize 的变化先存在 `instance.draft.node`
- edge endpoint 需要跟随 draft geometry 实时变化

所以“要不要 overlay node draft”这个问题，答案是：

- 要
- 而且必须

真正的问题不是这段逻辑对不对，而是：

- 这段逻辑不应该挂在 feature hook 自己内部

### 3.2 当前 UI 消费点仍然在自己拼 committed + session

这会带来几个问题：

- 领域最终展示态没有统一入口
- 相同 overlay 规则容易在多个 hook 重复实现
- feature hook 被迫自己管理订阅组合与缓存
- `engine.read` 和 `runtime.session` 的边界直接暴露到 UI 使用点

### 3.3 另一种相反方向也不对

把所有推导都集中进 `runtime.read` 也不是最优。

例如下面这类对象：

- selected edge handles
- edge connect preview
- selection box rect
- drag guides
- node toolbar model
- context menu model

虽然都可以从核心 runtime + 局部状态推导出来，但它们并不天然属于“核心领域 read”。

如果把这类对象也塞进 `runtime.read`，结果会是：

- `runtime.read` 膨胀成 UI model 仓库
- 领域 read 和 UI chrome model 混在一起
- API 面继续变大，反而不清晰

---

## 4. 最终分层

### 4.1 `@whiteboard/core`

`core` 只放：

- store primitive
- derived store primitive
- geometry / edge endpoint / selection / snap / group 等纯算法
- 基础类型

`core` 不知道：

- committed
- session
- react
- overlay

### 4.2 `@whiteboard/engine`

`engine` 只放 committed 相关能力：

- committed document
- committed commands
- committed read
- committed index / query helper
- committed projection

`engine` 不知道：

- draft
- hover
- selection box
- guides
- toolbar
- context menu
- feature preview

所以最终：

- `engine.read` 是 committed read source
- 它不是 UI 最终消费 read

### 4.3 `whiteboard-react/runtime.session`

`runtime.session` 只放交互期原始临时态。

这一层允许存在：

- node drag / resize / rotate draft
- edge routing draft
- edge connect session
- selection box raw rect
- guides raw data
- mindmap drag raw preview

但这一层不应该承载过厚的衍生 view model。

它回答的问题是：

- 交互当前处于什么临时状态
- 某个领域对象当前被本地 session 临时覆盖成什么原始值

而不是：

- 当前 UI 应该怎么渲染 chrome

### 4.4 `whiteboard-react/runtime.read`

`runtime.read` 只放“领域对象的最终展示态 read”。

它的输入来自：

- `engine.read`
- `runtime.session`

它的输出必须仍然是领域对象级别的最终读模型，而不是 feature-local UI 模型。

推荐长期固定规则：

- `runtime.read` 只允许放“node / edge / mindmap / container-like domain presentation”
- 不允许把“selected / overlay / toolbar / menu / preview”默认塞进去

### 4.5 `feature hook / feature helper`

feature 层负责：

- 单 feature 的局部展示推导
- 单组件或少量组件消费的 UI model
- 基于 `runtime.read + runtime.session + runtime.state` 的薄组合

这一层是允许存在的，而且长期应该保留。

原因很简单：

- 有些对象本来就不值得升级成核心 runtime contract
- 强行集中会让 runtime API 继续膨胀

---

## 5. `runtime.read` 的收录标准

判断一个对象要不要进入 `runtime.read`，建议使用下面这组规则。

### 5.1 必须同时满足的大原则

一个对象要进入核心 `runtime.read`，至少要满足：

- 它是领域对象的最终展示态，而不是某个 UI chrome model
- 它有多个真实消费者，不是单组件专用
- 它的语义需要统一，不能各处各算一套
- 它和 React 无关，换宿主也依然成立

### 5.2 适合进入 `runtime.read` 的对象

典型例子：

- `read.node.item`
  - committed node item + node session overlay 后的最终 node item
- `read.edge.item`
  - committed edge item + source/target final node geometry + edge session overlay 后的最终 edge item
- `read.mindmap.item`
  - committed mindmap item + mindmap session overlay 后的最终 mindmap item

这些对象都在回答同一个问题：

- 这个领域对象“当前最终是什么”

这类对象值得统一。

### 5.3 不适合进入 `runtime.read` 的对象

典型例子：

- selected edge handles
- edge routing selected control model
- edge connect preview model
- selection box overlay rect
- transform guides
- toolbar model
- context menu model

这些对象的问题在于：

- 语义强依赖当前 selection / tool / hover / chrome policy
- 往往只有一个或少量组件消费
- 本质是 feature-local UI model，而不是领域对象最终读模型

所以它们不应该自动升级成核心 runtime API。

---

## 6. `runtime.session` 的收录标准

`runtime.session` 只保留原始临时态，不保留过厚的推导 view model。

适合放在 `runtime.session` 的，是这种语义：

- 当前 node 的临时 patch 是什么
- 当前 edge routing 的临时点位是什么
- 当前 selection box 的 raw rect 是什么
- 当前 guides 的 raw 数组是什么
- 当前 edge connect 的 raw draft 是什么

不建议放在 `runtime.session` 的，是这种语义：

- 当前 selected edge 应该展示哪些 handles
- 当前 toolbar 应该放哪些菜单项
- 当前 preview line 应该怎么组合成完整 UI model

也就是说：

- `session = source`
- 不是 `session = final ui model`

---

## 7. feature hook 的长期职责

feature hook 长期应该保留，但职责要收窄。

### 7.1 应该保留的 feature hook

适合保留在 feature hook 的对象：

- `useSelectedEdgeView`
- `useNodeToolbar`
- `useContextMenu`
- `useEdgeConnectPreview`
- `useSelectionBoxView`
- `useGuidesView`

前提是它们只做：

- 基于稳定的 `runtime.read` / `runtime.session` / `runtime.state`
- 推导本 feature 的局部 UI model

### 7.2 不应该继续保留的 feature hook

不应该继续保留的，是这种“自己补领域最终展示态”的 hook：

- `useEdgeView` 当前这一类
- `useNodeView` 里如果仍然在自己拼 committed + session 的部分

这类 hook 的问题是：

- 它们在做 runtime projection 本该负责的工作

长期它们应该：

- 消失
- 或退化成很薄的 store 订阅包装

---

## 8. Edge 链路的最终最优模型

### 8.1 当前错误的集中点

当前 `useEdgeView` 最大的问题不是算法，而是层次。

它现在同时在做：

- 读 committed edge item
- 读 committed node geometry
- 读 node draft
- 读 edge draft
- 重新计算 endpoints
- 产出 final edge view

这本质上就是 projection 层的工作。

### 8.2 长期最优职责

长期最优应该是：

- `runtime.read.edge.item`
  - 直接返回 final edge item

它内部依赖：

- `engine.read.edge.item`
- `runtime.read.node.canvas` 或等价的 final node geometry read
- `runtime.session.edge`

而不是让 feature hook 自己去：

- `read.index.node.get(...)`
- `applyCanvasDraft(...)`
- `resolveEdgeEndpoints(...)`

### 8.3 推荐的内部结构

长期可以把 edge 最终读链路建成：

```ts
engine.read.node.item
engine.read.edge.item
runtime.session.node
runtime.session.edge
runtime.read.node.item
runtime.read.edge.item
```

其中：

- `runtime.read.node.item`
  - 负责 node 的 final domain presentation
- `runtime.read.edge.item`
  - 依赖 `runtime.read.node.item`
  - 负责 edge 的 final domain presentation

这样：

- edge 不再自己知道 node draft 细节
- overlay 规则只写一次
- UI 不再自己补 endpoint

---

## 9. 不该进入核心 `runtime.read` 的几个明确例子

这一部分是为了防止后续再次过度集中化。

### 9.1 `selected edge handles`

不建议进入 `runtime.read`。

理由：

- 它不是“edge 当前是什么”
- 它是“当前 selection 下 edge 应该展示什么控制点”
- 这属于 feature-local UI policy

推荐位置：

- `features/edge` 自己的 hook 或 helper

### 9.2 `edge connect preview`

不建议进入 `runtime.read`。

理由：

- 它是 edge-connect 交互过程中的 preview model
- 非领域对象
- 非跨 feature 权威 read

推荐位置：

- `features/edge/connect` 的 hook/helper
- 输入来自 `runtime.session.connection + runtime.read.node/edge + runtime.state`

### 9.3 `selection box`

不建议进入 `runtime.read`。

理由：

- 本质就是 selection session 的 raw rect
- 没有必要上升成核心 read contract

推荐位置：

- 保留在 `runtime.session.selection`
- 由 feature hook 或 overlay 组件直接消费

### 9.4 `guides`

不建议进入 `runtime.read`。

理由：

- 本质是 drag / transform session 的辅助视觉产物
- 强 UI 语义
- 非领域对象最终展示态

推荐位置：

- 保留在 `runtime.session.guides`
- 由 `NodeOverlayLayer` 或对应 feature helper 直接消费

---

## 10. 推荐的最终 API 方向

### 10.1 Engine 层

```ts
type EngineInstance = {
  read: EngineCommittedRead
  commands: EngineCommands
  config: Readonly<BoardConfig>
  configure: (...)
  dispose: () => void
}
```

这里的 `read` 只表示 committed。

### 10.2 React Runtime 内部

```ts
type RuntimeSession = {
  node: ...
  edge: ...
  connection: ...
  selection: ...
  guides: ...
  mindmap: ...
}
```

```ts
type RuntimeRead = {
  node: {
    list: ...
    item: ...
  }
  edge: {
    list: ...
    item: ...
  }
  mindmap: {
    list: ...
    item: ...
  }
  index: EngineCommittedIndex
}
```

注意这里：

- `index` 仍然是 committed query helper
- `item` 是 final domain presentation read

### 10.3 Feature 层

feature 自己继续持有：

- `useSelectedEdgeView`
- `useNodeToolbar`
- `useContextMenu`
- `useEdgeConnectPreview`
- `useSelectionBoxView`

这类 hook 不进入核心 runtime public contract。

---

## 11. 文件布局建议

如果后续按这个模型继续收敛，推荐朝下面的方向整理：

### 11.1 `runtime/session`

保留：

- `node.ts`
- `edge.ts`
- `connection.ts`
- `selection.ts`
- `guides.ts`
- `mindmap.ts`

它们都只表达 raw session state。

### 11.2 `runtime/read`

只新增真正值得统一的领域 read：

- `read/node.ts`
- `read/edge.ts`
- `read/mindmap.ts`

不要新增：

- `read/overlay.ts`
- `read/toolbar.ts`
- `read/contextMenu.ts`
- `read/selected.ts`

### 11.3 `features/*`

保留 feature-local 推导：

- `features/edge/hooks/*`
- `features/node/hooks/*`
- `ui/context-menu/*`
- `ui/node-toolbar/*`

但它们的输入应该是：

- `runtime.read`
- `runtime.session`
- `runtime.state`

而不是自己再去补 committed projection。

---

## 12. 最终规则

为了后续收敛不再反复摇摆，建议直接固定下面这几条规则：

### 规则 1

`engine` 只关心 committed 以及 committed 的派生。

### 规则 2

`session/draft` 归 `whiteboard-react/runtime` 所有，不进入 `engine`。

### 规则 3

`runtime.read` 只放领域对象最终展示态，不放 feature-local UI model。

### 规则 4

`selected / overlay / toolbar / menu / preview` 这类对象，如果没有多个真实消费者，默认不进入核心 `runtime.read`。

### 规则 5

feature hook 可以保留，但只能做局部 UI 推导，不能继续承担 committed + session 的基础拼装职责。

### 规则 6

任何“当前 hook 里自己在做 `committed + session overlay + final domain object` 拼装”的地方，都应该优先考虑上提到 `runtime.read`。

---

## 13. 一句话总结

长期最优不是：

- 把 `session/draft` 下沉到 `engine`
- 也不是把所有 UI 推导都塞进 `runtime.read`

长期最优是：

- `engine` 保持 committed 纯度
- `runtime.session` 保存原始临时态
- `runtime.read` 只统一领域对象最终展示态
- feature 自己保留局部 UI 推导

对应到当前问题：

- `useEdgeView` 里自己 `applyCanvasDraft(...)` 在当前实现下是功能上必须的
- 但长期应该上提为 `runtime.read.edge.item` 的内部逻辑
- 而不是继续散在 hook 里
- 也不是下沉到 `engine`
