# Group / Frame 最终模型设计

更新时间：2026-03-25

## 0. 前提

本文明确采用“一步到位、无需兼容”的策略。

- 不保留当前 `group ~= container` 的实现语义
- 不保留 `parentId` 同时表示 frame 容器关系和 group 成员关系的混合模型
- 不做过渡别名
- 不做双模型并存

目标只有一个：

`frame` 是几何容器，`group` 是稳定编组。

---

## 1. 当前问题

现在最根本的问题，不是某一个拖拽 bug，而是模型本身错位了。

当前实现里，`group` 同时承担了三种职责：

- 作为多对象聚合选择
- 作为 children 自动包裹的几何外框
- 作为拖入拖出会自动 reparent 的容器

这会直接导致一整串连锁问题：

- child 拖出 group 外框后会脱离 group
- group 的 selection box 本质上是“容器边界”，不是“成员几何投影”
- marquee / hit / drag / finalize / normalize 都要不断判断 group 到底是“编组”还是“容器”
- API 会持续膨胀，因为每个动作都要额外判断 group 语义

而从产品心智和行业实践看，这两种对象其实应该彻底拆开：

- `group`
- `frame`

它们都可能显示一个外框，但外框的来源完全不同。

---

## 2. 最终结论

最终只保留两个明确概念：

### 2.1 `frame`

`frame` 是区域容器。

- 有显式 `rect`
- 可以 body hit
- 可以进入 scope
- 成员关系由空间包含或显式 reparent 决定
- child 拖出 frame 后可以离开 frame

一句话：

`frame` 的核心是空间。

### 2.2 `group`

`group` 是稳定编组。

- 没有独立“容器 body”语义
- selection box 永远由成员几何派生
- group 本身不是“一个可收纳对象的区域”
- child 被拖到外面，仍然属于 group，直到显式 ungroup 或 remove

一句话：

`group` 的核心是成员关系，不是空间包含。

---

## 3. 长期最优的数据模型

## 3.1 为什么 `parentId` 不能继续混用

如果 `parentId` 既表示：

- `frame` 容器归属
- `group` 成员归属

那后续所有逻辑都会持续膨胀：

- 命中
- 选择
- marquee
- 拖拽
- finalize
- normalize
- clipboard
- duplicate
- frame scope

每一层都要不断写这种判断：

```ts
if (parent is frame) ...
if (parent is group) ...
```

这是典型的职责不分离。

## 3.2 最终关系字段

长期最优建议直接拆成两套关系：

```ts
type BaseNode = {
  id: NodeId
  type: NodeType
  containerId?: NodeId
  groupId?: NodeId
  locked?: boolean
}
```

其中：

- `containerId`
  - 只给 `frame` 这类空间容器使用
- `groupId`
  - 只给 `group` 这类稳定编组使用

这意味着一个 node 可以同时：

- 在某个 frame 里
- 属于某个 group

这是正确的，因为这两个关系本来就不是同一个维度。

## 3.3 节点类型

最终推荐：

```ts
type NodeType =
  | 'text'
  | 'sticky'
  | 'shape'
  | 'draw'
  | 'mindmap'
  | 'group'
  | 'frame'
```

## 3.4 几何型 node

真正持有几何的 node：

```ts
type SpatialNode = BaseNode & {
  position: Point
  size: Size
  rotation?: number
}
```

普通内容节点都走这条线。

## 3.5 `frame` 类型

```ts
type FrameNode = BaseNode & {
  type: 'frame'
  position: Point
  size: Size
  title?: string
  style?: FrameStyle
}
```

说明：

- `frame` 的 `rect` 是主数据
- `frame` 可以 drag / resize
- `frame` 默认不自动跟随 children
- `fit to contents` 只能是一次性命令，不是持续 normalize

## 3.6 `group` 类型

```ts
type GroupNode = BaseNode & {
  type: 'group'
}
```

说明：

- `group` 不持久化 `position`
- `group` 不持久化 `size`
- `group` 不持久化 `rotation`
- `group` 不持久化 `title`

`group` 的外框是读侧派生物，不是主数据。

## 3.7 读侧派生

读侧统一派生：

```ts
read.group.members(groupId) => NodeId[]
read.group.box(groupId) => Rect | undefined
read.group.set(groupId) => ReadonlySet<NodeId>
```

这里的 `box` 定义很明确：

```ts
group.box = bounds(all group members)
```

不是：

```ts
group.box = storedRect
```

也不是：

```ts
group.box = container body rect
```

---

## 4. 几何原则

## 4.1 `frame`

`frame` 的几何是显式的、主存储的：

```ts
frame.rect = storedRect
```

因此：

- frame 可以空着
- frame 可以有大块空白 body
- frame 可以单独被 marquee / click 命中
- frame 的 children 是否存在，不影响 frame 自己是否成立

## 4.2 `group`

`group` 的几何永远是成员几何投影：

```ts
group.box = bounds(group members)
```

因此：

- group 没有独立 body
- group 不应该靠中间空白区域被命中
- group 不能手动 resize
- group 不能有 auto/manual 双模式
- group 的 selection box 会随着成员移动实时变化

## 4.3 一个关键结论

`group` 的外框只是“成员关系的可视化”，不是“可以放对象进去的容器壳”。

这是整条链路的核心收敛点。

---

## 5. 交互语义

## 5.1 `frame`

### 点击

- 点击 frame body / border / title
  - 选中 frame
- 点击 frame 内 child
  - child 优先

### 拖拽

- 拖 frame shell
  - frame 自己移动
- 内部 child 是否跟随
  - 这是容器策略问题，可单独定义
