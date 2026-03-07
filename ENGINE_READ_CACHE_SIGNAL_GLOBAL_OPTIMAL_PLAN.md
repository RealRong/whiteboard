# Engine Read Cache And Signal Global Optimal Plan

## 1. Goal

把当前 engine 的 read 更新链路从单一粗语义：

- `ReadInvalidation`
- `READ_SUBSCRIPTION_KEYS.projection`

重构成两条明确分离的链路：

- `cache`
  - 给 engine runtime 用
  - 负责索引、路径、缓存失效与重建
- `signal`
  - 给 React / hooks / selector 用
  - 负责按语义 topic 触发订阅通知

长期最优目标不是“把 projection 拆成几个名字”，而是：

1. core 直接产出 read 语义更新结果
2. engine read 直接消费 `cache`
3. UI 订阅只消费 `signal`
4. `projection` 不再作为订阅 topic 存在

---

## 2. Current Problem

当前设计把两类完全不同的职责混在了一起：

1. cache invalidation
   - `index`
   - `edge`
2. subscription notification
   - node 组件是否要醒来
   - edge 组件是否要醒来
   - mindmap 组件是否要醒来

当前具体表现：

- core 输出 `KernelProjectionInvalidation`
- engine read 只认 `invalidation.index` 与 `invalidation.edge`
- React 订阅统一使用 `READ_SUBSCRIPTION_KEYS.projection`
- `projection` 统一映射到一个 `projectionAtom`

这带来三个结构性问题。

### 2.1 `projection` 是粗广播

现在任何 node / edge / mindmap projection 变化，都会广播到同一个 `projection` topic。

结果：

- edge 变化时，node 订阅者会被唤醒
- node 变化时，mindmap 订阅者会被唤醒
- mindmap 变化时，edge 订阅者会被唤醒

即使最终 `useReadGetter` 用 equality 挡住了 rerender，也挡不住：

- `useSyncExternalStore` 被唤醒
- getter 再执行一次
- 大量 `Map.get(...)` / `byId.get(...)` 再跑一遍

所以当前问题不只是 rerender，而是整个订阅面被一个粗 topic 统一叫醒。

### 2.2 当前 invalidation 不是 projection 语义

core 现在输出的 `KernelProjectionInvalidation` 只有：

- `index`
- `edge`

这套结构适合驱动缓存，但不适合驱动 UI 订阅。

典型例子：

- `node.update` 仅更新 `data/style/locked`
- node projection 实际上已经变化
- 但当前 invalidation 可能仍然不会标记 `index` 变化

所以：

- `index` 变化 != `node projection` 变化
- `edge` 变化 != `edge subscription topic` 的完整语义

这意味着不能把未来的 `node` / `edge` / `mindmap` 订阅直接硬挂到现有 `index` / `edge` invalidation 上。

### 2.3 `projection` 的订阅 topic 与实际 projection 边界不一致

当前 read public 面已经收口成：

- `read.projection.node`
- `read.projection.edge`
- `read.projection.mindmap`
- `read.projection.viewportTransform`

但订阅 topic 仍然只有一个：

- `projection`

这和 public API 的语义边界明显不一致。

---

## 3. Target Architecture

长期最优方案是把 core 到 engine 到 React 的链路改成：

`commands -> write -> core reduce -> read update -> read cache apply -> read signal publish -> ui subscribe`

其中 `read update` 是唯一的 read 侧更新载体。

### 3.1 Target Type

```ts
export type KernelReadUpdate = {
  cache: {
    index: {
      rebuild: 'none' | 'dirty' | 'full'
      nodeIds: readonly NodeId[]
    }
    edge: {
      rebuild: 'none' | 'dirty' | 'full'
      nodeIds: readonly NodeId[]
      edgeIds: readonly EdgeId[]
    }
  }
  signal: {
    node: boolean
    edge: boolean
    mindmap: boolean
  }
}
```

设计原则：

- `cache` 只描述 runtime cache 是否要失效
- `signal` 只描述订阅 topic 是否变化
- 不在一个字段里混语义
- 不再使用 `projection` 这个粗词

