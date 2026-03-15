# Whiteboard Runtime Store 统一模型设计

## 当前状态

本文方案已经完成落地，不再是过渡提案。

当前实现状态如下：

1. `runtime store primitive` 已下沉到 `packages/whiteboard-core/src/runtime/`，并通过 `@whiteboard/core/runtime` 对外导出。
2. `whiteboard-engine` 的读层已收敛为纯 store 结构：
   `read.node = { ids: ReadStore, byId: KeyedReadStore }`
   `read.edge = { ids: ReadStore, byId: KeyedReadStore }`
   `read.mindmap = { ids: ReadStore, byId: KeyedReadStore }`
   `read.tree = KeyedReadStore`
3. `whiteboard-react` 已移除 `Jotai`、`uiStore`、`toolAtom`、`selectionAtom`、`viewportAtom`。
4. `tool / scope / selection / viewport` 均已切换为 source store。
5. `view.selection / view.scope / view.interaction` 已切换为 `createDerivedStore({ get(read) => ... })` 驱动。
6. `runtime/view` 已收缩为共享 store 视图层，不再承载 `node / edge / mindmap` 这类实体级参数化展示查询。
7. 节点、边、脑图的实体展示逻辑已回到各自 feature hook，避免在 runtime 层继续堆积 feature-specific presentation。
8. React 侧只保留 `useStoreValue` 这类 React 绑定；store 协议与实现不再停留在 react 包内。

## 背景

当前 `packages/whiteboard-react` 和 `packages/whiteboard-engine` 在“状态”和“派生”上，实际上存在两套不同的模型。

## engine 侧

engine 当前的读模型已经非常接近一套 runtime store：

- `read.node`
- `read.edge`
- `read.tree`
- `read.mindmap`
- `read.index.*`

这些对象都具备以下特征：

- 不依赖 React
- 运行在 runtime/instance 之外
- 通过 `get / subscribe` 暴露读能力
- 由 write pipeline + impact 驱动更新

## UI/runtime 侧

whiteboard-react 当前的 UI runtime state 则是：

- Jotai `createStore + atom`
- `uiStore.get/set/sub`
- `instance.view.*`
- `useView(useSyncExternalStore)`

从表面上看，这像是一套 atom-based state；但真实使用方式并不是：

- 没有组件层普遍 `useAtom`
- 没有真正的 atom graph
- 没有 derived atom/select atom 体系
- Jotai 实际只剩一个 `get/set/sub` backend

同时，`runtime/view/*` 又在上层手写了一套：

- `get()`
- `subscribe(listener)`
- `isEqual(left, right)`

这层东西在概念上已经非常接近：

- derived atom
- select atom

但实现方式又不是“声明依赖图”，而是“手工编排 subscribe”。

---

## 当前真正的问题

当前系统最麻烦的地方，不是“要不要 Jotai”本身，也不是“subscribe 多不多”本身，而是：

**engine 读层和 UI/runtime 状态层没有统一成同一种 store 模型。**

这会直接造成三个问题。

## 1. `instance` 变成隐式依赖黑箱

当前很多派生逻辑最终都长成：

```ts
readSelectionState(instance)
readScopeView(instance)
```

这种写法的问题是：

- `instance` 太宽
- 派生依赖不透明
- 看 `get()` 根本不知道它依赖哪些 source
- 最后只能靠手写 `subscribe()` 去同步依赖

这和 atom 心智是相反的。

在 atom 模型里：

- atom 依赖 atom
- `get(atom)` 是显式依赖关系

而不是：

- “一个大对象里藏着若干依赖”

## 2. 派生逻辑和订阅逻辑分离

当前 `view.*` 基本都是：

- `get()` 里写派生
- `subscribe()` 里再手写依赖图
- `isEqual()` 里做值稳定

这导致：

- 依赖容易漏
- subscribe 样板多
- 动态依赖尤其难看
- 阅读成本高

## 3. Jotai 的结构性价值已经消失

当前 Jotai 已经不再提供真正的 atom 图价值，只是在做：

- 单值槽位
- `get/set/sub`
- atom key

