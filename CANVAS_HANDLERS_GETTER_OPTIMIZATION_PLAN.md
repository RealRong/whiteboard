# useCanvasHandlers Getter 化优化方案

## 1. 背景与目标

当前 `useCanvasHandlers` 已经在部分路径使用 `instance` getter（如 `shortcutContextAtom` 通过 `store.get`、edge hover 使用 `screenToWorld`），但仍存在一批会触发 React 订阅/重建的依赖，导致事件 handler 与渲染层耦合偏高。

本方案目标：

- 让 **事件处理链路（pointer / wheel / key）尽量不依赖 atom 订阅**，统一改为 `instance.state.get` / `instance.viewport.getter`。
- 把高频交互（drag / hover / zoom）下沉到 runtime helper / service 层（不强制挂到 `instance`），避免 React render 参与热路径。
- 保留 atom 在“需要驱动 UI 渲染语义”的位置，遵循 AGENTS.md 的 getter-first / CSS variable-first 原则。

> 前提：当前处于未发布阶段，可不考虑兼容性，按“一步到位”设计。

---

## 2. 现状链路（关键问题）

`useCanvasHandlers` 当前依赖链路：

1. `useCanvasHandlers`
2. `useViewportInteraction` -> `useViewportControls`
3. `useSelectionRuntime`
4. `useShortcutHandlers`

### 2.1 已较优（可保留）

- `useShortcutHandlers` 允许注入 `getShortcutContext`，天然支持 getter 拉取。
- edge hover 更新通过 `instance.api.edgeConnect.updateHover(screenToWorld(point))`，方向正确。

### 2.2 主要耦合点

1. `useViewportControls`
   - 通过 `useSpacePressed()` 订阅 atom。
   - 使用 `viewport` props（`viewport.center/zoom`）驱动闭包重建。

2. `useSelectionRuntime`
   - 订阅 `nodeSelectionAtom/toolAtom/spacePressed/canvasNodes`。
   - `pointermove/pointerup` 判断依赖 `state.isSelecting`（渲染态），导致 handler 与 React state 强绑定。

3. `shortcutContextAtom`
   - 目前是聚合 atom，事件处理时虽然通过 getter 读取，但聚合设计容易扩散为“到处订阅大对象”。

---

## 3. 设计原则（针对 handlers）

1. **Handler 不订阅，按事件 getter 读取。**
2. **交互数学使用 runtime getter（viewport/query/state.get）。**
3. **仅 UI 语义使用 atom 订阅（显隐、高亮、面板状态）。**
4. **高频视觉缩放优先 CSS 变量，不走 React state 重渲染。**
5. **热路径副作用放 lifecycle/service，不放业务 hook。**

---

## 4. 一步到位重构方案

## 4.1 Canvas Handler 入口改造（保持顶层单点）

目标：把 `useCanvasHandlers` 从“组合多个订阅型 hook”改成“顶层组合 getter 化 handlers”，但**不额外挂载到 `instance`**。

建议：

- `useCanvasHandlers` 继续返回：
  - `onPointerDownCapture`
  - `onPointerDown`
  - `onPointerMove`
  - `onPointerUp`
  - `onWheel`
  - `onKeyDown`
- 在 `useCanvasEventBindings` / lifecycle 里直接绑定到 container。
- 当前仅单一消费者（canvas 容器事件）时，不引入 `instance.runtime.canvasHandlers` 或 `instance.api.canvasHandlers`。
- 只有出现第二消费者（如插件宿主、非 React 运行时）时，再评估上升到 `instance` 级别。

收益：

- 保持调用链最短，避免过度抽象。
- 达到 getter 化目标的同时减少 API 面。

## 4.2 Viewport 交互完全 getter 化

把 `useViewportControls` 迁移为 runtime handler（纯函数 + ref 状态）：

- `spacePressed`：改为 `instance.state.get(spacePressedAtom)` 事件时读取。
- `zoom/center`：改为 `instance.viewport.get()` / `instance.viewport.getZoom()`。
- `screenToWorld`：改为 `instance.viewport.screenToWorld(point)`。
- `dragRef` 仅记录 `start`, `startCenter`, `startZoom`，不依赖渲染闭包。

备注：`viewport` props 仍可用于文档初始化；交互中以 runtime getter 为准。

## 4.3 Selection Runtime 下沉（核心）

当前最难完全去订阅的点在 `useSelectionRuntime`。

