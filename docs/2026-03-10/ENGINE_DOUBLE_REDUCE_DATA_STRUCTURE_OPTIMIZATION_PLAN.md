# Engine Double Reduce Data Structure Optimization Plan

## 1. 结论

当前的双 `reduce` 不是正确性问题，而是性能和结构成本问题。

在现有架构下，不建议优先把它改成单 `reduce`。更优路线是保留：

- `plan -> reduce(main operations) -> normalize -> reduce(final operations) -> commit`

然后把性能热点从：

- 每次写入都全量扫描 `document`
- 每次 normalize 都重建 group 关系
- 每次计算都重新推导 node 几何

收敛为：

- 只在必要时进入 normalize
- 只重算脏节点影响到的 group
- 复用常驻索引和几何缓存

一句话总结：

双 `reduce` 可以保留，但 `normalize` 不能继续是“基于整份 `document` 的全量后处理”。

## 2. 当前热点

### 2.1 双 reduce 的真实成本

当前流程在 `packages/whiteboard-engine/src/write/normalize.ts` 中是：

1. 对原始 `document` 执行一次主 `reduce`
2. 基于 `planned.doc` 执行 `normalizeGroupBounds`
3. 如果有 normalize operations，再对原始 `document` 以 `main operations + normalize operations` 再执行一次 `reduce`

这个设计保证了最终提交的：

- `changes`
- `inverse`
- `read impact`

都来自最终完整操作包，因此语义正确。

但它的额外成本也很明确：

- 主 `reduce` 运行两次
- `buildInverse` 运行两次
- `trackReadImpact` 运行两次
- `applyOperation` 运行两次
- `nodes.entities` / `edges.entities` 的浅拷贝可能发生两次

### 2.2 真正更大的热点不是第二次 reduce，而是全量 normalize

当前 `normalizeGroupBounds` 的算法在 `packages/whiteboard-core/src/node/group.ts` 中是全量推导：

1. 从 `document.nodes` 生成有序节点数组
2. 遍历所有节点收集 group
3. 重建 `childIdsByParentId`
4. 复制一份 `workingNodes`
5. bottom-up 遍历所有 group，逐个计算 bounds

这意味着即使最终没有 normalize operations，很多写入仍然已经支付了全量扫描成本。

所以真正的性能瓶颈是：

- `reduce(main)`
- `full normalize analysis`
- 命中时再 `reduce(final)`

不是单纯的“多了一次 reduce”。

## 3. 优化目标

### 3.1 必须保持

- 保留双 `reduce`
- 保留当前 `Document` 的纯数据、不可变、可序列化形态
- 保留最终一次 `reduce` 统一产出 `changes / inverse / read impact`
- 不把 normalize 逻辑塞回 planner

### 3.2 必须优化

- 避免无关写入进入 normalize
- 避免每次 normalize 全量重建 group 关系
- 避免每次 normalize 重新计算全量 node 几何
- 降低拖拽、批量移动、group 内节点编辑时的写入成本

### 3.3 不建议优先做

- 不建议为了这个问题先上单 `reduce`
- 不建议优先把 `Record` 改成 `Map`
- 不建议先用 Immer 解决结构性热点
- 不建议先引入 persistent collection / HAMT

## 4. 最优路线

### 4.1 第一层：增加 normalize eligibility gate

目标：

不是每次写入都尝试 group normalize，而是先做一次极轻量的资格判断。

只有以下变化才允许进入 group normalize：

- `node.create`
- `node.delete`
- `node.update.position`
- `node.update.size`
- `node.update.rotation`
- `node.update.parentId`
- `node.update.type` 涉及 `group`
- `group collapsed` 状态变化
- 任何会影响节点是否参与 group 包围盒计算的变化

以下变化直接跳过 normalize：

- 纯 edge 写入
- `node.style` 改动
- `node.data` 的无关字段改动
- mindmap 相关不影响 group canvas rect 的改动
- 任何不影响 node 几何和 group 关系的写入

这一层收益最大，复杂度最低，应该最先落地。

### 4.2 第二层：引入写侧 GroupNormalizeIndex

目标：

把 group normalize 从“每次从 `document` 全量重建”改成“基于常驻索引的增量归约”。

建议新增一个仅服务 write 的 sidecar：

`GroupNormalizeIndex`

建议字段：

