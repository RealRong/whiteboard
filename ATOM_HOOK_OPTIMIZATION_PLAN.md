# Atom 与 Hook 优化方案（组合式 hooks）

> 目标：组件不直接读写 atom，统一通过 hooks 获取 state/actions；hooks 语义化、单一职责；组件内组合多个 hooks 直接渲染（不需要“大模型 hook”）；atom 按职责聚合，避免过度拆分。

## 现状扫描（直接在组件中使用 atom 的点）
- `packages/whiteboard-react/src/Whiteboard.tsx`
  - `selectionAtom`、`shortcutContextAtom`
- `packages/whiteboard-react/src/node/components/NodeLayerStack.tsx`
  - `whiteboardInputAtom`、`nodeSizeAtom`、`mindmapNodeSizeAtom`、`viewGraphAtom`、`selectionAtom`、`viewportAtom`
- `packages/whiteboard-react/src/edge/components/EdgeLayerStack.tsx`
  - `whiteboardInputAtom`、`nodeSizeAtom`、`viewGraphAtom`、`selectionAtom`、`viewportAtom`
- `packages/whiteboard-react/src/node/components/DragGuidesLayer.tsx`
  - `dragGuidesAtom`
- `packages/whiteboard-react/src/node/components/SelectionLayer.tsx`
  - `selectionAtom`

> 结论：组件内仍存在直接 atom 读取，需改为“组合式 hooks”。

---

## Atom 合并与职责分区（保持现有方向）
### 1) 输入类（可写大 atom）
- `whiteboardInputAtom` 作为唯一写入口
- 子 selector 仅供 hooks 内部使用，不在组件中直接读取

### 2) 尺寸类（独立高频）
- `nodeSizeAtom` / `mindmapNodeSizeAtom` 保持独立
- 只允许在 hooks 内读取

### 3) 视图派生类（只读组合）
- `viewGraphAtom` 作为唯一读入口
- 组件只读 `viewGraphAtom` 对应的 hooks

### 4) 高频交互类（独立）
- `selectionAtom` / `viewportAtom` / `edgeConnectAtom` / `interactionAtom` 保持独立
- 组件只通过 hooks 读取

---

## 核心风格：组合式 hooks
**组件内部组合多个职责 hook，而不是一个“模型 hook”。**

示例（EdgeLayerStack）
```
const connect = useEdgeConnect()
const selection = useEdgeSelection()
const preview = useEdgePreview()
return (
  <>
    {connect.renderPreview()}
    {selection.renderHandles()}
  </>
)
```

关键点：
- 每个 hook 单一职责，返回 **state + actions + render helpers**
- 组件只组合 hooks，不传冗长 props
- hook 命名语义化，不使用 `useXxxState/useXxxModel`

---

## 渲染职责边界（hook vs 组件）
- hook 负责“取数 + 行为 + 轻量 render helper”，避免在 hook 内堆复杂 JSX
- 复杂 UI 优先拆成小组件，hook 返回 props/state/actions
- 允许 render helper，但应保持为“薄组件 + props”或小块渲染
- 大组件负责组合 hooks 与小组件，保持可读性与可维护性
- 判断标准：若 hook 内出现大段 JSX 或难复用逻辑，说明应下沉组件

---

## 建议的 hooks 颗粒度（示例）

### Edge 侧
- `useEdgeConnect`：连接状态 + 操作 + 预览渲染
- `useEdgeSelection`：选中边状态 + 选中可视化
- `useEdgeEndpoints`：端点 handle 渲染与交互
- `useEdgeControlPoints`：控制点渲染与交互
- `useEdgeGeometry`：路径计算（纯逻辑 hook）

### Node 侧
- `useNodeSelection`：节点选择行为
- `useNodeDrag`：节点拖拽
- `useGroupHover`：组 hover
- `useMindmapLayer`：思维导图层数据与渲染
- `useSnapGuides`：吸附辅助线

### Whiteboard 侧
- `useWhiteboardRuntime`：初始化实例 + 输入写入
- `useWhiteboardShortcuts`：快捷键注册与执行
- `useWhiteboardEvents`：事件绑定（pointer/wheel/keyboard）

---

## 组件组合建议（示例）

### `EdgeLayerStack.tsx`
- 直接组合 hooks：
  - `const connect = useEdgeConnect()`
  - `const selection = useEdgeSelection()`
  - `const endpoints = useEdgeEndpoints()`
  - `const controlPoints = useEdgeControlPoints()`
  - `const preview = useEdgePreview()`
- JSX 中直接使用 `connect.renderPreview()`、`selection.renderLayer()` 等

### `NodeLayerStack.tsx`
- 直接组合 hooks：
  - `const selection = useNodeSelection()`
  - `const drag = useNodeDrag()`
  - `const mindmap = useMindmapLayer()`
  - `const snap = useSnapGuides()`
- JSX 中使用 render helpers

---

## Hook 封装建议（通用入口）
提供基础读取/动作 hook（不在组件里直接读 atom）：
- `useWhiteboardInput()`
- `useViewGraph()`
- `useSelectionStore()`
- `useViewportStore()`
- `useNodeSize()` / `useMindmapNodeSize()`
- `useShortcutContextValue()`
- `useInteractionActions()`

这些 hook 仅在其他 hooks 内部使用。

---

## 迁移顺序建议
1. 引入 `useWhiteboardInput/useViewGraph/useInteractionState`
2. 改造 EdgeLayerStack/NodeLayerStack 为组合式 hooks
3. 将 DragGuidesLayer/SelectionLayer 改为 `useDragGuides/useSelectionOverlay`
4. Whiteboard 使用 `useWhiteboardRuntime/useWhiteboardEvents` 代替 atom 读取

---

## 收益
- 组件可读性更强（像“功能清单”）
- hook 语义清晰，易复用
- atom 只在 hooks 内部出现
- 渐进式迁移成本低
