# Whiteboard Naming & API Review

## 1. 结论

这一轮重构之后，`core / engine / react` 的大边界已经明显变好了：

- 共享 projection 已经下沉到 `@whiteboard/core/read`
- 共享 config contract 已经下沉到 `@whiteboard/core/config`
- `react` 对 `engine` 的依赖已经基本收敛到实例创建边界

但从“命名和 API 清晰度”来看，系统里还存在三类持续会扩散的问题：

1. 同一概念用了多套词汇  
   典型例子：`Entry / Item / View / State / Draft / Transient / Domain`
2. 一些名字过于抽象  
   典型例子：`Domain`、`Transient`、`Spec`、`ValueView`
3. 一些类型名过于泛  
   典型例子：`Config`、`RuntimeConfig`、`InstanceConfig`

如果继续演进，最值得统一的不是再拆包，而是先统一一套词汇体系。  
我的建议是：

- `read` 只表示“共享只读投影 / 只读查询契约”
- `store` 只表示“`get / set / subscribe` 容器”
- `draft` 只表示“帧级预览态 / 临时态”
- `state` 只表示“稳定值 / 语义态”
- `session` 只表示“指针生命周期对象”
- `coordinator` 只表示“session 仲裁器”
- `policy` 只表示“允许/禁止规则”
- `item` 只表示“共享 projection 单项”

只要这套词汇固定下来，后续 API 会自然收敛很多。

---

## 2. 现在最值得动的，不是哪里

不是：

- 再继续硬拆 `react -> engine` 剩余的 3 个实例边界导入
- 再继续增加新的中间层
- 大规模重命名组件文件

而是：

- 收敛命名体系
- 删除冗余别名
- 压缩过于抽象的概念词
- 统一“一个概念一种说法”

---

## 3. 推荐词汇表

这是我认为后续应该强约束的一套词汇规则。

### 3.1 `read`

含义：

- 共享只读 projection
- 跨层共享的只读 contract
- 不包含 React 语义

适用：

- `@whiteboard/core/read`
- `EngineRead`
- `read.index`

不适用：

- UI 衍生状态
- draft
- 组件消费的展示态

### 3.2 `store`

含义：

- 标准 `get / subscribe`
- 或 `get / set / subscribe`

适用：

- `ReadStore`
- `ValueStore`
- `createSelectionStore`
- `createNodeDraftStore`

不适用：

- 纯 helper 对象
- 一次性计算结果

### 3.3 `draft`

含义：

- 临时预览态
- 会被 RAF / pointer move 高频刷新
- 可以随时 clear

适用：

- node/edge/mindmap drag preview
- guides/connection preview

不适用：

- 稳定 selection
- container active id

### 3.4 `state`

含义：

- 语义稳定态
- 聚合后的业务值
- 常用于 UI render 直接消费

适用：

- `SelectionState`
- `ContainerState`

### 3.5 `session`

含义：

- 从 pointer down 到 end/cancel 的生命周期对象

适用：

- `createNodeDragSession`
- `createNodeTransformSession`
- `usePointerSession`

### 3.6 `policy`

含义：

- allow/block 这类规则表

适用：

- 当前 `InteractionSpec`

更好的名字：

- `InteractionPolicy`

### 3.7 `item`

含义：

- shared projection 单项

适用：

- node/edge/mindmap read item

不适用：

- React 组件展示态

---

## 4. 高优先级问题

这些问题会持续扩散，应该优先统一。

### 4.1 `core/read` 的 projection 命名不统一

文件：

- `packages/whiteboard-core/src/read/index.ts`
- `packages/whiteboard-core/src/mindmap/query.ts`

当前存在：

- `CanvasNodeRect`
- `NodeViewItem`
- `EdgeEntry`
- `MindmapViewTree`
- `MindmapViewTreeLine`
- `MindmapViewLine`

问题：

- `Rect / Item / Entry / ViewTree / ViewLine` 五套词混用
- `view` 在这里不是 React view，语义不准
- `entry` 和 `item` 没有明确边界
- `MindmapViewTreeLine` 和 `MindmapViewLine` 明显重复

推荐方向：

统一成一套 `item` 体系，line 单独用 `Line`。

推荐矩阵：

