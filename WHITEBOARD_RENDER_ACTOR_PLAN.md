# Whiteboard Render Actor Plan

## 1. 目标

把当前分散在 `input/state/view` 的预览逻辑收敛为独立 `render` 领域层：

1. `input` 只做事件规范化和会话路由，不持有渲染语义。
2. `render` 作为独立 actor 层，管理所有瞬时渲染态（preview/transient）。
3. `view` 只做只读合成：`ProjectionSnapshot + RenderSnapshot`。
4. `mutation` 仅在 `end/commit` 提交，`move` 不进入写入主链。

一句话：`input 负责入口，render 负责预览真相，view 负责读合成，mutate 负责稳定提交。`

---

## 2. 非目标

1. 不改 core reducer/operation 模型。
2. 不引入事件总线驱动内部 actor（内部用同步直调）。
3. 不保留旧链路兼容层（一步到位替换）。

---

## 3. 目标分层

推荐固定为四段链路：

1. `React/Host -> Input`
2. `Input -> RenderCoordinator -> RenderActors`
3. `RenderActors(end/commit) -> mutate -> ProjectionStore`
4. `ViewRegistry <- ProjectionSnapshot + RenderSnapshot`

职责边界：

1. Input 不直接写 `selectionBox/nodePreview/routingDrag/...`。
2. View 不直接推导会话状态，不改状态，只读。
3. RenderActor 不解释文档持久语义，不做 Projection 缓存。
4. Mutation 写入后清理对应 render slice。

---

## 4. 目录与命名

新增目录：

1. `packages/whiteboard-engine/src/runtime/render/RenderStore.ts`
2. `packages/whiteboard-engine/src/runtime/render/RenderCoordinator.ts`
3. `packages/whiteboard-engine/src/runtime/render/node/NodeRenderActor.ts`
4. `packages/whiteboard-engine/src/runtime/render/edge/EdgeRenderActor.ts`
5. `packages/whiteboard-engine/src/runtime/render/mindmap/MindmapRenderActor.ts`
6. `packages/whiteboard-engine/src/runtime/render/selection/SelectionRenderActor.ts`
7. `packages/whiteboard-engine/src/runtime/render/viewport/ViewportRenderActor.ts`
8. `packages/whiteboard-engine/src/runtime/render/types.ts`

命名规则：

1. class 文件使用 PascalCase（如 `NodeRenderActor.ts`）。
2. 同目录避免冗余后缀/前缀，统一 `*RenderActor`。
3. 公共入口统一在 `RenderCoordinator`，内部按 domain 直调。

---

## 5. RenderSnapshot 设计（单一事实源）

```ts
export type RenderSnapshot = {
  interaction: {
    focus: { isEditingText: boolean; isInputFocused: boolean; isImeComposing: boolean }
    pointer: { isDragging: boolean; button?: 0 | 1 | 2; modifiers: { alt: boolean; shift: boolean; ctrl: boolean; meta: boolean } }
    hover: { nodeId?: NodeId; edgeId?: EdgeId }
    session?: { kind: 'nodeDrag' | 'nodeTransform' | 'edgeConnect' | 'routingDrag' | 'mindmapDrag' | 'selectionBox' | 'viewportGesture'; pointerId: number }
  }
  selection: {
    selectedNodeIds: Set<NodeId>
    selectedEdgeId?: EdgeId
    mode: 'replace' | 'add' | 'subtract' | 'toggle'
    groupHovered?: NodeId
    box?: { rectScreen: Rect; rectWorld: Rect }
  }
  node: {
    drag?: { nodeId: NodeId; pointerId: number }
    transform?: { nodeId: NodeId; pointerId: number; mode: 'resize' | 'rotate' }
    previewById: Map<NodeId, { position?: Point; size?: Size; rotation?: number }>
    guides: Guide[]
  }
  edge: {
    connect?: { from?: ConnectAnchor; to?: ConnectPoint; hover?: ConnectPoint; reconnect?: { edgeId: EdgeId; end: 'source' | 'target' } }
    routing?: { edgeId: EdgeId; index: number; point: Point; pointerId: number }
  }
  mindmap: {
    drag?: MindmapDragPayload
  }
  viewport: {
    gesture?: Viewport
  }
  keyboard: {
    spacePressed: boolean
  }
}
```

设计原则：

1. 高频可变、可取消、无历史语义的数据统一放 `RenderSnapshot`。
2. 文档真相仍在 `Document`，投影真相仍在 `ProjectionSnapshot`。
3. 所有 preview 清理路径必须显式（`end/cancel/reset/stop`）。

---

## 6. 核心 API 设计

## 6.1 RenderStore

```ts
export type RenderStore = {
  getSnapshot: () => RenderSnapshot
  read: <K extends keyof RenderSnapshot>(key: K) => RenderSnapshot[K]
  write: <K extends keyof RenderSnapshot>(key: K, next: RenderSnapshot[K] | ((prev: RenderSnapshot[K]) => RenderSnapshot[K])) => void
  batch: (fn: () => void) => void
  batchFrame: (fn: () => void) => void
  reset: (keys?: (keyof RenderSnapshot)[]) => void
  watch: (key: keyof RenderSnapshot, listener: () => void) => () => void
  watchChanges: (listener: (key: keyof RenderSnapshot) => void) => () => void
}
```

## 6.2 RenderCoordinator（唯一入口）

