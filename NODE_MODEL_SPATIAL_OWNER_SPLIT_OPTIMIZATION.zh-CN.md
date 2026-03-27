# Node 模型彻底收敛设计

## 1. 文档目标

这份文档回答一个明确问题：

为什么现在 `group` 一旦变成 owner-only node，代码会显得“到处都要改”，以及如何把这件事一次性彻底收敛。

结论很明确：

- 不是 owner tree 方向错了
- 不是 group bounds 读侧派生错了
- 真正的问题是底层 `Node` 模型把“几何节点”和“结构节点”混成了一种东西

当前仓库已经完成了一部分正确收敛：

- group bounds 已改成读侧派生
- sanitize 已统一清掉 group 的无效几何字段
- `group.create` 已不再写 `size`
- group 已可以不持久化 `position`
- 读侧部分链路已开始转向 projection-first

但这还不是最终态。

当前仍处于一个过渡模型：

- `Node.position?: Point`
- 代码里仍然存在一些“node 大概率有 position”的历史假设

这会导致两个问题：

1. 类型层不够明确，很多地方需要 guard。
2. 一些读写链路仍会把 raw `Node` 当几何真相。

长期最优不是继续加 guard，而是彻底修正根模型。

## 2. 根因分析

### 2.1 当前真正混在一起的是两种实体

当前 `Node` 实际上承载了两种完全不同的东西：

- 几何节点
  - text
  - sticky
  - shape
  - draw
  - frame
  - mindmap root
- 结构节点
  - group

这两类实体在领域语义上完全不同。

几何节点的 source of truth 是：

- `position`
- `size`
- `rotation`

结构节点的 source of truth 是：

- `children`
- owner tree

它本身没有独立几何真相。

但当前模型把它们都叫做 `Node`，并且过去默认都带 `position`。

于是整条链路形成了隐式前提：

- `Node` 就是几何节点
- 只要拿到 `Node`，就可以读取 `position`
- `getNodeRect(node)` 是天然合理的

这个前提在 group 改成 owner-only 后就不成立了，所以改动会扩散。

### 2.2 复杂度真正扩散的原因

问题不是某一个模块写得不好，而是错误的根契约扩散到了整条链路：

- core geometry 直接接受 `Node`
- commands/layout 默认 node 都可直接对齐/分布
- slice remap 默认 node 都可直接 offset
- engine read 有些地方已经拿到 projection，却还回头读 raw `node.position`
- React 某些 feature 默认 `node.position` 一定存在

所以“到处都要改”并不是因为这次重构方向错误，而是因为过去的底层类型把错误假设合法化了。

## 3. 最终目标

长期最优要达成的不是“到处补 `if (!node.position)`”，而是：

- 根类型从开放字符串收成封闭集合
- 文档模型明确区分几何节点与结构节点
- 几何算法只接受几何节点
- 结构算法只处理 owner 关系
- projection 成为唯一几何真相入口
- group 永远不再回退成伪几何节点

一句话说：

**Node 要从“模糊的大一统实体”收敛成“结构明确的判别联合”。**

## 4. 最优底层模型

### 4.1 最小模型

长期最优建议收敛到：

```ts
export const NODE_TYPES = [
  'text',
  'sticky',
  'shape',
  'draw',
  'frame',
  'group',
  'mindmap'
] as const

type NodeType = typeof NODE_TYPES[number]

type BaseNode = {
  id: NodeId
  type: NodeType
  children?: NodeId[]
  locked?: boolean
  layer?: 'background' | 'default' | 'overlay'
  data?: Record<string, unknown>
  style?: Record<string, string | number>
}

type SpatialNode = BaseNode & {
  type: Exclude<NodeType, 'group'>
  position: Point
  size?: Size
  rotation?: number
}

type GroupNode = BaseNode & {
  type: 'group'
}

type Node = SpatialNode | GroupNode
```

这套模型有几个关键点：

- `NodeType` 是封闭集合，不再是任意 `string`
- `group` 是唯一 owner-only node
- `frame` 仍然是 `SpatialNode`
- `frame` 可以同时有 `position` 和 `children`
- `children` 不代表局部坐标，不代表 scene graph
- `children` 只代表结构所有权

