# Whiteboard Engine Scope Index 设计方案

## 背景

当前 `packages/whiteboard-react/src/runtime/state/containerRead.ts` 承担了“当前容器编辑作用域”的核心读逻辑：

- 读取 UI state 中的 `activeContainerId`
- 读取 engine 的全量节点与节点索引
- 在 React runtime 侧计算当前 container 的 descendants
- 暴露 `nodeIds / hasNode / hasEdge / filterNodeIds / activeRect`

这层能力在功能上是需要的，但职责边界不够自然：

1. 它放在 `runtime/state/` 下，但本质上并不是 state，而是派生查询。
2. 它依赖 `engine.read` 的全量节点读，并在 UI 侧自行重建 container descendants。
3. 它服务的主要不是 React 展示，而是拖拽、框选、快捷键、边编辑等 runtime 行为热路径。
4. `view.scope` 又在上层对这套能力做了第二次包装，导致 `container`、`scope`、`view` 三种概念交叉。
5. 当前 `view.scope` 的订阅覆盖范围和它真实依赖的 descendants 数据并不完全一致，存在边界模糊和维护风险。

从语义上看：

- “当前进入了哪个 container” 是 UI runtime state。
- “该 container 对应哪些 descendants / 某节点是否处于该子树中” 是 document tree fact。
- “当前编辑 scope 是哪一片子树” 则是前两者的组合语义。

因此，树关系与 descendants 索引更适合进入 engine，而不是继续由 whiteboard-react 在 UI 侧维护。

---

## 目标

本文目标不是直接改代码，而是给出一份可执行的结构设计，回答以下问题：

1. container descendants / membership 是否应该进入 engine 维护。
2. 如果进入 engine，应该维护到什么粒度。
3. engine 应暴露什么 API 才能同时服务行为热路径和 UI 订阅。
4. 现有 `containerRead -> view.scope -> useScope` 这条链路如何收敛。
5. 如何避免为了“精确更新”而把 engine 设计成背负 UI 语义的层。

---

## 结论摘要

本文建议：

1. 将 container 子树关系索引下沉到 engine。
2. engine 不直接承担 `activeContainerId` 这样的 UI 编辑态。
3. engine 优先维护“层级事实索引”，而不是为每个 container 永久物化完整 `nodeIds + nodeSet`。
4. 在 engine 中新增 `read.index.tree`，提供最小必要的子树查询能力。
5. 如需精确 UI 订阅，再在 engine read 层新增对应 projection，并扩展 `KernelReadImpact` 表达层级变化。
6. whiteboard-react 保留一个很薄的 `scope read` 组合层：`activeContainerId + engine read.index.tree`。

一句话概括：

`activeContainerId` 留在 UI runtime，`read.index.tree` 进入 engine，scope 只负责组合，不再自行维护树关系。

---

## 非目标

本文明确不做以下事情：

1. 不把 `activeContainerId` 移入 engine。
2. 不把 `container scope` 变成 engine 的写模型。
3. 不要求第一阶段就为每个 container 常驻维护完整 descendants 数组与 set。
4. 不要求第一阶段就把所有 `view.scope` 订阅完全重写为 subtree 精确订阅。
5. 不改变 group auto-fit normalize 的产品语义。

---

## 当前链路

当前相关链路可概括为：

1. `runtime/state/container.ts`
   - 维护 `activeContainerIdAtom`
   - 提供 `enter / exit / clear`

2. `runtime/state/containerRead.ts`
   - 读取 `activeContainerId`
   - 读取 `engine.read.node.ids()` 与 `engine.read.node.get()`
   - 在 React runtime 内调用 `getContainerDescendants()`
   - 产出当前 scope 的 `nodeIds / nodeSet / hasNode / hasEdge`

3. `runtime/view/container.ts`
   - 将上面的 scope 结果包装成 UI view
   - 添加 `activeTitle`

4. 消费者
   - 节点拖拽
   - 边交互
   - 框选
   - 快捷键 `select all`
   - context menu
   - overlay scope badge

这说明当前 `containerRead` 的主要职责并不是“读 container state”，而是“读当前编辑作用域”。

---

## 当前实现的主要问题

## 1. 职责反转

descendants 是 document tree 的事实关系，但当前由 whiteboard-react 在 UI runtime 中自行计算。

