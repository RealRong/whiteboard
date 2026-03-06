# Engine 当前链路总览（最终版）

更新日期：2026-03-06  
范围：`packages/whiteboard-engine`

## 1. 最终主链

```text
commands
  -> write.apply | write.load | write.replace
  -> plan
  -> writer.commitOperations | writer.commitDocument
  -> document.commit
  -> read.applyInvalidation
  -> document.notifyChange (按策略触发)
  -> write.subscribe
  -> reactions
  -> system write.apply
```

这条链已经收敛成两个明确阶段：

1. `write` 之前是命令语义与参数归一化。
2. `write` 之后是提交事实驱动的读侧同步和系统副作用。

## 2. 分层职责

### commands

文件：

1. `packages/whiteboard-engine/src/instance/facade/commands.ts`
2. `packages/whiteboard-engine/src/instance/facade/selection.ts`
3. `packages/whiteboard-engine/src/instance/facade/shortcut.ts`
4. `packages/whiteboard-engine/src/runtime/write/api/*.ts`

职责：

1. 对外暴露 `instance.commands.*`。
2. 做 facade 语义整合，不直接处理提交事务。
3. UI state 命令直接写 `state` / `viewport`。
4. 文档 mutation 命令统一进入 `write.apply`。
5. whole-document 命令统一进入 `write.load` / `write.replace`。

### write

文件：

1. `packages/whiteboard-engine/src/runtime/write/runtime.ts`
2. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/commit/writer.ts`
4. `packages/whiteboard-engine/src/runtime/write/stages/commit/history.ts`
5. `packages/whiteboard-engine/src/runtime/write/stages/invalidation/plan.ts`

职责：

1. 作为唯一写漏斗。
2. 持有 `planner`、`writer`、`history`、`changeBus`。
3. 从提交结果派生 `trace` 和 `invalidation`。
4. 统一执行：
   - `read.applyInvalidation`
   - `document.notifyChange`
   - `changeBus.publish`
   - history capture / replay

### commit

文件：

1. `packages/whiteboard-engine/src/runtime/write/stages/commit/writer.ts`

职责：

1. 只做文档提交。
2. `commitOperations` 负责 `reduceOperations + document.commit`。
3. `commitDocument` 负责 whole-document commit。
4. 不知道 `Change`。
5. 不知道 `trace`。
6. 不知道 `read invalidation`。
7. 不知道 `notify` 和 `publish`。

这意味着 `Writer` 现在是纯提交组件，而不是半个 orchestrator。

### read

文件：

1. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
2. `packages/whiteboard-engine/src/runtime/read/stages/index/stage.ts`
3. `packages/whiteboard-engine/src/runtime/read/stages/edge/stage.ts`

职责：

1. 接收 `ReadInvalidation`。
2. 更新 index / projection。
3. 暴露 `read` 与 `query`。
4. 不反推 write plan。

### reactions

文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/instance/reactions/registry.ts`
3. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`

职责：

1. 订阅 write change。
2. 把 change 转成 topic task。
3. flush 时回到 `write.apply(source='system')`。
4. 只处理系统副作用，不承担 read 主链。

## 3. 当前收敛后的关键原则

1. `plan` 只从 write 输入生成，不从 read 推导。
2. `Writer` 只提交，不承担读侧同步。
3. `read` 只消费失效计划，不回流命令语义。
4. `history` 属于 write orchestration，不属于 commit 内核。
5. `load` 和 `replace` 共享 whole-document commit，但 `notify` 策略不同。
6. `Change` 是 write 顶层事件，不是 Writer 内部对象。
7. `MutationImpact -> readHints` 中间层已经删除，直接由 operations 规划 `ReadInvalidation`。

## 4. 最终数据流

### 普通 mutation

```text
commands.node.update(...)
  -> write.apply(payload)
  -> planner(payload)
  -> writer.commitOperations({ operations, origin })
  -> document.commit(doc)
  -> planReadInvalidation(changes.operations)
  -> read.applyInvalidation(invalidation)
  -> notifyChange(doc)
  -> publish({ trace, invalidation })
  -> history.capture(...)
```

### whole-document load

```text
commands.doc.load(doc)
  -> clear transient state
  -> write.load(doc)
  -> history.clear()
  -> writer.commitDocument({ doc, origin: 'system' })
  -> document.commit(doc)
  -> FULL_READ_INVALIDATION
  -> read.applyInvalidation(...)
  -> publish({ trace, invalidation })
```

### whole-document replace

```text
commands.doc.replace(doc)
  -> clear transient state
  -> write.replace(doc)
  -> history.clear()
  -> writer.commitDocument({ doc, origin: 'system' })
  -> document.commit(doc)
  -> FULL_READ_INVALIDATION
  -> read.applyInvalidation(...)
  -> notifyChange(doc)
  -> publish({ trace, invalidation })
```

## 5. 与旧链路相比删除的东西

已经删除或降级为内部细节的层：

1. `MutationImpactAnalyzer`
2. `MutationImpact`
3. `readHints`
4. `Writer.project(...)`
5. `Writer.publish(...)`
6. `Writer.notifyDocumentChange(...)`
7. `write.commands` 对象
8. `execution.ts`
9. `runtime/write/api/commands/*` 嵌套目录

## 6. 现在的判断

从全局看，这一版已经接近最简主链：

1. 只有一个写漏斗：`write`。
2. 只有一个提交组件：`Writer`。
3. 只有一个读侧同步入口：`read.applyInvalidation`。
4. 只有一个系统副作用入口：`reactions`。

如果后面还要继续压缩，优先级最高的方向只剩两类：

1. 继续把 `write/runtime.ts` 中局部 helper 内联到更直接的顺序流程。
2. 评估 engine 侧 `History` 是否可以与 core history 进一步统一。

除此之外，主链结构本身已经比较直。 
