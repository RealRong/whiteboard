# Selection Policy 与 Edge Route 最终设计

## 结论

当前 `packages/whiteboard-react/src/features/selection/gesture.ts` 和 `packages/whiteboard-react/src/features/edge/hooks/*` 的复杂度，根因不是“hook 太多”，而是两条链都缺少一层稳定的一等模型：

- `selection`
  - 缺一层纯同步的 `policy`
- `edge`
  - 缺一层正式的 `route + resolved view`

长期最优方案不是继续把 React hook 拆得更碎，也不是把所有交互规则都塞进 engine，而是：

- `selection policy`
  - 放在 `whiteboard-react` runtime 侧
  - 纯同步、纯计算、无副作用
  - 输入 `hit + selection + role + edit field`
  - 输出 `tap / drag / hold` 的数据计划
- `edge route`
  - 放在 `whiteboard-core`
  - 成为 edge 的正式文档语义
  - core 负责把 `route` 解成路径、命中段、编辑句柄、能力信息
  - React 只负责 session、preview 和输入绑定

一句话说：

- `gesture` 应该只是执行器
- `edge hook` 应该只是输入适配器
- 关系规则和路径语义都不应该继续散落在 React 行为层临时拼装

## 本次修正的历史口径

这份文档明确修正旧稿里几条已经被我们否掉的设计：

- 不采用 `frame local editing domain`
- 不采用 `enter frame 后 selection scope 改变` 这套模型
- `marquee` 不再携带 `clear`
- `marquee` 不再携带 `scope`
- `marquee` 不再携带 `edgeFilter`
- 不再引入“nodes 候选集 / candidate set”这类中间概念
- `edge` 的 marquee 语义不再依赖“端点是否都在 scope 内”

本文以“不在乎兼容成本、优先长期最优”为前提，直接给出最终口径。

## 前提

本文明确采用下面这些前提：

- 不在乎兼容成本
- 不保留旧模型双轨
- 优先长期最优
- 优先概念少
- 优先 API 短
- 优先职责边界清楚
- 优先让 UI 层只做输入绑定和渲染

## 一. Selection 当前问题

当前 `gesture.ts` 虽然已经收敛过一轮，但仍然混了三层职责：

- 读取上下文
  - 当前 `hit`
  - 当前 `selection`
  - 当前 node `role`
  - 当前可编辑 field
- 关系策略
  - 点击 child 最终选 child 还是选 group
  - 当前 selection 是否接管 drag
  - `body / shell / background` 各自怎么解释
  - repeat click 是否进入 edit
  - hold 时启动哪种 marquee
- 会话执行
  - `press.start`
  - `drag.start`
  - `marquee.start`

真正不该留在 `gesture.ts` 的，是中间这层“关系策略”。

### 为什么这层不该放 engine

因为它依赖的是 UI 语义，而不是文档语义：

- `field`
- `repeat click`
- `hold`
- `chrome`
- `editable target`
- `tool === select`

这些都不是 engine 文档模型的一部分，所以它不能下沉到 engine。

### 为什么这层也不该继续留在 gesture

因为 `gesture` 的职责应该是：

- 处理 pointer 生命周期
- 启动 session
- 执行已经决定好的动作

它不应该继续现场做 group/frame/selection/edit 的关系裁决。

## 二. Selection 最终原则

### 1. Selection 是全局几何行为

长期最优里，`selection` 和 `marquee` 默认都是全局几何行为，而不是局部域行为。

也就是说：

- 命中判断按真实几何做
- marquee 按真实几何做
- edge 是否被选中按路径几何做
- 不因为 frame 而切出一个持续性的局部 selection 域

这条原则非常重要，因为它直接决定了很多概念都可以删掉。

### 2. Frame 不是局部编辑域

`frame` 的长期最优职责是：

- 组织
- 展示
- 导出 / copy 的聚合目标
- 标题与边框级交互

但它不是一个持续性的“进入后只操作内部对象”的局部编辑域。

因此：

- `frame body`
  - 一律按 background 处理
- `selection`
  - 不因为 frame 改成局部域
- `marquee`
  - 不因为 frame 改成局部域
- `edge`
  - 不因为 frame 多一层 endpoint filter

如果未来真的需要“局部编辑模式”，也应该是单独能力，不应污染默认 selection 模型。

### 3. Group 是关系规则，不是局部域

