# WHITEBOARD_EDITOR_STEP_1_RUNTIME_STATE_OVERLAY_EXECUTION_PLAN.zh-CN

## 文档定位

这份文档是
[WHITEBOARD_EDITOR_FINAL_ARCHITECTURE_PLAN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_EDITOR_FINAL_ARCHITECTURE_PLAN.zh-CN.md)
里“第 1 步”的详细设计与实施方案。

它只聚焦两件事：

- 建立新的 `runtime state`
- 建立统一的 `overlay`

这一步是整个 editor 重构的地基。

如果这一步没做对，后面的：

- interaction model
- interaction runtime
- owner 收敛
- public surface 收紧

都会继续建立在旧的碎片化 runtime 上，最后仍然会回到“helper 越来越多、参数越来越怪、状态越来越散”的老路。

这份文档不讨论完整重构终局，只讨论第一步怎么一步到位做到正确。

---

## 第一步的目标

第一步的唯一目标是：

- **先把 editor 本地运行时状态和临时可视状态这两条中轴建出来**

具体来说：

1. 用 `runtime state` 取代当前的 `kernel + finalize + pointer snapshot + draw preferences + input policy` 的杂糅装配方式
2. 用单一 `overlay` 取代当前分散的 `node transient / edge transient / feedback / preview / guide` 体系

这一步做完后，不要求 interaction 已经完全重写。
但必须达到两个结果：

1. editor 内部已经有了正确的状态中轴
2. 后面的 interaction 重写可以直接站在这两个中轴上继续推进

---

## 第一步明确不做的事情

这一步不要把范围做炸。

下面这些事情都不是第一步要解决的：

1. 不重写 `select / draw / edge / viewport / insert` 的 owner 结构
2. 不重写 interaction model
3. 不删除 public `Editor` 现有顶层字段
4. 不处理 platform / clipboard 下沉
5. 不处理 registry / config public surface 收紧
6. 不处理最终的五 owner + observe 统一模型

第一步只做地基。

但要注意：

- 这不是在做“过渡层”
- 而是在做最终架构里最底下那两根主梁

---

## 为什么第一步必须先做这两件事

现在系统的根问题不是 interaction 文件数，而是 editor 内部没有两条稳定中轴：

- 本地运行时状态中轴
- 临时可视状态中轴

所以现在才会出现这些现象：

- `kernel` 持有一堆并不属于一个清晰概念的东西
- `createEditor.ts` 先造很多零件，再靠 `host` 和 `assemble` 拼起来
- interaction 自己到 `read / viewport / output / commands` 里拼语义
- preview / guide / patch / hover / hidden 散在不同 runtime 里
- clear 行为到处手写

如果不先收敛 `runtime state + overlay`，后面的 interaction 重写只会变成：

- 把旧逻辑换一种组织方式再写一遍

而不是从底层模型上变简单。

---

## 当前问题拆解

## 1. `kernel` 不是稳定概念

当前 `createKernel(...)` 同时持有：

- engine
- registry
- viewport
- interaction
- inputPolicy
- tool
- edit
- selection

问题不在于它字段多，而在于这些字段不属于同一个明确语义对象。

这里混了三类东西：

1. 外部依赖
   - engine
   - registry
2. editor 本地 runtime state
   - tool
   - selection
   - edit
   - viewport
   - inputPolicy
3. editor 行为 runtime
   - interaction

所以 `kernel` 其实只是一个临时组合体，不是长期稳定模型。

---

## 2. 本地 runtime state 目前是散的

当前本地状态散落在：

- `runtime/state/edit.ts`
- `runtime/state/selection.ts`
- `runtime/viewport.ts`
- `runtime/input/pointer/snapshot.ts`
- `interactions/draw/preferences.ts`
- `runtime/editor/finalize.ts`
- `runtime/editor/lifecycle.ts` 中的一部分 reset 逻辑

这会导致：

