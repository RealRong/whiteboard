# Whiteboard 交互职责迁移到 React 层（完整蓝图）

## 1. 目标与结论

目标是继续收敛 engine 复杂度：把**交互期会话编排 + transient 可视状态**迁到 React 层，engine 只保留：

1. `query` 只读几何与文档读取。
2. `commands` 写入入口与一致性规则。
3. `history/projection` 等文档级能力。

结论：除已完成的 `edgeConnect + snap + guide` 外，下一批最适合迁移到 React 的是：

1. `selectionBox`
2. `edgePath` 点击选中/插点
3. `mindmapDrag`
4. `nodeDrag`
5. `nodeTransform`
6. `edgeRouting`
7. `viewport` 交互预览状态（pan/wheel/space）

---

## 2. 当前现状（代码入口）

进度更新（2026-02-26）：

1. `domains.node/domains.edge` 对外 `interaction` API 已移除。
2. `NodeInputGateway/EdgeInputGateway + RuntimeWriter/RuntimeOutput` 已从 engine 删除。
3. 仅用于性能基准的 `NodeDragKernel/NodeTransformKernel/Routing` 已迁到 `packages/whiteboard-engine/src/perf/kernels/*`，不再位于 `domains/*/interaction`。
4. `edgeRouting` 预览已切到 React 本地 store（`edgeRoutingPreviewStore`），engine `render.routingDrag` 及其 view 同步链路已移除。
5. `edges.selection.routing` 已从 engine view 移除，控制点 UI 直接基于 `selectedEdgeId + edges.byId` 读取并叠加本地 draft。

已 UI 化：

1. `edgeConnect` 生命周期与 preview/snap：`packages/whiteboard-react/src/edge/hooks/useEdgeConnectInteraction.ts`
2. edge preview 渲染：`packages/whiteboard-react/src/edge/components/EdgePreviewLayer.tsx`
3. `selectionBox`：`packages/whiteboard-react/src/common/interaction/useSelectionBoxInteraction.ts`
4. `edgePath` 点击/插点：`packages/whiteboard-react/src/edge/hooks/useEdgePathInteraction.ts`
5. `mindmapDrag`：`packages/whiteboard-react/src/mindmap/hooks/useMindmapDragInteraction.ts`
6. `edgeRouting`：`packages/whiteboard-react/src/edge/hooks/useEdgeRoutingInteraction.ts`
7. `nodeDrag`：`packages/whiteboard-react/src/node/hooks/useNodeDragInteraction.ts`
8. `nodeTransform`：`packages/whiteboard-react/src/node/hooks/useNodeTransformInteraction.ts`

仍主要依赖 engine 交互层：

1. 旧输入编排壳仍在：`packages/whiteboard-react/src/common/input/DomInputAdapter.ts` + `packages/whiteboard-engine/src/input/core/InputPort.ts`

---

## 3. 迁移清单（能力 -> React 组件/Hook -> engine 收敛点）

## 3.1 selectionBox

React 侧需要：

1. `packages/whiteboard-react/src/common/interaction/useSelectionBoxInteraction.ts`
2. `packages/whiteboard-react/src/common/interaction/selectionBoxStore.ts`
3. `packages/whiteboard-react/src/node/components/SelectionLayer.tsx` 改为读 `selectionBoxStore`
4. `packages/whiteboard-react/src/common/interaction/CanvasInteractionLayer.tsx`（背景 pointerdown 入口）

迁移方式：

1. React 在背景 `pointerdown` 创建 session（记录 `pointerId/startScreen/startWorld/mode`）。
2. `pointermove` 更新 UI `selectionRect`，并按 RAF 计算 `query.canvas.nodeIdsInRect(rectWorld)`。
3. `pointerup` 统一提交 `commands.selection.select(...)`；`Escape/blur` 取消。

engine 收敛：

1. 删除 `packages/whiteboard-engine/src/domains/selection/interaction/*`
2. 删除 `packages/whiteboard-engine/src/input/sessions/SelectionBox.ts`
3. render key 后续可删除：`selectionBox`

## 3.2 edgePath 点击选中/插点（shift/double click）

React 侧需要：

1. `packages/whiteboard-react/src/edge/hooks/useEdgePathInteraction.ts`
2. `packages/whiteboard-react/src/edge/components/EdgeItem.tsx` 增加 `onPointerDown`

迁移方式：

1. 普通点击：`commands.edge.select(edgeId)`
2. `shift` 或双击：`commands.edge.insertRoutingPoint(...)`（或实体命令封装）

engine 收敛：

1. 删除 `packages/whiteboard-engine/src/input/sessions/EdgePath.ts`

## 3.3 mindmapDrag

React 侧需要：

1. `packages/whiteboard-react/src/mindmap/hooks/useMindmapDragInteraction.ts`
2. `packages/whiteboard-react/src/mindmap/interaction/mindmapDragStore.ts`
3. `packages/whiteboard-react/src/mindmap/components/MindmapNodeItem.tsx` 绑定 pointerdown
4. `packages/whiteboard-react/src/mindmap/components/MindmapTreeView.tsx` 改为读 UI drag preview

