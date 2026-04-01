# WHITEBOARD_EDITOR_FINAL_ARCHITECTURE_PLAN.zh-CN

## 文档定位

这是一份最终版总文档。

它回答的不是某一条 interaction、某一个 projection、某一个 helper 应该怎么改，而是：

- 从整个 `whiteboard-editor` 来看，当前设计是否已经达到长期最简最优
- 如果完全不在乎重构成本，哪些概念应该保留，哪些概念应该删除
- editor 的最终稳定主轴应该是什么
- public surface、runtime、中间层、interaction、overlay、read、commands 最终应该如何对齐

这份文档以长期最优为准。
不考虑兼容，不保留过渡层，不为了当前实现继续兜底。

同时，这份文档明确遵守一个约束：

- **不能过度设计**

也就是说，目标不是做成一个通用框架，而是做成一个长期稳定、概念尽量少、表达真实产品模型的 editor。

---

## 最终结论

## 1. 当前设计不是最简最优

结论很直接：

- **现在的 `whiteboard-editor` 已经比之前合理很多，但还不是长期最简最优**

它的问题不在于“不能工作”，也不在于“局部代码完全错误”。

它的问题在于：

- 已经有了不少正确方向
- 但整个系统的主轴还没有完全收拢
- 还保留着不少“为了组织当前代码而存在”的层

所以整体读起来会出现一种感觉：

- 不是乱
- 但不够顺
- 不是很丑
- 但不够整块

这正说明系统已经脱离最糟糕的阶段，但还没有到长期稳定形态。

---

## 2. 当前最大的结构性问题

当前 editor 最大的问题不是某个函数写法，而是整体上同时存在太多“半合理层”：

- `kernel`
- `read`
- `commands`
- `interaction`
- `input`
- `feedback`
- `transient`
- `lifecycle`
- `finalize`
- `interaction host`

这些层单独看很多都“有道理”，但组合起来之后，会有三个直接后果：

- feature 仍然要跨层拼语义
- runtime 主轴不够明确
- 预览态、交互态、公开态没有真正打通

换句话说：

- 现在的问题不是“层不够多”
- 而是“层已经有点太多，而且不少层的职责没有彻底闭合”

---

## 3. 长期最优的方向

长期最优不是继续增加抽象。

长期最优应该是：

- 保留更少的稳定概念
- 让每个概念只负责一件事
- 让 interaction 成为真正的行为中轴
- 让 overlay 成为唯一临时可视状态中轴
- 让 public surface 只暴露稳定语义，而不暴露内部实现痕迹

一句话总结：

- **不是继续“整理当前结构”，而是把 editor 收敛成更少、更硬、更语义化的几根主轴**

---

## 设计原则

## 1. 不做通用框架

长期最优不应该引入这些东西：

- 通用状态机框架
- 事件总线
- plugin pipeline
- 多层 context factory
- 一整套 starter / resolver / runner / controller / facade 协议
- 为未知 host 预留的通用 runtime 抽象

这些都会重新制造复杂度。

editor 不是平台框架。
editor 是一个明确产品模型下的运行时。

---

## 2. 只保留稳定概念

一个概念只有满足下面条件才值得保留：

- 它对应真实产品语义
- 它会长期稳定
- 它能明显降低系统复杂度

否则就不该存在。

这意味着下面这些东西不该成为长期稳定概念：

- `InteractionHost`
- `PassiveInputRuntime`
- `NodeTransient` / `EdgeTransient` 与多份 feedback runtime 并存
- `kernel` 这种杂糅性极强但语义不清的概念
- 对外暴露内部 phase

---

## 3. editor 只保留一个行为中轴

长期最优里，editor 的行为中轴必须非常明确：

- **Interaction Runtime**

不是 `commands`。
不是 `read`。
不是 `kernel`。
不是 `host`。

`commands` 是写入口。
`read` 是读入口。
但 editor 的“运行时行为”中轴，必须是 interaction runtime。

因为用户和 editor 的核心关系，本质上就是：

- 输入
- 命中
- 会话
- 预览
- 提交

