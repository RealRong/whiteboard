# Whiteboard Atom 数据系统性能重构方案（最终版）

## 1. 结论

当前系统不是单点问题（不只是 `state/view/derivations.ts`），而是整条链路都存在“高频交互触发全量重算”的结构性风险。  
如果目标是“性能最优、可推倒重来”，建议采用“**写路径事件驱动 + 读路径数据驱动**”的混合范式：

1. **写路径事件驱动**：`commands -> domain events -> 增量更新受影响索引/缓存 -> 标记 revision`  
2. **读路径数据驱动**：`view/query` 按需读取，按 revision 脏标记重算  
3. **Engine 内核改为实例级 store（非全局 Jotai store）**，Jotai 仅保留 React 适配层

---

## 1.1 当前落地状态（2026-02-17）

已完成：

1. `createState()` 已切换为实例级 `WritableStore`，不再使用 `getDefaultStore()`。  
`packages/whiteboard-engine/src/state/factory/index.ts`
2. `state/derived/*` 已删除，`visibleNodes/canvasNodes/visibleEdges` 收敛到 `GraphStateCache`。  
`packages/whiteboard-engine/src/kernel/state/graph.ts`
3. `state/view/*` 已迁移到 `kernel/view/*`。  
`packages/whiteboard-engine/src/kernel/view/registry.ts`
4. React 侧实例注入已切换为 `InstanceProvider/useInstance`。  
`packages/whiteboard-react/src/common/hooks/useInstance.ts`
5. `useWhiteboardSelector(selector)` 已强制显式传 `keys`，避免默认全量订阅。  
`packages/whiteboard-react/src/common/hooks/useWhiteboardSelector.ts`
6. `state.batch(action)` 已落地，支持多次写入合并通知，热点命令已接入（selection/transient reset/edge select/node drag）。  
`packages/whiteboard-engine/src/kernel/state/WritableStore.ts`  
`packages/whiteboard-engine/src/api/commands/selection.ts`  
`packages/whiteboard-engine/src/api/commands/transient.ts`
7. `state.batchFrame(action)` 已落地，高频 pointermove 路径已接入（node drag / node transform / mindmap drag）。  
`packages/whiteboard-engine/src/kernel/state/WritableStore.ts`  
`packages/whiteboard-engine/src/runtime/services/NodeDrag.ts`  
`packages/whiteboard-engine/src/api/commands/node.ts`
8. Query projector + 增量索引已落地（先覆盖 `canvas/snap`）。  
`packages/whiteboard-engine/src/api/query/projector.ts`  
`packages/whiteboard-engine/src/api/query/indexes.ts`  
`packages/whiteboard-engine/src/api/query/instance.ts`
9. `edge` 视图路径缓存已接入“按节点变更增量更新”（避免每次 `canvasNodes` 变更都全量扫描所有边）。  
`packages/whiteboard-engine/src/kernel/view/edgeQuery.ts`  
`packages/whiteboard-engine/src/api/query/indexes.ts`
10. `view` 层 projector 已落地（edge/mindmap 关键 key 预热）。  
`packages/whiteboard-engine/src/kernel/derive/registry.ts`  
`packages/whiteboard-engine/src/kernel/view/registry.ts`
11. `view` 已新增实体粒度 API（`node/edge` 的 id 列表 + by-id 读取/订阅），React `NodeLayer/EdgeLayer` 已切换为按 id 订阅。  
`packages/whiteboard-engine/src/types/instance/index.ts`  
`packages/whiteboard-engine/src/kernel/view/registry.ts`  
`packages/whiteboard-react/src/node/components/NodeLayer.tsx`  
`packages/whiteboard-react/src/edge/components/EdgeLayer.tsx`
12. `node.items` / `node.transformHandles` 已从“derive 全量读取”改为“registry 内部按 nodeId 增量投影”；`view.read/watch` 对这两个 key 已改为读取增量缓存，避免整图派生重建。  
`packages/whiteboard-engine/src/kernel/view/registry.ts`
13. `kernel/view/derivations.ts` 中 `node.items` / `node.transformHandles` 已降级为无依赖占位 derive（由 registry 增量逻辑接管），移除这两个 key 的 state 依赖监听链路。  
`packages/whiteboard-engine/src/kernel/view/derivations.ts`
14. 节点增量投影调试指标已接入 `view.debug`：`node.items` / `node.transformHandles` 现在有独立 `revision/dirty/recompute/hitRate/耗时` 指标，并支持 `getMetrics/getAllMetrics/resetMetrics`。  
`packages/whiteboard-engine/src/kernel/view/registry.ts`
15. `canvasNodes` 高频路径已升级为事件驱动 dirty-set：命令层通过 `state.reportCanvasNodeDirty(nodeIds)` 上报受影响节点，`state.watchCanvasNodeChanges` 分发增量事件；`view/query` 优先走 dirty 增量同步，必要时 fallback 全量同步。  
`packages/whiteboard-engine/src/api/commands/transient.ts`  
`packages/whiteboard-engine/src/state/factory/index.ts`  
`packages/whiteboard-engine/src/kernel/view/registry.ts`  
`packages/whiteboard-engine/src/api/query/projector.ts`  
`packages/whiteboard-engine/src/api/query/indexes.ts`
16. `doc` 结构性变更已补齐 dirty 语义：`docEvents` 现在对 core operations 做分层推断（`node.update` 非结构 patch -> dirty；结构 patch -> full sync；`node.order.*`/`layer` 走 `orderChanged` 增量）；并通过 `state.requestCanvasNodeFullSync()` / `state.reportCanvasNodeDirty(..., 'doc')` / `state.reportCanvasNodeOrderChanged('doc')` 回灌状态层；状态层已按 `runtime/doc` 双通道隔离 dirty，避免跨来源互相污染。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`  
`packages/whiteboard-engine/src/state/factory/index.ts`  
`packages/whiteboard-engine/src/runtime/lifecycle/Lifecycle.ts`
17. `order-only` 增量路径已落地：`query` 新增 `syncOrder`，`view` 新增 `syncCanvasNodeOrder`，`state.watchCanvasNodeChanges` payload 新增 `orderChanged`，从而在 `node.order`/`layer` 场景下仅同步顺序，不触发节点 map 全量重建。  
`packages/whiteboard-engine/src/api/query/indexes.ts`  
`packages/whiteboard-engine/src/api/query/projector.ts`  
`packages/whiteboard-engine/src/kernel/view/registry.ts`  
`packages/whiteboard-engine/src/types/instance/index.ts`
18. `fullSync` 语义已从 `orderChanged` 中解耦：`watchCanvasNodeChanges` payload 新增并贯通 `fullSync`，`state.requestCanvasNodeFullSync()` 现在明确下发 `fullSync: true`，`query/view` projector 优先走 `syncFull`，避免被误判为 `order-only`。  
`packages/whiteboard-engine/src/state/factory/index.ts`  
`packages/whiteboard-engine/src/api/query/projector.ts`  
`packages/whiteboard-engine/src/kernel/view/registry.ts`  
`packages/whiteboard-engine/src/types/instance/index.ts`
19. `create/delete` 已从 full fallback 下沉为增量路径：`docEvents` 对 `node.create/node.delete` 改为 `dirty + orderChanged`，`NodeRectIndex/SnapIndex` 支持缺失节点 `upsert/remove`，`view` 的 `syncCanvasNodesDirty` 也支持新增/删除节点增量投影。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`  
`packages/whiteboard-engine/src/api/query/indexes.ts`  
`packages/whiteboard-engine/src/kernel/view/registry.ts`
20. `node.update` 的 `data` patch 已加语义兜底：当 `group` 的 `collapsed` 状态变化时，`docEvents` 走“group 子树 dirty + orderChanged”增量路径（不再 fullSync），避免仅 dirty 当前 group 导致后代可见性与边集增量不完整。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
21. `node.update` 的 `parentId` 结构变更已从 full fallback 下沉为增量路径：`docEvents` 现在按“变更节点子树 dirty + orderChanged”处理跨组挂载变化，减少拖拽挂组场景的全量同步。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
22. `node.update` 的 `type` 结构变更已下沉为分级增量策略：普通类型切换仅 dirty 当前节点；涉及 `mindmap` 切换附带 `orderChanged`；涉及 `group` 切换按子树 dirty + `orderChanged` 处理。仅在缺少前后类型快照时保守 fullSync。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
23. `node.delete` 已补齐 group 语义：删除 `group` 时改为“group 子树 dirty + orderChanged”，并额外标记被删节点祖先链上的 group 为 dirty，降低删除场景下的可见性与 group 尺寸同步遗漏风险。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
24. `node.create` 已与 `delete` 做对称处理：创建节点时在 `dirty(自身) + orderChanged` 的基础上，额外标记祖先链 group 为 dirty，保证组内新增节点后的 group 级视图/尺寸同步及时触发。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
25. `node.order.*` 已补齐 group 关联 dirty：在 `orderChanged` 之外，按受影响节点集合标记祖先链 group 为 dirty，降低组内排序调整后的 group 级渲染/状态延迟风险。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
26. `docEvents` 的节点快照读取已改为按需懒加载：`core.query.node.list()`、`nodeById`、`childrenByParent` 仅在命中祖先/子树推导分支时初始化，降低高频事务下无关映射构建开销。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
27. `docEvents` 已增加“无 `node.*` 操作快速返回”路径：纯 edge/mindmap 事务不再进入 canvas node dirty hint 计算链路，进一步减少无关事务开销。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
28. `markSubtreeDirty` / `markAncestorGroupsDirty` 已增加热路径复用：新增 `subtreeCoveredNodeIds` 去重子树遍历，新增 `ancestorGroupChainCache` 复用祖先 group 链结果，降低大文档事务中的重复 DFS/回溯成本。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
29. `toCanvasNodeDirtyHint` 已从 `docEvents` watcher 抽离为独立策略模块，`docEvents` 收敛为事件监听壳层，便于单测与后续性能演进。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/nodeHint.ts`  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/docEvents.ts`
30. micro-benchmark 基线已接入：新增 `nodeHint.bench.ts` 与 `bench:node-hint` 脚本，可在本地快速回归 `node hint` 热路径性能。  
`packages/whiteboard-engine/src/runtime/lifecycle/watchers/nodeHint.bench.ts`  
`packages/whiteboard-engine/package.json`

