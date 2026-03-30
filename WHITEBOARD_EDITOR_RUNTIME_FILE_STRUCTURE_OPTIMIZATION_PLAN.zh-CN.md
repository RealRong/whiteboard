# Whiteboard Editor Runtime 最终结构优化方案

## 结论先行

这次不是做“runtime 目录整理”，而是做一次 ownership 对齐。

最终目标很明确：

- `@whiteboard/core` 负责纯领域模型、纯数学、纯文档协议、纯规则推导。
- `@whiteboard/editor` runtime 只负责状态、输入路由、session、平台适配、feature 组装。
- browser / DOM / Pointer / Clipboard API 适配留在 editor 的 platform 层，不进 core。

这意味着 runtime 里当前有一批代码不只是命名不佳，而是本来就放错层了。最典型的 4 块是：

- viewport 纯数学
- frame scope membership
- selection target / summary 纯模型
- clipboard packet 协议

这些都应该下沉到 `whiteboard-core`。

文档以下内容按“最终应该怎么改”来写，不保留兼容层，不讨论过渡态。

## 目标

最终结构要同时满足 5 个条件：

- runtime 目录只保留真正的运行时模块，不再混入纯规则和纯协议。
- `core` 不再只是 node/edge/geometry 的局部集合，而是 editor 领域规则的唯一底层归属。
- `editor/runtime` 的文件名直接表达职责，不再泛滥 `index.ts` / `runtime.ts` / `types.ts` / `logic.ts` / `state.ts`。
- 单文件目录壳去掉，大文件按职责拆开。
- 对外边界稳定，内部实现不再依赖 `ReturnType<typeof createXxx>` 作为长期契约。

## 最终 ownership 规则

### 应该放到 core 的

满足下面任一条件，就应该放到 `@whiteboard/core`：

- 输入是 plain data，输出是 plain data
- 不依赖 DOM / browser / window / document / event
- 不依赖 engine store / editor store / session 状态机
- 表达的是文档规则、几何规则、选择规则、frame 规则、序列化协议

### 应该留在 editor runtime 的

满足下面任一条件，就应该留在 `@whiteboard/editor` runtime：

- 需要 `PointerEvent` / `KeyboardEvent` / DOM target
- 需要 interaction session / capture / cancel / blur / auto-pan
- 需要 platform bridge 或 browser adapter
- 需要把 feature runtime 组装成 editor 的公共 API

### 应该留在 editor platform 的

满足下面任一条件，就应该归到 platform：

- `navigator.clipboard`
- `window.addEventListener`
- `document.style`
- `setPointerCapture` / `releasePointerCapture`

## 这次要把什么下沉到 whiteboard-core

### 1. viewport 纯数学全部下沉到 `@whiteboard/core/geometry`

当前 editor 里 [logic.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/viewport/logic.ts) 这批函数本质都是纯数学：

- `normalizeViewportLimits`
- `normalizeViewport`
- `clientToScreenPoint`
- `screenToWorldPoint`
- `worldToScreenPoint`
- `applyScreenPan`
- `fitViewportToRect`
- `applyWheelInput`

`@whiteboard/core` 已经有基础视口函数，位置在 [viewport.ts](/Users/realrong/whiteboard/packages/whiteboard-core/src/geometry/viewport.ts)。最终不应该 editor 自己再维护一套扩展版。

最终改法：

- 扩展 `packages/whiteboard-core/src/geometry/viewport.ts`
- `packages/whiteboard-core/src/geometry/index.ts` 统一导出这些能力
- `packages/whiteboard-editor/src/runtime/viewport.ts` 只保留 store/runtime 封装

editor 里不再保留 `viewport/logic.ts`。

### 2. frame scope 规则下沉到 `@whiteboard/core/document`

当前 [state.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/frame/state.ts) 混了两类东西：

- frame state store
- frame membership rule

其中真正该进 core 的是：

- `FrameScope`
- `hasNode`
- `filterNodeIds`
- `hasEdge`

这些不是 runtime state，而是文档 scope 规则。

最终改法：

- 新增 `packages/whiteboard-core/src/document/frameScope.ts`
- `packages/whiteboard-core/src/document/index.ts` 导出：
  - `FrameScope`
  - `ROOT_FRAME_SCOPE`
  - `isNodeInFrameScope`
  - `filterNodeIdsInFrameScope`
  - `isEdgeInFrameScope`
- editor runtime 的 `frame` 只保留：
  - `createFrameState`
  - `FrameState`
  - `FrameCommands`

明确结论：

- `hasEdge` 不放 editor
- `hasEdge` 也不留在 `state.ts`
- `hasEdge` 最终进入 core/document/frameScope