迁移方式：

1. UI 维护 root/subtree drag draft。
2. 调用 core 纯函数 `computeSubtreeDropTarget` 计算 drop preview。
3. `pointerup` 时提交 `commands.mindmap.moveRoot/moveSubtreeWithDrop`。

engine 收敛：

1. 删除 `packages/whiteboard-engine/src/domains/mindmap/interaction/*`
2. 删除 `packages/whiteboard-engine/src/input/sessions/MindmapDrag.ts`
3. render key 后续可删除：`mindmapDrag`

## 3.4 nodeDrag

React 侧需要：

1. `packages/whiteboard-react/src/node/hooks/useNodeDragInteraction.ts` 改为纯 UI 编排（不再调用 domain interaction）
2. `packages/whiteboard-react/src/node/interaction/nodeDragMath.ts`（纯函数，含 snap/guide 解析）
3. `packages/whiteboard-react/src/node/interaction/nodeDragStore.ts`
4. `packages/whiteboard-react/src/node/components/DragGuidesLayer.tsx` 改读 UI store
5. `packages/whiteboard-react/src/node/components/NodeItem.tsx` 改读 UI preview（位置/group hover）

迁移方式：

1. `pointerdown` 建立 draft（origin/size/children）。
2. `pointermove` 计算目标位置 + snap + guides + group hover（都在 UI transient）。
3. `pointerup` 汇总 patch，统一调用 `commands.node.updateManyPosition`/`commands.group.*`。

engine 收敛：

1. 删除 `packages/whiteboard-engine/src/domains/node/interaction/node/*`
2. Gateway 中删除 `node.drag` 输入编排
3. render key 后续可删除：`nodeDrag`、`nodePreview`、`dragGuides`、`groupHover`

## 3.5 nodeTransform

React 侧需要：

1. `packages/whiteboard-react/src/node/hooks/useNodeTransformInteraction.ts` 改为纯 UI 编排
2. `packages/whiteboard-react/src/node/interaction/nodeTransformMath.ts`
3. `packages/whiteboard-react/src/node/interaction/nodeTransformStore.ts`
4. `packages/whiteboard-react/src/node/components/NodeItem.tsx` 读取 UI transform preview

迁移方式：

1. `beginResize/beginRotate` 在 UI 记录 draft。
2. `pointermove` 纯函数计算 preview（含 shift/alt 约束、snapping）。
3. `pointerup` 提交 `commands.node.update(...)`。

engine 收敛：

1. 删除 `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/*`
2. Gateway 中删除 `node.transform` 输入编排
3. 复用上节 render key 清理

## 3.6 edgeRouting

React 侧需要：

1. `packages/whiteboard-react/src/edge/hooks/useEdgeRoutingInteraction.ts` 改为纯 UI 编排
2. `packages/whiteboard-react/src/edge/interaction/routingStore.ts`
3. `packages/whiteboard-react/src/edge/interaction/routingMath.ts`
4. `packages/whiteboard-react/src/edge/components/EdgeControlPointHandles.tsx` 改读 UI routing draft

迁移方式：

1. UI 维护 routing drag draft（start/origin/current）。
2. move 仅更新 UI preview。
3. up 时提交 `commands.edge.moveRoutingPoint(...)`。

engine 收敛：

1. 删除 `packages/whiteboard-engine/src/domains/edge/interaction/Routing.ts`
2. Gateway 中删除 `routingInput.begin/update/commit/cancel`
3. render key 后续可删除：`routingDrag`

## 3.7 viewport 交互预览（pan/wheel/space）

React 侧需要：

1. `packages/whiteboard-react/src/common/interaction/useViewportGestureInteraction.ts`
2. `packages/whiteboard-react/src/common/interaction/viewportGestureStore.ts`
3. `packages/whiteboard-react/src/Whiteboard.tsx` 使用 UI store 输出 transform

迁移方式：

1. pan/wheel preview 仅写 UI store。
2. settle 后 `commands.viewport.set(...)` commit。
3. `space` 状态改为 UI key state，不再依赖 `render.spacePressed`。

engine 收敛：

1. `packages/whiteboard-react/src/common/input/ViewportGestureController.ts` 可下线
2. render key 后续可删除：`viewportGesture`、`spacePressed`

---

## 4. 需要新增/改造的 React 组件与 Hook（完整列表）

新增（建议）：

