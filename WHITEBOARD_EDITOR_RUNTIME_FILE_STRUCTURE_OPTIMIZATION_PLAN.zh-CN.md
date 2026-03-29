# Whiteboard Editor Runtime 文件结构优化方案

## 目标

这份文档只讨论 `packages/whiteboard-editor/src/runtime`。

目标不是做表层重命名，而是把 runtime 调整成长期可维护的结构：

- 目录只在真的存在稳定子域时保留，去掉纯壳目录。
- 文件名直接表达职责，避免 `index.ts` / `runtime.ts` / `types.ts` / `logic.ts` / `state.ts` 这种低信息量命名泛滥。
- store、predicate、resolver、adapter、router、controller 各归其位，不再混在一个文件里。
- internal type 依赖回到 canonical type module，不再通过实现文件的 `ReturnType<typeof createXxx>` 和 type-forwarder 串起来。
- runtime 保持“输入 -> 解析 -> 路由 -> interaction/session -> 输出”的清晰链路，不把 feature 细节倒灌回输入层。

## 调研结论摘要

截至当前，`runtime` 目录共有：

- 72 个文件
- 14 个一级子目录
- 约 8682 行代码

明显信号有两类：

- 目录过轻：`edit`、`pick`、`tool` 只是单文件目录；`frame` 只有 `index.ts + state.ts`；`viewport` 只有 `index.ts + createViewport.ts + logic.ts`
- 文件过重：`context/selection.ts` 670 行，`selection/press.ts` 456 行，`commands/node.ts` 450 行，`editor/features.ts` 376 行，`input/pointer.ts` 373 行，`selection/state.ts` 303 行

这说明 runtime 当前同时存在两种噪音：

- 过度拆目录，形成大量“跳一层才能到真正实现”的壳
- 过度合文件，把多个职责塞进一个大文件

所以最优方向不是“统一全部扁平化”，而是：

- 去掉没有子域价值的目录壳
- 保留真实子域目录
- 把混在一起的大文件按语义拆开

## 核心判断

### 1. 哪些目录应该直接去掉

这些目录现在没有保留价值，应该直接降成顶层单文件：

- `packages/whiteboard-editor/src/runtime/edit/index.ts` -> `packages/whiteboard-editor/src/runtime/edit.ts`
- `packages/whiteboard-editor/src/runtime/pick/index.ts` -> `packages/whiteboard-editor/src/runtime/pick.ts`
- `packages/whiteboard-editor/src/runtime/tool/index.ts` -> `packages/whiteboard-editor/src/runtime/tool.ts`

原因很简单：

- 每个目录只有一个实现文件
- 没有真实的子模块边界
- 目录名和文件名都在重复表达同一件事
- 增加 import 跳转成本，没有带来结构收益

### 2. `frame` 目录不该保留，但也不该机械改成单文件

`packages/whiteboard-editor/src/runtime/frame` 当前只有：

- `index.ts`
- `state.ts`

但 `state.ts` 里面实际上混了两类职责：

- frame store / commands
- frame membership predicate

具体就是：

- `createState`
- `hasNode`
- `filterNodeIds`
- `hasEdge`

这里最关键的判断是：

- `hasEdge` 不该放到 editor
- `hasNode` / `hasEdge` / `filterNodeIds` 也不该继续放在 `state.ts`

它们的本质是“frame scope membership helper”，不是：

- editor composition root concern
- state/store concern

最优落位应该是：

- `packages/whiteboard-editor/src/runtime/frame.ts`
  - 只负责 `createFrameState`、`FrameCommands`、frame source/store
- `packages/whiteboard-editor/src/runtime/frameScope.ts`
  - 只负责 `FrameScope`
  - `isNodeInFrameScope`
  - `filterNodeIdsInFrameScope`
  - `isEdgeInFrameScope`

也就是说，`frame` 目录应该去掉，但应该变成两个顶层文件，而不是继续把所有内容揉成一个 `frame.ts`。

### 3. `viewport` 目录也偏轻，应该收平

当前：

- `packages/whiteboard-editor/src/runtime/viewport/index.ts`
- `packages/whiteboard-editor/src/runtime/viewport/createViewport.ts`
- `packages/whiteboard-editor/src/runtime/viewport/logic.ts`