这条线如果不是中轴，系统就会一直在边缘层之间来回拼装。

---

## 4. editor 只保留一个临时状态中轴

长期最优里，editor 的临时可视状态中轴也必须唯一：

- **Overlay**

不是：

- node transient
- edge transient
- draw preview
- marquee feedback
- mindmap drag feedback
- edge guide
- snap guide

这些只是 overlay 的不同语义切片，不应该是并列 runtime。

---

## 5. public surface 只暴露稳定语义

public API 不应该暴露：

- 内部 phase
- 内部 helper 组织方式
- 内部 feedback/runtime 拆分方式
- registry/config 等实现细节资产

public surface 应只暴露稳定使用语义：

- 状态
- 读
- 写
- 输入
- 反馈
- 销毁

---

## 当前设计里哪些方向是对的

下面这些方向是对的，应该保留：

- `commands` 作为单一写入口
- `whiteboard-core` / `whiteboard-engine` 承担纯算法与文档层
- `viewport` 保持热路径 getter 风格
- interaction 已经收敛成少数 owner，而不是每个 phase 一个顶层 feature
- `selection` / `draw` / `edge` 逐步转向 owner 内部 phase 模型

这些说明大方向已经对了。

问题不在方向错，而在于还没收口到最终形态。

---

## 当前设计里哪些概念不该保留到最终版

下面这些概念，我认为不该进入最终稳定形态：

## 1. `kernel`

当前 `kernel` 实际上装了很多不属于一个清晰概念的东西：

- engine
- registry
- viewport
- interaction
- inputPolicy
- tool
- edit
- selection

这个东西现在能用，但它不是一个稳定产品概念。

它更像：

- 当前 createEditor 过程中的组合结果

长期最优里，这个概念应该消失。

替代方式不是换个名字继续保留。
而是把它拆回真正的稳定中轴：

- runtime state
- interaction runtime
- document adapter

---

## 2. `InteractionHost`

`InteractionHost` 现在看起来像 feature 中轴，但本质上只是资产清单：

- `read`
- `config`
- `registry`
- `interaction`
- `inputPolicy`
- `commands`
- `viewport`
- `output`

这类对象的问题是：

- 它让参数表面上变少
- 但 feature 仍然要自己决定底层资产怎么拼成语义

这不是中轴。
这是打包过的底层零件。

长期最优里，feature 应该吃的是语义化 `InteractionRuntime`，不是 `InteractionHost`。

---

## 3. `PassiveInputRuntime`

这是当前 interaction 模型仍然不够彻底的一个证据。

只要系统里同时存在：

- active interaction
- passive processor

就意味着同一个 owner 的行为会被拆成两套 runtime 组织方式。

最典型的就是：

- `edge` 本体
- `edge hover`

长期最优里，idle hover、leave、blur、wheel 都应该回到 owner 自己的 `observe` 行为里。

所以：

- `runtime/input/passive.ts`

不应该保留到最终版。

---

## 4. 多份 `feedback` / `transient` runtime

当前这套拆法虽然能工作，但不会是长期最优：

- `runtime/transient/node.ts`
- `runtime/transient/edge.ts`
- `runtime/feedback/edgeGuide.ts`
- `runtime/feedback/marquee.ts`
- `runtime/feedback/mindmapDrag.ts`

这类拆法会造成：

- feature 需要自己写多个 store
- feature 需要自己 clear 多个 store
- read 和 feedback 两侧都要投影一次

长期最优里，这些都应该统一成一份 overlay。

---

## 5. 对外暴露内部 interaction phase

当前 public interaction state 虽然已经做了一层语义布尔收敛，但内部仍然依赖这些 mode：

- `press`
- `marquee`
- `node-drag`
- `mindmap-drag`
- `node-transform`
- `edge-drag`
- `edge-connect`
- `edge-route`

这些都只是 owner 内部 phase，不该成为 runtime 的对外稳定面。

长期最优里，对外只保留 owner 级语义：

- `viewport`
- `insert`
- `draw`
- `select`
- `edge`

---

