# 旧版 Node Hooks 风格提炼 + 新版重设计方案

## 旧版 hooks 设计风格（src/core/components/whiteboard/node/hooks）
### 1) **实例驱动、命令式操作**
- 几乎所有 hook 都以 `(node, instance)` 为输入，内部直接调用 `instance.*Ops` 或 `instance.emit` 完成行为。
- 逻辑偏“命令式”而非“响应式”，对 UI 状态变更或 side effect 直接发指令。

### 2) **行为分治：小型 handler 工厂**
- `useNodeDrag/useNodeResize/useGroupDrag` 等返回 `handleXxx` 函数，组件只负责绑定事件。
- `eventHandlers/contextMenuHandler/pointerHandler` 用“注册/卸载”函数显式挂载 DOM 事件。
- 逻辑按行为拆分（拖拽/缩放/菜单/擦除），而非按 UI 层级拆分。

### 3) **状态最小化、轻量局部缓存**
- 少量 `useRef` 用于拖拽/批处理缓存（如 `useGroupDrag`、`useNodeSize` 的队列）。
- 不依赖全局状态容器（atom），核心信息来自 instance 和 node。

### 4) **“事件流 + 运行时”机制**
- 节点拖拽、缩放通过 `instance.emit` 发出事件，外部统一处理（例如边更新、吸附、分组扩展等）。
- `instance.values` / `nodeOps` 提供“运行态能力”（实时盒子、节点函数、mindmap 扩展等）。

### 5) **性能策略**
- `useNodeSize` 使用队列批量更新，避免大量 ResizeObserver 同步操作。
- 拖拽过程中尽量更新运行态样式或 transient 数据，结束时再 commit。

**总结一句：**旧版风格更接近“命令式 runtime + handler 工厂”，以 instance 为中心，hooks 更像“行为模块”。

---

## 结合旧风格的新版设计模式描述
**模式名：Instance-Centric Action Hooks（实例中心的行为型 hook）**

### 核心原则
1) **hook 输出行为（actions/handlers），而非细粒度状态碎片**。
2) **数据与运行态来源统一为 instance + 少量原子 state**，不再层层透传。
3) **事件绑定在组件或 lifecycle 层**：hook 提供 handler，组件绑定；hook 不直接操作 DOM 事件生命周期。
4) **复杂交互被拆分为“动作链”而非“层级树”**：拖拽/缩放/吸附/分组作为动作链组合。

### 组织方式
- **Action Hooks**：`useNodeInteraction/useNodeTransform/useNodeResize`，只返回处理函数和必要运行态。
- **Runtime Hooks**：`useNodeRuntime/useSnapRuntime/useGroupRuntime`，聚合运行时数据 + 操作接口。
- **Presentation Hook**：`useNodePresentation` 聚合渲染态（style/rect/selected/hover）。

---

## 基于旧风格重新设计的新版 Hook 简化方案

### A. NodeItem 层（渲染）
**目标：只保留 2~3 个 hook**
- `useNodePresentation(node)`
  - 负责：definition、rect、selected、hoveredGroup、style、renderProps、containerProps。
- `useNodeInteraction(node, rect)`
  - 负责：选择、拖拽、edge connect、hover。
- `useNodeTransform(node, options)`
  - 负责：resize/rotate 交互。

> 旧版风格强调“行为模块”，所以将很多小 hook 合并到 `useNodePresentation`/`useNodeInteraction`。

### B. NodeLayer 层（运行态）
- `useNodeRuntime(nodes, core)`
  - 内聚 viewNodes + transient API + view store。
- `useSnapRuntime(nodes, nodeSize)`
  - 内聚 snap index + guides + runtime。
- `useGroupRuntime(nodes, nodeSize, padding)`
  - 内聚 group hover、group ops。

### C. Hook 导出收敛
`node/hooks/index.ts` 仅导出：
- `useNodePresentation`
- `useNodeInteraction`
- `useNodeTransform`
- `useSelection`
- `useNodeRuntime/useSnapRuntime/useGroupRuntime`

其余 hook 移为 `internal`（不再公开）或合并删除。

---

## 迁移路径（沿用旧风格习惯）
1) 先做 **presentation 合并**：在 `NodeItem` 中替换为 `useNodePresentation`。
2) 再做 **interaction 合并**：`useNodeDrag` 迁移为 `useNodeInteraction` 内部私有逻辑。
3) 最后做 **runtime 合并**：`NodeLayerStack` 改为使用 `useNodeRuntime/useSnapRuntime/useGroupRuntime`。
4) 精简 `index.ts` 导出和文档说明。

---

## 好处与风险
**好处**
- 与旧版一致：hook 即行为模块，组件只负责绑定。
- 减少 hook 数量，降低学习成本。
- 运行态统一归集，便于性能优化。

**风险**
- 合并后 hook 体积变大，要保持职责边界清晰（渲染 / 交互 / 运行态）。
- 部分被移除的 hook 可能影响外部调用，需要同步调整使用方。

---

## 与当前规范对齐点
- hook 不处理生命周期，仅输出 handlers/actions。
- 组件或 lifecycle 层负责绑定事件与副作用。
- 不引入 React Provider，仍以 jotai + instance 为基础。