- `groupIds: Set<NodeId>`
- `parentById: Map<NodeId, NodeId | undefined>`
- `childrenByParentId: Map<NodeId, NodeId[]>`
- `collapsedGroupIds: Set<NodeId>`
- `orderIndexById: Map<NodeId, number>`
- `nodeRectById: Map<NodeId, Rect>`
- `nodeAabbById: Map<NodeId, Rect>`

可选字段：

- `groupDepthById: Map<NodeId, number>`
- `ancestorGroupsByNodeId: Map<NodeId, NodeId[]>`

职责边界：

- 它不是公开 read API
- 它不是 document 的一部分
- 它只服务 write 阶段的 normalize 推导
- 它随 committed document 前进

### 4.3 第三层：把 normalize 范围收敛到 dirty groups

当前做法是全量扫描所有 group。

优化后做法应该是：

1. 从本次主操作中提取 dirty nodes
2. 从 dirty nodes 向上找到所有祖先 group
3. 把这些祖先 group 标记为 dirty
4. 只对 dirty groups 做 bottom-up normalize

dirty node 的来源：

- 被创建的 node
- 被删除的 node
- `position/size/rotation/parentId/type` 变化的 node
- `collapsed` 状态变化的 group

dirty group 的来源：

- dirty node 自身如果是 group
- dirty node 的所有祖先 group
- parent 变化时，旧 parent 链和新 parent 链都需要标脏

这样可以把一次单节点拖拽从：

- 扫全部 nodes
- 扫全部 groups

收敛为：

- 只更新该节点
- 只更新其祖先 group 链

### 4.4 第四层：抽出几何缓存，不要每次重算

当前 group normalize 内部会反复依赖节点几何。

长期最优是引入可复用的节点几何缓存：

`NodeGeometryCache`

建议字段：

- `rectById: Map<NodeId, Rect>`
- `aabbById: Map<NodeId, Rect>`
- `rotationById: Map<NodeId, number>`
- `sizeById: Map<NodeId, Size>`

更新方式：

- committed document 初始化一次
- 每次 commit 后仅按 dirty node ids 增量更新

使用方式：

- `GroupNormalizeIndex` 只读取缓存
- read 侧索引可以复用同一套核心几何推导逻辑

注意：

不建议把这些派生数据写回 `Document`。它们是 runtime sidecar，不是持久数据。

### 4.5 明确 NodeGeometryCache 和 NodeRectIndex 的分层

当前 engine 已经有读侧的 `NodeRectIndex`，但它和这里设计的 `NodeGeometryCache` 不是同一个层级。

`NodeRectIndex` 的职责是：

- 面向 read 侧
- 面向查询
- 维护有序 entry 列表
- 提供 `all()`
- 提供 `byId()`
- 提供 `idsInRect()`
- 依赖 `ReadModel` 增量同步

它本质上是读侧空间索引，不只是几何缓存。

`NodeGeometryCache` 的职责应该更小：

- 面向 write 和共享 runtime
- 只缓存单节点几何结果
- 只提供 `rect/aabb/rotation/size` 级别读取
- 不维护查询顺序
- 不提供 `idsInRect()`
- 不依赖 `ReadModel`

它本质上是基础几何层，不是读 projection 的一部分。

两者的关系应该是：

1. `NodeGeometryCache` 负责“算一次，缓存一次”
2. `NodeRectIndex` 负责“在几何缓存之上提供读侧查询能力”

也就是说，长期最优不是保留两套重复几何实现，而是做成两层：

- 基础层：`NodeGeometryCache`
- 读层：`NodeRectIndex`

write/normalize 依赖基础层，read/index 依赖读层。

这样可以避免两个问题：

- write 直接耦合 read runtime
- 几何推导在 write 和 read 中重复实现

建议的长期 API 形态：

```ts
type NodeGeometryCache = {
  replace: (document: Document) => void
  sync: (document: Document, nodeIds: readonly NodeId[]) => void
  rect: (nodeId: NodeId) => Rect | undefined
  aabb: (nodeId: NodeId) => Rect | undefined
  rotation: (nodeId: NodeId) => number | undefined
}
```

`NodeRectIndex` 则退化为读层 facade：

```ts
type NodeRectIndex = {
  sync: (nodeIds: readonly NodeId[] | 'full') => void
  all: () => CanvasNodeRect[]
  byId: (nodeId: NodeId) => CanvasNodeRect | undefined
  idsInRect: (rect: Rect) => NodeId[]
}
```