这样概念并没有变多，反而更少。

因为它把之前分散在全仓库里的隐式例外，收回成了一个明确的根定义。

### 4.1.1 为什么 `NodeType` 要先封闭

如果 `NodeType` 继续是任意 `string`，即使我们把 `Node` 写成 union，类型系统仍然不够干净：

- `node.type === 'group'` 不能始终成为稳定的判别条件
- `switch (node.type)` 很难做穷尽检查
- registry / command / render / schema 都会继续给“未知类型”保留默认分支
- 很多 narrowing 只能退回到运行时 helper 或 `position in node`

因此长期最优里，应该先把根类型封闭，再做 `SpatialNode | GroupNode`。

顺序上更合理的理解是：

1. `NodeType` 封闭
2. `Node` 改成判别联合
3. geometry API 改成 spatial-only

如果跳过第 1 步，后两步都会打折扣。

### 4.1.2 扩展能力应该怎么保留

封闭 `NodeType` 不代表放弃扩展，而是把扩展位置放对。

长期最优不建议通过开放 root type 扩展，而建议通过封闭类型下的子分类扩展，例如：

```ts
type ShapeNode = SpatialNode & {
  type: 'shape'
  data?: {
    kind?: 'rect' | 'diamond' | 'cloud' | 'callout'
  }
}
```

或者保留一个明确的宿主类型：

```ts
type CustomNode = SpatialNode & {
  type: 'shape'
  data?: {
    kind?: 'custom'
    customType?: string
  }
}
```

也就是说：

- 根类型封闭
- 扩展放到 `data.kind` / `customType`
- registry 绑定的是封闭宿主类型下的变体

这比开放 `NodeType = string` 更简单，也更有利于类型收敛。

### 4.2 为什么不用继续保留 `position?: Point`

`position?: Point` 适合做迁移过渡，不适合做长期模型。

原因很简单：

- 它表达的是“不确定”
- 但我们的领域并不不确定
- 真相是：group 没有 position，其他几何节点有 position

因此长期最优不应该是 optional，而应该是 union。

`optional` 会把复杂度推到使用点。

`union` 会把复杂度收敛在定义点。

## 5. 边界职责重定义

### 5.1 core/types

职责：

- 定义 `Node = SpatialNode | GroupNode`
- 定义封闭的 `NodeType`
- 让类型签名本身表达清楚“哪些 API 接受结构节点，哪些 API 接受几何节点”

长期最优里，不建议把下面这类 guard 设计成公共概念：

```ts
isGroupNode(node): node is GroupNode
isSpatialNode(node): node is SpatialNode
```

原因不是它们完全没用，而是：

- 如果把它们做成公共 API，全仓库很容易退化成到处 `isSpatialNode(node)`
- 这会把“模型没有收干净”的问题包装成 helper 泛滥
- 它不符合长期最优的目标：概念更少、边界更清晰、签名更准确

更好的做法是：

- `geometry` API 直接接受 `SpatialNode`
- `owner/tree` 相关 API 直接接受 `Node`
- `group-only` 逻辑直接接受 `GroupNode`
- 在极少数边界位置做内联 narrowing

推荐的 narrowing 方式是：

```ts
if ('position' in node) {
  // SpatialNode
}
```

而不是把判断再包装成新的公共概念。

这里要特别说明一件事：

- 只要 `NodeType` 仍然是开放字符串，`node.type` 就不是最理想的判别字段
- 所以在过渡期内，几何 narrowing 仍然应优先靠 `position in node` 或正确的函数签名
- 等 `NodeType` 收成封闭集合以后，`node.type === 'group'` 才会变得更干净、更稳定

所以长期最优里：

- 几何分支优先靠 `position in node` 或正确的函数签名
- group 语义分支再用 `node.type === 'group'`

### 5.2 core/geometry

职责：

- 只处理几何节点

长期最优里：

- `getNodeRect`
- `getNodeAABB`
- `getRotatedCorners`
- outline/anchor/path 这类纯几何函数

都不应该再直接接受 `Node`。

而应该接受：