`group` 对 selection 的影响主要体现在关系规则上：

- 点中 group 内 child，最终选 child 还是选 group
- 已处于 group 相关 selection 时，drag 该拖 child 还是拖聚合 selection

但这仍然是 `policy` 问题，不是“切换到局部选择域”问题。

### 4. Marquee 只表达几何选择

`marquee` 的职责应该非常纯：

- `touch`
  - 碰到即算
- `contain`
  - 必须完整包住才算

除此以外，不再让它承载别的产品语义。

特别是：

- 是否先清空当前 selection
  - 这是 `hold / tap / drag` 的流程规则，不属于 marquee 本体
- 限定某个 node 集合才参与
  - 这本质上是局部域模型，会把复杂度重新塞回来
- edge 是否可被选中
  - 这应由统一几何规则决定，不应再额外加 `edgeFilter`

## 三. Selection 最终边界

### 1. 放置位置

建议新增：

- `packages/whiteboard-react/src/runtime/selection/policy.ts`

它属于 runtime，因为它依赖：

- `instance.read.*`
- 当前 selection 快照
- node `role`
- `pick`

但它不依赖 React 组件生命周期。

### 2. 最小正式概念

只保留两个概念：

- `SelectionPressContext`
- `SelectionPressPlan`

不再保留：

- `owner`
- `subject`
- `action`
- `candidate`
- `domain`
- `scope`

这些概念要么是伪抽象，要么只是旧模型为了兜局部域而引入的中间补丁。

### 3. Context

```ts
type SelectionPressContext = {
  input: GestureDown
  mode: SelectionMode
  selected: {
    nodeIds: readonly NodeId[]
    edgeIds: readonly EdgeId[]
    box?: Rect
  }
}
```

这里故意保持最小：

- `input`
  - 带真实命中结果
- `mode`
  - 表达 replace / add / toggle
- `selected`
  - 仅表达当前已选内容

不把 `frame scope / candidate / edgeFilter / local domain` 放进 context。

### 4. Plan

`plan` 应该是纯数据，而不是闭包。

```ts
type SelectionPressPlan = {
  chrome: boolean
  tap?: SelectionIntent
  drag?: SelectionIntent
  hold?: SelectionIntent
}

type SelectionIntent =
  | { kind: 'clear' }
  | { kind: 'select'; selection: SelectionInput; match?: TapMatch }
  | { kind: 'edit'; nodeId: NodeId; field: EditField; match: TapMatch }
  | {
      kind: 'move'
      frame: Rect
      anchorId: NodeId
      nodeIds: readonly NodeId[]
      edgeIds: readonly EdgeId[]
      select?: SelectionInput
    }
  | {
      kind: 'marquee'
      match: 'touch' | 'contain'
      mode: SelectionMode
      base: SelectionInput
    }
```

这里的关键点是：

- `marquee` 只保留几何所需的最小字段
- 不再有 `clear`
- 不再有 `scope`
- 不再有 `edgeFilter`

换句话说：

- “要不要先 clear”
  - 属于 press policy 的分流结果
- “哪些对象参与”
  - 由统一的 hit / 几何规则决定
- “edge 是否应计入”
  - 由统一的边几何规则决定

而不是把这些额外状态塞进 `marquee intent`。

### 5. Gesture 最终职责

`packages/whiteboard-react/src/features/selection/gesture.ts` 最终只保留：

- `ctx = readSelectionPressContext(instance, input)`
- `plan = instance.read.selection.press(ctx)`
- `runSelectionPressPlan(plan)`

也就是说，这个文件长期最优应该只做两件事：

- 调 policy
- 跑 session

## 四. Selection Policy 应负责什么

### 应负责

- 点击 group 内 child 时，最终选 child 还是选 group
- 当前 selection box 是否可交互
- `body / shell / background` 的默认行为
- repeat click 是否进入 edit
- hold 时是否转成 `contain marquee`
- node drag 是否升级成 selection drag
- 哪些场景需要临时隐藏 chrome

### 不应负责

- pointer capture
- auto pan
- drag preview
- marquee session 生命周期
- DOM target 忽略规则本身
- frame local domain
- edge endpoint scope 过滤

### 一条关键边界

`policy` 可以根据 `hit + selection + role` 决定：

- 这次 `tap / drag / hold` 应该做什么

但它不应该再发明新的“局部世界”。

否则 selection 这条链会重新膨胀出：

