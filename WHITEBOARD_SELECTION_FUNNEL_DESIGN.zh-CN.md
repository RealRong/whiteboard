# Whiteboard Selection Funnel Design

## 1. 结论

`selection` 的长期最优设计，不应该是：

- 每个 action 自己决定要不要改 selection
- 也不应该是 selection store 自己分散监听 node/edge 变化后再偷偷回写

最符合漏斗原则与职责分离的模型是：

```txt
用户交互 / 快捷键 / 菜单 / 本地写命令结果 / 历史回放 / 远端变更
-> intent
-> selection policy
-> session finalize
-> selection source
-> selection view
```

对应的核心判断如下：

1. `selection` 是 `whiteboard-react runtime` 的 UI session state，不是 document state。
2. `instance.commands.node / edge / mindmap` 必须保持纯 document write，不携带 selection 副作用。
3. `selection` 需要拆成两半：
   - `policy`
     - 只负责本地 UX 意图，例如 duplicate 后选中新副本
   - `reconcile`
     - 只负责不变量修复，例如被删节点从选区剔除
4. `container` 是 scope session，`selection` 是 target session；两者有关联，但不能互相吞并。
5. selection 的最终落点必须极少，最好始终只允许：
   - `none`
   - `nodes`
   - `edge`

一句话概括：

**让上层意图足够丰富，让中层策略足够克制，让底层状态足够单一。**

---

## 2. 目标

本文要解决的不是“selection 怎么写起来方便”，而是下面四个长期问题：

1. 怎么让 selection 不随着功能增长而持续膨胀。
2. 怎么让 selection 与 node write / edge write / container scope / overlay session 各自归位。
3. 怎么让本地 UX 行为和远端/系统变更不会互相污染。
4. 怎么让所有影响 selection 的逻辑都通过尽可能少的窄口收敛。

目标结果：

- `selection` 只表达“当前 UI 的目标对象”
- `selection` 只有一个 canonical source
- 所有 selection 合法性修复都有统一 finalize 入口
- 所有“动作完成后应该选谁”的逻辑都集中为少量 policy
- `container`、`interaction`、`overlay` 不再把 selection 当成临时垃圾桶

明确不做：

- 不把 selection 放进 document
- 不把 core planner 改成 selection-aware
- 不让 engine node command 自动承载 UI 选中逻辑
- 不让 selection store 到处订阅并主动驱动业务动作

---

## 3. 当前问题

### 3.1 selection source 不是严格 canonical state

当前 `packages/whiteboard-react/src/runtime/state/selection.ts` 的 source 结构是：

```ts
type StoredSelection = {
  nodeIds: readonly NodeId[]
  nodeSet: Set<NodeId>
  edgeId?: EdgeId
}
```

这个结构的问题是：

1. `nodeIds` 和 `edgeId` 是隐式互斥，但类型上没有显式表达。
2. `nodeIds` 和 `nodeSet` 有重复语义。
3. `resolveSelection()` 会把失效 node 过滤掉，但 source 本身并没有真正被修正。
4. selection read 当前只依赖 node read，不依赖 edge read，因此 edge 删除后的合法性不完整。

这意味着当前 selection 更像“半 source 半 view 的混合物”，还不是严格的单一事实源。

### 3.2 `commands.selection` 已经混入 scope 语义

当前 `createSelectionCommands()` 里，`selectAll()` 直接依赖 container：

```ts
selectAll: () => {
  const container = readContainer()
  const nodeIds = container.id ? container.ids : engine.read.node.list.get()
  selection.commands.select(nodeIds)
}
```

这说明 `selectAll` 并不是 selection primitive，而是一个带 scope 语义的 intent。

换句话说，当前 `instance.commands.selection` 里混了两类东西：

- primitive
  - `select`
  - `selectEdge`
  - `clear`
- intent
  - `selectAll`

这会导致边界继续松动，后续越来越容易往 `commands.selection` 里塞更多 workflow。

### 3.3 纯写动作和本地 UX policy 混在一起

当前 `features/node/commands.ts` 与 `canvas/actions/node.ts` 里存在大量“写完后顺手改 selection”的逻辑，例如：

- delete 后 clear
- duplicate 后 replace select
- group 后选中新 group
- ungroup 后选中 children
- arrange 后 reselect 原对象
- update group data 后 reselect 当前 group

其中有些是合理的本地 UX policy：

- duplicate 后选中新副本
- group 后选中新 group
- ungroup 后选中 children

