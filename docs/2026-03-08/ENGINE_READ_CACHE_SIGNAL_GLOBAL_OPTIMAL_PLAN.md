# Engine Read Impact Global Optimal Plan

## 1. Goal

把当前 engine 的 read 更新链路，从：

- `KernelProjectionInvalidation`
- `ReadInvalidation`
- `READ_SUBSCRIPTION_KEYS.projection`

重构成一个真正符合漏斗原则与数据驱动的结构：

`commands -> operations -> core reduce -> KernelReadImpact -> engine compilers -> read apply -> ui subscribe`

长期最优目标：

1. core 不直接输出 cache / signal 这类执行机制结果
2. core 只输出稳定的读侧事实语义：`KernelReadImpact`
3. engine 基于 impact 纯编译出：
   - read control
   - reaction input
4. `projection` 不再作为统一订阅 topic 存在
5. cache invalidation 与 UI signal 从同一份 impact 推导，而不是分别并列定义

---

## 2. Final Judgment

长期全局最优不是：

- `KernelProjectionInvalidation`
- `KernelReadUpdate`
- `operations -> projections directly`

长期全局最优是：

- `KernelReadImpact`

原因：

- `KernelProjectionInvalidation` 太偏 cache 机制
- `KernelReadUpdate` 仍然把下游执行方式编码进 core 输出
- `operations -> projections directly` 会让多个消费者重复解释 operation 语义，破坏漏斗收敛

`KernelReadImpact` 的优势：

- 它描述的是事实，不是动作
- 它是稳定语义层，不是 runtime 执行层
- 它能作为唯一上游真相，驱动多个下游 compiler

---

## 3. Why `KernelReadUpdate` Is Not Final

`KernelReadUpdate = { cache, signal }` 比旧方案更好，但不是终态。

问题在于：

1. `cache` 和 `signal` 都是消费机制，不是领域事实
2. 它让 core 直接知道下游有哪些执行通道
3. 它会随着消费者增加而持续膨胀
4. 它不是单一漏斗，而是 core 直接同时产出多条并行执行计划

漏斗原则下，最优结构应该是：

- 上游先把 operation 收敛成单一稳定语义
- 下游各自从这份稳定语义编译自己的执行计划

这就是 `Impact` 比 `Update` 更优的根本原因。

---

## 4. Why Not Derive Projections Directly From Operations

理论上可以从 operations 直接推 projection，但在当前架构下不是最优。

### 4.1 If A Central Function Parses Operations

如果 engine 中央有一个函数：

- 读取 operations
- 解析 node / edge / mindmap 影响
- 再去驱动 cache / signals / reactions

那么本质上它已经在生成 impact，只是没有显式命名。

这不是真正省掉了 impact，只是把 impact 藏进流程代码里。

### 4.2 If Each Consumer Parses Operations Independently

如果改成：

- node projection 自己解析 operations
- edge cache 自己解析 operations
- signal publisher 自己解析 operations
- reactions 自己解析 operations

那么会出现：

- operation 语义被多处重复解释
- cross-domain 影响到处复制
- consumer 越多，膨胀越明显
- 上游高熵输入被反复重新打开

这违背漏斗原则。

### 4.3 Current Operations Are Write-Oriented, Not Read-Semantic

当前 operation 设计是典型 write 语义：

- `node.update(patch)`
- `edge.update(patch)`
- `mindmap.set`

它们适合 reducer，不适合作为多个 read consumer 的直接输入。

原因：

- `node.update` 还需要继续分辨 geometry / list / value
- edge projection 还要受到 node geometry 变化影响
- mindmap projection 并不只受 `mindmap.*` 影响

这说明 operation 本身不是稳定读语义。

所以，在 operation 架构不重做的前提下，必须有一个中间语义收敛层。

---

## 5. KernelReadImpact

### 5.1 Target Shape

推荐长期最优的 core 输出为：

```ts
export type KernelReadImpact = {
  reset: boolean

  node: {
    ids: readonly NodeId[]
    geometry: boolean
    list: boolean
    value: boolean
  }

  edge: {
    ids: readonly EdgeId[]
    nodeIds: readonly NodeId[]
    geometry: boolean
    list: boolean
    value: boolean
  }

  mindmap: {
    ids: readonly NodeId[]
    view: boolean
  }
}
```

说明：

- `reset`
  - whole document replace / load / full reset
