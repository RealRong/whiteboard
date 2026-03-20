# Whiteboard Edge 模型设计

## 目标

这份文档只回答一个问题：

长期最优的 `edge` 应该怎么设计，才能同时满足下面 5 个要求：

1. 支持 `node -> node`
2. 支持 `node -> point`
3. 支持 `point -> node`
4. 支持 `point -> point`
5. 曲线编辑行为尽量贴近 Miro

并且：

1. API 尽量短
2. 概念尽量少
3. engine / read / react 三层职责清晰
4. 不考虑兼容成本，允许一步到位重构

一句话结论：

1. edge 不该继续建模成“只能挂 node 的 connector”
2. edge 几何应该收敛成 `end / path / type`
3. `curve` 不应该有自己独立的数据模型
4. 对外 API 应该收敛成 `edge.create / update / delete / order / path.*`

## 最终结论

经过对当前实现和 Miro 行为的对照，最终建议放弃下面这条路线：

1. `end / route / curve`

原因不是它做不出来，而是它不是长期最优。

如果保留独立的 `curve` 数据模型，系统里就会同时存在两种完全不同的编辑语法：

1. `linear / step` 通过路径点编辑
2. `curve` 通过单独 control point 编辑

这会导致：

1. 用户心智分叉
2. React overlay 分叉
3. read 层分叉
4. engine patch 语义分叉
5. 命名越来越多

所以最终建议是：

1. 只有一套真实几何数据：`path.points`
2. `curve` 只是一种渲染方式
3. 空心点是持久化路径点
4. 实心点是段上的插入点，只是 UI 派生物，不入库

也就是：

1. 真实数据统一
2. UI affordance 可分两种视觉态
3. 渲染方式由 `type` 决定

## 为什么 Miro 会有空心点和实心点

你描述的 Miro 行为，本质上不是“控制柄 + 贝塞尔手柄”模型，而是：

1. 已存在的真实路径点
2. 段上的插入点

最合理的解释是：

1. 空心点 = committed path point
2. 实心点 = segment insert handle

行为是：

1. 拖动空心点：移动已有路径点
2. 拖动实心点：把当前段拆分成两段
3. 被拖动的实心点升级成新的真实路径点
4. 它自身变成空心点
5. 新生成的两段各自产生一个新的实心点

这套模型的核心优势是：

1. 所有 edge 类型都可以复用同一套 path 编辑语义
2. 不需要让用户理解“哪类点是路径点，哪类点是曲线控制柄”
3. curve 只是 path 的平滑渲染，不是另一套几何模型

## 设计原则

### 1. 只有一套路径数据

edge 的真实几何数据只保留：

1. `source`
2. `target`
3. `path.points`

不要再额外保留：

1. `route.points`
2. `curve.point`
3. `bezier handles`

### 2. type 决定渲染，不决定编辑模型

`type` 的职责应该很简单：

1. `linear` 怎么画
2. `step` 怎么画
3. `curve` 怎么画

但不应该决定底层是否使用不同数据结构。

也就是说：

1. `linear` 使用 `path.points`
2. `step` 使用 `path.points`
3. `curve` 也使用 `path.points`

差别只在 router / renderer。

### 3. 空心点入库，实心点不入库

路径上的真实点应该入库，因为它们是 document 真相。

段上的插入点不应该入库，因为它们只是 UI 派生 affordance。

否则 document 会被一堆“可插入提示点”污染。

### 4. endpoint 必须支持 node 和 point

长期最优的 edge 不是纯 connector。

所以 endpoint 必须支持：

1. 吸附到节点
2. 落在自由点

### 5. 短 API 优先

对外 API 尽量短：

1. `path` 比 `routing` 更短
2. `insert` 比 `insertAtPoint` 更短
3. `ends` 比 `endpoints` 更短

### 6. 不扩新命令域

不要新增：

1. `edge.curve.*`
2. `edge.endpoint.*`
3. `edge.handle.*`

统一原则：

1. 结构更新走 `edge.update`
2. 中间路径点编辑走 `edge.path.*`

