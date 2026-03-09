# Engine Fine-Grained Selection / Node / Edge Plan

## 1. 结论

长期最优不是：

1. 继续只用 `READ_KEYS.node / edge / selection` 这种粗 topic fan-out
2. 也不是把整个 engine/read 全量改成 Jotai 或 signal graph

长期最优是一条明确的混合路线：

1. **结构层保留粗粒度**
2. **实体层改成细粒度**
3. **engine 输出 headless 的细粒度读接口与失效事实**
4. **react 只负责把这些接口包装成语义 hook**

对应到三个目标：

1. `selection.contains(nodeId)` 放在 `instance.state.selection`，由 `whiteboard-react` 负责
2. `read.node.get(nodeId)` 放在 `instance.read.node`，由 `whiteboard-engine/read` 负责
3. `read.edge.get(edgeId)` 放在 `instance.read.edge`，由 `whiteboard-engine/read` 负责

最终推荐的 headless API 不是 `byId(...)` 风格，而是统一成：

```ts
instance.state.selection.get()
instance.state.selection.contains(nodeId)
instance.state.selection.selectedEdgeId()
instance.state.selection.subscribe(listener)
instance.state.selection.subscribeNode(nodeId, listener)
instance.state.selection.subscribeEdge(listener)

instance.read.node.ids()
instance.read.node.get(nodeId)
instance.read.node.subscribe(nodeId, listener)
instance.read.node.subscribeIds(listener)

instance.read.edge.ids()
instance.read.edge.get(edgeId)
instance.read.edge.subscribe(edgeId, listener)
instance.read.edge.subscribeIds(listener)
```

React 最终只暴露语义 hook：

```ts
useSelectionContains(nodeId)
useSelectedEdgeId()
useNodeIds()
useNode(nodeId)
useEdgeIds()
useEdge(edgeId)
```

## 2. 为什么当前方案不是长期最优

## 2.1 `selection` 当前是整包订阅

当前 `selection` 是 `whiteboard-react` 的 editor state：

- 文件：`packages/whiteboard-react/src/common/instance/uiState.ts`
- 当前 source of truth：
  - `selectedNodeIds: Set<NodeId>`
  - `selectedEdgeId?: EdgeId`
  - `mode: SelectionMode`

当前 `useWhiteboardSelector((snapshot) => snapshot.selection.selectedNodeIds.has(node.id), { keys: ['selection'] })`
本质上仍然是：

1. 订阅整个 `selection` 域
2. `selection` 任意变化时，所有依赖 `selection` 的 selector 全部唤醒
3. 再靠 `Set.has(nodeId)` 的结果比较挡住真正的 rerender

问题不是语义不对，而是 fan-out 太大。

## 2.2 `read.node.byId.get(nodeId)` 仍然依赖聚合视图

当前 node projection 文件：

- `packages/whiteboard-engine/src/read/projection/node.ts`

虽然内部已有：

- `nodeItemCacheById: Map<NodeId, NodeViewItem>`

但 public 读口的本质仍然是：

1. 先拿整个 `NodesView`
2. 再从 `NodesView.byId` 上取 `nodeId`

也就是说，当前 `read.node.byId.get(nodeId)` 不是一个真正独立的实体读口，而是聚合视图上的二次查询。

这会带来两个问题：

1. `node` topic 变化时，所有 node entity 订阅者都会被唤醒
2. 第一批读取还会触发一次 `NodesView` 的全量 reconcile

## 2.3 `read.edge.byId.get(edgeId)` 已有实体缓存，但通知仍停在 topic 级

当前 edge projection 文件：

- `packages/whiteboard-engine/src/read/projection/edge.ts`

它已经具备一半实体级基础设施：

1. `cacheById`
2. `pendingNodeIds`
3. `pendingEdgeIds`
4. `relations.nodeToEdgeIds`
5. `reconcileEdges(affectedEdgeIds)`

这说明 edge 的增量计算其实已经接近目标。

当前真正的问题是：

- React 侧仍然只能订阅 `READ_KEYS.edge`
- 所有 `edgeId` 读者仍然会一起被唤醒

因此 edge 的主要瓶颈不是计算，而是 **通知粒度仍然粗**。

## 3. 当前 topic 模式的真实成本

