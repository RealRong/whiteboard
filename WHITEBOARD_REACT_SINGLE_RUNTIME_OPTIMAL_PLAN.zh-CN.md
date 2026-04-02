# Whiteboard React 单一 Runtime 最优重构方案

## 目标

这份文档只回答一个问题：

**在 React 作为唯一宿主的前提下，whiteboard 的长期最优 runtime 应该怎么设计，才能彻底消除旧 editor 思维和新 React 中轴并存的两套模型。**

约束：

- 不考虑兼容
- 不考虑过渡
- 不保留历史壳层
- 不为了“抽象完整”做过度设计
- 只保留长期最优、概念最少、ownership 最清晰的模型

一句话结论：

**React 侧最终只应保留一个 `BoardRuntime`。**

这个 `BoardRuntime` 整体负责：

- committed document 的访问与写入
- 本地稳定 runtime state
- interaction transient
- 语义输入 dispatch
- committed + transient 的合成 read

因此：

- 不再保留独立的 `editor runtime` 作为 React 侧主概念
- 不再保留 `boardRuntime` 这种混合总目录
- 不再保留“projection runtime”
- `projection` 退化为纯 read

---

## 核心判断

## 1. React 侧确实需要一个 runtime

这个判断是成立的。

因为 React 宿主不是只渲染 committed document，它还必须整体处理：

- pointer / wheel / keyboard / clipboard
- tool / viewport / edit / draw preferences
- hover / marquee / draw preview / edge guide / node patch / hidden / drag ghost
- feature session
- committed 与 transient 的合成读取

所以 React 侧不可能只有一堆散 hook，它一定需要一个 runtime。

但这个 runtime 不应该长成：

- `engine`
- `editor runtime`
- `whiteboard runtime`
- `interaction runtime`
- `projection runtime`

这种一层套一层的结构。

长期最优应该是：

- `engine` 作为底层 committed 内核
- `BoardRuntime` 作为唯一上层 runtime

中间不再引入第二个“像 editor 的 runtime”。

---

## 2. 不需要再保留独立的 `editor runtime`

这里要区分两件事：

### 2.1 需要 committed document 内核

这个当然需要。

它应该负责：

- document
- history
- node / edge / selection 的基础 commands
- index / query / spatial read

现在这个角色主要由 `engine` 承担。

### 2.2 不需要一个被单独命名、单独导出、单独装配的 `editor runtime`

这层东西在 React 作为唯一宿主时是多余的。

因为它会造成：

- React runtime 上面再包一层 editor-like runtime
- transient 究竟归 editor 还是归 interaction 变得模糊
- input / pick / tool / overlay / preview / runtime state 到处找归属

这正是当前 `boardRuntime` 还让人觉得别扭的根源。

长期最优不是：

- `engine -> editor -> board controller -> interactions`

而是：

- `engine -> BoardRuntime`

如果内部确实需要一个很薄的 committed facade，也只能是 `BoardRuntime` 的内部实现细节，不应该再暴露成独立大层。

---

## 3. `boardRuntime` 这个整体目录不该长期存在

当前 `packages/whiteboard-react/src/boardRuntime` 最大的问题，不是“文件多”，而是**不同层次的职责被重新塞回一个总桶里**。

里面现在混着：

- 纯 committed runtime：`createEditor`、`read`、`commands`、`state`
- tool pure model：`Tool`、`selectTool`、`drawTool`
- draw pure model：`readDrawStyle`、`readDrawSlot`
- input semantic types：`PointerDownInput`、`KeyboardInput`
- pick types：`EditorPick`
- transient / overlay：`edgeGuide`、`marquee`、`drawPreview`

这说明它本质上仍然是原 `@whiteboard/editor` 包的继续形态，只是换了目录名。

长期最优必须避免这种“综合桶”。

---

## 最终总模型

## 1. 只保留一个 `BoardRuntime`

最终对 React 内部和对外 ref，runtime 心智都统一成：

```ts
type BoardRuntime = {
  read: BoardRead
  commands: BoardCommands
  dispatch: BoardDispatch
  dispose: () => void
}
```

说明：