- createEditor 装配顺序绕
- interaction / commands / read 对本地状态的消费路径不统一
- “本地状态”本身没有一个明确持有者

---

## 3. 临时可视状态目前是碎的

当前临时态拆成了很多 runtime：

- `runtime/transient/node.ts`
- `runtime/transient/edge.ts`
- `runtime/feedback/edgeGuide.ts`
- `runtime/feedback/marquee.ts`
- `runtime/feedback/mindmapDrag.ts`
- `interactions/draw/feedback.ts`
- `runtime/interaction/snap.ts` 内部的 guide store

这会直接带来：

- interaction 要记住自己碰过哪些 store
- clear 行为在 feature 里到处散落
- read 和 feedback 各自从不同 runtime 再做投影
- 后面想做 owner 生命周期自动清理时，没有统一落点

---

## 第一步完成后的理想状态

第一步完成后，editor 内部应该形成下面这两个中轴。

## 1. Runtime State

它是 editor 的本地运行时状态中枢。

它持有：

- tool
- selection
- edit
- viewport
- pointer
- drawPreferences
- options
- interaction public state 的临时承接位

它负责：

- 创建本地 runtime state
- 对外暴露这些状态的 read/write
- 在 document commit 后做 reconcile
- 提供 runtime reset

它不负责：

- interaction owner 逻辑
- overlay 写入
- domain read 组合
- commands 逻辑

---

## 2. Overlay

它是 editor 的唯一临时可视状态中枢。

它持有：

- node patches / hovered / hidden
- edge patches / activeRouteIndex
- draw preview
- marquee preview
- mindmap drag preview
- edge guide
- snap guides

它负责：

- 创建统一 overlay store
- 提供统一写入口
- 提供 node/edge keyed selector
- 提供 public feedback selector

它不负责：

- 命中计算
- snap 算法
- interaction owner 生命周期
- 文档提交

---

## 第一步的最终边界

第一步结束后，模块边界应该变成：

- `runtime state` 负责本地状态
- `overlay` 负责临时可视状态
- `read` 从 `document + runtime state + overlay` 派生
- `commands` 读 `read`、写 document 和 runtime state
- interaction 继续暂时沿用现有 owner 文件，但不再写碎片化 output runtime

这一步不会让 editor 立刻“终局完成”，但会把最差的中间层结构彻底拿掉。

---

## 详细设计

## 一、Runtime State 设计

## 1. Runtime State 的最终职责

第一步里，`runtime state` 要吸收这些现有职责：

- `tool` store
- `selection` store
- `edit` store
- `viewport` runtime
- `pointer snapshot`
- `inputPolicy`
- `draw preferences`
- `finalize` 里的 selection/edit reconcile
- `lifecycle` 里的本地状态 reset

注意：

- `engine` 不属于 runtime state
- `registry` 不属于 runtime state
- interaction owner 行为也不属于 runtime state

这一步最重要的判断就是：

- **runtime state 只存 editor 自己的本地状态，不存外部依赖，也不存 feature 行为**

---

## 2. Runtime State 推荐数据结构

推荐结构：

```ts
type EditorRuntimeOptions = {
  input: {
    panEnabled: boolean
    wheelEnabled: boolean
    wheelSensitivity: number
  }
}

type EditorRuntimeState = {
  tool: ValueStore<Tool>
  selection: SelectionState
  edit: EditState
  viewport: ViewportRuntime
  pointer: ValueStore<PointerSnapshot | null>
  draw: {
    preferences: ValueStore<DrawPreferences>
  }
  options: ValueStore<EditorRuntimeOptions>
  interaction: {
    public: ReadStore<EditorInteractionState>
  }
}
```

这里有两个关键点：

### `selection` / `edit` 继续保留局部 mutate 结构

这一层当前是清晰的，不需要为第一步硬改。

也就是说：

- `createSelectionState()`
- `createEditState()`

