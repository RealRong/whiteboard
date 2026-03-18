# Whiteboard Command Result Chain Design

## 1. 结论

在**明确没有兼容成本**、目标是**长期最优**的前提下，整条链路最好的设计不是：

- 让 `react` 手动解析 `CommitResult.changes.operations`
- 让 `selection/policy.ts` 帮 `node / edge / mindmap` 解码结果
- 让 `react` 额外 import `engine` 的 result helper
- 在新旧 API 之间做双轨兼容

而是直接把链路改成两条清晰的漏斗：

```txt
主动调用链:
UI intent
-> react feature command
-> engine.commands.xxx()
-> typed result
-> react policy
-> selection/container/other ui state

被动观察链:
local write / undo / redo / replace / remote sync
-> engine.commit
-> react finalize
-> reconcile ui session state
```

一句话：

**`engine.commit` 负责被动 reconcile，`engine.commands.*` 负责主动 typed result。**

因此长期最优形态是：

- `engine.commit` 继续作为统一 commit 出口保留
- `engine.commands.*` 的 public return 全面改成 typed result
- `CommitResult` 从 engine public API 移除
- `selection/policy.ts` 只保留 selection 最终落点 policy
- `react feature command` 只做 `await command -> 读结果 -> 应用 UI policy`

---

## 2. 兼容策略

本方案明确采用：

**不兼容旧 API，直接替换，不做适配层。**

理由：

- 当前 public boundary 方向本身就不理想
- 保留 `CommitResult` 与新 `Result<T>` 双轨只会延长混乱
- `selection` / `node` / `edge` / `mindmap` 之间的职责边界需要一次性拉直

因此建议：

- 直接废弃 engine public `CommitResult`
- 直接修改 `EngineCommands` 返回类型
- 直接修改 `whiteboard-react` 所有调用点
- 不增加临时 helper，不做过渡包装，不做双导出

---

## 3. 设计原则

### 3.1 两条漏斗分离

主动调用链回答：

- 这条命令成功后，产出了什么稳定的领域结果

被动观察链回答：

- 文档变化后，当前 UI session state 需不需要被修正

它们不能混在一起。

### 3.2 领域结果归生产者

只要某个值是命令天然产出的领域结果，就应该由命令所在层返回，而不是让调用方自己去推导。

例如：

- `node.create` 产出 `nodeId`
- `node.group.create` 产出 `groupId`
- `edge.create` 产出 `edgeId`
- `mindmap.addChild` 产出 `nodeId`

这些都应由 engine command 直接返回。

### 3.3 UI policy 归 react

只要某个判断是 host / UI 决策，就必须留在 react。

例如：

- create 后要不要选中
- duplicate 后要不要进入 rename
- connect edge 后要不要选中新 edge
- add child 后要不要开始编辑新 mindmap node

这些不属于 engine。

### 3.4 finalize 只做 reconcile

`finalize` 只负责不变量修复，不负责本地 UX 意图。

它只处理：

- 选中对象已不存在
- 选中对象超出 container scope
- replace / undo / redo 后 session state 失效

它不处理：

- group 后选中 group
- duplicate 后选中新副本
- add child 后 focus 新节点

### 3.5 不跨域 import 结果 helper

长期最优设计里，不应该出现这种代码：

```ts
const result = await instance.commands.node.group.create(ids)
const groupId = createdGroup(result)
```

无论 `createdGroup` 放在 `react/selection` 还是 `engine/result`，本质都说明：

- public return 过于原始
- 调用方仍在手动解码底层结果

正确做法应是：

```ts
const result = await instance.commands.node.group.create(ids)
if (!result.ok) return
replace(instance, [result.groupId])
```

### 3.6 目录表达域，名字尽量短

继续沿用当前命名原则：

- 目录表达域
- 文件名与类型名尽量短

优先：

- `selection/state`
- `selection/policy`
- `selection/finalize`
- `container/state`
- `container/policy`
- `types/result`

不优先：

- `selectionState`
- `engineCommandResultEnvelope`
- `selectionCreatedNodeIds`

---

## 4. 当前问题

### 4.1 engine public return 太原始