这里的问题不是逻辑错，而是命名太抽象：

- `createViewport.ts` 表达的是主模块
- `logic.ts` 完全不说明里面是 math、limits、normalize、coordinate transform
- `index.ts` 只是为了补 export

更优结构是：

- `packages/whiteboard-editor/src/runtime/viewport.ts`
  - `createViewport`
  - `ViewportRuntime`
  - `ViewportRead`
  - `ViewportCommands`
- `packages/whiteboard-editor/src/runtime/viewportMath.ts`
  - `normalizeViewport`
  - `normalizeViewportLimits`
  - `clientToScreenPoint`
  - `screenToWorldPoint`
  - `worldToScreenPoint`
  - `applyWheelInput`
  - `fitViewportToRect`

这里不建议保留 `logic.ts` 这种命名。

## 对 `hasEdge` 的明确结论

`packages/whiteboard-editor/src/runtime/frame/state.ts` 里的 `hasEdge` 不该放到 editor。

原因不是“editor 不该有工具函数”这么简单，而是 ownership 不对。

`hasEdge(frame, edge)` 回答的问题是：

- 某条 edge 是否属于当前 frame scope

它是 frame domain 的共享谓词，已经被多个子系统共同依赖：

- selection command
- finalize
- read/frame
- input/pointer
- context / target 决策链

所以它最优的位置是：

- frame scope helper

而不是：

- editor root helper
- editor internals
- `state.ts`

结论可以直接定死：

- `hasEdge` 留在 frame 语义域
- 但从 `state.ts` 迁出
- 命名改成 `isEdgeInFrameScope`

## runtime 当前的系统性问题

### 1. 低信息量命名太多

现在 runtime 里有大量文件名不能表达真实职责：

- `index.ts`
- `types.ts`
- `runtime.ts`
- `logic.ts`
- `state.ts`

这些命名只有在非常局部、并且语义完全稳定时才成立；现在的问题是很多文件都不是这种情况。

最典型的例子：

- `input/runtime.ts` 实际上是输入路由器，不是 generic runtime
- `input/interactionStart.ts` 实际上是 driver registry / start driver factory
- `context/selection.ts` 实际上是 selection menu read + action binding + view assembly
- `context/view.ts` 实际上是 context menu view resolver
- `finalize.ts` 实际上是 editor lifecycle finalizer
- `pick/index.ts` 导出的核心类型名叫 `Pick`，直接和 TypeScript 内建 `Pick<T, K>` 撞名

建议统一规则：

- `runtime.ts` 只给真正的长生命周期协调器使用
- `state.ts` 只给 source store + commands 使用
- `logic.ts` 禁用，必须改成语义名
- `types.ts` 只允许存在于“本目录自己拥有的类型文件”，不能做跨目录 re-export hub
- 不再导出 `Pick`、`State`、`Commands`、`Store` 这类无领域前缀的公共类型名

### 2. type-forwarder / barrel 过多

当前最典型的壳文件有：

- `packages/whiteboard-editor/src/runtime/commands/runtime.ts`
- `packages/whiteboard-editor/src/runtime/context/types.ts`
- `packages/whiteboard-editor/src/runtime/editor/types.ts`

其中：

- `commands/runtime.ts` 只是把 `EditorCommandHost`、`EditorClipboardRuntime` 从 `types/internal/editor` 再转一层
- `context/types.ts` 只是从 `types/public/context` 转一层
- `editor/types.ts` 同时聚合 public 和 internal types，方便是方便，但把 type ownership 模糊掉了

这些文件的问题不在“多一层 import”本身，而在：

- 看不出真正类型归属
- 很容易继续长成新的依赖汇合点
- 运行时实现和类型边界互相缠住

建议：

- 直接删除 `commands/runtime.ts`
- runtime 内部直接从 canonical type module import
- `context/types.ts` 删除
- `editor/types.ts` 不再作为 runtime 内部总入口
- runtime 内部禁止新增类似转发壳

### 3. `createState` 命名导致大量 alias import

当前 runtime 内多处都导出 `createState`：

- edit
- frame
- selection