下一阶段（可选优化）：

1. 继续细化 `node.update` 中其余 `data` patch 的语义分类（例如未来若新增影响可见性/拓扑的字段），在保证正确性的前提下进一步减少 full fallback。
2. 为 `bench:node-hint` 增加“阈值报警/历史对比”机制（例如 CI 中记录上一基线），避免热路径退化无感知。

---

## 2. 历史问题审计（关键问题）

### A. Store 与实例隔离问题（高优先级）

1. ~~`createState()` 使用 `getDefaultStore()`，是全局 store。~~（已修复）  
现状：实例级 `WritableStore`。  
`packages/whiteboard-engine/src/state/factory/index.ts`
2. ~~`docAtom` / `instanceAtom` 全局 atom。~~（已修复）  
现状：已删除 `instanceAtom`；`doc` 由实例 `state.setDoc` 注入。  
`packages/whiteboard-react/src/Whiteboard.tsx`
3. ~~React 侧通过全局 `instanceAtom` 取实例。~~（已修复）  
现状：`InstanceProvider + useInstance`。  
`packages/whiteboard-react/src/common/hooks/useInstance.ts`

影响：多实例时会互相污染；即使单实例，也会放大不必要订阅范围。

---

### B. 派生通知机制问题（高优先级）

1. 依赖变化时，`derive registry` 先 `dirty + notify`，再由 watcher 内 `read()` 触发计算。  
`packages/whiteboard-engine/src/kernel/derive/registry.ts`
2. `useWhiteboardView` 在每次通知里都会立刻 `read()`。  
`packages/whiteboard-react/src/common/hooks/useWhiteboardView.ts:25`
3. `markKeyDirty` 不去重（已 dirty 也继续 notify），高频事件下会重复触发。  
`packages/whiteboard-engine/src/kernel/derive/registry.ts`

