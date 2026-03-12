# Whiteboard Transient Runtime 设计

## 背景

当前白板运行时已经清晰分成两层：

- `@whiteboard/engine` 负责 committed document、projection、indexes、commands
- `@whiteboard/react` 负责交互、渲染组合、UI 生命周期

但是交互过程中还存在一类天然不属于 committed state 的高频临时状态：

- node drag / resize / rotate draft
- drag guides
- connection preview
- edge routing draft
- selection box
- mindmap drag preview

这类状态共同特点是：

- 生命周期很短，只存在于一次交互会话里
- 更新频率高，经常是每帧一次
- 不应该进入 history
- 不应该进入 document 持久化
- 不应该参与协同同步
- 往往需要跨 feature 联动渲染

这就是 transient state。

## 当前问题

现状不是“没有 transient”，而是 transient 的放置位置和作用域不够统一。

以 node 为例：

- [`packages/whiteboard-react/src/node/interaction/nodeInteractionTransient.ts`](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/interaction/nodeInteractionTransient.ts) 已经维护了一套 node draft overlay + guides 的临时读写模型
- [`packages/whiteboard-react/src/node/components/NodeFeature.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/components/NodeFeature.tsx) 内部创建并消费这套 transient
- [`packages/whiteboard-react/src/node/components/NodeItem.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/components/NodeItem.tsx) 会按 `nodeId` 读取 draft

这套设计对“node 自己动起来”是有效的，但存在两个结构性问题：

1. transient 作用域过于局部

