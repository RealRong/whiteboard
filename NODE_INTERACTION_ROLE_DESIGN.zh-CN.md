# Node 交互角色设计

## 结论

`packages/whiteboard-react/src/features/selection/gesture.ts` 之所以越来越复杂，核心原因不是 `press runtime` 太重，也不是 `plan` 概念太多，而是当前系统只定义了 node 的渲染/几何属性，没有定义 node 的基础交互角色。

长期最优设计不是引入 `owner`，也不是继续做更复杂的 `plan` 分层，而是补上一个非常小的交互模型：

- `hit`
  - 指针真实命中了什么
- `role`
  - 这个 node 在 select tool 下默认遵循哪套基础按下规则
- `selection policy`
  - group / 当前 selection / frame scope / repeat click / edit 等关系型规则

一句话说：

`hit` 保持事实，`role` 提供默认模板，`selection policy` 再决定“最终选谁、拖谁、进不进编辑”。

## 前提

本文明确采用下面这些前提：

- 不在乎重构成本
- 不需要兼容旧实现
- 不保留双路径
- 优先长期最优
- 优先概念最少
- 优先命名短且清晰
- 优先减少 `gesture.ts` 里的产品分支膨胀
- 优先让 frame / group / content 三类对象的默认交互边界清楚

## 现状问题

当前 node 体系已经定义了很多东西，但这些东西偏“渲染和几何”，不偏“交互”。

当前 `NodeDefinition` 已有：

- `scene`
- `hit`
- `connect`
- `canResize`
- `canRotate`
- `autoMeasure`

这些字段分别解决的是：

- 渲染放在哪层
- 命中几何怎么计算
- 能不能连线
- 能不能 transform
- 是否自动测量

但并没有解决下面这个核心问题：

“pointerdown 命中这个 node 以后，默认应该按哪套规则走？”

于是 `gesture.ts` 只能在运行时现场推断：

- 这是普通内容 node，还是 container body
- 当前是不是 selected
- 是不是 repeat click
- 是否需要提升成 group 选择
- 当前 selection 是否应该接管 drag
- 是否进入 edit
- frame body 是否按 background 算

这就是复杂度的真正来源。

## 为什么不需要 `owner`

不需要 `owner` 的根本原因是：

一次 `hit` 并不存在统一的“后续归属主体”。

例如点中一个 node：

- `tap` 可能选中它自己
- `tap` 也可能根据 policy 选中它所在的 group
- `drag` 可能拖这个 node
- `drag` 也可能拖当前 selection
- `hold` 可能直接清 selection 然后开始 contain marquee

这说明：

- `hit` 是稳定事实
- 但 `tap / drag / hold` 的目标未必相同

因此“先把命中提升成一个统一 owner，再由 owner 推导行为”不是长期最优，反而会制造伪概念。

长期最优应该是：

- `hit` 只表示命中了什么
- `role` 决定默认按下模板
- `selection policy` 再按当前上下文修正 tap / drag / hold 的目标

## 为什么不是继续膨胀 `plan`

`plan` 不是根因。

如果 node 的基础交互角色没有统一，那么无论 `plan` 怎么拆：

- `PressTarget`
- `PressOwner`
- `PressSubject`
- `PressPlan`

最后都只是在中间层转移复杂度。

真正应该统一的是：

“这个 node 的默认按下语义是什么？”

只有这一步统一了，`plan` 才能自然变薄。

## 最终模型

长期最优推荐只保留三个稳定概念：

### 1. `hit`

`hit` 是 pointer 命中的事实。

例如：

- `background`
- `selection-box`
- `node body`
- `node shell`
- `edge`
- `transform handle`
- `connect handle`

`hit` 不做语义提升，不提前改写成 group，也不改写成 selection。

### 2. `role`

`role` 是 node 的基础交互角色。

推荐直接替换掉当前 `scene`，不再保留 `scene`。

最终建议：

```ts
type NodeRole = 'content' | 'frame' | 'group'
```

为什么不是 `content | container`：

- `frame` 和 `group` 虽然都不是普通内容 node
- 但它们的默认交互并不一样
- 如果继续共用 `container`，复杂度仍然会被推回 `gesture.ts`

### 3. `selection policy`

这层负责所有关系型规则，而不是 node 固有规则。

例如：

- 点击 group 内 child node 时，最终选自己还是选 group
- 已选中某组对象时，再次拖动 node 是拖 node 还是拖当前 selection
- frame scope 下哪些 node / edge 参与 selection / marquee
- repeat click 是否进入 edit

这层是当前 `gesture.ts` 最重的部分，但它不应该和 node role 混在一起。

## 最终 `NodeDefinition`

不在乎兼容的前提下，推荐直接把 `scene` 改成 `role`。

