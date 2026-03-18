# Whiteboard Runtime Read / Feature Session Boundary Design

## 1. 结论

这轮讨论之后，长期最优模型可以直接定成下面这版：

- `engine`
  - 只负责 `committed` 以及 `committed` 的派生
- `whiteboard-react/runtime.read`
  - 只负责“领域对象最终展示态 read”
- `features/*/session`
  - 只负责各 feature 自己持有的交互期原始临时态
- `feature hook / feature helper`
  - 只负责局部 UI 推导

这意味着三个明确结论：

1. `session/draft` 不进入 `engine`
2. 不再主张公开统一的顶层 `runtime.session`
3. `selected / overlay / toolbar / preview / menu` 这类对象，不进入核心 `runtime.read`

一句话概括：

- `engine.read = committed read`
- `runtime.read = final domain presentation read`
- `feature session = feature-owned transient source`
- `feature hook = local ui derivation`

---

## 2. 目标

这个设计的目标不是把所有推导集中到一个地方，而是把不同层次的推导重新归位。

需要达到的结果：

- `engine` 保持纯粹，只表达 committed truth
- 核心 runtime 对外只暴露稳定、瘦身后的 `read / state / commands / viewport`
- feature 级交互态由 feature 自己拥有，不挤进顶层 runtime namespace
- 领域级最终展示态由统一 projection 提供，组件不再自己拼 `committed + session`
- 单 feature 的 chrome / overlay / preview 仍然允许留在 feature 自己

明确不做：

- 不把 `session/draft` 放到 `engine`
- 不把所有 UI 推导都塞进核心 `runtime.read`
- 不公开一个持续膨胀的 `runtime.session.*`
- 不让组件或 hook 在消费点重复拼接基础领域展示态

---

## 3. 当前问题

### 3.1 `useEdgeView` 暴露了边界没有收好

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
- node drag / resize 的变化先存在 feature 层的本地 draft / session 中
- edge endpoint 必须跟随临时 geometry 实时变化

所以结论不是“这段逻辑不需要”，而是：

- 这段逻辑不应该挂在 feature hook 自己内部

### 3.2 当前 UI 消费点还在自己拼基础领域展示态

这会带来几个问题：

- 领域最终展示态没有统一入口
- 相同 overlay 规则容易在多个 hook 重复实现
- feature hook 被迫自己管理订阅组合与缓存
- committed source 和 feature session source 的边界直接暴露到 UI 使用点

### 3.3 另一种相反方向也不对

把所有推导都集中进核心 `runtime.read` 也不是最优。

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
- feature session
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

### 4.3 `whiteboard-react/runtime`

核心 runtime 对外只保留：

- `read`
- `state`
- `commands`
- `viewport`

其中：

- `read` 只放领域对象最终展示态
- `state` 只放公开语义状态，例如 `tool / selection / container / interaction`
- `commands` 继续是唯一写入口
- `viewport` 继续负责坐标与几何转换

明确不公开：

- 一个统一的 `runtime.session`

### 4.4 `features/*/session`

每个 feature 自己持有自己的交互期临时态。

例如可以存在：

- `features/node/session/*`
- `features/edge/session/*`
- `features/mindmap/session/*`

这一层只表达：

- 该 feature 当前交互期的原始 source

这一层不表达：

- 全局 runtime 契约
- 领域级最终展示态
- 可复用的跨 feature 权威 read

### 4.5 `feature hook / feature helper`

feature 层负责：

- 单 feature 的局部展示推导
- 单组件或少量组件消费的 UI model
- 基于核心 runtime + feature session 的薄组合

这一层长期应该保留，而且不应被完全消灭。

---

## 5. 为什么不公开顶层 `runtime.session`

这是这次修订里最重要的结论之一。

如果公开一个统一的：

```ts
instance.session.node
instance.session.edge
instance.session.connection
instance.session.selectionBox
instance.session.guides
instance.session.mindmap
```

会带来三个问题。

### 5.1 顶层 runtime API 会继续膨胀

`session` 很容易变成新的“大 transient 仓库”。

最终效果只是把原来的复杂度从 `view`、`draft`、`hook`，转移到一个新的顶层 namespace 里。

### 5.2 feature 边界会被打平

像：

- `selectionBox`
- `guides`
- `edgeConnectDraft`
- `routingDraft`

这些都具有强 feature 归属。

一旦进入统一顶层 `session`，就会失去“这是 node feature 自己的东西”或“这是 edge feature 自己的东西”的边界。

### 5.3 很多状态其实并不值得升级成 runtime 公共契约

很多 session source：

- 只有一个 feature 用
- 只有一个输入器和一个 overlay 组件用
- 甚至只有一个 hook 用

这种东西不应该天然升级成 runtime 顶层公共 API。

---

## 6. 最终设计原则

### 6.1 核心 runtime 只公开四块

最终公开实例继续固定为：

```ts
type WhiteboardInstance = {
  config: Readonly<BoardConfig>
  read: WhiteboardRead
  state: WhiteboardState
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (options: WhiteboardRuntimeOptions) => void
  dispose: () => void
}
```