但有些本质只是多余的 selection 副作用：

- arrange 后 reselect
- lock/unlock 后 reselect
- update group data 后 reselect

这说明 selection 已经变成“动作后处理的默认收纳处”，而不是一个被明确约束的状态域。

### 3.4 overlay session 与 selection core 没有分开

右键菜单当前会 snapshot/restore selection。

这本身是合理的，但它表达的是：

- `context menu session`
- `dismiss / restore policy`

这不是 selection core 本体，而是 overlay 自己的会话策略。

如果这类逻辑继续往 selection 模块里集中，selection 会继续承担不属于自己的 overlay 语义。

### 3.5 container 与 selection 的关系还不够清晰

当前很多交互入口都在手写这样的流程：

1. 判断命中对象是否在当前 container 内
2. 不在则 clear selection
3. 再 exit container
4. 再决定新的 selection

这说明“scope 变化如何影响 selection”还没有统一 finalize 规则，导致交互代码不断复制胶水逻辑。

---

## 4. 设计原则

### 4.1 状态与意图分离

状态只回答：

- 现在选中了谁

意图回答：

- 为什么选它
- 接下来应该选谁

selection store 不能同时承担这两者。

### 4.2 policy 与 reconcile 分离

`policy` 处理 UX 决策：

- 本地 duplicate 后应该选中新副本
- 本地 group 后应该选中新 group

`reconcile` 处理不变量：

- 被删对象不能继续保留在选区
- container 外对象不能继续保留在作用域内选区

如果这两者不分开，结果就是：

- 每次写动作都想一遍 selection
- history/remote/system 也会意外触发本地 UX policy

### 4.3 scope 与 target 分离

`container` 表示：

- 当前编辑作用域

`selection` 表示：

- 当前目标对象

selection 的合法性受 container 约束，但 selection 不拥有 container。

### 4.4 source 与 view 分离

source：

- 只存最小 canonical target

view：

- 解析出 nodes、count、box、primary 等 UI 展示信息

不要再让 source 带大量解析结果。

### 4.5 最终落点必须很少

这就是 selection 的漏斗原则本体。

上层输入可以很多：

- 单击
- Shift 多选
- Edge 选中
- 框选
- create
- duplicate
- group
- ungroup
- undo/redo
- remote changes
- replace document
- exit container

但最终 source 只能很少：

- `none`
- `nodes(nodeIds[])`
- `edge(edgeId)`

如果最终状态种类继续增加，selection 会再次失控。

---

## 5. 最终状态模型

### 5.1 runtime session 分层

建议长期明确区分下面四种状态：

1. document state
   - 由 engine 持有
   - 节点、边、脑图、顺序、父子关系都在这里
2. projection state
   - 由 `instance.read` 暴露
   - node item、edge item、index、tree 都在这里
3. runtime session state
   - `tool`
   - `interaction`
   - `container`
   - `selection`
4. transient feature session
   - node drag preview
   - node transform preview
   - edge routing preview
   - context menu local session

selection 明确属于第 3 类，不属于 document，也不属于 feature preview。

### 5.2 SelectionSource

建议把 selection canonical source 明确改成显式 union：

```ts
export type SelectionSource =
  | { kind: 'none' }
  | { kind: 'nodes'; nodeIds: readonly NodeId[] }
  | { kind: 'edge'; edgeId: EdgeId }
```

推荐原因：

1. 类型直接表达互斥关系。
2. 不会出现“既有 nodeIds 又有 edgeId”的隐式混合态。
3. primitive 命令可以更简单。
4. reconcile 逻辑更直接。
5. context menu snapshot 也可以复用同一结构。

不再推荐继续保留：

```ts
{
  nodeIds: ...
  nodeSet: ...
  edgeId?: ...
}
```

因为它把 canonical state 和加速缓存绑在了一起。

### 5.3 SelectionView

SelectionView 是只读投影，建议保留当前语义，但只由 source 派生：

```ts
export type SelectionView = {
  kind: 'none' | 'node' | 'nodes' | 'edge'
  target: {
    nodeIds: readonly NodeId[]
    nodeSet: ReadonlySet<NodeId>
    edgeId?: EdgeId
  }
  items: {
    nodes: readonly Node[]
    primary?: Node
    count: number
  }
  box?: Rect
}
```

其中需要强调：

- `target` 是 view projection，不是 source
- `nodeSet` 是派生缓存，不是 canonical source
- `box` 是 presentation helper，不应被反向写回 source

