# WHITEBOARD_SELECTION_FINAL_MODEL_REFACTOR_PLAN.zh-CN

## 文档目标

这份文档只讨论一件事：

- `selection` 以及它下面现在挂着的这些相关链路，长期最优到底应该怎么设计

这里的“相关链路”包括：

- selection state
- selection read
- selection commands
- selection press
- selection drag
- selection marquee
- selection transform
- selection box
- selection overlay
- 目前仍挂在 selection 下面的 mindmap drag

这份文档不考虑兼容和过渡。
只讨论最终形态。

---

## 最终结论

当前 `selection` 最大的问题不是某个函数写得不够短，而是：

- **selection 被做成了一个“把很多交互塞在一起的总入口”**

这会带来三个后果：

1. `selection` 既像文档状态，又像交互 owner，又像 UI snapshot，又像产品 feature 集合
2. 很多本应属于别的 domain 的东西，被挂在了 selection 名下
3. 读取、交互、预览、菜单能力、样式统计混在同一条线上，导致 selection 读起来越来越厚

长期最优里，selection 不应该是“一个大 feature”。

selection 的真实产品模型其实很简单：

1. 文档里当前选中了什么
2. 由此推导出的当前 selection 视图
3. 基于当前 selection 的通用交互

一句话概括：

- **selection 是一个文档域 + 一个通用交互域，不是所有“和选中有关的行为”的垃圾桶**

---

## 先说 selection 真正应该是什么

如果完全不看当前实现，只从产品与运行时模型出发，selection 长期最优应该只有三层。

### 第 1 层：持久 selection

这是文档级、稳定的、唯一的 selection 状态。

它只表达：

- 当前被选中的 node ids
- 当前被选中的 edge ids

也就是：

```ts
type SelectionTarget = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}
```

这就是 selection 的唯一持久状态。

不要再在 selection state 里塞：

- selection box
- selection capabilities
- selection style snapshot
- selection menu summary
- 临时 hover/preview

这些都不是 selection document state。

### 第 2 层：派生 selection 视图

这是 runtime read 层根据当前 selection 推导出来的只读视图。

它表达：

- 选中了哪些 node / edge 实体
- selection 的 kind
- 是否可 move / resize / scale
- 当前 selection box

也就是现在 `SelectionSummary` 这一层真正接近的东西。

但它长期最优里应该更纯，不要混入 UI 菜单导向的数据。

### 第 3 层：selection 通用交互

selection 只应该拥有这些通用行为：

- press
- tap
- move selected items
- marquee select
- selection box body drag

除此之外，凡是更具体、更产品化的行为，都不应该继续挂在 selection 本体下面。

---

## 当前 selection 的主要异味

下面把现状问题逐条说清楚。

---

## 1. `selection` 现在承载了太多不是它本体的东西

当前
[packages/whiteboard-editor/src/interactions/selection/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection/index.ts)
里，`selection` owner 同时在分发：

- transform
- mindmap
- press

这说明它不是一个清晰的 owner，而是一个总路由壳。

这不是长期最优。

因为这三件事不是同一种 domain：

- `press` 是 selection 通用交互
- `transform` 是当前选中集合的几何变换
- `mindmap drag` 是 mindmap 专有产品行为

把它们塞在一个 owner 下面，只会让 `selection` 继续膨胀。

长期最优里：

- `selection` 应只负责通用 selection 行为
- `transform` 应成为独立 owner
- `mindmap drag` 应从 selection 中彻底移出

---

## 2. `SelectionRead` 里混进了很多 React 菜单侧的数据

当前
[packages/whiteboard-editor/src/runtime/read/selection.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/read/selection.ts)
导出的 `SelectionSnapshot` 包括：

- `summary`
- `can`
- `types`
- `style`

这不是长期最优。

这里面只有 `summary` 真正属于 editor 核心 selection 读模型。

而下面这些：

- `can`
- `types`
- `style`

本质上都更接近：

- UI 菜单模型
- inspector/panel 模型
- toolbar 呈现模型

它们并不是 selection runtime 的核心语义。

它们应该去 React，或者至少去更靠近 UI 的 presentation selector。

否则 selection read 会永远变成一个“什么都顺手 derive 一下”的大杂烩。

长期最优里，editor 只应暴露：

- `read.selection.target`
- `read.selection.summary`

如有必要，再补一个非常窄的：