影响：高频输入（drag/resize/hover）时，容易“重复通知 + 重复计算尝试”。

---

### C. 大 key 派生全量重算（高优先级）

1. `node.items` / `node.transformHandles` 都是大列表派生。  
`packages/whiteboard-engine/src/kernel/view/derivations.ts`
2. 依赖包含整个 `viewport`，即便仅平移（center 变化）也触发整表计算。  
`packages/whiteboard-engine/src/kernel/view/derivations.ts`
3. `NodeLayer` 直接消费整个 `node.items` 列表，节点级更新无法局部订阅。  
`packages/whiteboard-react/src/node/components/NodeLayer.tsx:5`

影响：节点多时，任何高频变更都可能导致全层重算/重渲染。

---

### D. transient 写入触发整条 state/derived 链（高优先级）

1. 拖拽每帧写 `nodeOverrides`。  
`packages/whiteboard-engine/src/runtime/services/NodeDrag.ts:164`
2. `viewNodesAtom` 虽做了局部替换，但上游 `visibleNodes/canvasNodes/visibleEdges` 仍会重建集合。  
`packages/whiteboard-engine/src/state/derived/viewNodes.ts:97`  
`packages/whiteboard-engine/src/state/derived/nodes.ts:21`  
`packages/whiteboard-engine/src/state/derived/edges.ts:7`
3. `viewNodesCache` 是模块级全局变量，不是实例级。  
`packages/whiteboard-engine/src/state/derived/viewNodes.ts:14`