| 当前名 | 推荐名 | 原因 |
| --- | --- | --- |
| `CanvasNodeRect` | `CanvasNode` | 这个类型不只是 rect，还带 node/aabb/rotation，叫 `Rect` 太窄 |
| `NodeViewItem` | `NodeItem` | 共享 read item，不是 React view |
| `EdgeEntry` | `EdgeItem` | 和 `NodeItem` 对齐，避免 `Entry` 混用 |
| `MindmapViewTree` | `MindmapItem` | 已经在 `core/read`，不需要再强调 `View` |
| `MindmapViewTreeLine` | `MindmapLine` | 足够清晰 |
| `MindmapViewLine` | `MindmapLine` | 和上面统一 |

这里最关键的不是具体选 `Item` 还是 `Entry`，而是以后只留一套。

我的明确建议是：选 `Item`。

### 4.2 `Config` 命名层级过泛

文件：

- `packages/whiteboard-core/src/config/index.ts`
- `packages/whiteboard-engine/src/types/instance.ts`
- `packages/whiteboard-react/src/config/index.ts`
- `packages/whiteboard-react/src/types/common/whiteboard.ts`

当前存在：

- `InstanceConfig`
- `RuntimeConfig`
- `Config`
- `ResolvedConfig`
- `WhiteboardRuntimeConfig`
- `MindmapLayoutConfig`

问题：

- `Config` 太泛，不知道是谁的 config
- `RuntimeConfig` 太泛，不知道是 engine runtime 还是 react runtime
- `InstanceConfig` 太技术，不表达业务语义
- `ResolvedConfig` 缺主语

推荐方向：

明确“归属 + 生命周期”。

推荐矩阵：

| 当前名 | 推荐名 | 原因 |
| --- | --- | --- |
| `core/config/InstanceConfig` | `BoardConfig` | 这是共享白板运行配置，不是某个 instance 私有实现细节 |
| `engine/RuntimeConfig` | `EngineRuntimeOptions` | 它是传给 `engine.configure()` 的动态配置 |
| `react/types/common/Config` | `WhiteboardConfig` | 对外公开 API 必须带主语 |
| `react/types/common/ResolvedConfig` | `ResolvedWhiteboardConfig` | 避免全局泛名 |
| `WhiteboardRuntimeConfig` | `WhiteboardRuntimeOptions` | 和 `EngineRuntimeOptions` 对齐 |

这里最值得优先改的是：

- `Config`
- `ResolvedConfig`
- `RuntimeConfig`

因为它们最容易在阅读时丢失上下文。

### 4.3 `engine()` / `Instance` / `Commands` 这些根导出仍然过泛

文件：

- `packages/whiteboard-engine/src/index.ts`
- `packages/whiteboard-engine/src/instance/engine.ts`

当前存在：

- `engine()`
- `Instance`
- `Commands`

问题：

- 从包外看，`engine()` 太像内部变量，不像工厂函数
- `Instance`、`Commands` 放到 import 现场可读性不强
- 即使上下文已经在 `@whiteboard/engine`，这组名字仍然偏泛

推荐方向：

明确根导出的主语，让 import 现场自解释。

推荐矩阵：

| 当前名 | 推荐名 |
| --- | --- |
| `engine` | `createEngine` |
| `Instance` | `EngineInstance` |
| `Commands` | `EngineCommands` |

这里的关键不是“名字更长”，而是公开面必须一眼看出角色。

### 4.4 `onDocChange` 的名字和真实行为不一致

文件：

- `packages/whiteboard-react/src/types/common/whiteboard.ts`
- `packages/whiteboard-react/src/Whiteboard.tsx`

当前存在：

- `onDocChange: (recipe: (draft: Document) => void) => void`

问题：

- `onDocChange` 听起来像“把新文档告诉你”的 callback
- 但现在真实行为是“给你一个 recipe，让你去改外部文档”
- 这是典型的名字误导行为

推荐方向：

两种方向二选一即可：

1. 保留 `onDocChange` 这个名字  
   那签名应改成 `(nextDoc: Document) => void`
2. 保留 recipe 模式  
   那名字应改成 `updateDoc` / `applyDocRecipe` / `commitDoc`

我的明确建议是：公开 API 优先给 `nextDoc`，不要把内部 recipe 语义暴露到组件 props。

### 4.5 `Domain` 是过于抽象的词

文件：