- `read.selection.box`

不要继续把菜单与 inspector 需要的所有派生数据塞进 editor selection read。

---

## 3. `SelectionPressPlan` 里还带着很多旧装配时代的字段

当前 core 的
[packages/whiteboard-core/src/selection/press.ts](/Users/realrong/whiteboard/packages/whiteboard-core/src/selection/press.ts)
里，`SelectionDragAction['move']` 仍然带着：

- `frame`
- `anchorId`
- `target`
- `nextSelection`

这不是长期最优。

这些字段里，真正稳定的语义只有：

- `target`
- `prepareSelection`

而：

- `frame`
- `anchorId`

都更像旧 editor 为了启动 drag session 提前塞进去的临时构件。

另外，`allowHold: boolean` 也是异味。

因为它没有表达：

- hold 之后具体要做什么

导致 editor `press.ts` 必须硬编码：

- hold 触发 contain marquee
- 并在开始前清 selection

这说明 press policy 还不够完整。

长期最优里，press policy 应该直接给出：

- release 要做什么
- drag 要做什么
- hold 要做什么

而不是只给一个 `allowHold` 布尔值，让 editor 自己猜。

---

## 4. `verifyNodeIds` 这类字段是中间层噪音

当前 tap action 里有：

- `verifyNodeIds`

这其实是在弥补一个问题：

- pointer up 是否仍然落在同一个有效 tap 目标上

这个问题本身是真实存在的。

但把它翻译成 `verifyNodeIds` 这种 transport 字段，不是长期最优。

长期最优里应该是：

- press session 保存自己的按下目标
- up 时用一个纯函数判断 release 是否仍匹配该按下目标

也就是说，这里需要的是：

- `matchSelectionRelease(...)`

而不是把“校验所需的 id 数组”一路塞进 action。

---

## 5. `marquee` 现在仍然偏 callback/controller 风格

当前
[packages/whiteboard-editor/src/interactions/selection/marquee.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection/marquee.ts)
里有：

- `MarqueeStartInput`
- `MarqueeState`
- `createMarqueeController`
- `onStart`
- `onChange`
- `onEnd`

这条线是能工作的，但不是长期最优。

问题在于：

- 它仍然是“构造一个 controller，再让 callback 驱动外部副作用”的风格

这会让 marquee 的主线不像一个 session，而像一个带回调的工具壳。

长期最优里，marquee 应该是：

- 一个很薄的 session
- `step` 直接返回当前 marquee rect
- editor/owner 再根据 rect 去查询命中的 items，写 overlay，写 selection

也就是：

- `marquee` 应从 callback/controller 风格收敛到 session/result 风格

---

## 6. `mindmap drag` 不应该继续算作 selection 的一部分

当前
[packages/whiteboard-editor/src/interactions/selection/mindmap.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection/mindmap.ts)
虽然挂在 selection 目录下，但它本质上不是 selection 通用行为。

它是：

- 仅对 mindmap 生效的产品专有拖拽

它与 selection 的关系只是：

- 常常发生在 select tool 下

但“发生在 select tool 下”不等于“属于 selection domain”。

长期最优里：

- `mindmap drag` 应保留在 `mindmap` domain
- 由独立 owner 参与 interaction 竞争
- 不再被 selection 总入口管理

否则 selection 永远会变成“select tool 下所有东西”的集合。

---

## selection 的长期最优模型

下面给出最终模型。

---

## 1. 核心文档模型：`SelectionTarget`

selection 持久态只保留：

```ts
type SelectionTarget = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}
```

对应：

- `replace`
- `add`
- `remove`
- `toggle`
- `clear`
- `selectAll`

当前
[packages/whiteboard-editor/src/runtime/state/selection.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/state/selection.ts)
这条线整体方向是对的，长期只需要继续保持它纯即可。

它不应该再长出更多衍生字段。

---

## 2. 核心只读模型：`SelectionSummary`

长期最优里，selection 的 editor 级只读模型应只保留真正稳定的东西：