- `node.geometry`
  - node rect / aabb / edge anchor 依赖发生变化
- `node.list`
  - canvas node 的集合、可见性或顺序发生变化
- `node.value`
  - node 本身的值发生变化，但不必然影响 geometry 或 list
- `edge.geometry`
  - edge path / endpoint 依赖发生变化
- `edge.list`
  - edge 集合或顺序发生变化
- `edge.value`
  - edge label / style / data 等值发生变化
- `mindmap.view`
  - mindmap projection 需要重读

这是稳定语义，不包含 cache 或 signal 概念。

### 5.2 Design Rules

设计原则：

1. 不描述怎么做，只描述发生了什么
2. 不描述 runtime 结构，只描述读域影响
3. `list` 表示读模型里的集合与顺序变化，不再把 `order / create / delete / visibility` 分散表达
4. `value` 表示实体值变化，不再把 `content / style` 拆成两个 consumer 味道很重的轴
5. `mindmap.view` 表示 mindmap 读侧需要重算，不再把 `structure / anchor` 暴露给所有消费者
6. id 列表提供精细范围，但不强迫下游必须按 id 级别消费

---

## 6. Why This Shape Fits Funnel Principle

### 6.1 Single Funnel

链路变成：

`operations -> KernelReadImpact -> compilers`

而不是：

`operations -> cache + signal`

前者是：

- operation 先收敛成一个统一语义层
- 再由多个 compiler 消费

后者是：

- core 直接为多个下游执行机制分别出结果

前者更符合漏斗原则。

### 6.2 Stable Semantic Axes

`node / edge / mindmap` 比 `cache / signal` 更稳定。

原因：

- consumer 机制会变化
- 语义域更稳定
- 新增一个 cache 或 reaction，不应该迫使 core 输出 schema 变化

### 6.3 Facts Instead Of Plans

`Impact` 是事实层，`Update` 是计划层。

长期最优应该把事实层放在 core，把计划层放在 engine。

---

## 7. Why This Shape Fits Data-Driven Design

数据驱动的关键不是“多用对象”，而是：

- 是否有单一稳定真相源
- 下游是否从真相源纯编译出来

`KernelReadImpact` 恰好满足：

- core reducer 是唯一真相生产者
- engine 的 cache / signal / reaction 都是 compiler
- 不同消费者不再各自解释 operations

因此它是比 `operations -> projections directly` 更标准的数据驱动方案。

---

## 8. Impact Semantics

### 8.1 Node Impact

`impact.node` 表示：`read.projection.node` 与 node index 是否受到影响。

#### `geometry`

以下情况为 true：

- `node.create`
- `node.delete`
- `node.update` 影响 `position / size / rotation`
- create / delete / geometry change 需要重新锚定相关 edge path

#### `list`

以下情况为 true：

- `node.order.set`
- `node.update` 影响 `type / layer / zIndex / parentId`
- group collapsed 状态变化导致 visible canvas node 集合变化
- create / delete 导致 canvas node 集合变化

#### `value`

以下情况为 true：

- `node.update` 影响 `data / style / locked`
- create / delete
- type change 需要 node consumer 重读实体值

#### `ids`

包含本次 node 读域受影响的 node ids。

注意：

- `ids` 是范围提示，不是唯一语义来源
- `geometry / list / value` 是主语义

### 8.2 Edge Impact

`impact.edge` 表示：`read.projection.edge` 是否受到影响。

#### `geometry`

以下情况为 true：

- `edge.create / edge.delete / edge.update` 影响 path / endpoints / routing
- 任意 node geometry 变化影响 edge path

#### `list`

以下情况为 true：

- `edge.order.set`
- create / delete 改变 edge 集合或顺序

#### `value`

以下情况为 true：

- `edge.update` 影响 `label / style / data`

#### `ids`

受影响的 edge ids。

#### `nodeIds`

导致 edge geometry 变化的 node ids。

说明：

- node 可见集变化不再直接污染 `impact.edge.value`
- engine compiler 会基于 `impact.node.list` 决定是否唤醒 edge subscribers

### 8.3 Mindmap Impact

`impact.mindmap` 表示：`read.projection.mindmap` 是否需要重读。

#### `view`

以下情况为 true：

- `mindmap.set / mindmap.delete`
- mindmap root 的 position / size / order / type / tree 数据变化
- create / delete / reorder 影响 mindmap root 集合

