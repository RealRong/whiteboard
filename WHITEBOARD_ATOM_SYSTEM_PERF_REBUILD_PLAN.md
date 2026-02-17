# Whiteboard Atom 数据系统性能重构方案（最终版）

## 1. 结论

当前系统不是单点问题（不只是 `state/view/derivations.ts`），而是整条链路都存在“高频交互触发全量重算”的结构性风险。  
如果目标是“性能最优、可推倒重来”，建议采用“**写路径事件驱动 + 读路径数据驱动**”的混合范式：

1. **写路径事件驱动**：`commands -> domain events -> 增量更新受影响索引/缓存 -> 标记 revision`  
2. **读路径数据驱动**：`view/query` 按需读取，按 revision 脏标记重算  
3. **Engine 内核改为实例级 store（非全局 Jotai store）**，Jotai 仅保留 React 适配层

---

## 2. 现状审计（关键问题）

### A. Store 与实例隔离问题（高优先级）

1. `createState()` 使用 `getDefaultStore()`，是全局 store。  
`packages/whiteboard-engine/src/state/factory/index.ts:18`
2. `docAtom` / `instanceAtom` 也是全局 atom。  
`packages/whiteboard-engine/src/state/contextAtoms.ts:5`
3. React 侧通过全局 `instanceAtom` 取实例。  
`packages/whiteboard-react/src/common/hooks/useInstance.ts:5`

影响：多实例时会互相污染；即使单实例，也会放大不必要订阅范围。

---

### B. 派生通知机制问题（高优先级）

1. 依赖变化时，`derive registry` 先 `dirty + notify`，再由 watcher 内 `read()` 触发计算。  
`packages/whiteboard-engine/src/infra/derive/createDerivedRegistry.ts:123`
2. `useWhiteboardView` 在每次通知里都会立刻 `read()`。  
`packages/whiteboard-react/src/common/hooks/useWhiteboardView.ts:25`
3. `markKeyDirty` 不去重（已 dirty 也继续 notify），高频事件下会重复触发。  
`packages/whiteboard-engine/src/infra/derive/createDerivedRegistry.ts:126`

影响：高频输入（drag/resize/hover）时，容易“重复通知 + 重复计算尝试”。

---

### C. 大 key 派生全量重算（高优先级）

1. `node.items` / `node.transformHandles` 都是大列表派生。  
`packages/whiteboard-engine/src/state/view/derivations.ts:158`
2. 依赖包含整个 `viewport`，即便仅平移（center 变化）也触发整表计算。  
`packages/whiteboard-engine/src/state/view/derivations.ts:158`
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
