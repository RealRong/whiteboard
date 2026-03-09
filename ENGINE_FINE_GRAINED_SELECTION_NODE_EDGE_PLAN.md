# Engine Fine-Grained Selection / Node / Edge Plan

## 1. 结论

长期最优方案不是把整个 engine read 层直接改造成全量 Jotai/Signal 图，也不是继续停留在纯 topic 级别的粗粒度通知。

最优路线是一个明确的混合模型：

1. **结构层继续保留粗粒度 invalidation**
2. **实体层引入按 id 的细粒度读源**
3. **engine 负责产生 headless 的细粒度 invalidation 事实**
4. **react 层负责把这些事实包装成语义 hook，必要时再包成局部 atom/signal**

对应到本次研究的三个目标：

1. `selection.contains(nodeId)`：在 `whiteboard-react` 层做细粒度化
2. `read.node.byId(nodeId)`：在 `whiteboard-engine` read 层拆出实体级 node entry cache + per-node invalidation
3. `read.edge.byId(edgeId)`：在 `whiteboard-engine` read 层拆出实体级 edge entry cache + per-edge invalidation

不推荐的路线：

1. **不推荐**直接让 engine 内部全面变成 Jotai atom graph
2. **不推荐**继续只保留 `READ_KEYS.node / edge / mindmap` 这种 topic 级 fan-out
3. **不推荐**仅在 React 层把现有 topic 再包一层 `useMemo(atom(...))` 就认为已经细粒度化

原因很简单：

1. 全量 signal 化会把 engine 从 headless read runtime 变成响应式 runtime，复杂度和耦合显著上升
2. 纯 topic 模式在几千节点/边下会形成大规模 subscriber fan-out
3. 仅做 React 包装而不改变底层 invalidation 粒度，本质复杂度不会下降

## 2. 当前现状

### 2.1 `selection` 当前是整包状态订阅

当前 `selection` 是一个普通的 UI 状态切片：

- 文件：`packages/whiteboard-react/src/common/instance/uiState.ts`
- 结构：
  - `selectedNodeIds: Set<NodeId>`
  - `selectedEdgeId?: EdgeId`
  - `mode: SelectionMode`

当前 `useWhiteboardSelector` 的 selector 模式本质仍然是：

1. 订阅整个 `selection` topic
2. `selection` 任意变化时唤醒所有订阅者
3. 每个订阅者各自执行 selector
4. 再用 equality 阻止真正的 React rerender

这意味着：

- `selectedNodeIds.has(node.id)` 这种按节点判断选中态的组件，会在任意 selection 变化时全部被唤醒一次
- 在几千 `NodeItem` 的场景下，这会形成明显 fan-out

### 2.2 `read.node.byId` 当前仍然挂在粗粒度 `node` topic 下

当前节点读取路径：

1. `useReadGetter(..., { key: READ_KEYS.node })`
2. `instance.read.subscribe(READ_KEYS.node, listener)`
3. `read.apply()` 收到任意 node 影响后发布 `READ_KEYS.node`

对应文件：

- `packages/whiteboard-react/src/common/hooks/useReadGetter.ts`
- `packages/whiteboard-engine/src/read/index.ts`
- `packages/whiteboard-engine/src/read/apply.ts`

节点 projection 当前虽然有 **按 id 的 entry cache**：

- 文件：`packages/whiteboard-engine/src/read/projection/node.ts`
- `nodeItemCacheById: Map<NodeId, NodeViewItem>`

但它的 public 读口仍然是一个聚合视图：

- `read.node.ids`
- `read.node.byId.get(nodeId)`

并且 `getView()` 在 `canvasNodeById` 或 `canvasNodeIds` 引用变化时，仍然会重新遍历全部节点来重建 `byId` 视图。

也就是说当前节点路径是：

1. topic 级通知粗
2. first subscriber 触发一次 `O(N)` view reconcile
3. 所有 node subscriber 都会再做一次 `Map.get(nodeId)` + 引用比较

所以它的瓶颈不只是 subscriber fan-out，还是 **聚合视图重建耦合在 byId 读口上**。

### 2.3 `read.edge.byId` 已有增量缓存，但通知粒度仍然粗

当前 edge projection 比 node projection 更接近目标形态：