### 5.4 Container 继续独立存在

container 不应并入 selection。

长期模型应该是：

```ts
type RuntimeState = {
  tool: Tool
  interaction: InteractionMode
  container: ContainerState
  selection: SelectionSource
}
```

其关系是：

```txt
container defines scope
selection chooses target within scope
reconcile enforces the relation
```

---

## 6. 漏斗模型

### 6.1 漏斗入口

selection 的所有入口，长期只允许来自下面三类：

1. direct selection intents
   - 点击 node
   - 点击 edge
   - 点击背景
   - 框选
   - select all in scope
2. write-derived local policies
   - create and select
   - duplicate and select
   - group and select result
   - ungroup and select children
   - paste and select
3. runtime finalization
   - history undo/redo 后收敛
   - remote/system commit 后收敛
   - container enter/exit 后收敛
   - document replace 后收敛

除了这三类，不应该再有第四类“零散 helper 顺手改 selection”。

### 6.2 漏斗中段

中段建议固定为两步：

1. `applySelectionPolicy`
2. `finalizeRuntimeSession`

其中：

- `applySelectionPolicy`
  - 只对本地用户意图触发
  - 只产生“建议的 target”
- `finalizeRuntimeSession`
  - 对所有成功状态变更都可触发
  - 负责统一 reconcile container 与 selection

### 6.3 漏斗出口

出口只允许一次提交到 source：

```txt
next source
-> reconcile
-> commit source
```

不应该允许：

- policy 自己绕过 reconcile 直接写 source
- component 自己手搓多个 selection 更新步骤
- action 既改 container 又改 selection 但不走统一 finalize

---

## 7. 职责边界

### 7.1 core 层

`packages/whiteboard-core/src/node/selection.ts` 应继续只保留纯集合运算：

- `resolveSelectionMode`
- `applySelection`

它不应该知道：

- container
- node/edge existence
- remote/user/system
- duplicate 后选谁
- group 后选谁

core 只负责纯算法，不负责 runtime 语义。

### 7.2 engine 层

`packages/whiteboard-engine/src/commands/node.ts` 与 write pipeline 继续保持纯 document write：

- create
- update
- updateMany
- delete
- duplicate
- group
- ungroup
- order

它们不应该：

- 改 selection
- 改 container
- 夹带 UI policy

engine 最多只需要继续稳定提供：

- `DispatchResult`
- `changes.operations`
- `origin/source`

selection runtime 依赖这些信息做上层 finalize 即可。

### 7.3 react runtime 层

`whiteboard-react` 才是 selection 的归属层。

这里建议拆成三类能力：

1. primitive
   - 纯 set/clear selection
2. policy
   - 本地动作后决定建议 target
3. reconcile
   - 把建议 target 与当前 runtime/document/scope 收敛成合法 target

### 7.4 overlay/session 层

右键菜单、浮层、临时会话的 selection 快照，不属于 selection core。

它们只应该：

- 复用 `SelectionSource` 作为 snapshot 结构
- 在自己的 session 生命周期里 restore

但不应：

- 扩展 selection 核心模型
- 把 overlay 语义塞回 runtime/state/selection

---

## 8. 推荐 API

### 8.1 `instance.state.selection`

建议继续暴露 `SelectionView`，因为 UI 读的是解析结果，不是 source。

```ts
instance.state.selection: ReadStore<SelectionView>
```

UI 组件继续关心：

- `kind`
- `target.nodeIds`
- `target.edgeId`
- `items.nodes`
- `items.count`
- `box`

### 8.2 `instance.commands.selection`

建议长期最小化为 primitive-only：

```ts
instance.commands.selection = {
  setNodes: (nodeIds: readonly NodeId[], mode?: SelectionMode) => void
  setEdge: (edgeId: EdgeId) => void
  clear: () => void
}
```

如果为了兼容，短期内也可以保留旧名：

- `select` -> `setNodes`
- `selectEdge` -> `setEdge`

但长期不建议继续保留：

- `selectAll`

因为它是 scope-aware intent，不是 primitive。

### 8.3 intent / action 层

下面这些应该留在 `canvas/actions` 或未来的 `canvas/intents`：

- `selectAllInScope`
- `clearSelectionAndExitContainer`
- `deleteCurrentSelection`
- `duplicateCurrentSelection`
- `groupCurrentSelection`
- `ungroupCurrentSelection`
- `createAndSelect`
- `pasteAndSelect`