当前 [`packages/whiteboard-engine/src/types/command.ts`](/Users/realrong/whiteboard/packages/whiteboard-engine/src/types/command.ts) 中，几乎所有 mutating command 都返回 `CommitResult`。

这意味着调用方只能得到：

- 是否成功
- `commit.changes`

却拿不到：

- 新建 node 的 id
- 新建 edge 的 id
- 新建 group 的 id
- duplicate 后的新 ids
- mindmap 新插入节点的 id

结果只能靠调用方自己去解析 `changes.operations`。

### 4.2 react 在错误层做结果解释

当前 [`packages/whiteboard-react/src/runtime/selection/policy.ts`](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/selection/policy.ts) 里混入了：

- `created`
- `createdGroup`
- `ungroupChildren`

这些都不是 selection policy，而是：

- node / group 结果解释
- tree 结构推导

说明 selection 域已经被迫承担了别的领域职责。

### 4.3 node/edge/mindmap 三个域不一致

当前链路里：

- `node` 结果靠 react 手工解析
- `edge` 大部分是 fire-and-forget
- `mindmap` core 实际已经有 richer result，但到了 engine public 边界又被压平

这导致同一仓库里有三套不同风格：

- raw commit style
- fire-and-forget style
- typed value style

长期不可维护。

### 4.4 Draft 链路提前丢值

当前 [`packages/whiteboard-engine/src/write/draft.ts`](/Users/realrong/whiteboard/packages/whiteboard-engine/src/write/draft.ts) 的 `Draft` 只保留：

- `operations`

没有任何 command value。

这意味着即使 planner 或 core 已经知道：

- 新 group id
- 新 edge id
- 新 mindmap child id

这些值也会在进入 write pipeline 前被丢掉。

---

## 5. 最优整体模型

### 5.1 Core

`core` 负责纯领域算法与纯结果。

它应该提供：

- `CoreResult<T>`
- 纯 operation builder
- 纯 tree / group / routing / mindmap 算法

它不应该处理：

- selection
- container
- overlay
- 任何 UI host policy

### 5.2 Engine Internal

`engine` 内部负责：

- plan
- apply
- publish commit
- 把领域结果挂到 command return 上

它应该是“领域结果的第一层聚合者”，而不是“只把 commit 扔给上层”。

### 5.3 Engine Public

`engine` public boundary 最终只暴露两种东西：

- `commit`
  给观察者用
- `commands`
  给主动调用者用

其中：

- `commit` 是统一被动漏斗
- `commands` 返回 typed result

### 5.4 React Runtime

`react runtime` 负责：

- selection state
- container state
- interaction state
- finalize reconcile
- policy

但它不负责解释 command 的领域结果。

### 5.5 React Feature Commands

`features/node/commands.ts`、`features/mindmap/...` 这类模块只做：

- 调 engine command
- 读 typed result
- 应用 host policy

它们不应该解析 `changes.operations`。

---

## 6. 结果模型

## 6.1 Core 结果

`core` 已经有：

```ts
type CoreResult<T extends object = {}> =
  | ({ ok: true } & T)
  | CoreFailure
```

这套模型是对的，应该继续沿用，而且建议扩展到更多 builder。

### 6.2 Engine 结果

`engine` 建议新增 public type：

```ts
type Result<T extends object = {}> =
  | DispatchFailure
  | ({ ok: true, commit: Commit } & T)
```

这里推荐**拍平字段**，不包一层 `value`，原因：

- 更短
- 和 `core` 的 `CoreResult<T>` 风格一致
- 调用点最干净

示例：

```ts
const result = await instance.commands.node.create(input)
if (!result.ok) return
result.nodeId
result.commit
```

而不是：

```ts
result.value.nodeId
```

### 6.3 废弃 `CommitResult`

既然没有兼容负担，建议直接：

- 删除 engine public `CommitResult`
- 保留 `Commit`
- 新增 `Result<T>`

这样概念上更清楚：

- `Commit` = 被动事件
- `Result<T>` = 主动调用结果

---

## 7. 每层该放什么

### 7.1 该放在 core 的