影响：拖拽一个节点会牵连边、路径、snap 等多个模块级缓存失效。

---

### E. Query 缓存按数组引用失效，导致重建（高优先级）

1. `canvas query` 以 `canvasNodes` 引用变化为失效条件，失效后全量重建 rect map。  
`packages/whiteboard-engine/src/api/query/canvas.ts:43`
2. `snap query` 同理，失效后全量重建 candidates + grid index。  
`packages/whiteboard-engine/src/api/query/snap.ts:35`
3. `NodeDrag.resolveMove` 每帧调用 `getSnapCandidatesInRect`。  
`packages/whiteboard-engine/src/runtime/services/NodeDrag.ts:134`
4. `NodeTransform` resize 也走同一套 snap 查询。  
`packages/whiteboard-engine/src/runtime/services/NodeTransform.ts:108`

影响：拖拽/缩放高频路径中存在 O(N)~O(N+E) 重建，吞吐上限低。

---

### F. 结构拆分粗粒度（中高优先级）

1. `selection` 原子合并了 `selectedNodeIds + selectionRect + isSelecting + mode`。  
`packages/whiteboard-engine/src/state/atoms.ts:21`  
`packages/whiteboard-engine/src/api/commands/selection.ts:81`
2. `useWhiteboardSelector` 函数模式默认订阅 `STATE_KEYS`（全量），存在误用风险。  
`packages/whiteboard-react/src/common/hooks/useWhiteboardSelector.ts:54`
3. `Whiteboard.tsx` 同时 `useHydrateAtoms` + `setDoc/setInstance`，重复写入。  
`packages/whiteboard-react/src/Whiteboard.tsx:110`

---

## 3. 最优目标架构（推倒重来版）

## 核心原则

1. **单实例单 store**：任何状态都必须绑定到具体 whiteboard 实例。  
2. **写路径事件驱动增量化**：按 entity id 精准更新，不按“大数组引用”粗暴失效。  
3. **读路径数据驱动按需化**：`read` 只在相关 revision 变化时重算。  
4. **高频路径冻结/局部更新**：drag/resize 期间避免全图重建索引。  
5. **Engine 驱动，React 薄渲染**：React 不做重计算，只订阅渲染模型。

## 写读分离原则

1. **写入只走事件管线**：禁止在 handler 中散落 `set map`。  
2. **读模型只走 query/view**：禁止在 UI 层拼接复杂派生数据。  
3. **事件只负责“变更”**，派生只负责“读取”。  
4. **同一能力只有一个写入口**（commands/events projector），避免并发写口。

---

## 4. 新的数据层分层

## 4.1 Engine Store（内核，非 React）

建议自研轻量 store（或极简 signal store），包含：

1. `model`（文档结构）：nodes/edges/order/mindmap（规范化存储）  
2. `runtime`（交互状态）：tool、pointer、drag、transform、connect  
3. `transient`（高频临时态）：overrides/guides/hover candidates  
4. `rev`（revision）：  
`rev.global`、`rev.nodes[id]`、`rev.edges[id]`、`rev.selection`、`rev.viewport.zoom`、`rev.viewport.center` 等

