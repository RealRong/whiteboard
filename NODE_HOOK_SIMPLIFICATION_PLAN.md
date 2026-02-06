# Node Hooks 简化方案

## 目标
- 降低 hook 数量与认知负担，减少“仅包一层 atom”类碎片 hook。
- 按职责合并：**渲染模型**、**交互模型**、**Layer 运行态**三条线清晰。
- 组件不直接读写 atom，统一由语义 hook 输出 state/actions。
- Hook 只做状态读取/写入与业务 API 组合，不做生命周期副作用。

## 现状问题（简要）
- NodeItem 专用 hook 被拆得过细（`useNodeSelected/useNodeRect/useNodeStyle/...`），仅在单一组件内使用却作为公共导出。
- NodeLayerStack 依赖多个“atom wrapper”hook（`useDragGuides/useSnap/useNodeTransient/useViewNodesStore`），分散职责。
- `useNodeDrag` 与 `useNodeInteraction` 强耦合，拆成两个导出意义不大。
- `useSnapIndex` 作为纯计算 hook，语义更像 util。

## 简化方向（职责整合）
### 1) NodeItem 渲染模型合并
**目标：NodeItem 只保留 2~3 个语义 hook。**

建议合并为：
- `useNodePresentation(node)`（或 `useNodeRenderModel` 重构扩展）
  - 内聚：`definition/canRotate`、`rect`、`selected`、`hoveredGroup`、`hoverHandlers`、`nodeStyle/rotationStyle`、`renderProps/containerProps/content`。
  - 产出：`{ rect, definition, selected, hovered, canRotate, containerProps, renderProps, content }`。
- 保留：`useNodeInteraction`（交互）
- 保留：`useNodeTransform`（旋转/缩放）

**可移除/内部化**：
- `useNodeSelected`
- `useNodeGroupHover`
- `useNodeHoverHandlers`
- `useNodeRect`
- `useNodeStyle`
- `useNodeRenderModel`（若合并到新的 `useNodePresentation`）

> 这些 hook 目前仅被 `NodeItem` 使用，可移至 `node/hooks/internal` 并从 public index 中移除。

### 2) 交互模型合并
- 将 `useNodeDrag` 作为 `useNodeInteraction` 的内部实现（同文件内私有 hook）。
- `useNodeInteraction` 成为唯一对外导出的节点交互 hook（包含：拖拽、选择、edge connect）。

### 3) Layer 运行态合并
**目标：NodeLayerStack 只依赖 2~3 个 runtime hook。**

建议合并为：
- `useNodeViewRuntime(nodes, core)`
  - 组合 `useNodeViewState + useViewNodesStore + useNodeTransient`
  - 输出：`{ viewNodes, transient, setViewNodes }`
- `useSnapRuntime(nodes, nodeSize)`
  - 组合 `useSnapIndex + useDragGuides + snapRuntimeAtom`
  - 输出：`{ snapCandidates, getCandidates, guides, setGuides, snapRuntime }`
- `useGroupRuntime(nodes, nodeSize, padding)`
  - 维持现有 `useGroup` 语义，但返回 `setHoveredGroupId` 等 actions

**可移除/内部化**：
- `useDragGuides`
- `useNodeTransient`
- `useViewNodesStore`
- `useSnapIndex`（改为 util 或被 `useSnapRuntime` 内部消费）
- `useSnap`（若 `useSnapRuntime` 已返回完整 runtime）

### 4) Export 面收敛
建议 `node/hooks/index.ts` 仅导出必要公共 API：
- `useSelection`
- `useNodeInteraction`
- `useNodeTransform`
- `useNodePresentation`（或重构后的 `useNodeRenderModel`）
- `useNodeViewState`（若外部需要）

其余 hook 移至 `node/hooks/internal/*` 或 `node/hooks/layer/*`，不再对外暴露。

## 建议的目录结构
```
node/
  hooks/
    index.ts                  // 仅导出公共 API
    item/
      useNodePresentation.ts
      useNodeInteraction.ts
      useNodeTransform.tsx
    layer/
      useNodeViewRuntime.ts
      useSnapRuntime.ts
      useGroupRuntime.ts
    internal/
      useNodeDrag.ts
      useNodeStyle.ts
      useNodeRect.ts
```

## 迁移步骤（建议顺序）
1. 新增 `useNodePresentation`，在 NodeItem 中替换 `useNodeRect/useNodeSelected/useNodeGroupHover/useNodeHoverHandlers/useNodeStyle/useNodeRenderModel`。
2. 将 `useNodeDrag` 内聚到 `useNodeInteraction` 文件内，不再从 index 导出。
3. 新增 `useNodeViewRuntime/useSnapRuntime`，替换 NodeLayerStack 现有 runtime hook 组合。
4. 删除或内移多余 hooks，并收敛 `node/hooks/index.ts` 的导出。
5. 更新相关引用与文档说明。

## 风险与注意事项
- 外部若直接使用了被移除的 hook（公共 API），会有破坏性变更；当前允许破坏性变更，但需同步更新示例与文档。
- 合并后的 hook 需避免变成“mega hook”，保持职责边界清晰（渲染/交互/运行态）。
- 保持“hook 不做生命周期副作用”的规范，副作用仍由组件或 lifecycle 层处理。

