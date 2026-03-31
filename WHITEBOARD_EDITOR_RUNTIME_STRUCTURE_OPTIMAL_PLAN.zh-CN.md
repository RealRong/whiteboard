# WHITEBOARD_EDITOR_RUNTIME_STRUCTURE_OPTIMAL_PLAN.zh-CN

## 目标

这份文档只回答一件事：

- `packages/whiteboard-editor/src/runtime` 以及相邻的 `features` / `types` / root entry，长期最优应该怎么排布
- 当前哪些目录和文件命名不对、层次不对、职责不对
- 最终应该按什么原则收敛，才能做到结构清晰、命名统一、跳转最短、噪音最少

本文以长期最优为准。
不考虑兼容，不保留过渡层，不为历史结构兜底。

---

## 核心结论

当前 `whiteboard-editor` 的问题，不是“文件太多”，而是 **分层标准混杂**。

现在同一层里同时混着 4 类东西：

- feature 真正的行为实现
- editor 对 feature 的装配器
- editor kernel 自己的本地状态
- editor 对外 public command 的 builder

这些东西现在分别散在：

- `src/features/*`
- `src/runtime/editor/features/*`
- `src/runtime/selection/*`
- `src/runtime/edit.ts`
- `src/runtime/frame.ts`
- `src/runtime/commands/*`

这说明现在的目录不是按“职责所有权”在分，而是按：

- 历史残留
- 实现手段
- 临时装配方式

混在一起分。

长期最优只应该保留两条分层轴：

1. 这是 feature 行为，还是 runtime 基础设施
2. 这是哪个领域的所有权

除此之外，不应该再引入第三套主轴，比如：

- store
- commands
- context
- features
- assembler
- model

这些词可以作为局部实现细节存在，但不应该主导整个目录结构。

一句话总结：

- `features/` 只放 feature 行为实现
- `runtime/` 只放 editor runtime 基础设施和装配
- `types/` 只放真正的 public contract
- internal 语义不要再和 public API 复用同一套命名

---

## 现状问题

## 1. `runtime/editor/features/*` 这个目录名是错的

当前目录：

- `packages/whiteboard-editor/src/runtime/editor/features/createInteractionFeatures.ts`
- `packages/whiteboard-editor/src/runtime/editor/features/draw.ts`
- `packages/whiteboard-editor/src/runtime/editor/features/edge.ts`
- `packages/whiteboard-editor/src/runtime/editor/features/insert.ts`
- `packages/whiteboard-editor/src/runtime/editor/features/mindmap.ts`
- `packages/whiteboard-editor/src/runtime/editor/features/node.ts`
- `packages/whiteboard-editor/src/runtime/editor/features/selection.ts`
- `packages/whiteboard-editor/src/runtime/editor/features/viewport.ts`

这些文件并不是真正的 feature。

真正的 feature 实现已经在：

- `packages/whiteboard-editor/src/features/*`

这里这一层本质上做的是：

- 从 editor runtime 拿依赖
- 调用 feature factory
- 把 interaction / passive / feedback / clear 聚合起来

也就是说，它们不是 feature，而是 **feature 装配器**。

目录叫 `features`，实际上却是 assembler，这会制造两个问题：

1. 仓内出现两层 `features`，语义打架
2. 读代码时很难第一时间判断“这里是在写行为，还是在写装配”

长期最优：

- `runtime/editor/features/*` 整层应该删掉
- 收敛成一个 editor 装配文件，例如：
  - `runtime/editor/assembleInteractions.ts`

如果未来装配逻辑真的变复杂，再按装配维度拆文件。
但在当前复杂度下，不值得单独保留一整层伪 feature 目录。

---

## 2. `selection / edit / frame` 是同类模块，却没有统一结构

当前文件：