```ts
type SelectionSummary = {
  kind: 'none' | 'node' | 'nodes' | 'edge' | 'edges' | 'mixed'
  target: {
    nodeIds: readonly NodeId[]
    nodeSet: ReadonlySet<NodeId>
    edgeIds: readonly EdgeId[]
    edgeSet: ReadonlySet<EdgeId>
    edgeId?: EdgeId
  }
  items: {
    nodes: readonly Node[]
    edges: readonly Edge[]
    primaryNode?: Node
    primaryEdge?: Edge
    count: number
    nodeCount: number
    edgeCount: number
  }
  transform: {
    move: boolean
    resize: 'none' | 'resize' | 'scale'
  }
  box?: Rect
}
```

当前 `SelectionSummary` 已经比较接近，但建议进一步收紧：

- `boxInteractive` 不应该继续作为核心 summary 字段

原因是：

- 它更接近某个交互策略和 UI 行为的导出值
- 不是 selection 实体本身的稳定领域属性

长期最优里，是否可通过 selection box body 开始拖拽，应由 selection interaction policy 根据：

- `summary.box`
- `summary.transform`
- `summary.kind`

自行判断。

也就是说，`summary` 保留“事实”，不要保留太多“某条交互是否可用”的布尔结果。

---

## 3. editor 侧 read 模型要收紧

长期最优里，editor 不应再导出现在这种：

```ts
type SelectionSnapshot = {
  summary: SelectionSummary
  can: SelectionCan
  types: readonly SelectionTypeStat[]
  style: SelectionStyleSnapshot | null
}
```

最终应收紧为：

```ts
type SelectionRead = {
  target: ReadStore<SelectionTarget>
  summary: ReadStore<SelectionSummary>
}
```

这里的原则非常明确：

- editor 负责 selection domain runtime
- react 负责 selection menu / toolbar / panel 的 presentation derive

所以这些都应该移到 React：

- `SelectionCan`
- `SelectionTypeStat`
- `SelectionStyleSnapshot`

如果未来非 React host 也需要这些能力，那也应该把它们定义成：

- presentation selector

而不是重新塞回 editor 核心 read。

---

## 4. selection interaction 的最终 owner 划分

长期最优里，interaction owner 应该和真实行为对齐。

推荐最终划分如下。

### `selection` owner

只负责：

- 背景按下
- 节点按下
- selection box body 按下
- pending press
- tap
- move current selection
- marquee

### `transform` owner

只负责：

- selection box handle resize
- selection box handle rotate

### `mindmap` owner

只负责：

- mindmap root drag
- mindmap subtree drag

### 结果

当前
[packages/whiteboard-editor/src/interactions/selection/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection/index.ts)
这种“先判断 transform，再判断 mindmap，再判断 press”的总路由结构应消失。

因为它混淆了：

- owner 竞争
- owner 内部 session 分支

长期最优里，owner 的粒度应直接对应真实交互域，而不是“一个总入口再内部二次路由”。

---

## 5. selection press 的最终模型

press 是 selection domain 的入口决策器。

它的职责只有：

- 根据按下目标、当前 selection、modifier，决定这次按下后可能发生什么

长期最优里，press policy 应只产出一个很小的结果对象：

```ts
type SelectionPressDecision<TField extends string = string> = {
  chrome: boolean
  release?: SelectionReleaseDecision<TField>
  drag?: SelectionDragDecision
  hold?: SelectionDragDecision
}
```

其中：

```ts
type SelectionReleaseDecision<TField extends string = string> =
  | { kind: 'clear' }
  | { kind: 'select'; target: SelectionTarget }
  | { kind: 'edit'; nodeId: NodeId; field: TField }
```

```ts
type SelectionDragDecision =
  | {
      kind: 'move'
      target: SelectionTarget
      prepareSelection?: SelectionTarget
    }
  | {
      kind: 'marquee'
      match: 'touch' | 'contain'
      mode: SelectionMode
      base: SelectionTarget
      clearOnStart?: boolean
    }
```

这样以后：

- `allowHold` 消失
- `nextSelection` 改为 `prepareSelection`
- `frame` 消失
- `anchorId` 消失

hold 不再是一个模糊布尔开关，而是：

- 明确的第二个 drag decision

这会直接让
[packages/whiteboard-editor/src/interactions/selection/press.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection/press.ts)
变薄很多。

---

## 6. selection pending press session 的最终模型

selection 通用交互里，确实有一个客观存在的东西：

- pointer down 后，在 tap / drag / hold 之间等待判定的短暂阶段

这东西不该被隐藏。

但它应该是一个明确、很小的 session，而不是一堆中间状态。

建议最终模型：