结果使用方必须到处写：

- `createState as createFrameState`
- `createState as createEditState`
- `createState as createSelectionState`

这不是 import 风格问题，而是源头命名太弱。

建议一步到位改成语义名：

- `createEditState`
- `createFrameState`
- `createSelectionState`

对应类型也同步收敛成：

- `EditState`
- `EditCommands`
- `EditStore`
- `FrameState`
- `FrameCommands`
- `SelectionState`

这样可以直接去掉一批 alias import，也会让 `kernel.ts`、`commands/index.ts`、`finalize.ts` 的类型关系更清晰。

### 4. 类型契约过度依赖实现文件的 `ReturnType<typeof createXxx>`

当前有不少地方把 factory 返回值直接拿来当跨模块契约，例如：

- `commands/index.ts`
- `commands/frame.ts`
- `commands/selection.ts`
- `finalize.ts`
- `types/internal/editor.ts`

这会导致：

- 类型依赖绑定到实现文件
- 一个文件只是改 factory 结构，也可能扩散到很多地方
- 让 type ownership 继续向 runtime 实现层漂移

建议：

- runtime 侧只导出显式命名的 state / runtime contract type
- 其他模块依赖这些显式类型
- 不再把 `ReturnType<typeof createXxx>` 作为长期契约

### 5. `input` 和 `context` 的边界仍然混

当前 `packages/whiteboard-editor/src/runtime/input/target.ts` 同时做了两件完全不同的事情：

- DOM event target 判定
  - editable target
  - input ignored target
  - selection ignored target
  - context-menu ignored target
- context target model
  - `ContextTarget`
  - `ContextResolved`
  - `readContextTarget`
  - `resolveContextTarget`

这是明显的边界错位。

更合理的拆法是：

- `packages/whiteboard-editor/src/runtime/input/domTarget.ts`
  - editable / ignored / keyboard ignore 这些 DOM 判定
- `packages/whiteboard-editor/src/runtime/context/target.ts`
  - `ContextTarget`
  - `ContextResolved`
  - `readContextTarget`
  - `resolveContextTarget`
- `packages/whiteboard-editor/src/runtime/context/open.ts`
  - `readContextOpen`

对应地：

- `input/pointer.ts` 只做 pointer normalize、frame gate、wheel normalize
- `context/runtime.ts` 不再依赖 input 层导出的 context helper

这一步很重要，因为它会把“输入设备解析”和“上下文菜单语义”真正拆开。

### 6. `input/runtime.ts` 和 `interactionStart.ts` 的命名不准

这两个文件其实已经在朝对的方向走，但命名落后于模型：

- `input/runtime.ts` 更像 `router.ts`
- `input/interactionStart.ts` 更像 `drivers.ts` 或 `startDrivers.ts`

原因是它们做的事分别是：

- 输入事件入口路由
- feature start driver 的注册与装配

不是 generic runtime。

建议直接改成：

- `packages/whiteboard-editor/src/runtime/input/router.ts`
- `packages/whiteboard-editor/src/runtime/input/drivers.ts`

### 7. 有几个大文件是“多职责热点”

这些不是简单改名能解决的：

- `packages/whiteboard-editor/src/runtime/context/selection.ts`
  - 同时做 selection menu action binding、filter/order/layout 等 operations、view assembly、read store 构建
- `packages/whiteboard-editor/src/runtime/selection/press.ts`
  - 同时做 press target 解析、mode 决策、group 规则、tap/drag plan 生成
- `packages/whiteboard-editor/src/runtime/commands/node.ts`
  - 同时做 document update、appearance、text preview/commit、lock 逻辑
- `packages/whiteboard-editor/src/runtime/input/pointer.ts`
  - 同时做 pointer normalize、frame gate、wheel normalize、context open 相关逻辑
- `packages/whiteboard-editor/src/runtime/editor/features.ts`
  - 同时做 feature runtime create、driver create、capsule assembly、projection/lifecycle wiring

建议拆法：

- `context/selection.ts`
  - `selectionActions.ts`
  - `selectionView.ts`
  - `selectionRead.ts`
- `selection/press.ts`
  - `pressTarget.ts`
  - `pressPlan.ts`
  - `pressRules.ts`
