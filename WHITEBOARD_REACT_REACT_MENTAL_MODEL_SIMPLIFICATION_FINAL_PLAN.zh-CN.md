# Whiteboard React 按 React 心智继续简化的最终方案

## 目标

这份文档回答的问题是：

**在已经完成单一 `BoardRuntime` 收敛之后，`whiteboard-react` 还存在 `interactions / features / 顶层 draw|edge|insert|tool / runtime` 等多套并行轴线，下一步如果完全不在乎重构成本，如何进一步压缩概念、消除重复 ownership，并让目录结构更符合 React 心智。**

约束：

- 不考虑兼容成本
- 不考虑渐进迁移的保守性
- 不保留仅为历史服务的目录命名
- 优先选择长期最优的 ownership 和阅读体验

一句话结论：

**顶层只保留 `board / surface / features / shared` 四类目录，业务能力按 feature 聚合，`interactions` 不再作为顶层横向目录存在，`runtime` 也不再作为泛化目录名存在。**

---

## 现状问题

虽然 React 侧主中轴已经收敛成单一 `BoardRuntime`，但目录心智仍然偏复杂，主要体现在下面几类重复。

### 1. 同一领域分散在多个顶层目录

例如：

- edge 同时分散在 `features/edge`、`interactions/edge`、`src/edge`
- draw 同时分散在 `features/draw`、`interactions/draw`、`src/draw`
- selection 同时分散在 `features/selection`、`interactions/selection`
- mindmap 同时分散在 `features/mindmap`、`interactions/mindmap`

这会导致一个简单问题很难回答：

**“edge 的完整实现到底在哪？”**

如果答案必须是“要同时看三个目录”，说明 ownership 仍然没有收干净。

### 2. `runtime` 这个词被过度复用

React 侧当前容易出现多种“runtime”语义：

- `BoardRuntime` 作为真正的应用中轴
- `interactions/runtime` 作为交互调度器
- `runtime/hooks` 作为共享 hook
- 历史上的 host/runtime 表述

这会制造命名噪音：

- 有的 runtime 是主概念
- 有的 runtime 只是内部控制器
- 有的 runtime 只是工具目录

从 React 心智看，这不合理。

**React 侧应该只允许一个 runtime 是主语，那就是 `BoardRuntime`。**

### 3. pure model 的归属不稳定

现在顶层还有：

- `tool/`
- `draw/`
- `edge/`
- `insert/`

但它们的“全局性”并不一致。

其中：

- `tool` 是 board 全局 local stable state，顶层存在是合理的
- `draw` 大部分只是 draw feature 的模型
- `edge` preset 大部分只是 edge feature 的模型
- `insert` 本质上更像 toolbox / create flow 的业务模型

也就是说：

**当前顶层 pure model 目录里，并不是每一个都值得长期保留在顶层。**

### 4. 交互被抽成顶层横切目录，破坏了 feature ownership

`interactions` 目录的好处是把所有 session 聚在一起，但代价是：

- feature 的完整实现被切碎
- 阅读 feature 时必须频繁横跳
- “交互是业务语义的一部分”这件事被目录层级掩盖

从 React + feature-based codebase 的心智看，最自然的 ownership 是：

- draw interaction 属于 draw feature
- edge interaction 属于 edge feature
- selection interaction 属于 selection feature
- viewport interaction 属于 viewport feature

只有**输入调度器本身**才属于全局 board 中轴。

---

## 核心判断

### 1. 顶层不应该继续按“技术切面”拆太多目录

当前的顶层切面过多：

- `board`
- `surface`
- `interactions`
- `features`
- `draw`
- `edge`
- `insert`
- `tool`
- `runtime`

这对 React 项目来说太散。

React 项目长期最优的顶层切法应该更克制：

- 应用中轴
- DOM 宿主
- 业务 feature
- 共享基础设施

也就是：

- `board`
- `surface`
- `features`
- `shared`

只有这四层是稳定且合理的顶层概念。

### 2. `interactions` 不该继续作为顶层目录存在

交互不是产品域，它只是 feature 的一种实现侧面。

所以长期最优不是：

