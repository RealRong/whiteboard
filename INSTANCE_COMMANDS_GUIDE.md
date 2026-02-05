# Instance Commands 清单与边界

目标：把“跨模块的命令式操作”集中到 instance 上，减少模块间直接依赖，但**不让 instance 承载 UI 状态**。

## 总原则
- **instance 只提供命令入口，不存 UI 状态**。
- UI 状态继续由 atom 承担（selection/hover/drag 等）。
- instance 负责调用 core.dispatch 或调度复杂动作（命令式）。
- 任何依赖 React 生命周期/渲染的逻辑，不应进 instance。

## 推荐挂载的命令类型（适合 instance）

### 1) Viewport / Camera
- `zoomIn()` / `zoomOut()` / `setZoom(zoom)`
- `panBy(dx, dy)` / `panTo(point)`
- `fitToViewport(rect)` / `focusOn(nodes)`

### 2) Selection（命令式操作）
- `select(ids, mode)`
- `clearSelection()`
- `toggleSelection(ids)`
> 注意：selection 状态仍在 atom，instance 只是触发更新。

### 3) Edge Connect / Edge 操作
- `startEdgeConnect(source)`
- `cancelEdgeConnect()`
- `commitEdgeConnect(target)`
- `selectEdge(id)`

### 4) Tool / Interaction
- `setTool(tool)`
- `resetInteraction()`
- `clearHover()`

### 5) 基础 CRUD（Node/Edge）
- `createNode(payload)` / `updateNode(id, patch)` / `deleteNode(id)`
- `createEdge(payload)` / `updateEdge(id, patch)` / `deleteEdge(id)`

### 6) 历史与剪贴板（如果存在）
- `undo()` / `redo()`
- `copySelection()` / `paste()`

## 不建议放在 instance 的内容
- 高频 UI 状态：`hover` / `selectionRect` / `dragGuides` / `isDragging`
- 组件级渲染逻辑、DOM 测量与绘制相关逻辑
- 需要 React 生命周期保证一致性的行为

## 适配方式建议
- instance 内部只持有 core / docRef / containerRef
- commands 层调用 core.dispatch 或触发 atom 的 setter（通过注入方式）
- UI 逻辑仍由 hooks/atoms 管理

## 为什么这样做
- 命令式 API 有助于统一入口、降低跨模块耦合
- 保持 UI 状态的可追踪性与一致性（仍在 atom）
- 避免把 instance 变成隐式 state store

