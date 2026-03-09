# Engine 当前链路总览

更新日期：2026-03-08  
范围：`packages/whiteboard-core`、`packages/whiteboard-engine`、`packages/whiteboard-react`

## 1. 当前最终主链

```text
commands
  -> write.apply | write.load | write.replace
  -> plan
  -> reduce planned operations
  -> normalize group bounds
  -> reduce final operations (if normalize emitted ops)
  -> document.commit
  -> history.capture | clear
  -> read.applyImpact
  -> document.notifyChange (按策略触发)
```

当前正式保留的主阶段只有五层：

1. `commands`
2. `write`
3. `plan`
4. `core reduce + normalize`
5. `read`

这条链路现在的关键特征：

1. 写侧只有一个漏斗：`write`。
2. `group bounds autofit` 已并入 write 内部的 normalize stage，不再作为 reaction / second write 存在。
3. 单次用户写入只发生一次最终 `commit`、一次 `history capture`、一次 `read.applyImpact`、一次 `notify`。
4. core reducer 仍然只输出 `KernelReadImpact`；normalize 作为 write 内部 canonicalization 过程，不再借用 read reaction 语义。
5. read 只消费最终 canonical document，不再看见 group rect 未归一化的中间态。

## 2. 每层职责

### commands

关键文件：

1. `packages/whiteboard-engine/src/commands/index.ts`
2. `packages/whiteboard-engine/src/commands/node.ts`
3. `packages/whiteboard-engine/src/commands/edge.ts`
4. `packages/whiteboard-engine/src/commands/mindmap.ts`
5. `packages/whiteboard-engine/src/commands/viewport.ts`

职责：

1. 暴露稳定 public command API。
2. 所有文档 mutation 最终统一落到 `write.apply / write.load / write.replace`。
3. 不直接碰 read cache、normalize、history、notify。

### write

关键文件：