- `commands/node.ts`
  - `nodeDocument.ts`
  - `nodeAppearance.ts`
  - `nodeText.ts`
  - `nodeLock.ts`
  - 保留一个 `node.ts` 作为 assemble 文件
- `input/pointer.ts`
  - `pointer.ts`
  - `frameGate.ts`
  - context 相关全部迁到 `context/*`
- `editor/features.ts`
  - 至少拆成 `createFeatureRuntimes.ts` 和 `createFeatureCapsules.ts`

### 8. `finalize.ts` 的位置不对

`packages/whiteboard-editor/src/runtime/finalize.ts` 当前只被 `packages/whiteboard-editor/src/runtime/editor/lifecycle.ts` 使用。

这说明它不是 runtime 根层公共模块，而是 editor lifecycle 的一部分。

建议移动到：

- `packages/whiteboard-editor/src/runtime/editor/finalize.ts`

或者更明确地命名为：

- `packages/whiteboard-editor/src/runtime/editor/finalizer.ts`

### 9. `host` 和 `platform` 术语没有对齐

当前同时存在：

- `packages/whiteboard-editor/src/runtime/host/*`
- `packages/whiteboard-editor/src/runtime/editor/platform.ts`

但这两层表达的其实都是平台适配边界。

更优做法是统一术语：

- 要么把 `host` 改成 `platform`
- 要么把 `editor/platform.ts` 改成 `composePlatform.ts`

如果追求长期一致性，我更建议：

- `runtime/host` 改成 `runtime/platform`
- `runtime/editor/platform.ts` 改成 `runtime/editor/composePlatform.ts`

这样 `EditorPlatformBridge`、`EditorPlatform`、browser adapter 的命名就统一了。

### 10. 存在未使用死文件

`packages/whiteboard-editor/src/runtime/utils/recordPatch.ts` 当前没有使用方。

这种文件不应该继续保留在 runtime 公共 util 下：

- 如果确实不再需要，直接删除
- 如果未来某个模块需要 patch merge helper，就把它 colocate 到对应模块附近

runtime 的 `utils` 应该只保留明确被多处复用、且语义稳定的工具。

### 11. 还有少量“为拆而拆”的超薄文件

例如：

- `packages/whiteboard-editor/src/runtime/interaction/driver.ts`

它当前只承载一个 `InteractionDriver` 类型，文件太薄，而且语义上本来就属于 interaction contract。

更合理的做法是：

- 直接并入 `packages/whiteboard-editor/src/runtime/interaction/types.ts`

这里要强调的不是“所有小文件都要删”，而是：

- 只有当小文件代表一个稳定边界时才值得单独存在
- 单个类型、单个转发、单个薄包装通常不值得单独占一个文件

## 哪些目录应该保留

这些目录目前有真实子域价值，不应该为了“看起来更平”就硬拆掉：

- `commands`
- `context`
- `editor`
- `input`
- `interaction`
- `read`
- `selection`
- `utils`

这些目录保留的理由不是“文件数量够多”，而是：

- 里面已经形成了稳定的子语义
- 目录名本身就是一个真实模块
- 后续继续收敛时仍然能在目录内做局部重构

其中：

- `selection` 虽然只有 3 个文件，但确实同时承载 selection store 和 selection press plan
- `input` 也应该保留，因为它是输入解析层，不该被打散到各 feature
- `context` 应该保留，因为 context menu 不是单一 helper，而是一个完整子域

## 建议的目标结构

下面是我认为更接近长期最优的 runtime 目录结构。