- `interactions/edge`
- `features/edge`

而是：

- `features/edge/interaction`
- `features/edge/components`
- `features/edge/hooks`
- `features/edge/model`

同理适用于：

- draw
- selection
- mindmap
- viewport

唯一应该保留在全局层的，是输入调度和 session 编排本身。

它属于 `board` 内部。

### 3. `runtime` 这个目录名应该退休

今后 React 侧只有一个 runtime 主概念：

- `BoardRuntime`

除此之外：

- hook 就叫 hook
- dom helper 就叫 dom
- shared util 就叫 shared
- dispatch controller 就叫 dispatch/controller

不要再挂 `runtime/*` 这种泛化目录。

### 4. 业务能力应该按 feature 聚合，而不是按“render / interaction / model”三轴平铺

长期最优不是：

- 顶层 `features/*` 管渲染
- 顶层 `interactions/*` 管交互
- 顶层 `draw|edge|insert` 管 model

而是：

- 一个 feature 自己拥有渲染、交互、model、hooks

也就是说：

**feature 是第一层切分维度，render / interaction / model 是 feature 内部的第二层切分维度。**

---

## 最终目录模型

长期最优目录建议如下：

```txt
packages/whiteboard-react/src/
  board/
    createRuntime.ts
    context.ts
    Lifecycle.tsx
    types.ts

    engine/
      commands/
      read/
      clipboard.ts

    local/
      state/
      viewport.ts

    transient/
      index.ts
      node.ts
      edge.ts
      selection.ts
      types.ts

    dispatch/
      controller.ts
      runtime.ts
      types.ts
      snap.ts
      autoPan.ts

  surface/
    Surface.tsx
    Bindings.tsx
    input.ts
    pick.ts
    pickRegistry.ts
    clipboard.ts
    pointerSession.ts
    selectionLock.ts
    domTargets.ts
    shortcut.ts
    runtime.ts

  features/
    node/
      components/
      hooks/
      model/
      registry/
      index.ts

    edge/
      components/
      hooks/
      model/
      interaction/
      index.ts

    draw/
      components/
      hooks/
      model/
      interaction/
      index.ts

    selection/
      components/
      hooks/
      model/
      interaction/
      index.ts

    mindmap/
      components/
      hooks/
      model/
      interaction/
      index.ts

    viewport/
      components/
      hooks/
      interaction/
      index.ts

    toolbox/
      components/
      hooks/
      model/
      menus/
      index.ts

  shared/
    hooks/
    react/
    dom/
    utils/
    types/

  tool/
    index.ts
    model.ts
    types.ts

  index.ts
```

这个结构的关键点不是“目录好看”，而是它强制固定 ownership。

---

## 各目录最终职责

## 1. `board/`

`board/` 是 React 侧唯一中轴。

它内部拥有四类内容：

### 1.1 committed bridge

例如：

- `engine/read/*`
- `engine/commands/*`
- `engine/clipboard.ts`

它们只是 `BoardRuntime` 的内部实现，不应再单独暴露为另一个大概念。

### 1.2 local stable state

例如：

- tool
- viewport
- edit target
- draw preferences

这是 runtime 的稳定本地状态，不属于 feature 私有 UI state。

### 1.3 transient state

例如：

- hover
- marquee
- edge guide
- draw preview
- node patch
- hidden
- mindmap drag feedback

这些都应该收在 `board/transient/*` 内部，不再由 feature 自己私藏 store。

### 1.4 dispatch/controller

这部分只负责：

- 接收语义输入
- 统一调度 feature interaction owner
- 管理 session 生命周期

这里不再放 feature-specific 行为实现。

也就是说：

**board 负责 orchestration，不负责具体业务语义。**

---

## 2. `surface/`

`surface/` 是唯一 DOM 宿主层。

它只负责：

- DOM event 绑定
- pointer capture
- pick registry
- clipboard host adapter
- shortcut 解析
- input semantic 归一化

它不负责：

- 业务决策
- feature session 逻辑
- committed/transient 合成

判断标准很简单：

如果代码的主要语义是“浏览器宿主适配”，就属于 `surface/`。

---