- 拖 child 出 frame
  - 可以脱离 frame

### marquee

- `frame` 可以按 body / shell 几何参与 marquee
- 擦到 frame 空白区域命中 frame 是合理的

## 5.2 `group`

### 点击

- 第一次点组内某个 child
  - 优先选中整个 group
- 当 group 已选中，再点击组内某个 child
  - 直接落到该 child

### 拖拽 group 本身

- 选中 group 后拖拽
  - group 成员整体移动
- 视觉上显示 group 的外围 selection box 一起移动

### 拖拽 group 内单个 child

- 只移动该 child
- 不改变 group membership
- group 的 selection box 实时变成“当前所有成员的新外围 rect”

这就是你描述的 Miro 语义。

### marquee

- group 不应因为擦到外包矩形内部空白就命中
- group 命中应由 members 驱动
- `touch`
  - 任一 member 命中，则 group 命中
- `contain`
  - 所有 members 都被包住，则 group 命中

### 显式修改成员

只有这些动作才允许改 group 成员关系：

- `group.create`
- `group.ungroup`
- `group.add`
- `group.remove`

而不是：

- child 拖出外框自动脱离
- child 拖进外框自动加入

---

## 6. 选择语义

## 6.1 `group`

`group` 在 selection 里是一个实体，但这个实体的几何来源来自成员。

最终规则：

- 单选 group
  - 显示 group box
- 多选包含 group
  - group 作为一个 selection item 参与整体 box 计算
- 选中组内单个 child
  - 只显示 child 自己的选中态
  - group box 不显示

## 6.2 `frame`

`frame` 在 selection 里是一个真正的空间对象。

最终规则：

- 单选 frame
  - 显示 frame 自己的 chrome / handles
- 单选 frame 内 child
  - frame 不应被动保持选中

---

## 7. Engine 侧职责

## 7.1 Engine 应该知道什么

Engine 应该明确知道：

- `containerId`
  - 空间归属
- `groupId`
  - 编组归属

这样 normalize / finalize 才能在模型层保持清晰。

## 7.2 Engine 不应该做什么

Engine 不应该再做这种逻辑：

- “如果 node 离开 group 外包框，就把它从 group 里移除”
- “如果 node 进入 group 外包框，就把它加入 group”

因为这会把 `group` 重新变回容器。

## 7.3 Engine 应该保留什么 finalize

Engine 应该保留：

- frame 的 reparent / unparent
- edge 跟随
- text data normalize

Engine 不应该保留：

- group 的几何 containment reparent

## 7.4 group box 在哪算

长期最优：

- engine 可提供 group membership 读模型
- react 读侧或 engine read 都可以派生 group box

关键不是算在哪，而是语义必须明确：

`group box = members bounds`

不再是存储字段。

---

## 8. React 侧职责

React 侧主要负责三件事：

- 选择语义
- 命中提升
- chrome 渲染

具体来说：

### 8.1 命中提升

- 点击到 group 成员
  - 可能提升为 group selection
- marquee 命中 members
  - 结果提升为 group

### 8.2 box 渲染

- `group` box 用派生 rect 画
- 它不是一个独立 body layer

### 8.3 hover / press / drag

- group 拖拽时，拖的是成员集合
- 单 child 拖拽时，只改 child 几何
- React 层不负责改 membership

---

## 9. 命令面设计

## 9.1 `group`

长期最优建议：

```ts
instance.commands.group.create(nodeIds)
instance.commands.group.ungroup(groupIds)
instance.commands.group.add(groupId, nodeIds)
instance.commands.group.remove(groupId, nodeIds)
```

这些命令本质上只改 `groupId`。

## 9.2 `frame`

```ts
instance.commands.frame.create(input)
instance.commands.frame.fit(frameId)
instance.commands.frame.enter(frameId)
instance.commands.frame.exit()
```

`frame` 的 children 归属变更则由：

- 创建时命中 frame
- 拖拽 finalize reparent
- 显式命令

共同完成。

---

## 10. 为什么这是长期最优

这个设计的核心收益，是把两类复杂度彻底分层：

### 10.1 空间复杂度

由 `frame` 承担：

- body hit
- scope
- reparent
- contain / uncontain
- 区域组织

### 10.2 关系复杂度

由 `group` 承担：

- 稳定编组
- 成员整体操作
- group selection box
- group promote

这样以后不会再出现：

- “为什么 group 拖出去会脱离”
- “为什么 group 中间空白能命中”
- “为什么 frame 和 group 的 hit 看起来差不多”

因为它们从模型层就不是一回事。

---

## 11. 落地顺序

如果后续开始实现，建议严格按这个顺序：

### 阶段 1：拆关系字段

- `parentId` 从混合语义拆成：
  - `containerId`
  - `groupId`

### 阶段 2：收敛 frame 链路

- frame scope
- frame hit
- frame reparent / unparent
- frame create inside

全都只认 `containerId`

### 阶段 3：收敛 group 链路

- group members read
- group selection box
- group drag
- group marquee promote

全都只认 `groupId`

### 阶段 4：删除旧 finalize 逻辑

- 删除 group 的 containment reparent
- 只保留 frame 的 containment reparent

### 阶段 5：补外围消费方

- clipboard
- duplicate
- selection summarize
- context menu
- toolbar

---

## 12. 最终定稿

最终定稿只有两句话：

### 12.1 `frame`

`frame` 是几何容器，成员关系由空间决定。

### 12.2 `group`

`group` 是稳定编组，外框只是成员几何的投影。

如果未来任一实现细节违反这两句话，就说明模型又开始混了，需要回退设计，而不是继续补特判。