这会导致：

- UI 层知道太多 document tree 细节
- engine 侧已有的 parent/children 关系没有被复用
- 作用域语义分散在多个层次上，难以形成稳定边界

## 2. 查询代价和缓存位置不理想

当前 `containerRead` 会：

- 取全量 `read.node.ids()`
- 遍历所有节点做 `read.node.get()`
- 基于全量节点列表再跑 `getContainerDescendants()`

虽然它有本地 cache，但这个 cache 放在 React runtime 中，无法复用 engine 读模型已经维护的结构信息。

## 3. 订阅边界不准确

当前 `view.scope` 的订阅主要围绕：

- `activeContainerIdAtom`
- active container 节点本身

但 `scope.nodeIds` 真正依赖的是整棵 descendants 子树。也就是说，view 的订阅依赖和查询依赖并不完全一致。

## 4. 概念命名漂移

当前三层概念没有正式拆开：

- `container` 表示进入哪个 group/container
- `containerRead` 实际在读 scope
- `view.scope` 又使用了 scope 命名

这会让后续维护者难以判断：

- 哪些东西属于 UI state
- 哪些东西属于 engine document fact
- 哪些东西属于最终组合语义

---

## 为什么 descendants/index 应该进入 engine

container descendants 和 membership 更接近 engine 的原因有三点。

## 1. 它们是 document 树关系，而不是 UI 视图

一个节点的 `parentId`、一个 group 的 `children`、一个 container 的 descendants，这些都由 document 决定，不依赖当前 React 组件树，也不依赖具体 UI 展示。

## 2. engine 已经在维护相邻能力

当前 engine 在 `write/normalize/group.ts` 中已经维护了：

- `groupIds`
- `parentById`
- `childrenByParentId`
- `orderIndexById`

并且已经支持在以下操作下增量同步：

- `node.create`
- `node.delete`
- `node.update` 中的 `parentId / type`
- `node.order.set`

这说明“层级关系进 engine”符合现有架构方向，不是引入新的异类模型。

## 3. 它服务的是 runtime 行为热路径

当前 `hasNode / hasEdge / filterNodeIds / nodeIds` 主要用于：

- pointer down 行为判断
- selection/drag/edge/routing 热路径
- shortcut dispatch

这些能力应优先以同步 getter 的形式从 runtime/engine 获取，而不应该依赖 React 视图层的 `useView`。

---

## 不建议直接做成“每个 container 常驻 nodeIds + nodeSet”

虽然需求表面上是“希望 engine 精确维护每个 container 的 nodeIds/nodeSet”，但本文不建议第一版直接走全量物化。

原因如下。

## 1. 空间复杂度可能退化

如果文档里存在深层嵌套：

- 节点 A 在 group G1 下
- G1 在 G2 下
- G2 在 G3 下

那么同一个节点会同时出现在多个祖先 container 的 descendants 结果中。若为每个 container 常驻完整数组和集合，最坏情况下空间复杂度可能接近 O(n^2)。

## 2. 写放大更明显

一旦节点被 reparent：

- 旧祖先链上的所有 container descendants 都要删
- 新祖先链上的所有 container descendants 都要加
- 若维护数组顺序，还要处理排序与插入位置

当嵌套较深时，写入传播成本会变高。

## 3. 多数查询只需要当前 active scope

当前 whiteboard-react 实际高频使用的是“当前 active container 的 descendants”，而不是全局所有 container 的 descendants 同时都在读。

因此，更合理的第一阶段是：

- engine 持有稳定的树结构索引
- descendants / set 使用惰性计算与精确失效
- 热路径只为当前活跃 scope 付费

---

## 推荐方案

推荐将该能力拆成三层：

1. engine `read.index.tree`
2. engine tree projection 或订阅层
3. whiteboard-react scope composition

---

## 第一层：engine `read.index.tree`

建议统一明确为 `read.index.tree`。

原因很简单：

- 这层表达的是 document tree fact
- 它不直接表达 UI scope
- `tree` 比 `hierarchy` 更短，也更接近实际用途

### 建议维护的数据结构

```ts
type TreeIndex = {
  doc?: Document
  groups: Set<NodeId>
  parent: Map<NodeId, NodeId | undefined>
  children: Map<NodeId, readonly NodeId[]>
  order: Map<NodeId, number>
  ids: Map<NodeId, readonly NodeId[]>
  set: Map<NodeId, ReadonlySet<NodeId>>
}
```