## editor 的最终稳定概念

如果完全按长期最优重建，我建议整个 editor 只保留下面六个稳定概念。

## 1. Document

这里不是 `whiteboard-editor` 内部模块，而是 editor 依赖的底层文档层：

- `whiteboard-engine`
- `whiteboard-core`

职责只有：

- 文档数据
- 纯读
- 纯写
- 提交历史
- 纯算法

Document 不负责：

- interaction
- overlay
- host 平台
- React 语义

---

## 2. Runtime State

这是一份 editor 自己的最小运行时状态。

它只存真正属于 editor 运行时的状态：

- `tool`
- `selection`
- `edit`
- `viewport`
- `interaction`
- `pointer`
- `options`

这里的 `interaction` 指的是 owner 级会话状态，不是具体 phase。

运行时状态只负责：

- 持有当前 editor 本地状态
- 订阅 document commit 后做 reconcile

它不负责：

- 领域读模型
- 命令编排
- feature 行为
- overlay 写入

---

## 3. Overlay

Overlay 是 editor 唯一的临时可视状态中轴。

它统一承载：

- node patches
- node hovered
- node hidden
- edge patches
- active route index
- draw preview
- marquee preview
- mindmap drag preview
- edge guide
- snap guides

最终形式应该是一份统一 state：

```ts
type EditorOverlay = {
  node: {
    patches: readonly NodePatchEntry[]
    hovered?: NodeId
    hidden: readonly NodeId[]
  }
  edge: {
    patches: readonly EdgePatchEntry[]
  }
  draw: {
    preview: DrawPreview | null
  }
  select: {
    marquee?: MarqueePreview
    mindmapDrag?: MindmapDragPreview
  }
  guides: {
    edge?: EdgeGuide
    snap?: SnapGuides
  }
}
```

关键点不是具体字段名，而是：

- 所有临时可视状态都走这一份中轴
- feature 不再直接知道多个 feedback/transient runtime

---

## 4. Interaction Runtime

这是整个 editor 的行为中轴。

它负责：

- owner 注册
- owner 优先级
- pointer down 决定由哪个 owner 接管
- active session 生命周期
- idle observe 生命周期
- autopan
- overlay 生命周期配合
- public interaction state

长期最优里，它应该直接面向 owner，而不是面向碎片化 interaction registration + passive processor + host。

推荐最终概念如下：

```ts
type InteractionOwnerKey =
  | 'viewport'
  | 'insert'
  | 'draw'
  | 'select'
  | 'edge'

type InteractionOwner = {
  key: InteractionOwnerKey
  priority: number
  start: (input: PointerDown, rt: InteractionRuntime) => InteractionSession | null
  observe?: {
    move?: (input: PointerMove, rt: InteractionRuntime) => void
    leave?: (rt: InteractionRuntime) => void
    blur?: (rt: InteractionRuntime) => void
    wheel?: (input: WheelInput, rt: InteractionRuntime) => boolean
  }
  clear?: (rt: InteractionRuntime) => void
}
```

这里只保留五个 owner：

- `viewport`
- `insert`
- `draw`
- `select`
- `edge`

其余所有 phase 都只存在于 owner 内部 session。

---

## 5. Interaction Model

这是 interaction 专用语义读层。

它不等于 public `read`。

它负责把：

- document
- runtime state
- overlay

组合成 owner 真正需要的语义查询。

例如：

- selection press resolve
- marquee query
- node drag session create
- node transform session create
- edge connect session create
- edge route handle resolve
- draw brush resolve
- draw erase hit query
- mindmap drag session create

只要 feature 还需要自己跨 `read/index/config/output` 拼这些东西，interaction model 就没有到位。

---

## 6. Public Facade

editor 对外最终只应该暴露稳定使用界面。

我建议最终 public surface 收成：

- `state`
- `read`
- `commands`
- `input`
- `feedback`
- `dispose`

最多再加一个：

- `configureOptions`

但不要再多。

这意味着下面这些不应该作为 editor 顶层 public surface 存在：

- `registry`
- `config`
- `viewport`
- `interaction`
- `clipboard`

