# Whiteboard Editor 内部 API / 状态传递 / 状态建模全链路研究与收敛方案

## 1. 文档目标

这份文档回答四个问题：

1. `whiteboard-editor` 当前内部 API 的真实结构是什么
2. 状态在 `core -> engine -> editor -> react` 这条链路里是如何传递的
3. 状态建模还能否继续简化
4. 各层之间的调用面还能否继续收敛，如果可以，长期最优应该怎么改

本文基于当前仓库代码快照进行分析，重点覆盖：

- `packages/whiteboard-editor/src/features/draw/state.ts`
- `packages/whiteboard-editor/src/runtime/selection/state.ts`
- `packages/whiteboard-editor/src/runtime/frame/state.ts`
- `packages/whiteboard-editor/src/runtime/read/*`
- `packages/whiteboard-editor/src/runtime/instance/createInstance.ts`
- `packages/whiteboard-react/src/Whiteboard.tsx`
- `packages/whiteboard-react/src/canvas/useCanvasDown.ts`
- `packages/whiteboard-react/src/features/*`
- `packages/whiteboard-engine/src/instance/engine.ts`
- `packages/whiteboard-engine/src/read/store/*`
- `packages/whiteboard-engine/src/write/*`
- `packages/whiteboard-core/src/kernel/reduce.ts`
- `packages/whiteboard-core/src/node/index.ts`

本文与以下已有文档保持一致，但这次更强调“状态链路”和“内部 API 收敛”：

- `WHITEBOARD_EDITOR_PUBLIC_API_AND_SEMANTIC_COMMAND_LONG_TERM_DESIGN.zh-CN.md`
- `WHITEBOARD_EDITOR_RUNTIME_ACTION_CHROME_BOUNDARY_OPTIMAL_DESIGN.zh-CN.md`
- `WHITEBOARD_REACT_BOUNDARY_LONG_TERM_OPTIMAL_DESIGN.zh-CN.md`
- `WHITEBOARD_EDITOR_EXPORT_CLEANUP_AND_CONVERGENCE_PLAN.zh-CN.md`

---

## 2. 结论

结论先说：

**可以进一步简化，而且空间很大。**

但这次需要看到的重点不是：

- `draw/state.ts` 单个文件导出太多

而是：

- **同一个概念在四层里被重复建模**
- **editor 既做 UI runtime state，又做 engine read 二次投影，又做交互 session 装配**
- **react 不是只消费 public editor API，而是在大量直接消费 `InternalEditor` 与 `internals.*`**

当前复杂度的真实来源，不是“state 多”，而是：

1. **存储状态、派生状态、交互期临时状态、UI presentation 状态没有被严格分层**
2. **public API、host API、editor internal API 没有被严格隔离**
3. **同一条数据链在每一层都重新包装一次**

一句话概括当前问题：

**现在不是某层太厚，而是每一层都在加一层自己的模型。**

长期最优里，建议把整条链收敛为：

- `core` 只保留文档模型、operation、纯算法
- `engine` 只保留 committed document runtime、write pipeline、read projection、store 基建
- `editor` 只保留 editor 本地状态、交互 session、preview/ephemeral runtime、host-facing read/commands facade
- `react` 只保留 DOM 绑定、React hooks、组件组合、presentation view-model

## 2.1 已落地状态（2026-03-28）

本文对应的第一轮全链路收敛已经在仓库中落地，当前代码状态与本文长期方向的关系如下：

- 已完成 `draw` canonical 类型统一：
  `whiteboard-editor` 内部以 `DrawPreferences` 作为规范命名；`whiteboard-react` 不再维护独立实现，`packages/whiteboard-react/src/features/draw/state.ts` 已改成对 editor canonical API 的 re-export。
- 已完成 `selection` read / planner 拆分：
  `read.selection` 现在只返回纯快照；选择按下规划已从 `read.selection.press(...)` 移到 `Editor.host.selection.planPress(...)`。
- 已完成 public host 收敛：
  `Editor` 新增 `host`，统一承载 React 需要的运行时对象，包括 `interaction`、`viewport`、`pick`、`snap`、`selection`、`node`、`edge`、`mindmap`、`registry`。
