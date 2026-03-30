# Whiteboard Editor 中间层简化方案

## 1. 文档目标

这份文档只回答一个问题：

**在 `whiteboard-editor` 已经完成 input router、interaction driver registry、passive processor 收口之后，中间层接下来该怎么继续瘦身，才能更接近长期最优。**

这里说的“中间层”，主要指的是介于下面三层之间的那一层装配、投影和聚合结构：

1. editor 基础设施
2. feature 业务实现
3. React / UI 消费面

这一层如果不继续收口，就会出现一个很典型的问题：

- 顶层输入链已经清楚了
- 但内部仍然有很多平行对象、袋状依赖和命名错位
- feature 每增加一个能力，复杂度还是会继续线性上涨

所以这份方案不讨论单点优化，而是讨论：

**从底层模型上，哪些东西应该保留，哪些东西不应该继续存在，以及它们应该怎么重新组织。**

---

## 2. 核心结论

如果从长期最优看，`whiteboard-editor` 接下来最值得做的，不是再多做几个 registry，也不是继续拆几个大文件，而是：

**把中间层从“很多并行袋子”收成一条稳定主线。**

我认为长期最优的主线应该是：

```ts
kernel
  -> projection graph
  -> feature capsules
  -> compose
  -> public editor
```

更完整一点：

```ts
Host Input
  -> Input Router
  -> Passive Processors / Interaction Drivers
  -> Active Interaction Sessions
  -> Projection Graph
  -> Feature Read / Feature Commands
  -> Editor Compose Layer
  -> Public Editor / React Consumer
```

这条主线里有三个判断最重要：

1. **`EditorKernel` 可以保留，但必须非常克制，不能变成更大的 service locator。**
2. **`state` 必须收缩成 editor 的最小共享语义状态，而不是把所有 store 都塞进去。**
3. **`EditorProjections` 值得保留，但必须明确拆成 `model` 和 `overlay` 两层，不能再和 session 混在一起。**

一句话说：

**现在最值得继续简化的，不是 editor 的能力总量，而是 editor 的底层模型和组织方式。**

---

## 3. 当前真正的复杂度来源

## 3.1 并行袋子太多

当前 editor 中间层长期并行维护着多套对象：

1. `stores`
2. `state`
3. `baseRead`
4. `internals`

问题不只是对象数量多，而是：

**它们不是从一条明确的主线推导出来的，而是平铺出来的。**

结果就是：

1. 每新增一个能力，都要先决定“它到底挂哪一层”
2. 同一份事实常常被不同对象重复承载成不同视图
3. `createEditor.ts` 和 `createEditorStores.ts` 会越来越像总集散中心

这类复杂度不会立刻报错，但会持续放大维护成本。

## 3.2 `driver / active session / projection store` 还没有对齐

当前真正让很多 feature 文件显得混乱的，不是“没有 registry”，而是底层模型还没完全对齐。

现在内部仍然容易把下面三种东西混在一起：

1. `driver`
   只负责判断能不能启动、由谁启动
2. `active interaction session`
   只表示一次活跃交互，负责 `move / up / cancel`
3. `projection store`
   只负责临时视觉或几何输出

一旦这三层不分开，就会出现几个连锁问题：

1. 有些文件名字叫 `session`，实际做的是 projection store
2. 有些 feature runtime 同时背着启动逻辑、交互过程、预览状态
3. session 和 projection 的边界会持续模糊

这也是为什么像 `packages/whiteboard-editor/src/features/node/session/node.ts`、`packages/whiteboard-editor/src/features/node/session/transform.ts` 这种结构会让人感觉“混”。

## 3.3 `state / config / preference / source` 还在混装

这是当前中间层里最需要收紧的一点。

现在很多东西虽然都表现成 store，但它们不是同一类东西：

1. 有些是 editor 自己拥有的长期共享语义状态
2. 有些是 runtime config
3. 有些是 feature preference
4. 有些是 document/engine 的事实
5. 有些只是活跃交互过程中的临时变量

如果这些东西都继续放进 `state`，那 `state` 这个词就会失去边界，最终又会变成万能袋子。