1. `packages/whiteboard-engine/src/runtime/write/index.ts`
2. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/*.ts`

职责：

1. 唯一写漏斗。
2. 统一执行 `plan -> reduce -> normalize -> commit`。
3. 统一处理 whole-document `load / replace`。
4. 统一 history。
5. 统一在最终提交后驱动 read 和 notify。

当前 write 已经删除的噪音：

1. `changeBus`
2. `trace`
3. `write.subscribe`
4. reaction queue / reaction microtask flush
5. `Autofit -> system write.apply` second write 链路

### plan

关键文件：

1. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
2. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/node.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/edge.ts`
4. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/viewport.ts`
5. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/mindmap.ts`

职责：

1. 把 public command 翻译成标准 `Operation[]`。
2. 做命令级归一化与校验。
3. 不直接碰 read、history、normalize、notify。

### core reduce

关键文件：

1. `packages/whiteboard-core/src/kernel/reduce.ts`
2. `packages/whiteboard-core/src/kernel/types.ts`

职责：

1. `reduceOperations` 是 core 纯 reduce 入口。
2. 把 operations 应用到 document。
3. 产出：
   - `doc`
   - `changes`
   - `inverse`
   - `KernelReadImpact`
4. 不直接知道 engine 怎样做 read cache 或 notify。

当前 `KernelReadImpact` 的语义轴：

1. `reset`
2. `node.geometry / node.list / node.value`
3. `edge.geometry / edge.list / edge.value`
4. `mindmap.view`

### normalize

关键文件：

1. `packages/whiteboard-core/src/node/group.ts`
2. `packages/whiteboard-engine/src/runtime/write/index.ts`

职责：

1. `normalizeGroupBounds` 是 group bounds 的 canonicalization 纯算法。
2. 输入：`document + nodeSize + groupPadding + rectEpsilon`。
3. 输出：标准 `node.update` operations。
4. 采用 `direct children + bottom-up` 单轮 pass。
5. 作为 write 内部 stage 运行，不再是 reaction。

当前 normalize 的实现形态：

```text
reduce planned operations
  -> normalizeGroupBounds(reduced.doc)
  -> if no normalize ops: 直接提交 reduced
  -> if normalize ops exist:
       基于原始 doc 对 [plannedOps + normalizeOps] 统一再 reduce 一次
  -> commit final canonical doc
```

这保证：

1. final `changes.operations` 已包含 normalize ops。
2. final `inverse` 天然正确。
3. history 只 capture 一次。
4. read 只 apply 一次最终 impact。

### read

关键文件：

1. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
2. `packages/whiteboard-engine/src/runtime/read/apply.ts`
3. `packages/whiteboard-engine/src/runtime/read/stages/index/*`
4. `packages/whiteboard-engine/src/runtime/read/stages/edge/*`
5. `packages/whiteboard-engine/src/runtime/read/stages/mindmap/*`

职责：

1. 接收最终 `ReadImpact`。
2. 执行 node rect index、snap index、edge projection 的失效更新。
3. bump `node / edge / mindmap` signal。
4. 对外暴露 `read.state / read.projection / read.query / read.doc / read.config`。

读链路当前形态：

```text
document.commit
  -> stateAtoms.document
  -> read.applyImpact(impact)
  -> apply index / edge projection change
  -> bump node / edge / mindmap signal atoms
  -> ui 重新读取 read.*
```

要点：

1. read 只消费最终 canonical doc。
2. `readModel()` 是 read kernel 内部纯 memo getter。
3. 不再存在专门给 normalize/autofit 服务的 read reaction 分支。

## 3. 典型链路

### 3.1 普通节点更新

```text
UI
  -> instance.commands.node.updateMany(...)
  -> write.apply
  -> plan(node.updateMany)
  -> reduce planned operations
  -> normalize group bounds
  -> commit final doc
  -> history.capture
  -> read.applyImpact
  -> notify
```

### 3.2 文档整体替换

```text
UI / import
  -> instance.commands.doc.replace(doc)
  -> write.replace
  -> assertDocument(doc)
  -> normalizeGroupBounds(doc)
  -> document.commit(normalizedDoc)
  -> clear history
  -> createResetReadImpact()
  -> read.applyImpact
  -> notify
```

### 3.3 undo / redo

```text
history.undo | redo
  -> replay operations
  -> write.commit(history=skip)
  -> reduce planned operations
  -> normalize group bounds
  -> commit final canonical doc
  -> read.applyImpact
```

要点：

1. history replay 也走同一条 normalize 主链。
2. 如果 history forward / inverse 已包含 normalize ops，normalize stage 会自然产出空结果。
3. 不再需要额外 reaction 补写。

## 4. 当前已经删掉的主要噪音

1. `reactions`
2. `Autofit` reaction
3. reaction task queue / microtask flush
4. `impact -> system write.apply` second write
5. “先提交中间态文档，再靠 reaction 归一化”的双阶段提交

## 5. 当前最重要的边界

1. core reducer 只负责 `operations -> reduced document + inverse + KernelReadImpact`。
2. core `normalizeGroupBounds` 只负责文档 canonicalization，不负责 read、history、notify。
3. engine write 负责把 `reduce` 与 `normalize` 串成单次最终提交。
4. read 只负责 `impact -> index/projection/signals`。
5. UI 只订阅对应 signal 后重新读取 `read.*`。

## 6. 当前最终判断

这条链路已经从旧的：

```text
commands -> write -> plan -> commit -> read -> reactions -> second write
```

收敛成：

```text
commands -> write -> plan -> reduce -> normalize -> commit -> read
```

从漏斗原则和 CQRS 角度，这是当前更清晰也更稳定的形态：

1. 文档归一化被收进写漏斗内部，不再暴露为并行副作用通道。
2. 单次用户写入只对应一次最终 canonical commit。
3. history、read、notify 都只看最终结果，不再感知中间态。
4. normalize 是 document 语义，read 是 projection 语义，两者边界现在更清楚。