- 已完成 React 对 internal editor 的去耦：
  `whiteboard-react` 已不再依赖 `InternalEditor`、`internals.*`、`as unknown as` 的桥接写法，也不再直接读取 `engine.read`。
- 已完成 node generic write 收口：
  `commands.node.raw.update/updateMany` 已替换为 `commands.node.document.update/updateMany`，React 与 editor 内部调用已迁移。
- 已完成 frame public read 收口：
  `Editor.read.frame.scope` 已补齐，React 公共读取已切到该入口。
- 已完成 instance 装配异味治理：
  `createInstance.ts` 已移除 `null as unknown as` 回填式构造，改为延迟绑定实例引用后装配 controllers。
- 已完成 demo/workspace 适配：
  `apps/demo` 已补齐 `@whiteboard/editor` / `@whiteboard/collab` 的 Vite 与 TS path alias，保证源代码模式下的构建链可继续工作。

当前仍然保留的内容主要是“兼容性别名”和 editor 包内部对 `InternalEditor` 的私有使用，这部分属于内部实现细节，不再暴露给 `@whiteboard/react` 或外部宿主。

---

## 3. 当前全链路状态图

## 3.1 `core`：领域模型与纯算法

`core` 当前主要负责：

- 文档模型
- node/edge/mindmap 的纯领域算法
- operation reducer 与 read impact 计算

代表文件：

- `packages/whiteboard-core/src/kernel/reduce.ts`
- `packages/whiteboard-core/src/node/index.ts`

这层的状态是：

- **committed document state**
- **operation impact**
- **纯计算结果**

这层本身没有明显的 UI runtime state 污染，本轮不应该再把 selection press policy、draw preview、toolbar presentation 之类的概念继续推回 `core`。

## 3.2 `engine`：committed runtime + write/read pipeline

`engine` 当前主要负责：

- 接收 write command
- translate 成 operation
- 交给 `core` reducer
- 基于 read impact 维护 read projection

代表文件：

- `packages/whiteboard-engine/src/instance/engine.ts`
- `packages/whiteboard-engine/src/write/index.ts`
- `packages/whiteboard-engine/src/read/store/index.ts`
- `packages/whiteboard-engine/src/read/store/node.ts`
- `packages/whiteboard-engine/src/read/store/edge.ts`

这层的状态是：

- 文档真值
- history
- read projection cache
- index cache

这层已经相对纯：

- committed write 在这里
- committed read projection 在这里
- store 基建在这里

但它不应该继续承接：

- tool
- draw 偏好
- selection local state
- frame scope
- edit target
- preview patch
- marquee/session/drag/connect state

这些都属于 editor runtime，而不是 engine committed runtime。

## 3.3 `editor`：本地状态 + session + read overlay + command adapter

`editor` 当前已经形成一整层完整 runtime，主要包括：

- 本地 UI state
- interaction coordinator
- draw/edit/selection/frame state
- pick/snap/viewport runtime
- node/edge/mindmap 的 preview/session runtime
- 基于 engine.read 的二次 read 包装
- 基于 engine.commands 的语义 command 包装

代表文件：

- `packages/whiteboard-editor/src/runtime/instance/createInstance.ts`
- `packages/whiteboard-editor/src/runtime/instance/types.ts`
- `packages/whiteboard-editor/src/runtime/read/*`
- `packages/whiteboard-editor/src/runtime/commands/*`
- `packages/whiteboard-editor/src/features/node/session/*`
- `packages/whiteboard-editor/src/features/edge/preview.ts`
- `packages/whiteboard-editor/src/features/selection/*`

当前 `editor.state` 直接暴露了：

- `tool`
- `draw`
- `edit`
- `selection`
- `frame`
- `interaction`

当前 `editor.read` 又重新包装了：

- `node`
- `edge`
- `selection`
- `tool`
- `pick`
- `history`

这说明 `editor` 已经不是一个薄 adapter，而是一层独立 runtime。

## 3.4 `react`：host binding + 组件 + 直接越界访问 editor internals