这说明当前系统真正需要的，不是另一个状态库，而是：

**一套统一的、与 React 无关的 runtime store 协议。**

---

## 结论

本文建议将 whiteboard runtime 统一成如下模型：

1. 去掉 Jotai。
2. 去掉 `uiStore`。
3. 保留 engine 的 write pipeline，不统一 write 模型。
4. 统一 engine 读层与 UI 状态层的 store 协议。
5. 让 `instance` 只做 wiring/composition，不再成为派生状态的依赖容器。
6. 将 `view.*` 正式收敛为 derived/select store。
7. `createDerivedStore` 采用自动依赖收集模型：

```ts
createDerivedStore({
  get: (read) => ...,
  isEqual?
})
```

一句话概括：

**统一读模型，保留写差异；由 source store、keyed store、derived store 组成一套 runtime store 图。**

---

## 非目标

本文明确不做以下事情：

1. 不把 engine write pipeline 改造成 atom graph。
2. 不把整个系统收敛成一个 global store。
3. 不把 runtime 行为逻辑改成 React 内部状态驱动。
4. 不引入另一套大型状态管理框架。
5. 不让 `instance` 继续作为派生状态的隐式 store。

---

## 最终最优模型

最终最优模型由四类 store 组成。

## 1. `ValueStore<T>`

表示可写的原始值 store。

```ts
type ValueStore<T> = {
  get(): T
  set(next: T): void
  update(recipe: (prev: T) => T): void
  subscribe(listener: () => void): () => void
}
```

适用：

- tool state
- scope active id
- selection raw state
- viewport raw state

它对应“primitive atom”。

## 2. `ReadStore<T>`

表示只读的派生或投影 store。

```ts
type ReadStore<T> = {
  get(): T
  subscribe(listener: () => void): () => void
}
```

适用：

- 非 keyed 的 projection
- `view.tool`
- `view.selection`
- `view.scope`

## 3. `KeyedReadStore<K, T>`

表示按 key 读取和订阅的 projection。

```ts
type KeyedReadStore<K, T> = {
  get(key: K): T
  subscribe(key: K, listener: () => void): () => void
}
```

适用：

- `read.node`
- `read.edge`
- `read.tree`
- `read.mindmap`
- `view.node`
- `view.edge`
- `view.mindmap`

这类 store 在 engine 中是天然存在的。

## 4. `DerivedStore<T>`

`DerivedStore<T>` 在对外协议上与 `ReadStore<T>` 相同：

```ts
type DerivedStore<T> = ReadStore<T>
```

它的区别在于构造方式：

- 不是直接托管原始值
- 也不是单一 keyed projection
- 而是通过 `get(read)` 从多个 source stores 中自动收集依赖并派生

---

## 为什么最终方案必须是 `get(read)` 而不是 `sources + derive`

本文明确推荐：

```ts
createDerivedStore({
  get: (read) => ...,
  isEqual?
})
```

而不是：

```ts
createDerivedStore({
  sources: {...},
  derive: (...) => ...
})
```

原因如下。

## 1. 更接近 atom 心智

在 atom 模型里：

```ts
atom((get) => ...)
```

核心不是“我先手写依赖列表”，而是：

- 在 `get(...)` 时显式建立依赖

因此若想让最终 runtime store 模型真正具备 atom 的心智简洁性，就应该采用 `get(read)`。

## 2. 派生关系与订阅关系天然统一

当前体系最大的问题是：

- `get()` 里一套逻辑
- `subscribe()` 里再写一套依赖图

`get(read)` 的价值就在于：

- 谁被读到，谁就是依赖
- 依赖图由运行时自动收集
- 不再需要 `subscribeToSources` 这种重复层

## 3. 动态依赖可以自然表达

例如：

```ts
const scopeId = read(scopeState)
const ids = scopeId
  ? read(treeStore, scopeId)
  : EMPTY_IDS
```

这里依赖是动态的：

- 没有 scopeId 时，不依赖 `treeStore(scopeId)`
- 有 scopeId 时，依赖某个具体 root