如果确实需要它们，也应该被收进上面几个稳定 namespace 中。

---

## public surface 的最终建议

## 1. `state`

`state` 应包含所有对外可观察的 editor 运行时状态：

- `tool`
- `selection`
- `edit`
- `interaction`
- `viewport`

也就是说：

- 当前单独的 `editor.interaction.state`
- 当前单独的 `editor.viewport`

都应考虑收回 `state` 或 `read`。

如果确实有高频 viewport 几何能力，也应放在 `read.viewport`，而不是再做顶层 namespace。

---

## 2. `read`

`read` 是 public 读模型。

它面向：

- React
- 宿主层
- 插件
- 工具栏和菜单

它不承担 interaction 语义层职责。

它只暴露稳定读能力：

- 文档读
- 视图读
- 选区读
- viewport 读
- 只读几何换算

当前 `read` 里一部分内容是对的。
但 interaction 不应继续主要依赖它。

---

## 3. `commands`

`commands` 继续作为唯一写入口，这是当前最对的一层之一。

但长期最优里要更彻底：

- interaction 只通过 `commands` 写文档和本地状态
- 不再额外长出 bridge helper 去拼“半命令”

同时，下面这些都应归入 `commands`，而不是顶层 editor namespace：

- tool 写入
- selection 写入
- edit 写入
- viewport 写入
- 文档插入

---

## 4. `input`

`input` 继续保留，但它必须是薄路由。

它只负责：

- 输入归一
- 调 interaction runtime

它不应该承载 feature 逻辑。

---

## 5. `feedback`

`feedback` 保留，但它不应该再有独立 runtime 身份。

它应该只是 overlay 的 public selector。

也就是说：

- `feedback` 是 overlay 对外暴露的一部分
- 不是和 overlay 并列的一套内部系统

---

## 6. `clipboard`

长期最优里，我不建议 `clipboard` 继续作为 editor 顶层 public surface 存在。

原因不是功能不需要，而是：

- 系统剪贴板是 host / platform 语义
- editor 核心只需要纯 packet export/import 能力

更合理的做法是：

- editor core 提供纯 slice export / insert 能力
- platform adapter 负责和系统 clipboard 对接

所以当前：

- `runtime/clipboard.ts`

在长期最优里应下沉到 host adapter，或被拆成纯 packet 能力 + platform clipboard 能力。

---

## 7. `registry` 与 `config`

长期最优里，这两个都不应该挂在 editor 顶层 public surface。

### `registry`

`registry` 是定义和渲染体系的依赖，不是 editor 的运行时状态。

如果 React 渲染层需要它，应该在更高一层 host composition 持有，而不是从 editor 实例回读。

### `config`

`config` 是 document / algorithm 的配置输入，而不是 editor public runtime 资产。

如果真的需要变更，应通过明确命令或 option update 入口进行，而不是直接暴露整份 config。

---

## 最终内部结构

如果完全按长期最优重做，我建议 `whiteboard-editor` 内部最终收成下面这条主干。

## 一、Runtime State

位置建议：

- `src/runtime/state.ts`

或：

- `src/runtime/state/index.ts`

职责：

- 创建并持有本地 runtime state
- 订阅 document commit 做 selection/edit reconcile
- 提供 runtime state read/write

这里应吸收当前这些概念的合理部分：

- `runtime/state/edit.ts`
- `runtime/state/selection.ts`
- `runtime/viewport.ts`
- `runtime/editor/finalize.ts`
- 当前 `pointer snapshot`

并删除独立的 `kernel` 概念。

---

## 二、Overlay

位置建议：

- `src/runtime/overlay.ts`

职责：

- 创建统一 overlay store
- 提供 overlay write API
- 提供 overlay public selectors
- 为 read / feedback 提供临时态投影

这里应吸收当前这些东西：

- `runtime/transient/node.ts`
- `runtime/transient/edge.ts`
- `runtime/feedback/*`
- `draw feedback`
- `snap guides`

---

## 三、Interaction Model

位置建议：

