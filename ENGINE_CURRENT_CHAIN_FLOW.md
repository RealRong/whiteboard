# Engine 当前链路总览（CQRS + 漏斗）

> 更新日期：2026-03-05  
> 范围：`packages/whiteboard-engine` 最新实现（含“二次收敛”落地）。

## 1. 总体结论

当前 engine 已收敛为单主链，核心特征如下：

1. 写入口唯一：外部仅 `instance.commands.*` 语义命令；内部统一汇聚到 `writeRuntime.apply` 原语。
2. plan 唯一来源：只在 write planner 生成，read 不再推导业务 plan。
3. change 轻量化：`Change` 仅保留 `revision/kind/trace/readHints`。
4. read 完全 hints 驱动：读侧只执行 `index` 与 `edge` 两类 plan。
5. 系统反应统一回流：`Autofit` 通过 `writeRuntime.apply(source='system')` 写入；UI 测量直接走 `commands.node.updateMany(source='system')`。
6. 开关清零：`commandGatewayEnabled` 已删除，写链路为 `apply -> planner -> writer`。
7. 文档切换收敛：`runtime.applyConfig` 不再承载 `docId` 语义，文档替换只走 `commands.doc.reset` 写路径。
8. 命令面纯语义：`writeRuntime.commands` 不再包含 `write`，内部原语统一为 `writeRuntime.apply`。
9. 顶层重复命名空间已删除：`commands.order` / `commands.group` 并入 `commands.node.*` 与 `commands.edge.*`。
10. edge routing 对外语义已收敛：调用方只传 `edgeId + index/point`，不再传 `Edge/pathPoints` 中间态。

最终链路：

`Commands(semantic) -> WriteRuntime.apply -> Planner -> Writer(TraceNormalize+CommitTransaction) -> CoreReduce -> ChangeBus(Change{trace+readHints}) -> Reactions -> ReadKernel(index+edge)`

## 2. 启动与装配链路

入口文件：`packages/whiteboard-engine/src/instance/engine.ts`

当前装配顺序：

1. 创建 `runtimeStore/scheduler/config/registries`。
2. 初始化 state atoms（包含 `document/readModelRevision`）。
3. 直接以 `stateAtoms.document` 实现 `document.get/replace`（文档单源）。
4. 创建 `snapshotAtom`、`ViewportRuntime`、`readRuntime`。
5. 组装最小 `baseInstance`（给 write runtime 使用），其中 `runtime` 仅暴露 `store`。
6. 创建 `writeRuntime`（`commands` + `apply`），再创建 `reactions` 和 `commands`。
7. 绑定 `shortcuts`（依赖降级为 `state + runAction`）。
8. 在 `engine.ts` 内联创建最终 `runtime.applyConfig/runtime.dispose`。

装配简化点：

1. 无 `commands: null` 占位。
2. 无 `runtime.applyConfig/dispose` placeholder cast。
3. 无 `runtimePort` facade 中间层。
4. `runtime.applyConfig` 只处理运行时配置，不再触发文档身份相关逻辑。

## 3. 写链路（唯一漏斗）

核心文件：

1. `packages/whiteboard-engine/src/runtime/write/runtime.ts`
2. `packages/whiteboard-engine/src/runtime/write/execution.ts`
3. `packages/whiteboard-engine/src/runtime/write/commands.ts`
4. `packages/whiteboard-engine/src/runtime/write/api/*`
5. `packages/whiteboard-engine/src/runtime/write/stages/plan/*`
6. `packages/whiteboard-engine/src/runtime/write/stages/commit/writer.ts`

### 3.1 写入口统一

`node/edge/viewport/mindmap/selection/shortcut` 等语义 facade 在 runtime 内部最终都落到 `writeRuntime.apply(payload)`。

### 3.2 单入口 apply（无 applyWrite 包装层）

内部 `writeRuntime.apply` 固定执行：

1. 接收 `WriteInput`（domain + command + source + trace）。
2. 调用 `planner(payload)` 生成 `Draft`。
3. 调用 `writer.applyDraft(draft, source, trace)` 提交事务。
4. `source/trace` 的最终归一在 `Writer.normalizeTrace` 完成。

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

补充：

