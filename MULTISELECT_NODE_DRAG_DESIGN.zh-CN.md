# Multi-Select Node Drag 设计

## 结论

应该支持多选节点整体拖动。

这不是可有可无的增强，而是白板交互的基础能力之一。

当前系统已经具备实现这件事的大部分前提：

- selection 已经支持多选
- `node.updateMany` 已经存在
- node drag preview 已经支持一次写多个 patch
- group drag 已经在运行时里实现了“一个主节点带多个子节点一起移动”的模式

所以当前最优策略不是继续回避这项能力，而是把现有 drag runtime 从“单节点拖动 + group 特例”升级成“drag set 拖动”。


## 为什么需要支持

如果多选后只能拖一个节点，会出现明显的心智断裂：

- selection box 可以选多个
- 多选状态在 UI 上是成立的
- 但开始拖动时却只移动一个

从白板产品体验上，这会被用户直接理解为“多选是不完整的”。

因此，多选拖动应该被视为：

- 高优先级基础交互
- 不是增强特性
- 不需要等所有 node 类型都做完再补


## 当前基建为什么已经足够

### 已有的前提

1. selection domain 已经能读到当前选中的多个 node
2. `node.updateMany` 已经是标准写入口
3. drag preview 已经可以输出多条 `patches`
4. group 拖动已经有“主节点 + offsets + 批量移动”的模型

这些都说明：

多选拖动不是一个全新问题，而是对现有 drag 数据结构的一次抽象升级。


## 推荐交互语义

### 1. 从已选中节点开始拖动

如果 pointer down 的节点已经属于当前 selection：

- 直接拖动整个 selected set

这是白板里最符合直觉的默认行为。


### 2. 从未选中节点开始拖动

如果 pointer down 的节点不在当前 selection：

- 先按当前 selection 规则更新 selection
- 再拖动更新后的 selection

也就是说：

- 普通点击拖：拖单节点
- shift/meta 等修饰键下：按现有选择语义更新，然后拖更新后的集合


### 3. group 与多选的优先级

这里必须定清楚，不然后续实现会很乱。

推荐规则：

- `selected set` 优先于 group descendants 展开
- 只有在“当前拖拽的是 group，且 selection 只有它自己”时，才走 group descendants 逻辑

原因：

- 用户已经显式多选时，selection 应该是最终意图
- group descendants 只是单独拖 group 时的默认扩展语义


### 4. parent / child 同时被选中

推荐第一版规则：

- 构造 drag set 时去重
- 如果 parent 已经在 drag set 中，则不再单独加入它的 descendants

也就是说，drag set 应该只保留“最外层有效节点”。

否则会出现：

- parent 被拖一遍
- child 又按自身 offset 再拖一遍

这会直接导致重复位移。


### 5. snap 语义

这是第一版最重要的取舍点。

推荐第一版：

- 继续以“主拖节点”为 snap 基准
- 不要第一版就升级为“整个 selected bbox snap”

原因：

- 与当前实现最接近
- 风险最低
- 不需要重写大量 snap math
- 更容易先做对

后续如果体验上明显需要，再升级为 selected-set bbox snap。


## 最优 runtime 抽象

### 当前不够理想的地方

现有 node drag runtime 本质上仍然是：

- 正在拖一个主节点
- 如果这个节点是 group，再额外附带 children offsets

这会导致：

- group 是一个特例
- 多选也会变成另一个特例
- 后面如果再加 container / lane / stack，drag 分支会继续膨胀


### 推荐抽象：Drag Set

最优抽象应该是：

```ts
type DragSet = {
  anchorId: NodeId
  ids: NodeId[]
  offsets: Map<NodeId, Point>
}
```

核心思想：

- runtime 不关心“为什么拖这些节点”
- runtime 只关心“当前拖动集合里有哪些 node，以及它们相对 anchor 的偏移”

这样：

- 单节点拖动 = 一个只含 anchorId 的 drag set
- group 拖动 = 一个由 group + descendants 构造出来的 drag set
- 多选拖动 = 一个由 selected nodes 构造出来的 drag set

统一后，preview / commit 逻辑都能共用。


## 推荐模块分层

推荐把 node drag 内部职责分成三层。

### 1. Drag Set Builder

负责回答：

- 当前这次拖拽到底要拖哪些 node
- anchor 是谁
- 每个 node 相对 anchor 的 offset 是什么

输入可能包括：

- 当前 pointer down node
- 当前 selection
- 当前 document nodes
- 是否为 group


### 2. Drag Preview Resolver

负责回答：

- 当前 pointer move 后，anchor 新位置是什么
- drag set 中每个 node 的 preview patch 是什么
- guides / hoveredGroupId 是什么

这个模块不应该关心 drag set 来源，只消费 drag set 本身。


### 3. Drag Commit Resolver

负责回答：

- pointer up 时最终写哪些 patch
- parentId 是否变化
- group / container 边界是否需要更新

同样，它不应该关心 drag set 来源。


## 推荐数据结构

推荐把当前 runtime state 从“单节点状态”升级成下面这种形态：

```ts
type DragMember = {
  id: NodeId
  offset: Point
}

type DragSet = {
  anchorId: NodeId
  members: DragMember[]
}

type NodeDragRuntimeState = {
  dragSet: DragSet
  anchorType: Node['type']
  start: Point
  origin: Point
  last: Point
  size: {
    width: number
    height: number
  }
  hoveredGroupId?: NodeId
}
```

这样可以带来的直接好处：

- 去掉 group 的专用 children 特例
- 多选逻辑自然接入
- preview / commit 输出仍然是现有 `patches` 结构


## 推荐第一版范围

第一版不要贪大。

### 应该做的

- 已选节点拖动整个 selected set
- 未选节点拖动时先更新 selection，再拖新 selection
- group 与多选优先级明确
- 去重 parent/child 重复拖动
- 继续沿用 anchor node snap 语义


### 不建议第一版就做的

- 整个 multi-select bbox snap
- 多选整体 resize
- 多选整体 rotate
- 多选时复杂 container 约束
- 多选拖动时组合包围盒视觉反馈

这些都应该放到第二阶段。


## 推荐的演进顺序

### 第一阶段

把现有 drag runtime 升级为 drag set 模型，但只做：

- 单节点
- group 单拖
- multi-select 拖动


### 第二阶段

在 drag set 稳定之后，再考虑：

- multi-select bbox snap
- 多选整体 transform
- 容器级拖动约束


## 为什么现在值得做

当前阶段很适合做这件事，原因有三：

1. 底层交互骨架已经基本稳定
2. 新 node 类型刚开始扩展，多选拖动会直接提升整体可用性
3. 现在改 runtime 抽象，代价比后面 node 类型越来越多时再改更低


## 一句话结论

应该支持多选节点拖动。

最优设计不是继续给“单节点拖动”打补丁，而是把内部抽象升级成统一的 `drag set` 模型，让：

- 单节点拖动
- group 拖动
- multi-select 拖动

都落在同一套 runtime 上。
