# Engine 当前链路总览（主链拉直版）

更新日期：2026-03-06  
范围：`packages/whiteboard-engine`

---

## 1. 总体结论

当前主链已经收敛为：

`commands -> write -> plan -> commit -> read -> reactions`

对应原则：

1. `commands` 只负责 public 语义入口与本地 state orchestration。
2. `write` 是唯一文档写漏斗。
3. `plan` 只从 write 生成，不从 read 反推。
4. `commit` 负责唯一文档提交事务。
5. `read` 是提交后的必经同步投影，不再挂在 reactions 下。
6. `reactions` 只处理可选系统副作用，例如 autofit。

---

## 2. 最终主链

```text
instance.commands.*
  -> facade commands
  -> write.apply / write.resetDoc
  -> planner
  -> writer.commitApply / writer.commitReplace
  -> document.set
  -> revision++ + viewport sync
  -> read.applyInvalidation(readHints)
  -> document.notifyChange (apply path)
  -> changeBus.publish(change)
  -> reactions.ingest(change)
  -> topic flush
  -> write.apply(source='system')
```

说明：

1. `execution.ts` 已删除。
2. `write.commands` 已删除。
3. `read.applyInvalidation` 已从 `Reactions.ts` 移回 write 提交主链。

---

## 3. Commands 层

核心文件：

1. `packages/whiteboard-engine/src/instance/facade/commands.ts`
2. `packages/whiteboard-engine/src/runtime/write/api/*.ts`

职责：

1. 对外暴露 `instance.commands.*`。
2. 文档 mutation 类命令直接调用 `write.apply`。
3. UI state 类命令直接写 `state` 或 `viewport host`。
4. `selection` 这类“读当前 UI state 再发起 write”的语义编排也停留在 facade，不进入 write 核心对象。

这意味着 public 入口不再经过 `write.commands` 二次转发。

---

## 4. Write 层

核心文件：

1. `packages/whiteboard-engine/src/runtime/write/runtime.ts`
2. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/commit/writer.ts`

职责：

1. 组装 `planner`。
2. 组装 `changeBus`。
3. 构造 `Writer`。
4. 暴露唯一文档写入口：
   - `apply`
   - `resetDoc`
   - `history`
   - `changeBus`

当前 write 内部不再存在独立 `execution` 装配层。

---

## 5. Commit 层

`Writer` 当前承担 commit 事务，顺序为：

### 5.1 apply 路径

1. `reduceOperations(docBefore, operations)`
2. `document.set(reduced.doc)`
3. `readModelRevision++`
4. `viewport.setViewport(doc.viewport)`
5. `createReadInvalidation(impact)`
6. `read.applyInvalidation(readHints)`
7. `document.notifyChange(reduced.doc)`
8. `changeBus.publish({ trace, readHints })`

### 5.2 replace 路径

1. `document.set(doc)`
2. `readModelRevision++`
3. `viewport.setViewport(doc.viewport)`
4. `createReadInvalidation(FULL_MUTATION_IMPACT)`
5. `read.applyInvalidation(readHints)`
6. `changeBus.publish({ trace, readHints })`

说明：

1. replace 仍保留当前不触发 `notifyChange` 的行为。
2. `history` 目前仍由 `Writer` 持有，这是下一步仍可继续上提的点。

---

## 6. Read 层

核心文件：

1. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
2. `packages/whiteboard-engine/src/runtime/read/stages/index/stage.ts`
3. `packages/whiteboard-engine/src/runtime/read/stages/edge/stage.ts`

职责：

1. 接收 write 提交后的 `readHints`。
2. 同步刷新 index / edge projection。
3. 为 `instance.read` 和 `instance.query` 提供稳定读取能力。

关键变化：

1. `read` 已经是主链必经步骤。
2. `reactions` 不再负责触发 read 刷新。

---

## 7. Reactions 层

核心文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`
3. `packages/whiteboard-engine/src/instance/reactions/Queue.ts`
4. `packages/whiteboard-engine/src/instance/reactions/registry.ts`

职责：

1. 订阅已经 committed 且已经完成 read projection 的 `change`。
2. 聚合模块内部 pending 状态。
3. flush 时产出 system write，再回流到统一 `write.apply`。

因此 reactions 现在只代表“可选副作用层”，而不是读模型同步层。

---

## 8. 仍可继续优化的点

1. `history` 仍在 `Writer` 内部，后续可提升到 `write` 顶层，进一步明确 `commit` 与 `history` 的职责边界。
2. `resetDoc` 语义仍偏旧，后续可以继续演进为更显式的 `doc.load / doc.replace`。
3. `selection` domain 仍包含一部分 orchestration 语义，后续可继续评估是否进一步收敛回 facade。
