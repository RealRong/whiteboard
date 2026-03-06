# Engine 当前链路总览（继续收敛后）

更新日期：2026-03-07
范围：`packages/whiteboard-core`、`packages/whiteboard-engine`、`packages/whiteboard-react`

## 1. 当前最终主链

```text
commands
  -> write.apply | write.load | write.replace
  -> plan
  -> commit
  -> reduceOperations | whole-document commit
  -> document.commit
  -> read.applyInvalidation
  -> document.notifyChange (按策略触发)
  -> react(invalidation)
  -> reactions
  -> system write.apply
```

现在真正保留下来的正式阶段只有六层：

1. `commands`
2. `write`
3. `plan`
4. `commit`
5. `read`
6. `reactions`

这条链路当前有四个明确特征：

1. 写侧只有一个正式入口漏斗：`write`。
2. 读侧不再反向参与写规划，`plan` 不依赖 read projection。
3. whole-document 语义只留在 `write`，不再散落在外层 facade。
4. 副作用链也只有一条直接通道：`write -> react(invalidation) -> reactions`。

## 2. 每层职责

### commands

文件：

1. `packages/whiteboard-engine/src/instance/facade/commands.ts`
2. `packages/whiteboard-engine/src/instance/facade/selection.ts`
3. `packages/whiteboard-engine/src/runtime/write/api/*.ts`
4. `packages/whiteboard-react/src/common/interaction/shortcutDispatch.ts`

职责：

1. engine 暴露稳定的 public primitive：`doc / node / edge / viewport / history / interaction / host / selection`。
2. engine 的 `selection` 现在只保留基础状态操作：`select / toggle / selectAll / clear`。
3. react adapter 负责快捷键 guard、action 路由，以及“基于当前 selection 的复合意图”。
4. 所有文档 mutation 最终仍统一落到 `write.apply / write.load / write.replace`。
5. 纯临时状态写继续直接走 `state` / `viewport`，不进入文档写链。

这轮在 commands 边界上又完成了三件事：

1. engine `shortcut` facade 已删除。
2. `groupSelected / ungroupSelected / deleteSelected / duplicateSelected` 已从 engine `selection` 中移除。
3. 为了支撑 UI adapter，`node.deleteCascade / node.duplicate / node.group.ungroupMany` 已提升为 public primitive。

### write

文件：

1. `packages/whiteboard-engine/src/runtime/write/index.ts`
2. `packages/whiteboard-engine/src/runtime/write/invalidation.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
4. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/*.ts`

职责：

1. 唯一写漏斗。
2. 统一执行 `plan -> commit`。
3. 统一管理 history。
4. 统一 whole-document replace/load 语义：
   - reset transient state
   - clear history
   - commit doc
   - 产出 `FULL_READ_INVALIDATION`
   - 按策略触发 notify
5. 统一 operation commit 语义：
   - `reduceOperations`
   - `document.commit`
   - `read.applyInvalidation`
   - `document.notifyChange`
   - `react(invalidation)`

写侧已经不再保留的历史噪音包括：

1. `Draft.value`
2. `DispatchResult.value`
3. `changeBus`
4. `trace`
5. `write.subscribe`

### plan

文件：

1. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
2. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/node.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/edge.ts`
4. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/viewport.ts`
5. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/mindmap.ts`

职责：

1. 把 public command 翻译成标准 `Operation[]`。
2. 做命令级归一化和折叠。
3. 不提交文档。
4. 不持有读侧副产物协议。
5. 不依赖 read projection。

### commit

`commit` 现在不再是单独目录，而是 `packages/whiteboard-engine/src/runtime/write/index.ts` 内部的一段统一语义。

职责：

1. operation commit 走 `reduceOperations`。
2. whole-document commit 直接提交文档并产出 `FULL_READ_INVALIDATION`。
3. 在同一处统一 history、notify、react 的时机。

### core reduce

文件：

1. `packages/whiteboard-core/src/kernel/reduce.ts`
2. `packages/whiteboard-core/src/kernel/session.ts`

职责：

1. `reduceOperations` 是 core 纯 reduce 入口。
2. 每次 reduce 创建一次局部 session。
3. `session.applyOperations(...)` 单次循环完成：
   - 补 `before`
   - 生成 inverse
   - 聚合 invalidation
   - 应用 operation 到文档草稿
4. 最终返回：
   - `doc`
   - `changes`
   - `inverse`
   - `invalidation`

### read

文件：

1. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
2. `packages/whiteboard-engine/src/runtime/read/stages/index/*`
3. `packages/whiteboard-engine/src/runtime/read/stages/node/*`
4. `packages/whiteboard-engine/src/runtime/read/stages/edge/*`
5. `packages/whiteboard-engine/src/runtime/read/stages/mindmap/*`

职责：

1. 只读查询、索引、投影。
2. 接收 `write` 发来的 invalidation。
3. 更新 index / cache / projection。
4. 统一暴露 `read.state` / `read.projection` / `read.viewport` / `read.canvas` / `read.snap`。

### reactions

文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`

职责：

1. 只消费 `ReadInvalidation`。
2. 聚合 reaction 模块的 pending 状态。
3. 通过单个 microtask flush 统一出队。
4. 需要时回流到 `system write.apply`。

这一层已经删掉：

1. `topic`
2. `registry`
3. `ReactionTaskQueue`
4. `change` 事件型副作用转发层

## 3. 当前命令边界

现在的 public command 面已经比之前清楚很多：

1. engine 负责稳定 primitive，不再负责快捷键编排。
2. react 负责把 UI selection、focus、shortcut binding 翻译成 primitive 调用。
3. `selection` 留在 engine 的部分，都是状态级基础动作，不再混入文档 mutation。
4. 需要基于当前 selection 才能成立的复合意图，统一放在 UI adapter，而不是继续塞进 engine facade。

目前这条边界的实际形态是：

1. `instance.commands.selection.*` 只改 selection state。
2. `instance.commands.node.*` / `edge.*` 承载真正的文档 mutation primitive。
3. `shortcutDispatch.ts` 读取 `instance.state`，再路由到 `instance.commands.*`。

## 4. 典型链路

### 4.1 普通节点更新

```text
UI
  -> instance.commands.node.updateMany(...)
  -> write.apply
  -> plan(node.updateMany)
  -> commit(reduceOperations)
  -> read.applyInvalidation
  -> react(invalidation)
```

### 4.2 快捷键复制选中节点

```text
keydown
  -> useShortcutDispatch
  -> shortcutDispatch.ts
  -> canDispatchShortcutAction(instance, 'selection.duplicate')
  -> instance.commands.node.duplicate(selectedNodeIds)
  -> write.apply
  -> plan(node.duplicate)
  -> commit(reduceOperations)
  -> read.applyInvalidation
  -> react(invalidation)
  -> shortcutDispatch.ts 根据 changes.operations 更新 selection
```

这个链路说明了一点：

1. selection 复合语义已经下沉到 UI。
2. engine 只需要提供稳定 primitive 与标准 `DispatchResult`。

### 4.3 文档整体替换

```text
UI / import
  -> instance.commands.doc.replace(doc)
  -> write.replace
  -> reset transient state
  -> clear history
  -> document.commit(doc)
  -> read.applyInvalidation(FULL_READ_INVALIDATION)
  -> notify
  -> react(FULL_READ_INVALIDATION)
```

### 4.4 reactions 回流写侧

```text
write commit
  -> react(invalidation)
  -> reactions.flush()
  -> autofit 生成 system write input
  -> write.apply(..., source: 'system')
```

## 5. 已经删掉的主要噪音

到当前版本，已经不再保留这些旧层：

1. `Commands -> CommandGateway -> Planner -> Writer -> ChangeBus -> ReadInvalidation -> Read Planner` 那套中间转发链。
2. `Draft.value / DispatchResult.value` 的结果 side-channel。
3. `changeBus + trace + write.subscribe` 的第二套副作用协议。
4. engine `shortcut` facade。
5. engine 内部的 selection 复合 mutation 编排。
6. 基于 `Document.mindmaps` 的双实现与兼容链路。
7. `NodeHint` 与 `createKernelQuery`。

## 6. 当前总判断

现在主链已经足够直，下一步不需要再发明新中间层，重点只剩外围减法：

1. 继续分清 `commands` 里的文档 mutation 与临时状态命令。
2. 继续打磨统一后的 `read` 树边界。
3. 继续瘦身 core reduce 里的 copy / normalize 边界。
4. 若 reaction 模块长期很少，再评估是否继续内联。

结论：当前链路已经是清晰的单漏斗结构，后续优化应继续删边界噪音，而不是重新拆主链。
