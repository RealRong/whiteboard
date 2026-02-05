# 事件监听集中绑定方案（不在 hook 内部注册）

目标：把全局/容器级事件监听的注册统一提升到顶层 `useEffect`，hooks 只提供状态与处理函数，不直接 `addEventListener`。这样能减少副作用分散、提升可控性，并符合“组件不直接接触 atom / 副作用”的规范。

## 统一的 hook 规范（新增）
**hook 只负责：读取/写入数据、组合业务 API 和 renderer，不接触生命周期与副作用。**
生命周期与副作用统一由组件或专门的 lifecycle 模块导入业务 hook 来做。

> 规则：hook 内不应出现 `useEffect/useLayoutEffect` 做副作用（除非是纯计算的 memo/ref 同步）。

## 当前迁移状态（完成项）
- `common/hooks`、`node/hooks`、`edge/hooks` 已清理 `useEffect/useLayoutEffect`（业务 hooks 纯化）
- 已迁移到 lifecycle 的模块：
  - `common/lifecycle/useCanvasEventBindings`
  - `common/lifecycle/useSpacePressedLifecycle`
  - `common/lifecycle/useViewportSize`
  - `node/lifecycle/useGroupAutoFit`
  - `node/lifecycle/useNodeSizeObserver`
  - `edge/lifecycle/useEdgeConnectLifecycle`
  - `common/shortcuts/lifecycle/useShortcutRegistry`
  - `common/shortcuts/lifecycle/useShortcutStateSync`
  - `common/lifecycle/useSelectionNotifications`
  - `common/lifecycle/useEdgeSelectionNotifications`

## 监听注册点（已迁移到 lifecycle）
以下监听已从 hooks 迁移到 lifecycle 层，集中注册/清理：
- `common/lifecycle/useSpacePressedLifecycle`（window keydown/keyup）
- `edge/lifecycle/useEdgeConnectLifecycle`（window pointermove/pointerup）
- `common/lifecycle/useCanvasEventBindings`（container pointer/wheel/keydown）
- `common/lifecycle/useViewportSize`（ResizeObserver）
- `node/lifecycle/useNodeSizeObserver`（ResizeObserver via service）

> `ResizeObserver` 统一视为 DOM 观察器，归入 lifecycle 层管理。

## 其他“hook 内副作用”的点（已清理）
此前在 hooks 内部的副作用已迁移或移除，包括：
- `useCore`（ref 同步改为 render 内赋值）
- `useGroupAutoFit`（迁移到 `node/lifecycle`）
- `useEdgeHover`（改为事件内更新）
- `useNodeViewState`（ref 同步改为 render 内赋值）
- `useSelectionNotifications` / `useEdgeSelectionNotifications`（迁移到 `common/lifecycle`）
- `useShortcutStateSync` / `useShortcutRegistry`（迁移到 `common/shortcuts/lifecycle`）

当前 hooks 目录应保持 **无 useEffect/useLayoutEffect**。

## 统一设计原则
1. **hook 不注册事件监听**：hook 只返回 state/actions/handlers，不执行 `addEventListener`。
2. **hook 不做副作用**：不执行 `core.dispatch`、不触发外部回调、不注册 observer。
3. **顶层统一注册**：由 Whiteboard 或统一的 `useWhiteboardLifecycle` 在顶层 `useEffect` 里集中处理。
4. **监听分层**：区分 window/container/document 三类事件源；各自聚合。
5. **稳定引用**：hook 内 `handlers` 必须 `useCallback`/`useMemo` 稳定化，避免重复解绑/绑定。

## 推荐的 API 形态
### 1) hook 返回“可绑定的监听函数集合”
- `useSelection()`：
  - `handlers`：`onPointerDown/onPointerMove/onPointerUp`（容器级）
  - `windowListeners`：`keydown/keyup`（空格拖拽相关）
- `useEdgeConnect()`：
  - `windowListeners`：`pointermove/pointerup`（仅当 connecting 时生效）
- `useViewportControls()`：
  - `windowListeners`：`keydown/keyup`（空格启用平移）
  - `containerHandlers`：`pointerdown/move/up/wheel`

### 2) 顶层统一绑定（示意）
- 顶层收集来自多个 hook 的 `windowListeners` / `containerHandlers`，合并后统一注册。
- 规则：
  - 同类型监听按优先级执行（如 shortcut > viewport > selection）。
  - 只在依赖变化时更新。

## 合并/聚合策略
- **同事件合并**：提供 `mergeHandlers([...])`，按顺序执行。
- **条件绑定**：如 `edgeConnect.state.isConnecting` 才绑定 pointermove/pointerup。
- **清理集中化**：顶层 `useEffect` return 中统一 cleanup。

## ResizeObserver 的处理
- 统一通过“服务层/顶层 effect”绑定：
  - `useViewport` 不直接 new `ResizeObserver`，而是返回 `onResize`/`bindResizeObserver`。
  - `nodeSizeObserverService` 继续由 instance service 管理，但触发入口在顶层。

## 迁移步骤建议
1. 在 Whiteboard 顶层建立 `useWhiteboardLifecycle`（或直接放在 Whiteboard `useEffect`）。
2. 将 `useSelection/useEdgeConnect/useViewportControls/useCanvasEventBindings` 的监听注册下移到顶层。
3. hooks 改为“仅提供 handlers”，不再调用 `instance.addWindowEventListener`。
4. 将 `useGroupAutoFit/useEdgeHover/useSelectionNotifications` 等副作用迁移到生命周期层。
5. `ResizeObserver` 统一由顶层绑定或 service 触发，hook 中只返回回调。

## 预期收益
- 事件流入口明确、可调试。
- hook 变为纯逻辑/状态提供者，职责更清晰。
- 便于做“全局事件优先级/截断”策略。