- `src/runtime/model/index.ts`
- `src/runtime/model/selection.ts`
- `src/runtime/model/node.ts`
- `src/runtime/model/edge.ts`
- `src/runtime/model/draw.ts`
- `src/runtime/model/mindmap.ts`

职责：

- 给 owner 提供语义化查询
- 组合 document + runtime state + overlay

这里应吸收当前散落在：

- `runtime/read/*`
- `interactions/* helper`
- 一部分 `query/*`

里的 interaction 语义拼装逻辑。

---

## 四、Interaction Runtime

位置建议：

- `src/runtime/interactions/index.ts`
- `src/runtime/interactions/runtime.ts`
- `src/runtime/interactions/select.ts`
- `src/runtime/interactions/draw.ts`
- `src/runtime/interactions/edge.ts`
- `src/runtime/interactions/insert.ts`
- `src/runtime/interactions/viewport.ts`

职责：

- owner 注册
- owner 调度
- session 生命周期
- overlay 生命周期
- idle observe
- autopan

注意：

- 这里只保留五个 owner 文件
- 不再保留独立 `passive.ts`
- owner 内部 phase 私有化

---

## 五、Public Read

位置建议：

- `src/runtime/read/index.ts`

职责：

- public read facade
- 面向 React 和 host 的稳定读接口

它不再承担 interaction model 的职责。

---

## 六、Commands

位置建议：

- `src/runtime/commands/index.ts`

职责：

- 唯一写入口
- 只做命令，不做交互语义拼装

它可以继续按领域拆分：

- `tool`
- `selection`
- `edit`
- `viewport`
- `node`
- `edge`
- `mindmap`
- `insert`

但不应再通过各种 host/context 把交互逻辑塞回 command 层。

---

## 七、Input

位置建议：

- `src/runtime/input.ts`

或保留目录但更薄。

职责：

- 输入归一
- 调 interaction runtime

不再承载 passive feature 模型。

---

## 八、Editor Surface

位置建议：

- `src/runtime/editor.ts`

职责：

- 组装 runtime state
- 组装 overlay
- 组装 interaction model
- 组装 commands
- 组装 interaction runtime
- 组装 input
- 组装 public read/feedback
- 输出最终 editor 实例

这里替代当前：

- `createEditor.ts`
- `kernel.ts`
- `assembleInteractions.ts`
- `composeInput.ts`
- `lifecycle.ts`

中分散的组装角色。

---

## 整体数据流

长期最优 editor 的数据流应该只有下面这一条主线：

1. host 把输入交给 `editor.input`
2. `input` 归一输入并调用 `interaction runtime`
3. `interaction runtime` 调度 owner
4. owner 通过 `interaction model` 读取语义数据
5. owner 将临时可视结果写入 `overlay`
6. owner 通过 `commands` 提交真正写操作
7. document commit 后由 `runtime state` 做 reconcile
8. `public read` 与 `feedback` 从 document + runtime state + overlay 派生

这条线必须闭合。

只要中间还有“feature 自己去多个层里找资产拼语义”的过程，系统就还没到最终形态。

---

## 具体到 interactions 的最终组织

## 1. `select`

`select` 最终必须是一个真正 owner。

内部 phase：

- `press`
- `marquee`
- `node-drag`
- `transform`
- `mindmap-drag`

但这些 phase 全部私有化。

对外和 runtime 只暴露：

- owner 是 `select`

不再保留：

- `selectionHelpers.ts` 这种桥接层
- 独立 `marquee` 公共 phase 工厂
- 独立 `node/drag` 公共 phase 工厂
- 独立 `node/transform` 公共 phase 工厂
- 独立 `mindmap` 公共 phase 工厂

如果需要纯函数，应下沉到 core 或成为 `select` 私有局部模块。

---

## 2. `draw`

`draw` 最终也是一个 owner。

内部 phase：

- `stroke`
- `erase`

但不再保留：

- `feedback.ts` 这种因为 output 过碎才存在的桥接层
- 手工拼的 `strokeDeps` / `eraseDeps`

`draw` 应直接依赖：