说明：

- `groups / parent / children / order` 是基础事实索引。
- `ids / set` 是惰性缓存，不是永久预先物化。
- `children` 建议维护有序数组，而不是 `Set`。
  原因是 `scope.nodeIds()` 最终需要稳定顺序，且当前很多消费方默认 `nodeIds` 与节点顺序一致。

### 核心查询接口

第一阶段建议至少提供以下同步 getter：

```ts
type TreeReadIndex = {
  ids: (nodeId: NodeId) => readonly NodeId[]
  has: (rootId: NodeId, nodeId: NodeId) => boolean
}
```

其中：

- `ids()` 返回不包含 root 自身的 descendants，保持和当前 `getContainerDescendants()` 一致。
- `has()` 用于热路径 membership 判断。
- `set` 只作为内部缓存存在，不暴露为公开 getter。
- `parent / children / isContainer` 不进入第一版公开 API，除非后续出现真实调用方。

### 缓存策略

建议使用“基础索引常驻，descendants 惰性缓存”的策略：

1. 文档首次加载或 reset 时重建基础索引。
2. `ids()` 首次读取某个 root 时，基于 `children` 深度遍历并缓存结果。
3. `has()` 首次命中某个 root 时，如无 `set` 缓存，则基于 `ids()` 构建。
4. 发生 relation/order 变化时，仅失效受影响 ancestors 的 descendants 缓存。

这样可以同时满足：

- 热路径读取足够快
- 不为全量 container 预付不必要空间
- reparent/delete 时只清理受影响祖先链缓存

---

## 第二层：engine tree projection

如果只需要行为热路径查询，那么第一层 `read.index.tree` 已经足够。

但如果希望 UI 订阅也做到“精确 subtree 更新”，则还需要 engine read 层提供订阅能力。这里有两种路径。

### 路径 A：先只做 index，不做 subtree 精确订阅

这是更低风险的第一阶段：

- engine 提供 `read.index.tree.*`
- whiteboard-react scope read 直接调用这些 getter
- `view.scope` 暂时使用较粗粒度的订阅

优点：

- 实现简单
- 先把职责边界理顺
- 不需要立刻扩展 `KernelReadImpact`

缺点：

- React 订阅粒度暂时不够理想

### 路径 B：补齐 engine subtree 订阅

若希望 scope view 也做到精确更新，则建议 engine 再增加一个很薄的 projection，例如：

```ts
type TreeRead = {
  ids: (nodeId: NodeId) => readonly NodeId[]
  subscribe: (nodeId: NodeId, listener: () => void) => () => void
}
```

此时：

- `read.index.tree` 继续承担同步事实查询
- `read.tree` 只承担订阅包装，不复制额外查询语义

这是更完整的最终形态。

---

## 为什么 subtree 精确订阅需要扩展 `KernelReadImpact`

当前 engine `read.applyImpact()` 只接收 `KernelReadImpact`，而该结构目前只表达：

- node geometry/list/value
- edge geometry/list/value
- mindmap view

它没有表达：

- 哪些 root 的 subtree ids 发生了变化
- 哪些 parent/ancestor 链受到影响

这意味着，如果只靠现有 impact，engine read 层很难在不看 operations 的前提下精确通知：

- 旧父链上的受影响 roots
- 新父链上的受影响 roots
- 仅排序变化但 ids 集合未变、顺序已变的 roots

因此，如果要做 engine 级 subtree 订阅，建议扩展 `KernelReadImpact`。

### 建议的 impact 扩展

建议增加一个 `tree` 分支：

```ts
type KernelReadImpact = {
  reset: boolean
  node: { ... }
  edge: { ... }
  mindmap: { ... }
  tree: {
    ids: readonly NodeId[]
    relation: boolean
    order: boolean
  }
}
```

语义说明：

- `ids`
  表示 subtree 结果或顺序受到影响的 root id 集合。
- `relation`
  表示 parent/type/container membership 发生变化。
- `order`
  表示 subtree ids 的返回顺序可能变化。

### `tree.ids` 的来源

建议在 kernel 或 write normalize 阶段沿用当前 group normalize 的祖先收集逻辑：