- `packages/whiteboard-editor/src/runtime/selection/store.ts`
- `packages/whiteboard-editor/src/runtime/selection/index.ts`
- `packages/whiteboard-editor/src/runtime/edit.ts`
- `packages/whiteboard-editor/src/runtime/frame.ts`

这三者本质上是同一类东西：

- editor kernel 自己的本地状态模块

但现在的组织方式完全不一致：

- `selection` 是目录
- `edit` 是单文件
- `frame` 是单文件
- `selection` 里面主文件叫 `store.ts`
- `edit` / `frame` 直接用领域名

这不是小问题，而是会持续误导读者：

- `selection/store.ts` 看起来像一个底层通用 store
- 但它实际拥有的是 selection 领域逻辑
- `edit.ts` / `frame.ts` 却又像是完整领域模块

长期最优：

- 这三者必须放到同一目录
- 用同一命名规则
- 让人一眼看出它们同属 editor-local state

推荐最终位置：

- `packages/whiteboard-editor/src/runtime/state/selection.ts`
- `packages/whiteboard-editor/src/runtime/state/edit.ts`
- `packages/whiteboard-editor/src/runtime/state/frame.ts`

---

## 3. internal 也叫 `commands`，和 public `commands` 语义冲突

当前问题最明显的是：

- `runtime/selection/store.ts` 里有 `commands`
- `runtime/edit.ts` 里有 `commands`
- `runtime/frame.ts` 里有 `commands`
- `runtime/commands/*` 里也有 `commands`

但这两类 `commands` 不是一回事：

- 前者是 kernel-local mutator
- 后者是 editor public API builder

现在会出现这种阅读感受：

- `selection.commands.clear()`
- `editor.commands.selection.clear()`

字面几乎一样，层次完全不同。

这说明命名没有把边界表达出来。

长期最优规则必须非常死：

- **只有 public editor API 才叫 `commands`**
- internal 本地写入口一律不叫 `commands`

internal 推荐命名：

- `set`
- `mutate`
- `actions`

以 selection 为例，长期最优不是：

```ts
type SelectionState = {
  source: ValueStore<SelectionTarget>
  commands: {
    replace: ...
    add: ...
    remove: ...
    toggle: ...
    clear: ...
  }
}
```

而应该是：

```ts
type SelectionState = {
  source: ValueStore<SelectionTarget>
  mutate: {
    replace: ...
    add: ...
    remove: ...
    toggle: ...
    clear: ...
  }
}
```

或者更进一步：

```ts
type SelectionState = {
  source: ValueStore<SelectionTarget>
  set: {
    replace: ...
    add: ...
    remove: ...
    toggle: ...
    clear: ...
  }
}
```

关键不是具体选哪个词，而是：

- internal 不能再和 public 复用 `commands`

---

## 4. `featureContext` 的问题不是“有中轴”，而是“中轴被做成了资产清单”

当前文件：

- `packages/whiteboard-editor/src/types/runtime/editor/featureContext.ts`

它现在把这些东西都放到一个大对象里：

- `commands`
- `read`
- `state`
- `config`
- `viewport`
- `interaction`
- `registry`
- `inputPolicy`
- `feedback`
- `transient`
- `spatial`

这类“大而全 context”有两个直接问题：

1. feature 面对的不是稳定能力协议，而是一份 runtime 内部资产总表
2. editor 装配层很容易长出一层专门搬运 context 的中间 adapter

这正是 `runtime/editor/features/*` 出现的深层原因之一。

但长期最优不是把它彻底拆成“每个 feature 自己拿一串窄依赖”。

那样会把装配打散到每个 feature factory 上，形成另一种噪音。
对于 editor 这种交互系统，长期更优的是：

- 保留一个单一中轴
- 但把它从资产清单改造成能力协议

也就是说：

- feature 仍然统一接受一个对象
- 这个对象不再是现在这种“系统里有什么就全摊开”
- 而是少数稳定 namespace 组成的 feature-facing runtime

推荐最终形态：