也就是说：

- 不加 `session`
- 不加 `draft`
- 不加 `view`

### 6.2 feature session 是内部实现，不是核心公共语义

feature session 可以存在，但它们应该：

- 归属 feature 自己目录
- 只被 feature 自己的 hook / helper / input handler 消费
- 不默认提升到实例顶层 contract

### 6.3 只有“领域对象最终展示态”才进核心 `read`

进入核心 `read` 的对象必须回答这种问题：

- 这个领域对象当前最终是什么

而不是：

- 当前 UI 应该展示哪种 chrome
- 当前这个 feature 的局部 overlay 该怎么画

### 6.4 局部 UI model 继续留在 feature

像：

- selected handles
- preview line
- toolbar items
- context menu sections
- drag guides overlay

这些对象如果没有多个真实消费者，就应该继续留在 feature 自己。

---

## 7. `runtime.read` 的收录标准

判断一个对象要不要进入核心 `runtime.read`，建议固定使用下面这组规则。

### 7.1 必须同时满足的大原则

一个对象要进入核心 `runtime.read`，至少要满足：

- 它是领域对象的最终展示态，而不是某个 UI chrome model
- 它有多个真实消费者，不是单组件专用
- 它的语义需要统一，不能各处各算一套
- 它和 React 无关，换宿主也依然成立

### 7.2 适合进入 `runtime.read` 的对象

典型例子：

- `read.node.item`
  - committed node item + node feature session overlay 后的最终 node item
- `read.edge.item`
  - committed edge item + source/target final node geometry + edge feature session overlay 后的最终 edge item
- `read.mindmap.item`
  - committed mindmap item + mindmap feature session overlay 后的最终 mindmap item

这些对象都在回答同一个问题：

- 这个领域对象“当前最终是什么”

这类对象值得统一。

### 7.3 不适合进入 `runtime.read` 的对象

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

## 8. feature session 的设计标准

feature session 不是组件 `useState` 的同义词，也不是核心 runtime API。

它是介于两者之间的一层。

### 8.1 什么时候用组件本地 state

满足下面条件时，优先直接用组件本地 state：

- 单组件独占
- 不需要跨 hook / 跨组件 / 跨 listener 共享
- 生命周期完全跟组件绑定

### 8.2 什么时候用 feature session store

满足下面条件时，适合做 feature 私有 session store：

- 同一 feature 内有多个消费者
- 需要被输入处理、overlay、helper、lifecycle service 共享
- 需要轻量订阅，不想走 React render state
- 生命周期是“交互 session”，不是“组件 render 周期”
- 但不值得升级成核心 runtime contract

### 8.3 什么时候可以上升为核心 `runtime.read` 输入

只有一类特殊情况需要额外注意：

- 某个 feature session 虽然属于 feature 自己
- 但它会影响领域对象最终展示态

这时它可以作为核心 `runtime.read` 的内部输入，但仍然不需要公开为顶层 `runtime.session`。

也就是说：

- 可以被核心 projection 依赖
- 不等于必须成为核心 public API

---

## 9. 各类对象的最终归属

这一部分直接给出建议归位，避免后续再次摇摆。

### 9.1 node 临时 patch

语义：

- node drag / resize / rotate 期间的原始 patch

推荐归位：

- `features/node/session/*`

原因：

- 它属于 node feature 自己的交互期 source
- 但它会影响 `node final item` 和 `edge final item`
- 所以它可以作为核心 `runtime.read.node.item` / `runtime.read.edge.item` 的内部输入
- 不需要公开为统一顶层 `runtime.session.node`

### 9.2 edge routing draft

语义：

- edge routing 编辑期间的临时点位与激活态

推荐归位：

- `features/edge/session/*`

原因：

- 主要只影响 edge feature 自己
- 通常不值得升级成核心 runtime 公共语义

### 9.3 selection box raw rect

语义：

- selection box 交互过程中的原始矩形

推荐归位：

- `ui/canvas/input` 或 `features/selection/session/*`

原因：

- 它是非常局部的交互态
- 不属于领域对象最终展示态
- 大概率只被输入处理和 overlay 消费

### 9.4 guides raw array

语义：

- drag / transform 期间的辅助 guide 数据

推荐归位：

- `features/node/session/*`

原因：

- 强 node feature 语义
- 强视觉辅助语义
- 不值得提升为核心 runtime 公开能力

### 9.5 edge connect raw draft

语义：

- edge connect / reconnect 过程中的原始临时 draft

推荐归位：

- `features/edge/connect/session/*`

原因：

- 只服务 edge connect feature
- 主要被输入处理、preview、commit 流程消费
- 不适合升级成核心 runtime 顶层语义

---

## 10. Edge 链路的长期最优设计

### 10.1 当前错误的集中点

当前 `useEdgeView` 最大的问题不是算法，而是层次。

它现在同时在做：

- 读 committed edge item
- 读 committed node geometry
- 读 node feature session
- 读 edge feature session
- 重新计算 endpoints
- 产出 final edge view

这本质上就是 projection 层的工作。

### 10.2 长期最优职责