1. `resetDoc` 的 history clear 只在 `doc.id` 发生变化时触发。

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
3. `packages/whiteboard-engine/src/runtime/write/stages/invalidation/readHints.ts`

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
2. `revision: { from, to }`
3. `dirtyNodeIds`
4. `dirtyEdgeIds`
5. `index: { mode, dirtyNodeIds }`
6. `edge: { resetVisibleEdges, clearPendingDirtyNodeIds, appendDirtyNodeIds, appendDirtyEdgeIds }`

`createReadInvalidation` 在写侧一次生成完整 hints，读侧直接消费，不再二次映射。

## 6. 读链路（Hints 直接执行）

核心文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
3. `packages/whiteboard-engine/src/runtime/read/api/read.ts`
4. `packages/whiteboard-engine/src/runtime/read/api/query.ts`
5. `packages/whiteboard-engine/src/runtime/read/stages/index/*`
6. `packages/whiteboard-engine/src/runtime/read/stages/edge/*`

执行顺序：

1. `changeBus` 广播 `Change`。
2. `Reactions` 直接把 `change.readHints` 传给 `readRuntime.applyInvalidation`。
3. `readRuntime` 只做两件事：`indexes.applyPlan(hints.index)`、`edgeStage.applyPlan(hints.edge)`。
4. 对外读接口保持直通语义：`read.state.*`、`read.projection.*`、`query.*(...)`。

读侧不再存在 `orchestrator/planner/invalidationAdapter` 中间层。

### 6.1 读 API 形态（最终）

1. `read.state`：`interaction/tool/selection/viewport/mindmapLayout`。
2. `read.projection`：`viewportTransform/node/edge/mindmap`。
3. `query`：参数化查询（例如 `edgeEndpointsById(edgeId)`）。
4. `edgeSelectedEndpoints` 不再作为 projection 固定字段，改为 UI 通过 `state.selection + query.edgeEndpointsById` 组合。

### 6.2 read stage 内部收敛

1. `node/edge/mindmap` stage 仅保留聚合视图 getter（`node()`、`edge()`、`mindmap()`）。
2. 删除 `nodeIds/nodeById`、`edgeIds/edgeById`、`mindmapIds/mindmapById` 这类重复转发接口。
3. 内核缓存仍保留，保证热路径读取的对象复用与稳定引用。

## 7. Reactions 回流链路

核心文件：

1. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`
2. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
3. `packages/whiteboard-react/src/node/components/NodeItem.tsx`

行为：

1. `Autofit` 监听 `change.readHints.index`（按 `index.mode/dirtyNodeIds` 执行），不再读取 `impact/kind/reasons`。
2. UI 节点测量在 React 层聚合后直接调用 `commands.node.updateMany`（`source='system'`）。
3. 反应写入与测量写入都回到统一写链路，保持 trace/history/read 同步一致。

## 8. History 链路

核心文件：`packages/whiteboard-engine/src/runtime/write/stages/commit/history.ts`

1. 写成功后 `capture(forward, inverse, origin, timestamp)`。
2. `undo/redo` 通过 `applyHistoryOperations` 回放到 `commitTransaction(kind='apply')`。
3. 因为走同一 writer 事务路径，读侧同步行为与普通写入一致。
4. `commands.doc.reset` 的 replace 路径仅在跨 `doc.id` 时清理 history。

## 9. 配置与开关现状

核心文件：

1. `packages/whiteboard-engine/src/types/instance/config.ts`
2. `packages/whiteboard-engine/src/config/defaults.ts`
3. `packages/whiteboard-engine/src/config/index.ts`

当前结论：

1. `InstanceConfig.features` 已删除。
2. `commandGatewayEnabled` 已删除。
3. `RuntimeConfig.docId` 已删除。
4. 写链路行为不再依赖 feature flag 分支。

## 10. 时序图（最终）

### 10.1 普通写入

```text
UI/Host
  -> instance.commands.* (semantic only)
  -> writeRuntime.apply
  -> write planner (domain -> operations)
  -> Writer.normalizeTrace(source/trace)
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

### 10.3 文档切换 / 外部注入

```text
Host 传入新 doc
  -> Whiteboard 判定是否为引擎回传镜像
  -> 非镜像时执行 instance.commands.doc.reset(doc)
  -> Writer.commitTransaction(kind='replace')
  -> (doc.id changed) history.clear
  -> changeBus.publish(Change{kind='replace', readHints.full})
  -> Reactions -> ReadKernel 全量同步
```