其中：

- `NodeGeometryCache` 负责基础几何值
- `NodeRectIndex` 负责读侧有序视图和空间查询

因此，当前阶段如果要做 group normalize 优化，正确方向不是让 write 直接复用现在的 `NodeRectIndex`，而是先把几何能力下沉成一个基础缓存层。

### 4.6 Dirty Group 归约策略：ancestor 索引 vs 运行时上溯

dirty group 的计算有两种常见方案：

方案 A：维护 `ancestorGroupsByNodeId`

- 优点
  - 一次查表即可得到所有祖先 group
  - 适合深层 group 且高频更新
- 缺点
  - parent 改动时需要更新整条链
  - 创建/删除/parent 变更都会触发祖先索引重建
  - 复杂度和错误面都上升

方案 B：只维护 `parentById`，运行时上溯

- 优点
  - 索引维护简单
  - parent 变更只改一条关系
  - 正确性边界清晰
- 缺点
  - dirty 计算时有 `O(depth)` 成本
  - 批量操作时可能重复上溯

推荐：优先用方案 B。

原因很直接：

- group 深度通常不大，`O(depth)` 成本可接受
- 维护 `ancestorGroupsByNodeId` 的复杂度远高于节省的时间
- 只要在一次 normalize 过程中做“短期 memo”，就能消除重复上溯

可选优化（不建议第一阶段就做）：

- 在一次 normalize 过程中维护 `ancestorCache`，对同一个 node 只上溯一次
- 维护 `dirtyGroupSet`，防止重复加入

因此推荐的策略是：

- 索引只维护 `parentById`
- dirty 计算阶段用 while 循环上溯
- 用短期 cache 去重

这条路线能把复杂度控制在“运行时线性 + 常数去重”，而不会把索引维护推到系统复杂度的另一侧。

## 5. 推荐的新链路

保留双 `reduce` 的前提下，推荐链路如下：

1. `plan(payload)` 产出主 operations
2. `reduce(document, main operations, origin)` 得到 `planned`
3. `normalizeGate(main operations)` 判断是否需要 group normalize
4. 如果不需要：
   - 直接提交 `planned`
5. 如果需要：
   - 用 `GroupNormalizeIndex` + `NodeGeometryCache` + `main operations` 求出 dirty groups
   - 基于 `planned.doc` 的节点状态，只为 dirty groups 生成 normalize operations
6. 如果 normalize operations 为空：
   - 直接提交 `planned`
7. 如果 normalize operations 非空：
   - 对原始 `document` 执行第二次 `reduce(document, main + normalize, origin)`
   - 提交最终结果

关键点：

- 双 `reduce` 仍然保留
- 第二次 `reduce` 的语义价值仍然保留
- 但 `normalize` 不再是全量扫描

## 6. 关键数据结构设计

### 6.1 GroupNormalizeIndex 最小形态

```ts
type GroupNormalizeIndex = {
  groupIds: Set<NodeId>
  parentById: Map<NodeId, NodeId | undefined>
  childrenByParentId: Map<NodeId, NodeId[]>
  collapsedGroupIds: Set<NodeId>
  orderIndexById: Map<NodeId, number>
}
```

适用场景：

- 先快速落地
- 先把全量重建 parent/children/group/order 的成本拿掉

### 6.2 GroupNormalizeIndex 完整形态

```ts
type GroupNormalizeIndex = {
  groupIds: Set<NodeId>
  parentById: Map<NodeId, NodeId | undefined>
  childrenByParentId: Map<NodeId, NodeId[]>
  collapsedGroupIds: Set<NodeId>
  orderIndexById: Map<NodeId, number>
  nodeRectById: Map<NodeId, Rect>
  nodeAabbById: Map<NodeId, Rect>
}
```

适用场景：

- 高频拖拽
- 高频 group normalize
- 需要极低写路径几何重算开销

这一定义里出现的 `nodeRectById` / `nodeAabbById`，长期不建议直接和 `GroupNormalizeIndex` 绑死。

更好的组织方式是：

- `GroupNormalizeIndex` 只维护关系和 group 脏区信息
- 节点几何由独立的 `NodeGeometryCache` 提供

也就是说，完整形态更适合收敛成：

