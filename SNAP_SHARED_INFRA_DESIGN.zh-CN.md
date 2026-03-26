# Snap 共基建长期设计

## 结论

`packages/whiteboard-react/src/runtime/interaction/snap.ts` 里的 `SnapRuntime` 不能直接复用到 `packages/whiteboard-react/src/features/edge/hooks/useEdgeConnectInput.ts`。

原因不是实现方式不同，而是两类问题从根上就不是同一个 solver：

- `node snap`
  - `rect -> rect`
  - 候选是对齐线
  - 输出是几何修正 + guides
- `edge connect snap`
  - `point -> connect target`
  - 候选是可连接 node
  - 输出是连接目标 + hint

长期最优不是造一个大一统 `snap.solve(kind)`，而是：

- 共享底层基建
- 保留两个领域 solver
- React 侧只保留很薄的 runtime 装配和 preview 写入

一句话总结：

- 共用的是 `snap infra`
- 不是把所有 snap 问题压成一个 runtime

---

## 一. 当前问题

目前这条链路已经有两个相似但分散的实现：

- `packages/whiteboard-react/src/runtime/interaction/snap.ts`
  - 负责 node move / resize 的 snap
- `packages/whiteboard-react/src/features/edge/hooks/connect/math.ts`
  - 负责 edge connect / reconnect 的目标吸附

这两边现在重复了同一类底层工作：

- 基于 `zoom` 把屏幕阈值换成世界坐标阈值
- 根据阈值构造 query rect
- 查询候选对象
- 过滤不可参与的候选
- 在候选里挑最近的一个结果

但它们又没有重复到可以直接合并成一个 solver，因为它们的领域语义不同：

- node snap 关心的是边线对齐
- edge snap 关心的是连接锚点

所以当前复杂度的根因不是“文件放错地方”，而是：

- 共享基建没有被正式抽出来
- edge connect solver 还停留在 React 行为层

---

## 二. 为什么不能直接复用当前 SnapRuntime

### 1. 输入模型不同

`node snap` 的输入天然是几何草稿：

```ts
{ rect, source?, excludeIds?, minSize? }
```

`edge connect snap` 的输入天然是一个世界坐标点：

```ts
{ pointWorld }
```

如果硬合成：

```ts
solve({ kind: 'move' | 'resize' | 'connect', ... })
```

会立刻带来新的复杂度：

- 输入 union 膨胀
- 返回 union 膨胀
- 调用方分支膨胀
- 内部实现分支膨胀

这不是收敛，是把两种问题重新耦合。

### 2. 候选模型不同

`node snap` 的候选是：

- `SnapCandidate`
- 本质上是若干条可对齐线

`edge connect snap` 的候选是：

- 可连接 node
- 需要进一步解析成 outline anchor

两者的数据结构、筛选规则、距离计算都不同。

### 3. 输出模型不同

`node snap` 需要：

- 修正后的 `Rect` 或 `ResizeUpdate`
- `guides`

`edge connect snap` 需要：

- `nodeId`
- `anchor`
- `pointWorld`

也就是：

- 一个是“几何修正结果”
- 一个是“连接目标结果”

### 4. 视觉反馈不同

`node snap` 的视觉反馈天然就是 `guides`，因此可以由 runtime 自带一份 `guides store`。

`edge connect snap` 的视觉反馈是：

- hover / connect hint
- reconnect patch

这些更适合留在：

- `instance.internals.edge.preview`

而不是被 `snap` runtime 一起吞进去。

---

## 三. 哪些底层基建应该共用

长期最优里，下面这些应该抽成共用基建：

### 1. 阈值换算

需要一套纯函数，负责把屏幕尺度配置换成世界坐标尺度：

- `screen -> world threshold`
- 带最小值保护
- 不掺业务语义

例如：

```ts
resolveWorldThreshold(valueScreen, zoom)
```

这个函数不属于 node，也不属于 edge，属于通用交互几何基础。

### 2. query rect 构造

无论是：

- `rect snap`
- `point snap`

底层都会做一件事：

- 用阈值扩出一个查询范围

因此可以共享：

- `expandRectByThreshold(rect, threshold)`
- `rectFromPoint(point, radius)`

其中：

- `expandRectByThreshold` 现在已经偏 node 侧
- `rectFromPoint` 适合补到共用层

### 3. 候选查询与过滤

底层都需要：

- 按 query rect 查一批候选
- 排除不合法候选

共享的应该是基础流程，而不是统一候选类型。

也就是说共享的是：

- query by rect
- filter by predicate
- exclude ids

不共享的是：

- candidate 的具体结构

### 4. 最近结果挑选

两边最终都在做：

