# Engine Read / Query 收口最终方案

更新日期：2026-03-07
范围：`packages/whiteboard-engine`、`packages/whiteboard-react`
目标：已完成 `read / query` 收口，engine 对外现在只保留一棵清晰的只读树。

## 0. 落地状态

1. 已删除顶层 `instance.query`。
2. 已统一为单一 `instance.read` 入口。
3. 已把 `viewport / canvas / snap` 并入 `read`。
4. 已删除 `read.viewport.get()` 与 `read.viewport.getZoom()`。
5. 已把 `READ_SUBSCRIPTION_KEYS.snapshot` 改成 `READ_SUBSCRIPTION_KEYS.projection`。

## 1. 当前结论

当前最优方案不是继续保留顶层 `instance.query`，也不是把 `query` 简单挪成 `read.query` 就结束。

全局最优方案是：

1. 删除顶层 `instance.query`。
2. 对外只保留一个只读入口：`instance.read`。
3. 把现在 `query` 里的能力按语义并回 `read`：
   - `read.viewport`
   - `read.canvas`
   - `read.snap`
4. 保留现有的：
   - `read.state`
   - `read.projection`
   - `read.doc`
   - `read.config`
   - `read.subscribe`
5. 删除 `query.viewport.get()` 与 `query.viewport.getZoom()` 这类和 `read.state.viewport` 重叠的入口。
6. 把 `READ_SUBSCRIPTION_KEYS.snapshot` 改成更语义化的 `READ_SUBSCRIPTION_KEYS.projection`。

一句话：**所有只读能力统一到 `read`，按语义分域，而不是按“值读取 / 方法查询”分成两棵顶层树。**

---

## 2. 为什么当前设计还不够简

当前 `createReadKernel` 同时构造：

1. `read`
2. `query`
3. `applyInvalidation`

其中 `read` 和 `query` 的数据来源其实是同一套：

1. `store + stateAtoms`
2. `snapshotAtom`
3. `indexer`
4. `ViewportHost`
5. 各 projection stage

也就是说，当前不是两套读系统，而是**同一个 read kernel 对外拆成了两张面**。

这会带来三个问题：

### 2.1 顶层 API 重复分叉

调用方现在要先判断：

1. 这是 `instance.read.xxx`
2. 还是 `instance.query.xxx`

这不是业务语义差异，而是实现风格差异。

对业务代码来说，这两个入口本质上都只是“读”。

### 2.2 `query.viewport` 和 `read.state.viewport` 有重叠

当前重叠最明显的是：

1. `instance.query.viewport.get()`
2. `instance.query.viewport.getZoom()`
3. `instance.read.state.viewport`

这里：

1. `get()` 和 `read.state.viewport` 都是在读当前 viewport。
2. `getZoom()` 只是 `read.state.viewport.zoom` 的另一种包装。

所以现在 `query.viewport` 里混了两类东西：

1. 真正的几何转换能力
2. 已经在 `read.state` 里有原始来源的重复 getter

这会让边界不够干净。

### 2.3 `READ_SUBSCRIPTION_KEYS.snapshot` 泄漏实现细节

当前 projection 订阅方都在写：

1. `READ_SUBSCRIPTION_KEYS.snapshot`

但业务层真正关心的不是“snapshot”这个内部实现，而是：

1. projection 变了
2. 只读视图变了

所以 `snapshot` 这个 key 名字不够语义化，属于内部结构泄漏。

---

## 3. 当前调用面研究结果

### 3.1 `instance.query` 现在主要被谁用

`query` 的实际调用高度集中在交互热路径和少量 perf kernel，核心是三组能力：

1. `viewport`
   - `clientToScreen`
   - `screenToWorld`
   - `getScreenCenter`
   - `getZoom`
   - 少量 `get`
2. `canvas`
   - `nodeRect`
   - `nodeRects`
   - `nodeIdsInRect`
3. `snap`
   - `candidatesInRect`
   - 少量 `candidates`

这说明 `query` 本质不是“另一张 read 面”，而是：