长期最优应该是：

- `runtime.read.edge.item`
  - 直接返回 final edge item

它内部依赖：

- `engine.read.edge.item`
- `runtime.read.node.item` 或等价的 final node geometry read
- `features/edge/session`
- 必要时也依赖 `features/node/session`

而不是让 feature hook 自己去：

- `read.index.node.get(...)`
- `applyCanvasDraft(...)`
- `resolveEdgeEndpoints(...)`

### 10.3 推荐的内部结构

长期可以把 edge 最终读链路建成：

```ts
engine.read.node.item
engine.read.edge.item
features/node/session
features/edge/session
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

### 10.4 最终 `useEdgeView` 的命运

长期来看，`useEdgeView` 这类 hook 应该：

- 消失
- 或退化成很薄的 store 订阅包装

也就是说，它不再自己承担基础领域展示态拼装职责。

---

## 11. 哪些东西应留在 feature hook

下面这类对象长期应该允许保留在 feature hook / helper：

- `useSelectedEdgeView`
- `useNodeToolbar`
- `useContextMenu`
- `useEdgeConnectPreview`
- `useSelectionBoxView`
- `useGuidesView`

前提是它们只做：

- 基于稳定的 `runtime.read`
- 基于 feature 自己的 session source
- 基于公开的 `runtime.state`
- 产出本 feature 的局部 UI model

它们不应该再做：

- committed domain object 的基础拼装
- 领域最终展示态的重复 overlay

---

## 12. 推荐的目录与 API 设计

这一部分直接给出“该如何设计”。

### 12.1 核心 runtime 目录

推荐长期稳定成：

- `runtime/read/*`
- `runtime/state/*`
- `runtime/instance/*`
- `runtime/viewport/*`
- `runtime/hooks/*`

这里不再新增：

- `runtime/session/*`
- `runtime/overlay/*`
- `runtime/preview/*`

### 12.2 feature session 目录

推荐使用 feature-owned 目录：

- `features/node/session/*`
- `features/edge/session/*`
- `features/edge/connect/session/*`
- `features/mindmap/session/*`

这些目录里的 store：

- 只被 feature 自己消费
- 不通过 `instance` 暴露为顶层公共契约

### 12.3 核心 `read` 的最终设计原则

核心 `read` 只放：

- `node.list`
- `node.item`
- `edge.list`
- `edge.item`
- `mindmap.list`
- `mindmap.item`
- `index.*`

其中：

- `list / item` 是最终领域展示态
- `index.*` 保持 committed query helper 语义

不要新增：

- `read.overlay.*`
- `read.preview.*`
- `read.selected.*`
- `read.toolbar.*`
- `read.contextMenu.*`

### 12.4 feature hook 的设计原则

feature hook 应按两类拆：

1. 基础领域读 hook
   - 只订阅核心 `runtime.read`
   - 尽量薄

2. feature UI 推导 hook
   - 基于 `runtime.read + feature session + runtime.state`
   - 只服务本 feature 自己

例如：

- `useEdgeItem(edgeId)`
  - 薄订阅 `runtime.read.edge.item`
- `useSelectedEdgeView()`
  - 基于 `runtime.read.edge.item + edge routing session + selection state`
- `useNodeToolbar()`
  - 基于 `runtime.read.node.item + selection state + registry`

---

## 13. 最终规则

为了后续收敛不再反复摇摆，建议直接固定下面这几条规则。

### 规则 1

`engine` 只关心 committed 以及 committed 的派生。

### 规则 2

`session/draft` 归 feature 所有，不进入 `engine`，也不默认进入 runtime 顶层 namespace。

### 规则 3

核心 runtime 只公开：

- `read`
- `state`
- `commands`
- `viewport`

### 规则 4

核心 `runtime.read` 只放领域对象最终展示态，不放 feature-local UI model。

### 规则 5

`selected / overlay / toolbar / menu / preview` 这类对象，如果没有多个真实消费者，默认留在 feature。

### 规则 6

任何“当前 hook 里自己在做 `committed + feature session overlay + final domain object` 拼装”的地方，都应该优先考虑上提到核心 `runtime.read`。

### 规则 7

任何“当前对象只是某个 feature 的局部 UI model”的地方，都不应该因为可以推导，就自动上提到核心 `runtime.read`。

---

## 14. 一句话总结

长期最优不是：

- 把 `session/draft` 下沉到 `engine`
- 也不是把所有 UI 推导都塞进核心 `runtime.read`
- 也不是公开一个越来越大的 `runtime.session`

长期最优是：

- `engine` 保持 committed 纯度
- feature 自己持有 feature-owned session source
- 核心 `runtime.read` 只统一领域对象最终展示态
- feature 自己保留局部 UI 推导

对应到当前问题：

- `useEdgeView` 里自己 `applyCanvasDraft(...)` 在当前实现下是功能上必须的
- 但长期应该上提为核心 `runtime.read.edge.item` 的内部逻辑
- 而不是继续散在 hook 里
- 也不是下沉到 `engine`
- 更不是把所有 preview / selected / overlay 一起塞进核心 `read`
