# Whiteboard Transient Preview Optimization Plan

## 1. 目标

- 统一收敛高频交互路径：`move 阶段只走预览，不写 mutation`。
- 缓存只基于稳定数据（已提交文档）计算，避免被拖拽中的临时值污染。
- 降低热路径 p95，并减少缓存失效分支复杂度。

## 2. 审计结论（Engine 内）

## 2.1 已符合“预览态 -> 结束提交”模式

- `node drag`
  - `packages/whiteboard-engine/src/input/domain/node/node/Planner.ts`
  - `update` 只产出 `overrideUpdates`，`end` 才产出 `mutations`。
- `node resize`
  - `packages/whiteboard-engine/src/input/domain/node/nodeTransform/Planner.ts`
  - `resize update` 走 `overrideUpdates`，`end` 由 `CommitCompiler` 提交。
- `edge connect/reconnect`
  - `packages/whiteboard-engine/src/input/domain/edge/Connect.ts`
  - `updateTo` 只写 `edgeConnect` 状态，`commitTo` 才提交 mutation。
- `mindmap drag`
  - `packages/whiteboard-engine/src/input/domain/mindmap/Drag.ts`
  - `update` 只写 `mindmapDrag` 预览，`end` 才调用命令提交。

## 2.2 同类问题（应优先优化）

- `edge routing drag`（当前每帧 mutation）
  - `packages/whiteboard-engine/src/input/domain/edge/Routing.ts`
  - `update` 内直接 `submitMutations(edge.update)`。
- `node rotate transform`（当前每帧 mutation）
  - `packages/whiteboard-engine/src/input/domain/node/nodeTransform/Planner.ts`
  - `rotate update` 分支直接返回 `mutations: node.update(rotation)`。

## 2.3 次优先级（跨层/可选）

- `viewport pan/wheel`（React 手势层每事件 mutation）
  - `packages/whiteboard-react/src/common/input/ViewportGestureController.ts`
  - `commands.viewport.panBy/zoomBy` 每次事件直接写入。
- `host.nodeMeasured` 高频上报（已做 rAF+epsilon，但仍是直接 mutation）
  - `packages/whiteboard-react/src/node/components/NodeItem.tsx`
  - `packages/whiteboard-engine/src/instance/create.ts`

## 3. 统一设计：双通道（Preview / Commit）

## 3.1 规则

- `Preview 通道`：仅更新临时态或临时覆盖，不触发文档写入。
- `Commit 通道`：仅在 `end/commit` 时提交 mutation（一次或极少次数）。
- `Cancel`：只清理预览态，不写文档。

## 3.2 缓存边界

- `Projection / Query / View` 主缓存只消费 committed doc。
- 临时预览通过“渲染层覆盖”合并，不回写主缓存。

## 3.3 历史语义

- 一次交互手势（down -> move* -> up）应对应一次历史记录。
- 预览期间不产生 undo/redo 记录。

## 4. 分项优化方案

## 4.1 Edge Routing（P0）

### 现状问题

- move 每帧 `edge.update`，导致每帧进入写入管线与投影/视图同步。
- 在大图场景（1w edges）会放大边路径缓存更新成本。

### 目标方案

- `update`：仅更新 routing 预览态（不 mutation）。
- `end`：一次性提交 `edge.update(routing.points)`。
- `cancel`：清空预览态。

### 建议改动文件

- `packages/whiteboard-engine/src/types/edge/routing.ts`
  - `RoutingDragPayload` 增加当前预览点（如 `current?: Point` 或 `previewPoint?: Point`）。
- `packages/whiteboard-engine/src/input/domain/edge/Routing.ts`
  - `update` 写 `routingDrag.payload` 预览。
  - `end` 才调用 `submitMutations`。
- `packages/whiteboard-engine/src/runtime/query/edgePath/Preview.ts`
  - 增加 routing 预览 path 生成逻辑（仅单 edge）。
- `packages/whiteboard-engine/src/runtime/actors/edge/view/query/index.ts`
  - `getPaths` 合并 routing 预览 entry。