- 文件：`packages/whiteboard-engine/src/read/projection/edge.ts`
- 已经维护：
  - `cacheById`
  - `pendingNodeIds`
  - `pendingEdgeIds`
  - `relations.nodeToEdgeIds`

这说明 edge 实体级增量计算其实已经存在一半：

1. dirty nodeIds 可以映射到受影响 edgeIds
2. dirty edgeIds 可以直接精准增量 reconcile
3. `reconcileEdges()` 已经只更新受影响边

但 React 订阅面仍然是粗粒度：

- `READ_KEYS.edge`
- 所有 `edge.byId(edgeId)` 订阅者都会被唤醒

所以 edge 的核心问题不是 projection 计算，而是 **subscriber 通知粒度仍然停在 topic 级**。

## 3. 当前 topic 模式的真实复杂度

### 3.1 现在做到的是“精确 rerender”，不是“精确通知”

当前模型不是：

- 只有受影响的 `nodeId/edgeId` 订阅者被通知

而是：

- 某个 topic 变化后，所有订阅该 topic 的订阅者都会被唤醒
- 但每个订阅者重新读取结果后，如果引用没变，就尽量不触发真正 rerender

因此当前复杂度更准确地说是：

1. **通知粒度粗**
2. **结果比较粒度细**

### 3.2 几千节点/边下会发生什么

以 5000 个节点为例，若每个 `NodeItem` 都订阅：

- `selection.contains(nodeId)`
- `read.node.byId(nodeId)`

那么一次 node topic 变化或 selection 变化会带来：

1. 大量 subscriber callback 被调度
2. 大量 getter 被重新执行
3. 大量 `Map.get / Set.has / Object.is` 比较

即使最终只有少数组件真正 rerender，前面的 fan-out 成本仍然存在。

如果这些变化进入高频路径，例如：

1. 每帧 pointermove 都 commit
2. 每帧 selection 都更新
3. 每帧 node geometry 都入 engine

那么 topic 模式会明显放大主线程压力。

### 3.3 当前还没有立刻爆炸的原因

当前实现还没到不可接受，主要因为：

1. 很多热交互走的是 preview / transient state，而不是每帧 commit document
2. node / edge projection 已经做了大量对象复用
3. React 最终真正 rerender 的组件数量通常少于唤醒数量

所以短期内 topic 模式仍可用。

但如果目标是：

1. 常态几千节点/边
2. 高频局部更新
3. 更多行为下沉到 engine

那么继续依赖 topic fan-out，不是长期最优。

## 4. 最优边界：谁应该做细粒度化

### 4.1 `selection.contains(nodeId)` 应该在 `whiteboard-react` 层细粒度化

原因：

1. selection 是 editor UI state，不是 document read model
2. 它的 source of truth 现在就在 `whiteboard-react` 的 `selectionAtom`
3. 它天然和组件生命周期、局部视觉状态强相关
4. 不应该为了它把 engine read runtime 变成 UI 状态运行时

所以 selection 细粒度化的最佳位置是：

- `packages/whiteboard-react/src/common/instance/` 下的 state layer

### 4.2 `read.node.byId(nodeId)` 和 `read.edge.byId(edgeId)` 应该在 engine read 层细粒度化

原因：

1. node/edge entry 本质是 engine read model 的一部分
2. 受写入 impact 驱动的 dirty ids 已经在 engine 内部出现
3. 如果只在 React 层包一层 atom，而 engine 仍然只吐粗 topic，那么底层复杂度并没有降级
4. 真正能减少 fan-out 的，是让 **dirty ids 在 engine 里就不要再折叠成单个 topic**

所以 node/edge 实体级 invalidation 的最佳位置是：

- `packages/whiteboard-engine/src/read/`

React 层只负责消费，不负责重新发明 dirty entity 识别逻辑。

## 5. 不同路线的比较

### 路线 A：继续 topic + React 层 `useMemo(atom(...))`

做法：

1. `useRead` 内部不再暴露 `READ_KEYS`
2. 用 `useMemo(atom(...))` 把 getter 包一层
3. atom 再订阅 `READ_KEYS.node/edge`

优点：

1. 改动小
2. public API 更短
3. React 层调用感受更好