写入流程（事件驱动）：

1. `commands` 产生领域事件（如 `node.moved`, `edge.reconnected`, `selection.changed`）  
2. `projector/reducer` 只更新受影响实体（node/edge/index/cache）  
3. 精准 bump 对应 revision key（而非 global 全量 bump）

## 4.2 Query/Geometry 基础设施（内核）

提供实例级索引与增量更新：

1. `NodeRectIndex`：`id -> rect/aabb/rotation`，按 dirty node 更新  
2. `SnapIndex`：支持 `upsert/remove(id)`；drag 期间可冻结 static index + 动态排除 moving set  
3. `EdgeAdjIndex`：`nodeId -> edgeIds[]`，节点几何变化时仅重算相邻边  
4. `MindmapLayoutIndex`：按 treeId + layout signature 缓存

## 4.3 View Derive（内核）

从“大 key 全量 derive”改为“实体粒度 derive”：

1. `view.nodeIds`（顺序）  
2. `view.nodeItem(id)`（单节点渲染模型）  
3. `view.nodeHandles(id)`  
4. `view.edgeIds`  
5. `view.edgePath(id)`  
6. `view.edgePreview`（全局少量 key）  
7. `view.mindmapTree(id)` / `view.mindmapIds`

规则：  
`read(key)` 必须只在相关 revision 变化时计算；计算后仅在 value 变化时通知订阅者。

读取流程（数据驱动）：

1. 读取时检查依赖 revision；未变直接命中缓存  
2. 变更后按 key/id 粒度重算并复用未变对象引用  
3. 通知订阅者时只广播 value 发生变化的 key/id

---

## 5. React 适配层（薄层）

## 5.1 实例隔离

1. 每个 `<Whiteboard>` 创建独立 store/provider。  
2. 去掉全局 `docAtom`/`instanceAtom` 导出；改为组件内 provider + `useInstance()` 从本地上下文取值。

## 5.2 订阅模型

1. 列表组件只订阅 id 列表：  
`NodeLayer -> nodeIds`、`EdgeLayer -> edgeIds`
2. 行项组件按 id 订阅自身模型：  
`NodeItem(id) -> nodeItem(id), nodeHandles(id)`  
`EdgeItem(id) -> edgePath(id), edgeMeta(id)`
3. `useWhiteboardSelector` 函数模式必须强制传 `keys`（类型层禁止默认全量订阅）。

---

## 6. 目录重构建议（简洁命名）

```text
packages/whiteboard-engine/src/
  store/
    state.ts               # runtime/model/transient/revision
    subscribe.ts
  query/
    nodeRect.ts
    snapIndex.ts
    edgeAdj.ts
    mindmapLayout.ts
  derive/
    registry.ts
    node/
      ids.ts
      item.ts
      handles.ts
    edge/
      ids.ts
      path.ts
      preview.ts
    mindmap/
      ids.ts
      tree.ts
  react-adapter/
    provider.tsx
    hooks/
      useInstance.ts
      useView.ts
      useSelector.ts
```

说明：`state/derived/view` 老结构可整体下线，避免“state 里再套 view”的语义混乱。

---

## 7. 分阶段落地（无兼容负担版）

## Phase 0：基线与观测（先做）

1. 保留现有 `view.debug`，增加 query/index 的计数与耗时采样。  
2. 建立性能基线：drag/resize/edge reconnect 的帧时间、重算次数。

## Phase 1：实例隔离与适配层重构

1. 去掉 `getDefaultStore` 全局依赖，改实例级 store。  
2. 去掉全局 `docAtom/instanceAtom`。  
3. React 侧改为本地 provider。

## Phase 2：Query 基础设施增量化

1. 上线 `NodeRectIndex` / `SnapIndex` / `EdgeAdjIndex`。  
2. 让 drag/resize 不再触发全量 index rebuild。

## Phase 3：View 粒度重构

1. 用 `nodeIds + nodeItem(id)` 替代 `node.items`。  
2. 用 `edgeIds + edgePath(id)` 替代 `edge.paths`。  
3. `mindmap.trees` 拆到 tree 粒度。

## Phase 4：删除旧链路

1. 删除 `state/derived/*` 和旧 `state/view/*`。  
2. 删除 `useWhiteboardView` 旧大 key 模式。