- `packages/whiteboard-react/src/runtime/container/state.ts`
- `packages/whiteboard-react/src/runtime/state/selection.ts`

当前存在：

- `createContainerDomain`
- `createSelectionDomain`
- `SelectionDomain`
- `ContainerDomain`

问题：

- `Domain` 不表达返回值结构
- 从代码看，这里实际返回的是 “store + commands (+ read)”
- 同一系统里已经有 `store` 这个更具体的词，就不应继续用 `domain`

推荐方向：

统一改成 `Store`。

推荐矩阵：

| 当前名 | 推荐名 |
| --- | --- |
| `createContainerDomain` | `createContainerStore` |
| `ContainerDomain` | `ContainerStore` |
| `createSelectionDomain` | `createSelectionStore` |
| `SelectionDomain` | `SelectionStore` |
| `StoredSelection` | `SelectionValue` 或 `SelectionSnapshot` |

我的偏好：

- `SelectionValue`
- `ContainerStore`

因为它们最短，也最贴近实际结构。

### 4.6 `Transient` 和 `draft` 同时存在，词汇冲突

文件：

- `packages/whiteboard-react/src/runtime/draft/runtime.ts`
- `packages/whiteboard-react/src/runtime/draft/node.ts`
- `packages/whiteboard-react/src/runtime/draft/edge.ts`
- `packages/whiteboard-react/src/runtime/draft/mindmap.ts`
- `packages/whiteboard-react/src/runtime/draft/guides.ts`
- `packages/whiteboard-react/src/runtime/draft/connection.ts`

当前存在：

- 目录叫 `draft`
- 类型叫 `TransientNode`
- 工厂叫 `createTransientNode`
- hook 叫 `useTransientNode`
- 聚合对象叫 `Transient`

问题：

- 目录和类型不统一
- `Transient` 比 `draft` 更抽象，也更难搜索
- 现在系统已经明确认定这是 draft 语义，就不该再保留第二套词

推荐方向：

整套改成 `draft`。

推荐矩阵：

| 当前名 | 推荐名 |
| --- | --- |
| `Transient` | `Drafts` 或 `DraftState` |
| `createTransient` | `createDrafts` |
| `TransientNode` | `NodeDraftStore` |
| `TransientEdge` | `EdgeDraftStore` |
| `TransientMindmap` | `MindmapDraftStore` |
| `TransientGuides` | `GuidesDraftStore` |
| `TransientConnection` | `ConnectionDraftStore` |
| `TransientSelection` | `SelectionDraftStore` |
| `createTransientNode` | `createNodeDraftStore` |
| `useTransientNode` | `useNodeDraft` |

我的建议是：

- 聚合对象用 `Drafts`
- 单项 store 用 `*DraftStore`
- hook 用 `use*Draft`

这样最直观。

### 4.7 `EngineRead` 的查询 API 形状不统一

文件：

- `packages/whiteboard-engine/src/types/instance.ts`

当前存在：

- `read.node.byId.get(id)`
- `read.edge.byId.get(id)`
- `read.tree.get(rootId)`
- `read.index.node.byId(id)`
- `read.index.tree.ids(rootId)`
- `read.index.tree.has(rootId, nodeId)`

问题：

- 同样是“读取”，有 store 形状、有 query object 形状、有裸函数形状
- `byId` 在不同地方语义不一致
- `tree` 同时存在在 `read.tree` 和 `read.index.tree`
- 继续演进下去，很容易让调用侧记忆“这个模块该不该带 `.get`”

推荐方向：

要么统一成 store 风格，要么统一成 query 风格，但不要继续“同词不同形”。

推荐规则：

- store 风格：统一成 `get / subscribe`
- query 风格：统一成 `get / list / has`

我更建议：

- 基础 projection 用 store 风格
- index/query helper 用 query 风格

但无论选哪套，都应该避免：

- `read.node.byId.get(id)`
- `read.index.node.byId(id)`

这种只差一个 `.get` 的并存形态。

### 4.8 `ValueView` / `useView` 是冗余别名

文件：

- `packages/whiteboard-react/src/runtime/view/types.ts`
- `packages/whiteboard-react/src/runtime/hooks/useView.ts`
- `packages/whiteboard-react/src/runtime/hooks/index.ts`

当前存在：