## 3.4 `read` 和 `commands` 还偏中央工厂

当前 `runtime/read/index.ts` 和 `commands/runtime.ts` 仍然承载了太多中央装配责任：

1. `read` 知道太多 feature 细节
2. `commands/runtime.ts` 仍然是 dependency bag
3. 新能力接入时，首先会去改中央工厂，而不是 feature 自己的贡献面

这说明现在的中间层，还没有真正实现 feature 贡献式组合。

## 3.5 `editor.session` 这个名字仍然是错位的

React 真正在消费的是：

- draw preview
- edge preview
- marquee rect
- mindmap drag preview
- snap guides

这些都属于 projection，不属于 active interaction session。

继续叫 `session` 的问题不只是难听，而是会持续制造错误认知：

1. 让人以为 UI 在读交互会话本身
2. 让 projection 和 interaction 的边界继续模糊

## 3.6 `EditorKernel` 和 `EditorProjections` 的边界还不够清楚

目前最大的问题不是“有没有这两个概念”，而是：

1. `EditorKernel` 很容易被设计成“所有东西都挂进去”的大对象
2. `EditorProjections` 很容易被设计成“所有临时东西都放这里”的垃圾桶

这两个概念都可以保留，但前提是：

**边界必须比现在更硬。**

---

## 4. 长期最优的底层模型

我建议把整个 editor 中间层重新组织成四大块：

1. `kernel`
2. `projection graph`
3. `feature capsules`
4. `compose`

## 4.1 `EditorKernel`：可以保留，但必须变小

我认为 `EditorKernel` 这个概念是值得保留的，因为 editor 的确需要一个统一承载跨 feature 基础设施的根对象。

但前提是：

1. 它只能放基础设施和最小共享状态
2. 它不能承载 feature 级 projection
3. 它不能默认作为“把整个系统传给每个 feature”的万能依赖

我认为长期最优的 `EditorKernel` 更接近下面这样：

```ts
type EditorBaseState = {
  tool: ValueStore<Tool>
  selection: SelectionState
  edit: EditState
  frame: FrameState
}

type EditorRuntimeConfig = {
  inputPolicy: ValueStore<EditorInputPolicy>
}

type EditorKernel = {
  document: {
    engine: EngineInstance
    registry: NodeRegistry
  }
  interaction: {
    coordinator: InteractionCoordinator
    registry: InteractionDriverRegistry
  }
  spatial: {
    viewport: ViewportRuntime
    pick: PickRuntime
    snap: SnapRuntime
  }
  host: EditorPlatform
  state: EditorBaseState
  config: EditorRuntimeConfig
}
```

这个定义里最重要的是两个约束：

1. `kernel` 是基础设施根，不是 feature bag
2. feature 不应该直接吃整个 `kernel`，而应该只拿自己需要的窄切片

例如：

```ts
createNodeTransformFeature({
  document: kernel.document,
  viewport: kernel.spatial.viewport,
  snap: kernel.spatial.snap,
  selection: kernel.state.selection
})
```

而不是：

```ts
createNodeTransformFeature({ kernel })
```

否则 `EditorKernel` 很快又会退化成 service locator。

## 4.2 `state`：必须收缩成 editor 的最小共享语义状态

`state` 不是“所有 store 的集合”，而应该满足下面四个条件：

1. editor 自己拥有
2. 跨 feature 共享
3. 有长期语义
4. 不是临时交互输出

基于这个标准，我认为长期应该只保留：

```ts
type EditorBaseState = {
  tool: ValueStore<Tool>
  selection: SelectionState
  edit: EditState
  frame: FrameState
}
```

下面这些都**不应该**继续放进 base `state`：

1. `interaction`
   源状态应该属于 coordinator，本质上是 interaction kernel 的运行事实，不是 editor base state
2. `history`
   更接近 document / engine 事实，不是 editor 自己拥有的共享语义状态
3. `draw preferences`
   更像 feature preference，应留在 draw feature 自己的 capsule 或 feature slice 中
4. `inputPolicy`
   属于 config，不属于 state
5. 任何 active interaction 的临时变量
   例如 drag 起点、pointer cache、hover candidate