手写 `sources + derive` 仍然需要显式声明 keyed 依赖，自动依赖收集则天然适合这个场景。

## 4. 可以正式让 `instance` 退出派生图

最重要的一点是：

```ts
readSelectionState(instance)
```

这种写法之所以怪，就是因为它让 `instance` 成了派生图里的隐式 store。

而 `get(read)` 会迫使系统走向：

- store 依赖 store
- projection 依赖 projection

而不是：

- projection 依赖 instance 大对象

---

## 最终推荐的 primitive

## 1. `createValueStore`

```ts
function createValueStore<T>(
  initial: T,
  options?: {
    isEqual?: (prev: T, next: T) => boolean
  }
): ValueStore<T>
```

职责：

- 托管单个可写值
- 提供订阅

不要加：

- selector graph
- batch
- transaction
- middleware
- devtools graph

## 2. `createDerivedStore`

正式推荐接口：

```ts
function createDerivedStore<T>({
  get,
  isEqual
}: {
  get: (read: ReadFn) => T
  isEqual?: (prev: T, next: T) => boolean
}): DerivedStore<T>
```

其中：

```ts
type ReadFn = {
  <T>(store: ReadStore<T>): T
  <K, T>(store: KeyedReadStore<K, T>, key: K): T
}
```

这就是整套模型里最核心的原语。

## 3. `createSelectStore`

`select` 在这个体系里本质上可以视作 `createDerivedStore` 的特例。

也就是说：

```ts
const zoomStore = createDerivedStore({
  get: (read) => read(viewportState).zoom
})
```

已经能表达 select atom 的能力。

因此从“最小原语”角度看，`createSelectStore` 不是必须的。  
它可以作为语法糖存在，但不必作为核心能力。

我建议：

- 内部先只做 `createValueStore + createDerivedStore`
- 如后续语义层需要，再补 `createSelectStore`

## 4. `useStoreValue`

```ts
function useStoreValue<T>(store: ReadStore<T>): T
```

内部继续使用 `useSyncExternalStore`。

它在心智上对应：

- `useAtomValue(atom)`

但底层是 runtime store，而不是 React atom runtime。

---

## `createDerivedStore` 的明确实现方案

这里给出第一版可直接落地的实现方案。

## 核心要求

第一版只支持：

1. 同步 `get(read)`
2. `read(store)`
3. `read(keyedStore, key)`
4. 自动依赖收集
5. 依赖重绑
6. `isEqual` 去抖

第一版不支持：

1. async derived
2. writable derived
3. transaction
4. batch scheduling
5. devtools graph inspect
6. 高级循环依赖恢复

这套边界必须收紧，否则会迅速膨胀成一个完整响应式系统。

---

## 依赖项建模

内部依赖项必须能区分：

- 普通 store
- keyed store + key

建议内部统一成：

```ts
type Dependency =
  | {
      kind: 'store'
      store: ReadStore<unknown>
    }
  | {
      kind: 'keyed'
      store: KeyedReadStore<unknown, unknown>
      key: unknown
    }
```

注意：

- keyed 依赖不能只记 store，必须同时记 key
- 否则 `treeStore(rootIdA)` 和 `treeStore(rootIdB)` 无法区分

---

## `read` 的工作方式

每次执行 `get(read)` 时，`read` 需要做两件事：

1. 返回被读 store 当前值
2. 把被读对象登记到本轮依赖集合里

逻辑上类似：

```ts
const read = (store, key?) => {
  currentDeps.add(dep)
  return key === undefined ? store.get() : store.get(key)
}
```

---

## 首次计算

首次创建 derived store 时：

1. 开始一轮依赖收集
2. 执行 `get(read)`
3. 得到结果值 `value`
4. 得到依赖集合 `deps`
5. 为 `deps` 建立订阅

这样 derived store 才能开始工作。

---

## 依赖变化后的重算流程

当任一依赖触发 listener 时：

1. 再执行一轮 `get(read)`
2. 收集新依赖集合 `nextDeps`
3. 算出新值 `nextValue`
4. 比较旧依赖集和新依赖集
5. 若依赖集变化，则取消旧订阅并绑定新订阅
6. 比较 `prevValue` 与 `nextValue`
7. 若值真的变化，才通知 derived store 的 listeners

