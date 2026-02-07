# whiteboard-react 跨模块状态盘点与优化建议

> 依据：`AGENTS.md` 中的状态管理准则（Jotai 共享状态、组件不直接访问 atom、Hook 纯语义、生命周期与副作用分层、runtime 行为实例化）。

## 1. 盘点范围与“跨模块”定义

- 范围：`packages/whiteboard-react/src/common|node|edge|mindmap`。
- “跨模块 state”定义：
  - 在多个业务域（`common/node/edge/mindmap`）之间读写；或
  - 虽定义在单域，但作为上游派生/运行时输入，影响其他域行为。
- 重点对象：Jotai atom；补充少量“非 atom 但有跨模块影响”的 React/instance 运行时状态。

---

## 2. 重要跨模块状态清单

## 2.1 核心上下文状态（Context）

| 状态 | 定义位置 | 主要写入入口 | 主要读取入口 | 说明 |
|---|---|---|---|---|
| `docAtom` | `packages/whiteboard-react/src/common/state/whiteboardContextAtoms.ts` | `useWhiteboardContextHydration`（lifecycle hook） | `viewNodesAtom`、切片派生链路、`useDoc`（Node/Mindmap） | 全局文档单一事实源（SSOT） |
| `instanceAtom` | 同上 | `useWhiteboardContextHydration`（lifecycle hook） | `useInstance`（common/node/edge/mindmap 广泛依赖） | 运行时实例入口（core、services、viewport runtime、shortcut manager） |

## 2.2 交互与工具状态（Interaction）

| 状态 | 定义位置 | 主要写入入口 | 主要读取入口 | 说明 |
|---|---|---|---|---|
| `toolAtom` | `common/state/whiteboardAtoms.ts` | `useToolLifecycle`、`useInstanceCommands` | Node/Edge/Shortcut 上下文 | 当前工具态（`select/edge`） |
| `nodeSelectionAtom` | 同上 | `useSelection`、`useNodeInteraction` | Node 选区/UI、Shortcut 上下文 | 节点选中 + 框选态 |
| `edgeSelectionAtom` | 同上 | `useEdgeConnect.selectEdge`、节点选择清空联动 | Edge/UI、Shortcut 上下文 | 边选中态 |
| `interactionAtom` | 同上 | `useInteraction.update`（快捷键、hover 等） | `shortcutContextAtom`、边 hover 同步 | 焦点/指针/hover 统一状态 |
| `spacePressedAtom` | 同上 | `useSpacePressedLifecycle`（window keydown/up） | `useSelection`、`useViewportControls` | 空格拖拽画布模式开关 |
| `viewportAtom` | 同上 | 无显式写入（由 `docAtom.viewport` 派生） | `shortcutContextAtom` | 文档视口单源（`center + zoom`） |
| `edgeConnectAtom` | 同上 | `useEdgeConnect` | Edge 预览/重连、`shortcutContextAtom` | 连线过程态（from/to/hover/reconnect/pointerId） |
| `shortcutContextAtom`（派生） | 同上 | 无直接写入（derived） | `useCanvasHandlers` -> `shortcutManager` | 聚合 platform/focus/tool/selection/pointer/viewport/edgeConnect |

## 2.3 文档派生视图状态（Graph）

| 状态 | 定义位置 | 依赖 | 主要消费者 | 说明 |
|---|---|---|---|---|
| `viewNodesAtom` | `node/state/viewNodesAtom.ts` | `docAtom` + `nodeViewOverridesAtom` | `groupRuntimeDataAtom`、派生切片 atom | 将“临时覆盖”合并到节点视图 |
| `nodeOrderAtom` / `edgeOrderAtom` | `common/state/whiteboardDerivedAtoms.ts` | `docAtom` | 顺序相关派生链路 | 渲染顺序派生 |
| `visibleNodesAtom` / `canvasNodesAtom` / `visibleEdgesAtom` / `nodeMapAtom` | 同上 | `orderedViewNodesAtom`、`docAtom` | `useCanvasNodes/useVisibleEdges/useNodeMap` | 折叠组过滤 + 画布节点过滤 + 快速索引 |

## 2.4 Node/Edge 运行时辅助状态

| 状态 | 定义位置 | 主要消费者 | 说明 |
|---|---|---|---|
| `nodeViewOverridesAtom` | `node/state/nodeViewOverridesAtom.ts` | `useNodeTransient`、`viewNodesAtom` | 拖拽/编排时临时位置尺寸覆盖 |
| `groupRuntimeDataAtom` / `groupHoveredAtom` / `groupRuntimeAtom` | `node/state/groupRuntimeAtom.ts` | `useGroupRuntime`、`useNodePresentation`、`useNodeInteraction`、`snapRuntimeDataAtom` | 分组运行时输入 + hover 组态 |
| `snapRuntimeDataAtom` | `node/state/snapRuntimeAtom.ts` | `useSnapRuntime`、`useNodeInteraction`、`useNodeTransform` | 吸附候选与阈值 |
| `dragGuidesAtom` | `node/state/dragGuidesAtom.ts` | `useDragGuides`、`DragGuidesLayer` | 吸附辅助线 |
| `instance.services.edgeConnectRuntime` | `common/instance/whiteboardInstance.ts` | `useEdgeConnectRuntimeSync`（lifecycle） | `useEdgeConnectRuntime`（Node 侧） | edge runtime service 化，脱离 atom |