### 3. selection 纯模型下沉到 `@whiteboard/core/selection`

当前 editor 里这批能力已经纯到可以下沉：

- [selection/state.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/selection/state.ts) 里的 `SelectionInput`
- `SelectionTarget`
- `toSelectionTarget`
- `applySelectionTarget`

这层不依赖 DOM，也不依赖 runtime session。它本质是 editor 领域模型，不该藏在 `editor/types/internal`。

最终改法：

- 新增 `packages/whiteboard-core/src/selection/index.ts`
- `packages/whiteboard-core/package.json` 新增 `./selection` export
- 在 core/selection 中定义：
  - `SelectionInput`
  - `SelectionTarget`
  - `normalizeSelectionTarget`
  - `applySelectionTarget`

这里不建议继续塞到 `core/node`，因为它天然是 node + edge 的联合选择模型，不是纯 node 子域。

### 4. selection summary 推导也要下沉到 `@whiteboard/core/selection`

当前 [selection/state.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/selection/state.ts) 里的 `resolveSelectionSnapshot` 本质上也是纯推导逻辑，但还绑着 editor/engine 的读取方式。

最终不是把当前函数原样搬走，而是先把 contract 调整成纯输入，再下沉。

最终目标不是 `SelectionSnapshot`，而是更准确的命名：

- `SelectionSummary`
- `deriveSelectionSummary`

输入应该是纯数据和纯回调，例如：

- 已选 node 列表
- 已选 edge 列表
- `readBounds`
- `resolveNodeTransformCapability`
- `isNodeScalable`

最终改法：

- 新增 `packages/whiteboard-core/src/selection/summary.ts`
- editor runtime 的 `read/selection.ts` 只负责把 engine/read 的世界翻译成 core 需要的输入

### 5. clipboard packet 协议下沉到 `@whiteboard/core/document`

当前 [clipboard.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/host/clipboard.ts) 里混了三类东西：

- 文档切片协议
- runtime 内存态
- browser clipboard 适配

真正该进 core 的是协议部分：

- `ClipboardPacket`
- `createClipboardPacket`
- `serializeClipboardPacket`
- `parseClipboardPacket`

最终改法：

- 新增 `packages/whiteboard-core/src/document/clipboard.ts`
- `packages/whiteboard-core/src/document/index.ts` 导出这些协议能力

留在 editor platform 的只有：

- `ClipboardPort`
- `createBrowserClipboardPort`
- `writeClipboardPacketToEvent`
- `readClipboardPacketFromEvent`
- `createClipboardRuntime`

其中 `createClipboardRuntime.readPastePoint` 属于 editor 行为策略，不进 core。

### 6. equality helper 回到 core，不再在 runtime 自己维护一份

当前 editor runtime 有 [equality.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/runtime/utils/equality.ts)，而 core 也有 [equality.ts](/Users/realrong/whiteboard/packages/whiteboard-core/src/utils/equality.ts)。

这不是“合理分层”，而是底层模型没对齐。

最终改法：

- 扩展 core 的 `packages/whiteboard-core/src/utils/equality.ts`
- 覆盖 editor runtime 需要的几类比较：
  - ordered ref/id array compare
  - rect tuple compare
  - box tuple compare
- 删除 `packages/whiteboard-editor/src/runtime/utils/equality.ts`

## 不应该放到 core 的

这些东西即使写得很纯，也不应该进 core：

- `packages/whiteboard-editor/src/runtime/input/*`
  - 这层是输入解析和 editor 交互入口，不是文档规则
- `packages/whiteboard-editor/src/runtime/context/*`
  - 这是 editor UI 语义
- `packages/whiteboard-editor/src/runtime/pick/*`
  - 这是 editor 命中模型，不是文档模型
- `packages/whiteboard-editor/src/runtime/tool/*`
  - 这是 editor 产品语义
- `packages/whiteboard-editor/src/runtime/interaction/*`
  - 这是 session / coordinator / runtime 控制层
- browser 平台适配
  - pointer continuation
  - selection lock
  - clipboard port

一句话：

- core 管规则
- editor 管 runtime
- platform 管 browser

## whiteboard-core 最终目标结构

最终 `whiteboard-core` 要补这 3 个模块，扩这 2 个模块。

### 新增模块

```text
packages/whiteboard-core/src
├── document
│   ├── clipboard.ts
│   ├── frameScope.ts
│   ├── index.ts
│   └── slice.ts
├── selection
│   ├── index.ts
│   ├── summary.ts
│   └── target.ts
```

### 扩展模块