- `ValueView<T> = ReadStore<T>`
- `useView(view) = useStoreValue(view)`

问题：

- 这两个名字没有提供额外语义
- 反而制造了 `view` 和 `store` 两套词
- 在 `useNodeInteractions.ts` 这种地方，`useView(dragSession.pointer)` 比 `useStoreValue(dragSession.pointer)` 更抽象

推荐方向：

- 删除 `ValueView`
- 删除 `useView`
- 直接统一使用 `ReadStore`
- 直接统一使用 `useStoreValue`

如果一定要保留 `view` 命名空间，那也应只保留 `instance.view`，不要继续再加 `ValueView` / `useView` 这种二次别名。

### 4.9 `runtime/view` 这个目录名语义太宽

文件：

- `packages/whiteboard-react/src/runtime/view/*`

当前存在：

- `WhiteboardView`
- `ContainerView`
- `SelectionState`
- `createWhiteboardView`
- `resolveContainerView`
- `resolveSelectionView`

问题：

- 这里其实是“derived store + derived state”
- 既不是 DOM view，也不是组件 view
- `ContainerView` 和 `SelectionState` 后缀还不一致

推荐方向有两种。

方案 A，保留 `view`：

- 只保留 `instance.view`
- 删除 `ValueView`
- 统一 `ContainerView` / `SelectionView`

方案 B，我更推荐：

- 目录改成 `runtime/derived`
- `WhiteboardView` -> `WhiteboardDerived`
- `createWhiteboardView` -> `createWhiteboardDerived`
- `ContainerView` -> `ContainerState`
- `resolveContainerView` -> `buildContainerState`
- `resolveSelectionView` -> `buildSelectionState`

理由：

- `derived` 比 `view` 更准确
- 这层的核心其实是 derived store
- 可以和 `createDerivedStore` 形成一致词汇

---

## 5. 中优先级问题

这些问题值得统一，但不必先动。

### 5.1 `InteractionSpec` 更像 `InteractionPolicy`

文件：

- `packages/whiteboard-react/src/runtime/interaction/types.ts`
- `packages/whiteboard-react/src/runtime/interaction/coordinator.ts`

当前存在：

- `InteractionSpec`
- `specByMode`
- `active.spec`

问题：

- 这里表达的不是“规格说明”，而是运行时 allow/block 规则
- `menu / viewport / pan` 本质是 policy

推荐：

| 当前名 | 推荐名 |
| --- | --- |
| `InteractionSpec` | `InteractionPolicy` |
| `specByMode` | `policyByMode` |
| `active.spec` | `active.policy` |

另外：

- `tryStart` 可以考虑简化成 `start`

前提是团队接受“返回 `null` 就表示启动失败”。

### 5.2 `useWindowPointerSession` 名字偏实现细节

文件：

- `packages/whiteboard-react/src/runtime/interaction/useWindowPointerSession.ts`

问题：

- `Window` 是实现细节
- 在 interaction 目录下，这个 hook 的真实语义是“为某个 pointerId 维持全局 session”

推荐：

- `usePointerSession`

如果你明确要保留“它绑定的是 window 而不是 element”的信息，也可以不改。  
这项优先级不高。

### 5.3 `WhiteboardViewport` / `ViewportCore` / `useViewportController` 词汇层次不够整齐

文件：

- `packages/whiteboard-react/src/runtime/viewport/core.ts`
- `packages/whiteboard-react/src/runtime/viewport/useViewportController.ts`

当前存在：

- `WhiteboardViewport`
- `ViewportCore`
- `useViewportController`

问题：

- `core` / `controller` / `viewport` 这三个词不在一个层次
- `WhiteboardViewport` 实际是 `store + geometry api`
- `ViewportCore` 实际是 viewport model

推荐方向：

| 当前名 | 推荐名 |
| --- | --- |
| `WhiteboardViewport` | `ViewportStore` 或 `ViewportApi` |
| `ViewportCore` | `ViewportModel` |
| `createViewportCore` | `createViewportModel` |

这里不一定要马上改，但文档和后续新增代码应遵守同一套词。

### 5.4 `MindmapLayoutConfigLike` 应该消失

文件：

- `packages/whiteboard-core/src/mindmap/query.ts`

问题：

- 现在系统里已经有正式的 `MindmapLayoutConfig`
- 再保留一个 `MindmapLayoutConfigLike` 只会制造重复概念