可以继续保留。

### `viewport` 继续保留现有 runtime 实现

第一步不需要重写 viewport 数学与热路径实现。

所以：

- `runtime/viewport.ts`

逻辑可以原样保留，但它应成为 `createRuntimeState(...)` 的内部依赖，而不是 `kernel` 的一部分。

### `drawPreferences` 必须从 `interactions` 移出

现在它在：

- `interactions/draw/preferences.ts`

这是不对的。

draw preferences 是 editor 本地状态，不是 interaction helper。

第一步必须把它移入 runtime state 体系。

推荐位置：

- `runtime/state/draw.ts`

或直接作为 `runtime/state/index.ts` 内部 builder。

---

## 3. Runtime State 的 write 入口

第一步不要重新发明复杂 state 管理协议。

推荐直接保持最简单形式：

- 继续用 `ValueStore`
- 局部状态继续保留原来的 `mutate`
- 新增统一的 `reset()` 与 `reconcileAfterCommit()`

推荐接口：

```ts
type RuntimeStateController = {
  state: EditorRuntimeState
  reset: () => void
  reconcileAfterCommit: () => void
}
```

这里不要引入：

- 统一 reducer
- 通用 event machine
- “所有本地状态都要走一套 action”

这会过度设计。

---

## 4. `reconcileAfterCommit` 的职责

当前 `finalize.ts` 做两件事：

- 过滤 selection 里的失效 node/edge
- 清除失效 edit target

这两件事本质上都属于：

- runtime state reconcile

所以第一步应把这段逻辑吸收入：

- `runtime/state/reconcile.ts`

或直接吸收到 `createRuntimeState(...)` 内部。

推荐形态：

```ts
reconcileAfterCommit({
  read,
  selection,
  edit
})
```

但它不再作为 editor 组装链里一个独立 `finalize` 概念存在。

---

## 5. Runtime State 的 reset 语义

当前 reset 分散在：

- input cancel
- selection clear
- edit clear
- featureLifecycle.reset()

第一步要把其中“本地状态 reset”的部分收回 runtime state。

推荐职责划分：

### `runtimeState.resetLocal()`

负责：

- clear selection
- clear edit
- clear pointer

是否重置 tool / viewport / drawPreferences，要分开处理：

- 默认不重置 tool
- 默认不重置 viewport
- 默认不重置 draw preferences

因为这些更像持续 editor 偏好，而不是一次交互残留。

### `overlay.reset()`

负责：

- 清空所有临时可视状态

### `interaction.cancel()`

负责：

- 结束当前 active session

这样 reset 才会清晰：

1. cancel interaction
2. reset overlay
3. reset runtime local ephemeral state

而不是混在 lifecycle helper 里。

---

## 6. Runtime State 实施上的文件安排

第一步推荐这样做。

### 保留但降级为内部 builder 的文件

- `runtime/state/edit.ts`
- `runtime/state/selection.ts`
- `runtime/viewport.ts`
- `runtime/input/pointer/snapshot.ts`

这些逻辑本身不差，第一步不需要为“目录理想形态”强行重写。

### 新增

- `runtime/state/index.ts`

负责：

- 创建 runtime state
- 持有 draw preferences
- 持有 pointer store
- 组装 selection/edit/viewport
- 暴露 `resetLocal` / `reconcileAfterCommit`

### 删除

- `runtime/editor/kernel.ts`
- `runtime/editor/finalize.ts`

它们的职责要么被吸入 `runtime/state/index.ts`，要么被吸入后续 interaction runtime。

---

## 二、Overlay 设计

## 1. Overlay 的目标

第一步里，overlay 的目标不是“把所有临时态硬塞到一个大 store 就结束”。

它要同时满足两个要求：

1. 概念上只有一份 overlay 中轴
2. 实现上不牺牲 node/edge keyed read 的性能

这意味着：

- overlay 必须是一个统一 runtime 概念
- 但内部可以有隐藏的派生 selector