- `read` 负责所有读取，包括 committed + transient 合成结果
- `commands` 负责所有写 committed 或写本地稳定状态
- `dispatch` 负责语义输入生命周期
- `dispose` 负责 runtime 清理

不要再有：

- `editor.input.*`
- `editor.state.interaction.*`
- `WhiteboardRuntime extends Editor`
- `projection runtime`

---

## 2. `BoardRuntime` 内部三块真实数据源

## 2.1 `engine`

只负责 committed 层：

- document
- history
- base query / spatial index
- node / edge / selection / document 的 committed commands

它不负责：

- hover
- preview
- edge guide
- marquee
- node transient patch

这些都不该进 engine。

## 2.2 `local`

只负责稳定的本地 runtime state：

- tool
- viewport
- edit target
- draw preferences
- 少量稳定配置态

它不负责 interaction 过程中瞬时变化的 preview。

## 2.3 `transient`

只负责交互期临时态：

- hovered
- node patch
- hidden
- marquee
- edge guide
- edge reconnect preview
- draw preview
- mindmap drag preview
- interaction busy / space / transforming

也就是说：

**transient 是 runtime 真实状态，不是附属在 editor 旁边的一块 overlay。**

---

## 3. `read` 的职责

`read` 不再只是 committed read。

它应该是：

**engine committed + local state + transient 的统一只读投影。**

例如：

### 3.1 node read

不是：

- 先读 engine node
- 再去别处读 node patch
- 再手动合成

而应该直接：

```ts
board.read.node.view(nodeId)
```

内部自动合成：

- base node
- patch
- hidden
- resize / hover / interaction capability

### 3.2 edge read

直接：

```ts
board.read.edge.view(edgeId)
```

内部合成：

- base edge
- route preview
- reconnect preview
- guide / interaction 反馈

### 3.3 selection read

直接：

- `board.read.selection.summary`
- `board.read.selection.marquee`

### 3.4 feedback read

直接：

- `board.read.feedback.draw`
- `board.read.feedback.edgeGuide`
- `board.read.feedback.mindmapDrag`

结论：

**projection 只是 read，不是独立 runtime。**

---

## 4. `commands` 的职责

`commands` 只处理两类写：

### 4.1 写 committed

例如：

- document.replace
- node.update
- edge.update
- selection.replace
- history.undo / redo

### 4.2 写 local stable state

例如：

- tool.set
- viewport.setRect / setZoom / pan
- edit.start / clear
- draw.patch / draw.slot

它不负责：

- pointermove 中的 preview 写入
- hover 变化
- edge guide
- marquee

这些应该由 `dispatch` 驱动写 transient。

---

## 5. `dispatch` 的职责

`dispatch` 是唯一输入入口：

```ts
type BoardDispatch = {
  pointerDown(input): DispatchResult
  pointerMove(input): boolean
  pointerUp(input): boolean
  pointerCancel(input): boolean
  pointerLeave(): void
  wheel(input): boolean
  keyDown(input): boolean
  keyUp(input): boolean
  blur(): void
  cancel(): void
}
```

它做三件事：

### 5.1 解释语义输入

比如：

- pointer
- wheel
- keyboard
- blur

这些都已经是 host 解析后的语义输入，而不是 DOM event 本身。

### 5.2 驱动 feature session

比如：

- draw session
- selection session
- edge session
- transform session

### 5.3 写 transient，必要时提交 commands

也就是：

- move 时写 preview / hover / guide / patch
- up 时调用 commands 提交 committed 结果

---

## transient 与 projection 的最终设计

## 1. transient 是真实 store

最终应该存在一份明确的 transient state：

```ts
type BoardTransientState = {
  interaction: {
    busy: boolean
    space: boolean
    transforming: boolean
  }
  node: {
    hovered?: NodeId
    hidden: readonly NodeId[]
    patch: readonly NodePatchEntry[]
  }
  edge: {
    guide?: EdgeGuide
    patch: readonly EdgePatchEntry[]
  }
  draw: {
    preview?: DrawPreview
    hidden: readonly NodeId[]
  }
  selection: {
    marquee?: MarqueeState
    guides: readonly Guide[]
  }
  mindmap: {
    drag?: MindmapDragFeedback
  }
}
```

这里允许未来继续精简字段，但 ownership 应固定：