- `packages/whiteboard-engine/src/runtime/view/Registry.ts`
  - 在 `routingDrag` 状态变更时触发 edge 视图重算（仅预览）。

### 预期收益

- move 热路径去掉 mutation 管线。
- `edge-routing-frame` p95 明显下降，并更稳定。

## 4.2 Node Rotate（P0）

### 现状问题

- rotate move 每帧提交 `node.update(rotation)`。
- 语义上与 resize 不一致（resize 已是预览态）。

### 目标方案

- rotate move 与 resize 对齐：`update` 仅预览，`end` 一次提交。

### 建议改动文件

- `packages/whiteboard-engine/src/runtime/projection/cache/NodeOverride.ts`
  - 增加 `rotation?: number`。
- `packages/whiteboard-engine/src/types/projection.ts`
  - `NodeViewUpdate` 增加 `rotation?: number`。
- `packages/whiteboard-engine/src/runtime/projection/cache/NodeOverrideState.ts`
- `packages/whiteboard-engine/src/runtime/projection/cache/ViewNodesState.ts`
  - 让 override 比较与应用支持 rotation。
- `packages/whiteboard-engine/src/input/domain/node/nodeTransform/Planner.ts`
  - rotate `update` 产出 `overrideUpdates`（含 rotation），不再产出 mutation。
  - `end` 产出 rotate 最终 mutation。
- `packages/whiteboard-engine/src/input/domain/node/nodeTransform/CommitCompiler.ts`
  - 新增 `compileRotate(nodeId, rotation)`。

### 预期收益

- rotate 与 resize 模式统一。
- 减少每帧 doc 写入、impact 推导与缓存链路调用。

## 4.3 Viewport Gesture（P1，跨层）

### 现状问题

- `pan/wheel` 在 React 手势层每事件直接 mutation。

### 目标方案

- 引入 `viewportPreview`（或 host 层 transform 预览），手势进行中只更新预览。
- 手势结束（或 wheel settle）再提交一次 `viewport.update`。

### 建议改动文件

- `packages/whiteboard-react/src/common/input/ViewportGestureController.ts`
- `packages/whiteboard-engine/src/runtime/actors/viewport/Domain.ts`
- （可选）`packages/whiteboard-engine/src/types/state/model.ts` 增加 `viewportPreview`。

## 4.4 Host Measured / AutoFit（P2，可选）

- `host.nodeMeasured`：在 engine 侧按帧聚合相同 node 的 size 更新再提交。
- `groupAutoFit`：同一轮多 group 更新合并为一次 mutation batch。

## 5. 实施顺序

1. P0-1：Routing move 改为预览态 + end 提交。
2. P0-2：Node rotate 改为预览态 + end 提交。
3. P1：Viewport 手势预览化（如需）。
4. P2：Measured/AutoFit 聚合优化。

## 6. 验收标准

## 6.1 功能

- routing 拖拽视觉连续，`up` 后结果正确，`cancel` 不污染文档。
- rotate 拖拽视觉连续，`up` 后角度正确，`cancel` 回退。
- undo/redo：每次交互仅一条历史记录。

## 6.2 性能

- `edge-routing-frame`：目标 p95 从当前 ~16ms 下探到 `<12ms`（或至少稳定 `<14ms`）。
- 新增 `node-rotate-frame` 基准（与 `node-transform-frame` 分离验证）。
- 现有 `drag-frame`、`node-transform-frame` 不回退。

## 6.3 架构一致性

- move 阶段不进入 `mutate -> reduce -> projection commit` 主写链。
- 主缓存只读 committed 数据；预览只在渲染层叠加。

## 7. 风险与规避

- 风险：预览与提交结果不一致（特别是 routing/rotate 最终值）。
  - 规避：`end` 复用与 `update` 同一套计算规则，避免双实现漂移。
- 风险：新增预览态后状态清理遗漏。
  - 规避：统一 `cancel/end/reset` 清理路径，纳入 lifecycle stop。
- 风险：为兼顾预览临时引入多份缓存。
  - 规避：预览只做单条 entry 覆盖，不新增持久缓存真相。

## 8. 一句话原则

- 高频交互先预览，稳定结果再提交；缓存只服务稳定数据。