缺点：

1. 底层仍然是 topic fan-out
2. 每个 entity 订阅者仍会在 topic 变化时被唤醒
3. 只是把 `key` 隐藏了，没有改变复杂度阶

结论：

- 这条路适合作为 **短期 API 清洁手段**
- 不适合作为本次三个目标的长期最优答案

### 路线 B：engine 全量 signal/atom 化

做法：

1. document/read/index/projection 全部变成细粒度 signal graph
2. `nodeId/edgeId` 派生关系由 signal 自动追踪
3. topic invalidation 逐步消失

优点：

1. 理论上最细粒度
2. public API 可做到几乎无 topic/key

缺点：

1. engine 从 headless read runtime 变成响应式 runtime
2. 生命周期、回收、缓存、一致性复杂度显著上升
3. index / projection / relations / dirty propagation 需要整体重建
4. 会把当前清晰的 CQRS + invalidation funnel 打散

结论：

- 理论最强
- 工程上不是当前体系的最优路线
- 不推荐直接采用

### 路线 C：混合模型，结构粗粒度 + 实体细粒度

做法：

1. 结构类读口继续保留粗粒度
2. 按实体读取的热点读口变成 per-id subscription / cell
3. dirty ids 在 engine 中保留到最后一层，不再提前折叠成 topic
4. React hook 只消费这些细粒度 cell，不直接看 topic

优点：

1. 对性能真正有效
2. 保留 current architecture 的清晰边界
3. 不需要把 engine 全量 signal 化
4. 适合逐步迁移

缺点：

1. 需要新增一层 entity cell / entity subscription infrastructure
2. node 需要把聚合 view 和 byId 读口彻底拆开

结论：

- 这是长期最优路线

## 6. 推荐目标形态

## 6.1 `selection`

保留：

- `state.selection` 作为 coarse snapshot
- `commands.selection.*` 作为写入口

新增：

- `state.selection.contains(nodeId)`
- `state.selection.selectedEdgeId()`
- `state.selection.subscribeNode(nodeId, listener)`
- `state.selection.subscribeEdge(listener)`

React 侧最终语义 hook：

- `useSelectionContains(nodeId)`
- `useSelectedEdgeId()`
- 如果有需要，再补 `useIsEdgeSelected(edgeId)`

### 6.2 `read.node`

把当前 `read.node.ids` 与 `read.node.byId.get()` 彻底拆开：

- `read.node.ids`：结构层
- `read.node.byId(nodeId)`：实体层
- `read.node.subscribe(nodeId, listener)`：实体级订阅
- `read.node.subscribeIds(listener)`：结构级订阅

React 侧最终语义 hook：

- `useNode(nodeId)`
- `useNodeIds()`

### 6.3 `read.edge`

与 node 对齐：

- `read.edge.ids`
- `read.edge.byId(edgeId)`
- `read.edge.subscribe(edgeId, listener)`
- `read.edge.subscribeIds(listener)`

React 侧最终语义 hook：

- `useEdge(edgeId)`
- `useEdgeIds()`

## 7. 推荐内部设计

## 7.1 selection 设计

selection 不需要 topic。

它最适合做成一个 **diff-driven membership store**：

- source of truth 仍然是完整 `EditorSelectionState`
- 每次 selection 更新时，显式计算：
  - 新增选中的 nodeIds
  - 移除选中的 nodeIds
  - `selectedEdgeId` 是否变化
- 只通知真正变化的 nodeId 和 edge 订阅者

### selection 的核心数据结构

建议：

1. `selectionSnapshotRef: EditorSelectionState`
2. `nodeListenersById: Map<NodeId, Set<() => void>>`
3. `edgeListeners: Set<() => void>`

### selection 更新算法

每次 selection 改动：

1. 拿到 `prev.selectedNodeIds`
2. 拿到 `next.selectedNodeIds`
3. 计算对称差集 `changedNodeIds`
4. 只通知这些 nodeId 对应 listener
5. 若 `selectedEdgeId` 变化，通知 edge listener
6. 若 coarse `selection` snapshot 被订阅，再通知 coarse selection listener

复杂度：

- `O(changedSelectedNodes)`
- 不再是 `O(all selection subscribers)`