```text
packages/whiteboard-editor/src/runtime
├── commands
│   ├── clipboard.ts
│   ├── draw.ts
│   ├── frame.ts
│   ├── history.ts
│   ├── index.ts
│   ├── insert.ts
│   ├── mindmap.ts
│   ├── node.ts
│   ├── nodeAppearance.ts
│   ├── nodeDocument.ts
│   ├── nodeLock.ts
│   ├── nodeText.ts
│   ├── selection.ts
│   └── tool.ts
├── context
│   ├── index.ts
│   ├── menuRuntime.ts
│   ├── menuView.ts
│   ├── open.ts
│   ├── selectionActions.ts
│   ├── selectionRead.ts
│   ├── selectionView.ts
│   ├── summary.ts
│   └── target.ts
├── editor
│   ├── composeCommands.ts
│   ├── composeInput.ts
│   ├── composeProjection.ts
│   ├── composeRead.ts
│   ├── createEditor.ts
│   ├── createFeatureCapsules.ts
│   ├── createFeatureRuntimes.ts
│   ├── finalize.ts
│   ├── index.ts
│   ├── kernel.ts
│   ├── lifecycle.ts
│   ├── composePlatform.ts
│   ├── projectionGraph.ts
│   └── public.ts
├── input
│   ├── domTarget.ts
│   ├── drivers.ts
│   ├── frameGate.ts
│   ├── keyboard.ts
│   ├── passive.ts
│   ├── pointer.ts
│   ├── pointerSnapshot.ts
│   └── router.ts
├── interaction
│   ├── autoPan.ts
│   ├── config.ts
│   ├── coordinator.ts
│   ├── index.ts
│   ├── press.ts
│   ├── registry.ts
│   ├── snap.ts
│   └── types.ts
├── platform
│   ├── clipboard.ts
│   ├── pointerContinuation.ts
│   └── selectionLock.ts
├── read
│   ├── bounds.ts
│   ├── context.ts
│   ├── edge.ts
│   ├── frame.ts
│   ├── index.ts
│   ├── node.ts
│   ├── pick.ts
│   ├── selection.ts
│   └── tool.ts
├── selection
│   ├── index.ts
│   ├── pressPlan.ts
│   ├── pressRules.ts
│   ├── pressTarget.ts
│   └── store.ts
├── utils
│   ├── equality.ts
│   └── rafTask.ts
├── edit.ts
├── frame.ts
├── frameScope.ts
├── pick.ts
├── tool.ts
├── viewport.ts
└── viewportMath.ts
```

这个结构背后的原则是：

- 单模块领域直接做顶层单文件
- 多模块领域保留目录
- 目录内的文件名必须表达职责
- 不再依赖目录 + `index.ts` 去兜底语义

## 一步到位的执行顺序

不考虑兼容层时，建议直接按下面顺序做：

1. 删除纯壳和死文件。
2. `edit` / `pick` / `tool` 收平为单文件。
3. `frame` 拆成 `frame.ts + frameScope.ts`。
4. `viewport` 收平成 `viewport.ts + viewportMath.ts`。
5. 删除 `commands/runtime.ts`、`context/types.ts`，停止内部依赖 `editor/types.ts`。
6. 把所有 `createState`、`State`、`Commands`、`Store` 改成领域化命名。
7. 拆 `input/target.ts`，把 context target 相关逻辑迁到 `context`。
8. `input/runtime.ts` 改成 `router.ts`，`input/interactionStart.ts` 改成 `drivers.ts`。
9. 移动 `finalize.ts` 到 `editor` 子域。
10. 拆 `context/selection.ts`、`selection/press.ts`、`commands/node.ts`、`input/pointer.ts`、`editor/features.ts`。
11. 统一 `host/platform` 术语。

## 最终结论

这次 runtime 优化的关键不在“把多少文件改成单文件”，而在于把 ownership 理顺。

最重要的几个决定是：

- `edit`、`pick`、`tool` 直接去目录壳
- `frame` 去目录壳，但拆成 `frame.ts + frameScope.ts`
- `hasEdge` 不放 editor，放 frame scope helper
- `viewport` 收平成 `viewport.ts + viewportMath.ts`
- 删除 type-forwarder 壳和未使用 util
- 拆开 `input` 和 `context` 的混合边界
- 对大文件按职责拆分，而不是继续依赖抽象命名硬撑

如果只允许先做最有收益的一批，我会优先做这 6 件事：

- `edit` / `pick` / `tool` 收平
- `frame` 重构
- `viewport` 重构
- 删 `commands/runtime.ts`
- 拆 `input/target.ts`
- 移动 `finalize.ts`

这 6 件事完成后，runtime 的结构噪音会立刻下降一个层级，后面的命名统一和大文件拆分也会自然很多。