```text
packages/whiteboard-core/src
├── geometry
│   ├── index.ts
│   └── viewport.ts
└── utils
    ├── equality.ts
    └── index.ts
```

### package exports 最终应该补齐

最终 `packages/whiteboard-core/package.json` 增加：

- `./selection`

不新增 `./frame` 顶层 export，frame scope 归在 `./document` 下。

## whiteboard-editor runtime 最终目标结构

在 core ownership 对齐之后，editor runtime 应该只剩真正运行时模块。

这里有一个额外原则必须明确：

- 同一领域如果已经需要 2 个以上文件，就应该升成子目录
- 不应该在同一层继续堆 `nodeAppearance.ts`、`nodeText.ts`、`menuView.ts` 这种“前缀模拟目录”的文件名

也就是说：

- `commands/node/*` 应该是目录
- `context/menu/*` 应该是目录
- `context/selection/*` 应该是目录
- `editor/features/*` 应该是目录
- `input/pointer/*` 应该是目录

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
│   ├── node
│   │   ├── appearance.ts
│   │   ├── document.ts
│   │   ├── index.ts
│   │   ├── lock.ts
│   │   └── text.ts
│   ├── selection.ts
│   └── tool.ts
├── context
│   ├── index.ts
│   ├── menu
│   │   ├── open.ts
│   │   ├── runtime.ts
│   │   ├── target.ts
│   │   └── view.ts
│   └── selection
│       ├── actions.ts
│       ├── read.ts
│       ├── summary.ts
│       └── view.ts
├── editor
│   ├── composeCommands.ts
│   ├── composeInput.ts
│   ├── composeProjection.ts
│   ├── composeRead.ts
│   ├── composePlatform.ts
│   ├── createEditor.ts
│   ├── features
│   │   ├── capsules.ts
│   │   └── runtimes.ts
│   ├── finalize.ts
│   ├── index.ts
│   ├── kernel.ts
│   ├── lifecycle.ts
│   ├── projectionGraph.ts
│   └── public.ts
├── input
│   ├── domTarget.ts
│   ├── drivers.ts
│   ├── keyboard.ts
│   ├── passive.ts
│   ├── pointer
│   │   ├── gate.ts
│   │   ├── index.ts
│   │   └── snapshot.ts
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
│   └── rafTask.ts
├── edit.ts
├── frame.ts
├── pick.ts
├── tool.ts
└── viewport.ts
```

注意：

- 不再保留 `runtime/frame/index.ts`
- 不再保留 `runtime/edit/index.ts`
- 不再保留 `runtime/pick/index.ts`
- 不再保留 `runtime/tool/index.ts`
- 不再保留 `runtime/viewport/index.ts`
- 不再保留 `runtime/viewport/logic.ts`
- 不再保留 `runtime/host`
- 不再保留 `runtime/utils/equality.ts`
- 不再保留 `runtime/utils/recordPatch.ts`

## 现有文件最终迁移映射

### A. viewport

- `packages/whiteboard-editor/src/runtime/viewport/logic.ts`
  - 纯数学全部迁到 `packages/whiteboard-core/src/geometry/viewport.ts`
- `packages/whiteboard-editor/src/runtime/viewport/createViewport.ts`
  - 收敛成 `packages/whiteboard-editor/src/runtime/viewport.ts`
- `packages/whiteboard-editor/src/runtime/viewport/index.ts`
  - 删除

### B. frame

- `packages/whiteboard-editor/src/runtime/frame/state.ts`
  - store / commands 留在 editor，成为 `packages/whiteboard-editor/src/runtime/frame.ts`
  - `FrameScope` / `hasNode` / `filterNodeIds` / `hasEdge` 迁到 `packages/whiteboard-core/src/document/frameScope.ts`
- `packages/whiteboard-editor/src/runtime/frame/index.ts`
  - 删除

### C. selection

- `packages/whiteboard-editor/src/runtime/selection/state.ts`
  - `SelectionInput` / `SelectionTarget` / `toSelectionTarget` / `applySelectionTarget`
    - 迁到 `packages/whiteboard-core/src/selection/target.ts`
  - `resolveSelectionSnapshot`
    - 改名为 `deriveSelectionSummary`
    - 迁到 `packages/whiteboard-core/src/selection/summary.ts`
  - store / commands 留在 editor，变成 `packages/whiteboard-editor/src/runtime/selection/store.ts`
- `packages/whiteboard-editor/src/runtime/selection/press.ts`
  - 拆成：
    - `pressTarget.ts`
    - `pressPlan.ts`
    - `pressRules.ts`
- `packages/whiteboard-editor/src/runtime/selection/index.ts`
  - 只做本目录内部聚合，不能再充当跨层 type hub

### D. clipboard / platform

- `packages/whiteboard-editor/src/runtime/host/clipboard.ts`
  - packet protocol 迁到 `packages/whiteboard-core/src/document/clipboard.ts`
  - browser port 和 runtime memory 留在 `packages/whiteboard-editor/src/runtime/platform/clipboard.ts`
- `packages/whiteboard-editor/src/runtime/host/pointerContinuation.ts`
  - 迁到 `packages/whiteboard-editor/src/runtime/platform/pointerContinuation.ts`
- `packages/whiteboard-editor/src/runtime/host/selectionLock.ts`
  - 迁到 `packages/whiteboard-editor/src/runtime/platform/selectionLock.ts`
- `packages/whiteboard-editor/src/runtime/editor/platform.ts`
  - 改名为 `packages/whiteboard-editor/src/runtime/editor/composePlatform.ts`

### E. input / context

- `packages/whiteboard-editor/src/runtime/input/runtime.ts`
  - 改名为 `packages/whiteboard-editor/src/runtime/input/router.ts`
- `packages/whiteboard-editor/src/runtime/input/interactionStart.ts`
  - 改名为 `packages/whiteboard-editor/src/runtime/input/drivers.ts`
- `packages/whiteboard-editor/src/runtime/input/target.ts`
  - DOM target 相关留下，迁到 `packages/whiteboard-editor/src/runtime/input/domTarget.ts`
  - context target 相关迁到：
    - `packages/whiteboard-editor/src/runtime/context/menu/target.ts`
    - `packages/whiteboard-editor/src/runtime/context/menu/open.ts`
- `packages/whiteboard-editor/src/runtime/input/pointer.ts`
  - 拆成：
    - `packages/whiteboard-editor/src/runtime/input/pointer/index.ts`
    - `packages/whiteboard-editor/src/runtime/input/pointer/gate.ts`
  - `index.ts` 只保留 pointer normalize、wheel normalize
  - context open 相关逻辑移出
- `packages/whiteboard-editor/src/runtime/input/pointerSnapshot.ts`
  - 迁到 `packages/whiteboard-editor/src/runtime/input/pointer/snapshot.ts`
- `packages/whiteboard-editor/src/runtime/context/runtime.ts`
  - 迁到 `packages/whiteboard-editor/src/runtime/context/menu/runtime.ts`
- `packages/whiteboard-editor/src/runtime/context/view.ts`
  - 迁到 `packages/whiteboard-editor/src/runtime/context/menu/view.ts`
- `packages/whiteboard-editor/src/runtime/context/summary.ts`
  - 迁到 `packages/whiteboard-editor/src/runtime/context/selection/summary.ts`
- `packages/whiteboard-editor/src/runtime/context/selection.ts`
  - 拆成：
    - `packages/whiteboard-editor/src/runtime/context/selection/actions.ts`
    - `packages/whiteboard-editor/src/runtime/context/selection/read.ts`
    - `packages/whiteboard-editor/src/runtime/context/selection/view.ts`

### F. editor lifecycle / features

- `packages/whiteboard-editor/src/runtime/finalize.ts`
  - 迁到 `packages/whiteboard-editor/src/runtime/editor/finalize.ts`
- `packages/whiteboard-editor/src/runtime/editor/features.ts`
  - 拆成：
    - `packages/whiteboard-editor/src/runtime/editor/features/runtimes.ts`
    - `packages/whiteboard-editor/src/runtime/editor/features/capsules.ts`

### G. 单文件目录壳

- `packages/whiteboard-editor/src/runtime/edit/index.ts`
  - 改成 `packages/whiteboard-editor/src/runtime/edit.ts`
- `packages/whiteboard-editor/src/runtime/pick/index.ts`
  - 改成 `packages/whiteboard-editor/src/runtime/pick.ts`
- `packages/whiteboard-editor/src/runtime/tool/index.ts`
  - 改成 `packages/whiteboard-editor/src/runtime/tool.ts`
- `packages/whiteboard-editor/src/runtime/commands/node.ts`
  - 拆成 `packages/whiteboard-editor/src/runtime/commands/node/index.ts` 及子文件：
    - `appearance.ts`
    - `document.ts`
    - `lock.ts`
    - `text.ts`

### H. 薄壳和死文件

- `packages/whiteboard-editor/src/runtime/commands/runtime.ts`
  - 删除
- `packages/whiteboard-editor/src/runtime/context/types.ts`
  - 删除
- `packages/whiteboard-editor/src/runtime/editor/types.ts`
  - 不再作为 runtime 内部总入口
- `packages/whiteboard-editor/src/runtime/interaction/driver.ts`
  - 并入 `packages/whiteboard-editor/src/runtime/interaction/types.ts`
- `packages/whiteboard-editor/src/runtime/utils/equality.ts`
  - 删除，统一用 core/utils
- `packages/whiteboard-editor/src/runtime/utils/recordPatch.ts`
  - 删除

## 命名最终统一规则

### 文件命名

- 目录只在存在真实子域时保留
- 同一领域一旦拆成 2 个以上文件，就升级为子目录
- 不允许用前缀文件名模拟目录，例如 `nodeAppearance.ts`、`nodeText.ts`、`menuView.ts`
- `logic.ts` 禁用
- `runtime.ts` 只给真正的 runtime coordinator 使用
- `types.ts` 只允许承载本目录自己拥有的类型，禁止做跨层 re-export
- `index.ts` 只允许作为同目录局部聚合，不允许再承载语义

### symbol 命名

不要再导出这种低信息量名字：

- `createState`
- `State`
- `Commands`
- `Store`
- `Pick`

最终统一成领域名：

- `createEditState`
- `createFrameState`
- `createSelectionState`
- `EditState`
- `FrameState`
- `SelectionState`
- `EditorPick`

### 类型契约

最终不再允许用下面这种模式做长期边界：

- `ReturnType<typeof createXxx>`

跨模块契约必须写成显式命名类型。

## 一步到位的实际修改顺序

这是建议的最终实施顺序，不保留兼容。

### 第 1 步：先补 core

先完成 `whiteboard-core`：

1. 扩展 `geometry/viewport.ts`
2. 新增 `document/frameScope.ts`
3. 新增 `document/clipboard.ts`
4. 新增 `selection/target.ts`
5. 新增 `selection/summary.ts`
6. 扩展 `utils/equality.ts`
7. 更新 `document/index.ts`
8. 更新 `geometry/index.ts`
9. 更新 `utils/index.ts`
10. 更新 `package.json` exports

原因很明确：

- editor runtime 的大量整理依赖这些新的 canonical module
- 如果 core 不先补齐，editor 侧只能继续互相转发和 alias import

### 第 2 步：再瘦身 runtime 顶层

然后直接做顶层去壳：

1. `edit/index.ts` -> `edit.ts`
2. `pick/index.ts` -> `pick.ts`
3. `tool/index.ts` -> `tool.ts`
4. `frame/index.ts + state.ts` -> `frame.ts`
5. `viewport/createViewport.ts + index.ts` -> `viewport.ts`

### 第 3 步：拆 ownership 混乱文件

然后处理混边界文件：

1. `host/clipboard.ts`
2. `input/target.ts`
3. `selection/state.ts`
4. `input/pointer.ts`
5. `finalize.ts`

这一步之后，runtime 的“纯规则”和“运行时逻辑”会真正分开。

### 第 4 步：拆大文件

最后拆真正的大文件：

1. `context/selection.ts`
2. `selection/press.ts`
3. `commands/node.ts`
4. `editor/features.ts`

## 最终不该再出现的情况

做完以后，下面这些情况都不应该再存在：

- editor runtime 自己维护 viewport 数学
- editor runtime 自己维护 frame membership predicate
- selection target 类型藏在 editor internal types
- clipboard packet 协议放在 platform/runtime 文件里
- `state.ts` 同时装 store 和纯规则
- `input` 模块里混入 context menu 语义
- `editor/types.ts` 这种内部总转发入口继续扩大
- `createState as createFrameState` 这种 alias import 到处出现

## 最终结论

这份方案的核心不是“runtime 目录瘦身”，而是：

- 先把真正属于 core 的东西下沉
- 再把 editor runtime 收缩回 runtime 本职

最终应该形成下面这个稳定分层：

- `@whiteboard/core`
  - 几何
  - 文档协议
  - frame scope
  - selection 模型与推导
- `@whiteboard/editor/runtime`
  - 状态
  - 输入路由
  - interaction session
  - feature runtime 组装
  - read / commands 组装
- `@whiteboard/editor/platform`
  - browser adapter

如果只抓最关键的 6 件事，这次必须一次做完的是：

1. viewport 数学下沉到 core
2. frame scope 下沉到 core/document
3. selection target 和 summary 下沉到 core/selection
4. clipboard packet 下沉到 core/document
5. runtime 顶层去目录壳
6. input/context/platform/editor 边界重新切干净

这 6 件事做完，runtime 才算真正进入长期可维护状态。