`react` 当前除了组件和 hooks 之外，还直接承担了很多 runtime 协调职责：

- pointer/wheel/clipboard DOM 绑定
- `useCanvasDown` 顶层输入调度
- 对 `instance.internals.*` 的直接读写
- 对 `InternalEditor` 的直接类型依赖
- 基于 editor read 再做一层 view-model/presentation model

代表文件：

- `packages/whiteboard-react/src/Whiteboard.tsx`
- `packages/whiteboard-react/src/canvas/useCanvasDown.ts`
- `packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts`
- `packages/whiteboard-react/src/features/node/selection.ts`
- `packages/whiteboard-react/src/features/node/hooks/useNodeView.ts`
- `packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts`

---

## 4. 当前状态传递的真实样子

## 4.1 draw 链路

当前 draw 链路是：

1. `editor.state.draw` 保存笔刷 slot/style 偏好
2. `react/features/draw/state.ts` 又定义了一份几乎同构的 `DrawState` / selector 类型
3. toolbox/palette 用 React 侧 draw selector 读 editor state
4. `useDrawInput` 在 pointer down 时读取 `instance.state.draw.get()`
5. pointer move 期间本地维护 preview points
6. pointer up 时直接 `instance.commands.node.create(...)`
7. 进入 engine write -> core reduce

这里的问题不是 draw 功能复杂，而是：

- **一份 draw state 同时充当 editor 内部 store 定义、public type、React selector source**
- **editor 和 react 各自维护一套 draw 类型**
- **active draw style 不是稳定 read API，而是由上层到处自己组合**

## 4.2 selection 链路

当前 selection 至少有四层模型：

1. `SelectionInput`
2. `SelectionSource`
3. `SelectionView`
4. React 侧 `NodeSelectionView` / `SelectionPresentation`

同时：

- `runtime/selection/state.ts` 既定义 source，又定义 commands，又定义 view
- `runtime/read/selection.ts` 把 `SelectionRead` 做成 `ReadStore<SelectionView> & { press(...) }`
- `react/features/node/selection.ts` 再派生 summary、can、selectionBox、chrome

也就是说：

- selection 的“存储状态”
- selection 的“派生视图”
- selection 的“交互规划”
- selection 的“UI presentation”

目前被绑定得太紧，而且都叫 selection。

## 4.3 frame 链路

当前 frame state 分成：

- `frame.source: NodeId | undefined`
- `frame.store: FrameScope`

其中 `FrameScope` 包含：

- `id`
- `ids`
- `set`

这里真正持久的只有 `frameId`，其他都是派生值。

但当前：

- state 层直接暴露了派生 scope
- finalize 又会基于 commit 结果修正 frame/selection/edit
- pointer down 归一化时还会做 active frame 校验

也就是说，frame 的“状态”和“派生过滤视图”没有分开。

## 4.4 node / edge 链路

当前 node/edge 也都有多层模型：

- engine.read.node.item / edge.item
- editor.read.node.item / edge.item
- editor.read.edge.view
- react `NodeView` / `NodeOverlayView` / `SelectedEdgeView`

其中 editor.read 再次做了：

- node preview patch 投影
- node interaction 投影
- edge preview patch 投影
- edge view 能力计算

这意味着：

- engine 已有 committed projection
- editor 又有 preview overlay projection
- react 再做 presentation projection

这三层不是都错，但目前缺少“哪层是 canonical host read API”的统一定义。

---

## 5. 当前复杂度的真实来源

## 5.1 概念镜像过多

这次检查里，最典型的镜像有：

- `DrawState` 在 editor/react 两边各定义一份
- selection 有 `Input / Source / View / NodeSelectionView / SelectionPresentation`
- node 有 `NodeItem / NodeInteraction / NodeView / NodeOverlayView`
- edge 有 `EdgeItem / RuntimeEdgeView / SelectedEdgeView`

问题不是“多做一层 view-model”本身，而是：

- **每层都在同时做 view-model**

长期最优里，一个概念最多保留：

1. 一个 canonical stored state
2. 一个 canonical runtime snapshot
3. 一个 host/presentation 局部 view-model

现在很多概念已经超过这个数量。