- `buildNodeCreateOperation` 返回 `nodeId`
- `buildNodeGroupOperations` 返回 `groupId`
- `buildNodeDuplicateOperations` 返回 `nodeIds`、`edgeIds`
- `buildNodeUngroupOperations` 返回 `nodeIds`
- `buildEdgeCreateOperation` 返回 `edgeId`
- `insertRoutingPoint` 若需要，返回插入后的 `index`
- `mindmap` 各 command 继续返回 typed result

### 7.2 该放在 engine 的

- `Draft<T>`
- planner 结果合并
- `Write.apply` 把 `Draft<T>` 变成 `Result<T>`
- `engine.commands.*` 的 public typed return

### 7.3 该放在 react runtime 的

- `selection.replace / clear`
- `container.enter / leave`
- `finalize`

### 7.4 该放在 react feature 的

- `group` 成功后选中 group
- `duplicate` 成功后选中新副本
- `edge.create` 成功后是否选中新 edge
- `mindmap.addChild` 成功后是否开始编辑

---

## 8. 各域最优返回设计

## 8.1 Node

推荐返回：

```ts
node.create(...) => Promise<Result<{ nodeId: NodeId }>>

node.duplicate(...) => Promise<Result<{
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}>>

node.group.create(...) => Promise<Result<{ groupId: NodeId }>>

node.group.ungroup(id) => Promise<Result<{ nodeIds: readonly NodeId[] }>>

node.group.ungroupMany(ids) => Promise<Result<{ nodeIds: readonly NodeId[] }>>
```

推荐返回空结果：

```ts
node.update(...)
node.updateMany(...)
node.updateData(...)
node.delete(...)
node.deleteCascade(...)
node.order.*
```

说明：

- `deleteCascade` 虽然内部知道最终删除了哪些 node/edge，但 UI policy 通常不需要主动消费，finalize 足够处理
- `duplicate` 推荐把 `edgeIds` 一并返回，因为 duplicate 的领域结果天然包含 duplicated edges

## 8.2 Edge

推荐返回：

```ts
edge.create(...) => Promise<Result<{ edgeId: EdgeId }>>

edge.routing.insertAtPoint(...) => Promise<Result<{ index: number }>>
```

推荐返回空结果：

```ts
edge.update(...)
edge.updateMany(...)
edge.delete(...)
edge.order.*
edge.routing.move(...)
edge.routing.remove(...)
edge.routing.reset(...)
```

说明：

- `edge.create` 的 `edgeId` 是天然领域结果
- `routing.insertAtPoint` 若返回 `index`，后续 host 可以自然支持“插入后立即进入 routing handle drag / focus”
- 当前如果不想做这层交互，也不影响设计正确性

## 8.3 Mindmap

mindmap 是当前最有价值的参考，因为它的 core command 已经天然带 typed result。

推荐 engine public 保留并放大这种能力：

```ts
mindmap.create(...) => Promise<Result<{
  mindmapId: MindmapId
  rootId: MindmapNodeId
}>>

mindmap.addChild(...) => Promise<Result<{ nodeId: MindmapNodeId }>>
mindmap.addSibling(...) => Promise<Result<{ nodeId: MindmapNodeId }>>
mindmap.attachExternal(...) => Promise<Result<{ nodeId: MindmapNodeId }>>
mindmap.insertPlacement(...) => Promise<Result<{ nodeId: MindmapNodeId }>>

mindmap.cloneSubtree(...) => Promise<Result<{
  nodeId: MindmapNodeId
  map: Record<MindmapNodeId, MindmapNodeId>
}>>
```

推荐返回空结果：

```ts
mindmap.replace(...)
mindmap.delete(...)
mindmap.moveSubtree(...)
mindmap.moveLayout(...)
mindmap.moveDrop(...)
mindmap.reorderChild(...)
mindmap.moveRoot(...)
mindmap.removeSubtree(...)
mindmap.setNodeData(...)
mindmap.toggleCollapse(...)
mindmap.setSide(...)
```

说明：

- `mindmap.create` 应直接给出 `mindmapId` 与 `rootId`
- `insertPlacement` 最值得返回 `nodeId`，因为 UI 很容易需要“新建后立即编辑”
- `cloneSubtree` 返回 `map` 很有价值，因为 host 可能想定位整个 cloned subtree

