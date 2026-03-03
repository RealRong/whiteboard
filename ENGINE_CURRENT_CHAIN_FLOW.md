# Engine 当前链路总览（CQRS + 漏斗）

> 更新日期：2026-03-03  
> 范围：`packages/whiteboard-engine` 最新实现（含“二次收敛”落地）。

## 1. 总体结论

当前 engine 已收敛为单主链，核心特征如下：

1. 写入口唯一：`instance.commands.* -> commands.write.apply`。
2. plan 唯一来源：只在 write planner 生成，read 不再推导业务 plan。
3. change 轻量化：`Change` 仅保留 `revision/kind/trace/readHints`。
4. read 完全 hints 驱动：读侧只执行 `index` 与 `edge` 两类 plan。
5. 系统反应统一回流：`Measure/Autofit` 都通过 `write.apply(source='system')` 写入。
6. 开关清零：`commandGatewayEnabled` 已删除，网关路径固定启用。

最终链路：

`Commands -> Write.Apply -> CommandGateway -> Planner -> Writer.commitTransaction -> CoreReduce -> ChangeBus(Change{trace+readHints}) -> Reactions -> ReadKernel(index+edge)`

## 2. 启动与装配链路

入口文件：`packages/whiteboard-engine/src/instance/engine.ts`

当前装配顺序：

1. 创建 `runtimeStore/scheduler/config/registries`。
2. 初始化 state atoms（包含 `document/readModelRevision`）。
3. 直接以 `stateAtoms.document` 实现 `document.get/replace`（文档单源）。
4. 创建 `snapshotAtom`、`ViewportRuntime`、`readRuntime`。
5. 组装最小 `baseInstance`（给 write runtime 使用），其中 `runtime` 仅暴露 `store`。
6. 创建 `writeRuntime`，再创建 `reactions` 和 `commands`。
7. 绑定 `shortcuts`（依赖降级为 `state + runAction`）。
8. 在 `engine.ts` 内联创建最终 `runtime.applyConfig/runtime.dispose`。

装配简化点：

1. 无 `commands: null` 占位。
2. 无 `runtime.applyConfig/dispose` placeholder cast。
3. 无 `runtimePort` facade 中间层。

## 3. 写链路（唯一漏斗）

核心文件：

1. `packages/whiteboard-engine/src/runtime/write/runtime.ts`
2. `packages/whiteboard-engine/src/runtime/write/api.ts`
3. `packages/whiteboard-engine/src/runtime/command/gateway.ts`
4. `packages/whiteboard-engine/src/runtime/write/plan/*`
5. `packages/whiteboard-engine/src/runtime/write/writer.ts`

### 3.1 写入口统一

`node/edge/viewport/mindmap/selection/shortcut` 等 facade 最终都落到 `write.apply(payload)`。

### 3.2 网关固定启用（无 feature flag）

`write.apply` 固定执行：

1. 生成或继承 `commandId`。
2. 构造 `write.apply` 命令 envelope（含 trace meta）。
3. 调用 `gateway.dispatch`。
4. 返回标准 `DispatchResult`；协议异常返回 `invalid`，不再回退第二写路径。

### 3.3 planner 只在写侧生成唯一 plan

`plan(payload)` 按 domain 路由，输出统一 `Draft`：

1. 成功：`{ ok: true, operations, value? }`
2. 失败：`{ ok: false, reason, message }`

这就是“B 方案：write 生成唯一 plan + readHints”的 plan 来源。

### 3.4 writer 单事务提交

`Writer` 通过 `commitTransaction` 统一处理：

1. `kind='apply'`：`reduceOperations` -> `document.replace` -> bump revision/viewport -> publish change -> capture history。
2. `kind='replace'`：静默替换文档 -> bump revision/viewport -> publish change -> 返回 reset 结果。

`applyDraft/resetDoc/undo/redo` 都最终复用同一事务提交路径。

## 4. Core Reduce 链路

核心文件：

1. `packages/whiteboard-core/src/kernel/reduce.ts`
2. `packages/whiteboard-core/src/kernel/normalize.ts`
3. `packages/whiteboard-core/src/kernel/inversion/index.ts`
4. `packages/whiteboard-core/src/kernel/internal.ts`

执行过程：

1. `normalizeOperations` 先补足 `before` 等逆操作信息。
2. `core.apply.operations` 执行标准化后的操作。
3. `invertOperations` 生成 inverse。
4. 返回 `{ doc, changes, inverse }` 给 writer。

关键约束：