## 5.2 internal API 泄漏严重

本次代码快照里，直接量化结果如下：

- `whiteboard-react` 中直接访问 `instance.internals.*` 的文件数：**16**
- `whiteboard-react` 和 `whiteboard-editor` 中直接依赖 `InternalEditor` 的文件数：**25**
- 直接使用 `commands.node.raw.update / updateMany` 的文件数：**4**
- `DrawState` 同构定义出现次数：**2**

这几个数字说明：

- React 并没有只依赖 editor public API
- raw write path 还在往上层渗透
- 内部实现细节已经被上层拿来当协议使用

### 最明显的泄漏点

1. `react` 直接用 `instance.internals.selection.marquee / gesture / node.transform`
2. `react` 直接用 `instance.internals.edge.preview / snap / connect`
3. `react` 直接用 `instance.internals.viewport`
4. `react/runtime/input/pointer.ts` 通过 `as unknown as` 去桥接 editor 内部类型
5. `createInstance.ts` 通过 `null as unknown as` 先占位再回填 session

这说明：

- 内部 API 不是“内部”，而是已经变成 host 可见依赖
- 装配阶段存在循环依赖或职责顺序不清

## 5.3 `editor.read` 混入了不止一种职责

当前 `editor.read` 至少混了四类能力：

1. committed read 包装
2. preview overlay read
3. capability read
4. interaction policy read

最典型的问题是：

`SelectionRead = ReadStore<SelectionView> & { press(...) }`

也就是：

- 同一个对象既是“快照读取”
- 又是“交互规划器”

这会导致：

- host 很难知道哪些方法是稳定读取，哪些只是交互内部策略
- selection snapshot 与 selection planner 的边界被抹平

## 5.4 editor 本地状态、ephemeral state、derived state 混放

当前 editor 里混杂了三种完全不同的状态：

### A. 持久 editor 本地状态

- tool
- draw preferences
- edit target
- selection target
- frame id

### B. 交互期临时状态

- interaction active mode
- node session patch / hovered / hidden
- edge preview patch / hint
- mindmap drag preview
- snap guides
- marquee rect

### C. 派生快照

- selection box
- transform can
- node view
- edge view
- palette view

长期最优里：

- A 要存
- B 要存，但要放进独立 ephemeral namespace
- C 尽量不存，只做 selector/read snapshot

现在的问题是：

- 这三类状态都散落在 `state/read/features/react hooks` 各处

## 5.5 command 收敛还不彻底

当前 command 体系已经比以前好很多，但仍有三个问题：

1. `node.raw.update/updateMany` 还在往上层泄漏
2. editor command 与 engine command 的边界没有完全定型
3. local UI state command 与 committed document command 混在同一平面

目前顶层既有：

- `commands.tool`
- `commands.draw`
- `commands.selection`
- `commands.frame`
- `commands.edit`

又有：

- `commands.node`
- `commands.edge`
- `commands.mindmap`
- `commands.document`

语义上这其实是两类命令：

- **local editor session command**
- **committed document command**

但现在还没有被正式区分。

## 5.6 `createInstance.ts` 已经不是单纯 composition

当前 `createInstance.ts` 同时做了：

- state 初始化
- runtime read 初始化
- preview runtime 初始化
- interaction runtime 初始化
- commit 同步与 finalize
- command facade 装配
- 二阶段 session 回填

这说明它已经不是“组合层”，而是“总控层”。

长期最优里：

- `createEditor` 只能做组合
- session runtime、read facade、command facade、reconciler 应拆成独立装配块

---

## 6. 长期最优的状态模型

## 6.1 只保留四类状态

长期最优建议整条链只承认四类状态：

### 1. committed document state

归属：

- `core`
- `engine`

内容：

- document
- operation history
- committed read projection

### 2. editor durable local state

归属：

- `editor`

内容：

- tool
- draw preferences
- selection target
- frame id
- edit target
- viewport

### 3. editor ephemeral interaction state

归属：

- `editor`

内容：

- interaction mode
- node preview/session
- edge preview/session
- snap guides
- marquee rect
- mindmap drag preview