## 8.4 History / Document

推荐：

```ts
document.replace(...) => Promise<Result>
history.undo() => Result
history.redo() => Result
```

不需要额外领域字段，因为：

- 主动调用方通常不依赖 typed domain output
- 被动修复交给 `engine.commit -> finalize`

---

## 9. Core 侧最优改造

既然不在乎重构成本，最优方案不是只改 engine，而是把 `core -> engine -> react` 的结果链拉直。

### 9.1 Node Core

推荐把这些函数升级成 richer `CoreResult`：

```ts
buildNodeCreateOperation(...) => CoreResult<{
  operation: NodeCreateOperation
  nodeId: NodeId
}>

buildNodeGroupOperations(...) => CoreResult<{
  operations: Operation[]
  groupId: NodeId
}>

buildNodeDuplicateOperations(...) => CoreResult<{
  operations: Operation[]
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}>

buildNodeUngroupOperations(...) => CoreResult<{
  operations: Operation[]
  nodeIds: readonly NodeId[]
}>
```

这样 engine 不需要再从 operations 逆向推导值。

### 9.2 Edge Core

推荐把这些函数升级成 richer `CoreResult`：

```ts
buildEdgeCreateOperation(...) => CoreResult<{
  operation: EdgeCreateOperation
  edgeId: EdgeId
}>
```

如果需要支持 routing insert 后继续交互，则继续扩展：

```ts
insertRoutingPoint(...) => CoreResult<{
  patch: EdgePatch
  index: number
}>
```

### 9.3 Mindmap Core

mindmap core 当前已经有 typed result，但还带一层 `value`。

在无兼容成本前提下，建议统一成拍平风格：

当前：

```ts
CoreResult<{
  tree: MindmapTree
  value?: T
}>
```

建议改成：

```ts
CoreResult<{ tree: MindmapTree } & T>
```

例如：

```ts
addChild(...) => CoreResult<{
  tree: MindmapTree
  nodeId: MindmapNodeId
}>

cloneSubtree(...) => CoreResult<{
  tree: MindmapTree
  nodeId: MindmapNodeId
  map: Record<MindmapNodeId, MindmapNodeId>
}>
```

这样 core / engine 两层结果风格就统一了。

---

## 10. Engine Internal 最优改造

### 10.1 `Draft` 改成泛型

当前 `Draft` 只有：

- `operations`

建议直接改成：

```ts
type Draft<T extends object = {}> =
  | DispatchFailure
  | ({ ok: true, operations: readonly Operation[] } & T)
```

这样 planner 一旦拿到领域结果，就不会丢。

### 10.2 planner 透传值

推荐：

- `write/plan/node.ts` 返回 `Draft<NodeResult>`
- `write/plan/edge.ts` 返回 `Draft<EdgeResult>`
- `write/plan/mindmap.ts` 返回 `Draft<MindmapResult>`

并且：

- 尽量从 core result 直接透传
- 避免 planner 末端再从 operation 逆向解析

### 10.3 `Write.apply` 透传值

当前 `Write.apply` 只返回 `CommitResult`。

建议改成：

```ts
type Apply = <T extends object>(input: WriteInput) => Promise<Result<T>>
```

执行顺序：

```txt
plan -> Draft<T>
reduce -> WriteCommit
publish -> Commit
return { ok: true, commit, ...draftValue }
```

### 10.4 `createCommands` 直接对外给 typed result

例如：

```ts
const create = (payload: NodeInput) =>
  run({ type: 'create', payload }) as Promise<Result<{ nodeId: NodeId }>>
```

长期更好的是再往前一步，把 command type 和 result type 建成映射关系，而不是依赖 `as`。

推荐补一组 map：

```ts
type NodeResultMap = {
  create: { nodeId: NodeId }
  updateMany: {}
  data: {}
  delete: {}
  deleteCascade: {}
  duplicate: { nodeIds: readonly NodeId[]; edgeIds: readonly EdgeId[] }
  'group.create': { groupId: NodeId }
  'group.ungroup': { nodeIds: readonly NodeId[] }
  'group.ungroupMany': { nodeIds: readonly NodeId[] }
  order: {}
}
```