```ts
export type RenderCoordinator = {
  node: NodeRenderActor
  edge: EdgeRenderActor
  mindmap: MindmapRenderActor
  selection: SelectionRenderActor
  viewport: ViewportRenderActor
  resetAll: () => void
}
```

协调规则：

1. 由 coordinator 组装 actor，不做业务判断。
2. actor 间调用走同步直调（必要时），不走内部事件发布。
3. 对外只暴露最小语义 API，不暴露 store 实现细节。

---

## 7. Actor 职责

## 7.1 NodeRenderActor

负责：

1. `drag/resize/rotate` 的 start/update/end/cancel。
2. 维护 `node.previewById` 和 `node.guides`。
3. `end` 编译 mutation，`move` 仅写 preview。

不负责：

1. Projection 缓存维护。
2. Node 持久化业务规则（交给 node command/mutation）。

## 7.2 EdgeRenderActor

负责：

1. `connect/reconnect/routing` preview。
2. `routing move` 只改 `edge.routing`，`end` 一次提交。

## 7.3 MindmapRenderActor

负责：

1. root/subtree 拖拽 preview（ghost/drop/offset）。
2. `end` 提交最终 drop/move。

## 7.4 SelectionRenderActor

负责：

1. box selection 会话及选中集预览。
2. `routingDrag` 等互斥态在 start 时统一清理。

## 7.5 ViewportRenderActor

负责：

1. pan/wheel 手势预览态（`viewport.gesture`）。
2. settle/end 提交一次 viewport mutation。

---

## 8. View 层改造

ViewRegistry 需要双源订阅：

1. `projection.subscribe(commit)`：稳定数据变更。
2. `renderStore.watchChanges(key)`：预览数据变更。

Domain 读取规则：

1. NodeDomain：`projection.nodes + render.node.previewById` 合成。
2. EdgeDomain：`projection.edges + render.edge.connect/routing` 合成。
3. MindmapDomain：`projection.mindmap + render.mindmap.drag` 合成。
4. ViewportDomain：`render.viewport.gesture ?? projection.viewport`。

限制：

1. Query 只读 Projection，不读 Render。
2. View 只做合成，不回写 Render/Projection。

---

## 9. 实施步骤（一步到位）

## Phase 1：建立 Render 基础设施

1. 新增 `RenderStore` 和 `RenderSnapshot`。
2. 在 `create.ts` 组装 `RenderCoordinator` 和各 domain actor。
3. 将现有 render keys 从 `State` 迁出（保留 doc/view 必要状态）。

## Phase 2：迁移输入域到 RenderActor

1. `input/domain/node` 改为调用 `render.node.*`。
2. `input/domain/edge` 改为调用 `render.edge.*`。
3. `input/domain/mindmap` 改为调用 `render.mindmap.*`。
4. `input/domain/selection` 改为调用 `render.selection.*`。
5. React `ViewportGestureController` 调用 `render.viewport.*`。

## Phase 3：迁移 View 合成读取

1. ViewRegistry 改为订阅 renderStore。
2. Node/Edge/Mindmap/Viewport domain 改读 RenderSnapshot。
3. 删除从 `state` 读取 preview 的逻辑。

## Phase 4：清理旧模型

1. 删除旧的 render-state key（`nodePreview/routingDrag/selectionBox/...`）在 `StateSnapshot` 中的定义。
2. 删除相关转发 writer/gateway 旧字段。
3. 清理未使用命令与类型（box 相关旧 command 等）。

---

## 10. 迁移映射（旧 -> 新）

1. `state.nodePreview` -> `render.node.previewById`
2. `state.dragGuides` -> `render.node.guides`
3. `state.edgeConnect` -> `render.edge.connect`
4. `state.routingDrag` -> `render.edge.routing`
5. `state.mindmapDrag` -> `render.mindmap.drag`
6. `state.selectionBox` -> `render.selection.box`
7. `state.interactionSession` -> `render.interaction.session`
8. `state.spacePressed` -> `render.keyboard.spacePressed`
9. `state.viewportGesture` -> `render.viewport.gesture`

---

## 11. 验收标准

功能：

1. 所有 move 阶段不写 document。
2. 所有 end 阶段只提交一次或极少 mutation。
3. cancel 后 preview 全清理，不污染稳定态。

性能：

1. `drag-frame`、`node-transform-frame`、`edge-routing-frame` 不回退。
2. viewport pan/wheel 交互无卡顿。

可维护性：

1. 新同学可按目录直接定位：`input -> render -> view`。
2. 不再出现 preview 逻辑散在 input/view/state 多层重复实现。

---

## 12. 风险与规避

1. 风险：迁移期 session 与 render actor 状态不同步。  
规避：所有 session 活跃态只认 `render.interaction.session`。

2. 风险：view 订阅双源后触发频率上升。  
规避：按 slice 精确 watch，domain 内局部比较更新。

3. 风险：一次性替换改动面大。  
规避：按 domain 批次迁移，但不留双轨兼容代码。

---

## 13. 建议执行顺序

1. 先迁 `viewport + selection`（边界最清晰，回归快）。
2. 再迁 `edge`（收益最大）。
3. 再迁 `node/mindmap`（依赖更多）。
4. 最后做类型和命名收官。

最终完成态：`RenderActor` 成为预览唯一事实源，Input 与 View 都只围绕它协作。
