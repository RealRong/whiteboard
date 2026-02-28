# Whiteboard 一步到位重构总方案（零兼容、零双轨）

更新时间：2026-02-27  
策略：No-Compatibility / One-Shot / Single-Pipeline

---

## 当前落地状态（2026-02-27，已完成）

已在代码中完成以下硬切改造：

1. `ProjectionStore` 主流程已移除：`instance.projection` 从 `Instance/InternalInstance` 消失。
2. 写入边界改为 `documentAtom + mutationMetaBus`：
   1. `MutationExecutor` 在 apply/reset 后直接 `store.set(documentAtom)`。
   2. 同步 bump `readModelRevision`，再发布 `MutationMeta`。
3. `query/read` 不再消费 `projectionCommit`：
   1. `QueryIndexRuntime` 改为 `applyMutation(meta)`。
   2. `ReadRuntime` 改为 `applyMutation(meta)`，内部 materialized 缓存按 meta 增量失效。
4. `runtime/projection/*` 旧目录已删除，不再存在 `projection.commit -> subscriber` 二级管线。
5. `types/readSnapshot.ts` 收敛为 `ReadModelSnapshot` 结构类型，不再暴露 `ProjectionStore/Commit` 契约。

校验状态：

1. `pnpm --filter @whiteboard/engine lint` 通过。
2. `pnpm --filter @whiteboard/engine build` 通过。
3. `pnpm --filter @whiteboard/react lint` 通过。
4. `pnpm --filter @whiteboard/react build` 通过。

---

## 1. 最终决策（不可回退）

本次重构采用以下硬性决策：

1. 不保留兼容层，不做 feature flag，不保留旧接口兜底。
2. 不保留第二套读管线，不允许旧 `projection.commit -> read` 与新管线并存。
3. 写入仍保持单入口：`instance.commands`。
4. 读取统一到 Jotai：`instance.runtime.store + instance.read.atoms/get`。
5. 增量索引/物化模型使用“写入边界元信息通道”，不放到旧 projection 事件层，不放 event-only atom。

适用前提：

1. 当前无外部用户依赖旧 API。
2. 允许破坏性 API 变更。

---

## 2. 目标架构（最终形态）

## 2.1 真值与职责分层

1. 业务真值：`documentAtom`（文档持久状态）。
2. 交互真值：`stateAtoms`（`interaction/tool/selection/viewport/mindmapLayout`）。
3. 读侧派生：`readModel derived atoms`（从 `documentAtom` 派生 `visible/canvas/indexes`）。
4. 高频查询结构：`Query Index`（可变索引，仅供 getter 热路径）。
5. 渲染物化结构：`Materialized Model`（edgePath/mindmap view 等）。

约束：

1. Query Index / Materialized 不是业务真值，可由 `documentAtom + mutationMeta` 重建。
2. `viewport` 单真值为 `stateAtoms.viewport`，`document.viewport` 是提交后持久化快照。

## 2.2 单一管线

```text
commands
 -> reduceOperations(docBefore, operations)
 -> docAfter + inverse + impact
 -> store.set(documentAtom, docAfter)
 -> store.set(stateAtoms.viewport, docAfter.viewport?)  // 同步持久化 viewport
 -> mutationMetaBus.publish(meta)
 -> queryIndex/materialized apply(meta)
 -> store.set(queryIndexRevision/materializedRevision)  // 仅当可变缓存更新
 -> React/useAtomValue 自动更新
```

说明：

1. `mutationMetaBus` 是内部同步 dispatcher，位于写入边界，不是公开事件系统。
2. derived atoms 不消费“事件”，只消费状态（document/state/revision）。

---

## 3. Operation 与 Impact 稳定语义（必须先固化）

权威位置（单一来源）：

1. `packages/whiteboard-engine/src/runtime/mutation/Analyzer.ts`
2. `packages/whiteboard-engine/src/runtime/mutation/Impact.ts`
3. `packages/whiteboard-engine/src/runtime/mutation/PatchClassifier.ts`

说明：

1. 当前已经有可用组件，不需要新建第二套语义层。
2. 后续如需补充 operation 语义或 patch 分类，必须只在上述目录内扩展。
3. 禁止在 domain/runtime/read 侧分散补 `if-else` 规则。

## 3.1 Canonical Operations

1. `node.create/update/delete/order.*`
2. `edge.create/update/delete/order.*`
3. `viewport.update`
4. `mindmap.*`（内部可继续保留语义操作，但必须统一落到 Analyzer 映射）

## 3.2 Patch 分类器

必须在一处维护并用于 impact 分析：