这是合理实现细节，不算重新搞碎。

---

## 2. Overlay 的推荐源状态结构

推荐的源状态结构如下：

```ts
type EditorOverlayState = {
  node: {
    patches: readonly NodePatchEntry[]
    hovered?: NodeId
    hidden: readonly NodeId[]
  }
  edge: {
    patches: readonly EdgeOverlayEntry[]
  }
  draw: {
    preview: DrawPreview | null
  }
  select: {
    marquee?: {
      worldRect: Rect
      match: 'touch' | 'contain'
    }
    mindmapDrag?: MindmapDragFeedback
  }
  guides: {
    edge?: EdgeGuide
    snap: readonly Guide[]
  }
}
```

其中：

```ts
type EdgeOverlayEntry = {
  id: EdgeId
  patch?: EdgePatch
  activeRouteIndex?: number
}
```

这里有几个关键设计点。

### `marquee` 存 world rect，不存 screen rect

screen rect 依赖 viewport。
它不应该成为 overlay 的源状态。

overlay 源状态只存：

- `worldRect`
- `match`

public feedback selector 再根据 viewport 做 screen projection。

### `snap` guides 进入 overlay

当前 `createSnapRuntime(...)` 内部自己持有 guides store。
这不对。

snap 算法和 snap guides 是两件事：

- 算法属于 snap service
- guides 属于 overlay

第一步必须把 guides 从 `snap runtime` 中拿出来。

### `draw preview` 进入 overlay

不要继续保留 `interactions/draw/feedback.ts` 这种局部 preview store。

draw preview 是标准临时可视状态，应该进入 overlay。

---

## 3. Overlay 的公开能力

overlay 对内和对外都只保留少数稳定接口。

推荐：

```ts
type EditorOverlay = {
  state: ReadStore<EditorOverlayState>
  get: () => EditorOverlayState
  subscribe: ReadStore<EditorOverlayState>['subscribe']
  set: (
    next:
      | EditorOverlayState
      | ((current: EditorOverlayState) => EditorOverlayState)
  ) => void
  reset: () => void
  selectors: {
    node: KeyedReadStore<NodeId, NodeOverlayProjection>
    edge: KeyedReadStore<EdgeId, EdgeOverlayProjection>
    feedback: {
      draw: ReadStore<DrawPreview | null>
      marquee: ReadStore<MarqueeFeedback | undefined>
      mindmapDrag: ReadStore<MindmapDragFeedback | undefined>
      edgeGuide: ReadStore<EdgeGuide>
      snap: ReadStore<readonly Guide[]>
    }
  }
}
```

这里故意不提供：

- `overlay.node.set`
- `overlay.edge.set`
- `overlay.marquee.set`
- `overlay.snap.set`

因为一旦把这些全部做成分散写入口，系统就又会回到旧模型。

统一写入口必须是：

- `overlay.set(...)`

如果某些 interaction 写起来太长，可以用局部纯函数辅助：

- `writeNodePatches(...)`
- `clearEdgeGuide(...)`

但这些应该是普通纯函数，不是 overlay 上新的 namespace。

---

## 4. Overlay 的派生 selector

虽然 overlay 概念上是一份 state，但 node/edge 这两类读取仍应保留 keyed selector。

原因很简单：

- node / edge 是大规模列表
- React 和 read runtime 需要按 id 读取
- 不应该因为“统一 overlay”而退化成每次全量扫整份大对象

所以第一步推荐：

- overlay 内部保留 keyed 派生 selector
- 但它们只是 overlay 的实现细节

推荐：

- `selectors.node` 从 `overlay.state.node` 派生
- `selectors.edge` 从 `overlay.state.edge` 派生

这会直接替代：

- `runtime/transient/node.ts`
- `runtime/transient/edge.ts`

---

## 5. Overlay 的 reset 语义

overlay reset 必须非常清晰：