- transient node 被封在 `NodeFeature` 内部
- [`packages/whiteboard-react/src/Whiteboard.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/Whiteboard.tsx) 里 `NodeFeature`、`EdgeFeature`、`MindmapFeature` 是 sibling
- 结果是 edge 无法读取 transient node，导致拖动 node 时依附它的 edge 不能跟着预览一起更新

2. transient 没有形成统一体系

- node 有自己的 transient
- edge connect / routing 目前有各自局部 preview/draft
- mindmap drag 也有独立 preview
- selection 也有自己的交互临时态

这会导致：

- 交互模型分散
- 跨 feature 预览联动变难
- reset / cancel / blur / escape 的收敛逻辑分散
- 很难回答“哪些是 committed，哪些是 transient”

## 设计目标

目标不是把所有状态都放到一个 store 里，而是建立一套清晰的 transient runtime 边界。

### 必须满足

- committed state 继续由 engine 管理
- transient state 不进入 document / history / collaboration
- 高频交互路径保留细粒度订阅，不放大到整层重渲染
- draft 可以跨 feature 消费
- feature 之间共享同一份 transient scene，而不是各自维护局部私有副本
- reset/cancel 行为有统一入口

### 明确不做

- 不把 transient 直接塞进 `engine.read.node` / `engine.read.edge`
- 不把 pointer session 本身挪进 engine
- 不把所有 transient 都强行统一成同一种订阅机制
- 不为了“范式统一”牺牲热路径性能

## 核心判断

### 1. transient 是必须有的

如果没有 transient，只剩两条路：

- 每次 `pointermove` 都直接写 committed engine state
- 所有变化都等 `pointerup` 再一次性提交

两条都不好：

- 前者会污染 history、commands、projection、协同语义
- 后者没有实时预览，交互体验明显变差

所以 transient 不是可选优化，而是运行时的必要层。

### 2. transient 不应该默认放进 engine

`engine` 当前最清晰的边界是：

- committed source of truth
- committed projection / index
- command 执行结果

把 transient 直接塞进 engine 会带来问题：

- committed read 语义变脏，`read.node / read.edge` 不再只是正式状态
- 高频帧级更新容易拖进 projection invalidation
- history / persistence / sync 边界会模糊
- engine 会被迫承载 UI host 的生命周期问题，例如 `blur`、`escape`、pointer cancel

因此更合理的设计是：

- engine 负责 committed state 和纯计算
- react runtime 负责 transient state 的存储与生命周期

### 3. transient 应该提升成 shared runtime，而不是 feature 私有状态

当前 transient node 的最大问题不是性能，而是作用域太低。

它本质上是“NodeFeature 私有 render overlay”，而不是“整个 whiteboard 的交互预览层”。

更合理的边界是：

- transient runtime 与 `NodeFeature` / `EdgeFeature` / `MindmapFeature` 同级
- 各 feature 只读写自己负责的 transient slice
- 但任何 feature 都可以消费别的 feature 所产生的 draft 结果

## 推荐目录

建议把 transient 体系从 `node/interaction` 等 feature 私有目录中抽出来，统一放到：

`packages/whiteboard-react/src/transient/`

理由：

- 这是 runtime 横切层，不是 node feature 私有实现
- 它会被 node / edge / mindmap / selection 共同依赖
- 相比 `common/interaction`，`transient` 是更明确的领域名
- 路径更短，也更接近它的真实职责

推荐目录结构如下：

```text
packages/whiteboard-react/src/transient/
  index.ts
  types.ts
  runtime.ts
  hooks.ts
  guides.ts
  node.ts
  connection.ts
  routing.ts
  selection.ts
  mindmap.ts
```

如果后续规模增大，可以继续拆子目录：

```text
packages/whiteboard-react/src/transient/
  core/
    runtime.ts
    types.ts
    hooks.ts
  node/
    node.ts
    guides.ts
  edge/
    connection.ts
    routing.ts
  mindmap/
    drag.ts
  selection/
    box.ts
```

初期建议先用扁平结构，避免再引入一层目录噪音。

## 推荐分层

transient 应拆成三层，而不是把所有“临时状态”混成一团。

### A. Session 层

这是事件驱动的会话态，只服务当前交互过程。

例如：

- pointerId
- lockToken
- drag start point
- resize drag state
- rotate drag state
- reconnect draft

建议：

- 保留在 feature hook / ref 中
- 不进入 shared transient store
- 不提供订阅

这类状态的核心作用是“驱动计算”，不是“驱动渲染”。

### B. Preview 层

这是渲染可见的临时态，应该成为 shared transient runtime 的主体。

例如：

- node draft overlays by id
- drag guides
- connection preview
- edge routing draft
- selection box
- mindmap drag preview

建议：

- 放进 `src/transient/`
- 提供明确的 read / write 边界
- 各 feature 可以跨模块消费

### C. Committed 层

继续保留在 engine：

- document
- node/edge/mindmap projection
- indexes
- commands
- history

## 推荐架构

### 总体关系

```text
engine
  committed document / projections / indexes / commands

react transient runtime
  draft state only

feature hooks
  session + math + write transient + commit commands

feature components
  read committed + read transient + render
```

更具体一点：

```text
pointer event
  -> feature session state(ref)
  -> math/kernel
  -> transient write(...)
  -> transient runtime commit (rAF/microtask)
  -> subscribed components rerender
  -> pointerup commit to engine.commands
```

## 数据模型建议

shared transient runtime 不应该暴露“一个大对象给所有人订阅”，而应该按职责拆 slice。

建议至少包含这些 slice：

```ts
type WhiteboardTransientState = {
  node: ReadonlyMap<NodeId, NodeDraft>
  guides: readonly Guide[]
  connection?: ConnectionPreview
  routing?: RoutingDraft
  selection?: Rect
  mindmap?: MindmapDragPreview
}
```

重点不是这个顶层对象本身，而是每个 slice 必须有自己的读模型和失效边界。

## 读写边界建议

推荐把读接口直接平铺到 slice 上，只保留明确的写入口，不要让组件拿到完整 controller。

```ts
type WhiteboardTransient = {
  node: {
    get: (nodeId: NodeId) => NodeDraft
    subscribe: (nodeId: NodeId, listener: () => void) => () => void
    write: (drafts: ReadonlyMap<NodeId, NodeDraft>) => void
    clear: () => void
  }
  guides: {
    get: () => readonly Guide[]
    write: (guides: readonly Guide[]) => void
    clear: () => void
  }
  connection: {
    get: () => ConnectionPreview | undefined
    write: (preview: ConnectionPreview | undefined) => void
    clear: () => void
  }
  routing: {
    get: () => RoutingDraft | undefined
    write: (draft: RoutingDraft | undefined) => void
    clear: () => void
  }
  selection: {
    get: () => Rect | undefined
    write: (rect: Rect | undefined) => void
    clear: () => void
  }
  mindmap: {
    get: () => MindmapDragPreview | undefined
    write: (preview: MindmapDragPreview | undefined) => void
    clear: () => void
  }
}
```

关键原则：

- 组件默认只拿 `get / subscribe`
- feature runtime hook 才拿 `write`
- session clear 只通过 owner 调用

## 订阅策略建议

不要追求所有 transient slice 都用同一种响应式机制。

应该按访问模式选型。

### 适合 keyed external store 的

- node draft overlays by id
- active routing draft
- active mindmap drag preview

特点：

- 高频更新
- 需要 keyed 细粒度订阅
- 不希望整层重渲

### 适合 atom 的

- guides
- selection box
- connection preview line

特点：

- layer 级消费
- 读者数量少
- 没有 keyed 粒度要求

因此“guides 走 atom、transient node 走 keyed external store”本身不是问题。  
真正的问题是这些 slice 现在没有被放到统一 transient runtime 里。

## edge 跟随 transient node 的设计

这是当前最重要的结构性例子。

### 当前问题

目前 edge 读取 committed `EdgeEntry`：

- [`packages/whiteboard-react/src/common/hooks/useEdge.ts`](/Users/realrong/whiteboard/packages/whiteboard-react/src/common/hooks/useEdge.ts)
- [`packages/whiteboard-react/src/edge/components/EdgeLayer.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/edge/components/EdgeLayer.tsx)
- [`packages/whiteboard-react/src/edge/components/EdgeItem.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/edge/components/EdgeItem.tsx)

而 transient node 只在 node 自己内部消费：

- [`packages/whiteboard-react/src/node/components/NodeItem.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/components/NodeItem.tsx)

