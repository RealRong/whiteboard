# WHITEBOARD_EDITOR_STEP_2_INTERACTION_MODEL_EXECUTION_PLAN.zh-CN

## 文档定位

这份文档是
[WHITEBOARD_EDITOR_FINAL_ARCHITECTURE_PLAN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_EDITOR_FINAL_ARCHITECTURE_PLAN.zh-CN.md)
里“第 2 步”的详细实施方案。

但这份文档明确修正一个之前的判断：

- **阶段 2 不应该建立一个重型的 `InteractionModel` 中轴**

之前把阶段 2 定义成“建立 `SelectInteractionModel / DrawInteractionModel / EdgeInteractionModel`”是不对的。

那种做法的问题不是抽象太多，而是：

- 它把 owner 天然存在的复杂度，提升成了新的全局架构概念
- 让复杂度从 interaction 文件里消失，转而堆到一个更抽象、更重类型、更难读的中轴里

这没有真正降低复杂度。

它只是把复杂度搬家了。

所以阶段 2 的正确目标不是：

- 建立 `InteractionModel`

而是：

- **建立最小的 `InteractionCtx`**
- **把 interaction 重构成 owner + session**
- **让复杂度留在各 owner 内部，而不是提升成新的全局语义层**

这份文档以这个修正后的方向为准。

---

## 阶段 2 的唯一目标

阶段 2 的唯一目标是：

- **把 interaction 从“helper/phase/散乱语义拼装”重构成“owner + session + 最小 ctx”**

更具体地说：

1. 不再引入新的全局 `InteractionModel`
2. 建立一份极小、稳定的 `InteractionCtx`
3. 每个 owner 直接基于 `ctx` 工作
4. 每个 owner 自己持有自己的 session union
5. 纯算法与纯投影继续下沉到 `whiteboard-core`
6. 非纯逻辑继续留在 owner 内部，不再为了“中轴化”被提升成全局服务

阶段 2 的目标不是让 interaction 文件看起来更“分层”。

阶段 2 的目标是：

- 让 interaction 这条线真正变直
- 让复杂度停留在它真实所属的 owner 内部

---

## 为什么之前的 `InteractionModel` 方向不对

需要先把这个根问题说透。

## 1. `InteractionModel` 会制造新的伪中轴

如果阶段 2 去建立：

- `SelectInteractionModel`
- `DrawInteractionModel`
- `EdgeInteractionModel`

那么系统就会多出一个新的稳定概念层：

- `runtime state`
- `overlay`
- `interaction model`
- `interaction runtime`

问题在于，`interaction model` 并不是真实产品概念。

真实产品概念是：

- 我有一个 `select` owner
- 它内部有 `press / marquee / drag / transform / mindmap drag`
- 我有一个 `edge` owner
- 它内部有 `connect / reconnect / route / hover`
- 我有一个 `draw` owner
- 它内部有 `stroke / erase`

这些复杂度是真实存在的。

而 `SelectInteractionModel` 这种东西，并不是产品真实概念。

它只是为了整理代码而新造出来的一层。

长期最优里，不应该保留这种“为了组织当前代码而存在”的概念。

---

## 2. 它会把 owner 的复杂度搬到更远的地方

例如当前 `select` 的复杂度来自：

- press 判定
- tap 行为
- hold 行为
- marquee
- node drag
- node transform
- mindmap drag

这些复杂度本来就属于 `select`。

如果把它们拆成：

- `model.select.press.resolve(...)`
- `model.select.drag.create(...)`
- `model.select.drag.project(...)`
- `model.select.transform.commit(...)`

那系统表面上看起来更规整了，但本质上只是把：

- `select` owner 的复杂度

改写成了：

- 一个更大的、更难一眼读懂的、离行为更远的 API 表

这样做以后：

- owner 文件可能变短
- 但 editor 架构并没有变简单

真正发生的事情是：

- 复杂度从 owner 身上转移到了一个新的抽象层

这不是长期最优。

---

## 3. 它会让类型与接口膨胀

