# Whiteboard Engine SSOT Checklist

## 当前结论

- 当前状态：已完成（100%）。
- `InteractionSessionSnapshot` 主路径已收敛为 actor 私有 session + `interactionSession`，旧 `*.active` 真相职责已移除。
- `HistorySnapshot` 已移除 state 镜像，当前通过 `commands.history.get()` 作为读取入口。
- `Viewport/Selection/QueryIndex` 已完成单一事实源收口。

## 1. InteractionSessionSnapshot

- [x] 定义 `interactionSession.active` 联合状态。  
  路径：`packages/whiteboard-engine/src/types/state/model.ts`
- [x] 初始状态接入 `interactionSession`。  
  路径：`packages/whiteboard-engine/src/state/initialState.ts`
- [x] pointer sessions 统一按 `interactionSession.active` 路由。  
  路径：`packages/whiteboard-engine/src/input/sessions/`
- [x] actors 在 start/end/cancel/reset 同步写入 `interactionSession`。  
  路径：`packages/whiteboard-engine/src/runtime/nodeInput/`  
  路径：`packages/whiteboard-engine/src/runtime/edgeInput/`  
  路径：`packages/whiteboard-engine/src/runtime/mindmapInput/`
- [x] start 阶段的互斥判定收敛到 `interactionSession`（node/transform/routing/mindmap）。  
  路径：`packages/whiteboard-engine/src/runtime/nodeInput/node/Planner.ts`  
  路径：`packages/whiteboard-engine/src/runtime/nodeInput/nodeTransform/Planner.ts`  
  路径：`packages/whiteboard-engine/src/runtime/edgeInput/Routing.ts`  
  路径：`packages/whiteboard-engine/src/runtime/mindmapInput/Drag.ts`
- [x] `edgeConnect.pointerId` 已删除，pointer 会话统一使用 `interactionSession.pointerId`。  
  路径：`packages/whiteboard-engine/src/types/edge/state.ts`  
  路径：`packages/whiteboard-engine/src/input/sessions/EdgeConnect.ts`
- [x] `edgeConnect.isConnecting` 已从运行时判定移除（由 `interactionSession.kind === 'edgeConnect'` 负责）。  
  路径：`packages/whiteboard-engine/src/runtime/actors/edge/view/Derivation.ts`  
  路径：`packages/whiteboard-engine/src/input/shortcut/runtime.ts`
- [x] 删除旧 `nodeDrag/nodeTransform/routingDrag/mindmapDrag` 的 `active` 真相职责（仅保留 payload 或迁入 session payload）。  
  路径：`packages/whiteboard-engine/src/runtime/nodeInput/node/Planner.ts`  
  路径：`packages/whiteboard-engine/src/runtime/nodeInput/nodeTransform/Planner.ts`  
  路径：`packages/whiteboard-engine/src/runtime/edgeInput/Routing.ts`  
  路径：`packages/whiteboard-engine/src/runtime/mindmapInput/Drag.ts`  
  路径：`packages/whiteboard-engine/src/types/state/model.ts`
- [x] 收敛 `edgeConnect.isConnecting/pointerId` 到统一 session 模型。

## 2. ViewportWorldSnapshot

- [x] 去掉 `state.viewport` 与 `ViewportRuntime.viewport` 双真相。  
  路径：`packages/whiteboard-engine/src/state/factory/index.ts`
- [x] 保留单一 world viewport 真相；`ViewportRuntime` 只保留容器几何和坐标换算缓存。  
  路径：`packages/whiteboard-engine/src/instance/create.ts`  
  路径：`packages/whiteboard-engine/src/runtime/lifecycle/Lifecycle.ts`

## 3. HistorySnapshot

- [x] 去掉 `HistoryDomain -> state.history` 镜像写入。  
  路径：`packages/whiteboard-engine/src/instance/create.ts`  
  路径：`packages/whiteboard-engine/src/state/initialState.ts`  
  路径：`packages/whiteboard-engine/src/types/instance/state.ts`
- [x] 历史状态改为单一读取入口（domain snapshot 或 query 映射）。  
  路径：`packages/whiteboard-engine/src/runtime/write/WriteCoordinator.ts`  
  路径：`packages/whiteboard-engine/src/types/commands.ts`

## 4. SelectionSnapshot

- [x] 合并 `selection + edgeSelection + groupHovered + selectionRect*` 为单快照。  
  路径：`packages/whiteboard-engine/src/types/state/model.ts`  
  路径：`packages/whiteboard-engine/src/types/instance/state.ts`  
  路径：`packages/whiteboard-engine/src/state/initialState.ts`
- [x] 统一 actor 写入口，减少跨 key 批量清理逻辑。  
  路径：`packages/whiteboard-engine/src/runtime/actors/selection/Actor.ts`  
  路径：`packages/whiteboard-engine/src/runtime/nodeInput/node/Planner.ts`  
  路径：`packages/whiteboard-engine/src/runtime/actors/edge/Actor.ts`  
  路径：`packages/whiteboard-engine/src/runtime/edgeInput/Routing.ts`

## 5. QueryIndexSnapshot

- [x] query index 已改为订阅 projection 变化触发同步。  
  路径：`packages/whiteboard-engine/src/runtime/query/Store.ts`
- [x] 将 query index 真相纳入统一快照提交链（与 projection commit 对齐）。  
  路径：`packages/whiteboard-engine/src/runtime/query/Indexes.ts`  
  路径：`packages/whiteboard-engine/src/runtime/query/Store.ts`