```ts
type FeatureRuntime = {
  query: EditorFeatureQuery
  command: EditorFeatureCommand
  viewport: EditorFeatureViewport
  output: EditorFeatureOutput
}
```

这四个 namespace 的边界应当是：

- `query`
  - 负责所有读能力
  - 包括文档、index、selection、frame、tool、投影后的 read 结果
- `command`
  - 负责所有持久化写入和 editor-level 行为命令
- `viewport`
  - 负责坐标转换、指针点位换算、视口控制
- `output`
  - 负责交互过程中的临时输出
  - 包括 node transient、edge transient、marquee、edge guide、mindmap drag、snap guides

这里最重要的不是具体字段名，而是原则：

- feature 看到的是一条稳定中轴
- 不是 runtime 内部对象的平铺转发

因此，当前 `featureContext` 里这些字段不应再直接暴露给 feature：

- `state`
- `config`
- `registry`
- `inputPolicy`
- `interaction`
- `feedback`
- `transient`
- `spatial`

不是说这些能力不再存在，而是它们应该被收编进上面那几个稳定 namespace。

例如：

- `feedback + transient + spatial`
  - 收敛进 `output`
- `read + 一部分 registry/config 派生能力`
  - 收敛进 `query`
- `commands`
  - 收敛进 `command`
- `viewport`
  - 继续作为独立 namespace 保留

最终模型不是：

- 大而全 context
- 或者散开的窄依赖列表

而是：

- 单一 `FeatureRuntime` 中轴
- 少数稳定 namespace
- 内部实现细节不直接泄漏给 feature

推荐在 `runtime/editor/featureRuntime.ts` 中创建这条中轴。
然后：

- `createEditor.ts` 负责创建 kernel / read / commands / output
- `featureRuntime.ts` 负责把这些内部资产组装成 feature-facing runtime
- `assembleInteractions.ts` 只负责把各 feature 注册结果汇总

这样可以同时满足两件事：

- feature 不会因为窄依赖而变散
- runtime 内部又不会继续因为大 context 而泄漏实现细节

---

## 5. `types/internal/*` 有过多中转类型

当前文件：

- `packages/whiteboard-editor/src/types/internal/editor.ts`
- `packages/whiteboard-editor/src/types/internal/selection.ts`

这里面既有 editor kernel 的内部合同，也有对外部模块的中转引用。

这会带来两个问题：

1. 类型归属不清楚
2. 读类型定义时要在实现和 `types/internal/*` 之间来回跳

长期最优：

- public type 放 `types/*`
- internal type 尽量跟实现文件同居
- 只有少数跨多个 runtime 模块共享、且明确属于 runtime 合同的类型，才值得单独抽出

换句话说：

- `SelectionState` 类型应跟 `runtime/state/selection.ts` 走
- `EditorKernel` 类型应跟 `runtime/editor/kernel.ts` 走，或放到非常接近它的 runtime contract 文件
- `FeatureRuntime` 类型应跟 `runtime/editor/featureRuntime.ts` 走
- 不要再用 `types/internal/*` 当统一垃圾桶

---

## 6. 单文件和目录的判定标准不统一

当前可以看到三种混合状态：

- 领域模块直接是单文件
- 领域模块是目录，但只有 `index.ts + store.ts`
- 领域模块先是目录，里面再只有一个主要实现文件

这会形成大量低价值跳转。

长期最优需要定死规则：

1. 如果一个领域只有一个主实现文件，就用单文件
2. 只有在同级存在多个并列子模块时，才开目录
3. 不允许“目录里只有 `index.ts + 一个实现文件`”这种半展开状态

例如：

- `runtime/state/edit.ts` 合理
- `runtime/state/frame.ts` 合理
- `runtime/state/selection.ts` 合理
- `runtime/input/pointer/*` 合理，因为里面确实有多个并列子模块
- `runtime/selection/index.ts + store.ts` 不合理

---

## 最终分层方案

