# Whiteboard Node Overlay Layer 设计方案

## 结论

`packages/whiteboard-react/src/features/node/components/NodeOverlayLayer.tsx` 还能继续优化，而且值得优化。

当前最大的问题不是“文件行数多”，而是同一个组件里混了 3 层不同职责：

1. overlay policy
2. overlay runtime lifecycle
3. overlay item projection

长期最优不是继续把它拆成更多碎组件，而是把它收回成一个真正的 overlay plane：

1. `NodeOverlayLayer` 保留为 node overlay 的唯一入口
2. chrome 可见性改为单一 policy
3. overlay item 改为专用的最小读模型
4. overlay 几何只认 `rect / rotation / session patch`
5. 不新增 provider / store / instance namespace

一句话概括：

1. 入口不再分散
2. 输入模型要变瘦
3. policy 要单点收口

## 当前已落地

当前代码已经落地下面两点：

1. `chrome` 已经收敛到 `instance.read.node.chrome`
2. `NodeOverlayLayer` 已经切断对 `useNodeView` 的依赖，改为 overlay-only read
3. connector 模式下的 `connectNodeIds` 已在 overlay 本地收成明确候选，不再全量遍历节点
4. `connect handles` 已不再通过 `overlay view style` 中转，组件直接基于 `rect / rotation` 定位

当前边界是：

1. `instance.read.node.chrome`
   - 提供共享 chrome 语义
2. `useNodeOverlayView`
   - 直接从 `read.node.item` 做最小 overlay 投影
3. `NodeOverlayLayer`
   - 继续持有 `transformSession`
   - 继续本地组织 `connectNodeIds / guides / container outline`

当前还未继续上抬的内容：

1. `connectNodeIds`
2. `guides`
3. `transformSession`
4. 任何 overlay JSX 细节

## 放置结论

关于“overlay 要不要收到 instance 上”，最终结论应该明确为：

1. 不把 `overlay` 整体收到 `instance`
2. 只把最小共享语义 `chrome` 收到 `instance.read.node.chrome`
3. `press / guides` 继续留在 `instance.internals.node.*`
4. `transformSession` 继续留在 `NodeOverlayLayer` 本地
5. `connect handles` 的具体渲染与候选集合继续留在 overlay 组件本地

也就是：

```text
instance.read.node.chrome   -> 共享语义
instance.internals.node.*   -> 原始 transient source
NodeOverlayLayer            -> 具体渲染与局部 overlay model
```

这里最重要的一点是：

1. 该上抬的不是 `overlay`
2. 真正该上抬的是 `chrome`

因为跨组件共享的其实是：

1. “现在能不能显示 node selection 外观”
2. “现在能不能显示 toolbar”
3. “现在能不能显示 transform handles”
4. “现在能不能显示 connect chrome”

而不是：

1. connect handles 怎么画
2. transform handles 怎么画
3. container badge 怎么画
4. guides 怎么画
5. overlay 里到底有哪些节点候选

## 为什么这样放最优

### 1. 为什么不是 `instance.overlay`

`overlay` 是渲染平面，不是稳定读语义。

一旦把它挂成：

1. `instance.overlay`
2. `instance.read.overlay`

后面就很容易继续膨胀成：

1. `overlay.model`
2. `overlay.toolbar`
3. `overlay.connect`
4. `overlay.guides`
5. `overlay.container`

这会把“最小共享集”重新做成一个新大域。

### 2. 为什么不是只保留本地 `resolveChrome`

如果只是一个共享纯函数：

1. 语义重复会减少
2. 但订阅重复不会消失

Scene / Overlay / Toolbar 仍然要各自订阅：

1. `tool`
2. `edit`
3. `interaction`
4. `selection`
5. `press`

然后在消费点各自执行一遍 `resolveChrome`。

当 consumer 已经稳定存在多个时，这种做法比“单一共享 read”还是多一层重复。

### 3. 为什么不是 `instance.internals.node.chrome`

`internals` 更适合放 feature 原始 transient source，例如：

1. `press`
2. `guides`
3. `node session`

而 `chrome` 已经不是原始 source 了，它是：

1. `state + feature session` 的稳定派生语义

一旦它被：

1. `NodeSceneLayer`
2. `NodeOverlayLayer`
3. `NodeToolbar`

共同消费，它更像一个正式的共享 read，而不是一个 node runtime 内部细节。

### 4. 为什么最适合 `instance.read.node.chrome`

因为它同时满足 4 个条件：

1. 是只读
2. 是派生语义
3. 有多个真实消费者
4. 明确属于 node 域

所以最佳落点不是：

1. `instance.read.chrome`
2. `instance.state.chrome`
3. `instance.overlay`

而是：

1. `instance.read.node.chrome`

这条路径最短，也最不容易把顶层 API 做大。