只要走 `InteractionModel` 这条线，最后几乎必然会产生这些东西：

- `SelectPressState`
- `SelectTapEffect`
- `SelectDragSession`
- `SelectDragProjection`
- `SelectTransformSession`
- `SelectTransformCommit`
- `EdgeConnectSession`
- `EdgeConnectProjection`
- `EdgeRouteSession`
- `DrawEraseProjection`

然后这些类型又要变成：

- model 的输入
- model 的输出
- owner 的中转数据
- runtime 的参数

于是类型数量会迅速变多。

最后系统虽然“类型化”了，但不更简单，只是更厚。

长期最优不是追求每一步都单独命名、每一个语义都抽成接口。

长期最优是：

- 能留在 owner 内部的复杂度，就留在 owner 内部

---

## 阶段 2 重新定义后的长期最优方向

阶段 2 的正确方向应该是：

- **删除“建立全局 InteractionModel”这个目标**
- **建立一个最小的 `InteractionCtx`**
- **围绕 owner + session 重构 interaction**

也就是说，阶段 2 之后，editor interaction 的主轴不应该是：

- `InteractionModel`

而应该是：

- `InteractionCtx`
- `InteractionOwner`
- `OwnerSession`

其中真正稳定的概念只有：

1. 交互运行时拿什么上下文工作
2. owner 如何表达自己的 session
3. owner 如何把输入变成 overlay 和 commands

这才是长期稳定的中轴。

---

## 阶段 2 完成后的理想状态

阶段 2 做完后，系统应呈现下面这个形态：

1. `runtime state`
   - editor 本地运行时状态中轴
2. `overlay`
   - editor 唯一临时可视状态中轴
3. `interaction ctx`
   - interaction 唯一工作上下文
4. `interaction runtime`
   - 当前调度器先保留
5. `owner`
   - 直接消费 `ctx`
6. `session`
   - owner 内部私有 union

关键点在于：

- 没有新的全局 `InteractionModel`
- 没有新的全局语义服务层
- 复杂度继续存在，但被放回真实 owner 内部

这才是“复杂但顺”的结构，而不是“表面规整但实际更远”的结构。

---

## 阶段 2 明确不做的事情

为了避免范围失控，阶段 2 依然不做下面这些事：

- 不重写 interaction runtime 的整体调度器
- 不把 active/passive 立即合并成最终 observe 模型
- 不重写 input router
- 不收紧 public surface
- 不重写 `runtime state` 和 `overlay` 的形状
- 不重写 `viewport` 和 `insert` 的薄行为

也就是说，阶段 2 仍然不处理：

- runtime 怎么调度 owner

阶段 2 只处理：

- owner 自己内部该怎么组织

---

## 阶段 2 的核心判断

阶段 2 最重要的判断是：

- **interaction 复杂度应该留在 owner 内部**

而不是：

- 被提升成新的共享语义层

具体来说：

### 应该保留为全局稳定概念的

- `InteractionCtx`
- `InteractionOwner`
- `owner session`

### 不应该保留为全局稳定概念的

- `SelectInteractionModel`
- `EdgeInteractionModel`
- `DrawInteractionModel`
- 大量 `xxxProjection / xxxCommit / xxxResolve` 的公共接口族

如果某段逻辑只属于 `select`，那它就应该继续是 `select` 的私有逻辑。

如果某段逻辑是纯函数，并且未来别的 owner 也可能复用，那它应下沉到 `whiteboard-core`。

除此之外，不应再创造一个新的架构层。

---

## 阶段 2 的最终设计

## 一、建立最小 `InteractionCtx`

阶段 2 应把当前 [packages/whiteboard-editor/src/runtime/interaction/host.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/interaction/host.ts)
这条线，明确重命名与收束为：

- `InteractionCtx`

推荐最终形状：

```ts
type InteractionCtx = {
  read: Editor['read']
  state: RuntimeStateController['state']
  overlay: EditorOverlay
  commands: Editor['commands']
  config: Editor['config']
  registry: NodeRegistry
  snap: SnapRuntime
}
```