- hover 在 transient
- preview 在 transient
- patch 在 transient
- guide 在 transient

不要再把这些分散成：

- overlay
- projection
- preview runtime
- feedback runtime

---

## 2. projection 只是 `read` 的纯合成

例如：

### 2.1 node projection

不是：

- `nodeProjectionStore`
- `nodeProjectionPreviewRuntime`
- `nodeProjectionHiddenRuntime`

而是：

- `transient.node.patch`
- `transient.node.hidden`
- `read.node.view(nodeId)`

### 2.2 edge projection

不是：

- `edgeProjectionRuntime`

而是：

- `transient.edge.patch`
- `transient.edge.guide`
- `read.edge.view(edgeId)`

### 2.3 marquee / mindmap drag

也不是“投影子系统”，而是直接：

- `read.selection.marquee`
- `read.feedback.mindmapDrag`

结论：

**projection 一律变成 read 纯函数，不再拥有自己的 store、runtime、controller。**

---

## React 侧最终目录

长期最优目录应该是下面这样：

```txt
packages/whiteboard-react/src/
  board/
    createRuntime.ts
    context.ts
    Lifecycle.tsx
    types.ts

  engineBridge/
    read.ts
    commands.ts
    index.ts

  surface/
    Surface.tsx
    Bindings.tsx
    input.ts
    pick.ts
    clipboard.ts
    domTargets.ts
    pointerSession.ts
    types.ts

  interactions/
    controller.ts
    transient.ts
    types.ts
    draw/
    selection/
    edge/
    transform/
    mindmap/
    viewport/

  tool/
    model.ts
    types.ts

  draw/
    model.ts
    types.ts

  edge/
    preset.ts
    types.ts

  scene/
    node/
    edge/
    draw/
    mindmap/

  chrome/
    selection/
    toolbox/
    viewport/
```

关键原则：

- `board/` 只管 runtime 中轴，不放业务模型
- `surface/` 只管 DOM 宿主输入
- `interactions/` 只管 session 和 transient
- `tool/draw/edge` 放 pure model
- `scene/chrome` 只渲染

---

## 哪些东西应该从 `boardRuntime` 拆出去

## 1. 纯 committed runtime

当前 `boardRuntime` 里的这些部分，应该形成单独的 committed bridge：

- `runtime/editor/createEditor.ts`
- `runtime/commands/*`
- `runtime/read/*`
- `runtime/state/*`
- `runtime/viewport.ts`
- `runtime/clipboard.ts`

但注意：

这不意味着重新立一个大号 `editor runtime`。

它们应该成为 `BoardRuntime` 内部的 committed 读写桥，而不是新的主概念。

可以叫：

- `engineBridge`
- `documentBridge`
- `runtime/core`

但不要再叫 `editor runtime`。

## 2. pure model

这些不应留在 committed bridge 旁边：

- `tool/model.ts`
- `draw.ts`
- `draw/model.ts`
- `edge/preset.ts`
- `types/tool.ts`
- `types/draw.ts`

它们应该落回：

- `tool/`
- `draw/`
- `edge/`

## 3. surface / interaction types

这些也不应继续挂在 `boardRuntime`：

- `types/input.ts`
- `types/pick.ts`

应该放到：

- `surface/types.ts`
- 或 `interactions/types.ts`

取决于它们更偏 host 语义还是 interaction 语义。

原则是：

- DOM / pick / pointer semantic 属于 `surface`
- session / dispatch / feature lifecycle 属于 `interactions`

## 4. transient / overlay

这些应彻底离开 committed bridge：

- `runtime/overlay.ts`
- `runtime/overlay/*`

它们属于 `interactions/transient.ts`。

这一步是整个去旧思维最关键的一步。

---

## `BoardRuntime` 的最终 public surface

最终对外暴露的实例应该非常简单：

```ts
type WhiteboardInstance = {
  read: BoardRead
  commands: BoardCommands
  dispatch: BoardDispatch
  dispose(): void
}
```

如果必须为了宿主集成暴露极少量附加能力，也只能是稳定能力，例如：

- `configure(...)`

但不要暴露：

- `internals`
- `overlay`
- `projection`
- `interaction runtime`
- `host runtime`

这些都应是内部实现。

---