```ts
type NodeRole = 'content' | 'frame' | 'group'
type NodeHit = 'box' | 'path'

type NodeDefinition = {
  type: string
  meta: NodeMeta
  describe?: (node: Node) => NodeMeta
  role?: NodeRole
  hit?: NodeHit
  connect?: boolean
  schema?: NodeSchema
  defaultData?: Record<string, unknown>
  render: (props: NodeRenderProps) => ReactNode
  style?: (props: NodeRenderProps) => CSSProperties
  canRotate?: boolean
  canResize?: boolean
  autoMeasure?: boolean
  enter?: boolean
}
```

说明：

- `role` 取代 `scene`
- `enter` 只用于 frame 这类“可进入 scope”的对象
- 不新增 `editable`
  - 编辑能力继续靠 `data-node-editable-field` 这套现有 contract
- 不新增 `selectPolicy`
  - group / selection 关系规则不属于 node 定义

## 三类角色的最终语义

## 1. `content`

适用于：

- `text`
- `sticky`
- `shape`
- `draw`
- 未来普通内容块

默认语义：

- body 是主要交互面
- `tap`
  - 默认选中命中的 node
- `drag`
  - 默认拖命中的 node
  - 如果该 node 已经属于当前 selection，可由 selection policy 升级为拖当前 selection
- `hold`
  - 默认清空 selection，启动 contain marquee
- `edit`
  - 由 field contract 决定
  - 命中 `data-node-editable-field` 且满足 repeat / edit policy 时进入编辑

注意：

- `draw` 虽然是 `hit: 'path'`
- 但它仍然是 `content role`
- `hit` 只决定几何命中，不决定默认交互角色

## 2. `frame`

适用于：

- `frame`
- 未来 section / page / board area 这类范围容器

这是当前最需要从普通 node 语义里剥离出来的一类。

### Frame 的核心原则

frame 不是一个“实体块”，而是一个“带 chrome 的背景范围”。

因此：

- frame 内部空白 body 不应该像普通 node body 那样拦截交互
- frame 的交互面应该只有 chrome

### Frame 的交互面

只保留两类可交互面：

- `title`
- `border`

其中：

- `title`
  - hover
  - click 选中 frame
  - repeat click / doubleClick 可进入标题编辑或 enter
- `border`
  - hover
  - click 选中 frame
  - drag 拖 frame
  - 已选中时可 resize
  - edge attach / reconnect 也应当发生在 border，而不是 fill

### Frame 的 body

frame body 一律按 background 处理：

- 不 hover
- 不 click 选中 frame
- 不 doubleClick
- 不 drag frame
- 在空白 body 上 pointerdown，就像在背景上一样

这条规则是整体收敛的关键。

它会直接消除大量“container body 到底按 frame 还是按 background”的分支。

### Frame 的 enter

frame 是否可以 enter，由 `enter?: true` 表达。

推荐：

- `frame.enter = true`
- enter 的入口只保留在 `title` / `border`
- 不允许 frame fill 双击 enter

### Frame 的 connect

frame 如果允许连线：

- 连接锚点应在 border
- 不应以 fill 区域作为连接命中面

## 3. `group`

适用于：

- `group`

group 的长期最优语义，不应该再和 frame 共用一套 “container body” 规则。

group 更接近：

- 成员集合的聚合壳
- selection aggregate
- 范围轮廓

而不是一个带背景填充的容器。

### Group 的核心原则

group 没有自己的内部背景语义。

因此：

- group 的空白内部不应当算 group body
- group 不应拦截其内部空白区域
- group 的真正交互面应该是 shell / outline

### Group 的交互面

group 只保留 shell 级交互：

- outline
- title/chrome（如果未来有）
- selection shell

空白内部一律按 background 处理。

### Group 与 child node 的关系

点击 group 内 child node 时：

- `hit` 仍然是 child node
- 是否最终选中 group，不是 `group role` 决定的
- 而是 `selection policy` 决定的

这点非常重要。

因为：

- “点击 child 默认选自己”
- “点击 child 默认选 group”
- “已在 group selection 中时拖动 child 改成拖整组”

这些都是关系型规则，不是 group 固有定义。

## role 不是 policy

这里必须明确边界：

### 属于 role 的

- 这个 node 默认按 content / frame / group 哪套基础行为走
- body / shell 哪部分应该是交互面
- 默认能不能 enter

### 不属于 role 的

- 选 group 还是选 child
- drag 当前 node 还是 drag 当前 selection
- frame scope 内什么对象可选
- repeat click 进入 edit 的具体条件
- hold 后清 selection 还是保留 selection

这些都应放在 `selection policy`。

## 命中面 contract

为了让语义更清楚，推荐把当前过于含糊的 `part: 'container'` 收敛成 `part: 'shell'`。

推荐最终命中面：

```ts
type NodePickPart = 'body' | 'shell' | 'connect' | 'transform'
```

说明：

- `body`
  - 内容本体交互面
- `shell`
  - frame / group 这类外壳交互面
- `connect`
  - 连线锚点
- `transform`
  - resize / rotate 等 handle

这样以后语义会更统一：

- `content role`
  - 主要提供 `body`
- `frame role`
  - 主要提供 `shell`