- `node.create`
  标记其祖先 roots
- `node.delete`
  标记其旧祖先 roots
- `node.update(parentId)`
  标记旧父链与新父链上的 roots
- `node.update(type)`
  若 group/container 属性变化，标记自身及祖先链
- `node.order.set`
  标记所有受顺序影响的 roots

engine 里现有 `collectDirtyGroups()` 已经很接近这套逻辑，可以复用其思路，或进一步抽象出公共 tree dirty collector。

---

## 第三层：whiteboard-react 的 scope 组合

当 engine 提供 `read.index.tree` 后，whiteboard-react 应退化为一个很薄的组合层。

### 推荐语义拆分

1. `container state`
   - 只负责 `activeContainerId`
   - 仍位于 `runtime/state/container.ts`

2. `scope read`
   - 只负责 `activeContainerId + engine read.index.tree`
   - 不再自行维护 descendants

3. `scope view`
   - 负责 UI 订阅与展示字段
   - 例如 `activeTitle`

### 推荐读取方式

```ts
const activeId = activeContainerId()
const ids = activeId
  ? engine.read.index.tree.ids(activeId)
  : EMPTY_NODE_IDS

const hasNode = (nodeId: NodeId) =>
  activeId
    ? engine.read.index.tree.has(activeId, nodeId)
    : true
```

此时 whiteboard-react 的 `scope read` 不再需要：

- 全量读取 `read.node.ids()`
- 全量 `read.node.get()`
- 自己执行 `getContainerDescendants()`
- 自己构造 `Set`

---

## 推荐 API 形态

本文建议最终落成如下分层。

## engine

```ts
type EngineReadIndex = {
  node: { ... }
  snap: { ... }
  tree: {
    ids(nodeId): readonly NodeId[]
    has(rootId, nodeId): boolean
  }
}
```

如需精确订阅，再补：

```ts
type EngineRead = {
  node: NodeRead
  edge: EdgeRead
  mindmap: MindmapRead
  tree: {
    ids(nodeId): readonly NodeId[]
    subscribe(nodeId, listener): () => void
  }
  index: EngineReadIndex
}
```

## whiteboard-react

```ts
type WhiteboardScopeRead = {
  activeId(): NodeId | undefined
  activeRect(): Rect | undefined
  nodeIds(): readonly NodeId[]
  filterNodeIds(nodeIds): readonly NodeId[]
  hasNode(nodeId): boolean
  hasEdge(edge): boolean
}
```

注意：

- `WhiteboardScopeRead` 仍然可以保留，因为它代表 UI 编辑语义。
- 但它应变成一个非常薄的组合层，不再自建 descendants。

---

## 更新算法建议

## 1. reset / replace document

- 全量重建 `tree` 基础索引
- 清空 descendants 相关缓存
- 通知所有 tree listeners

## 2. `node.create`

- 更新 `parent`
- 插入 `children[parentId]`
- 若为 group/container，更新 `groups`
- 失效祖先链上的 `ids/set` 缓存

## 3. `node.delete`

- 从旧父节点 children 中移除
- 删除该节点自己的 parent 记录
- 删除该节点作为 parent 的 children 记录
- 若其为 group/container，更新 `groups`
- 失效旧祖先链上的 `ids/set` 缓存

## 4. `node.update(parentId)`

- 从旧父 children 中移除
- 加入新父 children
- 更新 `parent`
- 失效旧父链与新父链上的 `ids/set` 缓存

## 5. `node.update(type)`

- 若 container 属性变化，更新 `groups`
- 若节点由普通节点变 container，允许其开始拥有 descendants 查询能力
- 若由 container 变普通节点，删除其 `ids/set` 缓存
- 失效自身及祖先链缓存

## 6. `node.order.set`

- 更新 `order`
- 重排相关 `children`
- 失效受影响 root 的 `ids/set` 缓存

其中 `node.order.set` 的影响粒度可分两版：

- 第一版保守一些，直接将所有 root cache 失效
- 第二版再做精确 order dirty root 收集

---

## 性能模型

推荐方案的性能假设如下：

## 读路径

- `has(rootId, nodeId)`
  命中缓存后接近 O(1)
- `ids(rootId)`
  首次 O(size of subtree)，命中缓存后 O(1)