6. 任何 preview / overlay 数据
   这些都应该进入 projection graph

也就是说：

- `state` 负责长期共享语义
- `config` 负责可配置策略
- `feature preferences` 负责 feature 自己的偏好
- `document/engine facts` 留在 document kernel
- `projection` 负责临时视觉或几何输出

只有这样，`state` 才不会再次膨胀。

## 4.3 `EditorProjectionGraph`：值得保留，但必须分层

`EditorProjections` 这个概念我认为是有价值的，因为 editor 的确需要一个统一的临时投影层：

1. 一部分投影服务于内部几何和 read 计算
2. 一部分投影服务于 UI overlay 渲染

真正的问题不是“要不要 projection”，而是“projection 应该怎么分层”。

我建议明确拆成两类：

### A. `model projections`

这类 projection 主要给内部 read / spatial / feature 计算使用，例如：

- node projection
- 未来可能的 edge anchor projection
- 其他内部派生几何缓存

### B. `overlay projections`

这类 projection 主要给 UI 或 React 直接消费，例如：

- draw preview
- edge preview
- marquee
- mindmap drag
- snap guides

推荐总结构：

```ts
type EditorProjectionGraph = {
  model: {
    node: NodeProjectionStore
  }
  overlay: {
    draw: DrawProjectionStore
    edge: EdgeProjectionStore
    marquee: MarqueeProjectionStore
    mindmapDrag: MindmapDragProjectionStore
    snap: SnapGuideProjectionStore
  }
}
```

这层拆分的意义在于：

1. projection 不再和 session 语义混在一起
2. internal read 和 public UI 各自知道应该读哪一层
3. `EditorProjections` 不会继续退化成“临时状态垃圾桶”

同时我建议：

- **public editor 暴露 `editor.projection`，但它只包含 `overlay projections`**
- **`model projections` 只存在于 internal runtime，不直接给 React 读**

也就是说，对外：

```ts
editor.projection.draw
editor.projection.edge
editor.projection.marquee
```

对内：

```ts
editor.internals.projections.model.node
```

这样做的好处是：

1. `editor.session` 可以彻底消失
2. public 不需要再理解内部几何 projection
3. 仍然保留了稳定的 `projection` 命名，而不必再新增一个顶层 `overlay`

React 如果更偏 UI 语义，可以在自己的适配层里把 `projection` 当成 overlay 去消费，但 editor runtime 自己保持 `projection` 这个更中性的命名更合适。

## 4.4 `Feature Capsule`：让 feature 贡献面真正统一

下一层我建议明确引入 `feature capsule`。

每个 feature 不再只是散落的一组：

- read helper
- commands helper
- driver
- preview store
- lifecycle cleanup

而是输出一个统一的贡献体。

推荐形状：

```ts
type EditorFeatureCapsule = {
  key: string
  passive?: readonly PassiveInputProcessor[]
  drivers?: readonly InteractionDriver[]
  read?: Partial<RuntimeRead>
  commands?: Partial<EditorCommands>
  projections?: Partial<EditorProjectionGraph>
  lifecycle?: {
    reset?: () => void
    dispose?: () => void
  }
}
```

更重要的是：

**feature 自己可以拥有内部 source / preference / helper，但这些东西不应该默认被提升进 kernel。**

例如 draw feature 的 preferences，如果只服务于 draw 领域，就应留在 draw capsule 里，而不是继续塞进 base `state`。

## 4.5 `compose`：只做总装，不做业务

`compose` 是整个 editor 的最终装配层。

它只做下面几件事：

1. 创建 kernel
2. 创建 projection graph
3. 创建 feature capsules
4. 汇总 passive processors / drivers
5. 组合 read / commands / projection
6. 返回 public editor

推荐主流程：