这里面有两个关键点：

### 1. `ctx` 是 interaction 唯一上下文

owner、owner 内部私有 phase、session helper，都统一只吃这一份 `ctx`。

不允许继续出现：

- 一会儿 `InteractionHost`
- 一会儿 `SelectionHelperDeps`
- 一会儿 `NodeDragRuntimeDeps`
- 一会儿 `DrawInteractionDeps`

这种每个文件都自己 `Pick<...>` 一份依赖集的做法。

### 2. `ctx` 只提供底层能力，不负责语义封装

`ctx` 不应该变成新的 `model`。

它只是 interaction 的运行时工作环境。

它提供：

- 读 document / state / overlay
- 写 commands / overlay
- 读 config / registry / snap

但它不提供：

- `select.press.resolve`
- `edge.route.commit`
- `draw.erase.query`

这些 feature 语义方法。

这些应该留在 owner 内部。

---

## 二、建立统一的 owner 结构

阶段 2 应把 interaction 的重心从“phase helper 工厂”改成“owner 本体”。

推荐 owner 形状：

```ts
type InteractionOwner<Session> = {
  key: 'select' | 'draw' | 'edge' | 'insert' | 'viewport'
  priority: number
  start: (ctx: InteractionCtx, input: PointerDown) => Session | null
  move?: (ctx: InteractionCtx, session: Session, input: InteractionPointerInput) => void
  up?: (ctx: InteractionCtx, session: Session, input: InteractionPointerInput) => void
  cancel?: (ctx: InteractionCtx, session: Session) => void
  clear?: (ctx: InteractionCtx) => void
  observe?: {
    move?: (ctx: InteractionCtx, input: PointerMove) => void
    leave?: (ctx: InteractionCtx) => void
    blur?: (ctx: InteractionCtx) => void
    wheel?: (ctx: InteractionCtx, input: WheelInput) => boolean
  }
}
```

注意：

- 阶段 2 不需要把 runtime 立刻改成这个最终接口
- 但 owner 内部设计必须先朝这个形状收

也就是说，现在即使 `createInteractionCoordinator` 还在，owner 也应该先开始按“一个 owner + 一个 session union”的方式组织。

---

## 三、每个 owner 自己持有 session union

阶段 2 不该再继续用：

- 公共 `phase` 文件
- 公共 `helper` 桥接文件
- 公共 `starter / runtime deps / create input` 这一类组织方式

正确做法是：

- 每个 owner 自己持有自己的 session union

例如：

```ts
type SelectSession =
  | { kind: 'press', ... }
  | { kind: 'marquee', ... }
  | { kind: 'dragNodes', ... }
  | { kind: 'transform', ... }
  | { kind: 'dragMindmap', ... }
```

```ts
type EdgeSession =
  | { kind: 'connect', ... }
  | { kind: 'moveBody', ... }
  | { kind: 'dragRoute', ... }
```

```ts
type DrawSession =
  | { kind: 'stroke', ... }
  | { kind: 'erase', ... }
```

然后 owner 自己：

- `switch (session.kind)`
- 调自己的私有函数

这比把每个语义阶段再拆成公共 runtime 工厂更简单，也更接近真实产品模型。

---

## 四、owner 内部统一成 `gather / compute / apply`

阶段 2 最重要的实现纪律应该是：

- 每个 owner 内部都统一成 `gather / compute / apply`

### `gather`

从 `ctx` 里读取当前需要的事实数据：

- document item
- index entry
- viewport zoom
- selection snapshot
- tool
- edit state
- draw preferences
- overlay 当前值

### `compute`

把事实数据喂给 `whiteboard-core` 的纯算法，得到：

- session
- preview patch
- hover result
- commit payload

### `apply`

把结果写回：

- `overlay`
- `commands`

这种模式的好处是：

- 不用造新的全局 model
- owner 依然可以保持清晰结构
- 纯算法与非纯逻辑的边界非常明确