这些都不是 selection primitive，而是：

- 依赖当前 selection
- 依赖当前 container
- 依赖当前 tool / session
- 依赖写结果再决定建议 target

### 8.4 finalize 层

建议有一个统一 runtime finalize 入口：

```ts
finalizeRuntimeSession({
  instance,
  changes,
  reason,
  policy
})
```

其中：

- `reason`
  - `write`
  - `history`
  - `remote`
  - `container-change`
  - `document-replace`
- `policy`
  - 可选
  - 只用于本地用户动作后的建议 target

其内部再拆：

```ts
reconcileContainer(...)
reconcileSelection(...)
```

---

## 9. Reconcile 设计

### 9.1 命名建议

建议明确使用：

- `finalizeRuntimeSession`
- `reconcileContainer`
- `reconcileSelection`

不建议把所有东西都叫 `normalize`，因为：

- write pipeline 已经有 engine normalize
- session 这层不是文档归一化，而是 runtime 状态收敛

`reconcile` 更准确。

### 9.2 Reconcile 的职责

reconcile 只做不变量修复，不做 UX 选择偏好。

必须满足的规则：

1. 选中的 node 不存在时，从选区剔除。
2. 选中的 edge 不存在时，变成 `none`。
3. edge 与 nodes 永远互斥。
4. active container 不存在时，退出 container。
5. active container 存在时，selected nodes 必须属于该 container。
6. active container 存在时，selected edge 必须满足 `hasContainerEdge`。
7. reconcile 后如果 nodes 为空，则变成 `none`。
8. order 稳定，重复 id 去重。

### 9.3 Reconcile 不该做的事

下面这些不该放进 reconcile：

- duplicate 后自动选中新副本
- group 后自动选中新 group
- ungroup 后自动选中 children
- create 后自动选中新建 node
- paste 后自动选中新内容

因为这些不是不变量，而是本地 UX policy。

### 9.4 Reconcile 的输入

reconcile 最好依赖下面这些已知信息：

- current `SelectionSource`
- current `Container`
- current runtime read snapshot
  - node existence
  - edge existence
  - tree / container membership
- optional `changes.operations`
- optional `reason`

需要注意：

- `changes.operations` 主要帮助优化路径和解释来源
- 即使没有 `changes.operations`，reconcile 也应该可以靠当前 read snapshot 正确收敛

### 9.5 Reconcile 的输出

输出必须仍然是最小 target：

```ts
SelectionSource
```

而不是：

- 直接返回 UI DTO
- 直接把 box、nodes、summary 等信息写回 source

---

## 10. Policy 设计

### 10.1 Policy 的职责

policy 只回答：

- 对于这次本地用户动作，成功后 UI 应该建议选中谁

它不回答：

- 该对象是否仍然存在
- 该对象是否仍在当前 scope
- remote/history/system 是否也要这么做

后两者留给 reconcile。

### 10.2 推荐 policy 类型

建议把 selection policy 收敛为很少的几种形态：

```ts
type SelectionPolicy =
  | { kind: 'keep-current' }
  | { kind: 'clear' }
  | { kind: 'select-created-nodes' }
  | { kind: 'select-created-group' }
  | { kind: 'select-ungroup-children'; sourceGroupIds: readonly NodeId[] }
  | { kind: 'select-explicit-nodes'; nodeIds: readonly NodeId[] }
  | { kind: 'select-explicit-edge'; edgeId: EdgeId }
```

这里的重点不是字面枚举，而是控制 policy 空间不要无限增长。

### 10.3 哪些动作需要 policy

需要：

- create
- duplicate
- group
- ungroup
- paste

通常不需要：

- lock/unlock
- order
- updateData
- move/resize/rotate
- edge routing
- history undo/redo
- remote changes

也就是说，很多当前代码里“写完再 reselect”的逻辑，长期应该直接删除。

### 10.4 policy 与 source/origin

policy 默认只应对本地用户动作生效。

对：

- `remote`
- `system`
- `history replay`

通常只做 reconcile，不做本地 UX policy。

否则会出现：

- 远端创建了节点，本地 selection 突然跳走
- undo/redo 后 selection 被意外重定向到新建对象

---

## 11. 为什么不建议直接监听 node changes / edge changes

表面上看，让 selection 监听 node/edge 变化似乎能减少 action 内逻辑。

但长期并不最优，原因有三类。

### 11.1 监听 read 变化会丢失意图来源

