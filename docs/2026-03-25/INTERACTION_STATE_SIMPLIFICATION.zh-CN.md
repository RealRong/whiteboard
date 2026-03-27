# 交互状态收敛设计

## 结论

当前交互层的主要问题，不是单纯“状态太多”，而是：

- 持久 UI 状态
- 全局交互仲裁
- 单次手势过程
- 预览渲染输出

这四层没有完全拆开，导致代码读起来像一个不断膨胀的状态机。

长期最优方案是：

- 保留少量真正必要的持久 UI 状态
- 把 `interaction` 收敛成“全局互斥锁 + 少量共享语义”
- 把每个 feature 的手势过程留在局部 session / active 中
- 把 `node / edge / snap / marquee / draw / mindmap` 统一看作 preview 输出通道
- 把 `pointerdown` 改成单入口路由，不再让每个 feature 自己重复判断一遍 `tool / mode / editable / ignore / frame`

一句话说：

不是继续做更大的状态机，而是把交互拆成：

- `state`
- `interaction`
- `preview`
- `route`

四个边界清晰的层。

## 前提

本文明确采用下面这个前提：

- 不在乎重构成本
- 不需要兼容旧实现
- 不保留双路径
- 优先长期最优
- 优先概念最少
- 优先 API 最短且语义稳定

也就是说，目标不是“尽量少改”，而是“一步到位把交互层收敛到长期稳定结构”。

## 现状问题

### 1. `interaction.mode` 正在承担过多公共语义

当前 `interaction.mode` 同时承担了两类职责：

- 全局互斥锁
- feature 级细节阶段

例如：

- `press`
- `draw`
- `viewport-pan`
- `marquee`
- `node-drag`
- `mindmap-drag`
- `node-transform`
- `edge-drag`
- `edge-connect`
- `edge-path`

这本身不一定错，但问题在于它已经开始被其他模块当成公共 UI 语义读取。

典型现象：

- 有的地方只关心是不是 `idle`
- 有的地方只关心 chrome 能不能显示
- 有的地方只是为了阻止 viewport 输入
- 有的地方却被迫知道一堆 feature-specific mode

这说明 `mode` 暴露得过细了。

### 2. `pointerdown` 入口仍然是线性 try-chain

当前根层 down 入口本质上还是：

```ts
edge.create(...)
|| eraser.down(...)
|| draw.down(...)
|| insert.down(...)
|| transform.down(...)
|| edge.down(...)
|| mindmap.down(...)
|| gesture.down(...)
```

这会直接带来两个问题：

1. 每个 feature 都要自己判断一遍“我能不能启动”
2. 同一套守卫条件在多个模块重复出现

比如反复出现：

- `input.mode !== 'idle'`
- `input.tool.type !== ...`
- `input.editable`
- `input.ignoreInput`
- `input.ignoreSelection`
- `event.button !== 0`

表面上看像状态变量多，实际上是入口路由不收敛。

### 3. `frame` 不是多余状态，但围绕它的归一化散落在多处

当前多个 feature 都在自己处理：

- 当前 active frame 是否还有效
- pointer 是否还在 frame 内
- 是否要 `frame.exit()`
- 背景 / frame body / container body 如何解释

这导致 `frame` 周边看起来很复杂，但复杂度不在 store，而在“谁负责先归一化 frame scope”没有统一。

### 4. preview 被误当成状态机的一部分

现在存在多类临时输出：

- node preview patch / hovered / hidden
- edge patch / hint
- snap guides
- marquee rect / match
- draw preview
- mindmap drag preview

这些本质上都不是持久 UI 状态，也不应该变成全局交互状态机节点。

它们只是“当前正在运行的某个手势，对渲染层发出的临时输出”。

如果这一层不明确，就会不断出现：

- 要不要给 interaction 再加一个 mode
- 要不要给 state 再加一个字段
- 要不要把某个 preview 也收进 instance.state

然后状态看起来越来越多。

### 5. 一部分复杂度不是状态多，而是共享语义不够粗