`edge` 和 `mindmap` 同理。

---

## 11. React 侧最优改造

### 11.1 `selection/policy.ts`

最终只保留 selection policy。

保留：

- `replace` 或当前 `set`

删除或迁走：

- `created`
- `createdGroup`
- `ungroupChildren`

### 11.2 `features/node/commands.ts`

最终只写这种代码：

```ts
const result = await instance.commands.node.group.create(ids)
if (!result.ok) return
replace(instance, [result.groupId])
```

不再写：

```ts
const groupId = createdGroup(result)
```

### 11.3 `features/edge/*`

当前 edge 调用大多是 fire-and-forget。

改完后：

- 仍然可以忽略 result
- 但一旦 UI 需要它，就能直接消费 `edgeId` 或 `index`

例如未来如果想做：

- connect 成功后自动选中新 edge
- 插入 routing point 后立即激活该 point

都不需要再解析 commit。

### 11.4 `features/mindmap/*`

mindmap 是最应该直接消费 typed result 的域。

例如：

```ts
const result = await instance.commands.mindmap.insertPlacement(...)
if (!result.ok) return
startEdit(result.nodeId)
```

这类交互现在虽然还没落地，但长期会非常自然。

---

## 12. 标准执行顺序

本地命令的标准顺序应为：

```txt
1. react feature command 发起命令
2. engine planner 生成 Draft<T>
3. engine apply/reduce/publish
4. engine.commit 广播
5. react finalize 先跑 reconcile
6. command promise resolve，返回 typed result
7. react feature command 根据 typed result 应用本地 policy
```

关键点：

- `finalize` 处理不变量
- typed result 驱动本地 UX

两者职责分离，但不冲突。

---

## 13. 实施方案

### Step 1

先改 public type。

目标：

- 新增 `packages/whiteboard-engine/src/types/result.ts`
- 定义 `Result<T>`
- 从 `packages/whiteboard-engine/src/index.ts` 导出 `Result`
- 删除 public `CommitResult`

### Step 2

改 engine internal value 链。

目标：

- `Draft` 泛型化
- `Write.apply` 透传 typed result
- `createCommands` 返回 typed result

### Step 3

改 core node / edge 结果。

目标：

- `buildNodeCreateOperation` 返回 `nodeId`
- `buildNodeGroupOperations` 返回 `groupId`
- `buildNodeDuplicateOperations` 返回 `nodeIds` / `edgeIds`
- `buildNodeUngroupOperations` 返回 `nodeIds`
- `buildEdgeCreateOperation` 返回 `edgeId`

### Step 4

统一 mindmap core result 风格。

目标：

- 去掉 `value` 包装
- 改成拍平字段

### Step 5

改 `whiteboard-react` 消费侧。

目标：

- `features/node/commands.ts` 改成只消费 typed result
- `selection/policy.ts` 删除错误职责
- `edge` / `mindmap` hooks 在需要时直接消费 typed result

### Step 6

清理残余 helper 与旧概念。

目标：

- 删除 `created`
- 删除 `createdGroup`
- 删除 `ungroupChildren` 在 selection 域下的存在
- 删除所有直接解析 `changes.operations` 的 react 调用点

---

## 14. 最终标准

当以下条件全部成立时，这条链就到位了：

- `react` 不再解析 `CommitResult.changes.operations`
- engine public API 不再暴露 `CommitResult`
- `engine.commit` 仍是唯一被动 finalize 入口
- `engine.commands.*` 全部返回 typed `Result<T>`
- `selection/policy.ts` 不再出现 node/group/edge/mindmap 结果解释
- `node` / `edge` / `mindmap` 三个域的 command result 风格统一
- `core -> engine -> react` 的值链不再中途丢失

最终总图应当是：

```txt
core:
pure domain result

engine:
draft<T> -> commit -> result<T>
commit stream

react:
commit stream -> finalize
typed result -> local policy
```

这就是在无兼容成本前提下，整条 command result chain 最符合漏斗原则与职责分离的长期最优设计。