### 3.2 Naming

长期最优命名：

- core
  - `KernelReadUpdate`
- engine
  - `ReadUpdate`
- read kernel method
  - `applyReadUpdate(update)`
- write commit result
  - `read: ReadUpdate`

不再使用：

- `ProjectionInvalidation`
- `ReadInvalidation`
- `projection` 订阅 topic

原因：

- `invalid` 只表达失效，不表达通知
- `projection` 太粗，不表达具体 topic
- `update` 同时覆盖 cache 与 signal，更贴近实际职责

---

## 4. Subscription Model

### 4.1 Remove `READ_SUBSCRIPTION_KEYS.projection`

当前：

```ts
READ_SUBSCRIPTION_KEYS = {
  ...READ_STATE_KEYS,
  projection: 'projection'
}
```

目标：

```ts
READ_STATE_KEYS = {
  interaction: 'interaction',
  tool: 'tool',
  selection: 'selection',
  viewport: 'viewport',
  mindmapLayout: 'mindmapLayout'
}

READ_SIGNAL_KEYS = {
  node: 'node',
  edge: 'edge',
  mindmap: 'mindmap'
}
```

然后：

```ts
type ReadSubscriptionKey =
  | ReadStateKey
  | ReadSignalKey
```

### 4.2 Why No `viewportTransform` Signal

`viewportTransform` 不需要单独 signal。

原因：

- 它完全由 `state.viewport` 派生
- 当前 `Whiteboard.tsx` 用 `READ_STATE_KEYS.viewport` 驱动是正确的
- render 侧订阅 viewport state 已经够精确

所以：

- `viewportTransform` 继续由 `viewport` state 驱动
- 不增加 `viewportTransform` topic

### 4.3 Topic Ownership

最终 topic 所属关系：

- `node`
  - `read.projection.node`
- `edge`
  - `read.projection.edge`
- `mindmap`
  - `read.projection.mindmap`
- `viewport`
  - `read.projection.viewportTransform`
  - `read.state.viewport`

这四者边界清晰、对齐 public read API。

---

## 5. Signal Semantics

### 5.1 Node Signal

`signal.node = true` 的条件：

- `node.create`
- `node.delete`
- `node.update`
  - 无论 patch 是 geometry、order、style、data、locked
- `node.order.set`
- `mindmap.*` 产生了任何 node 侧可见结果
  - 例如 anchor patch 引起 root node 位置变化
- whole document replace / load

设计原则：

- 只要 `read.projection.node` 可能变化，就发 `node`
- 不把 node signal 绑定到 index cache 变化

### 5.2 Edge Signal

`signal.edge = true` 的条件：

- `edge.create`
- `edge.delete`
- `edge.update`
- `edge.order.set`
- 任意影响 edge path / visible edge 的 node 变化
  - 例如 node geometry 改变
  - 例如 node 可见性变化
  - 例如 node order 变化导致 canvas 可见集合变化
- whole document replace / load

设计原则：

- 只要 `read.projection.edge` 可能变化，就发 `edge`
- 不是只有 edge operation 才发 edge signal

### 5.3 Mindmap Signal

`signal.mindmap = true` 的条件：

- `mindmap.*`
- `node.create/delete/update/order.set` 影响 mindmap root 可见集合
- `node.update` 命中了 mindmap root node 本身
- whole document replace / load

设计原则：

- `mindmap` 不是单靠 `mindmap.*` 驱动
- 只要 `read.projection.mindmap` 可能变化，就发 `mindmap`

### 5.4 No Per Item Signal In The First Step

长期最优第一阶段不做：

- `nodeById:<id>`
- `edgeById:<id>`
- `mindmapById:<id>`

原因：

- 会把订阅系统复杂度陡增
- 现有架构下 collection topic 已经能明显收口大量无意义唤醒
- per item signal 只有在 list 极大、单 item 订阅再成为瓶颈时才值得做

结论：

- 先把 topic 从 1 个粗 topic 拆成 3 个语义 topic
- 不把系统复杂度直接推到 entity 级事件总线