1. `packages/whiteboard-react/src/common/interaction/CanvasInteractionLayer.tsx`
2. `packages/whiteboard-react/src/common/interaction/useWindowPointerSession.ts`
3. `packages/whiteboard-react/src/common/interaction/sessionLockStore.ts`
4. `packages/whiteboard-react/src/common/interaction/useSelectionBoxInteraction.ts`
5. `packages/whiteboard-react/src/common/interaction/selectionBoxStore.ts`
6. `packages/whiteboard-react/src/common/interaction/useViewportGestureInteraction.ts`
7. `packages/whiteboard-react/src/common/interaction/viewportGestureStore.ts`
8. `packages/whiteboard-react/src/edge/hooks/useEdgePathInteraction.ts`
9. `packages/whiteboard-react/src/edge/interaction/routingStore.ts`
10. `packages/whiteboard-react/src/node/interaction/nodeDragStore.ts`
11. `packages/whiteboard-react/src/node/interaction/nodeTransformStore.ts`
12. `packages/whiteboard-react/src/mindmap/hooks/useMindmapDragInteraction.ts`
13. `packages/whiteboard-react/src/mindmap/interaction/mindmapDragStore.ts`

改造：

1. `packages/whiteboard-react/src/Whiteboard.tsx`：移除 `DomInputAdapter` 启停，接入 `CanvasInteractionLayer`
2. `packages/whiteboard-react/src/edge/components/EdgeItem.tsx`：接入 edgePath pointer 事件
3. `packages/whiteboard-react/src/edge/components/EdgeControlPointHandles.tsx`：读 UI routing draft
4. `packages/whiteboard-react/src/node/components/NodeItem.tsx`：读 UI node preview/guide/groupHover
5. `packages/whiteboard-react/src/node/components/SelectionLayer.tsx`：读 UI selectionBox
6. `packages/whiteboard-react/src/node/components/DragGuidesLayer.tsx`：读 UI guides
7. `packages/whiteboard-react/src/mindmap/components/MindmapNodeItem.tsx`：绑定 drag pointerdown
8. `packages/whiteboard-react/src/mindmap/components/MindmapTreeView.tsx`：读 UI drag preview

---

## 5. 三阶段“一步到位”落地顺序

## Phase 1（先拆 InputPort 依赖）

范围：

1. `selectionBox`
2. `edgePath`
3. `mindmapDrag`

目标：

1. 让 `input/sessions/*` 不再承担业务交互。
2. React 拿回容器级 pointer 生命周期。

验收：

1. 框选/边点击与插点/思维导图拖拽都可在无 pointer session 下工作。

## Phase 2（迁移 node/edge 复杂交互）

范围：

1. `nodeDrag`
2. `nodeTransform`
3. `edgeRouting`

目标：

1. 移除 `domains/*/interaction/*Kernel/*Gateway` 对 UI 交互编排的承载。
2. transient 预览统一走 React store。

验收：

1. 拖拽、缩放、旋转、路由点拖拽与迁移前行为一致。

## Phase 3（收口 engine 到最小边界）

范围：

1. `viewportGesture` 预览
2. `space` 快捷状态
3. 输入基础设施下线

目标：

1. 移除 `DomInputAdapter + InputPort + PointerSessionEngine` 的主路径依赖。
2. engine 保留 `query + commands + history/projection`。

验收：

1. `packages/whiteboard-engine/src/input/*` 仅保留必要最小壳或可整体移除。
2. render transient key 大幅减少。

---

## 6. engine 可收敛到的最终边界

建议保留：

1. `commands/*`
2. `query/*`
3. `runtime/projection/*`
4. `runtime/history/*`
5. `runtime/view/*`（仅文档视图，不含交互 preview）

建议删除或最小化：

1. `domains/*/interaction/*`
2. `input/core/*`
3. `input/sessions/*`
4. `render` 中交互 transient：`selectionBox/nodePreview/dragGuides/groupHover/routingDrag/mindmapDrag/viewportGesture/spacePressed`

---

## 7. 迁移风险与防护

风险：

1. 多个 feature 同时监听 window pointer，发生竞态。
2. 各 feature 复制 snap/guide 算法导致分叉。
3. preview 与 commit 语义不一致。

防护：

1. `sessionLockStore` 统一交互锁（同一时刻仅一个主交互会话）。
2. snap/guide 统一纯函数模块，禁止 feature 私有复制。
3. `pointerup` 前固定执行一次 `finalizeUpdate()` 再 commit。

---

## 8. 验收清单

代码验收：

1. `pnpm --filter @whiteboard/engine lint`
2. `pnpm --filter @whiteboard/react lint`
3. `pnpm --filter @whiteboard/engine run bench:check`

手工回归：

1. node drag（含 snap、group hover、guide）
2. node resize/rotate（含 shift/alt）
3. edge 路由点插入、拖拽、删除
4. selection box（replace/add/subtract/toggle）
5. mindmap root/subtree drag drop
6. viewport pan/wheel/space
7. edge connect/reconnect（已 UI 化能力不回退）

---

## 9. 推荐执行策略

如果要“尽快降复杂度且降低回归风险”，建议顺序：

1. 先做 `selectionBox + edgePath + mindmapDrag`（替掉 input sessions）。
2. 再做 `nodeDrag + nodeTransform + edgeRouting`（替掉 domain interaction，现已完成）。
3. 最后做 `viewport + space + InputPort` 收口（完成 engine 极简边界）。