### 4. derived snapshot / presentation state

归属：

- `editor.read`
- `react` 局部 view-model

内容：

- selection snapshot
- node snapshot / overlay snapshot
- edge snapshot
- palette view
- toolbar/context menu view-model

这四类之外，不再引入新的状态类别。

## 6.2 建议的 editor 状态骨架

建议长期收敛为：

```ts
type EditorState = {
  ui: ReadStore<EditorUiState>
  interaction: ReadStore<EditorInteractionState>
  ephemeral: EditorEphemeralStores
}

type EditorUiState = {
  tool: Tool
  draw: DrawPreferences
  selection: SelectionTarget
  frameId?: NodeId
  edit: EditTarget
  viewport: Viewport
}
```

这里的关键点不是字段名，而是：

- `selection` 只保存 target
- `frame` 只保存 `frameId`
- `draw` 只保存偏好
- `viewport` 明确属于 local editor state
- `selection box / canResize / node summary / chrome visibility` 全部从 `read` 派生，不进入 state

## 6.3 selection 只保留一个 stored model

建议把 selection 的 canonical stored model 固定为：

```ts
type SelectionTarget = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}
```

然后把当前这些概念重新分层：

- `SelectionInput`：只作为 command 输入类型
- `SelectionTarget`：唯一 stored state
- `SelectionSnapshot`：唯一 runtime snapshot
- `SelectionPresentation`：React 局部派生，不进入 editor

需要收掉的不是 selection 功能，而是：

- `Source`
- `View`
- `Store`
- `Commands`

这几个同时暴露在同一模块里的做法。

## 6.4 frame 只保留 `frameId`

建议把 frame state 改为：

```ts
type FrameState = {
  frameId?: NodeId
}
```

然后：

- `ids`
- `set`
- `scope`

全部放到 `read.frame.scope()` 里派生。

因为：

- 真正持久的是“当前进入了哪个 frame”
- `ids / set` 都只是当前文档和 tree index 下的派生缓存

## 6.5 draw 只保留偏好，不暴露内部 store 结构

`draw/state.ts` 当前的问题不是功能复杂，而是同时扮演了三种角色：

1. editor 内部 store factory
2. shared selector module
3. 外部 type source

建议长期拆成：

- `editor internal model`: `createDrawPreferencesState`
- `editor read facade`: `read.draw.activeStyle()` / `read.draw.style(kind)` / `read.draw.slot(kind)`
- `public stable type`: 只保留必要的 `DrawPreferences` / `BrushStyle` / `DrawPreview`

也就是说：

- `DrawBrush`
- `DrawCommands`
- `createDrawState`
- `DRAW_SLOTS`

不应继续充当 react 侧共享协议。

`react/features/draw/state.ts` 这份镜像定义应该删除，改成直接消费 editor 提供的 canonical draw read/types。

## 6.6 ephemeral state 统一成 preview/session namespace

现在 editor 的临时状态分散在：

- node session
- edge preview
- snap guides
- mindmap drag
- marquee

建议长期统一认知为：

```ts
type EditorEphemeralStores = {
  preview: {
    node: ...
    edge: ...
    snap: ...
  }
  interaction: {
    marquee: ...
    mindmapDrag: ...
  }
}
```

这里不是要求把所有实现揉成一个文件，而是要求：

- 它们属于同一层
- 命名、生命周期、清理时机保持一致
- 不再散落成看似 feature-specific、实际都属于 interaction runtime 的杂项 store

---

## 7. 长期最优的 API 收敛方案

## 7.1 public API 与 internal API 必须正式分开

长期最优建议：

### Public

- `createEditor`
- `Editor`
- `editor.state`
- `editor.read`
- `editor.commands`
- `editor.viewport`

### Internal

- `InternalEditor`
- `internals.*`
- `pick runtime`
- `selection press planner`
- `preview patch store`
- `node raw session store`

换句话说：

**React 不能继续把 `InternalEditor` 当正常 host API 用。**

## 7.2 React 不再直接读写 `internals.*`

长期最优里，React 应通过两种方式拿能力：

1. `editor.read.*`
2. editor 提供的窄口 adapter/controller

