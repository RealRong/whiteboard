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
- `engine.commands.*` 的 public return 全面改成**同步** typed result
- `CommitResult` 从 engine public API 移除
- `selection/policy.ts` 只保留 selection 最终落点 policy
- `react feature command` 只做 `command -> 读结果 -> 应用 UI policy`

---

## 2. 兼容策略

本方案明确采用：

**不兼容旧 API，直接替换，不做适配层。**

理由：

- 当前 public boundary 方向本身就不理想
- 保留 `CommitResult` 与新 `CommandResult<T>` 双轨只会延长混乱
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
const result = instance.commands.node.group.create(ids)
const groupId = createdGroup(result)
```

无论 `createdGroup` 放在 `react/selection` 还是 `engine/result`，本质都说明：

- public return 过于原始
- 调用方仍在手动解码底层结果

正确做法应是：

```ts
const result = instance.commands.node.group.create(ids)
if (!result.ok) return
replace(instance, [result.data.groupId])
```

### 3.6 engine 保持纯同步

长期最优里，engine 的职责应明确限定为：

- 纯内存 document mutation engine
- 同步 plan / reduce / normalize / commit / publish
- 不承载 persistence / network / plugin IO

因此：

- `engine.commands.*` 应保持同步
- `document.replace` 应保持同步
- `history.undo / redo` 应保持同步
- `Write.apply` 应保持同步

如果未来需要异步能力，例如：

- 持久化
- 远端桥接
- 插件副作用
- 宿主事务封装

这些都应放在 engine 外层，由 host / effect / bridge 负责，而不是让 engine command surface 先天 async 化。

对应到 react 侧：

- feature command 若只是调用 engine，应尽量去掉 `await`
- render props 若只是薄转发 command，应直接同步返回 `CommandResult`

### 3.7 目录表达域，名字尽量短

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

- `Result<T, C>`
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

## 6.1 对当前 `CoreResult` 的判断

当前 `core` 的 [`CoreResult`](/Users/realrong/whiteboard/packages/whiteboard-core/src/types/result.ts)：

```ts
type CoreResult<T extends object = {}> =
  | ({ ok: true } & T)
  | CoreFailure
```

我认为**这不是长期最优模型**。

问题在于：

- success 分支没有固定 payload 槽位
- failure 分支只有 `message`，`code` 还是可选 `string`
- 不同域会不断发明自己的成功结构
- 一旦 payload 变复杂，就会开始出现额外包层，例如 `value`
- 不适合作为 `core -> engine -> react` 的统一结果基座

所以结论不是“继续沿用并扩展 `CoreResult`”，而是：

**直接替换掉它。**

### 6.2 Base Result

长期最优的基础模型建议统一成固定骨架：

```ts
type ErrorInfo<C extends string = string> = {
  code: C
  message: string
  details?: unknown
}

type Result<T = void, C extends string = string> =
  | {
      ok: true
      data: T
    }
  | {
      ok: false
      error: ErrorInfo<C>
    }
```

这个模型的关键价值是：

- success 永远走 `data`
- failure 永远走 `error`
- `error.code` 是必填，而不是可选
- `details` 有稳定扩展位
- 可以自然写 `map / flatMap / match` 这类通用 helper

这比当前扁平交叉类型稳定得多。

### 6.3 Engine Command Result

engine public command result 不应再复用 `CommitResult`，而应显式定义自己的结果类型。

推荐：

```ts
type CommandResult<T = void, C extends string = DispatchFailureReason> =
  | {
      ok: true
      data: T
      commit: Commit
    }
  | {
      ok: false
      error: ErrorInfo<C>
    }
```

这里保留 `commit` 在 success 分支顶层，原因是：

- `commit` 是 command public return 的固定伴随物
- `data` 只表达该命令的领域产出
- 调用方读取路径稳定：

```ts
const result = instance.commands.node.create(input)
if (!result.ok) return
result.data.nodeId
result.commit
```

### 6.4 为什么不用拍平 success 字段

虽然拍平写法更短，例如：

```ts
{ ok: true, nodeId, commit }
```

但长期看它的问题更大：

- success 分支没有统一骨架
- 不同命令会长出不同顶层字段
- 不利于通用 helper、抽象和二次组合
- 当 payload 变复杂时，顶层字段会继续膨胀

所以这里应该优先选择：

**稳定骨架 > 最短调用点**

### 6.5 废弃旧类型

既然没有兼容负担，建议直接：

- 删除 core public `CoreResult`
- 改为 `Result<T, C>`
- 删除 engine public `CommitResult`
- 改为 `CommandResult<T, C>`

概念上收成：

- `Result` = core / internal 纯结果模型
- `CommandResult` = engine public 主动命令结果
- `Commit` = engine public 被动提交事件

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
- `Write.apply` 把 `Draft<T>` 变成 `CommandResult<T>`
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
node.create(...) => CommandResult<{ nodeId: NodeId }>

node.duplicate(...) => CommandResult<{
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}>>

node.group.create(...) => CommandResult<{ groupId: NodeId }>

node.group.ungroup(id) => CommandResult<{ nodeIds: readonly NodeId[] }>

node.group.ungroupMany(ids) => CommandResult<{ nodeIds: readonly NodeId[] }>
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
edge.create(...) => CommandResult<{ edgeId: EdgeId }>

edge.routing.insertAtPoint(...) => CommandResult<{ index: number }>
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
mindmap.create(...) => CommandResult<{
  mindmapId: MindmapId
  rootId: MindmapNodeId
}>>

mindmap.addChild(...) => CommandResult<{ nodeId: MindmapNodeId }>
mindmap.addSibling(...) => CommandResult<{ nodeId: MindmapNodeId }>
mindmap.attachExternal(...) => CommandResult<{ nodeId: MindmapNodeId }>
mindmap.insertPlacement(...) => CommandResult<{ nodeId: MindmapNodeId }>

mindmap.cloneSubtree(...) => CommandResult<{
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
document.replace(...) => CommandResult
history.undo() => CommandResult
history.redo() => CommandResult
```