## 11. 已完成的二次收敛点

1. ChangeBus 轻载荷化（只发 `Change + readHints`）。
2. Autofit 从 `impact` 切到 `readHints`。
3. `commandGatewayEnabled` 全面移除。
4. `shortcuts` 依赖降级到 `state`。
5. engine 装配去占位，改为最终对象一次成型。
6. 文档切换改为单路径：`runtime` 去 `docId`，`doc.reset` 承担 replace 语义。
7. React 侧增加镜像识别，避免引擎回传文档触发回声 reset。
8. write runtime 装配拆分为 `createWriteExecution + createWriteCommands`，`runtime.ts` 仅保留“组装 + 返回”。
9. commands facade 去掉纯别名转发，保留必要转换层（`doc/tool/history/host`）。
10. read 对外 API 收敛为属性语义：`read.state` + `read.projection`（去掉 `read.get` 系列）。
11. projection 移除 `edgeSelectedEndpoints`，selected 语义下沉到 UI 组合，engine 仅提供 `query.edgeEndpointsById` 原语。
12. read stage 内部删除重复 getter，聚合为 `node/edge/mindmap` 视图读取。
13. write runtime 命令装配收敛为 `createWriteCommands` 直接组装语义命令（移除 builder 注册表中间层）。
14. selection 写依赖收窄为最小能力面（仅 node/edge 必需方法），runtime 删除桥接映射 helper，直接透传基础命令。
15. `selection/shortcut` 派生命令与基础命令统一在 `commands.ts` 装配，移除 `DerivedCommandSet` 分层样板。
16. write runtime 目录改为 stage-first 布局（`stages/plan`、`stages/commit`、`stages/invalidation`），主链路职责一眼可见。
17. write api 按命令职责拆分为独立命令文件（`node/edge/interaction/selection/mindmap/viewport/shortcut`）。
18. write api 进一步扁平化到 `api/*`，移除 `api/commands` 目录与 `runtime/write/api.ts` 中间层。
19. Operation 与写链路参数收敛为只读契约（`readonly`），把“不可变约定”升级为编译期约束。
20. Public `instance.commands` 移除 `write` 原语入口，仅保留语义命令；`write.apply` 下沉为 runtime 内部能力（供 reactions 等内部模块使用）。
21. `writeRuntime.commands` 移除 `write` 字段，内部原语以 `writeRuntime.apply` 顶层能力提供，消除“语义命令集中的原语混入”。
22. `runtime/write/api/write.ts` 删除，写入口收敛到 `runtime/write/execution.ts`，进一步拉直主链路实现。
23. `CommandEnvelope.meta` 删除，追踪信息统一由写 payload 传入并在 writer 端归一，消除 trace 双来源。
24. `runtime/write/runtime.ts` 继续薄化为纯 compose：执行链路下沉到 `execution.ts`，命令装配下沉到 `commands.ts`。
25. ID 生成统一到 `@whiteboard/core/utils.createId`：删除 engine 本地 `createScopedId/createBatchId` 与 `runtime/write/shared/identifiers.ts`。
26. 删除 `PlanInput/toPlanInput` 类型桥接：planner 直接接收 `WriteInput`，写链路类型桥接层归零。
27. 删除 `runtime/command` gateway 中间层与 `WriteRuntime.gateway`，主链路收敛为 `apply -> planner -> writer`。
28. 删除 `applyWrite` 包装别名，统一 `WriteRuntime` 单入口为 `apply`，消除双入口命名与重复职责。
29. `node/edge` 更新命令收敛为 `updateMany` 原语，`update` 降级为语法糖委托，移除 `updateManyPosition`。
30. 移除 `host.nodeMeasured` 与 reactions 内测量桥接，测量写入改为 UI 直接 `node.updateMany(source='system')`。
31. 删除顶层 `commands.order` / `commands.group`，排序与分组能力收口到 `node.order/node.group/edge.order`。
32. edge routing 收口到 `commands.edge.routing`，并改为 `edgeId` 语义命令；planner 内部解析 segment 与 path 细节。

以上收敛点已经落地并通过构建验证。
