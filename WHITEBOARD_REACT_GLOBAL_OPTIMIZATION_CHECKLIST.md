# Whiteboard React 全局优化清单（Getter / 订阅 / CSS）

> 范围：`packages/whiteboard-react/src`
> 目标：尽量用 getter/runtime 读取替代高频 state 订阅，并用 CSS 方案降低渲染抖动与重渲染。

## 命名空间化设计（控制文件数量）

### 设计目标

- 在完成读写分离的同时，避免“拆分过度导致文件爆炸”。
- 对外 API 保持语义清晰，调用方一眼能看出 `state/actions/runtime` 边界。
- 控制迁移成本：优先在原文件内重构导出，再按需拆文件。

### 设计规则

1. 以“领域”作为命名空间单位，不以“每个小 hook”拆文件。
   - 领域示例：`selection`、`edgeConnect`、`interaction`。

2. 优先“单文件多导出”，只在满足以下条件时拆子文件：
   - 单文件超过约 280~320 行；
   - `state/actions/runtime` 逻辑交叉导致可读性下降；
   - 多个模块需要独立引用其中某一层能力。

3. 命名空间采用 ESM 模块组织，不使用 TypeScript `namespace` 关键字。
   - 推荐：`selection.useState()` / `selection.useActions()` / `selection.useRuntime()`。
   - 或直接具名导出：`useSelectionState`、`useSelectionActions`、`useSelectionRuntime`。

4. 禁止新增“纯透传聚合 hook”（与 AGENTS 约束一致）。
   - 可以有命名空间导出对象；
   - 但不要再包一层只做数据转发的 `useXxxModel/useXxxState`。

5. 外部导入统一走领域入口，避免跨层级直连内部实现。
   - 例如只从 `.../hooks/selection` 导入，不在业务代码里直接引入 `.../selection/actions`。

### 建议目录形态（两档）

- 档位 A（默认，文件更少）：
  - 每个领域 1 个文件，内部导出 `state/actions/runtime` 三组 API。

- 档位 B（复杂后再升级）：
  - 每个领域 1 个目录 + 2~3 个文件：
    - `state.ts`
    - `actions.ts`
    - `runtime.ts`（可选）
    - `index.ts`（统一对外导出）

### 对当前 whiteboard-react 的落地建议

1. `interaction`
   - 先保持单文件：`packages/whiteboard-react/src/common/hooks/useInteraction.ts`
   - 在文件内拆为 `useInteractionState` + `useInteractionActions`。

2. `selection`
   - 先保持单文件：`packages/whiteboard-react/src/node/hooks/useSelection.ts`
   - 在文件内拆出 `useSelectionState` / `useSelectionActions` / `useSelectionRuntime`。
   - 若后续超过复杂度阈值，再升级为目录。

3. `edgeConnect`
   - 保持单文件：`packages/whiteboard-react/src/edge/hooks/useEdgeConnect.ts`
   - 优先导出 `useEdgeConnectState` + `useEdgeConnectActions`，避免调用方绑定全量状态。

---

## P0（优先做，收益最大）

1. 拆分 `useInteraction` 的读写职责（采用命名空间导出）
   - 现状：`useInteraction` 用 `useAtom` 同时读写，但调用方只用 `update`。
   - 问题：会引入不必要订阅与重渲染。
   - 建议：在同文件内先拆成 `useInteractionActions`（仅写）+ `useInteractionState`（仅读）。
   - 相关文件：
     - `packages/whiteboard-react/src/common/hooks/useInteraction.ts:6`
     - `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts:34`
     - `packages/whiteboard-react/src/common/hooks/internal/useCanvasHandlers.ts:27`
     - `packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts:16`

2. 拆分 `useSelection` 的聚合能力（先同文件分层）
   - 现状：`useSelection` 聚合了 state / actions / 命中测试 / box handlers。
   - 问题：多个调用方只需要局部能力，却被动绑定完整订阅与逻辑。
   - 建议：先在同文件拆分为 `useSelectionState` / `useSelectionActions` / `useSelectionRuntime`。
   - 相关文件：
     - `packages/whiteboard-react/src/node/hooks/useSelection.ts:53`
     - `packages/whiteboard-react/src/node/components/SelectionLayer.tsx:9`
     - `packages/whiteboard-react/src/common/lifecycle/useWhiteboardLifecycle.ts:38`
     - `packages/whiteboard-react/src/common/hooks/internal/useCanvasHandlers.ts:23`
     - `packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts:13`
     - `packages/whiteboard-react/src/common/shortcuts/lifecycle/useShortcutRegistry.ts:39`