---

## 8. 性能验收标准（建议）

1. 拖拽单节点时：`snapIndex` 不允许每帧全量 rebuild。  
2. 5000 nodes / 10000 edges：普通拖拽主线程计算预算 < 4ms/帧（P95）。  
3. 非相邻边路径不得重算（仅 node adjacency 命中边重算）。  
4. NodeLayer 渲染更新应限制在“受影响节点子集”，不允许全量 NodeItem 重新渲染。

---

## 9. 直接回答你的问题

除了 `packages/whiteboard-engine/src/state/view/derivations.ts`，**同类可优化点非常多**，尤其是：

1. `state/derived/*` 的全量集合重建链  
2. `api/query/canvas.ts` 与 `api/query/snap.ts` 的引用级全量失效  
3. `NodeDrag` / `NodeTransform` 高频写 transient 导致全图联动失效  
4. 全局 store/atom 造成实例边界不清  
5. derive 通知时机与去重策略不足

结论：建议直接按本方案重建，而不是局部 patch。

补充决策：  
不采用“纯数据驱动全量派生”，也不采用“纯 handler 即时 set map”。  
最终采用：**事件驱动写入（精准失效） + 数据驱动读取（按需重算）**。

---

## 10. 自建内核详细设计（性能优先版）

### 10.1 内核分层蓝图

目标：把“写入、索引、派生、订阅、监控”拆成独立层，职责单一，避免 React 反向驱动计算。

1. `kernel/store`  
管理 `model/runtime/transient/rev` 四类状态与事务边界，不做业务计算。
2. `kernel/events`  
统一实例事件中心，仅暴露 `on/off` 给外部；`emit` 仅内核可用。
3. `kernel/project`  
领域事件投影器（projector），负责增量写入 `store` 与同步 `index`。
4. `kernel/index`  
可增量维护的查询索引：`nodeRect`、`snap`、`edgeAdj`、`tree`。
5. `kernel/query`  
只读 API，直接读 `store/index`，禁止写入。
6. `kernel/derive`  
渲染模型派生注册中心，按 `rev` 与 `id` 粒度失效。
7. `kernel/view`  
对上层暴露订阅模型：`ids/item/path/preview`。
8. `kernel/metrics`  
重算次数、命中率、耗时采样。

### 10.2 写入流水线（事件驱动）

统一链路：`command -> event -> project -> rev bump -> derive dirty -> notify`

1. `commands` 只做参数校验和意图表达，输出一个或多个领域事件。  
示例：`moveNode` 输出 `node.moved`。
2. `project` 接收事件并增量更新状态与索引。  
示例：更新节点坐标后，仅 `upsert` 受影响的 `nodeRect/snap`。
3. `rev` 仅 bump 受影响 key。  
示例：`node:42`、`edge:1`、`selection`，禁止无差别 bump `global`。
4. `derive` 根据依赖图标脏。  
示例：`node.item:42` 脏时，不影响 `node.item:41`。
5. `view` 在一次批处理中通知订阅者，且只在值引用变化时通知。

高频事件规则（drag/resize/pointermove）：

1. 帧内合并同 key 写入（last-write-wins）。  
2. 每帧最多一次 flush（`requestAnimationFrame` 或微任务批处理）。  
3. 禁止在 pointermove 中做全量索引 rebuild。

### 10.3 读取流水线（数据驱动）

统一链路：`query/view read -> rev signature check -> cache hit/miss -> optional recompute`

1. `query` 直接读取 `store/index`，不走 derive 注册。  
适用于命中测试、锚点、吸附候选等工具性读取。
2. `view.get(key)` 先比对依赖签名（rev tuple）。  
未变化直接返回缓存，变化才重算。
3. `view.subscribe(key)` 只订阅目标 key。  
列表层订阅 `ids`，项层订阅 `item(id)`，禁止大 key 全量订阅。
4. 缓存值必须尽量复用引用。  
未变对象保持同一引用，避免 React 误重渲染。

### 10.4 基础接口契约（最终版）

对外只保留四类入口：