```ts
type SelectionPendingSession<TField extends string = string> = {
  pointerId: number
  start: {
    screen: Point
    world: Point
  }
  subject: SelectionPressSubject<TField>
  decision: SelectionPressDecision<TField>
}
```

editor runtime 再配一个很薄的 timer：

- move 超过阈值则执行 `decision.drag`
- hold 到时则执行 `decision.hold`
- up 时若 release 仍匹配按下 subject，则执行 `decision.release`

这里应新增 core 纯函数：

- `matchSelectionRelease(subject, pick)`

用于判断：

- 当前 release 是否仍然可视为对同一个 press 目标的 tap

这样 `verifyNodeIds` 就可以彻底删除。

---

## 7. move selected items 不属于 selection 算法本体，但属于 selection owner 行为

这里要分清两个层次。

### 从交互上看

拖动当前 selection，属于 selection owner 的行为。

### 从纯算法上看

move session 属于 node domain，不属于 selection domain。

所以长期最优分层应该是：

- `selection press` 决定“这次要不要进入 move”
- `node move session` 负责 move 的纯算法
- `selection owner` 只是调用 `startMoveSession / stepMoveSession / finishMoveSession`

也就是说：

- selection 拥有“进入 move”的交互语义
- 但不拥有“如何 move”的几何算法

这和前面那份 move session 文档完全一致。

---

## 8. marquee 的最终模型

marquee 也应从 controller/callback 模式收紧为 session 模式。

长期最优里，core 只需要提供极小的 marquee 纯算法：

```ts
type MarqueeSession = {
  pointerId: number
  startScreen: Point
  startWorld: Point
  match: 'touch' | 'contain'
}

type MarqueeStepResult = {
  active: boolean
  worldRect?: Rect
}
```

以及：

- `startMarqueeSession(...)`
- `stepMarqueeSession(...)`
- `finishMarqueeSession(...)`

editor selection owner 负责：

- 用 `worldRect` 查询 node/edge ids
- 根据 `base + mode` 写 selection
- 写 overlay.select.marquee

这样以后：

- `createMarqueeController`
- `onStart/onChange/onEnd`

这一套都可以删掉。

主线会变成：

- start session
- step -> worldRect
- query matched ids
- overlay / commands

这才是长期最优。

---

## 9. transform 不应该继续藏在 selection 里面

当前
[packages/whiteboard-editor/src/interactions/selection/transform.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection/transform.ts)
虽然代码本身并不离谱，但它放在 selection 总入口下面会制造一个错误印象：

- transform 是 selection 的一个内部 phase

长期最优里，它应该是独立 owner：

- `interactions/transform.ts`

或者如果保留目录：

- `interactions/transform/index.ts`

原因不是文件摆放，而是概念对齐：

- `transform` 是几何变换 owner
- 它依赖当前 selection summary
- 但不是 selection press 的子阶段

对应的纯算法继续留在：

- `@whiteboard/core/node`

后续如果允许继续收敛，甚至可以把当前 transform 的 drag state 也整体下沉为 core transform session。

---

## 10. mindmap drag 应从 selection 目录彻底移出

最终应变成：

- `packages/whiteboard-editor/src/interactions/mindmap.ts`

或者：

- `packages/whiteboard-editor/src/interactions/mindmap/index.ts`

对应的 overlay 也不该继续放在通用 `select` slice 下面。

更合理的是：

```ts
overlay.selection = { ... }
overlay.mindmap = {
  drag?: MindmapDragFeedback
}
```

因为：

- marquee 是 selection 通用反馈
- move preview / hovered / snap guides 是 selection/transform 通用反馈
- mindmap drag preview 是 mindmap 专有反馈

不要再让 `selection` 承担“所有 select tool 下的预览态”。

---

## selection overlay 的最终模型

长期最优里，selection overlay 应该收成一个明确的逻辑分片。

建议最终结构：

```ts
overlay.selection = {
  node: {
    patches: readonly NodePatchEntry[]
    hovered?: NodeId
  }
  edge: {
    patches: readonly EdgeOverlayEntry[]
  }
  marquee?: {
    worldRect: Rect
    match: 'touch' | 'contain'
  }
  guides: readonly Guide[]
}
```

而不是继续散在：

- `node.selection`
- `edge.selection`
- `select.marquee`
- `guides.snap`

长期最优里，按“哪个 domain 在消费这些可视状态”来组织更合理。

