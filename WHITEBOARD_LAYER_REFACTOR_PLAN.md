# Whiteboard Layer 下放与原子化重构方案（禁用 React Provider）

目标：让 `packages/whiteboard-react/src/Whiteboard.tsx` 只保留“顶层/容器相关职责”，其他逻辑下放到各自 layer；共享状态通过 Jotai 原子与 derived atoms 获取，不使用 React Context Provider。

## 1. 核心原则
- **禁用 React Provider**：运行时共享一律通过 Jotai atoms/derived atoms。
- **白板顶层只做容器职责**：事件绑定、viewport 容器、快捷键入口、外部回调桥接。
- **计算型逻辑下放**：能放进 layer 的 hook 就放进 layer；跨 layer 依赖通过 derived atoms 共享。
- **原子粒度“语义化大块”**：避免过细拆分，按职责合并。

## 2. Whiteboard 顶层应保留的职责
仅保留以下几类：
1) **Core / Doc 管理**：`useCore` 维护 `core` 与 `docRef`。
2) **Viewport 与容器事件**：`useViewport` + `useViewportInteraction` + `useCanvasHandlers`。
3) **快捷键入口**：`useShortcutRegistry` / `useShortcutHandlers` / `useShortcutStateSync`。
4) **外部回调桥接**：`onSelectionChange` / `onEdgeSelectionChange`。

除此之外的 hooks（visibleNodes、edgeConnect、snap、groupAutoFit、nodeView 等）**不在 Whiteboard 顶层保留**。

## 3. 统一使用 Jotai：状态来源划分
### 3.1 基础原子（输入源）
这些由 Whiteboard 顶层写入：
- `docAtom`：当前 Document
- `docRefAtom`：docRef（可选，若需要跨层读取）
- `coreAtom`：Core 实例
- `containerRefAtom`：容器 ref
- `viewportAtom`：viewport（已存在，继续使用）
- `screenToWorldAtom`：坐标转换（可选）
- `toolAtom`：当前工具（已存在 selection.store.tool 或单独 atom）

### 3.2 Derived atoms（跨层共享计算）
- `nodeViewAtom`：临时态（拖拽中视图）
- `visibleNodesAtom`：含 `nodeMap / canvasNodes / mindmapNodes / visibleEdges`
- `edgeConnectAtom`：edge connect 状态 + actions（推荐 atom+actions 组合）
- `snapIndexAtom`：snap 候选索引与查询方法

说明：
- **Node/Edge 层都依赖 `visibleNodesAtom`**，避免重复计算。
- **edgeConnect 必须是共享源**，因为 Node 需要启动连接，Edge 需要渲染/重连。

## 4. Hooks 下放建议
### 4.1 可下放到 Edge layer
- `useEdgeConnectModel`：放入 `EdgeLayerStack`，但其状态/方法需通过 atom 共享给 Node。
- `useEdgeLayerModel`：放入 `EdgeLayerStack`，仅负责 edge 渲染组合。

### 4.2 可下放到 Node layer
- `useVisibleNodes`（建议改为 derived atom）
- `useGroupAutoFit`
- `useSnapIndex`
- `useNodeViewState`（变为 atom/derived，供 Edge 读取临时态）

## 5. Whiteboard 最小结构建议
Whiteboard 只做：
- 初始化 core / doc
- 绑定容器事件与 viewport
- 写入 doc/core/viewport/containerRef/tool 到 atoms
- 绑定快捷键入口
- 渲染 `<EdgeLayerStack />` / `<NodeLayerStack />` / `SelectionLayer` / `DragGuidesLayer`

## 6. 不使用 Provider 的具体替代方式
- 通过 `useSetAtom` 在 Whiteboard 内写入各类“输入原子”。
- 在各 layer 内直接 `useAtomValue` 读取需要的 derived atoms。
- 对于复杂 actions，提供 `useXxxActions()` hooks，内部只访问 atoms。

## 7. 迁移顺序建议
1) **建立基础输入原子**：doc/core/containerRef/viewport/tool。
2) **建立 derived atoms**：visibleNodes/nodeMap/visibleEdges/nodeView。
3) **EdgeConnect 原子化**：抽成 atom + actions，Node/Edge 共用。
4) **把 hooks 下放**：EdgeLayerStack/NodeLayerStack 自己组装。
5) **Whiteboard 顶层清理**：只保留容器级 hooks 和快捷键入口。

## 8. 风险与注意事项
- EdgeConnect 原子化时，确保 Node 与 Edge 共享同一份状态。
- visibleNodes 依赖 nodeView（临时态），要明确顺序：doc -> nodeView -> visibleNodes。
- 不要让 derived atoms 内部产生副作用（如直接 dispatch core）。副作用放到 actions hook。

---

结论：
- 现有 `runtime` 不必要，应改为 Jotai 输入原子 + derived atoms。
- Whiteboard 顶层只保留容器级职责。
- Edge/Node 层通过原子读取共享计算结果，避免 props 传递与重复计算。