- `group role`
  - 主要提供 `shell`

而不是继续混用 `body / container / frame header / fill` 这种不稳定命名。

## 读侧 API 调整

长期最优建议：

### 1. `scene` 改名为 `role`

从：

- `instance.read.node.scene(node)`
- `definition.scene`

改成：

- `instance.read.node.role(node)`
- `definition.role`

### 2. `filter(scene)` 改成 `filter(role)`

从：

- `instance.read.node.filter(nodeIds, 'container')`

改成：

- `instance.read.node.filter(nodeIds, 'frame')`
- `instance.read.node.filter(nodeIds, 'group')`
- 或者提供更明确的小读法：
  - `instance.read.node.frames(nodeIds)`
  - `instance.read.node.groups(nodeIds)`
  - `instance.read.node.content(nodeIds)`

### 3. `enter` 做成独立布尔读法

例如：

- `instance.read.node.enter(node)`

但这不是必须的；如果只在少量地方使用，直接读 definition 也可以。

## `gesture` 的最终漏斗

role 收敛后，`gesture.ts` 应该只做下面几件事：

```ts
down(input)
  -> hit = input.pick
  -> ctx = buildCtx(input)
  -> role = readRole(hit)
  -> base = buildBasePress(role, hit, ctx)
  -> plan = applySelectionPolicy(base, hit, ctx)
  -> press.start(plan)
```

重点：

- `buildBasePress`
  - 只处理 role 默认模板
- `applySelectionPolicy`
  - 只处理 group / selection / frame scope / edit 这些关系型修正

这样 `gesture.ts` 才会真正瘦下来。

否则它永远都得继续现场推断：

- hit 是什么
- 这个 hit 隐含哪套默认 node 规则
- 再加上 selection/group/frame 特判

## 每类 node 的最终映射

推荐映射如下：

| type | role | hit | connect | enter |
| --- | --- | --- | --- | --- |
| `text` | `content` | `box` | `true` | `false` |
| `sticky` | `content` | `box` | `true` | `false` |
| `shape` | `content` | `box` | `true` | `false` |
| `draw` | `content` | `path` | `false` | `false` |
| `frame` | `frame` | `box` | `true` | `true` |
| `group` | `group` | `box` | `false` | `false` |

说明：

- `frame.connect = true`
  - 但 attach 面在 border，不在 fill
- `group.connect = false`
- `draw` 仍然是 content，只是 `hit = 'path'`

## 对现有实现最关键的调整

如果按长期最优重构，最关键的收敛动作只有五个：

### 1. 去掉 `scene`

直接换成 `role`，不要双概念并存。

### 2. Frame fill 不再注册 pick

frame 内部空白区直接当 background。

### 3. Group 不再拥有 body 语义

group 只保留 shell / outline 语义。

### 4. `gesture.ts` 不再出现 `type === 'frame' | 'group'` 这种产品分支

它只看：

- `hit`
- `role`
- `selection policy`

### 5. `part: 'container'` 改成 `part: 'shell'`

这样 frame/group 的交互面语义才会稳定。

## 分阶段实施

## 阶段 1：定义层收敛

- `NodeDefinition.scene` 改为 `NodeDefinition.role`
- `runtime/read/node.ts` 的 `scene()` 改为 `role()`
- 所有默认 node 定义补齐 `role`

阶段目标：

- 先把 node 的基础交互角色显式化
- 不立即重写全部 `gesture`

## 阶段 2：命中面收敛

- `part: 'container'` 改为 `part: 'shell'`
- frame fill 不再 pick
- group 空白内部不再 pick
- frame title / border 统一视为 `shell`

阶段目标：

- `hit` 本身更准确
- `gesture` 不再需要根据 type 猜“这是不是 container body”

## 阶段 3：`gesture` 重写为 `role + policy`

- content / frame / group 三类基础模板
- group 选择、selection drag、repeat edit、frame scope 等逻辑统一归入 `selection policy`
- `plan` 直接长成 press runtime 需要的最终形状，不再保留多余中间抽象

阶段目标：

- `gesture.ts` 从“大型产品矩阵”收成“基础模板 + policy 修正”

## 阶段 4：删除历史概念残留

- 删除所有基于 `scene === 'container'` 的旧分支
- 删除 frame/group body 特判
- 删除 `container` 这个含糊命名在交互层的历史残留

阶段目标：

- 代码里不再出现“容器”这个混合概念
- 只保留清晰的 `content / frame / group`

## 最终总结

这次设计的关键不是再发明一套更重的 press 抽象，而是承认：

- node 的复杂度，不在文档模型
- 而在交互模型没有被显式定义

长期最优方案是：

- `hit` 保持事实
- `role` 只描述 node 的基础交互角色
- `selection policy` 负责所有关系型规则

在这套模型下：

- `content` 是实体内容块
- `frame` 是带 shell 的背景范围
- `group` 是聚合壳，不是背景容器

这样以后 `gesture.ts` 才能真正变薄，整套命名和职责也会明显更统一。
