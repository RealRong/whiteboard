# Whiteboard React 侧长期最优简化方案

## 目标

这份文档只回答一个问题：

在已经把 `interactions` 从 `@whiteboard/editor` 迁到 `@whiteboard/react` 之后，**React 侧整体还可以怎样继续收敛，做到长期最优、概念最少、文件更顺、边界更清晰**。

约束：

- 不考虑兼容
- 不考虑过渡
- 不新开包
- 直接按长期最优设计
- `@whiteboard/editor` 继续保持纯 runtime

一句话结论：

**React 侧当前最大的问题，不是某个 feature 太复杂，而是把“React host 行为”继续伪装成了一个“像 editor 一样的 runtime”。**

最优方向不是继续给 `WhiteboardRuntime` 打补丁，而是：

- `editor` 回到纯 editor
- `react` 内部建立一个很薄的 `board controller`
- 所有 DOM 监听、输入解析、交互调度、pick/clipboard/pointer 等宿主能力都收在这个 controller 周围
- 组件只读 `editor`、读少量 React host store、渲染

---

## 当前 React 侧的主要异味

下面这些问题，不是彼此独立的，而是同一个结构问题的不同表现。

## 1. `WhiteboardRuntime` 是一个“伪 editor”

当前 `packages/whiteboard-react/src/types/runtime.ts` 里：

- `WhiteboardRuntime = EditorBaseRuntime + input + state.interaction + configure`

这会带来几个问题：

- React host 自己的行为层，被重新包装成一个 editor-like 对象
- `useEditor()` 拿到的不再是纯 editor，而是“editor + host behavior 的混合物”
- `input`、`interaction state`、`host policy` 继续绕着 editor 转
- React 内部很多地方看起来像在调用 editor，实际是在调用 host 行为层

这就是现在最别扭的根源之一。

长期最优不应该是：

- `editor.input.pointerDown(...)`
- `editor.state.interaction.get()`

而应该是：

- `editor` 只负责 runtime
- `board.interaction.dispatch.pointerDown(...)`
- `board.interaction.state.get()`

也就是说：

**不要再把 React host 行为伪装成 editor。**

---

## 2. 启动链和生命周期被拆得太碎

当前链路大致是：

- `Whiteboard.tsx`
- `runtime/whiteboard/config.ts`
- `runtime/whiteboard/runtime.ts`
- `runtime/whiteboard/DocumentSync.tsx`
- `runtime/whiteboard/CollabLifecycle.tsx`
- `runtime/whiteboard/EditorLifecycle.tsx`

这会造成几个问题：

- Whiteboard 根组件只是“到处拼零件”
- 运行时创建和运行时副作用分散在多个小文件里
- 配置、engine、editor、interaction、host、document sync、collab 的关系不在一个地方闭环

这些文件都不算错，但组合起来过于碎。

长期最优应该是：

- 一个创建 controller 的地方
- 一个生命周期组件
- 一个 surface 组件

就够了。

---

## 3. DOM 输入被拆成了多条并行链

当前相关文件：

- `canvas/usePointer.ts`
- `canvas/useKeyboard.ts`
- `canvas/useClipboard.ts`
- `runtime/viewport/useBindViewportInput.ts`
- `runtime/host/input.ts`
- `runtime/host/domTargets.ts`
- `runtime/host/pointerSession.ts`
- `runtime/host/selectionLock.ts`
- `runtime/host/shortcut.ts`

这里的问题不是“文件太多”本身，而是 ownership 不清楚。

例如：

- pointer 走一条链
- wheel 走一条链
- keyboard 走一条链
- clipboard 走一条链
- focus/blur 分散在不同 hook 里
- rect 同步散在 pointer/wheel 逻辑里

结果就是：

- 宿主输入层没有单一中轴
- rect/pointer/focus/stopPropagation/ignore target 这些公共逻辑被多处分摊
- 读起来不像一条顺的 host pipeline

长期最优应该是：