---

## 6. Cache Semantics

`cache` 继续只服务 runtime。

### 6.1 Index Cache

保留：

```ts
cache.index = {
  rebuild,
  nodeIds
}
```

职责：

- 驱动 `NodeRectIndex`
- 驱动 `SnapIndex`
- 驱动任何以后依赖 node geometry / canvas node set 的内部缓存

### 6.2 Edge Cache

保留：

```ts
cache.edge = {
  rebuild,
  nodeIds,
  edgeIds
}
```

职责：

- 驱动 edge path cache
- 驱动 endpoints/path 复用

### 6.3 Cache Must Not Drive UI Directly

原则：

- `cache` 可以比 `signal` 粗或细
- `cache` 只决定内部重算
- `signal` 只决定 UI 订阅通知
- 任何 UI 订阅都不应再直接推导自 cache 字段

---

## 7. Core Changes

### 7.1 Replace `KernelProjectionInvalidation`

当前 core：

```ts
type KernelProjectionInvalidation = {
  index: ...
  edge: ...
}
```

目标：

```ts
type KernelReadUpdate = {
  cache: {
    index: ...
    edge: ...
  }
  signal: {
    node: boolean
    edge: boolean
    mindmap: boolean
  }
}
```

### 7.2 Replace `InvalidationState`

当前 reducer 内部状态：

- `hasEdges`
- `hasOrder`
- `hasGeometry`
- `hasMindmap`
- `nodeIds`
- `edgeIds`

目标内部状态应分成两部分：

```ts
type ReadUpdateState = {
  cache: {
    full: boolean
    hasEdges: boolean
    hasOrder: boolean
    hasGeometry: boolean
    hasMindmap: boolean
    nodeIds: Set<NodeId>
    edgeIds: Set<EdgeId>
  }
  signal: {
    node: boolean
    edge: boolean
    mindmap: boolean
  }
}
```

### 7.3 Track Signal At Operation Time

长期最优不是在 engine 层猜，而是在 core reducer 里直接跟踪 signal。

规则：

- `node.create/delete/update/order.set`
  - `signal.node = true`
- `edge.create/delete/update/order.set`
  - `signal.edge = true`
- `mindmap.*`
  - `signal.mindmap = true`

此外，core reducer 在处理 operation 时，应根据 operation 影响的读域额外设置：

- node geometry / visibility / order 改变
  - `signal.edge = true`
- node changes hit mindmap root / visible root set
  - `signal.mindmap = true`

### 7.4 Mindmap Signal Needs Node Context

因为当前 mindmap projection 依赖：

- visible nodes
- root node
- tree data
- layout config

所以 signal 追踪不能只看 operation type 名称。

最佳实现方式：

- reducer 在处理 operation 时可读取 before / after node
- 对于 `node.update`：
  - 如果 before 或 after 任一方是 `type === 'mindmap'`
    - `signal.mindmap = true`
- 对于 `node.create/delete/order`：
  - 如果可能影响 visible root set
    - `signal.mindmap = true`

这样 signal 语义是精准的，而不是 engine 侧事后猜测。

---

## 8. Engine Changes

### 8.1 Write Runtime

当前 write commit：

- `execute()` 返回 `invalidation`
- `applyInvalidation(invalidation)`
- `react(invalidation)`

目标：

- `execute()` 返回 `read`
- `applyReadUpdate(read)`
- `react(read)`

即：

```ts
commit -> read.apply(update) -> react(update)
```

不再使用 `FULL_READ_INVALIDATION`，改成：

- `FULL_READ_UPDATE`

### 8.2 Read Kernel

当前 read kernel 只消费：

- `invalidation.index`
- `invalidation.edge`

目标：

- `applyReadUpdate(update)`
  - `applyCache(update.cache)`
  - `publishSignals(update.signal)`

结构：

```ts
const applyReadUpdate = (update: ReadUpdate) => {
  applyIndexCache(update.cache.index)
  edgeCache.applyChange(update.cache.edge)
  publishReadSignals(update.signal)
}
```

### 8.3 Introduce Signal Atoms