```ts
const kernel = createEditorKernel(...)
const projections = createEditorProjectionGraph(...)

const features = [
  createNodeFeature(...),
  createEdgeFeature(...),
  createDrawFeature(...),
  createSelectionFeature(...),
  createMindmapFeature(...)
]

const input = createInputRouter({
  interaction: kernel.interaction,
  drivers: features.flatMap((feature) => feature.drivers ?? []),
  passive: features.flatMap((feature) => feature.passive ?? [])
})

const read = composeEditorRead(kernel, projections, features)
const commands = composeEditorCommands(kernel, features)
const projection = composeEditorProjection(projections, features)

return createPublicEditor({
  read,
  state: kernel.state,
  commands,
  input,
  viewport: kernel.spatial.viewport,
  projection
})
```

`createEditor.ts` 到这里才会真正变成 composition root，而不是继续做超级总工厂。

---

## 5. 对 Public Editor 的影响

如果按上面的模型重构，public editor 也应该一起收紧。

## 5.1 Public Editor 的推荐形状

```ts
type Editor = {
  read: EditorRead
  state: EditorBaseStatePublic
  commands: EditorCommands
  input: EditorInput
  viewport: EditorViewport
  projection: EditorOverlayProjection
  configure(config: Partial<EditorRuntimeConfigPublic>): void
  dispose(): void
}
```

这里最重要的变化有三个：

1. `projection` 成为 public 的一等公民
2. `state` 收缩成 base state，而不是所有 store 的集合
3. `configure` 负责策略类配置，例如 `inputPolicy`

## 5.2 Runtime Editor 的推荐形状

internal runtime 可以保留更多基础设施，但也要有明确边界：

```ts
type EditorRuntime = Editor & {
  internals: {
    kernel: EditorKernel
    projections: EditorProjectionGraph
  }
}
```

这里我明确不建议继续把 internal runtime 设计成一个展开的大平面对象，例如：

- `engine`
- `interaction`
- `pick`
- `snap`
- `node`
- `edge`
- `mindmapDrag`
- `input`

全部平铺在 runtime 根上。

这些东西长期都应该被收回 `kernel` 或 `projections` 里，减少顶层噪音。

---

## 6. 最值得做的七项中间层简化

下面这七项，是我认为最符合长期最优、而且收益最明确的 simplification。

## 6.1 `stores / state / baseRead / internals` 收成 `kernel + projection graph`

### 当前问题

同一能力经常落在多套并行对象里。

### 最优方向

把 editor 中间结构压成：

1. `kernel`
2. `projection graph`

然后：

- `read` 从 `kernel + projection graph + features` 推导
- `commands` 从 `kernel + features` 推导
- `public editor` 从 compose 结果推导

### 收益

1. editor 中间不再同时维护四套平行袋子
2. 新能力的落点显著变少
3. `createEditorStores.ts` 这种文件会自然消失或极度变薄

## 6.2 `read` 改成 feature 贡献式组合

### 当前问题

`runtime/read/index.ts` 仍然是中央知识中心。

### 最优方向

让 feature 直接贡献自己的 read augment：

```ts
createNodeFeature(...) => { read: { node: ... } }
createEdgeFeature(...) => { read: { edge: ... } }
createSelectionFeature(...) => { read: { selection: ..., context: ... } }
```

然后统一：

```ts
composeEditorRead(kernel, projections, features)
```

### 收益

1. `read/index.ts` 不再知道所有业务域细节
2. feature 之间的依赖方向更稳定
3. 新 feature 接入成本更低

## 6.3 `commands/runtime.ts` 这种 dependency bag 需要去袋化

### 当前问题

现在的命令装配仍然是“先散开，再打包，再拆开”。

### 最优方向

让各 feature 直接暴露自己领域命令真正需要的依赖，而不是统一塞进一个大 runtime bag。

例如：

```ts
const nodeCommands = createNodeCommands({
  engine: kernel.document.engine,
  selection: kernel.state.selection,
  nodeProjection: projections.model.node
})
```

而不是：

```ts
const runtime = createEditorCommandRuntime(...)
const commands = createEditorCommands({ runtime })
```

### 收益

1. 少一层中间依赖运输
2. 命令边界更贴近领域
3. `EditorCommandRuntime` 不会继续膨胀

## 6.4 coordinator 需要原生支持 `replace(next)`

### 当前问题

像 selection press 这种两段式交互，本质上是：