**一个 `SurfaceBindings` 负责整个容器输入生命周期。**

它统一处理：

- pointer
- wheel
- keyboard
- clipboard
- blur
- focus
- container rect
- pointer capture

---

## 4. interaction runtime 还有一层过度中轴

当前：

- `interactions/createRuntime.ts`
- `interactions/runtime/runtime.ts`
- `interactions/runtime/types.ts`
- `interactions/runtime/ctx.ts`

再往下又有：

- `InteractionFeature`
- `owner`
- `observe`
- `session`
- `control.update`
- `mode`

这里最大的问题不是“抽象层数多”这么简单，而是：

**很多内部 phase 被提升成了公共的 runtime 概念。**

例如：

- `press`
- `marquee`
- `node-drag`
- `edge-drag`
- `edge-connect`
- `edge-route`

这些本质上都只是 feature 内部阶段。

UI 真正关心的其实通常只有：

- 当前是否 busy
- 当前是否显示 chrome
- 当前是否在 transform
- 当前是否按着空格

所以，当前 interaction 中轴的问题是：

- 内部 phase 泄漏成了中轴协议
- `owner.observe` 这层嵌套让读写都更绕
- `control.update` 允许 session 动态改 mode/chrome，进一步放大了中轴复杂度

长期最优应该是：

- 中轴只表达少量公共语义
- feature 内部 phase 保留在 feature 自己内部
- 删掉不必要的 mode 暴露

---

## 5. React Context 被切成了几块，但并没有真正降低复杂度

当前有：

- `EditorProvider`
- `EnvironmentProvider`
- `HostProvider`

以及对应的：

- `useEditor`
- `useNodeRegistry`
- `useResolvedConfig`
- `useHostRuntime`

这会导致：

- Whiteboard 根组件 provider 嵌套
- “我现在应该拿哪个 context”不够直觉
- 运行时关系被人为拆散

长期最优应该是：

- 一个 `BoardProvider`
- 一个稳定的 `BoardController`
- editor / registry / config / interaction / host 都挂在 controller 上

外部不必知道 controller 的全部内容，但 React 内部应该有一个单一中轴。

---

## 6. `features` 目录混合了 scene、chrome、view-model、registry、命令拼装

当前 `features` 下面混着：

- scene layer
- overlay layer
- toolbar/context menu
- 纯 view model
- registry/renderers

这导致“features”这个词几乎失去信息量。

最典型的几个热点文件：

- `features/selection/chrome/ContextMenu.tsx`
- `features/node/selection.ts`
- `features/node/textLayout.ts`

这些不是简单地“大文件”问题，而是：

- UI 渲染
- 业务 view model
- editor command binding
- selection summary 派生
- DOM 行为

被混在一起。

长期最优应该把 React 包内部按职责切成四个层次：

- `board`
- `surface`
- `interactions`
- `scene` / `chrome`

---

## 最终目标架构

## 1. 最终公共模型

对外公开的实例，应该就是纯 editor。

也就是：

- `Whiteboard` ref 暴露 `Editor`
- `useEditor()` 返回 `Editor`

不再对外公开：

- `WhiteboardRuntime`
- `editor.input`
- `editor.state.interaction`

这些都是 React host 内部实现，不应该伪装成 editor 的 public surface。

最终公共面应尽量收敛为：

- `Whiteboard`
- `useEditor`
- `createNodeRegistry`
- `createDefaultNodeRegistry`
- React props / node registry types

---

## 2. 最终内部中轴：`BoardController`

React 内部应该只有一个真正的中轴。

建议模型：

```ts
type BoardController = {
  editor: Editor
  engine: EngineInstance
  registry: NodeRegistry
  config: ReadStore<ResolvedConfig>
  interaction: InteractionController
  host: {
    pick: PickRegistry
    clipboard: ClipboardHostAdapter
    pointerWorld: ReadStore<Point | undefined>
  }
  sync: {
    configure: (config: ResolvedConfig) => void
    replaceDocument: (document: Document) => void
    dispose: () => void
  }
}
```