## 最终模型

### 1. EdgeType

公共模型建议收敛为：

```ts
export type EdgeType =
  | 'linear'
  | 'step'
  | 'curve'
  | 'custom'
```

说明：

1. 公共层不再暴露 `bezier`
2. 内部即使继续用 bezier 数学实现，也只是实现细节
3. toolbar、read、命令、文档统一都使用 `curve`

### 2. EdgeEnd

```ts
export type EdgeEnd =
  | {
      kind: 'node'
      nodeId: NodeId
      anchor?: EdgeAnchor
    }
  | {
      kind: 'point'
      point: Point
    }
```

说明：

1. `node` 表示吸附到节点
2. `point` 表示自由端点
3. `anchor` 只属于 `node`

### 3. EdgePath

```ts
export type EdgePath = {
  points?: Point[]
}
```

说明：

1. `points` 只存真实路径点
2. 不存段上的插入点
3. 所有类型的 edge 都可以使用这组点

### 4. Edge

```ts
export interface Edge {
  id: EdgeId
  source: EdgeEnd
  target: EdgeEnd
  type: EdgeType
  path?: EdgePath
  style?: EdgeStyle
  label?: EdgeLabel
  data?: Record<string, unknown>
}
```

## 命名与 API

### 1. 命名原则

所有公共命名尽量满足：

1. 短
2. 清楚
3. 不重复
4. 不暴露实现细节

建议统一：

1. `routing` -> `path`
2. `endpoints` -> `ends`
3. `insertAtPoint` -> `insert`
4. `selectedEndpoints` -> `selectedEnds`
5. `EdgeRouting` -> `EdgePath`
6. `EdgeEndpoint` -> `EdgeEnd`

### 2. 最终命令 API

```ts
instance.commands.edge.create(payload)
instance.commands.edge.update(id, patch)
instance.commands.edge.updateMany(updates)
instance.commands.edge.delete(ids)
instance.commands.edge.order.set(ids)
instance.commands.edge.order.bringToFront(ids)
instance.commands.edge.order.sendToBack(ids)
instance.commands.edge.order.bringForward(ids)
instance.commands.edge.order.sendBackward(ids)

instance.commands.edge.path.insert(edgeId, point)
instance.commands.edge.path.move(edgeId, index, point)
instance.commands.edge.path.remove(edgeId, index)
instance.commands.edge.path.clear(edgeId)
```

说明：

1. endpoint 更新走 `edge.update`
2. 中间路径点编辑走 `edge.path.*`
3. `clear` 比 `reset` 更直观，因为这里只有路径点，不再区分 auto/manual route

例如：

```ts
instance.commands.edge.update(edgeId, {
  target: {
    kind: 'point',
    point: { x: 400, y: 240 }
  }
})

instance.commands.edge.path.insert(edgeId, { x: 320, y: 160 })
instance.commands.edge.path.move(edgeId, 1, { x: 340, y: 180 })
instance.commands.edge.path.remove(edgeId, 1)
```

### 3. 不建议的 API

下面这些都不建议存在：

1. `edge.routing.insertAtPoint`
2. `edge.route.insert`
3. `edge.endpoint.set`
4. `edge.curve.move`
5. `edge.curve.reset`

原因：

1. 名字长
2. 概念变多
3. 命令面膨胀
4. 已经不符合最终的 `end / path / type` 模型

## Read 模型

### 1. 目标

read 层不应该假设两端都来自 node。

read 的职责应该是：

1. 把 document edge 解析成可渲染的 edge item
2. 对 `node` end 解算 anchor / point
3. 对 `point` end 直接透传 point
4. 对 `path.points` 直接透传

### 2. 建议结构

```ts
export type ResolvedEdgeEnd = {
  end: EdgeEnd
  point: Point
  anchor?: EdgeAnchor
}

export type EdgeEnds = {
  source: ResolvedEdgeEnd
  target: ResolvedEdgeEnd
}

export type EdgeItem = {
  id: EdgeId
  edge: Edge
  ends: EdgeEnds
}
```

说明：

