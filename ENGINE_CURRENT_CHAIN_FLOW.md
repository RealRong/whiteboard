# Engine 当前链路总览（CQRS + 漏斗）

> 更新日期：2026-03-03  
> 目标：说明当前 `engine` 的真实执行链路，明确“write 生成唯一 plan + readHints 驱动读侧”的落地状态。

## 1. 总体结论

当前 engine 已经收敛为一条主链：

1. 写侧只有一个主入口：`commands.* -> commands.write.apply`。
2. 写侧只做一件事：把业务命令规划为 `operations` 并提交到 core reduce。
3. 读侧不再推导业务命令，只消费 write 产生的 change/invalidation hints。
4. 系统反应（Measure/Autofit）也走同一写入口，不再旁路 mutate。
5. history 以 engine 写侧为主；core kernel 内部 history 在该路径下关闭。

简化表达：

`Commands -> Write Apply -> CommandGateway -> Planner -> Writer -> Core Reduce -> ChangeBus(Change+ReadHints) -> Index/Projection`

---

## 2. 启动装配链路

入口文件：`packages/whiteboard-engine/src/instance/engine.ts`

初始化顺序：

1. 创建 `runtimeStore`、`scheduler`、`config`、`registries`。
2. 创建 state atoms（含 `document` 与 `readModelRevision`）。
3. 构建 `instance.document.get/replace`，直接绑定到 `stateAtoms.document`（单文档源）。
4. 创建 `snapshotAtom`（读模型快照）。
5. 创建 `ViewportRuntime`（读写边界已拆分到 `ViewportReadApi/ViewportWriteApi`）。
6. 创建 `readRuntime`（直接 `createReadKernel`）。
7. 创建 `baseInstance`（不含 commands）。
8. 创建 `writeRuntime`。
9. 创建 `reactions`（函数式 wiring，创建即完成 changeBus 订阅）。
10. 创建 `commands`，组装最终 `instance`。
11. 绑定 `shortcuts`，在 `engine.ts` 内联装配 `runtime.applyConfig/runtime.dispose`。

对外暴露面：

1. `state`
2. `runtime`
3. `query`
4. `read`
5. `commands`

不对外暴露 `mutate`，确保写入口收口。

---

## 3. 写链路（唯一漏斗）

核心文件：

1. `packages/whiteboard-engine/src/runtime/write/runtime.ts`
2. `packages/whiteboard-engine/src/runtime/write/api.ts`
3. `packages/whiteboard-engine/src/runtime/command/gateway.ts`
4. `packages/whiteboard-engine/src/runtime/write/plan/*`
5. `packages/whiteboard-engine/src/runtime/write/writer.ts`

### 3.1 Facade 到写入口

外部调用 `instance.commands.node/edge/viewport/mindmap/...`，最终都落到统一 `apply(payload)`。

### 3.2 Gateway 包装（默认开启）

`write.apply` 默认会：

1. 生成/继承 `commandId`。
2. 封装 `CommandEnvelope`（`type`, `payload`, `meta`）。
3. 通过 `gateway.dispatch` 进入执行。

`CommandMeta` 包含：

1. `source`
2. `correlationId`
3. `transactionId`
4. `causationId`
5. `timestamp`

当前 `write.apply` 的协议异常不会再回退执行第二条写路径，而是直接返回 `invalid` 错误，避免重复提交风险。

### 3.3 Planner 只在写侧生成 plan

`plan(payload)` 根据 domain 路由到：

1. `plan/node.ts`
2. `plan/edge.ts`
3. `plan/viewport.ts`
4. `plan/mindmap.ts`

输出统一 `Draft`：

1. 成功：`{ ok: true, operations, value? }`
2. 失败：`{ ok: false, reason, message }`

这就是当前“唯一 plan”的来源：write planner。  
读侧不负责推导业务 plan。

### 3.4 Writer 提交

`writer.applyDraft` 执行：

1. `draft -> operations`
2. `commitOperations(operations, source, trace)`
3. `commitTransaction(kind='apply')`

`commitTransaction` 内部顺序：

1. `reduceOperations(docBefore, operations, context)`
2. `instance.document.replace(reduced.doc)`
3. 同步 `readModelRevision + 1`、`viewport`
4. 生成 `readHints` 并发布 `changeBus.publish(change)`
5. 回写 history capture（forward/inverse）

---

## 4. Core reduce 链路

核心文件：

1. `packages/whiteboard-core/src/kernel/reduce.ts`
2. `packages/whiteboard-core/src/kernel/normalize.ts`
3. `packages/whiteboard-core/src/kernel/inversion/index.ts`
4. `packages/whiteboard-core/src/kernel/internal.ts`

执行顺序：

1. `normalizeOperations(document, operations)`：
   1. 自动补全 `before`（node/edge update/delete、order、mindmap、viewport 等）。
   2. 让逆操作生成稳定。
2. `core.apply.operations(normalizedOperations)`。
3. `invertOperations(applied.changes.operations)` 生成 inverse。
4. 返回 `{ doc, changes, inverse }` 给 writer。

注意点：

