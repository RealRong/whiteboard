# Whiteboard React `instance + jotai store` 一体化迁移方案（仅方案，不改代码）

## 1. 目标与边界

本方案用于 `packages/whiteboard-react` 的**全局状态与行为入口重构**，目标是把“跨模块状态 + 跨模块动作”统一下沉到 `instance`，并遵循以下硬性准则：

1. **如果能力上了 `instance`，不再保留另一套 hook 实现**（避免重复实现与行为分叉）。
2. **尽量跳出 React**：在 `instance` 上挂 `jotai store`，业务通过 `store.get/store.set/store.sub` 驱动；React hook 仅作为消费层（读取/订阅）薄封装。

补充边界：
- 当前处于早期构建阶段，可接受激进改动，不以兼容旧 API 为第一优先级。
- 本文档只给方案，不包含代码修改。

---

## 2. 当前现状（扫描结论）

### 2.1 已具备的基础能力

- `whiteboardInstance` 已有 `commands`、`services`、`viewport.getZoom/get/screenToWorld/worldToScreen`，具备 runtime 入口形态。  
  文件：`packages/whiteboard-react/src/common/instance/whiteboardInstance.ts`
- `useEdgeConnectActions` 已部分使用 `useStore().get(...)`，说明“脱 React 逻辑”已有可行路径。  
  文件：`packages/whiteboard-react/src/edge/hooks/useEdgeConnect.ts`
- 生命周期分层已基本形成（`useWhiteboardLifecycle` / node / edge lifecycle）。

### 2.2 主要问题

1. **动作入口分散在 hook**：`selection/interaction/edgeConnect/tool` 既可从 hook 写 atom，又通过 `instance.commands` 间接转发，存在双路入口。  
2. **runtime 与 React 绑定过紧**：部分命令依赖 hook + ref 同步（如 `useInstanceCommands`），而非直接读写统一 store。  
3. **同类状态存在“可下沉但未下沉”**：`groupHovered/dragGuides/nodeViewOverrides/spacePressed` 等仍主要通过 React 生命周期触发。  
4. **性能模型未统一**：已有 `getter + CSS variable` 模式，但在动作层面仍有大量“先 hook 再 setAtom”的路径。

---

## 3. 目标架构（单实现）

## 3.1 `instance` 新职责

在 `whiteboardInstance` 增加：

- `instance.state.store`: Jotai store 实例（唯一状态容器）
- `instance.state.atoms`: 状态命名空间（对外暴露必要原子引用）
- `instance.api`: 统一动作 API（selection/interaction/edge/tool/transient/...）

建议形态：

```ts
instance.state.store.get(atom)
instance.state.store.set(atom, updater)
instance.state.store.sub(atom, callback)

instance.api.selection.select(ids, mode)
instance.api.selection.clear()
instance.api.interaction.update(patch)
instance.api.edgeConnect.startFromHandle(...)
instance.api.tool.set(tool)
instance.api.transient.nodeOverrides.set(...)
```

### 3.2 React 层角色降级

- 保留 `useXxxState` 作为订阅入口（渲染语义需要时）。
- `useXxxActions` 不再实现业务逻辑：
  - 方案 A（推荐，激进）：直接删除，组件改调 `instance.api.*`。
  - 方案 B（过渡）：保留同名 hook，但内部仅 `return instance.api.xxx`（薄别名），最终移除。

### 3.3 与 AGENTS 设计准则对齐

- 热路径交互数学优先 `getter`（如 `instance.viewport.getZoom()`）。
- 纯视觉缩放优先 CSS 变量（`--wb-zoom`）。
- 只有“确实要触发 React 渲染语义”才做 state 订阅。
- side effect 归 lifecycle/service，hook 保持纯。

---

## 4. 迁移清单（按优先级）

> 说明：P0 必做，P1 建议，P2 视收益实施。这里是“应迁移到 instance/store 单实现”的对象。

## 4.1 P0（立即迁移）

### A. Interaction

- 当前：`useInteractionActions().update` 直接 `set(interactionAtom)`
- 目标：`instance.api.interaction.update/clearHover`
- 影响文件：
  - `packages/whiteboard-react/src/common/hooks/useInteraction.ts`
  - `packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts`
  - `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts`

### B. Selection（Node + Edge）