建议拆为 handlers 内部 runtime helper（例如 `common/hooks/internal/runtime/selectionBoxRuntime.ts`，不挂到 `instance`）：

- 内部维护 transient 状态：`startRef`, `modeRef`, `isSelectingRef`, `rafRef`。
- 每次事件通过 getter 拉取：
  - `toolAtom`
  - `spacePressedAtom`
  - `canvasNodesAtom`
- 通过 `instance.api.selection.*` 同步 UI 所需 atom（如 selectionRect/isSelecting）。

重点：

- `isSelecting` 的“行为判断”使用 runtime ref；
- `isSelecting` 的“渲染语义”仍写回 atom。

这样可避免 `pointermove` 因 atom 订阅触发 handler 重建。

## 4.4 Shortcut Context 去聚合订阅化

短期：保留 `shortcutContextAtom`，但 handlers 仅用 getter。

一步到位建议：

- 将 `shortcutContextAtom` 改为“UI/调试用途”；
- 事件链路改为 `createShortcutContextGetter(instance)` 按需读取：
  - `interaction`
  - `tool`
  - `selection`
  - `edgeConnect`
  - `viewport.getZoom()`

避免在快捷键路径中依赖聚合大 atom。

## 4.5 Edge Hover 热路径优化

在 `onPointerMove` 的 edge hover 更新增加帧节流：

- 使用 runtime `rafPending` + 最后一点缓存；
- 每帧最多一次 `instance.api.edgeConnect.updateHover`；
- 坐标转换继续通过 `instance.viewport.screenToWorld`。

## 4.6 CSS 变量替代渲染驱动缩放

对仅视觉缩放元素（handle 大小、描边宽度、hover ring、图标字号）：

- 统一使用容器级 `--wb-zoom`；
- 样式用 `calc(... / var(--wb-zoom, 1))`；
- SVG 线条优先 `vectorEffect="non-scaling-stroke"`。

避免 zoom 改变时大量组件重渲染。

---

## 5. 迁移清单（按文件域）

### 5.1 重点改造文件

- `packages/whiteboard-react/src/common/hooks/internal/useCanvasHandlers.ts`
- `packages/whiteboard-react/src/common/hooks/internal/useViewportControls.ts`
- `packages/whiteboard-react/src/common/hooks/internal/useViewportInteraction.ts`
- `packages/whiteboard-react/src/node/hooks/useSelection.ts`
- `packages/whiteboard-react/src/common/shortcuts/useShortcutHandlers.ts`
- `packages/whiteboard-react/src/common/lifecycle/useCanvasEventBindings.ts`

### 5.2 建议新增模块


- `packages/whiteboard-react/src/common/hooks/internal/runtime/selectionBoxRuntime.ts`
- `packages/whiteboard-react/src/common/hooks/internal/runtime/viewportInteractionRuntime.ts`
- `packages/whiteboard-react/src/common/hooks/internal/runtime/shortcutContextGetter.ts`

说明：

- 这批模块作为 `useCanvasHandlers` 的内部 runtime helper 组合，不默认挂载到 `instance`。
- `whiteboardInstance.ts` 仍用于跨模块共享能力（api/commands/query/runtime/services）的组合；单点容器 handlers 不强制进入 instance。

---

## 6. 验收标准

完成后应满足：

1. `useCanvasHandlers` 不再直接依赖 atom 订阅型 hooks（或仅保留薄 UI 语义依赖）。
2. pointermove / wheel / keydown 热路径中不发生 React state set。
3. viewport 交互数学全部来自 instance getter。
4. selection box 行为判断不再依赖渲染态 `state.isSelecting`。
5. zoom 视觉缩放以 CSS 变量为主，不把 zoom 透传到大量 props/hooks。
6. lint 通过：`pnpm -C packages/whiteboard-react lint`。

---

## 7. 风险与控制

主要风险：

- selection 行为从 hook 转 runtime 后，事件顺序和边界条件可能变化。
- shortcut context 去聚合后，某些历史快捷键可能读取字段不完整。

控制策略：

- 先保证行为等价，再做删除旧 hook；
- 迁移期以“单一实现”为原则，不保留双轨；
- 通过手动场景回归（拖拽、框选、space 平移、wheel 缩放、edge hover、快捷键）逐项验证。

---

## 8. 结论

结论是：`useCanvasHandlers` 完全可以朝“无 atom 订阅的 handler 层”演进，而且与当前 instance/query/runtime 方向一致。真正需要保留 atom 订阅的，只应是 UI 渲染语义层，而不是事件处理热路径。