因此拖动 node 时，edge 还是基于 committed node rect 算 endpoint，自然不会跟着 transient draft 一起动。

### 推荐修复方式

不要改 engine projection。  
应当在 react transient runtime 层提供“transient node geometry read”。

例如：

```ts
type PreviewedNodeRead = {
  getRect: (nodeId: NodeId) => {
    rect: Rect
    rotation: number
  } | undefined
}
```

`EdgeLayer` 渲染时：

- 先读 committed edge entry
- 再读 source/target 节点的 drafted rect
- 如果存在 draft，就用 drafted rect 重新计算 endpoints
- 如果没有 preview，就回退到 committed endpoints

这样做的好处：

- engine 不需要知道 transient
- edge 可以和 transient node 联动
- draft 逻辑依旧留在 runtime 层

## 是否要把 draft 做成“overlay patch”

需要，但范围要控制。

推荐 draft 只覆盖 geometry-like 字段：

- position
- size
- rotation
- hovered / guides / selection box 等纯 runtime 语义

不建议 draft 覆盖：

- text/content/value
- style payload
- document identity

原因是前者属于交互几何，后者已经接近 committed business state。

## 推荐运行时入口

建议在 `WhiteboardCanvas` 或同级 runtime composition 层创建 transient runtime，再向各 feature 注入。

例如在：

- [`packages/whiteboard-react/src/Whiteboard.tsx`](/Users/realrong/whiteboard/packages/whiteboard-react/src/Whiteboard.tsx)

形成类似关系：

```tsx
const transient = useWhiteboardTransientRuntime()

return (
  <div className="wb-root-viewport">
    <NodeFeature transient={transient.node} />
    <EdgeFeature transient={transient} />
    <MindmapFeature transient={transient.mindmap} />
  </div>
)
```

这里不要求通过 React Provider 暴露，可以继续遵守项目现有约束：

- 通过实例化对象显式下传
- 或者通过 instance composition 提供只读 getter

但不建议继续把 transient 封在各 feature 内部。

## 与 instance 的关系