这套流程是整个自动依赖收集的关键。

---

## 依赖重绑策略

建议采取：

- 每次重算后比较依赖集合
- 若集合变化，整体重绑

不要第一版就尝试做复杂的最小 diff 订阅更新。

原因：

- 第一版目标是正确性和心智清晰
- 依赖集通常不会大到值得在第一版里做复杂优化

后续如有性能需求，再做：

- 依赖集 diff
- keyed 订阅细粒度更新

---

## 值比较策略

建议支持：

- 默认 `Object.is`
- 可选 `isEqual(prev, next)`

流程：

- 依赖变了，不等于一定通知
- 必须先重算值
- 只有 `isEqual(prev, next) === false` 才通知下游

这点必须保留，因为你们当前 `view.selection` / `view.scope` 都依赖自定义 comparator 去减少无意义更新。

---

## keyed store 的实现位置

engine 当前已经天然提供 keyed read projection：

- `read.node`
- `read.edge`
- `read.tree`
- `read.mindmap`

因此 runtime store 模型统一后，应直接把这些对象看作：

- `KeyedReadStore`

而不是再包一层“适配 view 的特殊结构”。

这正是统一 engine 读层与 UI 状态层模型的关键收益之一。

---

## 纯函数约束

`createDerivedStore({ get(read) })` 的 `get` 必须严格纯函数化。

明确要求：

- 只能读 store
- 不能写 store
- 不能 dispatch command
- 不能访问 DOM
- 不能做副作用
- 不能依赖不受控外部可变对象

否则自动依赖收集的正确性会很快失效。

这点和 atom 的 read-only 派生完全一致。

---

## 是否需要循环依赖检测

第一版建议只做最小检测。

可采用：

- 计算时标记 `computing = true`
- 若重入同一个 derived store，则直接抛错

例如：

```ts
if (computing) {
  throw new Error('Circular derived store dependency detected.')
}
```

这足够覆盖第一版。

不建议第一版实现复杂的循环恢复策略。

---

## engine 与 UI 统一后的关系

统一 store 模型之后，整个系统应被理解为：

## source stores

### UI side

- `toolState`
- `scopeState`
- `selectionState`
- `viewportState`

### engine side

- `read.node`
- `read.edge`
- `read.tree`
- `read.mindmap`

注意：

- engine read projection 本身就是 source stores
- 它们不是“外部黑盒函数”

## derived stores

- `view.tool`
- `view.selection`
- `view.scope`
- 后续若需要，也包括更细的 select/derived projection

## instance

`instance` 只做：

- commands wiring
- source stores wiring
- derived stores wiring
- service wiring

而不再承担：

- “派生状态的隐式 store”

---

## 一个明确的目标示例

最终 `selectionView` 的形态应该接近：

```ts
const selectionView = createDerivedStore({
  get: (read) => {
    const selection = read(selectionState)
    const scopeId = read(scopeState)

    const scopeNodeIds = scopeId
      ? read(treeStore, scopeId)
      : EMPTY_NODE_IDS

    return resolveSelectionView({
      selection,
      scopeId,
      scopeNodeIds,
      readNode: (nodeId) => read(nodeStore, nodeId)
    })
  },
  isEqual: isSelectionStateEqual
})
```

这里有几个关键点：

1. 不出现 `instance`
2. store 依赖显式
3. keyed 依赖可以动态出现
4. 自动依赖收集由 runtime 负责

这就是最终模型应当达到的方向。

---

## 为什么不再保留 `uiStore`

如果最终已经有了统一 store 模型，那么 `uiStore` 就没有继续存在的必要。

原因如下。

## 1. 它会把 domain ownership 再次打散

真正合理的结构应该是：

- tool domain 拥有 toolState
- scope domain 拥有 scopeState
- selection domain 拥有 selectionState
- viewport service 拥有 viewportState

而不是：

- 所有值都寄存在一个中心 store 里