这里有几个关键原则：

- `editor` 是纯 runtime，不扩展
- `config` 是 board 级 store，不挂到 editor 上
- `interaction` 是 React host 层自己的 controller
- `host` 只保留真正需要跨组件共享的宿主能力
- pointer capture / selection lock 这类纯绑定细节不进 controller 公共面

注意：

`BoardController` 是 React 包内部中轴，不需要作为公开 API 暴露出去。

---

## 3. 最终 Context 模型

保留单一 `BoardProvider`：

```ts
const BoardContext = createContext<BoardController | null>(null)
```

内部 hook 分工：

- `useBoard()` 取 controller
- `useEditor()` 返回 `useBoard().editor`
- `useBoardConfig()` 读 `useBoard().config`
- `useInteractionState()` 读 `useBoard().interaction.state`
- `useNodeRegistry()` 读 `useBoard().registry`

这样可以保留语义 hook，但底层不再是三层 context。

---

## 4. 最终 Whiteboard 启动链

最终应收敛成三件事：

### 4.1 `board/createController.ts`

负责创建：

- engine
- editor
- interaction controller
- host services
- board config store

### 4.2 `board/WhiteboardLifecycle.tsx`

负责副作用：

- editor configure
- document sync
- collab lifecycle
- dispose

### 4.3 `surface/Surface.tsx`

负责：

- scene render
- chrome render
- surface bindings

也就是说，最终不再保留：

- `runtime/whiteboard/runtime.ts`
- `runtime/whiteboard/config.ts`
- `runtime/whiteboard/DocumentSync.tsx`
- `runtime/whiteboard/CollabLifecycle.tsx`
- `runtime/whiteboard/EditorLifecycle.tsx`

而是把它们收成：

- `board/createController.ts`
- `board/WhiteboardLifecycle.tsx`

---

## 5. 最终 Surface 输入层

最优模型不是 4 个 hook 并排绑定，而是一个统一的 surface lifecycle。

### 5.1 最终模型

```ts
type SurfaceBindings = {
  bind: (container: HTMLDivElement) => () => void
}
```

或者以 React 组件形式存在：

- `surface/SurfaceBindings.tsx`

但它内部只做一件事：

**接管整个容器的宿主输入。**

### 5.2 它负责的内容

- pointer down / move / up / cancel / leave
- wheel
- keydown / keyup
- blur
- copy / cut / paste
- focus on pointerdown
- container rect sync
- pointer capture
- wheel raf batching
- host pointer world 同步

### 5.3 它不负责的内容

- 不负责 feature 决策
- 不负责 editor 命令逻辑
- 不负责 UI 菜单

它只做：

- DOM 监听
- 输入语义化
- 转发给 interaction / clipboard / shortcut

### 5.4 直接可以删除的现有拆分

最终应删除并合并：

- `canvas/usePointer.ts`
- `canvas/useKeyboard.ts`
- `canvas/useClipboard.ts`
- `runtime/viewport/useBindViewportInput.ts`

它们合并成：

- `surface/bindings.ts`

---

## 6. 最终输入解析层

当前 `runtime/host/input.ts` 和 `runtime/host/domTargets.ts` 本质上都属于 surface 输入语义化，不应该放在 `runtime/host` 这种模糊目录里。

最终建议：

- `surface/resolveEvent.ts`
- `surface/dom.ts`
- `surface/pick.ts`

其中：

- `resolvePointerInput`
- `resolveWheelInput`
- `resolveKeyboardInput`
- target ignore / editable 判断

都归到 `surface`。

命名上也应避免继续叫 `host/input.ts`，因为这条线不是通用 host runtime，而是 **surface DOM input**。

---

## 7. 最终 interaction 中轴

## 7.1 原则

interaction 中轴要继续保留，但必须极薄。

它只做三件事：

- 根据优先级尝试启动 session
- 管理一个 active session
- 转发 hover / leave / wheel / key / blur