## 顶层原则

`packages/whiteboard-editor/src` 最终只保留三类主目录：

- `features/`
- `runtime/`
- `types/`

以及少量稳定的 root entry / 领域子入口。

它们的职责必须非常清楚：

- `features/`：行为实现
- `runtime/`：editor 基础设施、状态、装配
- `types/`：public contract

---

## 最终目录结构

推荐最终结构如下：

```txt
packages/whiteboard-editor/src/
  features/
    draw/
      interaction.ts
      preferences.ts
    edge/
      connect.ts
      edit.ts
      hover.ts
    insert/
      interaction.ts
    mindmap/
      drag.ts
    node/
      drag.ts
      transform.ts
    selection/
      marquee.ts
      press.ts
    viewport/
      interaction.ts

  runtime/
    editor/
      createEditor.ts
      kernel.ts
      featureRuntime.ts
      assembleInteractions.ts
      lifecycle.ts
    state/
      edit.ts
      frame.ts
      selection.ts
    commands/
      index.ts
      draw.ts
      frame.ts
      history.ts
      insert.ts
      mindmap.ts
      selection.ts
      tool.ts
      node/
        appearance.ts
        document.ts
        index.ts
        lock.ts
        text.ts
    input/
      domTarget.ts
      passive.ts
      router.ts
      pointer/
        gate.ts
        index.ts
        snapshot.ts
    interaction/
      autoPan.ts
      coordinator.ts
      registry.ts
      snap.ts
      types.ts
    read/
      bounds.ts
      edge.ts
      frame.ts
      index.ts
      node.ts
      selection.ts
      tool.ts
    feedback/
      edgeGuide.ts
      marquee.ts
      mindmapDrag.ts
    transient/
      edge.ts
      node.ts
    viewport.ts
    clipboard.ts

  types/
    editor.ts
    selection.ts
    tool.ts
    draw.ts
    insert.ts
    pick.ts
    node/
      index.ts
      registry.ts
    mindmap/
      index.ts
```

---

## 各目录的职责边界

## `features/`

这里只放 feature 的行为实现。

允许存在的内容：

- interaction registration
- feature 内部局部算法
- 与该 feature 强绑定的 helper
- feature 自己持有的局部状态工厂

不应该放的内容：

- editor 装配器
- editor kernel 本地 state
- public command builder
- 大一统 context 类型

也就是说：

- `features/node/drag.ts` 合理
- `features/selection/press.ts` 合理
- `features/edge/hover.ts` 合理
- `features/createNodeFeature.ts` 这种 editor adapter 不应放在这里

---

## `runtime/editor/`

这里只放 editor 装配和生命周期。

推荐职责：

- `createEditor.ts`
  - 创建 editor 整体对象
- `kernel.ts`
  - 创建 editor kernel 与 runtime primitives
- `featureRuntime.ts`
  - 创建 feature-facing 的单一中轴
  - 把内部资产收敛成稳定 namespace，例如 `query / command / viewport / output`
- `assembleInteractions.ts`
  - 把各 feature interaction / passive / feedback 聚合起来
- `lifecycle.ts`
  - reset / dispose / commit-finalize 等生命周期逻辑

这里最重要的一条：

- **装配器不叫 feature**

这里第二重要的一条：

- **feature 只面对单一 runtime 中轴，不直接面对 runtime 内部资产清单**

所以：

- `runtime/editor/features/*` 应该删除
- 这层的职责就是 assembly，不要伪装成领域模块

---

## `runtime/state/`

这里只放 editor kernel 的本地状态模块。

当前最明显的三个：

- selection
- edit
- frame

它们必须对齐成同一种结构。

推荐统一形态：

```ts
type XxxState = {
  source: ...
  store?: ...
  mutate: {
    ...
  }
}
```

说明：

- `source` 表示底层可写 store
- `store` 表示对外暴露的 read store 或 derived store
- `mutate` 表示 kernel-local 写入口