1. kernel 复用 `reusableKernelCore` 以减少对象抖动。
2. kernel 在该路径显式 `history.configure({ enabled: false })`，避免双历史系统。

---

## 5. Change Envelope 与追踪

核心文件：

1. `packages/whiteboard-engine/src/types/write/change.ts`
2. `packages/whiteboard-engine/src/runtime/write/writer.ts`

发布到 `changeBus` 的 change 含：

1. `revision`
2. `kind` (`apply` | `replace`)
3. `origin`
4. `trace` (`commandId/correlationId/transactionId/causationId/source`)
5. `readHints`（stage-ready）
6. `operations`
7. `impact`（tags + dirty ids）
8. `docBefore/docAfter`

这层 envelope 是写读之间的语义桥梁。

---

## 6. 读链路（ReadHints 驱动）

核心文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/runtime/write/readHints.ts`
3. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
4. `packages/whiteboard-engine/src/runtime/read/stages/index/*`
5. `packages/whiteboard-engine/src/runtime/read/stages/edge/*`

### 6.1 Change -> ReadInvalidation

Reactions 订阅 write 的 `changeBus`：

1. 直接消费 `change.readHints`。
2. 不再保留 `applyChange(change)` 兼容桥接，也不再存在 read-side adapter。

`ReadInvalidation` 包含：

1. `mode`
2. `reasons`
3. `revision: { from, to }`
4. `dirtyNodeIds/dirtyEdgeIds`
5. `index`（可直接应用）
6. `edge`（可直接应用）

### 6.2 Read kernel 直接执行

read kernel 直接执行：

1. `indexes.applyPlan(...)`
2. `edgeStage.applyPlan(...)`

### 6.3 Index 与 Projection

`NodeRectIndex`：

1. 维护 node rect/aabb/rotation 缓存
2. 支持 full 与 dirty ids 增量更新

`SnapIndex`：

1. 维护吸附候选和网格 bucket
2. 支持 full 与 dirty ids 增量更新

`Edge cache`：

1. 根据 visible edges + dirty nodes/edges 增量重建路径
2. 结构与几何均未变化时复用缓存

### 6.4 对外读 API

1. `query` 提供高性能读（doc/viewport/index/geometry）。
2. `read.get` 返回 readonly 克隆，保护读边界。

---

## 7. Reactions 回流链路

核心文件：

1. `packages/whiteboard-engine/src/instance/reactions/Measure.ts`
2. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`

### 7.1 Measure

1. 收集 host 上报尺寸（frame task 批量）。
2. 生成 `node.update(size)` command。
3. `source: 'system'` 走统一 `write.apply`。

### 7.2 Autofit

1. 监听 changeBus，筛选与 group 布局相关的变更。
2. 生成 group rect 调整操作。
3. 同样走 `write.apply(source: 'system')`。

结果：系统行为与用户行为同链路、同 trace、同 history、同读侧 hints 协议。

---

## 8. History 链路

核心文件：`packages/whiteboard-engine/src/runtime/write/history.ts`

1. Writer 成功提交后 `capture(forward, inverse, origin, timestamp)`。
2. `undo`：取 `inverse` -> `applyHistoryOperations` -> 回放写链路。
3. `redo`：取 `forward` -> `applyHistoryOperations` -> 回放写链路。
4. `captureSystem/captureRemote` 由配置控制。

因为 undo/redo 也走 `commitTransaction`，所以读侧同步行为与普通写完全一致。

---

## 9. Feature Flags（当前默认）

配置文件：`packages/whiteboard-engine/src/config/defaults.ts`

默认值：

1. `commandGatewayEnabled: true`

当前仅保留一个仍参与行为分支的 feature flag：

1. `commandGatewayEnabled`

---

## 10. 时序图

### 10.1 普通写入

```text
UI/Host
  -> instance.commands.* / write.apply
  -> runtime.write.api.apply
  -> CommandGateway.dispatch
  -> write planner (domain -> operations)
  -> Writer.applyDraft / commitOperations / commitTransaction
  -> core.reduce (normalize -> apply -> invert)
  -> commit document + bump readModelRevision
  -> changeBus.publish(ChangeEnvelope + ReadHints)
  -> Reactions
  -> applyInvalidation(change.readHints)
  -> index.applyPlan + edge.applyPlan
  -> query/read 对外可见
```

### 10.2 Undo/Redo

```text
instance.commands.history.undo/redo
  -> History.undo/redo
  -> Writer.applyHistoryOperations(forward/inverse)
  -> Writer.commitTransaction(kind='apply')
  -> core.reduce
  -> changeBus.publish
  -> Reactions -> ReadHints -> ReadStages
```

---

## 11. 当前链路的设计边界

1. 写侧只负责命令到 mutation plan，不承担读模型维护。
2. 读侧只负责消费 invalidation hints，不反推写命令语义。
3. 任意来源写入（ui/system/remote/import/shortcut）最终统一成同一 envelope。
4. 旁路写入口已收口，便于审计、观测、回放和一致性验证。

这也是当前引擎“可继续拉直”的基础：继续把 read hints 结构漏斗化、把 stage contract 进一步最小化即可。