- 局部域
- 候选集
- edge 端点过滤
- frame enter 状态

这些本质上都不是默认白板选择模型的核心概念。

## 五. Selection 与 Edge 的统一几何规则

### 1. Node

node 的 marquee 规则只看几何：

- `touch`
  - 触碰即选中
- `contain`
  - 完整包住才选中

### 2. Edge

edge 的 marquee 规则也只看几何：

- marquee 区域碰到 edge 路径
  - edge 即可进入结果
- 不再要求 source / target 都位于某个 scope 内
- 不再要求 edge 与 node 集合做额外从属过滤

这条规则更接近长期稳定的白板语义，因为 edge 本来就是图上的一等对象，不应再被临时降成“只有端点符合某个域才参与”的从属对象。

### 3. Frame

frame 本身的默认交互面是：

- `title`
- `border`

`frame body` 一律按 background 解释。

所以：

- 在 frame body 上开始 marquee
  - 本质上就是在背景上开始 marquee
- frame 不会把 selection 切成局部域

## 六. Selection API 建议

为了不新增顶层 namespace，建议挂在 `read.selection` 下：

```ts
instance.read.selection.press(input)
instance.read.selection.doubleClick(nodeId, target)
```

或者更短一点：

```ts
instance.read.selection.down(input)
instance.read.selection.open(nodeId, target)
```

长期更建议第一种，因为 `press` 语义更清楚。

## 七. Edge 当前问题

当前 edge React 侧之所以复杂，不只是 hook 多，而是 `edge.path.points` 同时承担了三种职责：

- 文档里保存的用户意图
- router 的输入
- UI 的可编辑控制点

这会导致：

- React 自己推导哪些点是 anchor、哪些点是 insert
- React 自己判断 edge 能不能 move
- `linear / step / curve` 对 path points 的解释不统一
- `preview.patch` 只是 patch 级，而不是 route/view 级

最明显的症状是：

- [useSelectedEdgeView](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts)
  - 在用 `edge.path.points + getEdgePath().segments` 反推 UI 句柄
- [useEdgeDragInput](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/edge/hooks/useEdgeDragInput.ts)
  - 自己在判断 `canMoveEdge`
- [useEdgePathInput](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/edge/hooks/useEdgePathInput.ts)
  - 在直接驱动 `path.insert/move/remove`

说明真正缺的不是更多 hook，而是缺一个统一的 `edge route` 模型。

## 八. Edge 最终模型

### 1. 文档层

建议把当前 `edge.path` 的角色收敛成 `route`。

```ts
type EdgeRoute =
  | {
      kind: 'auto'
    }
  | {
      kind: 'manual'
      points: Point[]
    }
```

文档侧 edge 只保留：

- `source`
- `target`
- `route`

其中：

- `auto`
  - 说明中间路径完全由 router 自动推导
- `manual`
  - 说明中间点是用户显式编辑意图

### 2. Router 不再直接读裸 path points

core 内部统一改成：

```ts
resolveEdgePath({
  edge,
  source,
  target
})
```

它只读：

- endpoints
- route
- edge.type

而不是让不同 router 各自猜测 `edge.path.points` 的意义。

### 3. Core 提供 resolved view

建议在 `whiteboard-core` 增加纯函数：

```ts
resolveEdgeView(input): EdgeView
```

返回：

```ts
type EdgeView = {
  ends: {
    source: ResolvedEdgeEnd
    target: ResolvedEdgeEnd
  }
  path: {
    points: readonly Point[]
    segments: readonly EdgeSegment[]
    svgPath: string
    label?: Point
  }
  handles: readonly EdgeHandle[]
  can: {
    move: boolean
    reconnectSource: boolean
    reconnectTarget: boolean
    editRoute: boolean
  }
}
```

其中：

- `path`
  - 只负责渲染和 hit test
- `handles`
  - 只负责编辑语义
- `can`
  - 只负责能力判断

React 不再自行拼这些信息。

## 九. Edge Handle 模型

建议统一成三类：

```ts
type EdgeHandle =
  | {
      kind: 'end'
      end: 'source' | 'target'
      point: Point
    }
  | {
      kind: 'anchor'
      index: number
      point: Point
      mode: 'fixed' | 'grow'
    }
  | {
      kind: 'insert'
      insertIndex: number
      point: Point
    }
```

说明：

- `end`
  - 两端重连