如果某个状态模块没有 `store`，那就只保留：

```ts
type XxxState = {
  source: ...
  mutate: {
    ...
  }
}
```

关键点：

- internal 不再叫 `commands`
- `selection / edit / frame` 同目录、同形态、同命名

---

## `runtime/commands/`

这里只放 **editor public commands 的构建逻辑**。

这层可以继续保留，因为它表达的是稳定的 public API 形状。

但前提是必须和 `runtime/state/*` 明确区分：

- `runtime/state/*` 持有 internal mutate
- `runtime/commands/*` 负责产出 `editor.commands.*`

也就是说：

- `createSelectionCommands(...)` 合理
- `selection.commands.replace(...)` 这种 internal 命名不再允许继续存在

---

## `runtime/input/`

这里只放输入协议和路由基础设施。

允许内容：

- pointer snapshot
- pointer gate
- event router
- DOM target normalize
- passive processor runtime

不应该放的内容：

- shortcut binding 纯函数
- feature 级手势逻辑
- editor 领域外的宿主键盘策略

`input` 应保持为真正的输入层，而不是“凡是跟事件有关都塞进来”。

---

## `runtime/interaction/`

这里只放 interaction runtime 原语。

例如：

- registration / coordinator / registry
- auto pan
- snap runtime

这一层的职责是：

- 承载交互会话机制
- 不承载具体 feature 行为

如果某个文件已经开始写：

- node transform
- draw stroke
- edge reconnect

那它就不该留在 `runtime/interaction/`，而应回到 `features/`。

---

## `runtime/read/`

这里只放 editor 的 read 组合层。

它的职责是：

- 把 engine read
- editor-local state
- transient / feedback 派生结果

组合成 editor 视角下稳定的 `read` API。

它不应该承担：

- command
- interaction
- context
- UI 层临时拼装

---

## `runtime/feedback/`

这里只放反馈类 runtime：

- marquee
- edge guide
- mindmap drag

它们的共同特征是：

- 都是 editor 运行时反馈状态
- 都不属于最终文档数据
- 都不是 node/edge 的 transient patch 本体

所以它们收在一起是合理的。

---

## `runtime/transient/`

这里只放会影响 read 投影结果的临时状态：

- node transient
- edge transient

这层和 `feedback` 的边界要明确：

- `transient` 影响实体投影与读结果
- `feedback` 表达临时 UI 反馈

不要把两者混成一个“杂项 UI state”。

---

## 文件命名原则

## 1. 主文件优先用领域名，不用机制名

应该优先：

- `selection.ts`
- `frame.ts`
- `edit.ts`

不要优先：

- `store.ts`
- `model.ts`
- `context.ts`

除非这个文件真的表达一个可复用机制，而不是领域模块。

例如：

- `runtime/state/selection.ts` 合理
- `runtime/selection/store.ts` 不合理

---

## 2. 装配文件用 assembly 语义，不用 feature 语义

应该：

- `assembleInteractions.ts`

不应该：

- `runtime/editor/features/createInteractionFeatures.ts`

因为这里的职责不是 feature，而是 assembly。

---

## 3. 只有 public API 才叫 `commands`

应该：

- `runtime/commands/selection.ts`
- `editor.commands.selection.clear()`

不应该：

- `runtime/state/selection.ts` 内部再有 `commands`

internal 统一改成：

- `mutate`
- `set`
- `actions`

---

## 4. 目录只为并列子模块服务

应该：

- `features/node/drag.ts`
- `features/node/transform.ts`

因为这里确实有多个并列子模块。

不应该：

- `runtime/selection/index.ts + store.ts`

因为这里只是人为增加一级目录，没有换来结构价值。

---

## 类型放置原则

## public type

放在：

- `packages/whiteboard-editor/src/types/*`

这些类型必须满足：

- 属于 editor public contract
- 允许从 package 对外暴露

---