这样 selection owner / transform owner / move session adapter 写预览时，入口会非常直接：

- 只写 `overlay.selection`

mindmap 则单独写：

- `overlay.mindmap`

---

## selection commands 的最终模型

selection commands 本身已经比较接近长期最优。

长期保留这几个就够：

- `replace`
- `add`
- `remove`
- `toggle`
- `clear`
- `selectAll`

需要继续收紧的是：

- selection commands 只处理 target 变更
- edit side effect 不属于 selection commands
- context menu / summary actions 不属于 selection commands

也就是说，selection command 应长期保持极薄。

---

## core / editor / react 的最终边界

这是整个 selection 重构里最重要的部分。

---

## `whiteboard-core` 应负责什么

`whiteboard-core` 负责 selection 的纯领域与纯算法：

- `SelectionTarget`
- target normalize / compare / apply
- `SelectionSummary`
- selection bounds
- selection press decision
- selection release match
- marquee session 纯算法
- node move session
- node transform session

注意：

- move / transform 虽然由 selection 触发，但它们的纯算法属于 node domain

### 最终建议的 core 目录

`packages/whiteboard-core/src/selection/`

- `target.ts`
- `summary.ts`
- `bounds.ts`
- `press.ts`
- `release.ts`
- `marquee.ts`

`packages/whiteboard-core/src/node/`

- `move.ts`
- `moveSession.ts`
- `transform.ts`
- `transformSession.ts`

`packages/whiteboard-core/src/mindmap/`

- 保留 `drag.ts`

---

## `whiteboard-editor` 应负责什么

`whiteboard-editor` 负责 selection runtime glue：

- selection target state store
- selection summary read store
- interaction owner 仲裁
- pointer input -> core session
- overlay 写入
- commands 派发

也就是说，editor 不是 selection 菜单状态中心，不是 selection 样式统计中心，也不是 selection 产品扩展合集。

### 最终建议的 editor interaction 布局

`packages/whiteboard-editor/src/interactions/`

- `selection.ts`
- `transform.ts`
- `mindmap.ts`
- `draw.ts`
- `edge/`
- `viewport.ts`

如果 `selection` 需要目录，只保留通用 selection 内部件：

`packages/whiteboard-editor/src/interactions/selection/`

- `index.ts`
- `press.ts`
- `marquee.ts`
- `move.ts`

不要再把：

- `transform.ts`
- `mindmap.ts`

放在 selection 目录里。

---

## `whiteboard-react` 应负责什么

React 应负责所有面向菜单、面板、呈现的 selection 派生：

- toolbar enable/disable
- selection style snapshot
- mixed type stats
- context menu actions summary
- inspector 展示模型

这些目前散在 editor `SelectionSnapshot` 里的内容，都应移到 React。

原因很简单：

- 它们不是 editor 运行时的核心语义
- 它们是 UI 组合层的视图模型

---

## 最终重构后的 selection 主线

把整个 selection 行为压缩后，长期最优应该是一条非常短的主线。

---

## 通用 selection 按下

```ts
pointerdown
  -> selection owner 读取 current summary
  -> resolveSelectionPressDecision(...)
  -> 启动 pending press session
```

## move 到拖拽阈值

```ts
pending press
  -> decision.drag.kind === 'move'
  -> 如果有 prepareSelection，先 replace selection
  -> startMoveSession(...)
  -> stepMoveSession(...)
  -> 写 overlay.selection
```

或：

```ts
pending press
  -> decision.drag.kind === 'marquee'
  -> startMarqueeSession(...)
  -> stepMarqueeSession(...)
  -> 查询命中项
  -> 写 overlay.selection.marquee
  -> 写 selection
```

## hold

```ts
pending press
  -> decision.hold
  -> 转入 move / marquee session
```

## pointerup

```ts
如果还在 pending:
  -> matchSelectionRelease(...)
  -> 执行 release decision

如果在 move:
  -> finishMoveSession(...)
  -> commands.node.move / commands.edge.updateMany

如果在 marquee:
  -> finishMarqueeSession(...)
  -> 写最终 selection
```

这条主线才是 selection 长期最优应有的样子。

---

## 一步到位的重构方案

下面给出不考虑兼容、不在乎改动成本的最终实施步骤。

---

## 第 1 步

收紧 selection read。

