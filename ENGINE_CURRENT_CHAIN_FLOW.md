# Engine 当前链路总览

更新日期：2026-03-07  
范围：`packages/whiteboard-core`、`packages/whiteboard-engine`、`packages/whiteboard-react`

## 1. 当前最终主链

```text
commands
  -> write.apply | write.load | write.replace
  -> plan
  -> commit
  -> core reduce | whole-document replace
  -> document.commit
  -> read.ingest(read impact)
  -> document.notifyChange (按策略触发)
  -> react(read impact)
  -> reactions
  -> system write.apply
```

当前正式保留的阶段只有六层：

1. `commands`
2. `write`
3. `plan`
4. `commit`
5. `read`
6. `reactions`

这条链路现在有五个关键特征：

1. 写侧只有一个漏斗：`write`。
2. core 只输出 `KernelReadImpact`，不直接输出 read control。
3. engine 负责把 `ReadImpact` 编译成统一的 read control，并执行 cache / signal 控制。
4. UI 不再订阅统一的 `projection`，而是订阅 `node / edge / mindmap`。
5. reactions 不依赖 UI signal，而是直接消费 `ReadImpact`。

## 2. 每层职责

### commands

关键文件：

1. `packages/whiteboard-engine/src/instance/facade/commands.ts`
2. `packages/whiteboard-engine/src/instance/facade/selection.ts`
3. `packages/whiteboard-engine/src/runtime/write/api/*.ts`
4. `packages/whiteboard-react/src/common/interaction/shortcutDispatch.ts`

职责：

1. 暴露稳定的 public primitive：`doc / node / edge / viewport / history / interaction / host / selection`。
2. 所有文档 mutation 最终统一落到 `write.apply / write.load / write.replace`。
3. 纯临时状态写继续直接走 `state` / `viewport`，不进入文档写链。
4. UI 侧快捷键、selection 复合意图留在 react adapter，不再塞进 engine shortcut facade。

### write

关键文件：

1. `packages/whiteboard-engine/src/runtime/write/index.ts`
2. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/*.ts`

职责：

1. 唯一写漏斗。
2. 统一执行 `plan -> commit`。
3. 统一 whole-document replace/load。
4. 统一 history。
5. 把 `core reduce` 产出的 `read impact` 送给 `read` 和 `reactions`。

当前 write 已删掉的噪音：

1. `changeBus`
2. `trace`
3. `write.subscribe`
4. `FULL_READ_INVALIDATION`
5. `runtime/write/invalidation.ts`

### plan

关键文件：

1. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
2. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/node.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/edge.ts`
4. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/viewport.ts`
5. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/mindmap.ts`

职责：

1. 把 public command 翻译成标准 `Operation[]`。
2. 做命令级归一化和折叠。
3. 不直接碰 read cache / read signal / reactions。

### commit

`commit` 现在不再是单独目录，而是 `packages/whiteboard-engine/src/runtime/write/index.ts` 内部的统一语义段。

职责：

1. operation commit 走 `reduceOperations`。
2. whole-document replace 直接提交文档，并生成 `reset` 类型的 `ReadImpact`。
3. 在同一处统一 history、notify、read、react 的时机。

### core reduce

关键文件：

1. `packages/whiteboard-core/src/kernel/reduce.ts`
2. `packages/whiteboard-core/src/kernel/types.ts`

职责：

1. `reduceOperations` 是 core 纯 reduce 入口。
2. operation 在 core 内部先收敛成 `KernelReadImpact`。
3. core 只描述读侧事实，不描述 engine 怎样更新 cache 或 signal。

当前 `KernelReadImpact` 的语义轴：

1. `reset`
2. `node.geometry / node.list / node.value`
3. `edge.geometry / edge.list / edge.value`
4. `mindmap.view`

### read

关键文件：

1. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
2. `packages/whiteboard-engine/src/runtime/read/impact.ts`
3. `packages/whiteboard-engine/src/runtime/read/stages/index/*`
4. `packages/whiteboard-engine/src/runtime/read/stages/edge/*`
5. `packages/whiteboard-engine/src/runtime/read/stages/mindmap/*`

职责：

1. 接收 `ReadImpact`。
2. 编译出统一 read control：`index / edge / signals`。
3. 执行 read cache 与 signal 控制。
4. 维护内部 `readModel()` memo getter、index、edge cache、mindmap cache。
5. 对外统一暴露 `read.state / read.projection / read.index / read.viewport / read.config / read.document`。

读链路当前的实现形态：

```text
document.commit
  -> stateAtoms.document
  -> read.ingest(impact)
  -> compileReadControl(impact)
  -> apply index / edge cache control
  -> bump node / edge / mindmap signal atoms
  -> ui useReadGetter 重新读取 read.projection.*
```

要点：

1. `readModel()` 现在是 read kernel 内部纯 memo getter，不再依赖 atom revision。
2. engine 明确要求 document 输入保持不可变。
3. `projection` 不再是 public subscription key。
4. `READ_SUBSCRIPTION_KEYS` 现在只保留：`node / edge / mindmap` 和 state keys。

### reactions

关键文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`

职责：

1. 直接消费 `ReadImpact`。
2. 聚合 pending reaction 状态。
3. 通过单个 microtask flush 回流到 `system write.apply`。

这层当前只保留一个 reaction：`autofit`。

## 3. 典型链路

### 3.1 普通节点更新

```text
UI
  -> instance.commands.node.updateMany(...)
  -> write.apply
  -> plan(node.updateMany)
  -> commit(reduceOperations)
  -> core read impact
  -> read.ingest(impact)
  -> react(impact)
```

### 3.2 文档整体替换

```text
UI / import
  -> instance.commands.doc.replace(doc)
  -> write.replace
  -> reset transient state
  -> clear history
  -> document.commit(doc)
  -> createReplaceReadImpact(...)
  -> read.ingest(impact)
  -> notify
  -> react(impact)
```

### 3.3 edge / node / mindmap 分路订阅

```text
read signal atoms
  -> READ_SUBSCRIPTION_KEYS.node
  -> READ_SUBSCRIPTION_KEYS.edge
  -> READ_SUBSCRIPTION_KEYS.mindmap
```

对应 UI 消费：

1. `NodeLayer` 只订阅 `node`。
2. `EdgeLayer` / endpoint / control point 只订阅 `edge`。
3. `MindmapLayer` 只订阅 `mindmap`。

## 4. 当前已经删掉的主要噪音

1. core 输出 `KernelProjectionInvalidation`
2. engine `ReadInvalidation`
3. `READ_SUBSCRIPTION_KEYS.projection`
4. `runtime/write/invalidation.ts`
5. “cache invalidation 等于 UI subscription topic” 这套混合语义

## 5. 当前最重要的边界

1. core 只负责 `operations -> KernelReadImpact`。
2. engine read 只负责 `impact -> cache change + signals`。
3. reactions 只负责 `impact -> side effect write`。
4. UI 只负责订阅对应 signal 后重新读取 `read.projection.*`。

## 6. 当前最终判断

这条链路现在已经从旧的：

```text
commands -> write -> plan -> commit -> invalidation -> projection subscribe
```

收敛成：

```text
commands -> write -> plan -> commit -> KernelReadImpact -> read control compiler -> read / reactions
```

从漏斗原则和 CQRS 角度，这已经明显比旧链路更直：

1. 上游只有一份稳定读侧语义：`ReadImpact`。
2. 下游不再各自重复解释 operations。
3. cache、signal、reaction 都成为 impact 的消费者，而不是并列的一等上游协议。