## 当前链路

当前 `NodeOverlayLayer` 同时负责：

1. 创建和清理 `transformSession`
2. 读取 `tool / edit / interaction / press / selection / container / guides`
3. 判断 transform handles 是否显示
4. 判断 connect handles 是否显示
5. 渲染 active container outline
6. 渲染 guides
7. 渲染每个 overlay item

当前依赖关系大致是：

```text
NodeOverlayLayer
  -> useSelection / useTool / useEdit / useInteraction / useContainer
  -> useNodeView(container.id)
  -> useNodeOverlayView(nodeId)
       -> useNodeView(nodeId)
            -> registry.get(type)
            -> definition.style(renderProps)
            -> commands.node.update / updateData
            -> build transformStyle
```

这条链的问题是：

1. overlay 在读 scene 级 view model
2. scene model 里混了 definition/style/update/render props
3. overlay 最终只用了其中一小部分

## 当前异味

### 1. `NodeOverlayLayer` 职责混层

当前文件既在做“状态解释”，也在做“节点级投影”，还在做“session 生命周期”。

这会导致阅读时不断在下面三层切换：

1. 什么时候显示什么
2. 每个节点要读什么
3. 某个交互 session 如何绑定

这不是必要复杂，而是职责没有收口。

### 2. overlay read 依赖 scene read

当前 `useNodeOverlayView` 是建立在 `useNodeView` 之上的。

但 `useNodeView` 负责的是 scene/render 语义，它会额外计算：

1. `definition`
2. `nodeStyle`
3. `update`
4. `updateData`
5. `renderProps`

overlay 真正需要的只有：

1. `node`
2. `rect`
3. `rotation`
4. `canRotate`
5. `hovered`
6. overlay 几何样式

这说明 overlay 正在吃一个“过胖的上游模型”。

### 3. chrome policy 已经有多个真实消费者

当前至少有 3 处在解释 chrome 语义：

1. `NodeSceneLayer`
2. `NodeOverlayLayer`
3. `NodeToolbar`

它们都在自己组合：

1. `press`
2. `interaction`
3. `edit`
4. `tool`
5. `selection`

这已经不是“局部 if 判断”了，而是一个真实共享策略。

如果继续各自拼，后面必然漂移。

这也说明它已经超过了“局部 helper”的合理范围。

### 4. `hovered` 语义已经串味

当前 node session 里的 `hovered` 实际来自 `hoveredContainerId`。

也就是说它表达的是：

1. 节点拖拽时的 container hover

它不是：

1. connector 模式下的 hover
2. 普通 overlay hover

但 `NodeConnectOverlayItem` 现在仍然在读取这个 `hovered`，这说明 overlay 输入语义已经不够干净。

### 5. connect handles 的候选集合过大

当前 connector 模式下，overlay 会遍历全部 `nodeIds`，再由子项决定是否 `return null`。

这在规模小时问题不大，但语义上不够干净：

1. 父层没有先定义“谁是候选”
2. 子层在做大量否决

长期最优更适合先算出候选节点，再渲染。

### 6. overlay 几何边界不够硬

当前 overlay 的 connect handle 定位样式是从 scene `transformStyle` 派生的。

而 `transformStyle` 又会受 node definition style 影响。

这意味着 overlay 几何和 renderer/style 仍然耦合。

长期最优里，overlay 几何不应该依赖 renderer style。

## 设计目标

这条链路的长期目标应该是：

1. `NodeOverlayLayer` 仍然是唯一 overlay 入口
2. overlay 只消费最小语义，不消费 scene/render 语义
3. chrome 相关可见性只允许一套 policy
4. overlay 几何只认几何数据，不认 renderer style
5. 不新增多余 store / provider / 顶层 instance API
6. 不为“结构好看”增加新目录

## 长期最优架构

### 1. 保留单入口：`NodeOverlayLayer`

`NodeOverlayLayer` 继续存在，而且应该继续是 node overlay plane 的唯一入口。

它应该负责的事情只有：

1. 持有 `transformSession`
2. 读取 overlay model
3. 渲染 overlay plane

它不应该再自己拼一堆零散布尔值。

### 2. 引入单一 overlay model

推荐把 `NodeOverlayLayer` 内部先收成一个单一 model。

形态建议：

```ts
type OverlayModel = {
  container?: {
    rect: Rect
    title: string
  }
  guides: readonly Guide[]
  transformNodeIds: readonly NodeId[]
  connectNodeIds: readonly NodeId[]
  showGuides: boolean
}
```

这里最关键的不是字段名，而是：

1. 先统一算出“当前 overlay 该显示什么”
2. JSX 只负责渲染，不负责再解释状态

### 3. 引入单一 chrome policy

chrome policy 现在已经有多个真实消费者，所以不应该只停留在本地 helper。