1. 这里建议用 `ends`
2. `point` 是 path router 的统一输入
3. `anchor` 只有在 `node` end 下存在

### 3. router 输入

建议统一成：

```ts
type EdgePathEnd = {
  point: Point
  anchor?: EdgeAnchor
}
```

router 不关心这个点来自 node 还是 point。

它只关心：

1. 实际位置
2. 是否有 anchor side

### 4. path 解析规则

建议如下：

1. `linear`
   - 无 `path.points` 时，直接连 `source.point -> target.point`
   - 有 `path.points` 时，按折线依次通过这些点
2. `step`
   - 无 `path.points` 时，自动生成正交路径
   - 有 `path.points` 时，按这些点生成 step/smooth step 路径
3. `curve`
   - 把 `source + path.points + target` 作为锚点序列
   - 使用自动平滑算法生成曲线路径
4. `custom`
   - 由注册的 edge type definition 自己解释 `path / data`

关键点：

1. `curve` 不是单控制点模型
2. `curve` 是“锚点序列 + 平滑渲染”模型

## 交互模型

### 1. edge mode

edge mode 应该支持 4 种创建结果：

1. `node -> node`
2. `node -> point`
3. `point -> node`
4. `point -> point`

规则：

1. 在 node 上按下，起点是 `node`
2. 在空白处按下，起点是 `point`
3. 拖动经过 node 时，预览吸附成 `node`
4. 松手时若未吸附，终点写成 `point`

### 2. reconnect

reconnect 规则与创建一致：

1. 从 endpoint handle 开始拖
2. 靠近 node 时预览为 `node`
3. 松手在空白处时，改成 `point`

### 3. path handles

所有 edge 统一共享两类 UI handle：

1. `anchor handle`
2. `insert handle`

其中：

1. `anchor handle` 是空心点，代表真实 `path.points`
2. `insert handle` 是实心点，代表段上的插入点

行为：

1. 拖动空心点：移动现有 `path.points[index]`
2. 双击空心点或删除键：删除现有路径点
3. 拖动实心点：先插入一个新路径点，再进入拖动
4. 点击实心点：也可以直接插入新路径点

### 4. 不同类型的交互差异

`linear`

1. 显示 path points
2. 渲染为折线

`step`

1. 显示 path points
2. 渲染为正交/肘形路径

`curve`

1. 也显示 path points
2. 渲染为平滑曲线
3. 不再显示单独“曲线控制柄”

## React 视图收敛

### 1. UI 统一暴露 path handles

React overlay 层建议统一成：

```ts
type EdgePathHandle =
  | {
      kind: 'anchor'
      edgeId: EdgeId
      index: number
      point: Point
      active: boolean
    }
  | {
      kind: 'insert'
      edgeId: EdgeId
      segment: number
      point: Point
    }
```

说明：

1. `anchor` 是 document 真相
2. `insert` 是 UI 派生物
3. overlay 组件只知道“显示什么点”，不需要知道 curve/step 的业务细节

### 2. insert handle 的来源

`insert` handle 不入库。

它由当前 path 序列派生：

1. `source -> first`
2. `path[i] -> path[i + 1]`
3. `last -> target`

每一段各自产生一个 insert handle。

### 3. connect session state

建议把 connect state 收敛成统一端点草稿：

```ts
type EdgeDraftEnd =
  | {
      kind: 'node'
      nodeId: NodeId
      anchor: EdgeAnchor
      point: Point
    }
  | {
      kind: 'point'
      point: Point
    }
```

然后 connect session 只处理：

1. `from`
2. `to`
3. `preset`
4. `reconnect`

不要再保留 `nodeId? / anchor? / pointWorld?` 这种松散结构。

## Toolbar 与产品词汇

### 1. toolbar preset

toolbar 层继续保持：

1. `Straight`
2. `Elbow`
3. `Curve`

对应公共类型：

1. `linear`
2. `step`
3. `curve`

### 2. 不再保留公共 `bezier`