- 当前：`useSelectionActions`、`useNodeInteraction` 内重复 selection patch 逻辑。
- 目标：统一到 `instance.api.selection.{select,toggle,clear,getSelectedNodeIds}` 与 `instance.api.edge.select`。
- 影响文件：
  - `packages/whiteboard-react/src/node/hooks/useSelection.ts`
  - `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts`
  - `packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts`
  - `packages/whiteboard-react/src/common/shortcuts/lifecycle/useShortcutRegistry.ts`

### C. EdgeConnect Actions

- 当前：`useEdgeConnectActions` 已强依赖 store.get，但仍通过 React hook 输出动作。
- 目标：把整套连接动作收口到 `instance.api.edgeConnect.*`，hook 只读态/薄转发。
- 影响文件：
  - `packages/whiteboard-react/src/edge/hooks/useEdgeConnect.ts`
  - `packages/whiteboard-react/src/edge/lifecycle/useEdgeConnectLifecycle.ts`
  - `packages/whiteboard-react/src/edge/lifecycle/useEdgeConnectRuntimeSync.ts`
  - `packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts`

### D. Tool / SpacePressed 生命周期写入

- 当前：`useToolLifecycle`、`useSpacePressedLifecycle` 直接 set atom。
- 目标：改为 `instance.api.tool.set`、`instance.api.keyboard.setSpacePressed`。
- 影响文件：
  - `packages/whiteboard-react/src/common/lifecycle/useToolLifecycle.ts`
  - `packages/whiteboard-react/src/common/lifecycle/useSpacePressedLifecycle.ts`

### E. InstanceCommands 去 Hook 依赖

- 当前：`useInstanceCommands` 用 ref 桥接 hook state/actions。
- 目标：`instance.commands` 直接绑定 `instance.api + core.commands`，不再依赖 React ref 同步。
- 影响文件：
  - `packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts`
  - `packages/whiteboard-react/src/common/instance/whiteboardInstance.ts`

## 4.2 P1（强建议）

### A. Group Hover Runtime

- 当前：`useGroupRuntime` 暴露 `setHoveredGroupId`。
- 目标：`instance.api.groupRuntime.setHoveredGroupId`，拖拽策略直接调用。
- 影响文件：
  - `packages/whiteboard-react/src/node/hooks/useGroupRuntime.ts`
  - `packages/whiteboard-react/src/node/hooks/useNodeDrag.ts`

### B. Drag Guides

- 当前：`useDragGuides` 读写 `dragGuidesAtom`。
- 目标：`instance.api.transient.dragGuides.set/clear`。
- 影响文件：
  - `packages/whiteboard-react/src/node/hooks/useDragGuides.ts`
  - `packages/whiteboard-react/src/node/hooks/useNodeDrag.ts`
  - `packages/whiteboard-react/src/common/lifecycle/useTransientLifecycle.ts`

### C. Node Transient Overrides

- 当前：`useNodeTransient`（set/commit/clear）仍在 hook。
- 目标：迁移到 `instance.api.transient.nodeOverrides.*`，供 node drag/resize/runtime 直接用。
- 影响文件：
  - `packages/whiteboard-react/src/node/hooks/useNodeTransient.ts`
  - `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts`
  - `packages/whiteboard-react/src/common/lifecycle/useTransientLifecycle.ts`

### D. Shortcut 执行入口

- 当前：`useShortcutRegistry` 依赖 selection/edge hook actions。
- 目标：shortcuts 直接依赖 `instance.api.selection`/`instance.api.edge`。
- 影响文件：
  - `packages/whiteboard-react/src/common/shortcuts/lifecycle/useShortcutRegistry.ts`
  - `packages/whiteboard-react/src/common/shortcuts/defaultShortcuts.ts`

## 4.3 P2（按收益推进）

### A. State Hook 统一门面

- `useSelectionState/useInteractionState/useEdgeConnectState` 保留为渲染订阅入口；
- 统一从 `instance.state.store` 读取，避免多处隐式 `useAtomValue` 组合导致依赖图分散。

### B. Viewport 语义统一

- `viewport` 交互数学继续走 `instance.viewport.get*`；
- 视觉缩放继续走 CSS var；
- `viewportAtom` 仅保留“快捷键上下文/渲染语义”所需最小订阅，不扩散到热路径。

### C. Derived Atoms 的职责边界