新增 3 个 atom revision：

- `readSignalAtoms.node`
- `readSignalAtoms.edge`
- `readSignalAtoms.mindmap`

它们不存业务值，只存 revision number。

例如：

```ts
node: PrimitiveAtom<number>
edge: PrimitiveAtom<number>
mindmap: PrimitiveAtom<number>
```

当对应 signal 为 `true` 时：

- bump 对应 revision atom

### 8.4 Subscription Table

`subscribableAtomMap` 最终应变成：

- state keys -> state atoms
- signal keys -> signal atoms

即：

```ts
[READ_STATE_KEYS.viewport]: stateAtoms.viewport
[READ_SIGNAL_KEYS.node]: readSignalAtoms.node
[READ_SIGNAL_KEYS.edge]: readSignalAtoms.edge
[READ_SIGNAL_KEYS.mindmap]: readSignalAtoms.mindmap
```

不再有：

- `READ_SUBSCRIPTION_KEYS.projection`
- `projectionAtom` 作为 UI 订阅源

### 8.5 `projectionAtom` Becomes Internal Only

`snapshotAtom` / `projectionAtom` 仍然可以存在，但只作为 read kernel 内部输入。

职责：

- 为 node / edge / mindmap view 构建提供稳定 snapshot

不再职责：

- 作为 React 订阅 topic

这一步非常关键，因为它彻底切开了：

- snapshot materialization
- UI wakeup signaling

---

## 9. React And Hook Changes

### 9.1 Replace Projection Topic

所有现有：

- `READ_SUBSCRIPTION_KEYS.projection`

替换成：

- node 组件 -> `READ_SIGNAL_KEYS.node`
- edge 组件 -> `READ_SIGNAL_KEYS.edge`
- mindmap 组件 -> `READ_SIGNAL_KEYS.mindmap`

### 9.2 Exact Mapping

#### Node

- `NodeLayer`
- `NodeItemById`

使用：

- `READ_SIGNAL_KEYS.node`

#### Edge

- `EdgeLayer`
- `EdgeControlPointHandles`
- `EdgeEndpointHandles`

使用：

- `READ_SIGNAL_KEYS.edge`
- 如果还依赖 selection，则同时带上 `READ_STATE_KEYS.selection`

#### Mindmap

- `MindmapLayerStack`
- `MindmapLayer`

使用：

- `READ_SIGNAL_KEYS.mindmap`
- `READ_STATE_KEYS.mindmapLayout`

### 9.3 Viewport Transform

保持现状：

- `Whiteboard.tsx` 继续订阅 `READ_STATE_KEYS.viewport`
- getter 继续读 `instance.read.projection.viewportTransform`

不引入额外 signal。

---

## 10. Reactions

### 10.1 Reactions Should Not Depend On UI Signals

reactions 是 engine runtime 内部 side effect，不应依赖 UI 订阅 topic。

所以：

- Autofit 这类 reaction 继续看 cache 层即可
- reaction 输入应优先消费 `update.cache`

### 10.2 Recommended Shape

可以有两种长期设计。

#### Option A

```ts
reactions.ingest(update.cache)
```

优点：

- 最清晰
- reaction 只依赖内部重算语义

#### Option B

```ts
reactions.ingest(update)
```

优点：

- 为未来 reaction 留余地
- reaction 需要时可看 signal

长期最优建议：

- 先走 `ingest(update)`
- 但 reaction 默认只消费 `cache`

这样不会把未来反应系统锁死。

---

## 11. Migration Order

### Phase 1. Core Type Replacement

1. 新增 `KernelReadUpdate`
2. reducer 从 `invalidation` 改成 `read`
3. 保持 `cache.index` / `cache.edge` 语义不变
4. 新增 `signal.node` / `signal.edge` / `signal.mindmap`

### Phase 2. Engine Write Replacement

1. `CommitResult.invalidation` 改成 `read`
2. `FULL_READ_INVALIDATION` 改成 `FULL_READ_UPDATE`
3. `createWrite` 改为：
   - `applyReadUpdate(read)`
   - `react(read)`