1. kernel 复用 `reusableKernelCore` 降低抖动。
2. kernel history 在该路径关闭，避免双 history。

## 5. Change 与 ReadHints 协议（最终形态）

核心文件：

1. `packages/whiteboard-engine/src/types/write/change.ts`
2. `packages/whiteboard-engine/src/types/read/invalidation.ts`
3. `packages/whiteboard-engine/src/runtime/write/readHints.ts`

### 5.1 Change（轻载荷）

```ts
type Change = {
  revision: number
  kind: 'apply' | 'replace'
  trace: {
    commandId: string
    correlationId: string
    transactionId?: string
    causationId?: string
    source: CommandSource
  }
  readHints: ReadInvalidation
}
```

不再透传 `origin/operations/impact/docBefore/docAfter`，写读边界只保留读侧真正需要的信号。

### 5.2 ReadInvalidation（stage-ready）

`ReadInvalidation` 包含：

1. `mode`
2. `reasons`
3. `revision: { from, to }`
4. `dirtyNodeIds`
5. `dirtyEdgeIds`
6. `index: { mode, dirtyNodeIds }`
7. `edge: { resetVisibleEdges, clearPendingDirtyNodeIds, appendDirtyNodeIds, appendDirtyEdgeIds }`

`createReadInvalidation` 在写侧一次生成完整 hints，读侧直接消费，不再二次映射。

## 6. 读链路（Hints 直接执行）

核心文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
3. `packages/whiteboard-engine/src/runtime/read/stages/index/*`
4. `packages/whiteboard-engine/src/runtime/read/stages/edge/*`

执行顺序：

1. `changeBus` 广播 `Change`。
2. `Reactions` 直接把 `change.readHints` 传给 `readRuntime.applyInvalidation`。
3. `readRuntime` 只做两件事：`indexes.applyPlan(hints.index)`、`edgeStage.applyPlan(hints.edge)`。
4. 查询层通过 `query/read` 对外提供一致的读结果。

读侧不再存在 `orchestrator/planner/invalidationAdapter` 中间层。

## 7. Reactions 回流链路

核心文件：

1. `packages/whiteboard-engine/src/instance/reactions/Measure.ts`
2. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`
3. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`

行为：

1. `Measure` 收集尺寸后下发 `node.update`（`source='system'`）。
2. `Autofit` 监听 `change.readHints`（不再读 `impact`），筛选 relevant change 后下发 `node.update`。
3. 二者都回到统一写链路，保持 trace/history/read 同步一致。

## 8. History 链路

核心文件：`packages/whiteboard-engine/src/runtime/write/history.ts`

1. 写成功后 `capture(forward, inverse, origin, timestamp)`。
2. `undo/redo` 通过 `applyHistoryOperations` 回放到 `commitTransaction(kind='apply')`。
3. 因为走同一 writer 事务路径，读侧同步行为与普通写入一致。

## 9. 配置与开关现状

核心文件：

1. `packages/whiteboard-engine/src/types/instance/config.ts`
2. `packages/whiteboard-engine/src/config/defaults.ts`
3. `packages/whiteboard-engine/src/config/index.ts`

当前结论：

1. `InstanceConfig.features` 已删除。
2. `commandGatewayEnabled` 已删除。
3. 写链路行为不再依赖 feature flag 分支。

## 10. 时序图（最终）

### 10.1 普通写入

```text
UI/Host
  -> instance.commands.* / write.apply
  -> CommandGateway.dispatch(write.apply)
  -> write planner (domain -> operations)
  -> Writer.commitTransaction(kind='apply')
  -> core.reduce(normalize -> apply -> invert)
  -> document.replace + readModelRevision++
  -> changeBus.publish(Change{trace, readHints})
  -> Reactions.applyInvalidation(change.readHints)
  -> index.applyPlan + edge.applyPlan
  -> query/read 可见新状态
```

### 10.2 Undo/Redo

```text
instance.commands.history.undo/redo
  -> History.undo/redo
  -> Writer.applyHistoryOperations(forward/inverse)
  -> Writer.commitTransaction(kind='apply')
  -> changeBus.publish(Change{trace, readHints})
  -> Reactions -> ReadKernel
```

## 11. 已完成的二次收敛点

1. ChangeBus 轻载荷化（只发 `Change + readHints`）。
2. Autofit 从 `impact` 切到 `readHints`。
3. `commandGatewayEnabled` 全面移除。
4. `shortcuts` 依赖降级到 `state`。
5. engine 装配去占位，改为最终对象一次成型。

以上五点已经落地并通过构建验证。
