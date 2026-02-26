# Whiteboard Render State Plan

## 1. 目标与结论

结论先说：

- `overrideUpdates` 应该移除。
- Engine 内新增独立 `RenderState`，只负责渲染态/瞬时态。
- `ProjectionSnapshot` 只表示已提交文档的稳定投影，不再混入任何预览覆盖。
- UI 读取统一为：`ProjectionSnapshot + RenderState`。

目标：

- 降低拖拽热路径复杂度和耦合。
- 明确“真实数据”和“预览数据”边界，让新手一眼看懂。
- 让历史系统只记录稳定 mutation，不记录 move 阶段噪声。

## 2. 三层状态模型（SSOT + Preview）

推荐固定为三层：

1. `DocumentState`（真实业务态）
- 来源：mutation 写入。
- 内容：`nodes/edges/order/mindmap/...`。
- 特性：参与 undo/redo。

2. `ProjectionSnapshot`（稳定读模型）
- 来源：从 `DocumentState` 投影。
- 内容：`nodes/edges/indexes/...` 的稳定快照。
- 特性：只服务查询和稳定渲染，不接收预览 patch。

3. `RenderState`（渲染态/瞬时态）
- 来源：输入交互、host 回调、局部 UI 逻辑。
- 内容：拖拽中间值、连接预览、框选框、辅助线、hover 等。
- 特性：不进历史栈，可随时清空。

## 3. 判断规则：哪些应该进 RenderState

满足任一条件就应进入 `RenderState`：

- 高频更新（pointermove/wheel/drag frame）。
- 只影响视觉反馈，不代表业务真相。
- `cancel` 后应完全丢弃。
- 不应该参与 undo/redo。

反向规则（不应进 `RenderState`）：

- 会影响文档语义、导出、协作同步的数据。
- 需要历史回放的结果数据。
- 作为缓存真相被其它模块依赖的数据。

## 4. 可迁入 RenderState 的完整清单

## 4.1 基础交互态（应迁）

- `interaction.focus`
- `interaction.pointer`
- `interaction.hover`
- `interactionSession.active`
- `spacePressed`
- `tool`（UI 模式态，不是文档真相）

说明：这些都属于 UI/输入语义，不是文档结构。

## 4.2 选择与框选态（应迁）

- `selection.selectedNodeIds`
- `selection.selectedEdgeId`
- `selection.mode`
- `selection.groupHovered`
- `selection.isSelecting`
- `selection.selectionRect`
- `selection.selectionRectWorld`

说明：选择态是“当前视图上下文”，不应污染文档投影层。

## 4.3 Node 交互预览（应迁）

- `nodeDrag.payload`
- `nodeTransform.payload`
- `dragGuides`
- 现有 `overrideUpdates`（位置/尺寸/旋转）整体替换为：
  - `render.node.previewById: Map<NodeId, NodePreview>`

`NodePreview` 建议：

```ts
type NodePreview = {
  position?: { x: number; y: number }
  size?: { width: number; height: number }
  rotation?: number
}
```

## 4.4 Edge 交互预览（应迁）

- `edgeConnect`（from/to/hover/reconnect）
- `routingDrag.payload`
- 新增 `render.edge.routingPreview`（当前拖拽点）

示例：

```ts
type EdgeRoutingPreview = {
  edgeId: string
  index: number
  point: { x: number; y: number }
}
```

关键规则：`routing move` 只更新预览，`end` 才一次提交 mutation。

## 4.5 Mindmap 交互预览（应迁）

- `mindmapDrag.payload`
- subtree/root 拖拽中的 ghost、drop target、临时偏移

这些都是典型瞬时态，和文档持久数据分离最合理。

## 4.6 Viewport 手势预览（建议迁）

新增：

- `render.viewport.gesture`（pan/wheel 进行中预览 transform）

规则：

- 手势中更新预览。
- 手势结束再提交一次 `viewport` 变更。

## 4.7 Host 高频输入预览（可选）

可选新增：

- `render.host.measureQueue`（nodeMeasured/containerResized 的帧内聚合态）

用于把 host 高频事件先聚合，再低频提交 mutation。

## 5. 不应该进 RenderState 的内容

以下应保留在文档/稳定域：

- `Document` 本体：`nodes/edges/order/mindmap/...`
- 历史栈本体（undo/redo 操作记录）
- `ProjectionSnapshot` 及其 revision
- Query indexes / geometry indexes / edge path stable cache
- 任何用于协作同步、持久化、导出的一致性数据

