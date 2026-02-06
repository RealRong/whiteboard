# common/hooks 优化方案

## 目标
- 收敛公共 hook 数量与出口，避免“atom 包装器”泛滥。
- 统一 **实例驱动 runtime + UI 组合** 的模式：公共 hooks 更像“运行态入口”，组件/生命周期组合使用。
- 让 common/hooks 只保留“跨模块必须复用”的语义 hook，其余收敛为 internal。

## 现状问题（梳理）
1) **碎片化包装器过多**：`useViewGraph/useViewportStore/useSpacePressed/useShortcutContextValue` 等仅包一层 atom。
2) **层级依赖绕远**：`useCanvasHandlers` -> `useViewportInteraction` -> `useViewportControls`，而后两者仅被前者使用。
3) **职责边界不清**：一些 hooks 实际是“生命周期/事件组合器”，却被当成公共 hook 导出。
4) **重复语义**：`useNodeSize/useMindmapNodeSize` 只是 instance.config 的别名，但变成公共 hook。

## 最佳实践方向（与当前设计规范一致）
- **公共 hook 只保留“高层语义入口”**，低层工具和 atom wrapper 迁为 internal。
- **运行态由 instance 驱动**，公共 hook 主要提供访问入口（instance/config/viewport）。
- **事件/输入组合（handlers）不作为公共 API**，放到 lifecycle 或内部 hooks。

---

## 建议的结构重排

### A. Context & Config
- 保留：`useInstance`、`useDoc`。
- 新增（或替代）`useWhiteboardConfig`：统一返回 `nodeSize/mindmapNodeSize`，减少两个单独 hook。
- 可选：`useWhiteboardContext` 返回 `{ instance, doc, config }`，供上层组合使用。

### B. Viewport 体系
- **保留公共**：`useViewport`（负责 layout 计算 + instance.viewport.set）。
- **保留公共**：`useViewportStore`（可改名 `useViewportState`，只读 zoom/状态）。
- **改为 internal**：`useViewportControls` / `useViewportInteraction`（当前仅供 `useCanvasHandlers` 使用）。
- 如果需要对外开放“行为入口”，新增：
  - `useViewportActions`（封装 instance.commands.viewport.*）
  - `useViewportTransforms`（从 instance 获取 screenToWorld/worldToScreen）

### C. Canvas & Input
- `useCanvasHandlers` 属于“事件组合器”，建议移动到：
  - `common/lifecycle` 或 `common/hooks/internal/canvas`。
- `useShortcutContextValue` 仅被 `useCanvasHandlers` 使用，改为 internal 或直接内联。
- `useInteractionActions` 可与 `interactionAtom` 读合并为 `useInteraction`：返回 `{ state, update }`。

### D. Graph 视图
- `useViewGraph` 保留为公共入口（核心派生数据）。
- `useVisibleNodes` 当前不被使用，建议：
  - 删除，或
  - 移动为 `common/utils/graph` 的纯函数，避免成为 hook。

---

## 迁移步骤（建议顺序）
1. **裁剪 export 面**：
   - `common/hooks/index.ts` 只保留核心入口（instance/doc/core/viewport/viewGraph/config/interaction）。
2. **收敛 viewport 相关 hooks**：
   - 将 `useViewportControls/useViewportInteraction` 设为 internal，仅被 `useCanvasHandlers` 使用。
3. **合并 config 入口**：
   - 新增 `useWhiteboardConfig`，用它替代 `useNodeSize/useMindmapNodeSize` 的直接调用。
4. **Canvas handlers 内聚**：
   - `useCanvasHandlers` 迁移到 lifecycle 或 internal 目录，并在 `useWhiteboardLifecycle` 中使用。
5. **移除冗余/未使用 hook**：
   - `useVisibleNodes` 转 util 或删除。

---

## 建议导出清单（最终）
```
common/hooks (public)
- useInstance
- useDoc
- useCore
- useViewport
- useViewportStore (或 useViewportState)
- useViewGraph
- useInteraction (state+actions)
- useWhiteboardConfig (可选)
```

`common/hooks/internal`（非公开）
- useCanvasHandlers
- useViewportControls
- useViewportInteraction
- useShortcutContextValue
- useInteractionActions

---

## 示例：最佳模式使用方式
```ts
// 组件侧
const instance = useInstance()
const { nodeSize } = useWhiteboardConfig()
const viewGraph = useViewGraph()
const viewportState = useViewportStore()

// lifecycle 侧
const { handlers, onWheel } = useCanvasHandlers({
  tool,
  viewport,
  viewportConfig
})
```

---

## 风险与注意事项
- 公共 API 收敛属于破坏性变更，需要同步更新对外导出和使用方。
- `useViewport` 仍有 ResizeObserver 副作用，属于 layout runtime，仍需由 Whiteboard 层驱动（符合规范）。
- 不要把 `useCanvasHandlers` 变成“mega hook”；它只组合 handlers，不执行绑定。