不要再让它承担“feature 内部 phase 建模”。

## 7.2 最终 handler 形状

建议把当前：

- `InteractionFeature`
- `owner`
- `observe`

收成一个更直接的 handler：

```ts
type InteractionHandler = {
  key: string
  priority?: number
  start?: (ctx: InteractionDeps, input: PointerDownInput, helpers: SessionHelpers) => SessionStart
  hover?: (ctx: InteractionDeps, input: PointerMoveInput) => void
  leave?: (ctx: InteractionDeps) => void
  wheel?: (ctx: InteractionDeps, input: WheelInput) => boolean
  clear?: (ctx: InteractionDeps) => void
}
```

也就是说：

- 删掉 `owner`
- 删掉 `observe`
- handler 顶层直接声明能力

这样整条线会顺很多。

## 7.3 最终 session 形状

```ts
type InteractionSession = {
  kind: 'select' | 'draw' | 'viewport' | 'transform' | 'edge' | 'mindmap'
  pointerId?: number
  chrome?: boolean
  autoPan?: AutoPanOptions
  move?: (ctx: InteractionDeps, input: PointerMoveInput) => void
  up?: (ctx: InteractionDeps, input: PointerUpInput) => void
  keyDown?: (ctx: InteractionDeps, input: KeyboardInput) => void
  keyUp?: (ctx: InteractionDeps, input: KeyboardInput) => void
  blur?: (ctx: InteractionDeps) => void
  cancel?: (ctx: InteractionDeps) => void
  cleanup?: (ctx: InteractionDeps) => void
}
```

关键点：

- `kind` 只保留粗粒度类型
- feature 内部 phase 自己在闭包里维护
- 不再把 `press`、`marquee`、`edge-route` 这种内部 phase 抬到中轴公共类型里

### 例子

selection interaction 内部可以有：

- `phase = 'press' | 'move' | 'marquee'`

但这是 selection 自己的内部状态，不应该成为全局 `InteractionMode`。

## 7.4 最终 interaction 状态

最终对 UI 暴露的状态只保留真正有消费方的字段：

```ts
type InteractionViewState = {
  busy: boolean
  chrome: boolean
  transforming: boolean
  space: boolean
}
```

如果未来没有真实消费者，不要继续暴露：

- `drawing`
- `panning`
- `selecting`
- `editingEdge`
- 细粒度 `mode`

原则是：

**UI 只读它真的要读的状态。**

---

## 8. `createWhiteboardRuntime` 这层最终应删除

当前 `interactions/createRuntime.ts` 负责把：

- `editor`
- `input`
- `state.interaction`

重新包成一个 `WhiteboardRuntime`。

这一步在迁移过程中是合理的，但长期不是最优。

长期最优应该是：

- `createBoardController(...)`
- `controller.editor`
- `controller.interaction`

而不是：

- `createWhiteboardRuntime(...)`
- 返回一个“长得像 editor，但掺了 React host 行为”的对象

所以最终应删除：

- `packages/whiteboard-react/src/interactions/createRuntime.ts`
- `packages/whiteboard-react/src/types/runtime.ts` 里的 `WhiteboardRuntime` 扩展模型

改成：

- `packages/whiteboard-react/src/board/createController.ts`
- `packages/whiteboard-react/src/board/types.ts`

---

## 9. `features` 的最终重组

React 包内部不应该继续把所有东西都塞在 `features`。

最优目录建议：

```txt
packages/whiteboard-react/src/
  board/
    Whiteboard.tsx
    context.ts
    createController.ts
    WhiteboardLifecycle.tsx

  surface/
    Surface.tsx
    SurfaceBindings.tsx
    resolveEvent.ts
    dom.ts
    pick.ts
    clipboard.ts
    shortcut.ts

  interactions/
    controller.ts
    types.ts
    snap.ts
    autoPan.ts
    draw/
    edge/
    select/
    transform/
    viewport/
    insert/
    mindmap/

  scene/
    draw/
    edge/
    mindmap/
    node/

  chrome/
    selection/
    toolbox/
    viewport/

  types/
```