这是阶段 2 真正应该建立的“统一模型”。

不是 `InteractionModel`。

---

## 五、什么应该下沉到 `whiteboard-core`

阶段 2 要借这个机会重新拉齐边界。

判断标准非常简单：

### 该下沉到 `whiteboard-core` 的

- 完全纯的几何算法
- 完全纯的命中解析
- 完全纯的 session/payload 计算
- 完全纯的 preview 投影

### 不该下沉到 `whiteboard-core` 的

- 从 editor `read` 收集运行时事实
- 从 runtime state 取当前 tool / selection / edit
- 从 overlay 取当前 preview/hidden/hover
- 写 overlay
- 调 commands
- 管理 pointer/hold/autopan/session 生命周期

一句话：

- `core` 只做 `compute`
- `editor owner` 做 `gather + apply`

这条边界越清晰，系统越简单。

---

## 六、什么应该留在 owner 内部

阶段 2 要特别避免一种错误：

- 看到重复逻辑，就先提成共享 helper 或共享 model

这是当前 interaction 容易重新变复杂的根源。

应该遵守下面这条规则：

### 如果逻辑是纯的，并且明显跨 owner 复用

下沉到 `whiteboard-core`

### 如果逻辑是非纯的，或者只属于单个 owner

留在 owner 内部私有模块

这意味着下面这些东西不应该再作为全局共享桥接层存在：

- `selectionHelpers.ts`
- `marquee.ts`
- `mindmap.ts`
- `node/drag.ts`
- `node/transform.ts`
- `edge/connect.ts`
- `edge/edit.ts`
- `edge/hover.ts`

注意：

- 不是说它们的逻辑都要消失
- 而是它们不再以“跨 owner 公共 phase/helper”的形式存在

它们要么：

- 回到 owner 文件内部
- 要么成为 owner 私有子模块
- 要么把纯算法下沉到 core

---

## 阶段 2 各 owner 的最终处理方式

## 一、`draw`

`draw` 是最简单的一条线，最适合作为第一批验证对象。

### 当前问题

当前 [packages/whiteboard-editor/src/interactions/draw/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/draw/index.ts)
虽然已经不用旧 feedback runtime 了，但还是在手工拼：

- `strokeDeps`
- `eraseDeps`

这说明 `draw` 还不是一个完整 owner。

### 阶段 2 的目标

`draw` 改成：

- 一个 owner
- 一个 `DrawSession`
- 内部私有 `startStroke / moveStroke / finishStroke`
- 内部私有 `startErase / moveErase / finishErase`

### 应保留在 owner 内部的

- 从 `ctx.state.drawPreferences` 读样式
- 从 `ctx.read.node.idsInRect` 筛 draw 节点
- 写 `overlay.draw.preview`
- 写 `overlay.node.hidden`
- 调 `commands.node.create/delete`

### 应下沉到 core 的

- draw points 解析
- stroke 几何投影
- erase 命中纯算法

### 阶段 2 完成后的结果

- 不再有 `strokeDeps / eraseDeps`
- `draw/index.ts` 成为真正 owner
- `stroke.ts / erase.ts` 只保留为 draw 私有模块，或直接收回 owner 文件

---

## 二、`edge`

`edge` 是阶段 2 的第二批目标。

### 当前问题

当前 [packages/whiteboard-editor/src/interactions/edge/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/edge/index.ts)
仍然表现为：

- 一条 active 行为线
- 一条 hover passive 行为线

同时 connect/edit/hover 的语义仍然分散在多个文件里。

### 阶段 2 的目标

`edge` 改成：

- 一个 owner
- 一个 `EdgeSession`
- hover 语义先收回到 owner 私有逻辑中

即使阶段 2 暂时还保留 passive runtime，`edge hover` 也只应成为：

- `edge` owner 的一部分逻辑

而不应继续像现在这样成为一条“另一种 feature”。

### `EdgeSession` 推荐形状

```ts
type EdgeSession =
  | { kind: 'connect', ... }
  | { kind: 'moveBody', ... }
  | { kind: 'dragRoute', ... }
```