推荐：

- 直接统一成 `MindmapLayoutConfig`

这是一个很典型的“重构后遗留命名”，优先级中高。

### 5.5 `engine/types/command.ts` 里混入了一批已经脱离 engine 的 interaction 术语

文件：

- `packages/whiteboard-engine/src/types/command.ts`

典型例子：

- `MindmapStartDragOptions`
- `NodeDragStartOptions`
- `NodeResizeStartOptions`
- `NodeRotateStartOptions`
- `NodeTransformUpdateOptions`

问题：

- 这些类型当前只剩定义，没有形成稳定的 engine 公共命令 API
- 现在交互逻辑已经主要在 `react/runtime/interaction` 和 feature runtime
- 继续放在 `engine command` 语境下，会误导后续开发者以为 engine 仍然负责这套交互 session API

推荐方向：

- 这批类型要么删除
- 要么迁到 `react` 的 interaction/session 层
- 不建议继续以 `engine command` 的名义扩张

### 5.6 `MindmapDragView` 仍然保留了 `view` 词

文件：

- `packages/whiteboard-react/src/runtime/draft/mindmap.ts`

问题：

- 它已经被收回到 draft 层
- 现在再叫 `View` 已经不准

推荐：

- `MindmapDragDraft`

对应：

- `MindmapDragPreview` 可以保留

因为 `preview` 在这里是具体子结构，语义明确。

---

## 6. 低优先级问题

这些问题存在，但可以后做。

### 6.1 泛化文件名仍然偏多

典型文件：

- `packages/whiteboard-react/src/ui/context-menu/model.ts`
- `packages/whiteboard-react/src/ui/node-toolbar/model.ts`
- `packages/whiteboard-react/src/runtime/viewport/logic.ts`
- `packages/whiteboard-react/src/runtime/viewport/core.ts`

问题：

- `model.ts` / `logic.ts` / `core.ts` 单看时几乎不提供职责信息
- 层级一深，检索体验和阅读体验都会明显变差

推荐：

- `model.ts` 优先改成 `state.ts` / `items.ts` / `builder.ts`
- `logic.ts` 优先改成 `math.ts` / `ops.ts`
- `core.ts` 优先改成 `runtime.ts`

### 6.2 `ReadControl` / `WriteControl` / `ReadDeps` / `WriteDeps` 这类名字过于抽象

文件：

- `packages/whiteboard-engine/src/types/read.ts`
- `packages/whiteboard-engine/src/types/write.ts`
- `packages/whiteboard-engine/src/write/normalize.ts`

当前存在：

- `ReadControl`
- `ReadDeps`
- `ReadSnapshot`
- `WriteControl`
- `WriteDeps`
- `WriteNormalize`

问题：

- 这些名字只表达“这是一个类型”，没有表达它在流水线里的角色
- 特别是 `Control`，语义太宽
- `ReadControl` 里同时有 `read` 和 `invalidate`，继续叫 `Control` 不利于心智稳定

推荐：

| 当前名 | 推荐名 |
| --- | --- |
| `ReadControl` | `ReadRuntime` |
| `ReadDeps` | `ReadContext` |
| `ReadSnapshot` | `ReadFrame` |
| `WriteControl` | `WriteRuntime` |
| `WriteDeps` | `WriteContext` |
| `WriteNormalize` | `WriteNormalizer` |

### 6.3 engine command 类型里 `Options / State / Draft / Payload` 混用偏多

文件：

- `packages/whiteboard-engine/src/types/command.ts`
- `packages/whiteboard-engine/src/types/node.ts`
- `packages/whiteboard-engine/src/types/edge.ts`

典型例子：

- `MindmapStartDragOptions`
- `NodeDragDraft`
- `RoutingDragPayload`
- `RoutingDragState`
- `EdgeConnectState`
- `EdgeConnectDraft`

问题：

- 有些是输入，有些是活动态，有些是提交载荷
- 词汇层级没有完全拉开

推荐规则：

- 输入参数统一用 `Input`
- 活动态统一用 `State`
- 临时预览统一用 `Draft`
- 一次性写入内容才用 `Payload`

例如：