这里最重要的不是名字本身，而是职责边界：

- `board` 负责创建和生命周期
- `surface` 负责 DOM host
- `interactions` 负责操作行为
- `scene` 负责文档渲染
- `chrome` 负责工具栏、菜单、覆盖层

这样 `features` 现在混合的职责会自然打开。

---

## 10. 几个重点模块的最终拆法

## 10.1 `features/node/selection.ts`

这个文件当前同时承担：

- selection summary 派生
- command 绑定
- toolbar/context menu view model
- selection box presentation

最终应拆成：

- `chrome/selection/model.ts`
  - 纯 view model
- `chrome/selection/actions.ts`
  - 命令闭包
- `chrome/selection/usePresentation.ts`
  - React hook 组合

目标是：

- 纯派生函数不混 JSX
- command binding 不混 summary 计算
- presentation hook 只负责组装

## 10.2 `features/selection/chrome/ContextMenu.tsx`

这个文件太大，核心原因不是 UI 多，而是把：

- context target 解析
- selection sync
- menu tree 构建
- action binding
- submenu UI

都混在一起了。

最终应拆成：

- `chrome/selection/contextMenu/model.ts`
  - 纯菜单树生成
- `chrome/selection/contextMenu/actions.ts`
  - 菜单动作绑定
- `chrome/selection/contextMenu/ContextMenu.tsx`
  - 纯渲染和交互壳

如果一个文件同时知道：

- selection summary
- edge action
- node style action
- clipboard
- DOM placement

那它一定会继续长。

## 10.3 `features/node/textLayout.ts`

这个文件属于另一个典型问题：

- 文本测量缓存
- registry 绑定
- DOM host 协作
- editor 编辑状态桥接

没有切开。

最终应拆成：

- `scene/node/text/measure.ts`
  - 纯测量和缓存
- `scene/node/text/source.ts`
  - 文本来源解析
- `scene/node/text/useTextLayout.ts`
  - React hook 包装

这样文本测量链路才会真正清楚。

---

## 11. React 侧应该保留什么，应该删除什么

## 11.1 应该保留

- React 作为 host 行为层
- interaction controller
- pick registry
- clipboard adapter
- shortcut resolver
- scene/chrome 渲染

## 11.2 应该删除

- `WhiteboardRuntime extends Editor` 这种混合模型
- `editor.input.*` 这种伪 editor 调用方式
- 多个 Provider 并列
- 多个 canvas 输入 hook 并列
- `owner.observe` 这层嵌套
- 对 UI 暴露细粒度 interaction phase

---

## 一步到位实施方案

下面是严格按最终形态来做的顺序，不做兼容。

## 第 1 步：删掉 `WhiteboardRuntime` 扩展模型

目标：

- `useEditor()` 返回纯 `Editor`
- `Whiteboard` ref 暴露纯 `Editor`

动作：

- 删除 `types/runtime.ts` 里的扩展 runtime 模型
- `WhiteboardInstance` 直接对齐 `Editor`
- 所有 `editor.input` 调用改走 `board.interaction.dispatch`
- 所有 `editor.state.interaction` 读取改走 `useInteractionState()`

这是整次 React 侧收敛的第一前提。

## 第 2 步：建立单一 `BoardController`

目标：

- React 内部只有一个运行时中轴

动作：

- 新建 `board/createController.ts`
- 把当前：
  - `useWhiteboardConfig`
  - `useWhiteboardRuntime`
  - `createHostRuntime`
  - `createWhiteboardRuntime`
  收到 controller 创建流程里

最终 Whiteboard 根组件只拿到：

- `controller`

## 第 3 步：合并 Context

目标：

- 一个 `BoardProvider`

动作：

- 删除：
  - `EditorProvider`
  - `EnvironmentProvider`
  - `HostProvider`
- 新建：
  - `board/context.ts`

保留语义 hook，但底层只走一个 controller context。