### 应保留在 owner 内部的

- 从 `ctx.read` 和 `ctx.config` 收集 connect/reconnect 所需事实
- 使用 `ctx.snap.edge` 求 hover / connect snap
- 写 `overlay.edge`
- 写 `overlay.guides.edge`
- 调 `commands.edge.*`

### 应下沉到 core 的

- connect preview resolve
- reconnect draft resolve
- route drag patch resolve
- body move patch resolve

### 阶段 2 完成后的结果

- 不再有“edge 的公共 phase 文件”
- `edge hover` 的语义回到 `edge` owner
- `connect/edit/hover` 都只是 `edge` owner 内部不同分支

---

## 三、`select`

`select` 是阶段 2 最复杂、也必须最后做的 owner。

### 当前问题

当前 [packages/whiteboard-editor/src/interactions/selection.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selection.ts)
依赖这些桥接层：

- [packages/whiteboard-editor/src/interactions/selectionHelpers.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/selectionHelpers.ts)
- [packages/whiteboard-editor/src/interactions/marquee.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/marquee.ts)
- [packages/whiteboard-editor/src/interactions/mindmap.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/mindmap.ts)
- [packages/whiteboard-editor/src/interactions/node/drag.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/node/drag.ts)
- [packages/whiteboard-editor/src/interactions/node/transform.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/interactions/node/transform.ts)

这条线现在最大的复杂度不是算法，而是：

- 一个 owner 被拆成了很多看似共享、实际只属于 select 的桥接层

### 阶段 2 的目标

`select` 改成：

- 一个 owner
- 一个 `SelectSession`
- 内部自己 `switch (session.kind)`

### `SelectSession` 推荐形状

```ts
type SelectSession =
  | { kind: 'press', ... }
  | { kind: 'marquee', ... }
  | { kind: 'dragNodes', ... }
  | { kind: 'transform', ... }
  | { kind: 'dragMindmap', ... }
```

### 应保留在 owner 内部的

- press/tap/hold 状态管理
- selection apply
- marquee 生命周期
- node drag 生命周期
- transform 生命周期
- mindmap drag 生命周期
- 写 selection 相关 overlay
- 调 `commands.selection / commands.node / commands.mindmap`

### 应下沉到 core 的

- press plan resolve
- marquee rect / hit query 的纯部分
- node drag preview 纯投影
- transform preview 纯投影
- transform commit 纯 update resolve
- mindmap drag preview / commit 纯解析

### 阶段 2 完成后的结果

- `selectionHelpers.ts` 删除
- `marquee.ts / mindmap.ts / node/drag.ts / node/transform.ts` 不再作为跨 owner 的公共 phase 文件存在
- `select` 成为真正完整 owner

---

## 四、`viewport`

`viewport` 继续保持最薄 owner。

阶段 2 不为它做任何额外抽象。

如果为了“统一”去给 `viewport` 也造 session/model，只会制造噪音。

---

## 五、`insert`

`insert` 也继续保持最薄 owner。

阶段 2 不为它建立额外层。

---

## 阶段 2 的实施顺序

## 第 1 组：收束 `InteractionCtx`

1. 把当前 `InteractionHost` 重命名并收束为 `InteractionCtx`
2. `ctx` 中放入：
   - `read`
   - `state`
   - `overlay`
   - `commands`
   - `config`
   - `registry`
   - `snap`
3. interaction 内部不再允许继续定义大量 `Pick<InteractionHost, ...>` 局部依赖类型

### 这组的验收标准

- interaction 只有一个统一 `ctx`
- owner 和 owner 私有模块都只吃这一份 `ctx`
- 不再继续膨胀一堆 feature deps 类型

---

## 第 2 组：先重构 `draw`

1. 让 `draw` 先改成 owner + session
2. 去掉 `strokeDeps / eraseDeps`
3. 将纯几何算法继续留在 core
4. 将 draw 私有非纯逻辑留在 owner 内部

### 这组的验收标准