这就是 `selection.contains(nodeId)` 细粒度化最优解。

## 7.2 node 设计

node 的关键不是先做 React atom，而是先把 engine read 里的 **聚合视图读口** 和 **实体读口** 分开。

### 当前 node 的问题

当前 `read.node.byId.get(nodeId)` 事实上依赖的是整个 `NodesView`：

1. `getView()` 会在 nodes 引用变化时重建 `byId` Map
2. `byId.get(nodeId)` 只是从聚合视图上再取一次

这意味着 byId 读口并不是独立实体缓存。

### 目标 node 结构

建议把 node projection 拆成两个平行缓存：

1. `NodeIdsStore`
2. `NodeEntryStore`

#### `NodeIdsStore`

负责：

- `node.ids`
- `subscribeIds()`

只处理结构变化：

- create/delete/order/layer visible membership change

#### `NodeEntryStore`

负责：

- `node.byId(nodeId)`
- `subscribe(nodeId)`

内部维护：

1. `entryById: Map<NodeId, NodeViewItem>`
2. `listenersById: Map<NodeId, Set<() => void>>`
3. `activeIds: Set<NodeId>` 或按 listenersById 是否为空判断活跃实体

### node 失效算法

由 `KernelReadImpact.node` 驱动：

#### 情况 A：dirty ids 已知

- `impact.node.ids` 有内容
- 只重算这些 nodeId 的 `NodeViewItem`
- 如果 entry 引用变化，只通知对应 nodeId listeners

#### 情况 B：结构变化

- `impact.node.list === true`
- 更新 ids store
- 计算新增/删除 ids
- 通知 ids listeners
- 删除已经不存在节点的 entry cache 和 listeners 或标记为 missing

#### 情况 C：full/reset

- 文档整体替换
- ids store 重建
- active node entries 按 active ids lazy 重算
- 通知 ids listeners + 所有 active node listeners

### 为什么 node 必须在 engine 里做

因为 engine 已经掌握：

1. `impact.node.ids`
2. geometry/value/list 的原因
3. `NodeRectIndex`
4. 当前 document read model

如果把 node 细粒度 diff 放到 React 层，React 反而需要重新猜 dirty ids，重复一套 engine 已经有的信息。

## 7.3 edge 设计

edge 和 node 的原则相同，但实现更容易，因为当前 edge projection 已经有：

1. `cacheById`
2. `pendingNodeIds`
3. `pendingEdgeIds`
4. `relations.nodeToEdgeIds`

因此 edge 更适合在现有 projection 上直接拆出：

1. `EdgeIdsStore`
2. `EdgeEntryStore`

### 目标 edge 结构

- `read.edge.ids`
- `read.edge.byId(edgeId)`
- `read.edge.subscribe(edgeId, listener)`
- `read.edge.subscribeIds(listener)`

### edge 失效算法

#### 情况 A：dirty edge ids 已知

- 仅 reconcile 这些 edgeId
- 引用变化才通知对应 listeners

#### 情况 B：dirty node ids 已知

- 用 `relations.nodeToEdgeIds` 找出受影响 edgeIds
- 仅 reconcile 这些 edgeId
- 引用变化才通知对应 listeners

#### 情况 C：edge list/full/reset

- 更新 ids store
- 通知 ids listeners
- active edge entries lazy 重建或重算

这条路径的复杂度会从：

- `O(all edge subscribers)`

下降为：

- `O(affectedEdges + subscribersOfAffectedEdges)`

## 8. 是否应该直接使用 Jotai/Signal

### 8.1 selection

selection 在 `whiteboard-react` 层，完全可以用 Jotai 做 lifecycle-friendly 包装。

但长期最优不是“把 selection 直接暴露成一堆原子给组件”，而是：

1. 先有清晰的 selection membership store
2. 再由 hook 或局部 atom 去读这个 store

也就是说：

- Jotai 可以是 adapter
- 不应该成为 selection 细粒度模型本身的唯一表达

### 8.2 node / edge

对 node/edge，我不建议把 engine 核心直接改成 Jotai atom graph。

更优的是：

1. engine 暴露 headless per-id subscribe/get
2. react 层如果想用 `useMemo(atom(...))`，只在 adapter 层包装