## 2.5 非 atom 但有跨模块影响的状态

| 状态 | 位置 | 影响 |
|---|---|---|
| `useViewportRuntime` 的 `size`（React state） | `common/hooks/useViewportRuntime.ts` | 通过 `instance.viewport.set()` 更新 screen/world 映射，并在容器注入 `--wb-zoom`，Node/Edge/Mindmap 都依赖 |
| `whiteboardInstance.viewport` 内部快照（可变闭包状态） | `common/instance/whiteboardInstance.ts` | runtime 级共享读写，不走 React/Jotai；对交互几何计算关键 |
| `useEdgeHover` 的 `hoveredEdgeId`（atom 派生读取） | `edge/hooks/useEdgeHover.ts` | 已统一读取 `hoveredEdgeIdAtom -> interactionAtom.hover.edgeId` 单源 |

---

## 3. 对照 AGENTS 准则的关键问题

1. **组件直接操作 atom（与准则冲突，已修复）**
   - 已由 `useWhiteboardContextHydration` 替代 `Whiteboard.tsx` 直接 `useHydrateAtoms`。
   - 已由 `useEdgeConnectRuntimeSync` + instance service 替代组件直写 atom。

2. **`selectionAtom` 职责过载（已拆分）**
   - 已拆为 `toolAtom + nodeSelectionAtom + edgeSelectionAtom`。
   - 状态更新影响面已按职责切分。

3. **存在“状态双源/同步态”（已收敛）**
   - 已删除 `useShortcutStateSync`。
   - `viewportAtom` 改为从 `docAtom.viewport` 派生（`center + zoom`）。
   - zoom 策略收敛：视觉层用 CSS 变量 `--wb-zoom`，交互计算层用 `instance.viewport.getZoom()` 即时读取。
   - `tool` 同步由独立 `useToolLifecycle` 负责。

4. **跨域 runtime 对象放入 atom（已下沉）**
   - `edgeConnectRuntimeAtom` 已移除。
   - runtime 通过 `instance.services.edgeConnectRuntime` 管理。

5. **派生逻辑重复（部分已修复）**
   - `groupRuntimeDataAtom` 已复用 `canvasNodesAtom`，消除可见性过滤重复。

6. **局部 hover 与全局 hover 并存（已修复）**
   - `useEdgeHover` 已改为只读写 `hoveredEdgeIdAtom`。
   - Edge hover 状态与 `interactionAtom` 统一为单源。

---

## 4. 面向 whiteboard 的优化方案（按 AGENTS 设计准则）

## 4.1 目标分层

- **Domain 1：文档/实例上下文**
  - 保留 `docAtom`、`instanceAtom`。
  - 组件不直接碰 atom：新增 `useWhiteboardContextHydration`（hook）封装 hydration。

- **Domain 2：交互控制状态**
  - 拆分 `selectionAtom` 为“按责任聚合”的 3 组：
    - `toolAtom`
    - `nodeSelectionAtom`（selected ids + box state + mode）
    - `edgeSelectionAtom`（selectedEdgeId）
  - 不是“过细 atom family”，而是语义域拆分，符合“按职责聚合”。

- **Domain 3：视图派生状态**
  - 以切片 atom/hook 为主（`useCanvasNodes`、`useVisibleEdges`、`useNodeMap`），避免聚合大对象订阅。
  - 统一折叠组过滤逻辑为单一 helper，`groupRuntimeDataAtom` 复用 `canvasNodesAtom` 派生。

- **Domain 4：runtime/副作用状态**
  - `edgeConnectRuntimeAtom` 下沉到 instance service（如 `instance.services.edgeConnect` 注册/读取）。
  - 生命周期 hook 负责注册与清理，Node 侧通过 `useInstance` 取 runtime 接口。
  - 这更贴近 AGENTS 的“instance/services 管副作用，hook 保持纯语义”。

## 4.2 具体优化动作（无兼容约束，直接替换）

### P0（已完成）

1. 已新增 `useWhiteboardContextHydration` 并接入。
2. 已新增 `useEdgeConnectRuntimeSync`，并迁移到 instance service。
3. 已拆分选择态为 `toolAtom/nodeSelectionAtom/edgeSelectionAtom`。
4. 已移除 `useShortcutStateSync`，并完成 viewport 分层：
   - 文档态：`viewportAtom`（`center + zoom`）
   - 视觉态：`--wb-zoom`（由 `useViewportRuntime` 注入）
   - runtime 几何态：`useViewportRuntime` + `instance.viewport`（`getZoom/screenToWorld/worldToScreen`）
   - 视觉变量已覆盖 Node/Edge/Mindmap 高频交互元素（handles/preview lines/add buttons 等），缩放时优先走 CSS 计算。