- `SpatialNode`
- 或者显式的 `Rect`
- 或者读侧 projection `CanvasNode`

这一步非常关键。

如果 geometry 继续接受 `Node`，错误模型还会继续向上泄漏。

### 5.3 core/node

职责应该拆成两类：

- 结构算法
  - owner tree
  - descendants
  - roots
  - replaceChildren
  - patchChildren
- 几何/布局算法
  - move
  - transform
  - layout
  - hit test

结构算法接受 `Node` 没问题。

几何/布局算法应优先接受：

- `SpatialNode`
- 或者 `TransformSelectionMember.rect`
- 或者 `NodeLayoutEntry.bounds`

而不是接受模糊 `Node` 再自己猜。

### 5.4 core/document/slice

slice 的长期职责应该是：

- 搬运一块文档内容
- remap ids
- remap owner 关系
- remap spatial fields

因此它应该明确区分两类处理：

- 结构 remap
  - `children`
  - roots
  - owner relation
- 几何 remap
  - `position`
  - edge point
  - route points

也就是说：

- group 这类 owner-only node 只参与结构 remap
- spatial node 才参与 offset

不要在主流程里散着判断，要集中成 remap helper。

### 5.5 engine/read

长期最优原则：

**一旦已经进入 projection/read 层，几何真相就不再来自 raw `Node`。**

应该统一来自：

- `CanvasNode.rect`
- `CanvasNode.aabb`
- `CanvasNode.rotation`

这意味着：

- bounds/frame/hit/selection/overlay
- 以及绝大多数 UI 读取

都应优先走 projection-first。

raw `Node` 在 read 层保留的价值主要是：

- `type`
- `children`
- `data`
- `style`
- 业务字段

而不是几何真相。

### 5.6 engine/write

长期最优原则：

- sanitize 是唯一几何契约兜底入口
- finalize 不得重新把 group 写回成几何节点

要明确几件事：

- `group.create` 不写 `position/size/rotation`
- `node.update(groupId, { position })` 被 sanitize 吞掉
- move/align/distribute/transform 遇到 group，翻译成 descendants 的几何写入
- group 的写侧永远只剩 membership 语义

### 5.7 react

React 层不应该承担“修正文档模型”的职责。

长期最优里 React 只做两件事：

- 读 projection
- 触发 commands

如果 React 某处需要依赖 `node.position`，那只能说明：

- 这个 feature 确实只适用于几何节点
- 或者这段代码本来就不该直接读 raw node

因此 React 层长期最优的策略是：

- mindmap/text/sticky/shape 这种明确是几何节点的 feature，允许显式要求 `SpatialNode`
- selection/overlay/chrome/hit/bounds 这种公共 feature，尽量只读 projection

## 6. 应该立刻明确的长期规则

### 6.1 group 的定义

group 的定义必须彻底收紧：

- 有 `children`
- 没有 `position`
- 没有 `size`
- 没有 `rotation`
- 自身 box 完全来自 descendants 投影

这条规则不能再模糊。

### 6.2 frame 的定义

frame 不是 group。

frame 的定义是：

- 有 `position`
- 可有 `size`
- 可有 `children`
- rect 是自身显式输入
- children 只是 owner 关系，不影响 frame rect 真相

### 6.3 projection 的定义

projection 不是文档镜像，而是：

- 对文档的只读几何投影

group 的 rect 属于 projection。

因此：

- raw document 里没有 group rect
- read/index 里有 group rect

这是正确的，不是重复。

## 7. 当前仓库的优化完成态

从当前状态继续收，最终应达到：

### 7.1 类型层

- `NodeType` 改成封闭 union
- `Node` 改成判别联合
- 去掉长期保留的 `position?: Point`
- `SpatialNode` 成为 geometry API 的唯一 node 输入

### 7.2 core 层

- geometry 全部改成 spatial-first
- layout/move/transform 只在入口处展开 group
- slice remap 完全分离结构与几何
- owner helpers 不再碰几何字段

### 7.3 engine 层

- read 统一 projection-first
- write 统一 sanitize-first
- finalize 不再内置 group geometry 修复逻辑

### 7.4 react 层