3. 拆分 `useEdgeConnect` 的状态与动作（先同文件分层）
   - 现状：`useEdgeConnect` 既持有状态又暴露全部动作，多个模块仅需要 `selectEdge/updateHover`。
   - 问题：造成跨模块不必要订阅与对象重建传播。
   - 建议：先拆成 `useEdgeConnectState` / `useEdgeConnectActions`，必要时再目录化。
   - 相关文件：
     - `packages/whiteboard-react/src/edge/hooks/useEdgeConnect.ts:93`
     - `packages/whiteboard-react/src/common/hooks/internal/useCanvasHandlers.ts:24`
     - `packages/whiteboard-react/src/common/shortcuts/lifecycle/useShortcutRegistry.ts:40`
     - `packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts:14`

4. 降低 `NodeItem` 对 group/snap/transient 的全量订阅
   - 现状：每个 `NodeItem` 经过 `useNodeInteraction` 订阅 `useGroupRuntime/useSnapRuntime/useNodeTransient`。
   - 问题：拖拽或 hover 改变会放大渲染扇出。
   - 建议：改为 runtime getter/service 读取（仅在交互事件中读取）。
   - 相关文件：
     - `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts:36`
     - `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts:37`
     - `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts:38`

5. `useNodeTransient` 从“读写”改为“写路径优先”
   - 现状：使用 `useAtom` 同时读取 `overrides` 与写入。
   - 问题：当前主要调用路径只做写/提交，读取引入额外订阅。
   - 建议：将提交路径优先改为显式 updates，内部只保留 `useSetAtom` 写入能力。
   - 相关文件：
     - `packages/whiteboard-react/src/node/hooks/useNodeTransient.ts:28`
     - `packages/whiteboard-react/src/node/runtime/drag/plainNodeDragStrategy.ts:16`
     - `packages/whiteboard-react/src/node/runtime/drag/groupNodeDragStrategy.ts:90`

## P1（中优先）

1. 稳定 `useCanvasEventBindings` listener 绑定
   - 现状：effect 依赖多个 handlers，函数引用变更会触发解绑/重绑。
   - 建议：listener 固定绑定一次，内部通过 ref 读取最新回调。
   - 文件：`packages/whiteboard-react/src/common/lifecycle/useCanvasEventBindings.ts:29`

2. `useCanvasHandlers` 改为事件时读取 shortcut context
   - 现状：依赖 `shortcutContextAtom`，上下文变化会导致 handlers 重建。
   - 建议：改为 runtime getter 拉取上下文，降低事件层重建频率。
   - 文件：`packages/whiteboard-react/src/common/hooks/internal/useCanvasHandlers.ts:26`

3. `useNodeTransform` 改窄订阅
   - 现状：订阅整个 `nodeSelectionAtom` 判断是否选中。
   - 建议：按 nodeId 使用 `selectAtom` 仅订阅布尔选中位。
   - 文件：`packages/whiteboard-react/src/node/hooks/useNodeTransform.tsx:124`
   - 参考：`packages/whiteboard-react/src/node/hooks/useNodeSelectionFlags.ts:11`

4. 稳定 `useEdgeConnectRuntimeSync` 的 runtime 注册
   - 现状：依赖 `edgeConnect` 对象引用，effect 可能频繁执行。
   - 建议：输出稳定 API + 内部 ref，减少 runtime set 抖动。
   - 文件：`packages/whiteboard-react/src/edge/lifecycle/useEdgeConnectRuntimeSync.ts:9`

5. `useInstanceCommands` 改稳定命令对象
   - 现状：依赖 selection/edgeConnect 变化反复 `setCommands`。
   - 建议：命令对象稳定化，内部通过 getter/ref 读取最新数据。
   - 文件：`packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts:18`

## CSS / 渲染可继续优化

1. Drag guides 使用非缩放线宽
   - 现状：辅助线未统一 `non-scaling-stroke`。
   - 建议：补齐，避免缩放下线宽视觉变化。
   - 文件：`packages/whiteboard-react/src/node/components/DragGuidesLayer.tsx:21`

2. Edge hover 改为 CSS 优先
   - 现状：hover 走全局 atom，易引发全层重渲染。
   - 建议：hover 视觉态优先 `:hover`；状态仅保留业务必需字段。
   - 文件：
     - `packages/whiteboard-react/src/edge/hooks/useEdgeHover.ts:6`
     - `packages/whiteboard-react/src/edge/components/EdgeLayer.tsx:36`

3. 控制点 hover 去 state 化
   - 现状：`hoverIndex` 使用 React state 驱动。
   - 建议：改 CSS hover 态（active 仍可保留状态）。
   - 文件：`packages/whiteboard-react/src/edge/components/EdgeControlPointHandles.tsx:36`