#### `ids`

受影响的 mindmap root ids。

---

## 9. Core Changes

### 9.1 Replace `KernelProjectionInvalidation`

当前 core 输出：

```ts
KernelProjectionInvalidation
```

目标替换为：

```ts
KernelReadImpact
```

并把 reducer 结果：

```ts
{ ok, doc, changes, inverse, read }
```

其中：

- `read` 即 `KernelReadImpact`

### 9.2 Replace `InvalidationState`

当前 reducer 内部状态偏 cache：

- `hasEdges`
- `hasOrder`
- `hasGeometry`
- `hasMindmap`
- `nodeIds`
- `edgeIds`

目标改成：

```ts
type ReadImpactState = {
  full: boolean

  node: {
    ids: Set<NodeId>
    geometry: boolean
    list: boolean
    value: boolean
  }

  edge: {
    ids: Set<EdgeId>
    nodeIds: Set<NodeId>
    geometry: boolean
    list: boolean
    value: boolean
  }

  mindmap: {
    ids: Set<NodeId>
    view: boolean
  }
}
```

### 9.3 Track Impact During Reduce

在 reducer 里直接基于 operation 处理前后的上下文记录 impact。

重点：

- 不再只判断 cache invalidation
- 改为判断每个 read 语义域受到何种类型影响

这一步完成后，core 只负责产出事实语义，不负责产出执行计划。

---

## 10. Engine Compilers

engine 不再接收 `ReadInvalidation`，而是接收 `ReadImpact`。

### 10.1 Compile Read Control

```ts
compileReadControl(impact): ReadControl
```

输出：

```ts
{
  index: { rebuild, nodeIds },
  edge: { rebuild, nodeIds, edgeIds },
  signals: { node, edge, mindmap }
}
```

职责：

- 统一承载 read runtime 的控制层协议
- 一次性把 impact 编译成 cache 与 signal 所需控制结果
- 避免 kernel 对同一份 impact 做两次并行解释

### 10.2 Compile Reaction Input

```ts
compileReactionInput(impact): ReactionInput
```

职责：

- 给 Autofit 等 reaction 使用
- 不直接依赖 UI signal
- 默认为 runtime side effect 编译器

### 10.3 Why Compiler Layer Belongs To Engine

原因：

- `index / edge / signals` 都是 engine runtime 控制机制
- `reactions` 是 engine side effect 机制

这些都不属于 core 事实层。

所以 compiler 必须在 engine，而不是 core。

---

## 11. Read Runtime

### 11.1 Replace `applyInvalidation`

当前：

```ts
applyInvalidation(invalidation)
```

目标：

```ts
read.ingest(impact)
```

内部流程：

```ts
const ingest = (impact: ReadImpact) => {
  const control = compileReadControl(impact)
  applyReadControl(control)
}
```

### 11.2 Signal Atoms

新增 signal atoms：

- `node`
- `edge`
- `mindmap`

signal atoms 只存 revision number。

### 11.3 Subscription Keys

最终订阅 key：

```ts
READ_STATE_KEYS = {
  interaction,
  tool,
  selection,
  viewport,
  mindmapLayout
}

READ_SIGNAL_KEYS = {
  node,
  edge,
  mindmap
}
```

删除：

- `projection`

### 11.4 Route A: Pure Memoized `readModel()`

已选路线 A：

1. engine 只接受不可变 document 输入
2. 删除 `readModelRevision`
3. 删除 `snapshotAtom`
4. read kernel 内部改成纯 memoized `readModel()`

它不再承担任何 atom 级 read model 协调职责。

---
## 12. React Subscription Mapping

### 12.1 Node Consumers

订阅：

- `READ_SIGNAL_KEYS.node`

适用组件：

- `NodeLayer`
- `NodeItemById`

### 12.2 Edge Consumers

订阅：

- `READ_SIGNAL_KEYS.edge`
- 需要时叠加 `selection`

适用组件：

- `EdgeLayer`
- `EdgeControlPointHandles`
- `EdgeEndpointHandles`

### 12.3 Mindmap Consumers

订阅：

- `READ_SIGNAL_KEYS.mindmap`
- `READ_STATE_KEYS.mindmapLayout`

适用组件：

- `MindmapLayerStack`
- `MindmapLayer`

### 12.4 Viewport Transform

继续由：