```ts
type GroupNormalizeIndex = {
  groupIds: Set<NodeId>
  parentById: Map<NodeId, NodeId | undefined>
  childrenByParentId: Map<NodeId, NodeId[]>
  collapsedGroupIds: Set<NodeId>
  orderIndexById: Map<NodeId, number>
}
```

再额外配套：

```ts
type NodeGeometryCache = {
  rect: (nodeId: NodeId) => Rect | undefined
  aabb: (nodeId: NodeId) => Rect | undefined
  rotation: (nodeId: NodeId) => number | undefined
}
```

这样职责更清晰：

- 关系归关系
- 几何归几何
- 读查询归读查询

### 6.3 DirtyNormalizeInput

建议把 normalize 输入也标准化，而不是继续直接喂整份 `document`：

```ts
type DirtyNormalizeInput = {
  document: Document
  dirtyNodeIds: readonly NodeId[]
  dirtyGroupIds: readonly NodeId[]
  index: GroupNormalizeIndex
  geometry: NodeGeometryCache
  nodeSize: Size
  groupPadding: number
  rectEpsilon: number
}
```

这样 `normalizeGroupBounds` 就可以拆成两个阶段：

1. `collectDirtyGroups(operations, index)`
2. `buildGroupNormalizeOperations(input)`

## 7. 复杂度收益

### 7.1 当前复杂度

单次可能受影响的写入，接近：

- `O(main reduce)`
- `O(all nodes + all groups)` 的 normalize 分析
- 命中时再 `O(final reduce)`

### 7.2 优化后复杂度

单次局部写入，接近：

- `O(main reduce)`
- `O(dirty nodes + ancestor groups + dirty group children)` 的 normalize 分析
- 命中时再 `O(final reduce)`

如果用户拖一个普通节点，且只影响 2 到 4 层 group，理论上 normalize 的成本会从“看全图”变成“看祖先链”。

## 8. 为什么不优先改 Document 结构

### 8.1 Record 改 Map

收益有限，原因：

- 如果仍然需要不可变提交，`Map` 一样要复制
- `new Map(oldMap)` 仍然是线性成本
- JSON 序列化和调试更差
- 不解决“每次 normalize 全量重建关系”的核心问题

### 8.2 Immer

收益主要在代码书写，不在结构热点。

它不能消除：

- 全量 group 扫描
- 全量 parent/children 重建
- 几何重复推导

### 8.3 Persistent collection

这是长期可以考虑的方向，但不应该是第一阶段：

- 重构面过大
- 开发和调试复杂度显著上升
- 当前热点还没逼到必须上这条路

## 9. 实施顺序

### Phase 1

- 增加 normalize eligibility gate
- 让绝大多数无关写入直接跳过 normalize

### Phase 2

- 新增 `GroupNormalizeIndex`
- 初始化于 committed document
- commit 后按最终变更增量同步索引

### Phase 3

- 新增 dirty group 收集逻辑
- normalize 改成只处理 dirty groups

### Phase 4

- 抽出 `NodeGeometryCache`
- 用缓存代替重复 `getNodeAABB`

### Phase 5

- 如果仍然有瓶颈，再评估 persistent entity store

## 10. 建议的落地原则

### 10.1 sidecar 原则

所有加速结构都应该是 runtime sidecar，不进入 `Document`。

### 10.2 最终提交一致性原则

最终对外暴露的：

- `doc`
- `changes`
- `inverse`
- `read impact`

仍然只认最终一次 `reduce` 的结果。

### 10.3 先减分析成本，再谈 reduce 次数

当前更大的浪费来自全量 normalize 分析，不是单纯的第二次 `reduce`。

所以优化顺序必须是：

1. 先减少 normalize 进入次数
2. 再减少 normalize 覆盖范围
3. 最后才决定是否还要讨论 reduce 模型

## 11. 最终建议

长期最优方案不是把双 `reduce` 改成单 `reduce`，而是：

- 保留双 `reduce` 的提交语义
- 用写侧索引和几何缓存把 normalize 变成增量过程
- 只在必要时、只对脏 group 做后处理

这条路线的优点是：

- 不破坏当前正确性模型
- 不引入更复杂的 reduce session
- 性能收益直接落在当前真实热点上
- 结构仍然符合漏斗原则

最终判断：

如果目标是在不引入单 `reduce` 复杂度的前提下显著降成本，最佳手段不是改 `reduce` 形态，而是给 `normalize` 配一套长期存在的增量索引。