- `overlay.reset()` 清空全部临时可视状态

不要在第一步就引入：

- owner layer
- scoped slot
- session bound overlay partition

这些东西属于后面 interaction runtime 重写时再接入的能力。

第一步只需要一份统一 overlay reset。

这是最小且正确的做法，不算过度设计。

---

## 6. Overlay 实施上的文件安排

第一步推荐：

### 新增

- `runtime/overlay.ts`

如果实现明显过长，再拆成：

- `runtime/overlay/index.ts`
- `runtime/overlay/node.ts`
- `runtime/overlay/edge.ts`
- `runtime/overlay/selectors.ts`

但默认优先单文件，除非代码量已经明显失控。

### 删除

- `runtime/transient/node.ts`
- `runtime/transient/edge.ts`
- `runtime/feedback/edgeGuide.ts`
- `runtime/feedback/marquee.ts`
- `runtime/feedback/mindmapDrag.ts`

### 吸收

- `interactions/draw/feedback.ts` 的 preview/hidden 逻辑
- `runtime/interaction/snap.ts` 里的 guides store

注意：

- `snap` 算法本身不删
- 只是把 guide store 删掉

---

## 三、`read` 在第一步中的改造

第一步不重写 interaction model，但必须改造 `read` 的数据来源。

## 1. `read.node`

当前：

- 从 `engineRead.node.item`
- 再叠 `NodeTransientReader`

第一步后：

- 从 `engineRead.node.item`
- 再叠 `overlay.selectors.node`

这意味着：

- `createNodeRead(...)` 的 `transient` 参数改名为 `overlay`
- 类型从 `NodeTransientReader` 变成 `KeyedReadStore<NodeId, NodeOverlayProjection>`

## 2. `read.edge`

当前：

- 从 `engineRead.edge.item`
- 再叠 `EdgeTransientReader`

第一步后：

- 从 `engineRead.edge.item`
- 再叠 `overlay.selectors.edge`

## 3. `read.selection`

第一步里，selection read 不需要大的语义改造。

它主要只要改依赖来源：

- 继续读 `selection source`
- 继续读 `node / edge read`

但这两个 read 已经变成 overlay 驱动后的版本。

## 4. `feedback`

第一步里，public `editor.feedback` 仍可保留现有形状。

但它不再来自独立 feedback runtime，而是来自：

- `overlay.selectors.feedback.*`

也就是说：

- `feedback` 只是 overlay 的对外 selector
- 不再是并列内部系统

---

## 四、Interaction 在第一步中的接入方式

第一步不重写 interaction owner 模型。

但 interaction 必须开始改用：

- `overlay`

而不是：

- `output`

## 1. 第一阶段 interaction 仍可沿用现有 owner 文件

这一步不需要立刻把：

- `selection.ts`
- `draw/index.ts`
- `edge/index.ts`

全重写。

但它们必须停止直接依赖：

- `runtime/transient/*`
- `runtime/feedback/*`

改为统一依赖：

- `overlay`

## 2. `InteractionHost` 的处理方式

第一步里，不建议为了减少 diff 立刻把 interaction 全部换成最终 runtime。

但也不应该继续让 `InteractionHost` 扩张。

推荐做法：

- 第一步把 `InteractionHost` 收缩成仅供旧 owner 继续工作的临时接入对象
- 同时把 `output` 删除，改成 `overlay`

推荐暂时形态：

```ts
type InteractionHost = {
  read: EditorRead
  commands: EditorCommands
  viewport: EditorViewport
  overlay: EditorOverlay
  snap: SnapRuntime
  options: ValueStore<EditorRuntimeOptions>
  interaction: {
    mode: ReadStore<InteractionMode>
    state: ReadStore<InteractionState>
  }
}
```

这里有两个明确要求：

1. 这是第一步的临时接入面，不是最终中轴
2. 从这一步开始，严禁再给 `InteractionHost` 新增别的资产清单字段