当前模型做到的是：

1. **通知粒度粗**
2. **rerender 粒度细**

即：

1. 某个 topic 变化后，所有订阅该 topic 的 subscriber 都会被唤醒
2. 每个 subscriber 重新执行 getter
3. 如果 getter 结果引用没变，最终 React 不 rerender

这比“所有组件都重渲染”要好，但仍然会在几千节点/边下形成可观的：

1. listener callback fan-out
2. `Map.get / Set.has / Object.is` fan-out
3. `useSyncExternalStore` snapshot fan-out

如果更新是低频提交，这个成本通常还能接受。

如果更新进入高频路径，例如：

1. 每帧 selection 变化
2. 每帧 node geometry commit
3. 每帧 edge geometry commit

那么 topic 模式会明显放大主线程压力。

## 4. 最优边界

## 4.1 `selection` 应该在 `instance.state`，不是 `engine.read`

`selection` 的长期归属应该是：

- `instance.state.selection`

而不是：

- `instance.read.selection`
- `instance.ui.selection`

理由：

1. `selection` 是 editor semantic state，不是 document fact
2. 它已经由 `whiteboard-react` 维护，而不是 engine 维护
3. 它影响交互、命令、快捷键、视觉呈现，不是纯展示局部状态
4. 把它放在 `state`，边界最清楚

因此：

- `selection` 应该继续附加在最终 `whiteboard instance` 上
- 它的细粒度化也应该发生在 `whiteboard-react` 的 state layer

## 4.2 `node` / `edge` 应该在 `engine.read`

`node` 与 `edge` 的实体读口本质是 engine read model，不应该被挪到 React 本地状态。

理由：

1. dirty ids 已经在 engine 中产生
2. geometry / projection / relations 的事实都在 engine
3. 若 React 自己重建 per-id invalidation，会复制 engine 已经掌握的知识
4. 真正能降低复杂度的是让 engine 保留 dirty entity 到最后一层，而不是提前折叠成 topic

因此：

- `node` / `edge` 的细粒度实体读口必须由 `whiteboard-engine/read` 提供
- React 只做消费与 hook 封装

## 5. 最优 API

## 5.1 `selection`

长期最优不是只保留一个粗粒度 `selection` snapshot。

推荐 headless API：

```ts
instance.state.selection.get(): EditorSelectionState
instance.state.selection.contains(nodeId: NodeId): boolean
instance.state.selection.selectedEdgeId(): EdgeId | undefined
instance.state.selection.subscribe(listener: () => void): () => void
instance.state.selection.subscribeNode(nodeId: NodeId, listener: () => void): () => void
instance.state.selection.subscribeEdge(listener: () => void): () => void
```

语义：

1. `get()`：整包 coarse snapshot
2. `contains(nodeId)`：细粒度 membership 读取
3. `selectedEdgeId()`：单值读取
4. `subscribe()`：整包 selection 订阅
5. `subscribeNode()`：某个 node 是否被选中的细粒度订阅
6. `subscribeEdge()`：edge selection 的细粒度订阅

为什么这是最优：

1. coarse 与 fine-grained 同时存在，职责清晰
2. `contains(nodeId)` 才是节点层真正需要的 API
3. `selectedEdgeId()` 比读取整个 selection snapshot 更短、更稳定
4. 不把 `selection` 错误地下沉到 engine

## 5.2 `node`

推荐 headless API：

```ts
instance.read.node.ids(): readonly NodeId[]
instance.read.node.get(nodeId: NodeId): NodeViewItem | undefined
instance.read.node.subscribe(nodeId: NodeId, listener: () => void): () => void
instance.read.node.subscribeIds(listener: () => void): () => void
```

语义：

1. `ids()`：结构层读取
2. `get(nodeId)`：实体层读取
3. `subscribe(nodeId)`：实体层订阅
4. `subscribeIds()`：结构层订阅

这里明确不推荐最终 public API 继续写成：

```ts
read.node.byId(nodeId)
read.node.byId.get(nodeId)
```

原因：

1. `byId` 更像内部数据结构，不像稳定语义动作
2. `get(id)` 更短、更标准、更适合作为 store/cell API
3. `ids/get/subscribe/subscribeIds` 四个能力组成了一个完整的实体读域闭包