- 遍历候选
- 算 distance
- 选最近且有效的一个

这层可以抽成非常薄的基础 helper，例如：

- `pickNearest`
- `pickNearestWithin`

它只负责“从一组评分结果里选最优”，不负责理解 node / edge 语义。

### 5. 纯几何锚点解析

`edge connect` 自己的专属 solver 应继续复用 core 里的：

- `getAnchorFromPoint`
- `getAutoAnchorFromRect`

这类函数本来就应该在 `whiteboard-core`。

---

## 四. 哪些东西不应该共用

下面这些不要强行统一：

### 1. solver 本身

不要做：

```ts
snap.solve({ kind: 'move' | 'resize' | 'connect' })
```

这会让 API 变短，但概念更多、实现更重、类型更差。

### 2. preview store

`guides` 和 `edge hint` 不是同一种视觉模型。

不要为了“统一”而做一个：

```ts
preview: { kind: 'guides' | 'hint' | 'patch' }
```

这种抽象没有增益，只会把读写逻辑变绕。

### 3. session 生命周期

不要把：

- drag
- resize
- edge create
- edge reconnect

统一成一个 snap session。

`snap` 只负责吸附求解，不负责交互会话。

### 4. React hook 入口

不要把 node / edge 两条交互链都塞进一个大 hook。

长期最优里：

- session 仍然各自独立
- 只共享底层纯计算能力

---

## 五. 长期最优分层

### 第一层: core shared infra

建议新增一层非常薄的共用基础，位置优先考虑：

```ts
packages/whiteboard-core/src/snap.ts
```

这里放的不是业务 solver，而是无领域偏向的纯函数，例如：

- `resolveWorldThreshold`
- `rectFromPoint`
- `pickNearest`

这里不要放：

- guides store
- edge hint store
- React runtime

这里也不要再拆成：

- `threshold.ts`
- `rect.ts`
- `nearest.ts`

长期最优里，这层只有少量纯函数，单文件更清楚。

### 第二层: core domain solver

各领域继续保留各自 solver：

- `packages/whiteboard-core/src/node/snap.ts`
- `packages/whiteboard-core/src/edge/connect.ts`

其中：

- `node/snap.ts`
  - 继续负责 move / resize 对齐
- `edge/connect.ts`
  - 负责 point -> connect target 的正式求解

`packages/whiteboard-react/src/features/edge/hooks/connect/math.ts` 里的核心求解逻辑，长期最优应该下沉到这里。

React 不该继续自己维护：

- query rect
- threshold
- nearest target 选择

React 只需要把 runtime 依赖喂进去：

- `zoom`
- `config`
- `query`
- `canConnect`

### 第三层: react runtime 装配

React 侧只负责把：

- `core solver`
- `instance.read`
- `instance.viewport`
- `config`

组装成很薄的可调用能力。

最小推荐形态：

```ts
instance.internals.snap = {
  node: {
    guides,
    move(input),
    resize(input),
    clear()
  },
  edge: {
    connect(pointWorld)
  }
}

instance.internals.edge.preview = {
  hint,
  patch,
  clear()
}
```

这里的关键点是：

- `node snap`
  - 自带 `guides`
- `edge snap`
  - 只负责求连接目标
- `edge preview`
  - 继续由 edge 自己维护

这样边界最清楚。

### 第四层: feature session

feature hook 只做：

- pointer 输入绑定
- session 生命周期
- 调用 runtime
- 写 preview
- commit command

例如：

- `useEdgeInput`
  - 负责 passive hover
- `useEdgeConnectInput`
  - 负责 active create / reconnect

但它们不再自己实现完整 snap solver。

---

## 六. 推荐 API

### 1. Core shared helpers

建议保持极薄，不提前泛化：

```ts
type Threshold = number

resolveWorldThreshold(screen: number, zoom: number): Threshold
rectFromPoint(point: Point, radius: number): Rect
pickNearest<T>(items: readonly T[], readDistance: (item: T) => number | undefined): T | undefined
```

这里只保留纯几何基础与最小选择工具。

### 2. Core edge solver

建议新增正式 API：

```ts
type EdgeConnectCandidate = {
  nodeId: NodeId
  node: Pick<Node, 'type' | 'data'>
  rect: Rect
  rotation: number
}

type EdgeConnectInput = {
  pointWorld: Point
  candidates: readonly EdgeConnectCandidate[]
  threshold: number
  canConnect?: (candidate: EdgeConnectCandidate) => boolean
  anchorOffset?: number
  anchorSnapMin?: number
  anchorSnapRatio?: number
}

type EdgeConnectResult = {
  nodeId: NodeId
  anchor: EdgeAnchor
  pointWorld: Point
}

resolveEdgeConnectTarget(input: EdgeConnectInput): EdgeConnectResult | undefined
```