- `model.draw`
- `overlay`
- `commands`

---

## 3. `edge`

`edge` 最终应该统一包含：

- connect
- reconnect
- body move
- route drag
- idle hover

也就是说：

- `edge hover` 不再是另一条 runtime

它应成为 `edge` owner 的 `observe.move` 行为。

---

## 4. `viewport`

`viewport` 保持最薄 owner 即可。

这条线当前已经比较接近长期最优。

---

## 5. `insert`

`insert` 也保持最薄 owner 即可。

这条线当前也比较接近长期最优。

---

## 对 `read`、`commands`、`interaction` 三者关系的最终判断

这三者在长期最优里应该严格分工：

## `read`

- 面向外部
- 提供稳定读能力

## `commands`

- 面向写入
- 提供唯一写入口

## `interaction`

- 面向行为
- 是 editor 运行时的真正中轴

当前系统最大的问题之一，就是这三者虽然都有了，但 interaction 还不够“像中轴”。

它仍然需要靠：

- `host`
- `helper`
- `read` 拼装
- `output` 拼装

来补足语义。

长期最优必须把 interaction 提升为真正的第一公民。

---

## 当前 createEditor 链路为什么还不够优

现在 `createEditor` 里大致做的是：

- create preferences
- create transients / feedback
- create kernel
- create read
- create snap
- create commands
- create clipboard
- create interaction host
- assemble interactions
- compose input
- create lifecycle
- derive interaction state
- assemble final editor

这条链能工作，但不是长期最优。

因为它明显带着一种“先把零件造出来，再找地方把它们接起来”的味道。

长期最优里，createEditor 链路应该变成：

1. create document adapter
2. create runtime state
3. create overlay
4. create interaction model
5. create commands
6. create interaction runtime
7. create input
8. create public read
9. create public feedback
10. assemble editor surface

这条链的区别在于：

- 先确定中轴
- 再构造围绕中轴工作的层

而不是先造一堆层，再用 `host` 和 `assemble` 把它们拼起来。

---

## 是否需要保留 `finalize`

需要保留这个职责，但不需要保留这个文件概念。

当前 `finalize.ts` 负责：

- 过滤不存在的 selection 项
- 清除失效 edit target

这件事本质上是：

- runtime state reconcile

所以长期最优里，这个职责应该进入：

- runtime state commit reconcile

而不是作为 editor 组装链里一个独立 finalize helper。

---

## 是否需要保留 `clipboard`

需要保留“纯 slice packet 导出/导入能力”，但不需要保留“editor 顶层 clipboard namespace”。

长期最优里：

- editor core 提供 packet 能力
- platform/host 提供系统 clipboard 对接

这能减少 editor 核心里不属于纯编辑运行时的东西。

---

## 是否需要保留 `registry`

需要作为 createEditor 输入依赖。

但不应该保留为 editor 顶层 public asset。

如果 React 渲染层需要 registry，应在 host composition 层共享，而不是从 editor 再读出来。

---

## 最终建议的 public API 形态

长期最优我建议最终 `Editor` 收成如下形态：

```ts
type Editor = {
  state: {
    tool: ReadStore<Tool>
    selection: ReadStore<SelectionTarget>
    edit: ReadStore<EditTarget>
    interaction: ReadStore<InteractionPublicState>
    viewport: ReadStore<Viewport>
  }
  read: EditorRead
  commands: EditorCommands
  input: EditorInput
  feedback: EditorFeedback
  dispose: () => void
}
```

如确有必要，可增加：

- `setOptions(...)`

但不建议再增加新的顶层 namespace。

这里的关键不是字段名，而是下面这几个约束：

- 不暴露 `registry`
- 不暴露整份 `config`
- 不暴露顶层 `clipboard`
- 不暴露顶层 `viewport` imperative runtime
- 不暴露顶层 `interaction` namespace

全部收回稳定表面。

---

## 最终目录建议

如果完全一步到位重构，我建议最终目录收成这样：