也就是说，它只用于承接旧 owner 直到第二、三步完成。

---

## 五、`snap` 在第一步中的处理方式

`snap` 当前的问题，不是算法位置，而是它自己持有 guide store。

第一步里：

- 保留 `createSnapRuntime(...)` 作为算法 service
- 删除它内部的 guide store

推荐改成：

### 方案 A，最直接

`snap.node.move(...)` 返回：

```ts
{
  rect: Rect
  guides: readonly Guide[]
}
```

`snap.node.resize(...)` 返回：

```ts
{
  update: ResizeUpdate
  guides: readonly Guide[]
}
```

由 interaction 自己把 `guides` 写入 overlay。

### 方案 B，次优

仍保留 API 形状，但通过回调把 guides 写到 overlay。

我更推荐方案 A。

因为：

- snap service 应该尽量纯
- guide 是 overlay，不是 snap service 内部状态

---

## 六、`createEditor` 的第一步改造

第一步里，`createEditor` 的装配顺序必须改成：

1. create runtime state
2. create overlay
3. create read
4. create snap service
5. create commands
6. create temporary interaction host
7. assemble existing interactions
8. compose input
9. create lifecycle
10. derive public feedback from overlay
11. assemble final editor

也就是说，第一步就要开始把 createEditor 从“零件堆装配”变成“围绕中轴装配”。

## 推荐伪代码

```ts
const runtime = createRuntimeState(...)
const overlay = createOverlay({
  viewport: runtime.state.viewport.read
})

const read = createRead({
  engineRead: engine.read,
  runtime,
  overlay
})

const snap = createSnapRuntime({
  readZoom: () => runtime.state.viewport.read.get().zoom,
  ...
})

const commands = createEditorCommands({
  engine,
  read,
  runtime
})

const interactionHost = {
  read,
  commands,
  viewport: runtime.state.viewport.public,
  overlay,
  snap,
  options: runtime.state.options,
  interaction: existingCoordinatorState
}

const features = assembleInteractions(interactionHost)
const input = composeInput(...)
const lifecycle = createLifecycle({
  runtime,
  overlay,
  input,
  featureLifecycle: features.lifecycle
})

return createEditorSurface({
  runtime,
  read,
  commands,
  input,
  feedback: overlay.selectors.feedback,
  ...
})
```

这一步里，虽然 interaction runtime 还没终局化，但中轴已经换掉了。

---

## 详细实施顺序

下面是建议的一次性实施顺序。

## 第 1 组：建立 runtime state

1. 新增 `runtime/state/index.ts`
2. 把 `tool / selection / edit / viewport / pointer / drawPreferences / inputPolicy` 收到这里
3. 把 `finalize` 的 reconcile 逻辑并入这里
4. 删除 `runtime/editor/kernel.ts`
5. 让 `createEditor.ts` 改为先创建 runtime state

这一步完成后，`kernel` 概念应彻底消失。

## 第 2 组：建立 overlay

1. 新增 `runtime/overlay.ts`
2. 定义统一 `EditorOverlayState`
3. 实现 node/edge keyed selector
4. 实现 feedback selector
5. 把 `draw preview` 收进去
6. 把 `edge guide / marquee / mindmap drag / snap guides` 收进去
7. 删除 `runtime/transient/*`
8. 删除 `runtime/feedback/*`

这一步完成后，editor 内部必须只剩一个临时态 runtime 概念。

## 第 3 组：改 `read`

1. `read/node.ts` 改读 overlay node selector
2. `read/edge.ts` 改读 overlay edge selector
3. `read/index.ts` 改为接收 `runtime state + overlay`
4. `feedback` 对外来源改成 overlay selector

## 第 4 组：改 interaction 接入

1. `InteractionHost.output` 改为 `overlay`
2. interaction 里所有 `ctx.output.*` 改成 `ctx.overlay.set(...)`
3. `draw/feedback.ts` 删除或并回 draw owner
4. `snap` guides 改从 overlay 出