1. `instance.commands`  
唯一写入口，命名用动词短语：`moveNode`、`resizeNode`、`connectEdge`。
2. `instance.events`  
统一事件入口，仅 `on/off`：  
`on(type, listener)`、`off(type, listener)`。
3. `instance.query`  
只读即时查询：`nodeRect(id)`、`edgeAdj(id)`、`snapInRect(rect, opts)`。
4. `instance.view`  
渲染模型查询/订阅：`ids(type)`、`item(type, id)`、`subscribe(key, cb)`。

约束：

1. 不再暴露 `instance.runtime.eventBus`。  
2. 不再暴露额外写路径（如历史 `api` 别名）。  
3. React 侧只消费 `commands/query/view/events`，不直接触碰内核状态对象。

### 10.5 命名规范（简短且可读）

目录命名：

1. 用“空间 + 职责”短名：`runtime/edge`、`kernel/index`。  
2. 禁止目录和文件语义重复：在 `events/` 下不要再叫 `xxxEvents.ts`。  
3. 单文件目录默认收敛：能并入上层就不保留空壳目录。

文件命名：

1. Class 文件用 PascalCase：`NodeDrag.ts`、`Lifecycle.ts`。  
2. 函数文件用 camelCase：`createStore.ts`、`buildEdgePath.ts`。  
3. `index.ts` 只用于聚合导出或该目录确实只有一个核心实现。

标识符命名：

1. Class：PascalCase，避免后缀冗余。  
`NodeDrag`（优于 `NodeDragRuntimeService`）。
2. 函数/变量：camelCase。  
`moveNode`、`nodeRect`、`edgePath`。
3. 命令名：动词开头，表达意图。  
`startConnect`、`commitSelection`。
4. 事件名：`domain.action` 的点分格式，动作为过去式。  
`node.moved`、`edge.reconnected`、`selection.changed`。
5. 查询名：名词或短动宾，避免 `get` 滥用。  
`nodeRect`（优于 `getNodeRectById`）。
6. 视图键名：`scope.unit[:id]`。  
`node.ids`、`node.item:42`、`edge.path:7`。

反例（避免）：

1. `whiteboardInstanceRuntimeEvents.ts`（多重冗余前后缀）。  
2. `runtime/edgeRuntime/edgeRuntimeService.ts`（目录+文件+类型重复）。  
3. `getResolvedComputedEdgeConnectPreview`（过长且语义堆叠）。

### 10.6 建议目录（自建内核最终版）

```text
packages/whiteboard-engine/src/
  kernel/
    store/
      createStore.ts
      tx.ts
      rev.ts
    events/
      map.ts
      bus.ts
    project/
      node.ts
      edge.ts
      selection.ts
      viewport.ts
    index/
      nodeRect.ts
      snap.ts
      edgeAdj.ts
      tree.ts
    query/
      nodeRect.ts
      snap.ts
      hit.ts
      edge.ts
    derive/
      registry.ts
      deps.ts
      node/
        ids.ts
        item.ts
        handles.ts
      edge/
        ids.ts
        path.ts
        preview.ts
      mindmap/
        ids.ts
        tree.ts
    view/
      api.ts
      subscribe.ts
    metrics/
      counters.ts
      sample.ts
  runtime/
    dom/
      container.ts
      window.ts
  instance/
    create.ts
    Instance.ts
```

说明：

1. `kernel` 纯引擎，不依赖 React。  
2. `runtime/dom` 可选，属于平台输入适配层。  
3. `instance` 只做组装，不写业务逻辑。

### 10.7 性能硬约束（内核级）

1. 高频写路径（drag/resize/connect）禁止 O(N) 全量重建。  
2. 所有索引必须支持 `upsert/remove` 增量更新。  
3. derive 失效必须支持 `id` 粒度，而不是列表粒度。  
4. 通知必须去重与批处理，禁止“同一帧多次相同 key 通知”。  
5. 所有 query/view 提供命中率与耗时指标，作为回归门禁。

### 10.8 Atom 去留（最终决策）

1. 引擎内核不再依赖 Jotai/atom 作为主存储。  
2. React 侧可保留极薄 atom 适配（仅桥接订阅），不承载核心业务状态。  
3. 所有核心状态、索引、revision、derive 均归 `kernel/store` 管理。  
4. 未来接入 Vue/Canvas/WebGL，只需替换 adapter，不改内核计算链路。