## 3. `features/`

`features/` 是主要业务层。

每个 feature 自己拥有：

- `model/`
- `interaction/`
- `hooks/`
- `components/`

例如 edge：

- `features/edge/model/` 放 edge preset、edge view helper 等
- `features/edge/interaction/` 放 connect / route / reconnect session
- `features/edge/hooks/` 放 `useEdgeView` 等
- `features/edge/components/` 放 layer / item / overlay

这个结构的好处是：

- 读一个 feature 时不需要跨顶层目录
- interaction ownership 回到业务域
- feature 内部可以自由分层，但对外只有一个 feature 入口

---

## 4. `shared/`

`shared/` 只放无业务语义的公共内容。

例如：

- 通用 React hook
- 通用 DOM helper
- 通用 util
- 通用 type helper

它绝不能承载 feature 语义。

如果一个东西带有：

- node / edge / selection / draw / mindmap / viewport / toolbox

这些业务语义，就不该进 `shared/`。

---

## 5. `tool/`

`tool/` 是唯一建议保留的顶层 pure model 目录。

原因：

- tool 是 board 的全局 local stable state
- 它控制整个 runtime 的模式切换
- 它不是单一 feature 的私有概念

所以：

- `select`
- `hand`
- `draw`
- `edge`
- `insert`

这些 tool 模式作为全局 runtime mode，放顶层有合理性。

但也只建议保留 `tool/` 这一个。

---

## 哪些目录应该被删除

长期最优下，下面这些顶层目录不应再存在。

### 1. 顶层 `interactions/`

删除原因：

- 它承载的是 feature 的实现侧面，而不是独立产品域
- 它让 feature ownership 被横切打散

替代：

- 各 feature 下的 `interaction/`
- `board/dispatch/*` 只保留调度器

### 2. 顶层 `runtime/`

删除原因：

- `runtime` 一词语义过载
- 除了 `BoardRuntime` 本身，其他内容都不值得再用 runtime 命名

替代：

- `shared/hooks`
- `shared/react`
- `surface/*`
- `board/dispatch/*`

### 3. 顶层 `draw/`

删除原因：

- 大部分只服务 draw feature
- 不足以成为顶层全局概念

替代：

- `features/draw/model/*`

### 4. 顶层 `edge/`

删除原因：

- edge preset 等本质是 edge feature 模型
- 不需要脱离 feature 独立存在

替代：

- `features/edge/model/*`

### 5. 顶层 `insert/`

删除原因：

- 更接近 toolbox/create flow 的业务模型
- 不是 board runtime 的全局 primitive

替代：

- `features/toolbox/model/insert/*`
  或
- `features/insert/model/*`

如果要极致收敛，我更推荐并进 `toolbox`。

---

## 事件与交互的最终组织方式

虽然顶层 `interactions/` 删除，但“统一输入调度”仍然需要。

正确做法不是取消交互调度，而是把它缩成 `board` 的内部编排层。

例如：

```ts
type BoardFeature = {
  key: string
  interaction?: InteractionOwner
  clear?: () => void
}
```

然后 `board/dispatch/controller.ts` 做：

```ts
const features = [
  createViewportFeature(board),
  createInsertFeature(board),
  createDrawFeature(board),
  createTransformFeature(board),
  createMindmapFeature(board),
  createSelectionFeature(board),
  createEdgeFeature(board)
]
```

注意：

- `createDrawFeature` 定义在 `features/draw`
- `createEdgeFeature` 定义在 `features/edge`
- `createSelectionFeature` 定义在 `features/selection`

这样做的结果是：

- 调度统一
- ownership 不横切
- feature 的交互实现仍然留在自己的目录里

这才是 React 心智下最自然的方式。

---

## React 组件层的最终读取规则

组件层只允许读两类东西：

### 1. `board.read.*`

例如：

- `board.read.node.*`
- `board.read.edge.*`
- `board.read.selection.*`
- `board.read.feedback.*`

### 2. 组件本地 UI state

例如：

- submenu open
- context menu anchor
- popover visible
- hover card DOM info

禁止第三种来源：