## 2. 它会重新制造“key-based state host”

如果去掉 Jotai，但保留：

```ts
uiStore.get('selection')
uiStore.set('selection', next)
```

那只是把 atom key 换成 string key，结构收益很小。

## 3. 它不符合最终最优模型

最终最优模型的重点是：

- source stores 彼此独立
- derived stores 显式依赖 source stores

中心 `uiStore` 会模糊这层关系。

---

## 落地结果

原迁移顺序中的所有阶段都已完成，最终结果如下：

1. `ValueStore<T>`、`ReadStore<T>`、`KeyedReadStore<K, T>`、`createValueStore`、`createDerivedStore` 已落在 `@whiteboard/core/runtime`。
2. engine 读层已经正式声明为 core runtime store 协议的一部分，而不是 react 侧的特殊对象。
3. viewport 已切换到 `viewportState: ValueStore<Viewport>`。
4. tool 与 scope 已切换到独立 source store。
5. selection 已切换到 `selectionState: ValueStore<StoredSelection>`。
6. `view.selection / view.scope / view.interaction` 已改为 `createDerivedStore({ get(read) => ... })`。
7. `uiStore` 及其相关 atom 已完全删除，`interactionLock` 也已脱离 `uiStore` identity。

---

## 风险与控制

## 风险 1：自动依赖收集实现膨胀

如果第一版就尝试支持：

- async
- batching
- writable derived
- complex transactions

会很快演变成完整响应式框架。

控制原则：

- 第一版只做同步、只读、最小能力

## 风险 2：derived store 仍然偷偷依赖 `instance`

如果重构过程中只是把外层 API 换成 `createDerivedStore`，但里面仍然写：

```ts
get: (read) => readSelectionState(instance)
```

那结构问题并没有真正解决。

控制原则：

- derived store 内部不允许依赖 `instance`
- 只能依赖 source stores / keyed stores

## 风险 3：keyed 依赖去重与重绑写错

尤其是 `treeStore(rootId)` 这种动态 keyed 依赖，很容易在实现上漏掉 key。

控制原则：

- 依赖项必须包含 `store + key`
- keyed 依赖不能按 store 维度合并

## 风险 4：view 层和 keyed view 的统一节奏

`view.node / view.edge / view.mindmap` 比 `view.tool / view.scope / view.selection` 更复杂。

控制原则：

- 先重构非 keyed view
- keyed view 后续再统一

---

## 方案对比

### 方案 A：保留当前 Jotai + 手写 subscribe/view

优点：

- 不动现有结构

缺点：

- 两套状态模型并存
- `instance` 继续是隐式依赖黑箱
- subscribe 复杂度继续累积

结论：

- 不推荐

### 方案 B：回到 Jotai atom / derived atom / select atom，组件直接 useAtom

优点：

- UI 心智简单

缺点：

- 会削弱 runtime-first 架构
- engine projection 与 UI atom 图依然不是真正统一
- 行为层和 React 层边界容易变模糊

结论：

- 不推荐

### 方案 C：统一 runtime store 协议，并用 `get(read)` 做自动依赖收集

优点：

- engine 读层和 UI 状态层模型统一
- `instance` 回到 wiring/composition 角色
- 派生依赖显式
- 心智接近 atom
- 与 React 框架无关

缺点：

- 需要补一层最小 runtime primitive

结论：

- 推荐

---

## 最终建议

我建议采用以下最终最优模型：

1. 将 engine 读层和 UI 状态层统一成同一套 runtime store 协议。
2. 保留 engine 写流水线，不统一 write 模型。
3. 去掉 Jotai。
4. 去掉 `uiStore`。
5. 各 domain 自己拥有 source store。
6. 将 `instance.view.*` 改造成 `createDerivedStore({ get: (read) => ... })` 驱动的 derived stores。
7. `instance` 只做 wiring/composition，不再作为派生状态依赖容器。

一句话总结：

**最终最优模型不是 “手写 subscribe 的 view + Jotai backend + engine projection”，而是 “source stores + keyed stores + `get(read)` derived stores” 组成的一张统一 runtime store 图。**