这里不引入 session，也不引入 preview。

### 3. React runtime API

推荐 API 保持短而明确：

```ts
instance.internals.snap.node.move({ rect, excludeIds?, allowCross?, disabled? })
instance.internals.snap.node.resize({ rect, source, minSize?, excludeIds?, disabled? })
instance.internals.snap.node.clear()

instance.internals.snap.edge.connect(pointWorld)
```

不要做：

- `instance.internals.snap.solve(...)`
- `instance.internals.snap.edge.update(...)`
- `instance.internals.snap.edge.session.*`

因为这些都在把 session 复杂度重新塞回 snap。

---

## 七. 为什么 edge connect solver 必须下沉到 core

### 1. 它已经是文档无关但领域稳定的纯规则

“给一个点，找到最近可连接 node 的合法 anchor”本身就是稳定的白板领域规则。

它不依赖 React，也不依赖 DOM。

既然如此，就不该继续藏在：

```ts
packages/whiteboard-react/src/features/edge/hooks/connect/math.ts
```

### 2. 它和 node outline / anchor 体系天然同域

目前 anchor 已经在 core：

- `getAnchorFromPoint`
- `getAutoAnchorFromRect`

继续把 connect target 求解也放进 core，领域会更完整。

### 3. 这样 React hook 才能真正变薄

理想状态下，`useEdgeConnectInput` 不再负责：

- 算 query rect
- 查 threshold
- 自己遍历 node entry
- 自己算 nearest target

它只应该负责：

- 从 pointer 读 world point
- 调 `instance.internals.snap.edge.connect(pointWorld)`
- 写 `instance.internals.edge.preview.hint`
- 最后 commit `instance.commands.edge.reconnect(...)` 或 `create(...)`

---

## 八. 最终推荐目录

长期最优建议是：

```ts
packages/whiteboard-core/src/
  snap.ts

packages/whiteboard-core/src/node/
  snap.ts

packages/whiteboard-core/src/edge/
  anchor.ts
  connect.ts

packages/whiteboard-react/src/runtime/interaction/
  snap.ts

packages/whiteboard-react/src/features/edge/
  preview.ts
```

这里的原则是：

- 共享纯基础放 `core/snap`
- 领域规则放 `core/node` 与 `core/edge`
- React 只保留装配与预览

不要在 React 侧再单独长出一套 `connect/math.ts` 型 solver。

---

## 九. 分阶段实施

### 阶段 1: 抽纯基础

把这几类能力从现有实现中抽出：

- 世界坐标阈值换算
- `point -> query rect`
- 最近结果选择 helper

目标：

- 让 node snap 与 edge connect 至少共享同一层基础工具

### 阶段 2: 补 core edge solver

新增：

- `packages/whiteboard-core/src/edge/connect.ts`

把当前 `connect/math.ts` 中真正属于 solver 的部分迁进去。

目标：

- React 不再拥有 connect 求解规则

### 阶段 3: React runtime 收口

在 React 侧提供一个很薄的调用入口：

```ts
instance.internals.snap.edge.connect(pointWorld)
```

目标：

- `useEdgeConnectInput`
  - 只保留 session
- `useEdgeInput`
  - 只保留 hover 预览调度

### 阶段 4: 删除临时重复实现

最终删除或压薄：

- `packages/whiteboard-react/src/features/edge/hooks/connect/math.ts`

目标：

- snap 领域规则只在 core 保留一份

---

## 十. 明确不采用的方案

### 1. 一个大一统 `snap.solve(kind)`

不采用。

原因：

- 概念更多
- 类型更差
- runtime 更重
- 不利于长期维护

### 2. 把 edge preview 一起塞进 snap runtime

不采用。

原因：

- `guides` 和 `hint/patch` 不是同一类结果
- 会让 `snap` 和 `edge preview` 重新耦合

### 3. 继续让 React hook 自己做 connect 求解

不采用。

原因：

- 规则分散
- 不可复用
- 难以统一命名和语义

---

## 十一. 最终口径

长期最优的统一口径是：

- `node snap` 和 `edge connect snap` 不合并 solver
- 二者共享 `snap infra`
- `edge connect` 的正式 solver 下沉到 `whiteboard-core`
- React 侧只保留薄装配与 preview
- `guides` 继续属于 `node snap runtime`
- `hint / patch` 继续属于 `edge preview`

最终效果是：

- 概念更少
- API 更短
- 职责更清楚
- React hook 更薄
- 底层能力可以真正复用