transient runtime 不建议直接并入 `instance.read.node / edge / mindmap`。  
但可以成为 instance 所组合的一部分，作为 runtime-only namespace 暴露。

建议风格：

```ts
instance.read.node
instance.read.edge
instance.read.mindmap

instance.transient.node
instance.transient.guides
instance.transient.connection
```

或者如果坚持不扩展 `instance` 顶层：

- 让 `WhiteboardCanvas` 显式持有 `transient`
- feature 通过 props 传入

两种都可以。  
如果未来存在非 React host 或插件 runtime 读取 transient 的真实需求，再考虑把它纳入 `instance`。

当前阶段更推荐先留在 canvas/runtime composition 层。

## reset / cancel 策略

transient 体系必须有统一 reset 语义。

推荐原则：

- session owner 负责 cancel 自己的 session
- transient runtime 负责 clear 自己的 draft slice
- 全局 reset 负责顺序调用各 slice clear

例如：

```ts
resetTransientRuntime()
  -> node.clear()
  -> guides.clear()
  -> connection.clear()
  -> routing.clear()
  -> selection.clear()
  -> mindmap.clear()
```

`escape`、`blur`、document replace、dispose 时都应复用这套 reset 入口。

## 与 kernel / math 的边界

推荐把“计算规则”继续下沉到 core / math 模块，而不是把 store 逻辑也放进去。

即：

- `resolveNodeDragPreview`
- `resolveResizePreview`
- `resolveEdgeConnectPreview`
- `resolveRoutingDraft`

这些可以继续是纯函数。

而以下职责留在 react runtime：

- pointer session 生命周期
- rAF 调度
- transient store commit
- 订阅通知

这样职责最清楚。

## 迁移建议

建议按下面顺序迁移，不要一步到位大改。

### 第 1 步：建立 shared transient 目录

创建：

- `packages/whiteboard-react/src/transient/`

先只迁移 node 相关的 transient：

- `node`
- `guides`

先不动 edge / mindmap。

### 第 2 步：把 transient 创建点提升到 canvas 层

从 `NodeFeature` 内部创建，改为 `WhiteboardCanvas` 或同级 composition 层创建。

目标：

- `NodeFeature` 接收 `node.write`
- `NodeItem` 接收 `node` slice，并只使用 `get / subscribe`
- `EdgeFeature` 也能读取 `node` slice，并只使用 `get / subscribe`

### 第 3 步：补 transient node geometry

在 react 层新增“基于 transient node 重算 edge endpoint”的逻辑。  
不要修改 engine committed projection。

### 第 4 步：收 edge connect / routing 到 transient 体系

把 edge 当前分散的 connect preview、routing draft 也迁到 `src/transient/` 下统一建模。

### 第 5 步：统一全局 reset

让 document replace / dispose / escape / blur 都复用同一个 transient reset 入口。

## 不推荐的方向

### 1. 把所有 transient 都塞进 Jotai atom

不推荐原因：

- keyed 高频预览不一定适合 atom 粒度
- 可能导致大量 selector / set / listener 成本
- 容易把热路径优化换成范式统一

### 2. 把所有 transient 都塞进 engine projection

不推荐原因：

- committed 与 transient 边界会混淆
- projection invalidation 成本上升
- runtime host 语义污染 engine

### 3. 每个 feature 继续维护私有 transient

不推荐原因：

- sibling feature 无法共享 draft
- reset 行为分散
- 交互预览无法形成统一 scene

## 最终建议

最终推荐的设计是：

1. 保留 engine 作为 committed source of truth
2. 在 `packages/whiteboard-react/src/transient/` 建立 shared transient runtime
3. session state 继续留在各 feature hook/ref 中
4. transient state 提升为跨 feature 可读写的 runtime slice
5. edge 渲染基于 committed edge + transient node geometry 做局部重算
6. guides 这类 layer 级状态继续可以用 atom，但归入统一 transient 体系

一句话总结：

`transient` 需要，而且应该作为 React runtime 的第一等概念存在；  
它不该塞进 engine，也不该继续散落在各个 feature 私有目录中。  
最合理的位置就是 `packages/whiteboard-react/src/transient/`。