很多模块并不真的关心“当前是 edge reconnect 还是 edge path”，它们只关心：

- 现在是不是忙碌态
- 现在能不能显示 chrome
- 当前是不是有 marquee
- 当前是不是允许 viewport 输入

如果共享语义还是直接暴露细 mode，就会逼很多地方读到不需要知道的细节。

## 设计目标

目标只有六个：

1. 持久状态最少
2. 全局交互语义最少
3. 单次手势过程局部化
4. preview 独立成统一层
5. 根层只有一个 down 路由入口
6. 不再让 feature 自己维护一套重复的启动守卫

## 最终分层

长期最优建议把交互相关模型明确拆成四层。

### 1. `state`：持久 UI 状态

这是需要长期保存、允许被多个模块稳定消费的状态。

建议只保留这几个：

- `tool`
- `draw`
- `selection`
- `frame`
- `edit`
- `viewport`

说明如下。

#### `tool`

必须保留。

这是显式用户模式，不是推导结果。

#### `draw`

必须保留。

这是画笔预设与槽位偏好，不属于单次手势过程。

#### `selection`

必须保留。

但应坚持：

- `selection.source` 只表达选中的 ids
- `selection.view` 一律作为 derived read

不要继续把更多交互意图塞回 selection source。

#### `frame`

必须保留。

这是当前 scope，不是从 selection 或 pick 可稳定推导出来的。

但要把围绕 `frame` 的退出与校正逻辑统一到路由前置层，不能分散在每个 feature。

#### `edit`

必须保留。

最小表达就是：

```ts
{ nodeId, field } | null
```

这个模型已经足够小，不应继续膨胀。

#### `viewport`

必须保留。

这是独立基础状态。

### 2. `interaction`：全局互斥锁

`interaction` 不应该继续发展成“全局 feature 状态机”。

长期最优应该只承担：

- 当前是否有活动交互
- 键盘级瞬时输入锁存
- 极少量跨模块共享语义

#### 建议保留的共享语义

- `busy`
- `space`
- `chrome`

必要时保留一个很薄的内部 `kind`，但不要把细分 feature mode 大范围对外暴露。

换句话说：

- `interaction` 可以内部知道当前是谁启动的
- 但外部大部分消费者不应该依赖完整 mode 枚举

#### 不建议继续扩张的方向

不建议继续新增：

- `keepToolbar`
- `keepHandles`
- `allowEdit`
- `showOutline`
- `selectionBehavior`

这类 UI 细语义如果继续挂在 `interaction` 上，最终一定再次膨胀。

### 3. `preview`：临时渲染输出

所有手势过程产生的临时渲染信息，都应统一理解为 preview。

建议长期统一成下面这一层：

- `preview.node`
- `preview.edge`
- `preview.snap`
- `preview.marquee`
- `preview.draw`
- `preview.mindmap`

这不要求物理上必须放在一个文件里，但概念上必须收敛成同一层。

重点是：

- preview 不是持久状态
- preview 不是交互模式
- preview 不承载业务语义
- preview 只服务当前帧或当前手势的渲染

### 4. `route`：交互入口路由

这是目前最缺的一层。

长期最优不是做一个更大的事件总线，而是：

- 单入口 pointerdown
- 一次标准化输入
- 一次路由决策
- 命中唯一处理器

这层负责：

- 标准化 `pick`
- 标准化 ignore / editable / button / modifier
- 先归一化 frame
- 基于 `tool + pick + busy + edit + frame` 做路由

各 feature 不再自己重复做全套前置判断。

## 最终模型

### 一、持久状态最终模型

建议长期收敛为：

```ts
type WhiteboardUiState = {
  tool: Tool
  draw: DrawState
  selection: SelectionSource
  frame: FrameScope
  edit: EditTarget
  viewport: Viewport
}
```

注意：

- `selection.view`
- `chrome`
- `tool.read`
- `selection.summary`
- `selection.can`

这些都不属于 source state，全部应该走 derived read。

### 二、交互最终模型

建议长期收敛为：

