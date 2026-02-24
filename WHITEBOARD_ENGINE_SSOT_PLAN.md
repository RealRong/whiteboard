# Whiteboard Engine SSOT Plan

## 1. 目标

- 在 `ProjectionSnapshot` 之外，再收敛 5 个高复杂度状态域为单一事实源（SSOT）。
- 保持对外 API 基本稳定，优先降低内部状态分裂与同步噪音。
- 为 `WHITEBOARD_SINGLE_PROJECTION_SNAPSHOT_PLAN.md` 提供实施前置与并行约束。

## 2. 范围

- `packages/whiteboard-engine/src/input`
- `packages/whiteboard-engine/src/state`
- `packages/whiteboard-engine/src/runtime`
- `packages/whiteboard-engine/src/instance`

不包含：
- React 视觉临时态与组件本地 `useMemo`。
- 外部 API 语义重设计（本期仅收敛内部模型）。

## 3. 新增 SSOT 结论

## 3.1 InteractionSessionSnapshot（最高优先级）

现状：
- 会话状态分散在 `nodeDrag/nodeTransform/edgeConnect/routingDrag/mindmapDrag` 与 `PointerSessionEngine.active`。

目标：
- 单一联合态：

```ts
type InteractionSessionSnapshot = {
  active?:
    | { kind: 'nodeDrag'; payload: ... }
    | { kind: 'nodeTransform'; payload: ... }
    | { kind: 'edgeConnect'; payload: ... }
    | { kind: 'routingDrag'; payload: ... }
    | { kind: 'mindmapDrag'; payload: ... }
}
```

约束：
- `PointerSessionEngine` 不再持久化独立 `active` 真相，只做驱动与 effect。
- cancel/end/break 都通过同一写入口更新 session snapshot。

## 3.2 ViewportWorldSnapshot（高优先级）

现状：
- world viewport 在 `doc/state.viewport/ViewportRuntime.viewport` 多处存在。

目标：
- 只保留一份 world viewport（建议文档/投影侧）。
- `ViewportRuntime` 仅保留容器几何与坐标换算缓存，不持有独立 world viewport 真相。

## 3.3 HistorySnapshot（高优先级）

现状：
- 栈在 `HistoryDomain`，`state.history` 为镜像摘要。

目标：
- history 真相仅一处（`HistoryDomain`）。
- UI 读取统一 `history.getSnapshot()` 或 query 映射，不再双写镜像字段。

## 3.4 SelectionSnapshot（中高优先级）

现状：
- `selection + edgeSelection + routingDrag + groupHovered` 跨 key 协同，存在批量清理与耦合。

目标：
- 收敛为单一选择快照：

```ts
type SelectionSnapshot = {
  nodes: Set<NodeId>
  edgeId?: EdgeId
  box?: { rect?: Rect; rectWorld?: Rect; mode: SelectionMode; active: boolean }
  hover?: { nodeId?: NodeId; edgeId?: EdgeId; groupId?: NodeId }
}
```

## 3.5 QueryIndexSnapshot（中优先级）

现状：
- query 索引 (`NodeRectIndex/SnapIndex`) 与 projection 快照并行维护。

目标：
- 索引快照纳入统一提交链（可作为 `ProjectionSnapshot.indexes` 或并行 `QuerySnapshot`）。
- query/view 只消费提交后的快照，不自行触发失效推导。

## 4. 与 Single Projection Plan 的关系

- `WHITEBOARD_SINGLE_PROJECTION_SNAPSHOT_PLAN.md` 负责“投影单快照 + projector pipeline”。
- 本文负责“除投影外的核心状态域去分裂”。
- 两者合并后的主链路：

`mutations -> reducer -> projectors -> ProjectionCommit(snapshot + changed) -> query/view/input readers`

## 5. 实施顺序（低风险）

1. InteractionSessionSnapshot  
2. ViewportWorldSnapshot  
3. HistorySnapshot  
4. SelectionSnapshot  
5. QueryIndexSnapshot  
6. 合流到 `WHITEBOARD_SINGLE_PROJECTION_SNAPSHOT_PLAN.md` 的 projector/commit 主线

说明：
- 前 5 项优先解决“状态真相分裂”。
- 之后推进单快照提交，能减少大规模回归风险。

## 6. 每阶段交付定义

每阶段必须满足：
- 仅一处真相写入口。
- 读侧无额外持久缓存副本。
- 构建通过：`pnpm -r -F @whiteboard/core -F @whiteboard/engine -F @whiteboard/react build`
- 关键交互回归：拖拽、框选、连线、重连、undo/redo、缩放。

## 7. 启动 WHITEBOARD_SINGLE_PROJECTION_SNAPSHOT_PLAN.md 前置清单

- 完成 `InteractionSessionSnapshot` 最小落地（统一 active session）。
- 明确 `ProjectionCommit` 结构（`snapshot + changed`）并冻结类型。
- 确认 `query/view` 读取接口只依赖 commit 快照，不新增旁路缓存。

## 8. 下一步执行建议

- Step 1：先落地 `InteractionSessionSnapshot`（最小切面，不改外部 API）。
- Step 2：同步更新 input session 与 actor 写入口，移除重复 active 状态。
- Step 3：进入 `WHITEBOARD_SINGLE_PROJECTION_SNAPSHOT_PLAN.md` Phase B（Projection 读路径收敛）。