- `READ_STATE_KEYS.viewport`

驱动，不新增 signal。

---

## 13. Reactions

reactions 默认不消费 UI signals，而是消费 impact。

推荐：

```ts
reactions.ingest(impact)
```

在 reaction 内部：

- 只使用自己需要的 impact 片段
- Autofit 默认主要关心 `reset / node.list / node.geometry / mindmap.view`

这样 reaction 与 UI signal 彻底解耦。

---

## 14. Migration Order

### Phase 1. Core Fact Layer

1. 新增 `KernelReadImpact`
2. reducer 输出从 `invalidation` 改成 `read`
3. reducer 内部把 patch classification 收敛到 node / edge / mindmap impact 上

### Phase 2. Engine Compiler Layer

1. 新增 `compileReadControl`
2. 新增 `compileReactionInput`（可后置）
3. 删除 engine 对 `ReadInvalidation` 的直接依赖
4. 收敛 kernel 对 impact 的重复解释

### Phase 3. Read Runtime

1. `read.ingest` 内部改成 `compileReadControl -> applyReadControl`
2. 新增 signal atoms
3. 删除 `projection` 订阅 topic

### Phase 4. React Migration

1. node consumers -> `node`
2. edge consumers -> `edge`
3. mindmap consumers -> `mindmap`
4. viewport render 仍使用 `viewport`

### Phase 5. Cleanup

删除以下概念：

- `KernelProjectionInvalidation`
- `ReadInvalidation`
- `READ_SUBSCRIPTION_KEYS.projection`
- 任何“UI 订阅直接依赖 cache invalidation”的逻辑

---

## 15. Validation Rules

### 15.1 Node Style Update

场景：

- `node.update({ style })`

期望：

- `impact.node.value = true`
- `impact.node.geometry = false`
- `impact.node.list = false`
- `impact.edge.* = false`
- `impact.mindmap.view` 仅在该节点是 mindmap root 时为 true

### 15.2 Node Geometry Update

场景：

- `node.update({ position })`

期望：

- `impact.node.geometry = true`
- `impact.edge.geometry = true`
- `impact.node.list = false`
- 若命中 mindmap root，则 `impact.mindmap.view = true`

### 15.3 Group Collapsed Toggle

场景：

- `node.update({ data: { ...collapsed } })`

期望：

- `impact.node.value = true`
- `impact.node.list = true`
- `compileReadControl(impact).signals` 会唤醒 `node` 与 `edge`
- `Autofit` 走 full rebuild

### 15.4 Edge Label Update

场景：

- `edge.update({ label })`

期望：

- `impact.edge.value = true`
- `impact.edge.geometry = false`
- `impact.edge.list = false`
- `impact.node.* = false`
- `impact.mindmap.view = false`

### 15.5 Mindmap Update

场景：

- `mindmap.set`

期望：

- `impact.mindmap.view = true`
- node / edge 不再被强行写入 consumer 导向字段
- 由 engine compiler 与 read model 决定实际唤醒范围

### 15.6 Edge Change Must Not Wake Node Subscribers

场景：

- 仅 edge 内容变化

期望：

- `compileReadControl(impact).signals` 输出：
  - `edge = true`
  - `node = false`
  - `mindmap = false`

## 16. Final Recommended Chain

长期最优链路：

`commands -> operations -> core reduce -> KernelReadImpact -> engine compilers -> read cache apply + signal publish -> ui subscribe + reactions`

展开后：

1. `commands`
2. `write.apply`
3. `core.reduce`
4. `KernelReadImpact`
5. `compileReadControl(impact)`
6. `compileReactionInput(impact)`
7. `read.ingest(impact)`
9. `ui subscribe(topic)`
10. `reactions.ingest(impact)`

这是当前架构下更符合漏斗原则和数据驱动的终局。

---

## 17. Final Decision

长期全局最优决策：

1. core 终态输出应为 `KernelReadImpact`
2. 不让 core 直接输出 `cache + signal`
3. 不让 projections / caches / reactions 各自直接解析 operations
4. engine 负责把 impact 编译成：
   - read control
   - reaction input
5. `projection` 订阅 topic 最终删除
6. `node / edge / mindmap` 成为唯一 projection 订阅 topic

一句话总结：

- core 只说发生了什么
- engine 决定怎么做
- UI 只订阅自己关心的语义 topic

这才是长期全局最优。