- feature 自己私有一套横向 runtime store
- interaction 目录自己持有另一套外部可读状态

换句话说：

**跨 feature 正确性有关的状态，只能由 `BoardRuntime` 持有。**

---

## 最佳最终形态

如果完全不考虑成本，我建议把目录和心智压缩到下面这四句话：

### 1. 顶层只保留四个概念

- `board`
- `surface`
- `features`
- `shared`

### 2. 顶层只保留一个 runtime 主语

- `BoardRuntime`

### 3. 业务按 feature 聚合

- 渲染、交互、model、hooks 都回到 feature 内部

### 4. 统一输入调度留在 board 内部

- `dispatch/controller` 是 orchestration
- feature interaction 是 domain implementation

---

## 一步到位迁移顺序

如果要按长期最优直接施工，推荐顺序如下。

## 第 1 步：冻结顶层目录扩张

规则：

- 不再新增顶层 `interactions/*`
- 不再新增顶层 `runtime/*`
- 不再新增顶层 `draw|edge|insert` 业务模型文件

所有新代码直接落到最终目标目录。

## 第 2 步：把 `engineBridge` 并入 `board/`

目标：

- `engineBridge` 不再作为独立顶层概念

动作：

- `engineBridge/read/*` -> `board/engine/read/*`
- `engineBridge/commands/*` -> `board/engine/commands/*`
- `engineBridge/clipboard.ts` -> `board/engine/clipboard.ts`
- `engineBridge/state/*` -> `board/local/state/*`
- `engineBridge/viewport.ts` -> `board/local/viewport.ts`
- `interactions/transient.ts` -> `board/transient/*`

## 第 3 步：把交互实现下沉到 feature

目标：

- 顶层 `interactions/` 只剩 dispatch 调度，随后删除

动作：

- `interactions/draw/*` -> `features/draw/interaction/*`
- `interactions/edge/*` -> `features/edge/interaction/*`
- `interactions/selection/*` -> `features/selection/interaction/*`
- `interactions/mindmap.ts` -> `features/mindmap/interaction/*`
- `interactions/viewport.ts` -> `features/viewport/interaction/*`

保留：

- `board/dispatch/controller.ts`
- `board/dispatch/runtime.ts`
- `board/dispatch/types.ts`
- `board/dispatch/snap.ts`
- `board/dispatch/autoPan.ts`

## 第 4 步：把顶层 pure model 回收到 feature

目标：

- 只保留值得全局化的 `tool/`

动作：

- `draw/*` -> `features/draw/model/*`
- `edge/*` -> `features/edge/model/*`
- `insert/*` -> `features/toolbox/model/insert/*`

## 第 5 步：删除顶层 `runtime/`

目标：

- 除 `BoardRuntime` 外，不再出现 runtime 目录心智

动作：

- `runtime/hooks/*` -> `shared/hooks/*`
- `runtime/overlay/*` -> `shared/react/*` 或对应 feature / board

## 第 6 步：统一 feature 出口

目标：

- 每个 feature 对外只有一个 `index.ts`

例如：

- `features/edge/index.ts`
- `features/draw/index.ts`
- `features/selection/index.ts`

避免跨 feature 直接 import 内部实现细节。

## 第 7 步：删掉顶层 `interactions/`

当前面各 feature 迁完后：

- 删除顶层 `interactions/`

只保留：

- `board/dispatch/*`

---

## 最终结论

如果严格按 React 心智继续简化：

### 1. 顶层不应该同时存在 `features + interactions + draw|edge|insert + runtime`

这会制造概念重复和 ownership 重复。

### 2. 长期最优的顶层结构应收敛为

- `board`
- `surface`
- `features`
- `shared`

必要时外加：

- `tool`

### 3. 交互不是顶层产品域

它应该回到各 feature 内部；
只有调度器留在 board 中轴。

### 4. `runtime` 不该继续作为泛化目录名存在

React 侧只保留一个 runtime 主语：

- `BoardRuntime`

### 5. feature 才应该是一等目录

一个 feature 自己拥有：

- model
- interaction
- hooks
- components

这才是最符合 React 心智、最容易读、也最容易长期维护的结构。