1. `classifyNodePatch(patch)`
2. `classifyEdgePatch(patch)`

输出至少包含：

1. `affectsGeometry`
2. `affectsOrder`
3. `affectsStructure`
4. `affectsStyleOnly`

## 3.3 Impact 合约

1. tags：`full|nodes|edges|order|geometry|mindmap|viewport`
2. `dirtyNodeIds`
3. `dirtyEdgeIds`

原则：

1. 可过估，不可漏估。
2. 未覆盖 operation 一律降级 `full`。

---

## 4. Mutation Meta 通道设计（放在写入边界）

## 4.1 位置

新增：`packages/whiteboard-engine/src/runtime/write/MutationMetaBus.ts`

接口：

```ts
type MutationMeta = {
  revision: number
  origin: 'user' | 'system' | 'remote'
  kind: 'apply' | 'replace'
  operations: Operation[]
  impact: MutationImpact
  docBefore: Document
  docAfter: Document
}

type MutationMetaBus = {
  publish: (meta: MutationMeta) => void
  subscribe: (listener: (meta: MutationMeta) => void) => () => void
}
```

## 4.2 发布时机（严格顺序）

在 `MutationExecutor.applyOperations/resetDocument` 中：

1. 先 `store.set(documentAtom, docAfter)`。
2. 再 `store.set(stateAtoms.viewport, docAfter.viewport)`（如存在变化）。
3. 再 `mutationMetaBus.publish(meta)`。

理由：

1. 订阅者处理 `meta` 时可同步读到最新 `documentAtom`。
2. 避免“元信息先到、状态未更新”的读写撕裂。

## 4.3 为什么不用 atom 承载元信息

1. 元信息是事件语义（一次性），不是持久状态语义。
2. 用 atom 承载事件会制造无意义版本 bump 与订阅扩散。
3. 最简单、可控、同步的方案就是内部总线函数调用。

---

## 5. Projection 改造：从 Projector+Cache 到 Derived Atoms

## 5.1 目标

删除 `runtime/projection/cache/*` 与 projector 组装层，改为 atom 图表达派生关系。

## 5.2 Root Atoms

1. `documentAtom`（写入后直接 set）
2. `stateAtoms.*`
3. `queryIndexRevisionAtom`（可变索引桥）
4. `materializedRevisionAtom`（可变物化桥）

## 5.3 Projection Derived Atoms（最小集合）

1. `orderedNodesAtom`：`document.nodes + order.nodes`
2. `visibleNodesAtom`：`deriveVisibleNodes(orderedNodes)`
3. `canvasNodesAtom`：`deriveCanvasNodes(visibleNodes)`
4. `visibleEdgesAtom`：`document.edges + order.edges + canvasNodeIds`
5. `mindmapRootsAtom`：`visibleNodes -> mindmap roots`
6. `canvasNodeByIdAtom`：`canvasNodes -> Map`
7. `visibleNodeIndexByIdAtom`：`visibleNodes -> Map`
8. `canvasNodeIndexByIdAtom`：`canvasNodes -> Map`

## 5.4 引用稳定策略（必须实现）

纯 derived atom 不是性能问题，错误的引用策略才是问题。要求：

1. 若输入引用未变且内容等价，返回上次缓存引用。
2. 对 `Node[]/Edge[]/Map` 使用 memo selector（按输入 refs + 关键签名）。
3. 禁止每次无脑 new `Map` / new `Array`。

---

## 6. Query Index 与 Materialized Model（继续增量，不变成真值）

## 6.1 Query Index

位置：`runtime/read/indexes/*`

策略：

1. 订阅 `mutationMetaBus`。
2. 按 `impact` 执行 `sync/syncByNodeIds/syncByEdgeIds`。
3. 更新后 bump `queryIndexRevisionAtom`（仅当索引实际变化）。

## 6.2 Materialized Model

位置：`runtime/read/materialized/*`

策略：

1. 订阅 `mutationMetaBus`。
2. edgePath 等可变缓存按 `impact` 增量维护。
3. 更新后 bump `materializedRevisionAtom`。

## 6.3 React/Read 侧消费

1. 纯 doc 派生状态：直接依赖 readModel derived atoms。
2. 可变缓存结果：通过 `revisionAtom + getter` 派生读取。

---

## 7. Instance API 终态（破坏性变更）

## 7.1 删除

1. `instance.projection`
2. `types/readSnapshot.ts` 中 `ProjectionStore/ProjectionCommit` 对外契约
3. 所有 `projection.subscribe` 内部桥接

## 7.2 保留并强化