## internal type

优先跟实现文件同居。

例如：

- `SelectionState` 跟 `runtime/state/selection.ts`
- `FrameState` 跟 `runtime/state/frame.ts`
- `EditorKernel` 跟 `runtime/editor/kernel.ts` 或相邻 runtime contract 文件
- `FeatureRuntime` 跟 `runtime/editor/featureRuntime.ts`

只有在满足以下条件时，才值得抽单独 runtime type 文件：

- 多个 runtime 模块共享
- 不属于某一个实现文件的私有细节
- 抽出来确实减少跳转，而不是增加跳转

这意味着：

- `types/internal/editor.ts`
- `types/internal/selection.ts`

长期都应该被显著瘦身，甚至最终删除。

---

## root entry 的配合原则

root entry 不应该把 runtime 内部目录结构泄漏出去。

例如：

- root 可以导出 `createEditor`
- root 可以导出 public types

但不应该因为内部有：

- `runtime/state`
- `runtime/editor`
- `runtime/transient`

就把这些概念一路转成 public surface。

也就是说，runtime 结构的目标是：

- **服务实现组织**

而不是：

- **直接映射为 package public namespace**

---

## 对当前仓内文件的直接结论

以下判断是明确的：

### 应删除的目录形态

- `packages/whiteboard-editor/src/runtime/editor/features/*`
- `packages/whiteboard-editor/src/runtime/selection/index.ts`

### 应迁移的领域状态

- `packages/whiteboard-editor/src/runtime/selection/store.ts`
  - -> `packages/whiteboard-editor/src/runtime/state/selection.ts`
- `packages/whiteboard-editor/src/runtime/edit.ts`
  - -> `packages/whiteboard-editor/src/runtime/state/edit.ts`
- `packages/whiteboard-editor/src/runtime/frame.ts`
  - -> `packages/whiteboard-editor/src/runtime/state/frame.ts`

### 应统一改名的 internal 写口

- `commands`
  - -> `mutate` / `set` / `actions`

### 应收敛的装配层

- `createInteractionFeatures`
  - -> `assembleInteractions`

### 应重写的 feature 中轴

- `packages/whiteboard-editor/src/types/runtime/editor/featureContext.ts`
  - 不再继续作为“大而全 context”
  - 改成 `runtime/editor/featureRuntime.ts` 中就地定义或紧邻定义的 `FeatureRuntime`
  - 只暴露稳定 namespace，例如 `query / command / viewport / output`

### 应逐步去掉的中转类型层

- `packages/whiteboard-editor/src/types/internal/editor.ts`
- `packages/whiteboard-editor/src/types/internal/selection.ts`

---

## 最终判断

现在这套结构确实不太对。

问题不是单个文件命名怪，而是：

- feature、assembler、kernel-local state、public commands 混排
- internal 与 public 共用 `commands` 这套命名
- 同类模块没有统一目录与命名标准
- `featureContext` 不是缺少中轴，而是中轴被做成了内部资产清单
- `types/internal/*` 制造了低价值类型跳转

长期最优的最终方案就是：

1. `features/` 只保留 feature 行为实现
2. `runtime/editor/` 只保留 editor 装配与生命周期
3. `runtime/state/` 收纳所有 editor-local state
4. `runtime/commands/` 只保留 public command builder
5. feature 统一接受单一 `FeatureRuntime` 中轴，而不是大 context 或散开的窄依赖
6. internal 不再使用 `commands` 命名
7. internal type 尽量回到实现文件，去掉集中式 `types/internal/*`
8. 单文件与目录的判定规则统一，只在确实存在并列子模块时开目录

这套方案的价值不是“更整齐”，而是：

- 读代码时不再反复切换语义层级
- 新功能能自然落到明确目录
- internal / public 边界更稳定
- 装配链更短，命名更直，跳转更少

这才是 `whiteboard-editor` runtime 结构的长期最优形态。