```ts
press -> drag
press -> marquee
```

但当前这个转换仍然容易散落在 feature 内部。

### 最优方向

让 interaction kernel 原生支持 session transition：

```ts
type InteractionHandle = {
  finish(): void
  cancel(): void
  pan(pointer): void
  replace(next: ActiveInteractionSession): boolean
}
```

### 收益

1. `press -> drag / marquee` 可以从 feature 内部抽回 interaction kernel
2. 两段式交互写法统一
3. feature 文件显著变薄

## 6.5 `editor.session` 彻底改成 `editor.projection`

### 当前问题

名字错位，持续制造认知噪音。

### 最优方向

统一成：

```ts
editor.projection
```

同时明确：

- public `projection` 只暴露 overlay projections
- internal `projections.model` 只给 runtime 内部使用

### 收益

1. projection 和 interaction session 彻底解绑
2. React 消费层语义更准确
3. internal 对象模型更干净

## 6.6 context menu 应该降级成 capability + summary，不再是 editor 内部 UI view model

### 当前问题

editor 现在承载了偏重的 menu schema / group / label / section 逻辑。

### 最优方向

editor 只提供：

1. selection summary
2. selection capabilities
3. semantic operations

React 再决定：

1. 菜单怎么分组
2. 菜单怎么排序
3. 文案和 UI 结构

### 收益

1. editor 中间层更薄
2. UI view model 不再继续挤在 runtime 内核里
3. 不同 UI 宿主更容易复用 editor 行为层

## 6.7 文件结构、命名和职责一起收口

### 当前问题

现在很多文件名和职责并没有严格对齐底层模型。

### 最优方向

强制统一三层命名：

1. `driver`
   只表示启动器
2. `interaction`
   只表示活跃会话
3. `projection`
   只表示临时输出

例如下面这些文件，长期都应该对齐：

- `features/node/session/node.ts`
  如果它本质上是 node projection store，就应该改成 `features/node/projection/store.ts`
- `features/node/session/transform.ts`
  如果它本质上是 node transform interaction，就应该改成 `features/node/transform/interaction.ts`
- `features/mindmap/session/drag.ts`
  如果它本质上是 drag overlay store，就应该改成 `features/mindmap/drag/projection.ts`

### 收益

1. 文件名能直接表达职责
2. 架构瘦身会反映到目录结构，而不只是概念图
3. 新 feature 的接入方式更容易被团队复用

---

## 7. 一步到位的实施方案

下面按“不考虑兼容和过渡层”的前提，给出一次性重构方案。

## 第 1 步：收紧对象模型和命名

直接废弃 `editor.session`，统一改成 `editor.projection`。

同时把所有内部文件按三层语义重新命名：

1. `driver`
2. `interaction`
3. `projection`

这一步不是表面重命名，而是强制把职责重新对齐。

## 第 2 步：定义 `EditorBaseState` 和 `EditorRuntimeConfig`

直接把 `state` 收成最小边界：

1. `tool`
2. `selection`
3. `edit`
4. `frame`

同时把下面这些东西移出 base state：

1. `interaction`
2. `history`
3. `draw preferences`
4. `inputPolicy`
5. 所有 active interaction 临时变量

目标是让 `state` 只剩长期共享语义，不再混装。

## 第 3 步：抽出最小化 `EditorKernel`

统一把跨 feature 基础设施收成：

1. `document`
2. `interaction`
3. `spatial`
4. `host`
5. `state`
6. `config`

但注意：

feature 不允许默认拿整个 `kernel`，只能拿窄切片。

## 第 4 步：抽出 `EditorProjectionGraph`

把所有 projection 统一收成两层：

1. `model`
2. `overlay`

其中：

- `model` 只给 internal read / spatial / feature 算法用
- `overlay` 才是 public `editor.projection`

## 第 5 步：把 feature 改造成 capsule

每个 feature 统一输出：

1. drivers
2. passive processors
3. read augment
4. commands augment
5. projection contribution
6. lifecycle hooks

同时允许 feature 保留自己的 private source / preference，但不要默认提升到 `kernel.state`。