## 第 4 步：合并生命周期组件

目标：

- Whiteboard 根组件不再拼 3 个 lifecycle component

动作：

- 把：
  - `DocumentSync.tsx`
  - `CollabLifecycle.tsx`
  - `EditorLifecycle.tsx`
  合并成：
  - `board/WhiteboardLifecycle.tsx`

这个组件内部可以分多个 effect，但 ownership 必须在一个地方。

## 第 5 步：合并 surface 事件绑定

目标：

- 所有 DOM 事件绑定只保留一个入口

动作：

- 把：
  - `usePointer.ts`
  - `useKeyboard.ts`
  - `useClipboard.ts`
  - `useBindViewportInput.ts`
  合并成：
  - `surface/SurfaceBindings.tsx`

同时把：

- rect sync
- focus
- blur
- pointer capture
- wheel batching

都收进去。

## 第 6 步：收薄 interaction 中轴

目标：

- 删除 `owner.observe`
- 删除细粒度 mode 暴露
- 保留一个极薄 dispatcher

动作：

- 把当前 `interactions/runtime/*` 收成：
  - `interactions/controller.ts`
  - `interactions/types.ts`
  - `interactions/snap.ts`
  - `interactions/autoPan.ts`

- feature 协议改为：
  - `start`
  - `hover`
  - `leave`
  - `wheel`
  - `clear`

- session 内部维护 feature 自己的 phase

## 第 7 步：拆 selection / context menu / text layout 三个热点

目标：

- 把 React 侧剩余的大块复杂度拆回职责边界

动作：

- `features/node/selection.ts` 拆为 `chrome/selection/*`
- `features/selection/chrome/ContextMenu.tsx` 拆为 `chrome/selection/contextMenu/*`
- `features/node/textLayout.ts` 拆为 `scene/node/text/*`

这一步不只是为了文件小，而是为了把：

- pure model
- action binding
- React composition

彻底分开。

## 第 8 步：重组目录

目标：

- 从“混合 features/runtime/canvas/host”切到“board/surface/interactions/scene/chrome”

动作：

- `canvas` 并入 `surface`
- `runtime/host` 并入 `surface`
- `features/draw|edge|mindmap|node` 中的 scene 部分并入 `scene`
- `features/selection|toolbox|viewport` 并入 `chrome`

---

## 最终效果

如果严格按这份方案一步到位完成，React 侧最终会变成：

### 1. 概念更少

从现在的：

- editor runtime
- whiteboard runtime
- host runtime
- interaction runtime
- 多个 provider
- 多个 canvas hook

收敛成：

- editor
- board controller
- interaction controller
- surface bindings

### 2. 调用关系更顺

从现在的：

- DOM -> canvas hook -> editor.input -> interaction runtime -> editor commands

变成：

- DOM -> surface bindings -> interaction controller -> editor commands

### 3. 组件心智更清楚

- scene 组件只负责渲染文档
- chrome 组件只负责菜单和工具
- interaction 只负责操作
- board 只负责创建和生命周期

### 4. editor 边界更稳

React 侧不再反向把 host 行为补回 editor。

这会让：

- `@whiteboard/editor`
- `@whiteboard/react`

之间的边界真正稳定下来。

---

## 最终结论

React 侧当前最该做的，不是继续微调某几个 interaction 文件，而是把整个中轴换成更直接的模型：

- **公共面只暴露纯 editor**
- **内部只保留一个 board controller**
- **所有 DOM 绑定收成一个 surface lifecycle**
- **interaction 中轴只保留极薄调度，不暴露 feature 内部 phase**
- **scene 和 chrome 从 `features` 里明确拆开**

如果只给一个最关键的判断，那就是：

**`WhiteboardRuntime` 这层不该长期存在。**

它是迁移阶段可以接受的桥，但不是长期最优结构。

长期最优结构应该是：

- `Editor`
- `BoardController`
- `InteractionController`
- `SurfaceBindings`

这四层足够了。