### P1（已完成）

1. ✅ 已完成：`groupRuntimeDataAtom` 复用 `canvasNodesAtom`。
2. ✅ 已完成：`useEdgeHover` 统一到 `interactionAtom.hover.edgeId` 单源。
3. ✅ 已完成：新增 `useCanvasNodes/useVisibleEdges/useNodeMap` 并替换主要消费点。
4. ✅ 已完成：移除 `useViewGraph` 与 `viewGraphAtom`，收口为切片状态访问。

### P2（下一批直接落地）

1. ✅ 已完成第一阶段：
   - `viewNodesAtom` 引入按 `doc` + `override 变更集合` 的增量缓存更新；
   - `useNodeTransient` 增加 no-op 写入过滤（set/clear/commit）。
2. ✅ 已完成第二阶段（命名与清理规范）：
   - 增加瞬态语义别名：`edgeConnectTransientAtom`、`dragGuidesTransientAtom`、`groupHoveredTransientAtom`、`nodeViewOverridesTransientAtom`；
   - 增加统一清理生命周期 `useTransientLifecycle`，在 whiteboard 卸载时清空所有瞬态状态。
3. ✅ 已完成第三阶段（Node 交互职责拆分）：
   - 将 `useNodeDrag` 从 `useNodeInteraction` 内部实现中独立为 `node/hooks/useNodeDrag.ts`；
   - 新增 `node/runtime/drag/` 策略目录（`plainNodeDragStrategy`、`groupNodeDragStrategy`、`selectNodeDragStrategy`）；
   - `useNodeDrag` 收敛为薄编排壳：仅维护 pointer session、snap 计算、策略分发；
   - `useNodeInteraction` 仅保留工具路由、选择策略与事件编排。
4. ✅ 已完成第四阶段（副作用生命周期收口）：
   - `NodeLayerStack` 退役，Node 渲染改为直接使用 `NodeLayer`；
   - `useGroupAutoFit` 迁移到 `useNodeLifecycle`，由 `useWhiteboardLifecycle` 统一编排；
   - `useEdgeConnectLifecycle` 与 `useEdgeConnectRuntimeSync` 迁移到 `useEdgeLifecycle`，从 `EdgeLayerStack` 副作用剥离；
   - `useViewportRuntime` 的容器 `ResizeObserver` 下沉为 `containerSizeObserverService`（instance service），hook 仅做状态编排；
   - `useWhiteboardLifecycle` 卸载时统一释放 observer/service 资源（node/container observer + edge runtime 清理）。
5. ✅ 已完成第五阶段（P1 性能项补齐）：
   - `useGroupAutoFit` 增加变更感知：仅对脏 group 及其祖先 group 执行 auto-fit，避免每次 nodes 变更全量扫描；
   - Edge 模式 `updateHover` 增加 `requestAnimationFrame` 节流与重复值跳过，降低高频 pointermove 下的状态写入与重算。
6. ✅ 已完成第六阶段（Node 链路可读性与订阅粒度优化）：
   - `useNodeInteraction` 改为写路径订阅（`useSetAtom`）并统一输出 `containerHandlers`，减少无效订阅与事件拼装分散；
   - `useNodePresentation` 收敛为纯展示查询（移除交互注入），并通过 `useNodeSelectionFlags` 对 selected/hovered 做窄订阅；
   - `NodeItem` 改为显式合并 presentation + interaction，再统一构造 `renderProps` 与内容渲染，组件职责更清晰。
7. 下一阶段：评估是否需要将 `nodeViewOverrides` 继续拆为更细粒度结构（仅在极大文档下）。

---

## 5. 直接实施顺序（不考虑兼容）

1. 已完成组件直连 atom 移除。
2. 已完成 `selectionAtom` 直接拆分（无兼容层）。
3. 已完成 viewport/tool 单源化。
4. 已完成 edge runtime service 化 + group 计算复用。

下一步建议直接做：

1. 对 `nodeViewOverrides` 做压力基准（大文档拖拽）决定是否继续细拆。
2. 评估是否需要将 `nodeOrder/edgeOrder` 再切分为按需 hook（当前保留 atom 即可）。
3. 评估是否要把 group auto-fit 进一步下沉为纯计算 service（hook 仅负责触发与提交）。
4. 评估是否要将 `nodeSelectionAtom` 的读模型进一步拆成 node 级 selector family（极大画布下）。

这样可以在不打断现有交互的前提下，逐步达到 AGENTS 目标架构：

- 共享状态集中在 Jotai，职责清晰；
- 组件只做组合，不直接读写 atom；
- hooks 语义化且纯；
- lifecycle/service 承担副作用与 runtime 集成。