长期最优应该是：

1. 由一个共享纯函数负责核心判定
2. 再由 `instance.read.node.chrome` 暴露最终共享结果

也就是：

```text
resolveChrome(...) -> instance.read.node.chrome -> Scene / Overlay / Toolbar
```

推荐目标：

```ts
type Chrome = {
  selection: boolean
  toolbar: boolean
  transform: boolean
  connect: boolean
}
```

推荐函数名与落点：

1. `resolveChrome`
2. `instance.read.node.chrome`

理由：

1. 在 `features/node` 域内已经有上下文，不必叫 `resolveNodeChromePolicy`
2. `resolveChrome` 足够短，也足够明确
3. `instance.read.node.chrome` 表达的是“node 共享读语义”
4. 它不会把渲染细节抬进 instance

这个 policy 至少要统一下面几个消费者：

1. `NodeSceneLayer`
2. `NodeOverlayLayer`
3. `NodeToolbar`

这里要特别强调：

1. 进入 instance 的是 `chrome`
2. 不是 `overlay model`
3. 更不是任何 JSX 或渲染配置

### 4. overlay item 读模型必须瘦身

长期最优里，overlay item 不应该再通过 `useNodeView -> useNodeOverlayView` 这条链拿数据。

推荐方向：

1. overlay 直接读取 `instance.read.node.item`
2. overlay 直接读取 `node session`
3. overlay 只做 overlay 所需的最小投影

推荐目标模型：

```ts
type OverlayItem = {
  nodeId: NodeId
  node: Node
  rect: Rect
  rotation: number
  canRotate: boolean
  hoveredContainer: boolean
  style: CSSProperties
}
```

注意这里的 `hoveredContainer` 要明确写出真实语义，不要再继续叫含糊的 `hovered`。

### 5. overlay 几何要和 renderer style 脱钩

长期最优里，overlay 的几何权威只允许来自：

1. `rect`
2. `rotation`
3. `node session patch`

不应该继续通过 `definition.style(renderProps)` 再反推出 overlay 几何。

这条边界一旦收住，会有两个直接收益：

1. overlay 与 renderer 解耦
2. `useNodeOverlayView` 可以不再依赖 `useNodeView`

### 6. connect handles 要先算候选，再渲染

当前最不干净的一点是：

1. 父层全量遍历
2. 子层逐个否决

长期最优建议：

1. `NodeOverlayLayer` 先得到 `connectNodeIds`
2. 只渲染这些候选

这里的候选集合应该来自明确语义，而不是顺手复用别的 `hovered`。

而且 `connectNodeIds` 不应该进 `instance.read.node.chrome`。

原因：

1. 它已经开始接近具体 overlay 渲染模型
2. 它会把 instance 从“共享语义”拉向“具体展示装配”
3. 它仍然适合留在 `NodeOverlayLayer` 本地 model 内

## 文件与 API 建议

### 保留的文件

这些文件保留没有问题：

1. `packages/whiteboard-react/src/features/node/components/NodeOverlayLayer.tsx`
2. `packages/whiteboard-react/src/features/node/components/NodeTransformHandles.tsx`
3. `packages/whiteboard-react/src/features/node/components/NodeConnectHandles.tsx`
4. `packages/whiteboard-react/src/features/node/hooks/transform/session.ts`

### 推荐新增的最小收敛点

推荐新增两个最小收敛点：

1. `packages/whiteboard-react/src/features/node/chrome.ts`
2. `instance.read.node.chrome`

职责分配：

1. `chrome.ts`
   - 只放 `resolveChrome`
   - 只做纯判定
2. `instance.read.node.chrome`
   - 只暴露共享结果
   - 给多个 React consumer 统一订阅

不要再拆：

1. `chrome/policy.ts`
2. `chrome/guards.ts`
3. `chrome/selectors.ts`

也不要新增：

1. `instance.overlay`
2. `instance.read.overlay`
3. `instance.internals.node.overlay`

### `instance.read.node.chrome` 的推荐形态

推荐形态不是一组方法，而是一个小的 `ReadStore<Chrome>`。

原因：

1. 当前消费者主要是 React 组件
2. 它们需要订阅语义变化
3. `ReadStore` 与现有 runtime 模型天然一致

推荐形态：

```ts
type Chrome = {
  selection: boolean
  toolbar: boolean
  transform: boolean
  connect: boolean
}
```

推荐挂载位置：

```ts
instance.read.node.chrome
```

不推荐：

```ts
instance.read.node.isToolbarVisible()
instance.read.node.isTransformVisible()
instance.read.node.isConnectVisible()
```

原因：

1. API 会迅速平铺膨胀
2. 组件要多次调用 getter
3. React 订阅体验更差

### `press / guides / transformSession` 的归属

这些东西不应该跟着 `chrome` 一起上抬。