### Phase 3. Read Kernel Signal Layer

1. 新增 `readSignalAtoms`
2. 新增 `READ_SIGNAL_KEYS`
3. `applyReadUpdate` 同时做：
   - cache apply
   - signal bump
4. 删除 `READ_SUBSCRIPTION_KEYS.projection`

### Phase 4. React Subscription Migration

1. node consumers -> `node`
2. edge consumers -> `edge`
3. mindmap consumers -> `mindmap`
4. viewport transform 保持 `viewport`

### Phase 5. Cleanup

1. 删除 `projection` topic
2. 删除 `ReadInvalidation`
3. 删除 `KernelProjectionInvalidation`
4. 清理 `invalidation.ts` 命名与导出
5. 全链路统一改成 `read update`

---

## 12. Validation Rules

重构完成后应满足以下规则。

### 12.1 Node Style Change

场景：

- `node.update({ style })`

期望：

- `signal.node = true`
- `signal.edge = false`
- `signal.mindmap` 仅在该 node 是 mindmap root 时为 `true`
- `cache.index.rebuild = 'none'`

### 12.2 Node Geometry Change

场景：

- `node.update({ position })`

期望：

- `signal.node = true`
- `signal.edge = true`
- `cache.index` dirty or full
- `cache.edge` dirty or full

### 12.3 Edge Label Change

场景：

- `edge.update({ label })`

期望：

- `signal.edge = true`
- `cache.edge.rebuild = 'none'` 或最小必要更新
- `signal.node = false`
- `signal.mindmap = false`

### 12.4 Mindmap Tree Change

场景：

- `mindmap.set`

期望：

- `signal.mindmap = true`
- 若伴随 root node anchor patch，则 `signal.node = true`
- `cache.index` / `cache.edge` 依实际 geometry 影响而定

### 12.5 Edge Only Update Should Not Wake Node Subscribers

场景：

- 仅 edge 更新

期望：

- `READ_SIGNAL_KEYS.edge` 被 bump
- `READ_SIGNAL_KEYS.node` 不被 bump
- `NodeLayer` / `NodeItemById` 不被 store 唤醒

这是验证该重构是否真正解决粗广播问题的核心用例。

---

## 13. What Should Be Deleted

完成长期方案后，应删除以下旧概念：

- `READ_SUBSCRIPTION_KEYS.projection`
- `ReadInvalidation`
- `KernelProjectionInvalidation`
- 任何“把 projection 当成统一订阅 topic”的代码
- 任何“UI 订阅直接依赖 cache invalidation”的代码

---

## 14. Final Recommended Chain

最终推荐链路：

`commands -> write -> core reduce -> read update -> read cache apply -> read signal publish -> ui subscribe -> reactions`

更准确展开为：

1. `commands`
2. `write.apply`
3. `core.reduce`
4. `read update`
   - `cache`
   - `signal`
5. `read.applyReadUpdate`
   - apply `cache.index`
   - apply `cache.edge`
   - bump `signal.node`
   - bump `signal.edge`
   - bump `signal.mindmap`
6. `read.subscribe`
   - state key listeners
   - signal key listeners
7. `reactions.ingest`
   - 读取 `read update`
   - 默认只关心 `cache`

这条链路的核心优点：

- cache 与 signal 职责完全分离
- public read API 与 subscription topic 边界一致
- `projection` 这个粗 topic 被完全删除
- React 不再被无意义广播统一叫醒
- 后续如果需要 per item topic，也能在 `signal` 层继续向下演进，而不需要再改 cache 结构

---

## 15. Final Decision

长期全局最优决策：

1. 不保留 `projection` 订阅 topic
2. core 直接产出 `read update`
3. `read update = cache + signal`
4. signal topic 固定为：
   - `node`
   - `edge`
   - `mindmap`
5. viewport transform 继续由 `viewport` state 驱动
6. cache 只给 runtime，signal 只给 UI
7. 不在第一阶段引入 per item signal

这是当前架构下最清晰、最稳定、也最符合漏斗原则的长期方案。