- `viewNodes/canvasNodes/visibleEdges` 仍适合保持为 derived（声明式、可缓存）；
- 但其消费端动作应由 `instance.api` 执行，不再在多个 hook 内重复 patch。

---

## 5. 不建议迁移到 instance 的部分

以下属于**局部 UI 状态**，不应强行全局化：

- 文本编辑草稿：`packages/whiteboard-react/src/node/registry/defaultNodes.tsx`
- 边控制点活跃态：`packages/whiteboard-react/src/edge/components/EdgeControlPointHandles.tsx`
- Mindmap 拖拽预览态：`packages/whiteboard-react/src/mindmap/hooks/useMindmapRootDrag.ts`、`packages/whiteboard-react/src/mindmap/hooks/useMindmapSubtreeDrag.ts`

原则：只迁移“跨模块共享、需要统一命令入口、或跨生命周期消费”的状态与动作。

---

## 6. 一步到位迁移执行顺序（Big-Bang）

> 兼容性非优先，可直接大步重构。

1. **先建底座**：在 `createWhiteboardInstance` 挂 `state.store` 与 `api` 空实现。  
2. **先迁动作后删 hook**：优先迁 `selection/interaction/edgeConnect/tool/spacePressed`；迁完立即删除重复 action 实现。  
3. **改生命周期调用点**：`useInstanceCommands/useShortcutRegistry/useToolLifecycle/useSpacePressedLifecycle` 全部改调 `instance.api`。  
4. **迁 transient runtime**：`groupHovered/dragGuides/nodeViewOverrides` 收口到 `instance.api.transient/*`。  
5. **瘦身 hook 导出**：`useXxxActions` 全部降级为薄别名或直接移除；文档统一推荐 `instance.api`。  
6. **最后收口命名空间**：对外只保留 `instance.api` + 必要 `useXxxState`（渲染订阅）。

---

## 7. 命名空间建议（防止文件碎片化）

建议采用“单文件命名空间聚合 + 内部小模块”模式：

- `common/instance/api/selectionApi.ts`
- `common/instance/api/interactionApi.ts`
- `common/instance/api/edgeConnectApi.ts`
- `common/instance/api/transientApi.ts`
- `common/instance/api/index.ts`（聚合 `instance.api`）

但对外仅暴露：

```ts
instance.api.selection
instance.api.interaction
instance.api.edge
instance.api.edgeConnect
instance.api.tool
instance.api.keyboard
instance.api.transient
```

这样既能减少“hook 文件过多”的感知复杂度，又避免 mega file。

---

## 8. 验收标准

迁移完成后应满足：

1. **单实现**：不存在与 `instance.api` 等价的第二套 hook action 逻辑。  
2. **跨模块动作统一入口**：所有跨模块写操作可通过 `instance.api` 找到唯一入口。  
3. **热路径性能一致或更优**：拖拽/缩放/连线不因 state 订阅增加重渲染。  
4. **生命周期清晰**：副作用集中在 lifecycle/service，hook 主要承担读状态与组合。  
5. **lint/type 通过**：至少 `pnpm -C packages/whiteboard-react lint`、`pnpm -r build` 通过。

---

## 9. 附：本次重点扫描文件

- `packages/whiteboard-react/src/common/instance/whiteboardInstance.ts`
- `packages/whiteboard-react/src/common/state/whiteboardAtoms.ts`
- `packages/whiteboard-react/src/common/lifecycle/useInstanceCommands.ts`
- `packages/whiteboard-react/src/common/lifecycle/useToolLifecycle.ts`
- `packages/whiteboard-react/src/common/lifecycle/useSpacePressedLifecycle.ts`
- `packages/whiteboard-react/src/common/shortcuts/lifecycle/useShortcutRegistry.ts`
- `packages/whiteboard-react/src/common/hooks/useInteraction.ts`
- `packages/whiteboard-react/src/node/hooks/useSelection.ts`
- `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts`
- `packages/whiteboard-react/src/node/hooks/useNodeTransient.ts`
- `packages/whiteboard-react/src/node/hooks/useGroupRuntime.ts`
- `packages/whiteboard-react/src/node/hooks/useDragGuides.ts`
- `packages/whiteboard-react/src/edge/hooks/useEdgeConnect.ts`
- `packages/whiteboard-react/src/edge/lifecycle/useEdgeConnectLifecycle.ts`
- `packages/whiteboard-react/src/edge/lifecycle/useEdgeConnectRuntimeSync.ts`