推荐归属：

1. `press` -> `instance.internals.node.press`
2. `guides` -> `instance.internals.node.guides`
3. `transformSession` -> `NodeOverlayLayer` 本地

理由：

1. 它们仍然是原始 runtime source 或局部交互执行器
2. 它们不是稳定共享展示语义
3. 上抬只会增加 instance 的噪音

### overlay item read 的建议

overlay item read 不一定非要新建文件。

长期最优有两种方案：

方案 A，推荐：

1. 在现有 `useNodeView.ts` 里补一个真正的 overlay-only 读取实现
2. 删掉现在“overlay 复用 scene view”的路径

方案 B：

1. 单独新建一个 `useNodeOverlay.ts`

如果只从“少文件、长期稳定”看，我更偏向方案 A。

原因：

1. `NodeView` 和 `OverlayItem` 都还是 node view 域
2. 没必要为了隔离就增加一个新文件
3. 关键不是文件数，而是不要让 overlay 再复用 scene model

## 不推荐的方向

下面这些都不建议做：

1. 新增 `overlay/store.ts`
2. 新增 `overlay/provider.tsx`
3. 新增 `useNodeOverlayState`
4. 把 overlay handler 挂到 `instance.overlay.*`
5. 把 `transformSession` 升到 `instance`
6. 给 container outline / guides / connect handles 各拆一个状态 hook
7. 把 `connectNodeIds` 这类具体 overlay 候选集合挂到 `instance.read`
8. 只靠本地 `resolveChrome`，让每个 consumer 继续各自订阅原始状态

这些做法的问题都一样：

1. 新层变多
2. 概念变多
3. API 面变大
4. 问题没有真正收敛

## 分阶段实施方案

### 阶段 1：先收 policy

目标：

1. 让 scene / overlay / toolbar 共用同一套 chrome 读语义

做法：

1. 抽一个共享纯函数 `resolveChrome`
2. 统一输入：
   - `tool`
   - `edit`
   - `interaction`
   - `press`
   - `selection`
3. 在 `createNodeRead` 里生成 `instance.read.node.chrome`
4. 让三处 consumer 改为订阅 `instance.read.node.chrome`

阶段收益：

1. 先消掉最容易漂移的语义重复
2. 顺手减少重复订阅
3. 不动 overlay item read
4. 风险仍然可控

### 阶段 2：再瘦 overlay item read

目标：

1. overlay 不再依赖 `useNodeView`

做法：

1. 给 overlay 实现一条最小读取链
2. 直接从 `read.node.item + nodeSession` 投影
3. 把 `hovered` 明确改成真实语义名
4. 不再把 `definition / nodeStyle / update / updateData` 带进 overlay

阶段收益：

1. overlay 复杂度明显下降
2. scene 与 overlay 的边界会清楚很多

### 阶段 3：收紧 connect handles 候选集合

目标：

1. 不再全量遍历再否决

做法：

1. 明确 connector 模式下的候选集合来源
2. 由 `NodeOverlayLayer` 先算 `connectNodeIds`
3. `NodeConnectOverlayItem` 不再自行解释无关语义

阶段收益：

1. 逻辑更直
2. 输入语义更干净

### 阶段 4：收硬 geometry 边界

目标：

1. overlay 几何不再依赖 renderer style

做法：

1. connect/transform overlay 的定位只使用：
   - `rect`
   - `rotation`
   - session patch
2. 取消 overlay 对 scene `transformStyle` 的依赖

阶段收益：

1. overlay 与 renderer 解耦
2. 后续 node definition 改动不容易污染 overlay

## 推荐最终状态

长期最优的最终形态应该是：

1. `NodeOverlayLayer` 仍然是单入口
2. `transformSession` 仍然是本地 runtime
3. `instance.read.node.chrome` 是唯一共享 chrome 读入口
4. `resolveChrome` 只是 `chrome` 的私有纯判定器
5. overlay item 只有最小读模型
6. overlay 几何只认几何数据
7. connect handles 只渲染明确候选

最终你再回头看这个文件时，它应该更像：

1. 读取一个 model
2. 渲染一个 overlay plane

而不是现在这样：

1. 一边解释状态
2. 一边构造 view
3. 一边管理 runtime
4. 一边在 JSX 里继续拼 policy

## 最后判断

`NodeOverlayLayer` 不需要被“大拆特拆”。

真正该做的是：

1. 减少它背后的隐式输入
2. 统一它共享的显示策略
3. 切断它对 scene view 的依赖

这样既能明显降复杂度，又不会引入新的架构层。

## 最终推荐

最终推荐可以压成一句话：

1. 不提升 `overlay`
2. 只提升 `chrome`
3. `chrome` 放在 `instance.read.node.chrome`
4. 具体 overlay 渲染继续留在 React 组件本地