```text
packages/whiteboard-editor/src/
  index.ts
  runtime/
    editor.ts
    state.ts
    overlay.ts
    input.ts
    read.ts
    commands/
      index.ts
      tool.ts
      selection.ts
      edit.ts
      viewport.ts
      node.ts
      edge.ts
      mindmap.ts
      insert.ts
    model/
      index.ts
      selection.ts
      node.ts
      edge.ts
      draw.ts
      mindmap.ts
    interactions/
      runtime.ts
      select.ts
      draw.ts
      edge.ts
      insert.ts
      viewport.ts
```

这里只表达最终概念，不要求字面路径完全一致。

重点是：

- 删除 `kernel`
- 删除 `host`
- 删除 `passive`
- 删除多份 `feedback/transient`
- 删除 interaction phase 级公共 glue 文件

---

## 需要删除或吸收的现有文件类别

长期最优里，下面这些类别都应被删除或吸收：

- `runtime/editor/kernel.ts`
- `runtime/editor/assembleInteractions.ts`
- `runtime/editor/composeInput.ts`
- `runtime/interaction/host.ts`
- `runtime/input/passive.ts`
- `runtime/transient/*`
- `runtime/feedback/*`
- `runtime/editor/finalize.ts`
- `interactions/*` 下大量 phase/helper 级公共文件

注意：

- 不是逻辑消失
- 而是这些逻辑应回归到更稳定的主轴

---

## 实施顺序

如果以后要真正全面重做，我建议严格按下面顺序执行。

## 第 1 步

先建新的 runtime state 和 overlay。

因为只要临时态还是碎的，interaction 不可能真正变简单。

## 第 2 步

建立 interaction model。

先把 owner 需要的语义查询从 `read` 和 helper 中抽出来。

## 第 3 步

重写 interaction runtime。

把 active/passive 合并成 owner + observe 模型。

## 第 4 步

先重写 `draw` 和 `edge`。

因为它们边界更清晰，适合验证新中轴。

## 第 5 步

最后重写 `select`。

因为 `select` 是最复杂的 owner，它依赖整条 interaction model 和 overlay 链完全成型。

## 第 6 步

收紧 public surface。

移除顶层：

- `registry`
- `config`
- `clipboard`
- `viewport`
- `interaction`

并把 `feedback` 改成 overlay selector。

---

## 最终验收标准

如果重构完成，下面这些条件必须同时满足，才算真正达到长期最优。

## 1. editor 只剩少数稳定概念

- document
- runtime state
- overlay
- interaction runtime
- interaction model
- public facade

## 2. interaction 成为真正的行为中轴

- 只有五个 owner
- phase 不再对外暴露
- 没有 passive 第二模型

## 3. overlay 成为唯一临时态中轴

- 没有多份 transient/feedback runtime 并列存在

## 4. feature 不再自己跨层拼语义

- 不再依赖 `InteractionHost`
- 不再频繁 `Pick<...>` 组合局部依赖

## 5. public surface 稳定且更小

- editor 顶层 namespace 显著减少
- 不暴露内部实现资产

## 6. createEditor 装配链变直

- 先建中轴
- 再建围绕中轴工作的层
- 不再先造一堆零件再靠 host/assemble 拼起来

---

## 最后结论

如果只回答一句话：

- **从整个 editor 来看，当前设计还不是最简最优**

它的问题不是不工作，也不是局部逻辑都错。
它的问题是：

- 主轴还不够少
- 中轴还不够硬
- interaction 还没完全成为第一公民
- overlay 还没有统一

长期最优不是继续在当前结构上做小修小补。

长期最优应该是：

- 删除 `kernel`、`host`、`passive`、多份 feedback/transient runtime
- 建立 `runtime state + overlay + interaction model + interaction runtime`
- 把 `commands` 保持为唯一写入口
- 把 `read` 保持为 public 读入口
- 把 editor public surface 收紧成稳定的小接口

这条路线既不是推翻成大框架，也不是继续修修补补。

它是：

- 用更少的概念
- 覆盖更完整的 editor 真实模型

这才是我认为符合长期最优、同时又不过度设计的最终形态。