- `hasEdge(edge)`
  两次 `has` 判断

这非常适合当前 whiteboard-react 的交互热路径。

## 写路径

- create/delete/reparent 的基础索引更新接近 O(depth)
- `ids/set` 缓存失效成本接近 O(ancestor depth)
- 真正的 subtree ids 重建被推迟到下一次读取时发生

这是比“所有 container 永久持有完整 nodeIds/nodeSet 并在写时逐级维护”更均衡的策略。

---

## 对现有链路的收敛效果

落地后，当前链路可以收敛为：

1. `runtime/state/container.ts`
   - 保持原样，继续只管理 `activeContainerId`

2. `runtime/scope/read.ts` 或 `runtime/read/scope.ts`
   - 通过 `activeContainerId + engine.read.index.tree` 提供 scope getter

3. `runtime/view/scope.ts`
   - 负责 `activeTitle`
   - 负责 UI 订阅包装

4. 下游交互逻辑
   - 继续使用同步 getter
   - 但读取来源改为 engine 的 `read.index.tree`

这样可以正式分清三种概念：

- `container`
  进入哪个容器
- `tree`
  文档层级事实
- `scope`
  当前编辑作用域

---

## 分阶段迁移建议

## 阶段 1：engine 提供 `read.index.tree`，同步查询先落地

目标：

- 新增 engine `read.index.tree`
- whiteboard-react scope read 改用 engine `read.index.tree`
- 删除 UI 侧自建 descendants 逻辑

特点：

- 改动收益高
- 风险相对可控
- 先解决职责问题和重复计算问题

## 阶段 2：调整 whiteboard-react 命名与文件归属

目标：

- `containerRead` 重命名为 `scopeRead`
- 从 `runtime/state/` 移出
- `view/container.ts` 重命名为 `view/scope.ts`

特点：

- 正式让目录结构反映真实职责

## 阶段 3：扩展 `KernelReadImpact`，补 engine subtree 精确订阅

目标：

- 新增 `impact.tree`
- 新增 engine tree projection / `subscribe`
- `view.scope` 改用 subtree 精确订阅

特点：

- 这是精修阶段
- 需要同时改 kernel impact、engine read store 与 react view 订阅逻辑

---

## 主要风险与权衡

## 风险 1：index 与 normalize 重复维护

当前 `write/normalize/group.ts` 已有一套 parent/children 索引。

若 read/index 再维护一份 `tree` index，会有两套索引同时存在的问题。

建议：

- 第一阶段接受“两份索引但职责不同”
- 第二阶段考虑抽出共享 tree helper

理由是：

- normalize 关心写前后 dirty groups 与 auto-fit
- read index 关心提交后读模型与订阅
- 两者生命周期并不完全相同，不必强行合并为一个实例

## 风险 2：order 语义不清晰

当前 descendants 返回顺序应与什么一致，需要提前定好：

- document order
- siblings order 的 DFS 展开顺序
- canvas visible order

建议沿用当前 `getContainerDescendants()` 的预期与现有节点顺序语义，避免改变下游行为。

## 风险 3：container 定义边界

当前实现主要以 `group` 作为 container 编辑对象。

若未来不仅 `group`，其他节点类型也能作为 container，则 `tree` 内部对“哪些节点可作为 root”必须定义得更稳定，不应散落在 UI 层靠字符串判断。

---

## 最终建议

我建议采纳以下方向：

1. 把 container 子树关系与 descendants 索引下沉到 engine。
2. 第一阶段只做 `read.index.tree` 与最小同步 getter，不强求完整订阅。
3. 不直接为每个 container 永久物化完整 `nodeIds + nodeSet`，而是采用“基础索引常驻 + `ids/set` 惰性缓存 + 祖先链精确失效”。
4. 如果后续需要真正精确的 scope view 更新，再扩展 `KernelReadImpact.tree` 和 engine tree projection。
5. whiteboard-react 最终只保留一个薄的 `scope read` 组合层。

这个方案的核心价值不只是性能，而是职责归位：

- 文档层级事实归 engine
- 编辑模式归 UI runtime
- 当前 scope 归组合层

这会比继续在 `containerRead.ts` 中自行维护 descendants 更稳定，也更符合当前项目正在推进的 runtime/view 分层方向。