## React 组件层应该怎么读

组件层最终只应该读两类东西：

## 1. `board.read.*`

例如：

- `board.read.node.view(nodeId)`
- `board.read.edge.view(edgeId)`
- `board.read.selection.summary`
- `board.read.feedback.draw`

## 2. 组件本地 UI state

例如：

- menu open
- popover anchor
- submenu state

不要再有第三类“从 editor overlay 再取 interaction preview”的路径。

---

## 不应该放进 runtime 的东西

下面这些东西不应该放进 `BoardRuntime`：

- context menu open / close
- toolbar 展开状态
- hover menu anchor DOM 信息
- submenu key
- 组件私有 ref
- 各种临时弹层的 DOM 布局信息

这些都属于局部 React UI state。

`BoardRuntime` 只持有**跨 feature 共享且对行为正确性有意义的状态**。

---

## 为什么这是最简单的做法

因为它把每个概念压到只出现一次：

### 1. committed 只有一套

- `engine`

### 2. local stable state 只有一套

- `BoardRuntime.local`

### 3. transient 只有一套

- `BoardRuntime.transient`

### 4. input 只有一套入口

- `BoardRuntime.dispatch`

### 5. projection 只有一套解释

- `BoardRuntime.read` 的纯合成结果

这就避免了现在这种双重心智：

- 一边说 interaction 在 React
- 一边又把 transient、overlay、tool、input type 塞回“像 editor 的总桶”

---

## 一步到位实施顺序

下面按长期最优顺序给出落地步骤。

## 第 1 步：停止新增 `boardRuntime` 依赖

规则：

- 新代码不再 import `boardRuntime`
- 所有新增模块直接落到最终职责目录

这是第一前提。

## 第 2 步：把 committed bridge 从 `boardRuntime` 抽出来

目标：

- `board/createRuntime.ts` 不再 import `../boardRuntime`

动作：

- `runtime/editor/createEditor.ts`
- `runtime/read/*`
- `runtime/commands/*`
- `runtime/state/*`
- `runtime/viewport.ts`
- `runtime/clipboard.ts`

整体迁到新的 committed bridge 目录。

注意：

- 这一步不是为了新建 editor 包
- 只是把 committed 读写桥从综合桶中拆出来

## 第 3 步：把 overlay/transient 迁到 `interactions/transient`

目标：

- editor 不再持有 interaction preview

动作：

- `runtime/overlay.ts`
- `runtime/overlay/*`

迁到 `interactions/transient.ts` 及其子模块。

然后：

- interaction feature 直接写 transient
- scene/chrome 直接读 transient selector

## 第 4 步：把 pure model 拆散

目标：

- `boardRuntime` 不再是 pure model 的总出口

动作：

- tool -> `tool/*`
- draw -> `draw/*`
- edge preset -> `edge/*`
- input / pick type -> `surface/types` 或 `interactions/types`

## 第 5 步：统一 `BoardRuntime` public surface

目标：

- 实例上只保留：
  - `read`
  - `commands`
  - `dispatch`
  - `dispose`

必要时：

- `configure`

除此之外不再加顶层 namespace。

## 第 6 步：删空 `boardRuntime`

当前面所有内容都有最终归属之后：

- 删除 `boardRuntime` 目录
- 删除相关 re-export
- 删除所有 `boardRuntime` import

---

## 最终结论

如果严格按长期最优设计：

### 1. React 侧确实需要一个 runtime

但它应该是：

- **唯一的 `BoardRuntime`**

### 2. 不需要再保留独立 `editor runtime`

因为在 React 作为唯一宿主时，这只会制造中间层和 ownership 混乱。

### 3. `transient` 应该由 React runtime 整体负责

它是 runtime 的真实状态，而不是 editor 附属物。

### 4. `projection` 不应该再是 subsystem

它只应该是 `read` 的纯合成。

### 5. `boardRuntime` 这个综合桶不该长期存在

它应被视为迁移残留，并按职责拆空后删除。

如果只保留一句最重要的话，那就是：

**长期最优不是“保留 editor runtime 再包一层 React runtime”，而是“只保留一个 React 侧 `BoardRuntime`，它整体拥有 committed、local、transient、dispatch 和 merged read”。**