- `draw` 读起来已经是“一个 owner”
- `draw` 内部没有新的 `DrawInteractionModel`
- owner 直接基于 `ctx` 工作

---

## 第 3 组：再重构 `edge`

1. 将 connect/edit/hover 收成一个 owner
2. hover 先收回 `edge` owner 私有逻辑
3. 暂时不动 runtime active/passive 外壳
4. 让 `edge` 内部统一成 session union

### 这组的验收标准

- `edge` 已经是一个完整 owner
- `edge hover` 不再表现为另一套 feature
- 没有新的 `EdgeInteractionModel`

---

## 第 4 组：最后重构 `select`

1. 删除 `selectionHelpers.ts`
2. 将 `marquee / mindmap / node drag / transform` 收回 `select`
3. `select` 自己持有 `SelectSession`
4. 纯算法继续下沉 core，非纯逻辑留在 select owner 内部

### 这组的验收标准

- `select` 自己就是完整 owner
- 不再依赖一串 phase/helper 桥接层
- 没有新的 `SelectInteractionModel`

---

## 第 5 组：清理遗留 phase/helper 文件

1. 删除不再需要的公共 phase/helper 文件
2. 删除交互私有但错误挂在公共位置的桥接层
3. 收掉 interaction 内部不再需要的中间参数对象

### 这组的验收标准

- interaction 目录明显更接近 owner 结构
- 公共 helper 数量显著下降
- phase 不再成为稳定概念

---

## 阶段 2 与阶段 3 的边界

阶段 2 到这里就结束。

### 阶段 2 结束时应达到

- `ctx` 已统一
- owner 已成型
- session union 已成型
- helper/phase 桥接层显著减少
- 复杂度已经回到各 owner 内部

### 阶段 3 再做

- 重写 interaction runtime
- 删除 `runtime/input/passive.ts`
- 真正建立 `owner + observe` 调度模型
- 收掉旧 coordinator/registry 的中间层

也就是说：

- 阶段 2 先把 owner 自己整理正确
- 阶段 3 再换调度器

顺序不能反。

---

## 阶段 2 的最终验收标准

阶段 2 完成后，必须同时满足下面这些条件：

## 1. 没有新增全局 `InteractionModel`

- editor 架构里不再出现新的 `SelectInteractionModel / DrawInteractionModel / EdgeInteractionModel`
- 没有把 owner 复杂度提升成新的共享中轴

## 2. interaction 只有一个最小 `ctx`

- 统一依赖入口是 `InteractionCtx`
- 不再满地是 feature-specific deps 类型

## 3. `draw / edge / select` 都变成真正 owner

- 每个 owner 自己持有 session union
- 每个 owner 都能按 `gather / compute / apply` 理解

## 4. phase/helper 不再是稳定概念

- `selectionHelpers.ts` 删除
- `marquee / mindmap / node drag / transform / edge hover` 不再作为公共桥接层存在

## 5. 纯逻辑边界更清晰

- 纯算法继续下沉 `whiteboard-core`
- 非纯逻辑留在 owner 内部
- 不再有模糊的“语义服务层”

## 6. 阶段 3 可以直接替换调度器

- 到阶段 3 时，不需要再回头整理 owner 结构
- 只需要处理 runtime 调度模型本身

---

## 最后结论

如果只用一句话概括修正后的阶段 2：

- **阶段 2 不是建立 `InteractionModel`，而是建立最小 `InteractionCtx`，并把复杂度收回 owner session**

阶段 1 已经解决了：

- `runtime state`
- `overlay`

阶段 2 的正确任务不是再补一根“语义中轴”。

阶段 2 的正确任务是：

- 让 owner 变成真正 owner
- 让 session 变成真正 session
- 让复杂度停留在它真实所属的地方

这样阶段 3 才能只做一件事：

- 替换 interaction runtime 调度器

而不会又多出一层新的全局抽象需要维护。

这才是从全局和根本上看，更少概念、更少噪音、也更符合长期最优的重构方向。