如果内部路径数学继续复用 bezier 算法，可以保留实现函数名；
但公共模型、toolbar preset、命令语义、read 语义都不应该再出现 `bezier`。

## Engine 与 Core 职责

### 1. core

core 负责：

1. `Edge` 类型定义
2. `end / path / type` 的纯数据规则
3. `resolveEdgeEnd`
4. `getEdgePath`
5. path 点增删改 patch 生成
6. curve 的平滑路径算法

### 2. engine

engine 负责：

1. `edge.create / update / delete / order / path.*`
2. document 校验
3. read projection 产出 `EdgeItem`

### 3. react

react 负责：

1. edge mode 创建交互
2. reconnect 交互
3. path handles 渲染与拖动
4. toolbar preset 选择

## 反模式

下面这些都应该避免：

1. 继续要求 `source.nodeId` 和 `target.nodeId` 必填
2. 用单独 `curve.point` 建模曲线
3. 同时保留 `curve` 和 `bezier` 两套公共词汇
4. 新增 `edge.endpoint.*` 或 `edge.curve.*` 命令域
5. 把实心插入点写进 document
6. overlay 组件直接分支理解 curve 与 step 的领域规则

## 分阶段实施

### Phase 1：核心类型一步到位

目标：

1. 把 edge 公共模型改成 `end / path / type`
2. 公共 `EdgeType` 收敛为 `linear / step / curve / custom`
3. 公共层去掉 `routing / route / curve data`

改动：

1. `whiteboard-core` 类型定义
2. schema/defaults
3. edge core helpers
4. engine command types

验收：

1. 文档模型只有 `end / path / type`
2. 对外不再出现公共 `bezier`
3. 对外不再出现 `routing`
4. 对外不再出现独立 `curve` 数据模型

### Phase 2：read / router 收敛

目标：

1. read 支持 `node end` 和 `point end`
2. router 支持统一 `path.points`
3. curve 改成锚点序列平滑渲染

改动：

1. `resolveEdgeEnd`
2. `resolveEdgePath`
3. engine read projection
4. `EdgeItem.endpoints -> EdgeItem.ends`

验收：

1. 任意 edge 都能稳定解析 path
2. point end 不再依赖 node rect
3. curve 不再依赖单控制点

### Phase 3：engine 命令 API 收敛

目标：

1. 写命令名收短
2. endpoint 更新统一走 `update`
3. 中间路径点编辑统一走 `path.*`

改动：

1. `edge.routing.* -> edge.path.*`
2. `insertAtPoint -> insert`
3. `reset -> clear`
4. planner 适配新数据模型

验收：

1. `instance.commands.edge.path.insert(...)` 可用
2. `edge.update` 可直接写 `source/target`

### Phase 4：React edge mode 与 reconnect

目标：

1. 空白处可以起线
2. 空白处可以落线
3. reconnect 可拖成 point end

改动：

1. connect session state 收敛
2. preview 统一基于 `EdgeDraftEnd`
3. commit 允许 point end

验收：

1. `node -> point`
2. `point -> node`
3. `point -> point`

都能正常创建。

### Phase 5：统一 path handles

目标：

1. anchor 与 insert 进入统一 UI 通道
2. curve / step / linear 共用同一套编辑语义

改动：

1. `useSelectedEdgeView`
2. `EdgeSelectedControls`
3. path drag
4. insert handle promotion

验收：

1. 空心点可编辑真实路径点
2. 实心点可升级为真实路径点
3. curve 的编辑体验与 Miro 同方向

## 最终结论

长期最优的 edge 方案应该固定为：

1. `source/target` 用 `EdgeEnd`
2. `path.points` 是唯一真实的中间几何数据
3. `curve` 只是渲染方式，不是独立数据模型
4. 空心点是持久化路径点
5. 实心点是段上的插入点，不入库
6. 公共 `EdgeType` 用 `linear / step / curve / custom`
7. 公共 API 用 `edge.path.insert/move/remove/clear`
8. endpoint 更新统一走 `edge.update`

这是目前最符合 Miro 路径编辑语义、同时又最少概念、最容易长期收敛的一套模型。