## 第 6 步：重写 read / commands / input composition

让 compose 层统一做三件事：

1. 汇总所有 feature 贡献
2. 组装 read / commands / projection
3. 组装 input router

这样中央超级工厂会自然消失。

## 第 7 步：升级 coordinator 支持 transition

把 `replace(next)` 变成 interaction kernel 的原生能力。

这样像 selection press 这种“两段式交互”才能从 feature 内部抽干净。

## 第 8 步：压薄 `createEditor.ts`

最终 `createEditor.ts` 应该只做：

1. 创建 kernel
2. 创建 projection graph
3. 创建 feature capsules
4. compose
5. 返回 public editor

到这一步，`createEditor.ts` 才是真正的 composition root。

## 第 9 步：React 只依赖 public runtime 形状

`whiteboard-react` 不应该继续直接 import editor 内部 runtime 类型路径。

长期最优应是：

- React 只依赖稳定 public editor 类型
- editor 内部的 `kernel / projections / capsule` 重组不再直接波及 React

---

## 8. 哪些东西不需要继续保留

不是所有“看起来能抽象”的地方都值得保留。

## 8.1 不需要更大的 `EditorKernel`

如果 `EditorKernel` 最终变成：

- 所有 runtime
- 所有 session
- 所有 preview
- 所有 helper

的全集，那么这个概念就没有价值了。

`EditorKernel` 的价值只在于：

**承载最小基础设施。**

## 8.2 不需要把所有 store 都叫 `state`

只因为一个东西是 store，不代表它就应该进入 editor `state`。

这条边界如果不守住，后面所有架构都会重新失焦。

## 8.3 不需要把 `EditorProjections` 做成临时状态垃圾桶

projection graph 只应该收：

1. 共享的内部派生 projection
2. 共享的 overlay 输出

不应该把所有 interaction 临时变量都塞进去。

## 8.4 不需要万能 feature 基类

例如：

- `BaseFeatureRuntime`
- `AbstractDriver`
- `UniversalSessionFactory`

这类抽象通常只会把真正重要的领域差异重新糊掉。

## 8.5 不需要继续把 UI view model 放进 editor

editor 长期最优应更像：

- 行为内核
- 投影提供者
- 领域能力组合器

而不是 UI 结构总装层。

---

## 9. 最终建议

如果只给一个长期判断，那就是：

**`whiteboard-editor` 的下一轮复杂度下降，关键不是继续修边角，而是完成一次底层模型对齐。**

这次对齐里最核心的几件事是：

1. 保留 `EditorKernel`，但把它收成最小基础设施根
2. 把 `state` 收成 `tool / selection / edit / frame`
3. 把 `inputPolicy` 放回 config，把 `draw preferences` 放回 feature，把 `history` 放回 document
4. 保留 `EditorProjections`，但明确拆成 `model + overlay`
5. 彻底删除 `editor.session` 这层错误命名
6. 用 `feature capsule` 取代散落的 feature 接入方式
7. 让 `createEditor.ts` 退回真正的 composition root

最后落成的长期最优主线，应该是：

```ts
kernel
  -> projection graph
  -> feature capsules
  -> compose
  -> public editor
```

一旦这条主线建立起来：

1. feature 接入方式会统一
2. 中间层对象数量会明显减少
3. driver / interaction / projection 的职责会彻底分开
4. 文件命名、目录结构和底层模型会重新对齐
5. React 和 editor 的边界也会更稳

当前实现层面，interaction 这一段最适合落地的，不是“万能 session factory”，而是一个很薄的 `runtime/interaction/sessionSlot`：

1. 只统一 `active / session / start / cancel / cleanup`
2. 不接管 projection 写入
3. 不接管业务 update / commit 逻辑
4. 不把 feature 交互过程抽成公共基类

这样做的好处是：

1. `edge / node / marquee / draw / viewport / press` 这一类重复骨架可以明显收敛
2. 业务计算仍然留在 feature 本地，可读性不会因为抽象而下降
3. 它是在强化 active interaction session 的边界，而不是重新把 session 和 projection 混回去

这才是当前阶段最符合长期最优的 simplification。