直接删除 editor `SelectionSnapshot` 里的：

- `can`
- `types`
- `style`

最终 editor 只保留：

- `selection.target`
- `selection.summary`

React 侧自己建立 selection presentation hooks/selectors。

---

## 第 2 步

重写 core `selection/press.ts`。

目标：

- `SelectionPressPlan` 改成 `SelectionPressDecision`
- 删除 `allowHold`
- `drag.move` 删除 `frame`
- `drag.move` 删除 `anchorId`
- `nextSelection` 改成 `prepareSelection`

同时新增：

- `SelectionReleaseDecision`
- `matchSelectionRelease(...)`

让 tap/release 逻辑从 `verifyNodeIds` 解耦。

---

## 第 3 步

把 `selection press` 改造成真正的 pending press session。

也就是：

- session 只保存 start / subject / decision
- timer 只负责 hold 触发
- move/up 直接按照 decision 转换

删除当前只为旧 press plan 服务的中间字段和特殊分支。

---

## 第 4 步

把 marquee 改成 session/result 模型。

删除：

- `createMarqueeController`
- `onStart`
- `onChange`
- `onEnd`

改成：

- `startMarqueeSession`
- `stepMarqueeSession`
- `finishMarqueeSession`

selection owner 直接消费结果并写：

- `overlay.selection.marquee`
- `commands.selection`

---

## 第 5 步

按前一份 move session 文档，把 selection move 完整下沉到 core `node/moveSession.ts`。

selection 只保留：

- 从 press decision 进入 move session
- overlay 写入
- commit 派发

---

## 第 6 步

把 transform 从 selection owner 中拆出去。

最终：

- `transform` 成为独立 owner
- 直接基于 `read.selection.summary` 和 core/node transform session 工作

selection owner 不再负责 transform 分支。

---

## 第 7 步

把 mindmap drag 从 selection 目录和 selection owner 中彻底移出。

最终：

- `mindmap` 成为独立 owner
- mindmap overlay 独立成 slice

selection 不再碰它。

---

## 第 8 步

重组 overlay。

把 selection 相关临时可视状态收敛到：

- `overlay.selection`

把 mindmap preview 收敛到：

- `overlay.mindmap`

删除当前分散在多处的 selection 反馈写法。

---

## 第 9 步

清理 selection 目录和命名。

最终 selection 目录只保留 selection 通用行为。

建议保留：

- `selection/index.ts`
- `selection/press.ts`
- `selection/marquee.ts`
- `selection/move.ts`

删除或迁出：

- `selection/transform.ts`
- `selection/mindmap.ts`

---

## 第 10 步

把 React 侧的 selection 菜单、style、type stats、capabilities 全部改成基于：

- `editor.read.selection.summary`
- `editor.read.node`
- `registry`

自行派生。

不要再反向要求 editor selection read 输出 UI 专用快照。

---

## 这次重构后，selection 的最终判断标准

如果 selection 已经改到长期最优，那么应该满足下面这些标准。

### 1. selection 持久态只有 `SelectionTarget`

没有别的。

### 2. selection read 只暴露 summary，而不暴露 UI presentation 数据

editor 不再维护 selection 菜单模型。

### 3. selection owner 只处理通用 selection 行为

不再负责 transform、mindmap。

### 4. press policy 只表达 decision，不再携带 drag session 内部字段

没有：

- `frame`
- `anchorId`
- `allowHold`
- `verifyNodeIds`

### 5. marquee 和 move 都是 session/result 模型

而不是 controller/callback 模型。

### 6. overlay 按 domain 收敛

selection 写 `overlay.selection`，mindmap 写 `overlay.mindmap`。

### 7. React 自己派生 selection 菜单和样式模型

editor 不再背这些 UI 负担。

---

## 一句话总结

selection 的长期最优，不是继续把它做成一个更整齐的“大 feature”。

selection 的长期最优是：

- **把它收回成一个很小的文档域**
- **把它保留为一个很小的通用交互域**
- **把 transform、mindmap、UI 菜单派生这些不属于它本体的东西全部拆出去**

最终只留下三条真正稳定的线：

1. `SelectionTarget`
2. `SelectionSummary`
3. `SelectionPress -> Move/Marquee`

做到这一步，selection 才会从“现在能工作但越来越厚”的状态，回到一个长期稳定、噪音很少、容易继续演进的结构。