1. viewport 几何读能力
2. index 查询能力

### 3.2 `instance.read` 现在主要被谁用

`read` 的实际调用主要集中在：

1. `read.state.*`
2. `read.projection.*`
3. `read.doc.get()`
4. `read.config`
5. `read.subscribe(...)`

这说明 `read` 已经承担了稳定只读主入口，只是还没把 `query` 也收进来。

---

## 4. 最终对外 API 设计

最终建议把 `Instance` 的只读面统一成：

```ts
type EngineRead = {
  state: {
    interaction: InteractionState
    tool: Tool
    selection: SelectionState
    viewport: Viewport
    mindmapLayout: MindmapLayoutConfig
  }

  projection: {
    viewportTransform: ViewportTransformView
    node: NodesView
    edge: EdgesView
    mindmap: MindmapView
  }

  viewport: {
    screenToWorld(point: Point): Point
    worldToScreen(point: Point): Point
    clientToScreen(clientX: number, clientY: number): Point
    clientToWorld(clientX: number, clientY: number): Point
    getScreenCenter(): Point
    getContainerSize(): Size
  }

  canvas: {
    nodeRects(): CanvasNodeRect[]
    nodeRect(nodeId: NodeId): CanvasNodeRect | undefined
    nodeIdsInRect(rect: Rect): NodeId[]
  }

  snap: {
    candidates(): SnapCandidate[]
    candidatesInRect(rect: Rect): SnapCandidate[]
  }

  doc: {
    get(): Readonly<Document>
  }

  config: InstanceConfig

  subscribe(
    keys: readonly ReadSubscriptionKey[],
    listener: () => void
  ): () => void
}
```

然后删除：

1. `Instance['query']`
2. `types/instance/query.ts` 这张独立 public 面

---

## 5. 为什么这是“最简且最优”

### 5.1 只有一个顶层 read 入口

调用者不再需要判断：

1. `instance.read`
2. `instance.query`

只需要知道：**所有读，都在 `instance.read`**。

### 5.2 语义分域比“query”这个抽象词更清楚

相比：

1. `instance.query.viewport.*`
2. `instance.query.canvas.*`
3. `instance.query.snap.*`

改成：

1. `instance.read.viewport.*`
2. `instance.read.canvas.*`
3. `instance.read.snap.*`

更像真实业务语义，而不是“这是一个查询接口”的抽象分类。

### 5.3 参数化查询仍然保留，不会把 projection 搞脏

这个方案不是把所有东西都塞进 `projection`。

仍然保持明确边界：

1. `state` 放原始状态
2. `projection` 放稳定投影
3. `viewport / canvas / snap` 放参数化只读方法

所以不会牺牲清晰度。

### 5.4 热路径能力仍然是 getter / method，不会退化成订阅式读取

交互热路径最重要的是：

1. 事件时读取当前值
2. 不触发额外订阅
3. 不走 React rerender

把 `query` 并回 `read` 后，这一点完全不受影响。

`read.viewport / read.canvas / read.snap` 依然可以保持现在的 method 形态。

---

## 6. 需要同步收口的细节

### 6.1 删掉 `viewport.get()`

最优状态下不应保留：

1. `read.viewport.get()`

原因：

1. 原始 viewport 已经有 `read.state.viewport`。
2. 再提供 `get()` 只是重复入口。

### 6.2 删掉 `viewport.getZoom()`

最优状态下也不应保留：

1. `read.viewport.getZoom()`

原因：

1. `zoom` 已经是 `read.state.viewport.zoom`。
2. 再单独提供 `getZoom()` 没有新增语义。

热路径要 zoom 时，直接读：

1. `instance.read.state.viewport.zoom`

即可。

### 6.3 `snapshot` 订阅 key 改成 `projection`

当前：

```ts
READ_SUBSCRIPTION_KEYS.snapshot
```

建议改成：

```ts
READ_SUBSCRIPTION_KEYS.projection
```

原因：

1. 业务层关心的是 projection 变化。
2. `snapshot` 是 read kernel 内部构造细节。