| 当前名 | 推荐名 |
| --- | --- |
| `MindmapStartDragOptions` | `MindmapDragStartInput` |
| `MindmapUpdateDragOptions` | `MindmapDragUpdateInput` |
| `MindmapEndDragOptions` | `MindmapDragEndInput` |
| `MindmapCancelDragOptions` | `MindmapDragCancelInput` |

### 6.4 `NodeDragDraft` / `NodeTransformDraft` 和 react session/state 词汇体系不一致

文件：

- `packages/whiteboard-engine/src/types/node.ts`
- `packages/whiteboard-react/src/features/node/hooks/drag/session.ts`
- `packages/whiteboard-react/src/features/node/hooks/transform/session.ts`

问题：

- engine bench/types 里偏向 `Draft`
- react feature 里偏向 `Session`

如果后续这两套系统要进一步对齐，建议统一用：

- lifecycle 对象：`Session`
- 内部活动值：`State`
- render preview：`Draft`

目前这项主要影响 bench/type 体系，不急。

### 6.5 `ContainerView` 与 `SelectionState` 不对齐

文件：

- `packages/whiteboard-react/src/runtime/view/container.ts`
- `packages/whiteboard-react/src/runtime/view/selection.ts`

问题：

- 一个叫 `View`
- 一个叫 `State`

推荐：

- 统一成 `ContainerState` / `SelectionState`

这是命名洁癖项，但长期值得做。

---

## 7. 我明确建议保留的命名

不是所有东西都值得继续改。

### 7.1 `container`

我建议继续保留：

- `container`

不要再改回：

- `scope`

原因：

- `container` 是领域词
- `scope` 过抽象

### 7.2 `coordinator`

我建议继续保留：

- `InteractionCoordinator`

原因：

- 这个对象确实是在做 session 仲裁
- 比 `manager`、`service` 更准确

### 7.3 `read`

我建议继续保留：

- `@whiteboard/core/read`

不要改成：

- `view`
- `projection`

原因：

- `read` 最短
- 和 `EngineRead`、`read.index`、`ReadStore` 能形成一条线

唯一要改的不是子包名，而是包内类型名。

### 7.4 `pan`

我建议继续保留：

- `pan`

例如：

- `resolvePanVector`
- `createPanDriver`

`autopan` 作为场景词可以保留在文档和注释里，但 API 里直接用 `pan` 更短也更稳定。

---

## 8. 推荐重命名矩阵

这一节可以直接当后续重构清单。

### 8.1 共享 contract

| 位置 | 当前名 | 推荐名 |
| --- | --- | --- |
| `core/read` | `CanvasNodeRect` | `CanvasNode` |
| `core/read` | `NodeViewItem` | `NodeItem` |
| `core/read` | `EdgeEntry` | `EdgeItem` |
| `core/read` | `MindmapViewTree` | `MindmapItem` |
| `core/read` | `MindmapViewTreeLine` | `MindmapLine` |
| `core/mindmap/query` | `MindmapViewLine` | `MindmapLine` |
| `core/config` | `InstanceConfig` | `BoardConfig` |

### 8.2 engine

| 位置 | 当前名 | 推荐名 |
| --- | --- | --- |
| `engine/index.ts` | `engine` | `createEngine` |
| `engine/index.ts` | `Instance` | `EngineInstance` |
| `engine/index.ts` | `Commands` | `EngineCommands` |
| `engine/types/read.ts` | `ReadControl` | `ReadRuntime` |
| `engine/types/read.ts` | `ReadDeps` | `ReadContext` |
| `engine/types/read.ts` | `ReadSnapshot` | `ReadFrame` |
| `engine/types/write.ts` | `WriteControl` | `WriteRuntime` |
| `engine/types/write.ts` | `WriteDeps` | `WriteContext` |
| `engine/write/normalize.ts` | `WriteNormalize` | `WriteNormalizer` |

### 8.3 react runtime

