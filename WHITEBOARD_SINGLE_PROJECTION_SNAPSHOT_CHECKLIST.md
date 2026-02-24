# Whiteboard Single Projection Snapshot Checklist

## 当前结论

- 当前状态：已完成（100%）。
- 已经完成“读路径收敛”和“EdgePath 降复杂”的第一阶段。
- `ProjectionCommit` 与 `ProjectionStore(get/apply/replace/subscribe(commit))` 已进入主路径。
- `query/view` 已切换为基于 commit 快照消费。
- 已完成固定 projector pipeline 与一次提交写链，性能回归已验收通过。

## A. ProjectionStore 与模型

- [x] `ProjectionStore.read()` 纯读取，不在读路径重算。  
  路径：`packages/whiteboard-engine/src/runtime/projection/Store.ts`
- [x] `ProjectionStore.subscribe()` 单点发布变化。  
  路径：`packages/whiteboard-engine/src/runtime/projection/Store.ts`
- [x] `dirtyNodeIds` 使用 hint + 实际快照差异合并。  
  路径：`packages/whiteboard-engine/src/runtime/projection/Store.ts`
- [x] 切换到新 `ProjectionSnapshot` 结构（`revision/docId/nodes/edges/mindmap/indexes`）。  
  路径：`packages/whiteboard-engine/src/types/projection.ts`  
  路径：`packages/whiteboard-engine/src/runtime/projection/cache/SnapshotState.ts`
- [x] 引入 `ProjectionCommit`（`snapshot + changed`）并冻结类型。  
  路径：`packages/whiteboard-engine/src/types/projection.ts`
- [x] `ProjectionStore` 切换为 `get/apply/replace/subscribe(commit)` 语义。  
  路径：`packages/whiteboard-engine/src/runtime/projection/Store.ts`

## B. 写入 Pipeline

- [x] 实现固定 projector 阶段：`NodeProjector -> EdgeProjector -> MindmapProjector -> IndexProjector`。  
  路径：`packages/whiteboard-engine/src/runtime/projection/projectors/`
- [x] 写入主链切为：`reduceOperations -> projectors -> commit once`。  
  路径：`packages/whiteboard-engine/src/runtime/write/MutationExecutor.ts`  
  路径：`packages/whiteboard-engine/src/runtime/projection/Store.ts`  
  路径：`packages/whiteboard-engine/src/runtime/projection/cache/ProjectionCache.ts`
- [x] 移除旧的 projection 增量拼装路径（避免双轨）。  
  路径：`packages/whiteboard-engine/src/runtime/projection/projectors/NodeProjector.ts`  
  路径：`packages/whiteboard-engine/src/runtime/projection/cache/shared.ts`

## C. Query/View 读侧

- [x] Query 索引改为通过 projection 订阅同步，不再分散 `ensureSync`。  
  路径：`packages/whiteboard-engine/src/runtime/query/Store.ts`
- [x] `EdgePath` 按职责拆分（Invalidation/Index/Cache/Preview/Query）。  
  路径：`packages/whiteboard-engine/src/runtime/query/edgePath/`
- [x] View 域统一为 `syncProjection(change)` 接口。  
  路径：`packages/whiteboard-engine/src/runtime/view/`
- [x] Query 只读 `ProjectionCommit.snapshot + changed`（去掉隐式内部真相缓存）。  
  路径：`packages/whiteboard-engine/src/runtime/query/Store.ts`
- [x] View 只消费 `ProjectionCommit.snapshot + changed`（去掉 domain 持久缓存真相）。  
  路径：`packages/whiteboard-engine/src/runtime/view/Registry.ts`  
  路径：`packages/whiteboard-engine/src/runtime/view/NodeRegistry.ts`

## D. 清理与收口

- [x] 去除 `orderChanged` 专用分支，收敛到 `ProjectionChange` 统一语义。
- [x] 清理旧 projection/cache 结构与过期字段。  
  路径：`packages/whiteboard-engine/src/runtime/projection/cache/SnapshotState.ts`  
  路径：`packages/whiteboard-engine/src/runtime/projection/cache/ProjectionCache.ts`
- [x] 对齐性能验收（大图拖拽/连线帧耗时，目标不回退）。
  结果：`pnpm -F @whiteboard/engine bench:check` 通过。  
  详情：
  - `drag-frame`：`p95=1.1642ms`（目标 `<4ms`）
  - `node-transform-frame`：`p95=1.1152ms`（目标 `<4ms`）
  - `edge-routing-frame`：`p95=15.1745ms`（目标 `<16ms`）
  - 已移除失效 `bench:node-hint` 脚本。

## 推荐执行顺序

1. 已完成（无需后续动作）。