```ts
type InteractionState = {
  busy: boolean
  space: boolean
  chrome: boolean
}
```

内部如果需要区分当前活动交互是谁，可以保留内部私有字段：

```ts
type ActiveInteraction = {
  pointerId?: number
  kind: 'press' | 'pan' | 'marquee' | 'drag' | 'transform' | 'draw' | 'edge' | 'mindmap'
}
```

但这个 `kind` 不应成为对外广泛依赖的 UI 语义。

对外建议优先暴露：

- `busy`
- `space`
- `chrome`

而不是完整 mode。

### 三、preview 最终模型

概念上建议统一成：

```ts
type Preview = {
  node?: NodePreview
  edge?: EdgePreview
  snap?: SnapPreview
  marquee?: MarqueePreview
  draw?: DrawPreview
  mindmap?: MindmapPreview
}
```

这里的重点不是一定要做一个总对象，而是明确：

- preview 是并列层
- preview 不等于 state
- preview 不等于 interaction mode

### 四、pointerdown 最终模型

建议最终漏斗是：

```ts
const down = readCanvasDown(instance, container, event)
const route = instance.read.route.down(down)
route?.run()
```

或者更简单：

```ts
instance.input.down(container, event)
```

内部流程统一为：

1. 读取 `pick`
2. 标准化 ignore / editable / modifier
3. 归一化 frame
4. 根据 `tool + pick + interaction + edit` 选择唯一处理器
5. 调用该处理器

关键点不是 API 长什么样，而是：

- 决策只能做一次
- feature 不再自己重复守卫

## 哪些状态必须保留

下面这些我认为是长期必须保留的，不建议再砍。

### `tool`

必须保留。

### `draw`

必须保留。

### `selection.source`

必须保留。

### `frame`

必须保留。

### `edit`

必须保留。

### `viewport`

必须保留。

### `space`

建议保留。

它不是膨胀来源，而是跨 `keydown -> pointerdown -> keyup` 的真实输入锁存。

## 哪些东西不该继续长成全局状态

下面这些不应该继续扩张成新的 state domain。

### 1. feature 级 interaction mode

例如：

- `edge-connect`
- `edge-path`
- `node-transform`
- `mindmap-drag`

这些可以作为手势内部实现细节存在，但不该变成到处被消费的公共语义。

### 2. preview 细节

例如：

- `hoveredContainerId`
- `hiddenIds`
- `activePathIndex`
- `marquee.match`
- `snap.guides`

这些都应停留在 preview 层。

### 3. 每个 feature 自己的 `canStart` 条件状态

不应该继续让每个 feature 都维护一套：

- 当前 mode 是否允许
- 当前 tool 是否允许
- 当前 target 是否 editable
- 当前 frame 是否命中

这些应该在统一路由层完成。

## 主要复杂度来源

### 1. 入口路由缺失

这是当前最大的复杂度来源。

没有统一 route，就会出现：

- 重复 guard
- 重复 frame 归一化
- 重复 ignore / editable 判定
- feature 之间通过“尝试执行失败”来决定优先级

这不是长期可维护结构。

### 2. `interaction` 对外暴露过细

大多数消费者不需要知道当前具体是哪个 feature 的 mode。

继续沿这个方向走，会让更多 UI 逻辑绑定到 mode 字符串上。

### 3. preview 与持久状态边界不够显式

导致一些本应是临时渲染输出的值，看起来像“是不是该收进全局 state”。

### 4. `frame` 相关逻辑分散

`frame` 本身不是问题，但围绕它的 normalize 散落在多个 feature 中。

### 5. keyboard 与 pointer 没有共享同一套高层语义

键盘层和 pointer 层都在自己读取：

- selection
- tool
- frame
- edit / ignore

长期看也应该复用统一的高层读取语义，而不是分别推断。

## 最佳重构方向

### 方向一：先把 `interaction` 从“全局 mode 枚举”收缩成“全局锁”

目标：

- 外部不再大量消费细 mode
- 外部统一消费 `busy / chrome / space`