## 5.3 `edge`

推荐 headless API：

```ts
instance.read.edge.ids(): readonly EdgeId[]
instance.read.edge.get(edgeId: EdgeId): EdgeEntry | undefined
instance.read.edge.subscribe(edgeId: EdgeId, listener: () => void): () => void
instance.read.edge.subscribeIds(listener: () => void): () => void
```

理由与 node 完全一致：

1. `ids()` 是结构层
2. `get(edgeId)` 是实体层
3. `subscribe(edgeId)` 是实体级失效面
4. `subscribeIds()` 是结构级失效面

## 5.4 为什么必须是四个能力

对实体读域来说，最小语义闭包就是四个问题：

1. 当前有哪些实体：`ids()`
2. 某个实体当前值是什么：`get(id)`
3. 结构变化如何通知：`subscribeIds()`
4. 某个实体变化如何通知：`subscribe(id)`

少一个都不完整。

所以这不是 API 膨胀，而是最小完备集合。

## 6. 推荐内部设计

## 6.1 `selection`：diff-driven membership store

selection 最优实现不是 signal graph，而是一个 membership store。

核心数据结构：

1. `snapshotRef: EditorSelectionState`
2. `listeners: Set<() => void>`
3. `nodeListenersById: Map<NodeId, Set<() => void>>`
4. `edgeListeners: Set<() => void>`

更新算法：

1. 拿到 `prev.selectedNodeIds`
2. 拿到 `next.selectedNodeIds`
3. 计算对称差集 `changedNodeIds`
4. 只通知这些 `nodeId` 的 listeners
5. 若 `selectedEdgeId` 变化，只通知 edge listeners
6. 若有人订阅 coarse snapshot，再通知 coarse listeners

复杂度从：

- `O(all selection subscribers)`

下降为：

- `O(changedSelectedNodes + edgeSelectionChanged)`

这是 `selection.contains(nodeId)` 的最优内部实现。

## 6.2 `node`：拆成结构 store 与实体 store

当前 node 的问题是：

- `get(nodeId)` 语义还没有从聚合 `NodesView` 中独立出来

所以 node 的长期最优设计必须拆成两层：

### `NodeIdsStore`

职责：

1. 维护 `ids()`
2. 维护 `subscribeIds()`
3. 只处理 create/delete/reorder/visible membership 变化

### `NodeEntryStore`

职责：

1. 维护 `get(nodeId)`
2. 维护 `subscribe(nodeId)`
3. 按 dirty ids 增量重算 `NodeViewItem`
4. 仅在 entry 引用真正变化时通知对应 `nodeId`

推荐内部结构：

1. `entryById: Map<NodeId, NodeViewItem>`
2. `listenersById: Map<NodeId, Set<() => void>>`
3. `activeNodeIds: Set<NodeId>` 或根据 listener 是否为空推导

失效算法：

### 情况 A：dirty ids 已知

- `impact.node.ids` 有内容
- 只重算这些 id 的 entry
- entry 引用变化才通知对应 listeners

### 情况 B：list 变化

- 更新 `NodeIdsStore`
- 计算新增/删除/重排
- 仅通知 ids listeners
- 对已删除节点清理 entry cache 和 listeners

### 情况 C：reset / replace / full rebuild

- bump generation
- 更新 ids store
- active node entries lazy 重算
- 通知 ids listeners 与 active entity listeners

## 6.3 `edge`：在现有增量 projection 上继续细粒度化

edge 比 node 更容易落地，因为现有 projection 已经有：

1. `cacheById`
2. `pendingNodeIds`
3. `pendingEdgeIds`
4. `relations.nodeToEdgeIds`

因此 edge 的长期最优实现是：

### `EdgeIdsStore`

职责：

1. `ids()`
2. `subscribeIds()`

### `EdgeEntryStore`

职责：

1. `get(edgeId)`
2. `subscribe(edgeId)`
3. 基于 `pendingNodeIds/pendingEdgeIds` 只重算受影响 edge

失效算法：

### 情况 A：dirty edge ids 已知

- 仅重算这些 edge
- entry 引用变化才通知对应 listeners

### 情况 B：dirty node ids 已知