4. Mindmap 按钮显隐改 CSS hover
   - 现状：`hoveredId` 管理节点 hover。
   - 建议：节点层使用 CSS hover 控制 action 显隐，减少状态更新。
   - 文件：
     - `packages/whiteboard-react/src/mindmap/components/MindmapTreeView.tsx:41`
     - `packages/whiteboard-react/src/mindmap/components/MindmapNodeItem.tsx:74`

5. Mindmap ghost 边框按 zoom 反缩放
   - 现状：ghost 边框是固定像素。
   - 建议：使用 `calc(... / var(--wb-zoom, 1))` 保持视觉一致。
   - 文件：`packages/whiteboard-react/src/mindmap/components/MindmapTreeView.tsx:329`

## 执行顺序建议

1. 先做“命名空间化改造（不增文件优先）”：在原有领域文件内完成 `state/actions/runtime` 导出分层。
2. 再做 P0 的订阅收敛与写路径收敛（interaction / selection / edgeConnect / nodeTransient）。
3. 再做 P1 的事件绑定与稳定引用优化。
4. 最后统一做 CSS 渲染策略补齐（drag guides / edge hover / mindmap hover/ghost）。

## 已落地（本轮）

1. 命名空间化 + 读写分离（同文件优先）
   - `interaction` 已落地：`useInteractionState` / `useInteractionActions` / `interaction`。
   - `selection` 已落地：`useSelectionState` / `useSelectionActions` / `useSelectionRuntime` / `selection`。
   - `edgeConnect` 已落地：`useEdgeConnectState` / `useEdgeConnectActions` / `edgeConnect`。

2. 事件绑定与高频路径优化
   - `useCanvasEventBindings` 已改为监听器固定注册 + 回调 ref 更新。
   - edge 模式 hover 更新已增加 rAF 节流，降低 pointermove 频率下的写入压力。

3. 去订阅化与稳定引用（P1）
   - `useCanvasHandlers` 已将 shortcut context 改为 runtime getter（不再直接订阅 context atom）。
   - `useShortcutRegistry` 已将可选节点读取改为 store getter（`canvasNodesAtom`），避免 registry 随节点变化重建。
   - `useInstanceCommands` 已改为稳定命令对象 + refs 读取最新状态/动作，减少 `instance.setCommands` 抖动。
   - `useEdgeConnectRuntimeSync` 已改为稳定 runtime facade + refs，减少 runtime 注册抖动。

4. 节点与控制点渲染优化（新增）
   - `useNodeTransform` 已按 `nodeId` 使用 `selectAtom` 订阅选中布尔位，避免订阅整个 selection 集合。
   - `EdgeControlPointHandles` 已移除 `hoverIndex` React state，改用 CSS `:hover/:focus-visible` 表达 hover 视觉态，减少 pointer 进入/离开触发的重渲染。

5. Edge hover 状态最小化（新增）
   - `EdgeLayer/EdgeItem` 已去掉 `hoveredEdgeId` 的 atom 驱动，改为 hit-path + CSS sibling 选择器实现 hover 视觉强化。
   - `useEdgeStyle` 已去除 `hovered` 参数，hover 视觉完全由 CSS 处理。
   - `hoveredEdgeIdAtom` 与 `useEdgeHover` 链路已移除，`useTransientLifecycle` 不再重置该状态。

6. Mindmap hover 去 state 化（新增）
   - `MindmapTreeView` 已移除 `hoveredId` 本地 state 与 enter/leave 回调，节点操作按钮显隐改由 CSS hover/focus-within 控制。
   - `MindmapNodeItem` 改为固定渲染 actions 容器（在非拖拽预览下），通过 `.wb-mindmap-node-actions` 类控制交互显隐。
   - 拖拽 ghost 边框改为 `calc(1px / var(--wb-zoom, 1))`，保持屏幕空间视觉一致。

7. 类型噪音清理（新增）
   - `shortcutManager` 的 chord 归一化拼接已修复字面量联合类型冲突。
   - `useCore` 的 `coreRef` 已显式初始化为 `null`，兼容当前 React 类型签名。

8. Core 类型链路清理（新增）
   - `mindmap/query.ts` 已补充显式类型，消除隐式 `any`。
   - `schema/index.ts` 默认值合并过程改用 `NodeInput/EdgeInput`，避免可选 `id` 与实体类型不兼容。
   - `mindmap/commands.ts` 的 `createFailure` 改为与泛型结果解耦，消除 `MindmapCommandResult<T>` 返回分支冲突。

9. Core 类型导出链路补齐（新增）
   - `types/core.ts` 已显式重导出 `Mindmap*` 相关类型，修复 `core/build|commands|model` 的导入断链。
   - `core/createCore.ts` 与 `core/commands.ts` 的 `createFailure` 已统一为失败类型返回，避免 `DispatchResult`/`DispatchFailure` 混淆。