如果后续还要继续细分，再考虑：

1. `projection`
2. `canvas`
3. `snap`

但第一步没必要过度拆细，先把 `snapshot -> projection` 即可。

---

## 7. 对现有调用方的影响

### 7.1 React 交互层

当前这类调用：

1. `instance.query.viewport.clientToScreen(...)`
2. `instance.query.viewport.screenToWorld(...)`
3. `instance.query.canvas.nodeRect(...)`
4. `instance.query.snap.candidatesInRect(...)`

最终统一改成：

1. `instance.read.viewport.clientToScreen(...)`
2. `instance.read.viewport.screenToWorld(...)`
3. `instance.read.canvas.nodeRect(...)`
4. `instance.read.snap.candidatesInRect(...)`

### 7.2 `useViewportGestureInteraction`

当前这里还在用：

1. `instance.query.viewport.get()`
2. `instance.query.viewport.getScreenCenter()`

最优收口后：

1. `instance.read.state.viewport`
2. `instance.read.viewport.getScreenCenter()`

### 7.3 NodeRegistry / NodeRenderProps

当前 `NodeRenderProps` 里是：

```ts
query: Instance['query']
```

最终建议改成：

```ts
read: Pick<EngineRead, 'viewport' | 'canvas' | 'snap'>
```

也就是：

1. 对节点渲染定义暴露一个明确的只读子集
2. 不再把 `query` 作为独立概念继续向外传播

如果想先低成本迁移，也可以过渡一版：

1. 字段名先保留 `query`
2. 实际类型改成 `Pick<EngineRead, 'viewport' | 'canvas' | 'snap'>`

但全局最优最终还是把名字也改成 `read`。

---

## 8. 实现顺序建议

### Phase 1：收进 `read`

1. `createReadKernel` 不再返回独立 `query`
2. 把 `viewport / canvas / snap` 直接挂到 `read`
3. `Instance` 删除顶层 `query`
4. 全量迁移调用点到 `instance.read.*`

### Phase 2：删重叠入口

1. 删除 `read.viewport.get()`
2. 删除 `read.viewport.getZoom()`
3. 调用方统一读 `read.state.viewport` 和 `read.state.viewport.zoom`

### Phase 3：订阅 key 语义化

1. `READ_SUBSCRIPTION_KEYS.snapshot -> projection`
2. 迁移 `useReadGetter` 和所有 projection 订阅点

### Phase 4：清理类型与文档

1. 删除 `types/instance/query.ts`
2. 更新 `NodeRenderProps`
3. 更新架构文档与 AGENTS 里关于 `instance.query` 的约定

---

## 9. 不建议的方案

### 9.1 保留顶层 `instance.query`

不建议。

原因：

1. 这会继续保留两张顶层读面。
2. 使用者仍要先判断去哪一棵树上找能力。

### 9.2 只改成 `read.query.*`

这比现在好一点，但还不是最优。

原因：

1. 顶层入口虽然统一了，但 `query` 这个抽象层仍然存在。
2. `read.query.viewport.get()` 依然和 `read.state.viewport` 重叠。
3. 语义上不如 `read.viewport / read.canvas / read.snap` 直观。

### 9.3 把参数化查询塞进 `projection`

不建议。

原因：

1. `projection` 应该保持稳定视图语义。
2. 参数化方法会把 projection 变成杂糅容器。

---

## 10. 最终判断

如果按“漏斗原则 + CQRS + 全局最简”来看，`read / query` 的最优收口不是继续保留两张面，而是：

1. **删除顶层 `query`**
2. **所有只读统一进入 `read`**
3. **在 `read` 内按语义拆成 `state / projection / viewport / canvas / snap / doc / config / subscribe`**
4. **删掉与 `read.state.viewport` 重叠的 `get / getZoom`**
5. **把 `snapshot` 订阅 key 改成 `projection`**

一句话：

**当前最值得做的不是继续给 `query` 找位置，而是让它消失成概念，只留下一个语义完整的 `read`。**