不需要额外领域字段，因为：

- 主动调用方通常不依赖 typed domain output
- 被动修复交给 `engine.commit -> finalize`

---

## 9. Core 侧最优改造

既然不在乎重构成本，最优方案不是只改 engine，而是把 `core -> engine -> react` 的结果链拉直。

### 9.1 Node Core

推荐把这些函数升级成 richer `Result`：

```ts
buildNodeCreateOperation(...) => Result<{
  operation: NodeCreateOperation
  nodeId: NodeId
}>

buildNodeGroupOperations(...) => Result<{
  operations: Operation[]
  groupId: NodeId
}>

buildNodeDuplicateOperations(...) => Result<{
  operations: Operation[]
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}>

buildNodeUngroupOperations(...) => Result<{
  operations: Operation[]
  nodeIds: readonly NodeId[]
}>
```

这样 engine 不需要再从 operations 逆向推导值。

### 9.2 Edge Core

推荐把这些函数升级成 richer `Result`：

```ts
buildEdgeCreateOperation(...) => Result<{
  operation: EdgeCreateOperation
  edgeId: EdgeId
}>
```

如果需要支持 routing insert 后继续交互，则继续扩展：

```ts
insertRoutingPoint(...) => Result<{
  patch: EdgePatch
  index: number
}>
```

### 9.3 Mindmap Core

mindmap core 当前已经是 richer result 风格，但内部还带一层 `value` 包装。

在无兼容成本前提下，建议直接统一到固定 `data` 骨架，而不是继续沿用：

当前：

```ts
CoreResult<{
  tree: MindmapTree
  value?: T
}>
```

建议改成：

```ts
type MindmapCommandResult<T extends object = {}> = Result<{
  tree: MindmapTree
} & T>
```

例如：

```ts
addChild(...) => MindmapCommandResult<{
  tree: MindmapTree
  nodeId: MindmapNodeId
}>

cloneSubtree(...) => MindmapCommandResult<{
  tree: MindmapTree
  nodeId: MindmapNodeId
  map: Record<MindmapNodeId, MindmapNodeId>
}>
```

这样 core 的所有纯结果都会共享同一套 success/failure 骨架。

---

## 10. Engine Internal 最优改造

### 10.1 `Draft` 改成泛型

当前 `Draft` 只有：

- `operations`

建议直接改成：

```ts
type Draft<T extends object = {}> = Result<{
  operations: readonly Operation[]
  output: T
}, DraftErrorCode>
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

### 10.3 `Write.apply` 同步透传值

当前 `Write.apply` 只返回 `CommitResult`。

建议改成：

```ts
type Apply = <T extends object>(input: WriteInput) => CommandResult<T>
```

执行顺序：

```txt
plan -> Draft<T>
reduce -> WriteCommit
publish -> Commit
return { ok: true, data: draft.data.output, commit }
```

### 10.4 `createCommands` 直接对外给同步 typed result

例如：

```ts
const create = (payload: NodeInput) =>
  run({ type: 'create', payload }) as CommandResult<{ nodeId: NodeId }>
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
const result = instance.commands.node.group.create(ids)
if (!result.ok) return
replace(instance, [result.data.groupId])
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
const result = instance.commands.mindmap.insertPlacement(...)
if (!result.ok) return
startEdit(result.data.nodeId)
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

先改结果类型基座。

目标：

- 修改 `packages/whiteboard-core/src/types/result.ts`
- 用 `Result<T, C>` 替换 `CoreResult`
- 新增 `packages/whiteboard-engine/src/types/result.ts`
- 定义 `CommandResult<T>`
- 从 `packages/whiteboard-engine/src/index.ts` 导出 `CommandResult`
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
- 改成固定 `data` 骨架

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
- `engine.commands.*` 全部同步返回 typed `CommandResult<T>`
- `selection/policy.ts` 不再出现 node/group/edge/mindmap 结果解释
- `node` / `edge` / `mindmap` 三个域的 command result 风格统一
- `core -> engine -> react` 的值链不再中途丢失

最终总图应当是：

```txt
core:
pure domain result

engine:
draft<T> -> commit -> command-result<T>
commit stream

react:
commit stream -> finalize
typed result -> local policy
```

这就是在无兼容成本前提下，整条 command result chain 最符合漏斗原则与职责分离的长期最优设计。