- 通用 UI 功能不再裸读 raw `node.position`
- feature 如果确实依赖几何节点，则显式要求 spatial
- overlay/selection/chrome/bounds 统一走 projection

## 8. 分阶段实施方案

### 阶段 1：类型定型

目标：

- 把根类型从开放字符串 + optional position 收成封闭 union

要做的事：

- 修改 `packages/whiteboard-core/src/types/core.ts`
- 收紧 `NodeType`
- 引入 `SpatialNode` 与 `GroupNode`
- 把 geometry API 输入改成 `SpatialNode`
- 把公共 API 的参数类型改成更精确的 `SpatialNode` / `GroupNode` / `Node`
- 避免新增公共 guard，优先使用函数签名和少量内联 narrowing

验收标准：

- `NodeType` 不再是任意 `string`
- geometry 不再直接接受模糊 `Node`
- group 不再能误传进几何函数

### 阶段 2：geometry 与 projection 收口

目标：

- projection 成为唯一几何真相读取入口

要做的事：

- 检查 `engine/read/store/*`
- 检查 `react/runtime/read/*`
- 检查 selection/hit/bounds/frame 相关读取
- 把 raw `node.position` 裸读替换成 projection 或 spatial-only 入口

验收标准：

- 通用 read 逻辑里几乎不再出现 `node.position`

### 阶段 3：command/slice 完整收敛

目标：

- 彻底消灭“group 几何写入”

要做的事：

- `node.move`
- `node.align`
- `node.distribute`
- `node.transform`
- `document/slice`

统一改成：

- group 只参与结构
- descendants 才参与几何提交

验收标准：

- 对 group 的所有几何操作最终都只落到 descendants

### 阶段 4：feature 精准约束

目标：

- 让真正依赖几何的 feature 显式声明自己只接受 spatial

要做的事：

- mindmap
- draw
- text edit
- node session
- transform session

将这些 feature 的关键输入收成：

- `SpatialNode`
- `Rect`
- `CanvasNode`

而不是模糊 `Node`

验收标准：

- React 侧裸读 `node.position` 显著减少
- feature 边界更清晰

### 阶段 5：删除过渡逻辑

目标：

- 删除本轮迁移中所有临时兼容痕迹

要做的事：

- 清理不再需要的 fallback
- 清理不再需要的过渡期位置兼容判断
- 清理不再需要的“optional position”兼容代码
- 更新根目录与 docs 文档

验收标准：

- 仓库回到单轨实现
- 无双重语义

## 9. 具体文件优先级

优先级最高的文件：

- `packages/whiteboard-core/src/types/core.ts`
- `packages/whiteboard-core/src/geometry/node.ts`
- `packages/whiteboard-core/src/node/group.ts`
- `packages/whiteboard-core/src/node/commands.ts`
- `packages/whiteboard-core/src/node/move.ts`
- `packages/whiteboard-core/src/document/slice.ts`
- `packages/whiteboard-engine/src/read/store/index.ts`
- `packages/whiteboard-engine/src/read/indexes/nodeRect.ts`

第二优先级：

- `packages/whiteboard-engine/src/write/normalize/finalize.ts`
- `packages/whiteboard-engine/src/write/translate/mindmap.ts`
- `packages/whiteboard-engine/src/read/store/mindmap.ts`
- `packages/whiteboard-react/src/features/mindmap/**`
- `packages/whiteboard-react/src/features/node/session/**`

## 10. 这套设计为什么是长期最优

因为它不是在局部“修 group”，而是在根模型上把错位职责彻底拆开：

- 结构问题交给 owner tree
- 几何问题交给 spatial node
- 只读几何真相交给 projection

这三层一旦明确，后面很多复杂度会自然消失：

- 为什么这里还要 guard `node.position`
- 为什么 group 又被当 rect
- 为什么 read 明明有 projection 还回头看 raw node
- 为什么 align/distribute 一碰 group 就开始膨胀

这些都不是局部 bug，而是根模型没收干净。

这份文档的最终主张只有一句：

**不要继续长期停留在 `Node.position?: Point` 的过渡态，而要正式把 `Node` 收成 `SpatialNode | GroupNode`，并让 projection 成为唯一几何真相入口。**