## 6. RenderState API 设计（简洁版）

命名尽量短，避免额外概念层：

```ts
type RenderStateStore = {
  getSnapshot: () => RenderState
  read: <K extends keyof RenderState>(key: K) => RenderState[K]
  write: <K extends keyof RenderState>(
    key: K,
    next: RenderState[K] | ((prev: RenderState[K]) => RenderState[K])
  ) => void
  batch: (fn: () => void) => void
  reset: (keys?: (keyof RenderState)[]) => void
  watch: (key: keyof RenderState, listener: () => void) => () => void
  watchChanges: (listener: (key: keyof RenderState) => void) => () => void
}
```

说明：

- API 形态与现有 `state` 对齐，迁移成本最低。
- 语义改为“渲染态专用”，避免再承载文档语义。

## 7. 统一执行链路（交互到提交）

标准链路：

1. `start`：写 `RenderState`，建立 session。
2. `move`：仅写 `RenderState` 预览。
3. `end`：根据 session + 预览值编译 mutation，一次提交。
4. `commit` 后：清理对应预览 slice。
5. `cancel`：只清理 `RenderState`，不写文档。

这条链路适用于：

- node drag / resize / rotate
- edge connect / reconnect / routing
- selection box
- mindmap drag
- viewport gesture

## 8. 当前字段到新模型的映射

建议迁移映射如下：

- `state.interaction` -> `render.interaction`
- `state.interactionSession` -> `render.session`
- `state.tool` -> `render.tool`
- `state.selection` -> `render.selection`
- `state.edgeConnect` -> `render.edge.connect`
- `state.routingDrag` -> `render.edge.routing`
- `state.nodeDrag` -> `render.node.drag`
- `state.nodeTransform` -> `render.node.transform`
- `projection.nodeOverrides` -> `render.node.previewById`
- `state.dragGuides` -> `render.node.guides`
- `state.mindmapDrag` -> `render.mindmap.drag`
- `state.spacePressed` -> `render.keyboard.spacePressed`
- `state.viewport`（稳定值）保持在 viewport domain；仅 `gesture` 进 `render.viewport`

## 9. 实施顺序（一步到位）

## Phase 1（P0）：先清掉最重热路径

- Edge routing move -> 预览态，end 提交。
- Node rotate move -> 预览态，end 提交。

## Phase 2（P0）：移除 override 体系

- 删除 `NodeOverrideState` / `patchNodeOverrides` / `clearNodeOverrides`。
- Node 预览统一进 `render.node.previewById`。
- View 合成时读取 `ProjectionSnapshot + render.node.previewById`。

## Phase 3（P1）：统一 view/query 读取边界

- Query 只读 `ProjectionSnapshot`。
- View 才做 `Projection + Render` 合成。
- 不再让投影层处理预览 merge。

## Phase 4（P1）：viewport/host 高频输入分层

- 引入 `render.viewport.gesture`。
- host 高频测量先聚合再提交。

## 10. 需要删除或重写的现有组件

明确删除/收敛：

- `packages/whiteboard-engine/src/runtime/projection/cache/NodeOverrideState.ts`
- `packages/whiteboard-engine/src/runtime/projection/cache/NodeOverride.ts`
- `packages/whiteboard-engine/src/runtime/projection/cache/ViewNodesState.ts` 中 override merge 逻辑
- `packages/whiteboard-engine/src/runtime/projection/Store.ts` 的
  - `readNodeOverrides`
  - `patchNodeOverrides`
  - `clearNodeOverrides`
- `packages/whiteboard-engine/src/input/domain/node/RuntimeWriter.ts` 中 override 写入路径

## 11. 验收标准

功能：

- 所有交互 `cancel` 都不污染文档。
- 所有交互 `end` 只产生一次或极少量 mutation。
- undo/redo 按“手势一次一条历史”。

性能：

- `edge-routing-frame`、`node-transform-frame` p95 明显下降并稳定。
- move 阶段不再进入完整 mutate/commit 主链。

可维护性：

- 新手可按“文档态 vs 渲染态”快速定位。
- 代码里不再存在“预览态藏在投影缓存”的混合职责。

## 12. 一句话架构原则

稳定数据走 `Document -> Projection`，高频反馈走 `RenderState`；两者在 View 层合成，绝不互相污染。