- 通过 `relations.nodeToEdgeIds` 找到受影响 edgeIds
- 仅重算这些 edge
- entry 引用变化才通知对应 listeners

### 情况 C：edge list/reset/full

- 更新 ids store
- 通知 ids listeners
- active edge entries lazy 重算

## 7. React 最优消费面

React 不应该继续到处直接写：

```ts
useRead(READ_KEYS.node, () => instance.read.node.get(nodeId))
useWhiteboardSelector((snapshot) => snapshot.selection.selectedNodeIds.has(nodeId), { keys: ['selection'] })
```

这会把 coarse invalidation 机制直接泄漏给组件。

React 长期最优消费面是语义 hook：

```ts
useSelectionContains(nodeId)
useSelectedEdgeId()
useNodeIds()
useNode(nodeId)
useEdgeIds()
useEdge(edgeId)
```

这些 hook 内部可以：

1. 直接使用 `useSyncExternalStore`
2. 或在必要时用 Jotai 做 lifecycle-friendly 包装

但 Jotai 只能是 adapter，不应成为 engine 内核的一部分。

## 8. 为什么不推荐全量 signal / atom 化

不推荐 engine 全量 signal 化的原因：

1. engine 会从 headless runtime 变成响应式 runtime
2. 生命周期与回收复杂度显著上升
3. entity cell、index、projection、relations 的一致性成本会被放大
4. doc replace / reset / load 的 generation 管理会更复杂
5. 当前架构已经有清晰的 CQRS + invalidation funnel，没有必要整体推翻

更准确地说：

- 对外隐藏 `topic/key` 是合理的
- 但内部仍应保留清晰的 invalidation funnel
- 只在真正高价值的实体层上做细粒度化

## 9. `doc replace / reset` 的处理原则

无论是 selection、node 还是 edge，细粒度设计都必须明确 generation。

推荐原则：

1. `load / replace / reset` 时 bump generation
2. 旧实体引用全部视为过期
3. active listeners 保留，但对应实体值按新 generation lazy 重算
4. 结构层与实体层分别发通知

不能做成：

1. 旧 cell 永久持有旧 document 引用
2. list 与 entity 共用同一个聚合 view cache
3. 为全部文档实体长期分配 cell/signal

必须遵守：

1. 有 listener 才算 active entity
2. active entity 才值得维护细粒度订阅
3. list store 与 entity store 完全分层

## 10. 推荐落地顺序

### Phase 1: `selection`

先做：

- `instance.state.selection.contains(nodeId)`
- `instance.state.selection.selectedEdgeId()`
- `instance.state.selection.subscribeNode(nodeId, listener)`
- `instance.state.selection.subscribeEdge(listener)`

原因：

1. 边界最清楚
2. 不需要碰 engine
3. 对大规模节点 UI 收益立刻可见

### Phase 2: `edge`

再做：

- `instance.read.edge.ids()`
- `instance.read.edge.get(edgeId)`
- `instance.read.edge.subscribe(edgeId, listener)`
- `instance.read.edge.subscribeIds(listener)`

原因：

1. edge projection 现有增量基础最好
2. dirty edge / dirty node 到 affected edge 的路径已经存在

### Phase 3: `node`

最后做：

- `instance.read.node.ids()`
- `instance.read.node.get(nodeId)`
- `instance.read.node.subscribe(nodeId, listener)`
- `instance.read.node.subscribeIds(listener)`

原因：

1. node 需要先拆掉当前 `NodesView` 聚合耦合
2. 结构层与实体层要彻底分离
3. 这是三者里改动最大的一项

## 11. 最终判断

如果目标只是“把 API 写短”，React 层包一层 atom 就够了。

如果目标是“在几千 node / edge 规模下，把 fan-out 真正打掉”，那么长期最优就是：

1. `selection` 留在 `instance.state`，做 membership 细粒度化
2. `node` / `edge` 留在 `instance.read`，做实体细粒度化
3. API 统一成 `ids / get / subscribe / subscribeIds`
4. React 只暴露语义 hook，不再把 `topic/key` 泄漏给组件

一句话总结：

**最优方案不是全量 signal 化，而是 `state.selection` 细粒度 membership store + `read.node/read.edge` 细粒度实体 store + 结构层粗粒度保留。**