原因：

1. engine 不应该承担 React lifecycle 语义
2. per-entity atom 回收、generation、doc replace 的复杂度不适合压进 engine 内核
3. headless 订阅契约比 Jotai runtime 更稳、更可控、更容易 bench

## 9. 推荐 public API 方向

以下是长期最优 public 语义，不是短期兼容写法。

```ts
instance.state.selection.contains(nodeId)
instance.state.selection.selectedEdgeId()
instance.state.selection.subscribeNode(nodeId, listener)
instance.state.selection.subscribeEdge(listener)

instance.read.node.ids
instance.read.node.byId(nodeId)
instance.read.node.subscribe(nodeId, listener)
instance.read.node.subscribeIds(listener)

instance.read.edge.ids
instance.read.edge.byId(edgeId)
instance.read.edge.subscribe(edgeId, listener)
instance.read.edge.subscribeIds(listener)
```

React 侧语义 hook：

```ts
useSelectionContains(nodeId)
useSelectedEdgeId()
useNode(nodeId)
useNodeIds()
useEdge(edgeId)
useEdgeIds()
```

不再推荐让 UI 大量直接写：

```ts
useRead(READ_KEYS.node, () => instance.read.node.byId(nodeId))
useWhiteboardSelector((snapshot) => snapshot.selection.selectedNodeIds.has(nodeId), { keys: ['selection'] })
```

因为这些写法把 coarse invalidation 细节直接泄漏给 UI。

## 10. doc replace / reset / lifecycle 处理原则

这是细粒度设计里最容易做坏的地方。

### 10.1 generation 必须存在

对 node/edge/selection 细粒度实体 store，都建议引入 `generation` 概念。

当发生：

1. `doc.load`
2. `doc.replace`
3. reset/full rebuild

需要：

1. bump generation
2. 让所有 active entity subscription 知道“旧引用全部作废”
3. 按需 lazy 重建实体 entry

### 10.2 listener 生命周期必须以“活跃订阅实体”驱动

不要为所有 document entity 永久创建 cell。

应该遵守：

1. 有 listener 才算 active id
2. active id 才值得维护细粒度 entry 通知
3. listener 清空后可回收对应 cell/listener set

这样可以避免：

- 文档有几万个节点时，系统永久维持几万个 signal/atom/cell

### 10.3 list 层和 entity 层必须分开

这一条很关键。

错误设计是：

- `ids` 和 `byId` 都依赖一个统一聚合 view

正确设计是：

- `ids` 单独缓存与订阅
- `byId` 单独缓存与订阅

否则一旦 list 引用变化，实体层就会被迫全量重算。

## 11. 推荐落地顺序

### Phase 1: selection 先做

优先级最高。

原因：

1. 实现边界最清楚
2. 不需要碰 engine
3. 对大规模 node 视觉层收益立刻可见
4. 可以先验证细粒度 membership store 这条路线

### Phase 2: edge.byId

第二优先级。

原因：

1. edge projection 已经有一半增量基础设施
2. 只需把 `cacheById` 的消费面从 coarse topic 切到 per-edge subscription
3. 风险比 node 小

### Phase 3: node.byId

第三优先级。

原因：

1. 需要拆掉当前聚合 `NodesView` 对 byId 读口的耦合
2. 需要把 node list 和 node entry store 分层
3. 这是三者里结构改动最大的一项

## 12. 最终判断

如果目标只是“把 API 写短”，那么 React 层包一层 Jotai 足够。

如果目标是“在几千节点/边规模下，从长期角度把 fan-out 真正打掉”，那么最优路线是：

1. `selection.contains(nodeId)` 在 `whiteboard-react` 层做 diff-driven membership store
2. `read.node.byId(nodeId)` 在 `whiteboard-engine` read 层拆成独立实体 store
3. `read.edge.byId(edgeId)` 在 `whiteboard-engine` read 层拆成独立实体 store
4. 结构层继续保留 coarse ids/list invalidation
5. React 层通过语义 hook 消费，不再直接暴露 topic/key

一句话总结：

**最优方案不是“全量 signal 化”，而是“结构粗粒度 + 实体细粒度 + UI 语义 hook 隐藏实现细节”。**