## 第 5 组：收束生命周期

1. `createLifecycle` 不再依赖 `kernel`
2. reset 流程改成：
   - `input.cancel()`
   - `overlay.reset()`
   - `runtime.resetLocal()`
3. commit 订阅改调用 `runtime.reconcileAfterCommit()`

---

## 每一组的验收标准

## 第 1 组验收标准

- `kernel.ts` 删除
- 本地 runtime state 只由 `createRuntimeState(...)` 创建
- draw preferences 不再位于 `interactions`
- `finalize.ts` 删除

## 第 2 组验收标准

- `transient` 与 `feedback` 不再作为并列 runtime 存在
- overlay 是 editor 内部唯一临时态中轴
- public feedback 全部能从 overlay selector 得到

## 第 3 组验收标准

- `read.node` 与 `read.edge` 都从 overlay 派生临时态
- `read` 不再直接依赖旧 transient reader

## 第 4 组验收标准

- interaction 不再写 `output.*`
- interaction 统一写 `overlay`
- snap guides 不再由 snap service 内部存储

## 第 5 组验收标准

- lifecycle 不再依赖 `kernel`
- commit 后 reconcile 明确属于 runtime state
- reset 流程清晰且无重复 clear

---

## 代码层面的明确取舍

为了避免第一步做成“大而空”的架构练习，这里明确一些实现取舍。

## 1. 保留现有 `viewport` 实现

第一步不要重写 viewport。

原因：

- 当前几何能力已经清晰
- 它不是当前复杂度根因
- 只要把持有关系改对就够了

## 2. 保留 `selection/edit` 局部 state builder

第一步不要为了“目录完美”把所有 state builder 再揉成一个超大文件。

可以保留：

- `createSelectionState`
- `createEditState`

但它们成为 `createRuntimeState` 的私有依赖。

## 3. 不要把 overlay 重新拆成多个顶层 runtime

如果第一步实现时又做出：

- `createNodeOverlay`
- `createEdgeOverlay`
- `createFeedbackOverlay`

并把它们重新暴露成多个并列 runtime，那第一步等于失败。

内部实现可以拆模块。
对外 runtime 概念必须只有一个：

- `overlay`

## 4. 不要引入 action/reducer 框架

第一步只需要：

- `ValueStore`
- `ReadStore`
- keyed selector
- 普通纯函数

不需要：

- reducer
- state machine
- action bus

---

## 第一步完成后的代码气味改善预期

这一步做完后，即使 interaction 还没重写，代码气味也应该立刻下降：

1. `createEditor.ts` 会明显变直
2. `kernel` 这个不稳定概念会消失
3. interaction 写 preview/guide/patch 的方式会统一
4. `read` 的临时态来源会统一
5. 后续 interaction model 重写时，不再需要同时处理一堆碎 store

如果第一步做完，系统还继续呈现下面这些现象，就说明第一步没做到位：

- 仍然存在多个并列 transient/feedback runtime
- interaction 仍然要自己记住清哪些 store
- `createEditor.ts` 仍然先造很多零件再靠 host 拼装
- `draw preferences` 仍然在 interactions 目录下
- `kernel` 仍然存在

---

## 最后结论

第一步不是“做一个新文件夹”那么简单。

第一步真正要解决的是：

- editor 本地状态为什么没有中轴
- editor 临时可视状态为什么没有中轴

所以它的正确落点不是继续修 helper，而是：

1. 建立 `runtime state`
2. 建立 `overlay`
3. 让 `read / interaction / lifecycle / createEditor` 都开始围绕这两根主轴工作

只要这一步做对：

- 后面的 interaction model 和 owner 重写会明显简单
- 参数会自然减少
- helper 会自然变少

因为那时 editor 的底层状态模型终于对齐了。