收益：

- 降低跨模块耦合
- 避免 mode 枚举继续膨胀

### 方向二：补出单入口 `down route`

目标：

- 不再使用线性 try-chain
- 只做一次 handler 决策

收益：

- 删除大量重复 guard
- 明确优先级
- 让 feature 内部回到“只负责自己”的状态

### 方向三：统一 `frame normalize`

目标：

- pointerdown 前统一校正 active frame
- feature 不再自己决定是否 exit frame

收益：

- 消除围绕 frame 的散乱条件分支

### 方向四：把 preview 作为独立层命名和组织

目标：

- `node / edge / snap / marquee / draw / mindmap` 在概念上归到同一层

收益：

- 避免继续把 preview 误当成 state 或 mode

## 分阶段实施方案

以下阶段默认：

- 不考虑兼容
- 允许大重构
- 允许改 API
- 优先最终结构正确

### 阶段 1：收缩 `interaction`

目标：

- 让 `interaction` 只对外暴露最少共享语义

实施：

1. 保留内部 active interaction
2. 对外新增或收敛为：
   - `busy`
   - `space`
   - `chrome`
3. 逐步删除 UI 层对细 mode 的直接依赖

完成标准：

- `EdgeOverlay / chrome / context menu / viewport input` 不再需要知道细 feature mode

### 阶段 2：引入 `down route`

目标：

- 让根层 pointerdown 只做一次决策

实施：

1. 基于 `readCanvasDown(...)` 统一构造标准输入
2. 把所有 down 处理器改成“声明自己接什么路由结果”，而不是各自全套 guard
3. 根层决定唯一处理器

完成标准：

- 各 feature `down(...)` 中删除大部分重复 `if tool / if mode / if editable / if ignore`

### 阶段 3：统一 `frame normalize`

目标：

- 把 active frame 归一化从 feature 中收回路由层

实施：

1. 抽出统一的 `frame.normalizeDown(...)`
2. draw / insert / gesture / edge 不再各自做 exit 逻辑

完成标准：

- `frame` 相关退出规则只保留一套

### 阶段 4：统一 preview 概念

目标：

- 把 preview 从“分散的特殊 store”收敛成清晰层级

实施：

1. 统一命名为 preview family
2. 明确 preview 只服务渲染
3. 严禁把 preview 值再抬升成持久 UI 状态

完成标准：

- 代码里看到 preview，就知道它是临时输出，不再争论要不要塞进 state 或 interaction

## 需要避免的反模式

### 1. 不要做更大的事件总线

不建议：

```ts
instance.interaction.on('pointerdown', ...)
instance.node.handle(...)
instance.edge.handle(...)
```

这会把问题从 try-chain 换成另一套框架式分发，复杂度并不会真正下降。

长期最优仍然是普通路由漏斗。

### 2. 不要把细 mode 再做成更多 derived flags

如果继续出现大量：

- `isTransforming`
- `isDraggingNode`
- `isDraggingEdge`
- `isEdgeEditing`
- `isCreatingEdge`

这种 derived 全局标志，也是在变相延续 mode 膨胀。

共享语义必须克制。

### 3. 不要把 preview 塞进 `instance.state`

preview 应继续保持临时、可清空、与手势生命周期绑定。

### 4. 不要把路由职责反推回 feature

只要某个 feature 的 `down` 里还保留了成片的统一前置 guard，就说明 route 还没真正建立起来。

## 最终判断

从全局来看，当前交互层最该收敛的不是“再删几个状态字段”，而是：

1. `interaction` 的公共语义
2. `pointerdown` 的入口路由
3. `frame` 的归一化边界
4. preview 的层级定义

真正的长期最优不是“状态更少”这件事本身，而是：

- 持久状态只表达长期事实
- 全局交互只表达互斥与少量共享语义
- 手势过程只存在于局部 session
- 预览只服务渲染
- 根层只做一次路由决策

做到这五点以后，即使仍然保留若干 store，交互层也不会继续膨胀成不可维护的状态机。