例如：

- 画布 pointer down 调度器
- viewport DOM binder
- edge connect controller
- node preview controller

但这些 controller 必须是：

- 明确 host-facing
- 明确命名
- 明确比 `InternalEditor` 更窄

不能继续依赖：

- `instance.internals.edge.preview.patch.clear()`
- `instance.internals.node.patch.write(...)`
- `instance.internals.selection.gesture`

这种“拿到 God object 后自由穿透”的模式。

## 7.3 `read.selection` 必须从“快照 + 规划器”拆开

建议把：

```ts
ReadStore<SelectionSnapshot> & {
  press(...)
}
```

拆成：

```ts
read.selection: ReadStore<SelectionSnapshot>
internals.selectionPlanner: {
  planPress(...)
}
```

原因很简单：

- selection snapshot 是稳定 host read
- press plan 是 interaction internal policy

这两者不应该挂在同一对象上。

## 7.4 `node.raw` 应降为 editor internal capability

长期最优里：

- React 不直接用 `commands.node.raw.update/updateMany`
- 只有 editor 内部 feature/session/reconciler 可以用 raw write

React host 只能使用：

- 语义 command
- editor 提供的 feature-specific command helper

这能直接减少：

- UI 层组装 `NodeUpdateInput`
- UI 层理解 `data/style` path
- UI 层理解 `origin: 'system'`

## 7.5 command 顶层建议收敛成两大类

建议长期把 command 明确分为：

### A. committed document commands

- `document`
- `node`
- `edge`
- `mindmap`
- `history`
- `clipboard`

### B. editor local commands

- `ui.tool`
- `ui.draw`
- `ui.selection`
- `ui.frame`
- `ui.edit`
- `ui.viewport`

即使短期不改 public 命名，内部实现也应先按这个结构重组。

因为这能把现在混在一起的两类写入分开：

- 改 document
- 改 editor local runtime

## 7.6 read 面也要收敛成“host-facing curated facade”

建议长期把 `engine.read` 与 `editor.read` 的职责明确化：

### `engine.read`

- raw committed projection
- raw index
- raw bounds

### `editor.read`

- preview-aware snapshot
- capability
- host-facing runtime read

这样做的结果是：

- `read.index` 这类偏 engine/raw 的能力不再默认暴露给 React 大量使用
- `editor.read.node/edge/selection` 成为唯一 host-facing runtime read

---

## 8. 各层边界的具体收敛建议

## 8.1 `core`

本轮不建议继续往 `core` 加任何 UI runtime 概念。

应坚持：

- 只保留领域算法
- 只保留 operation/reducer
- 不承接 selection planner、press policy、preview patch、chrome view-model

## 8.2 `engine`

`engine` 应继续保持：

- committed runtime
- read/write pipeline
- store infra

但不应吸收 editor local state。

也就是说：

- `selection target`
- `tool`
- `draw preferences`
- `frameId`
- `edit target`

都不要回收到 engine。

## 8.3 `editor`

`editor` 才是这次应该真正收敛的一层。

建议把它稳定定义为：

- local durable state owner
- ephemeral interaction runtime owner
- preview overlay read owner
- host-facing semantic commands owner
- committed change 之后的 UI reconciler owner

其中：

- `createInstance.ts` 只保留组合
- `finalize.ts` 升格为独立 UI reconciler 模块
- `runtime/read/*` 改造成清晰的 curated facade
- `features/*/session` 不再让 React 直接拿实现实例

## 8.4 `react`

`react` 长期只做：

- DOM 事件接线
- React state subscription
- 组件组合
- presentation view-model

不再直接做：

- preview patch store 写入
- raw node update
- 对 `internals.*` 的任意访问
- editor session instance 直接调度

需要强调：

这不意味着把所有 handler 都强行挂到 `editor` 实例上。

按照当前仓库偏好的模式，仍然可以保留：

- `useCanvasHandlers`
- `useViewportBinding`
- `useClipboardBinding`

但这些 hook 应只依赖：

- editor 暴露的窄口 controller/adapters

而不是直接穿透 `InternalEditor`。

---