selection 如果只看到：

- 某些 node 增加了
- 某些 edge 删除了

它不知道这些变化来自：

- 本地 duplicate
- 远端同步
- undo/redo
- system normalize

这会让本地 UX policy 和全局合法性修复混在一起。

### 11.2 监听 projection 会丢失批次与顺序

真正适合 policy 的是这次 commit 的 changeset：

- 哪些 operation 属于同一次提交
- 顺序如何
- 是否来自 user / remote / system

纯 node/edge read 变化难以准确还原这一层。

### 11.3 store 监听再反写 store，边界容易变脏

一旦 selection store 自己监听 read 再修改自己，就很容易出现：

- source 与 derived 耦合
- 依赖边界模糊
- 调试困难
- 组件外部无法判断 selection 改变到底是哪个阶段触发的

因此长期最佳入口不是“selection 订阅所有 read 变化”，而是：

- 以 commit/finalize 为窄口
- 以 reconcile 为统一出口

---

## 12. 推荐的最终交互矩阵

| 场景 | 所属层 | 是否需要 write | 是否需要 policy | 是否需要 reconcile | 结果 |
| --- | --- | --- | --- | --- | --- |
| 点击 node | intent | 否 | 否 | 可选 | 直接设置 nodes |
| Shift/Ctrl 点击 node | intent | 否 | 否 | 可选 | 直接设置 nodes |
| 点击 edge | intent | 否 | 否 | 可选 | 直接设置 edge |
| 点击背景 | intent | 否 | 否 | 否 | clear |
| 框选 | intent | 否 | 否 | 可选 | 设置 matched nodes |
| `selectAllInScope` | intent | 否 | 否 | 是 | 选中当前 scope 节点 |
| create node | write + policy | 是 | 是 | 是 | 选中新建 node |
| duplicate | write + policy | 是 | 是 | 是 | 选中新副本 |
| group | write + policy | 是 | 是 | 是 | 选中新 group |
| ungroup | write + policy | 是 | 是 | 是 | 选中 children |
| delete current | write | 是 | 否 | 是 | 删除后收敛为空或剩余合法目标 |
| lock/unlock | write | 是 | 否 | 是 | 一般保持当前 selection |
| arrange/order | write | 是 | 否 | 是 | 一般保持当前 selection |
| update group data | write | 是 | 否 | 是 | 一般保持当前 selection |
| container enter | session | 否 | 否 | 是 | 选区被裁剪到 scope 内 |
| container exit | session | 否 | 否 | 是 | 视规则决定 clear 或保留 |
| history undo/redo | history | 是 | 否 | 是 | 只做收敛 |
| remote change | external | 是 | 否 | 是 | 只做收敛 |
| document replace | system | 是 | 否 | 是 | reset UI session |

这个矩阵的关键点是：

- 只有很少数动作拥有 policy
- 大多数动作只依赖 reconcile

---

## 13. 与 container 的长期关系

### 13.1 不建议把 selection 变成“scope 内 selection”

如果把 selection 直接定义成“当前 container 内的 selection”，会有一个长期副作用：

- selection 失去独立目标状态的语义
- 后续所有 selection 行为都必须隐式依赖 scope
- 最终 `selection` 和 `container` 越来越难拆开

更好的方式是：

- container 自己定义 scope
- selection 自己定义 target
- finalize 统一校验 target 是否落在 scope 内

### 13.2 Container change 的建议策略

建议长期固定如下：

1. `enter(container)`
   - 先设置 container
   - 再 reconcile selection 到该 scope
2. `exit(container)`
   - 先清空 container
   - 再按规则处理 selection

关于 exit 后是否保留 selection，有两种策略：

- 保守策略
  - 直接 clear
- 连续性策略
  - 保留当前 target，只要 target 仍存在

结合当前实现和复杂度，长期更建议保守策略：

- `exit container => clear selection`

原因：

- 简单
- 一致
- 不会把 scope 退出和全局 target 恢复混在一起

---

## 14. 当前代码的建议边界调整

### 14.1 `runtime/state/selection.ts`

长期只保留：

- `SelectionSource`
- `SelectionView`
- `createSelectionStore`
- primitive commands
- source -> view derivation

不再保留：

- `selectAll`
- 各种带 container 语义的 helper
- 写命令后的 result 解析逻辑

### 14.2 `runtime/sessionFinalize.ts` 或同等模块

建议新增统一 finalize 模块，负责：