| 位置 | 当前名 | 推荐名 |
| --- | --- | --- |
| `runtime/draft/runtime.ts` | `Transient` | `Drafts` |
| `runtime/draft/node.ts` | `TransientNode` | `NodeDraftStore` |
| `runtime/draft/edge.ts` | `TransientEdge` | `EdgeDraftStore` |
| `runtime/draft/mindmap.ts` | `TransientMindmap` | `MindmapDraftStore` |
| `runtime/draft/guides.ts` | `TransientGuides` | `GuidesDraftStore` |
| `runtime/draft/connection.ts` | `TransientConnection` | `ConnectionDraftStore` |
| `runtime/draft/selection.ts` | `TransientSelection` | `SelectionDraftStore` |
| `runtime/draft/mindmap.ts` | `MindmapDragView` | `MindmapDragDraft` |
| `runtime/container/state.ts` | `createContainerDomain` | `createContainerStore` |
| `runtime/state/selection.ts` | `createSelectionDomain` | `createSelectionStore` |
| `runtime/state/selection.ts` | `StoredSelection` | `SelectionValue` |
| `runtime/view/types.ts` | `ValueView` | 删除，直接用 `ReadStore` |
| `runtime/hooks/useView.ts` | `useView` | 删除，直接用 `useStoreValue` |
| `runtime/interaction/types.ts` | `InteractionSpec` | `InteractionPolicy` |

### 8.4 react public API

| 位置 | 当前名 | 推荐名 |
| --- | --- | --- |
| `types/common/whiteboard.ts` | `Config` | `WhiteboardConfig` |
| `types/common/whiteboard.ts` | `ResolvedConfig` | `ResolvedWhiteboardConfig` |
| `types/common/whiteboard.ts` | `onDocChange` | `onDocChange(nextDoc)` 或 `updateDoc(recipe)` |
| `runtime/instance/types.ts` | `WhiteboardRuntimeConfig` | `WhiteboardRuntimeOptions` |

---

## 9. 推荐 API 收敛点

除了命名，我认为还有几处 API 形式可以更简单。

### 9.1 `instance.view` 可以保留，但不要再扩张

当前：

- `instance.view.tool`
- `instance.view.selection`
- `instance.view.container`

我的建议：

- 这层可以保留
- 但不要再引入新的 `ValueView` / `useView`
- 不要把 feature 层的 `NodeView` / `EdgeView` 也继续往这里塞

也就是：

- `instance.view` 只放全局 derived store

### 9.2 feature hook 层的 `use*View` 要谨慎增长

当前：

- `useNodeView`
- `useEdgeView`
- `useMindmapTreeView`

问题不是它们存在，而是如果以后再继续加：

- `useXxxView`
- `useXxxOverlayView`
- `useXxxPresentation`

就会再次变乱。

建议规则：

- 如果是组件本地拼装态，尽量直接留在组件
- 只有当多处复用且包含订阅逻辑时，才抽 `use*View`

### 9.3 `runtime/container/read.ts` 这种 helper，不要再做大

它现在已经比较克制：

- 一组 plain getter
- 没有再引入 store 订阅

建议：

- 继续保持最小 helper
- 不要把更多业务语义塞进去

否则又会走回旧的“大 read 层”

---

## 10. 分阶段建议

### 阶段 A：先统一词，不动结构

建议先做：

- `Domain -> Store`
- `Transient -> Draft`
- `InteractionSpec -> InteractionPolicy`
- `ValueView / useView` 删除
- `MindmapLayoutConfigLike` 删除

这是收益最高、风险最低的一组。

### 阶段 B：统一共享 projection 类型名

建议再做：

- `NodeViewItem -> NodeItem`
- `EdgeEntry -> EdgeItem`
- `MindmapViewTree -> MindmapItem`
- `MindmapViewTreeLine / MindmapViewLine -> MindmapLine`

这一步影响面较大，但能显著降低术语噪音。

### 阶段 C：统一 config 体系名

建议最后做：

- `Config -> WhiteboardConfig`
- `ResolvedConfig -> ResolvedWhiteboardConfig`
- `InstanceConfig -> BoardConfig`
- `RuntimeConfig -> EngineRuntimeOptions`

这一步最好和公开 API 一起调整。

---

## 11. 最终建议

如果只保留一句最核心的建议，就是：

- 不要再继续扩张概念词
- 以后新增 API 时，只允许从 `read / store / draft / state / session / coordinator / policy / item` 这组词里选

具体落地顺序我建议是：

1. 先删抽象词：`Domain`、`Transient`、`ValueView`
2. 再统一共享 projection 名：`Item / Line`
3. 最后统一 config 主语：`WhiteboardConfig / BoardConfig / EngineRuntimeOptions`

这样改，复杂度最低，清晰度提升最大。