## 9. `draw/state.ts` 这类文件的具体改法

## 9.1 当前问题

`packages/whiteboard-editor/src/features/draw/state.ts` 当前同时导出了：

- state type
- slot/style type
- resolved style type
- preview type
- commands type
- selector
- store factory

这等于把：

- internal runtime state
- host-facing type
- shared selector helper

混成一个模块。

`packages/whiteboard-react/src/features/draw/state.ts` 又把其中一半镜像复制了一次。

## 9.2 长期最优拆分

建议拆成三层：

### A. internal model

只给 editor runtime 用：

- `createDrawPreferencesState`
- 内部 `normalize`
- 内部 store type

### B. host-facing read facade

挂在 `editor.read.draw`

- `getPreferences()`
- `getStyle(kind)`
- `getActiveStyle()`
- `getSlot(kind)`

### C. public stable type

只保留确实需要跨包共享的：

- `BrushStyle`
- `DrawPreferences`
- `ResolvedDrawStyle`
- `DrawPreview`

其余都不再继续外露。

## 9.3 对 selection/node/edge 的等价处理

同样的处理方式可以扩展到：

### selection

- stored: `SelectionTarget`
- read: `SelectionSnapshot`
- planner: internal only
- React presentation: local only

### node

- engine committed item
- editor preview-aware snapshot
- React `NodeView` 本地 presentation

### edge

- engine committed item
- editor preview-aware edge snapshot
- React `SelectedEdgeView` 本地 presentation

---

## 10. 推荐实施顺序

## Phase 0：先收敛命名与类型，不改行为

目标：

- 让 stored state / snapshot / presentation 的命名先稳定下来

动作：

- `Source` 改成 `SelectionTarget`
- `View` 改成 `SelectionSnapshot`
- `frame.store` 的 public 命名改成 `read.frame.scope`
- draw 统一成 `DrawPreferences`

## Phase 1：先消灭最明显的镜像与泄漏

优先做：

1. 删除 `whiteboard-react/src/features/draw/state.ts`，直接消费 editor canonical draw types/read
2. 停止从 public root 暴露 `InternalEditor`
3. 停止在 React 里直接使用 `instance.internals.*`，先引入 editor host adapters
4. 把 `node.raw` 从 React 使用面撤掉

这是收益最高、风险相对最低的一批。

## Phase 2：拆 `editor.read`

优先做：

1. `read.selection` 与 `selection planner` 拆开
2. `read.node` / `read.edge` 明确成 preview-aware host snapshot
3. `read.index` 收回 internal or limited host adapter

目标是让 `editor.read` 只剩“host 能稳定依赖的读取语义”。

## Phase 3：重构 `createInstance.ts`

建议拆成：

- `createEditorState`
- `createEditorEphemeralRuntime`
- `createEditorReadFacade`
- `createEditorCommandFacade`
- `createEditorReconciler`
- `createEditorHostAdapters`

然后 `createEditor` 只负责组合。

同时去掉：

- `null as unknown as` 占位回填

改成明确的两阶段 builder 或闭包装配。

## Phase 4：收 package boundary

最后做：

1. `editor` 内 node registry 与 React render registry 分离
2. `react/runtime/input/pointer.ts` 不再依赖 `as unknown as`
3. public exports 再做最终清理

---

## 11. 最后判断

如果只回答“能不能简化”，答案是：

**能，而且不是小修，是系统性收敛。**

如果只回答“最该先动哪里”，答案是：

1. **draw / selection / frame 的 canonical state 命名与层级**
2. **`InternalEditor` 与 `internals.*` 的 host 泄漏**
3. **`editor.read` 中 snapshot 与 planner 的职责混装**
4. **`createInstance.ts` 的总控化**

如果只回答“整条链的长期最优原则”，答案是：

**只在一层保存状态，只在一层定义 canonical snapshot，只在一层做 presentation。**

更具体地说：

- committed 真值只在 `engine/core`
- local durable state 只在 `editor`
- interaction ephemeral state 只在 `editor`
- React 只做 presentation，不再重新发明 runtime 协议

这才是这条链路真正能继续降复杂度的方向。