- `reconcileContainer`
- `reconcileSelection`
- `finalizeRuntimeSession`

这是 selection 长期最关键的漏斗口。

### 14.3 `canvas/actions/selection.ts`

建议保留或收拢为 intent/workflow 层：

- `selectAllInScope`
- `clearSelectionAndExitContainer`
- `deleteCurrentSelection`
- `duplicateCurrentSelection`

以及未来：

- `pasteCurrentClipboard`
- `createNodeAndSelect`

### 14.4 `canvas/actions/node.ts`

建议把 selection-aware workflow 与纯 node action 再拆清楚：

- `groupCurrentSelection`
- `ungroupCurrentSelection`
  - 保留在 selection/workflow 语义下
- `arrangeNodes`
- `updateGroupNode`
- `toggleNodesLock`
  - 不再显式 reselect

### 14.5 `ContextMenu.tsx`

context menu 的 selection snapshot/restore 可以继续本地存在。

但它应该被明确理解为：

- overlay session

而不是：

- selection core 的一部分

---

## 15. 最优落地点

### 15.1 短期最优

在不重做 engine 的前提下，selection 最佳漏斗口应放在 `createInstance()`。

原因：

- 这里离 runtime state 最近
- 可以拿到 selection/container/interaction
- 可以包住所有对外公开的写命令
- 可以在成功写入后统一 finalize

也就是说，长期不应只给 `document.replace` 套 `withUiReset`。

而应逐步收敛成：

```ts
withRuntimeFinalize(effect, options)
```

统一包住：

- `node.*`
- `edge.*`
- `mindmap.*`
- `document.replace`
- `history.undo`
- `history.redo`

### 15.2 长期最优

如果 engine 以后愿意暴露统一 commit feed，那么 selection 最终最好订在 commit 事件边界，而不是各命令 wrapper 上。

理想模型：

```txt
engine commit
-> runtime receives changeset
-> apply optional local policy
-> finalizeRuntimeSession
-> update selection/container session state
```

这是最符合漏斗原则的单入口方案。

---

## 16. 推荐文件布局

考虑到当前仓库也强调目录不要过多，长期建议只保留最小拆分：

```txt
packages/whiteboard-react/src/runtime/state/selection.ts
packages/whiteboard-react/src/runtime/sessionFinalize.ts
packages/whiteboard-react/src/canvas/actions/selection.ts
```

各自职责：

`runtime/state/selection.ts`

- source type
- view type
- primitive commands
- source -> view derive

`runtime/sessionFinalize.ts`

- container reconcile
- selection reconcile
- runtime finalize orchestration

`canvas/actions/selection.ts`

- selection intents
- selection-aware workflows
- 与快捷键、右键菜单、toolbar 对接

不建议再拆出大量 selection 子目录，因为 selection 本身概念不大，问题在边界，不在文件数量。

---

## 17. 最终建议

如果只保留一句架构原则，建议定成下面这句：

**selection 是 UI runtime 的最小目标状态；policy 只回答本地动作后想选谁，reconcile 只回答当前状态是否合法。**

落到工程规则上，就是：

1. `instance.commands.node / edge / mindmap` 永远不改 selection。
2. `instance.commands.selection` 只保留 primitive，不带 scope，不带 workflow。
3. `selectAllInScope / duplicateCurrentSelection / groupCurrentSelection` 一律归到 intent/workflow。
4. 所有成功提交之后，统一经过 `finalizeRuntimeSession`。
5. `finalizeRuntimeSession` 只做 `reconcileContainer + reconcileSelection`，不掺本地 UX 偏好。
6. selection canonical source 永远收敛为：
   - `none`
   - `nodes`
   - `edge`

这套模型的好处不是“抽象更优雅”，而是它能稳定地防止 selection 成为新的复杂度黑洞。

---

## 18. 附：判断一个 selection 逻辑该放哪一层

可以直接用下面这组问题判断：

1. 这个逻辑是不是在改 document？
   - 是：放 write command
2. 这个逻辑是不是在决定“这次本地动作后想选谁”？
   - 是：放 policy / intent
3. 这个逻辑是不是在修正“当前选区是否合法”？
   - 是：放 reconcile
4. 这个逻辑是不是浮层/菜单自己的临时行为？
   - 是：放 overlay session
5. 这个逻辑是不是只是把 selection 渲染成 UI 所需形态？
   - 是：放 view derive

如果一个函数同时回答了第 2 和第 3 个问题，那它大概率就已经混层了。
