# Engine 当前链路总览（最新收敛版）

更新日期：2026-03-05  
范围：`packages/whiteboard-engine`

---

## 1. 总体结论

当前链路已经收敛到单主漏斗，核心特征：

1. 写入口唯一：外部 `instance.commands.*`，内部统一汇聚到 `writeRuntime.apply`。
2. plan 唯一来源：只在 write planner 生成（含 `selection` 单事务 domain）。
3. writer 事务语义清晰：`commitApply` / `commitReplace`。
4. change envelope 最小化：`Change = { trace, readHints }`。
5. readHints 最小化：只保留 stage-ready 的 `index` 与 `edge` 计划。
6. read context 直通：`context.state.xxx()` + `context.snapshot()`，去掉 key 反查。
7. reactions 协议收敛：`seed / ingest / flush`，topic microtask 去重调度。
8. document 写入语义显式：`document.set` 与 `document.notifyChange` 分离。
9. command 类型按职责拆分：`mindmap / interaction / write / public`，`api.ts` 仅聚合导出。
10. legacy CQRS 类型导出已移除，公共 API 与运行时一致。

最终主链：

`Commands -> WriteApply -> Planner -> Writer(commitApply|commitReplace) -> CoreReduce -> ChangeBus(trace+readHints) -> Reactions(ingest) -> ReadKernel(index+edge) -> Reactions(flush->system write)`

---

## 2. 写链路（唯一漏斗）

核心文件：

1. `packages/whiteboard-engine/src/runtime/write/runtime.ts`
2. `packages/whiteboard-engine/src/runtime/write/execution.ts`
3. `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
4. `packages/whiteboard-engine/src/runtime/write/stages/commit/writer.ts`
5. `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/selection.ts`
6. `packages/whiteboard-engine/src/runtime/write/stages/plan/shared/duplicate.ts`

流程：

1. 语义命令最终调用 `writeRuntime.apply(payload)`。
2. `planner(payload)` 产出 `Draft`（唯一 write plan）。
3. writer 根据 draft 进入：
   - `commitApply`（operations）
   - `commitReplace`（doc reset）
4. `reduceOperations` 应用 core 规则并产出 inverse。
5. writer 提交文档与运行时状态：
   - apply：`document.set + document.notifyChange + revision++ + viewport sync`
   - replace：`document.set + revision++ + viewport sync`（默认不 notify）
6. writer 发布最小 `Change` 到 `changeBus`。
7. history capture 与 undo/redo 仍走同一提交路径。

---

## 3. Change / ReadHints 协议（最新）

### 3.1 Change

```ts
type Change = {
  trace: {
    commandId: string
    source: CommandSource
  }
  readHints: ReadInvalidation
}
```

不再包含：`revision`、`kind`、`operations`、`impact` 等顶层冗余字段。

### 3.2 ReadInvalidation

```ts
type ReadInvalidation = {
  index: {
    rebuild: 'none' | 'dirty' | 'full'
    dirtyNodeIds: readonly NodeId[]
  }
  edge: {
    rebuild: 'none' | 'dirty' | 'full'
    dirtyNodeIds: readonly NodeId[]
    dirtyEdgeIds: readonly EdgeId[]
  }
}
```

要点：

1. 只保留 read stage 真正执行所需数据。
2. 不暴露 `append/clear/reset` 这类命令式内部动作。
3. `createReadInvalidation` 基于 `MutationImpact` 一次生成完整 stage plan。

---

## 4. Reactions 链路（最新）

核心文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`
3. `packages/whiteboard-engine/src/instance/reactions/ReactionTaskQueue.ts`
4. `packages/whiteboard-engine/src/instance/reactions/registry.ts`

### 4.1 模块协议

```ts
{
  topic: string
  seed?: () => void
  ingest: (change: Change) => void
  flush: () => WriteInput | null
}
```

### 4.2 调度流程

1. 启动：`seed()` 后 enqueue topic。
2. `changeBus` 事件到达：
   - `readRuntime.applyInvalidation(change.readHints)`
   - `registry.ingest(change, enqueueTopic)`
3. `ReactionTaskQueue` 在 microtask 阶段按 topic 去重 flush。
4. `registry.flush(topic)` 获取 payload，有值才回流 `writeRuntime.apply(source='system')`。

---

## 5. 读链路（直通版）

核心文件：

1. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
2. `packages/whiteboard-engine/src/runtime/read/stages/index/stage.ts`
3. `packages/whiteboard-engine/src/runtime/read/stages/edge/cache.ts`
4. `packages/whiteboard-engine/src/runtime/read/api/read.ts`
5. `packages/whiteboard-engine/src/runtime/read/api/query.ts`

流程：

1. `ReadKernel.applyInvalidation(hints)` 只做两件事：
   - `indexes.applyPlan(hints.index)`
   - `edgeStage.applyPlan(hints.edge)`
2. read stage 内通过 `context.state.xxx()` 与 `context.snapshot()` 直读，无 `get(key)` 反查。
3. index 与 edge stage 都按 `rebuild` 解释：
   - `full`：全量重建
   - `dirty`：增量脏集刷新
   - `none`：跳过

---

## 6. 文档替换与 docId 切换

1. 外部注入新 doc：`instance.commands.doc.reset(doc)`。
2. writer 进入 `commitReplace`：
   - 若 `doc.id` 变化，history 清空
   - `document.set(doc)`
   - 同步 revision + viewport
   - 发布 full readHints（`FULL_MUTATION_IMPACT`）
3. reactions 统一驱动 read 刷新与系统副作用。

---

## 7. 时序图

### 7.1 普通写入

```text
UI/Host
  -> instance.commands.*
  -> writeRuntime.apply
  -> planner
  -> writer.commitApply
  -> core.reduce
  -> document.set + document.notifyChange + revision++ + viewport sync
  -> changeBus.publish(Change{trace, readHints})
  -> reactions: applyInvalidation + ingest + enqueue(topic)
  -> microtask flush(topic)
  -> module.flush -> writeRuntime.apply(source='system')
```

### 7.2 reset / 文档替换

```text
Host -> commands.doc.reset(doc)
  -> writer.commitReplace
  -> (doc.id changed) history.clear
  -> document.set + revision++ + viewport sync
  -> changeBus.publish(Change{trace, readHints(full)})
  -> reactions/read 同步更新
```

---

## 8. 仍可继续优化（可选）

1. `Autofit` 的 group 增量计算仍集中在单文件，可继续拆成 `indexes / plan / patch` 三段纯函数以降低心智密度。
2. `selection` domain 的 `group/ungroup/delete` 可继续评估抽 shared operation builder，与 `duplicate` 风格保持一致。