1. `instance.commands`：唯一写入口
2. `instance.runtime.store`：唯一响应式 store 锚点
3. `instance.read.atoms/get`：唯一读侧响应式入口
4. `instance.query`：高频纯 getter 入口

## 7.3 内部运行时新增

1. `instance.runtime.mutationMetaBus`（可标记为 internal）
2. `instance.runtime.models.queryIndex`
3. `instance.runtime.models.materialized`

---

## 8. 代码级落地清单（删除 / 新增 / 修改）

## 8.1 删除（必须）

1. `packages/whiteboard-engine/src/runtime/projection/Store.ts`
2. `packages/whiteboard-engine/src/runtime/projection/cache/*`
3. `packages/whiteboard-engine/src/runtime/projection/projectors/*`
4. `packages/whiteboard-engine/src/types/readSnapshot.ts`（收敛为读模型结构类型）
5. 所有 `instance.projection.*` 调用点

## 8.2 新增（必须）

1. `packages/whiteboard-engine/src/runtime/write/MutationMetaBus.ts`
2. `packages/whiteboard-engine/src/runtime/read/atoms/document.ts`
3. `packages/whiteboard-engine/src/runtime/read/atoms/readModel.ts`
4. `packages/whiteboard-engine/src/runtime/read/atoms/revisions.ts`
5. `packages/whiteboard-engine/src/runtime/read/selectors/*`（引用稳定工具）

## 8.3 重点修改（必须）

1. `packages/whiteboard-engine/src/runtime/write/MutationExecutor.ts`
2. `packages/whiteboard-engine/src/instance/create.ts`
3. `packages/whiteboard-engine/src/runtime/read/Runtime.ts`
4. `packages/whiteboard-engine/src/runtime/read/api/Runtime.ts`
5. `packages/whiteboard-engine/src/runtime/read/indexes/QueryIndexRuntime.ts`
6. `packages/whiteboard-engine/src/runtime/actors/groupAutoFit/Actor.ts`
7. `packages/whiteboard-engine/src/domains/*/commands.ts` 中 `projection` 读取点

---

## 9. 一步到位实施顺序（单分支直切）

## 阶段 A：先建新骨架（不保留旧实现）

1. 建立 `documentAtom + readModel derived atoms + revision atoms`。
2. 建立 `MutationMetaBus` 并接入 `MutationExecutor`。
3. `createEngine` 改为装配 `runtime.store + mutationMetaBus + readRuntime`。

验收：

1. 无 `ProjectionStore` 引用残留。
2. `instance.projection` 从类型与实现完全消失。

## 阶段 B：迁移增量子系统

1. `QueryIndexRuntime` 改为订阅 `mutationMetaBus`。
2. `MaterializedModel` 改为订阅 `mutationMetaBus`。
3. 用 `revision atoms` 驱动 read 派生层。

验收：

1. `QueryIndex/Materialized` 不再订阅 projection commit。

## 阶段 C：清理调用点与死代码

1. 替换所有 `instance.projection.getSnapshot()` 调用。
2. 删除 `runtime/projection/*` 目录。
3. 更新导出类型与文档。

验收：

1. `rg \"projection\\.|ProjectionStore|ProjectionCommit\" packages/whiteboard-engine/src` 无残留（类型迁移后除外）。

---

## 10. 验收标准（必须全部满足）

1. `commands -> mutation -> documentAtom + mutationMetaBus -> read/query` 为唯一链路。
2. 不存在第二套订阅系统（projection commit / 旧桥接）。
3. `viewport` 仍为单真值 atom。
4. `pnpm --filter @whiteboard/engine lint` 通过。
5. `pnpm --filter @whiteboard/react lint` 通过。
6. `pnpm -r build` 通过。
7. 手工回归通过：
   - 节点拖拽、缩放、框选、分组、撤销重做
   - 边连接/改线/控制点
   - mindmap 编辑与布局

---

## 11. 禁止事项（本方案执行期）

1. 禁止新增兼容层（adapter/fallback/双轨 if）。
2. 禁止保留 `projection` 旧类“先不删”。
3. 禁止把 `MutationMeta` 事件状态化为 atom 链式中转。
4. 禁止在 React 组件里重建全局索引或全局路径缓存。

---

## 12. 最终结论

最优一步到位方案是：

1. Projection 结构改为 `documentAtom` 的 derived atoms（替代 projector+cache 类层）。
2. 增量能力由写入边界 `MutationMetaBus` 提供（替代 projection commit 事件层）。
3. Query Index / Materialized 继续命令式增量维护，但只作为 runtime 可重建结构。
4. 全系统只保留一条写管线和一条读管线，无兼容、无双轨。