- `anchor`
  - 已存在的 route 点
- `insert`
  - 中段新增点

如果未来保留 Miro 那套“实心/空心点”，直接映射成：

- `grow`
  - 拖完自己转成 `fixed`
  - 两边新增 `grow`
- `fixed`
  - 只是普通已有点

这样 UI 就不需要再自己发明“实心/空心”的临时状态解释。

## 十. Edge Commands 最终建议

命令入口建议统一挂到 `edge.route` 下：

```ts
instance.commands.edge.route.insert(edgeId, point)
instance.commands.edge.route.move(edgeId, index, point)
instance.commands.edge.route.remove(edgeId, index)
instance.commands.edge.route.clear(edgeId)
```

保留：

```ts
instance.commands.edge.move(edgeId, delta)
instance.commands.edge.update(edgeId, patch)
```

但规则要明确：

- `edge.move`
  - 只适用于 `can.move === true`
  - 一般就是 source/target 都是 point 的 detached edge
- `edge.route.*`
  - 只负责 route 编辑
- `edge.update`
  - 只做基础 patch，不承载 UI 语义

## 十一. React Edge 最终职责

React 侧 edge hooks 最终应该只剩三类：

- `connect`
  - 处理 `pointerdown / move / up`
  - 产出 source/target preview
- `route`
  - 处理 handle drag
  - 调 `edge.route.*`
- `drag`
  - 只处理 `can.move === true` 的 detached edge

也就是说：

- `canMoveEdge`
  - 不该由 React 自己推导
- insert handle 的位置
  - 不该由 React 自己算
- `anchor / grow / fixed` 的句柄类型
  - 不该由 React 自己判断

这些都应该来自 `read.edge.view(id)`。

## 十二. Preview 最终边界

当前 `instance.internals.edge.preview.patch/hint` 这个边界本身是对的，不需要推翻。

但长期最优应该统一成“预览写 route/view，而不是写零散 patch 语义”：

```ts
instance.internals.edge.preview = {
  patch,
  hint,
  clear()
}
```

保留这个 API 形状即可。

只是上层写入时应更贴近 `route/view`：

- reconnect
  - 写 endpoints patch
- route drag
  - 写 route patch
- body drag
  - 写 move patch

不要让 preview 层承载句柄推导。

## 十三. 建议落点

### React 侧

- `packages/whiteboard-react/src/runtime/selection/policy.ts`
  - 纯 selection policy
- `packages/whiteboard-react/src/features/selection/gesture.ts`
  - 只执行 plan
- `packages/whiteboard-react/src/runtime/read/selection.ts`
  - 暴露 `press(...)` 入口

### Core 侧

- `packages/whiteboard-core/src/edge/types.ts`
  - 引入 `EdgeRoute`
- `packages/whiteboard-core/src/edge/commands.ts`
  - `route.insert/move/remove/clear`
- `packages/whiteboard-core/src/edge/view.ts`
  - `resolveEdgeView`
- `packages/whiteboard-core/src/edge/path.ts`
  - router 统一只读 route

### Engine 侧

- `packages/whiteboard-engine/src/write/translate/edge.ts`
  - 直接翻译 `edge.route.*`
- `packages/whiteboard-engine/src/read/store/edge.ts`
  - 继续负责 ends 缓存
  - 但不需要承担 handles 语义

## 十四. 分阶段实施

### 阶段 1. 抽 selection policy

目标：

- `gesture.ts` 只剩“读 ctx -> 调 policy -> run”

完成标志：

- group / frame / selection / edit 的关系规则不再分散在 `gesture.ts`
- `gesture.ts` 不再负责策略判断，只负责执行
- `marquee intent` 里不再残留 `clear / scope / edgeFilter`

### 阶段 2. route 正名

目标：

- `edge.path` 文档语义收敛成 `edge.route`

完成标志：

- 所有 router 都只读 `route`
- `path.points` 不再同时承担意图和渲染语义

### 阶段 3. core 输出 edge view

目标：

- core 直接返回 `path + handles + can`

完成标志：

- `useSelectedEdgeView` 不再自己拼 handles
- React 不再自己判断 `canMoveEdge`

### 阶段 4. React edge hook 瘦身

目标：

- React edge hook 只保留 connect / route / drag 三类输入绑定

完成标志：

- React 不再自行解释 route 点语义
- preview 只写 patch，不再推导 handles
