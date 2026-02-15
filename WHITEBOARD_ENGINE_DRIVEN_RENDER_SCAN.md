# Whiteboard Engine 驱动渲染范式扫描与重构方案

更新时间：2026-02-15  
范围：`packages/whiteboard-react/src` + `packages/whiteboard-engine/src`  
目标：以行业最佳实践为标准，建立“**Engine 计算 + React 纯渲染**”范式，并给出全量可改造点。

---

## 0. 当前落地状态（截至 2026-02-15）

### 0.1 已完成（代码已落地）

1. `infra/derive`、`infra/cache`、`infra/query`、`infra/geometry` 已建立并接入主链路。
2. `state/view` 已建立统一派生注册与调试指标，`view key -> derive -> deps` 路径已稳定。
3. `createWhiteboardCommands.ts` 已完成按领域拆分：`base/edge/node/mindmap`，聚合文件已降为装配层。
4. `createInstanceQuery.ts` 已收敛为工具查询；edge 渲染型计算已迁移到 `state/view/edgeViewQuery.ts`。
5. pointer session window binding 已通用化，已覆盖：
   - `edgeConnect`
   - `edgeRoutingPointDrag`
   - `nodeDrag`
   - `nodeTransform`
   - `mindmapDrag`
   - `selectionBox`
6. React 侧已进一步收敛为“发起命令 + 渲染”为主：
   - `NodeItem` 不再驱动 `nodeDrag` 的 move/up/cancel
   - `NodeTransformHandles` 不再驱动 `nodeTransform` 的 move/up/cancel
   - `MindmapTreeView` 不再驱动 `mindmapDrag` 的 move/up/cancel
7. `instance/query` 已完成模块化拆分：
   - `createCanvasQuery.ts`
   - `createSnapQuery.ts`
   - `createInstanceQuery.ts` 仅负责装配
8. `shortcut context` 已完成热路径首轮优化：
   - 基础上下文改为 `view` 快照键：`shortcut.context`
   - `shortcut runtime` 不再依赖 `instance.query.getShortcutContext`
   - 事件覆盖（`focus/modifiers/button`）统一收敛到 `runtime/input` 适配函数
9. `MindmapDragService` 已扩展为三段职责 API：
   - `buildNodeRectMap`
   - `buildSubtreeGhostRect`
   - `computeSubtreeDropTarget`
   并在 `createMindmapCommands.ts` 去除对应算法细节，保留流程编排。
10. `computeSubtreeDropTarget` 已下沉到 `packages/whiteboard-engine/src/mindmap/domain/computeSubtreeDropTarget.ts`，`MindmapDragService` 收敛为薄装配层。
11. shortcut 输入处理已从 canvas 聚合入口抽离：
   - `packages/whiteboard-engine/src/instance/lifecycle/input/shortcut/createShortcutInputHandlers.ts`
   - `packages/whiteboard-engine/src/instance/lifecycle/input/shortcut/resolveShortcutContextFromEvent.ts`
   形成“base context（view）+ event 覆盖（input）+ runtime 消费”的固定链路。
12. `runtime/input` 已完成首轮目录语义拆分：
   - `input/canvas/*`：canvas 相关输入编排
   - `input/shortcut/*`：shortcut 上下文适配与分发
13. `runtime/input` 已新增按域 window binding 装配工厂：
   - `input/edge/createEdgeInputWindowBindings.ts`
   - `input/node/createNodeInputWindowBindings.ts`
   - `input/mindmap/createMindmapInputWindowBinding.ts`
   `WhiteboardLifecycleRuntime` 已改为通过这些工厂装配域输入绑定。
14. `runtime/input` 已新增 selection 装配工厂：
   - `input/selection/createSelectionInputBindings.ts`
   `selectionBox/selectionCallbacks` 装配已从 `WhiteboardLifecycleRuntime` 构造期抽离。
15. lifecycle 默认配置与 history 纯逻辑已抽离：
   - `instance/lifecycle/config/createDefaultLifecycleConfig.ts`
   - `instance/lifecycle/history/historyLifecycle.ts`
   `WhiteboardLifecycleRuntime` 进一步收敛为装配与生命周期编排。
16. history 订阅与清理策略已 controller 化：
   - `instance/lifecycle/history/HistoryBindingController.ts`
   `WhiteboardLifecycleRuntime` 已改为 `start/update/stop` 调用 controller。
17. container 事件与尺寸观察已 controller 化：
   - `instance/lifecycle/container/ContainerLifecycleController.ts`
   `WhiteboardLifecycleRuntime` 已改为统一 `sync/stop` 调用 container controller。
18. window key 与 group auto-fit 生命周期已 controller 化：
   - `instance/lifecycle/keyboard/WindowSpaceKeyController.ts`
   - `instance/lifecycle/group/GroupAutoFitLifecycleController.ts`
   `WhiteboardLifecycleRuntime` 已改为通过 controller 管理 start/stop。
19. runtime stop 清理流程已 controller 化：
   - `instance/lifecycle/cleanup/RuntimeCleanupController.ts`
   `transient reset + services dispose + shortcuts dispose` 已从 lifecycle 主类停止流程抽离。
20. window bindings 批处理已 orchestrator 化：
   - `instance/lifecycle/bindings/WindowBindingsOrchestrator.ts`
   edge/node/mindmap/selection 的 `start/sync/stop` 已统一批处理。

### 0.2 未完成（下一步）

1. `runtime/input` 与 lifecycle 基础装配已完成首轮拆分，下一步可继续把 lifecycle 的 start/update/stop 主流程拆分为更细粒度 orchestrator/controller，进一步降低主编排文件复杂度。
2. `shortcut.context` 目前已在 canvas 输入链路接入，后续新增键盘/指针入口时需统一复用同一 context 适配函数，避免回退到 runtime 内联事件解析。

---

## 1. 结论（先给答案）

你现在的直觉是正确的：当前链路里仍有不少“React 通过 `useMemo/useRef` 驱动引擎计算”的模式。  
长期最优范式应是：

1. **Engine 持有完整运行时状态与派生渲染模型（read model）**。
2. **React 只订阅 read model 并渲染，不参与业务几何/命中/拖拽状态机计算**。
3. **输入事件在 engine lifecycle 内统一编排**（事件委托 + pointer runtime），React 仅把事件入口挂到容器。
4. **命令与读模型严格分离（CQRS）**：`commands` 只写，`view/query` 只读。

---

## 2. 行业规范范式（建议采用）

## 2.1 分层

1. **Core**：文档模型、持久化、可回放命令。
2. **Engine State**：交互态（selection/edgeConnect/pointer/hover/transient）。
3. **Engine View（Read Model）**：用于渲染的稳定结构（edge paths、node render items、mindmap lines 等）。
4. **Engine Runtime/Input**：DOM 输入绑定、手势状态机、快捷键、生命周期。
5. **React Renderer**：纯映射渲染（`read model -> JSX`）。

## 2.2 数据流

`DOM Event -> Engine Runtime -> Engine Commands/State -> Engine View Model -> React Selector -> Render`

不应该是：  
`React Selector -> useMemo -> instance.query(...) -> Render`

## 2.3 关键工程约束

1. UI 层禁止维护业务拖拽状态机（pointerId、dragRef、hit-test cache）。
2. UI 层禁止几何派生（path/layout/anchor/snap）作为主要计算来源。
3. 读模型必须可增量失效（revision/dirty set），未变化项复用引用。
4. Query 不再要求 UI 传入 state 参数（避免“UI 驱动 Engine”）。

---

## 3. 当前现状扫描（总览）

## 3.1 已接近目标的部分

1. lifecycle 主链路已下沉 engine（`WhiteboardLifecycleRuntime`）。
2. pointer session window 绑定已统一（`selectionBox/edgeConnect/edgeRoutingPointDrag/nodeDrag/nodeTransform/mindmapDrag`）。
3. group autofit 已 service 化并由 lifecycle 管理。
4. edge/node/mindmap 渲染主数据已走 `state/view` 派生并被 React 直接订阅。

## 3.2 偏离目标的核心问题

1. 文档个别章节仍需持续按代码事实同步状态（避免“文档滞后于实现”）。

---

## 4. whiteboard-react 可改造项（全量清单）

说明：以下均可按“Engine 驱动渲染”范式优化。

| 状态 | 模块 | 文件 | 当前问题 | 建议下沉/改造 |
|---|---|---|---|---|
| 已完成 | 容器 | `packages/whiteboard-react/src/Whiteboard.tsx` | viewport transform 直接由 `doc.viewport` 组装样式 | 已改为订阅 engine `view`（`viewport.transform`） |
| 已废弃（已删除） | lifecycle bridge | `packages/whiteboard-react/src/common/lifecycle/useWhiteboardEngineBridge.ts` | React 侧拼装 lifecycleConfig 依赖项较重 | 已内联到 `Whiteboard.tsx`，由 engine lifecycle 统一管理 |
| 已完成 | 节点层 | `packages/whiteboard-react/src/node/components/NodeLayer.tsx` | 节点 layer 排序在 React `useMemo` 内计算 | 已改为订阅 `view`（`node.items`） |
| 已废弃（已删除） | 节点呈现 | `packages/whiteboard-react/src/node/hooks/useNodePresentation.ts` | rect/style/selected/hover 等组合计算在 React | 已删除并收敛到 engine `view` + 组件内薄映射 |
| 已废弃（已删除） | 节点交互 | `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts` | pointer down 逻辑与 selection/edge-connect 分支在 React | 已删除并收敛为组件内命令分发 + engine runtime |
| 已废弃（已删除） | 节点拖拽 | `packages/whiteboard-react/src/node/hooks/useNodeDrag.ts` | 完整拖拽状态机（dragRef/pointer capture/snap）在 React | 已删除，`nodeDrag` move/up/cancel 由 engine window binding 接管 |
| 已废弃（已删除） | 节点变换 | `packages/whiteboard-react/src/node/hooks/useNodeTransform.tsx` | resize/rotate 手势状态机在 React | 已删除，`nodeTransform` move/up/cancel 由 engine window binding 接管 |
| 已废弃（已删除） | 框选 | `packages/whiteboard-react/src/node/hooks/useSelection.ts` | 与 engine selection input 逻辑重复（双实现） | 已删除，selection box 由 engine runtime 接管 |
| 已完成 | 边图层 | `packages/whiteboard-react/src/edge/components/EdgeLayer.tsx` | 仍通过 `useMemo` 调 query 驱动 | 已改为订阅 `view`（`edge.paths`） |
| 已完成 | 边预览 | `packages/whiteboard-react/src/edge/components/EdgePreviewLayer.tsx` | 仍通过 `useMemo` 调 query 驱动 | 已改为订阅 `view`（`edge.preview`） |
| 已完成 | 边端点手柄 | `packages/whiteboard-react/src/edge/components/EdgeEndpointHandles.tsx` | selectedEdge + endpoints 在组件内查询/查找 | 已改为订阅 `view`（`edge.selectedEndpoints`）+ 状态只读 |
| 已完成 | 边控制点 | `packages/whiteboard-react/src/edge/components/EdgeControlPointHandles.tsx` | 控制点拖拽状态机在 React | 已改为 engine 命令 + window binding 驱动，组件仅发起操作 |
| 已废弃（已删除） | 边命中 | `packages/whiteboard-react/src/edge/hooks/useEdgeHitTest.ts` | 命中行为与插点策略在 React hook | 已删除并内联到 `EdgeLayer`（命中结果走 engine command） |
| 已完成 | 脑图层 | `packages/whiteboard-react/src/mindmap/components/MindmapLayer.tsx` | 过滤 mindmap 节点 + parse tree 在 React | 已改为订阅 `view`（`mindmap.trees`） |
| 已完成 | 脑图树视图 | `packages/whiteboard-react/src/mindmap/components/MindmapTreeView.tsx` | layout、连线、drag preview、drop target 组合都在 React | 主要计算已下沉到 engine `view`，组件仅渲染与 pointerdown 发起 |
| 已废弃（已删除） | 脑图布局 hook | `packages/whiteboard-react/src/mindmap/hooks/useMindmapLayout.ts` | 布局计算在 React | 已删除，布局由 engine `view` 派生 |
| 已废弃（已删除） | 脑图根拖拽 | `packages/whiteboard-react/src/mindmap/hooks/useMindmapRootDrag.ts` | 手势状态机在 React | 已删除，拖拽链路由 engine runtime + window binding 接管 |
| 已废弃（已删除） | 脑图子树拖拽 | `packages/whiteboard-react/src/mindmap/hooks/useMindmapSubtreeDrag.ts` | 手势状态机 + drop target 组合在 React | 已删除，拖拽链路由 engine runtime + window binding 接管 |
| 已完成（文件删除） | 几何工具 | `packages/whiteboard-react/src/common/utils/geometry.ts` | 与 engine geometry 大量重复 | 已删除，统一由 engine 侧几何基础设施提供 |
| 已完成（文件删除） | 节点选择工具 | `packages/whiteboard-react/src/node/utils/selection.ts` | 与 engine `node/utils/selection.ts` 重复 | 已删除，组件直接复用 engine 导出实现 |
| 已完成（文件删除） | 变换工具 | `packages/whiteboard-react/src/node/utils/transform.ts` | 与 engine `node/utils/transform.ts` 重复 | 已删除，统一使用 engine 侧实现 |

---

## 5. engine 设计可改造项（全量清单）

| 状态 | 模块 | 文件 | 当前问题 | 建议 |
|---|---|---|---|---|
| 已完成 | Query 聚合 | `packages/whiteboard-engine/src/instance/query/createInstanceQuery.ts` | 读模型仍是“调用时计算/缓存”，而非状态驱动派生 | 已将渲染读模型迁到 `state/view/*`，query 收敛为工具查询，并拆为 `createCanvasQuery/createSnapQuery` |
| 已完成（方案调整） | State key 集合 | `packages/whiteboard-engine/src/state/whiteboardStateAtomMap.ts` | 只有基础状态与少量 derived，缺 render model keys | 已采用 `state/view` 派生注册机制，不再要求把 render model 强行塞入 state atom map |
| 已完成（方案调整） | Derived atoms | `packages/whiteboard-engine/src/state/whiteboardDerivedAtoms.ts` | 仅到 `visibleEdges/canvasNodes` | 已通过 `state/view/viewDerivations.ts` 提供 `edge/node/mindmap/viewport` 渲染派生 |
| 已完成 | 命令聚合 | `packages/whiteboard-engine/src/instance/commands/createWhiteboardCommands.ts` | 过大，混合 domain + runtime | 已拆分为 `createBaseCommands/createEdgeCommands/createNodeCommands/createMindmapCommands` |
| 已完成 | edge connect | `packages/whiteboard-engine/src/instance/commands/createEdgeConnectCommands.ts` `packages/whiteboard-engine/src/instance/edge/EdgeConnectSystem.ts` | 逻辑曾集中于命令函数，system 边界不清晰 | 已抽 `EdgeConnectSystem`，commands 收敛为薄封装 |
| 已完成（主路径） | lifecycle input | `packages/whiteboard-engine/src/instance/lifecycle/input/canvas/createCanvasInputHandlers.ts` | 当前只覆盖 canvas/selection/viewport/edgeHover | 已通过通用 pointer session binding 覆盖 node/edge/mindmap/selection box 的 window 输入链路 |
| 已完成 | node transform service | `packages/whiteboard-engine/src/instance/services/NodeTransformService.ts` | 计算在 engine，但手势编排仍在 React | 现已由 engine window binding 编排手势，React 不再维护 drag move/up/cancel |
| 已完成（本轮） | mindmap drag service | `packages/whiteboard-engine/src/instance/services/MindmapDragService.ts` `packages/whiteboard-engine/src/mindmap/domain/computeSubtreeDropTarget.ts` | service 历史上混合算法细节 | `computeSubtreeDropTarget` 已下沉到 `mindmap/domain`，service 收敛为装配入口，commands 仅做流程编排 |
| 已完成（本轮） | shortcut context | `packages/whiteboard-engine/src/state/view/viewDerivations.ts` `packages/whiteboard-engine/src/instance/lifecycle/input/shortcut/createShortcutInputHandlers.ts` `packages/whiteboard-engine/src/instance/lifecycle/input/shortcut/resolveShortcutContextFromEvent.ts` `packages/whiteboard-engine/src/shortcuts/runtime/createShortcutRuntime.ts` | shortcut context 曾依赖 query 事件时拼装 | 已迁到 `view` 键 `shortcut.context` + input 统一事件适配；runtime 只消费标准化上下文 |
| 已完成 | 类型命名债务 | `packages/whiteboard-engine/src/types/edge/connect.ts` `packages/whiteboard-engine/src/types/edge/geometry.ts` `packages/whiteboard-engine/src/types/node/*` | 存在 `UseXxx` React 风格命名 | 已完成 engine 类型重命名（如 `EdgeConnectModel/EdgeConnectActions/NodeTransformOptions`）并收敛导出 |
| 已完成（当前仓库） | 类型重复 | `packages/whiteboard-react/src/types/node/drag.ts` 等与 engine 同构 | 双份维护风险高 | 已删除重复 runtime 类型并完成 React/Engine 类型命名收敛，当前未发现 `UseXxx` legacy 类型残留 |

---

## 6. 推荐目录结构（简洁、可读、可扩展）

## 6.1 目录设计原则

1. 目录使用“**空间/职责**”命名：`runtime/edge`、`runtime/node`，不要 `runtime/edgeRuntime`。
2. 单目录只做一件事：计算、输入、状态、接口分开，不混放。
3. 通用能力先沉到底层基础设施，业务层只编排 API，不重复实现算法。
4. 命名尽量短：在不丢语义的前提下优先短名（`view` 优于 `renderModelNamespace`）。

## 6.2 建议目录树（engine）

```text
packages/whiteboard-engine/src/
  api/
    commands/            # 只写入口
    view/                # 渲染读取入口
    query/               # 工具查询入口
  runtime/
    lifecycle/           # start/update/stop
    input/
      canvas/
      node/
      edge/
      mindmap/
    shortcuts/
    viewport/
  state/
    atoms/               # 基础状态
    derived/             # 领域派生
    view/                # 渲染派生（read model）
  domain/
    node/
    edge/
    mindmap/
  infra/
    geometry/            # 几何基础设施
    query/               # 通用查询基础设施
    derive/              # 通用派生框架（revision/dirty）
    cache/               # 通用缓存策略
  types/
  index.ts
```

## 6.3 建议目录树（react）

```text
packages/whiteboard-react/src/
  Whiteboard.tsx
  common/
    lifecycle/           # React 仅桥接 lifecycle
    hooks/               # 仅 UI 语义 hooks
  node/components/
  edge/components/
  mindmap/components/
  styles/
```

说明：React 层不再承载 runtime 计算与手势状态机。

---

## 7. 建议的“最终范式”API 设计

## 7.1 实例结构

```ts
type WhiteboardEngine = {
  commands: WhiteboardCommands        // 只写
  state: WhiteboardStateNamespace     // 内部态
  view: WhiteboardViewNamespace       // UI 读取
  query: WhiteboardQueryNamespace     // 工具查询
  runtime: WhiteboardRuntimeNamespace // 生命周期与输入
}
```

## 7.2 View Namespace（核心）

```ts
type WhiteboardViewNamespace = {
  read: <K extends WhiteboardViewKey>(key: K) => WhiteboardViewSnapshot[K]
  watch: (key: WhiteboardViewKey, listener: () => void) => () => void
  snapshot: () => WhiteboardViewSnapshot
}
```

React 侧只需要订阅 `view`，不再通过 `useMemo + query` 触发主计算。

## 7.3 API 边界

1. `commands`：只负责意图写入（create/update/delete/select...）。
2. `view`：只负责渲染读模型。
3. `query`：只负责工具查询（命中、几何辅助、定位等）。
4. `runtime`：只负责输入与生命周期编排。

---

## 8. 命名规范（短而清晰）

## 8.1 命名原则

1. **短名优先**：`edge/view.ts` 优于 `edge/edgeRenderViewModel.ts`。
2. **空间 + 职责**：`runtime/edge`、`state/view`、`infra/query`。
3. **语义稳定**：`view` 表示渲染读模型，`query` 表示工具查询，`commands` 表示写入口。

## 8.2 推荐命名示例

1. 目录：`runtime/edge`、`runtime/node`、`infra/geometry`、`state/view`。
2. 文件：`edge/view.ts`、`edge/input.ts`、`node/model.ts`、`mindmap/layout.ts`。
3. API：`view.edge.read()`、`query.node.hitTest()`、`commands.edge.reconnect()`。

## 8.3 避免命名示例

1. `runtime/edgeRuntime`（重复语义）。
2. `useEdgeConnectReturn`（引擎层出现 React hook 语义）。
3. `resolvedComputedDerived...` 这类长前缀串联命名。

---

## 9. 基础设施优先（query/计算下沉）

## 9.1 设计目标

1. `query/geometry/cache/derive` 做成底层通用设施，可被 node/edge/mindmap 复用。
2. 上层 domain 只做“调用基础设施 API + 修改状态”，不重复写算法。
3. UI 只消费 `view`，不直接参与算法组合。

## 9.2 推荐分层调用链

`runtime.input -> domain action -> infra(query/geometry/derive/cache) -> state.write -> view.derive -> react.render`

## 9.3 约束

1. 算法只在 `infra` 一处实现，禁止在 `domain`/`react` 复制。
2. `domain` 不直接依赖 React 类型与事件。
3. `view` 派生统一走 `state/view`，不要散落在组件 `useMemo`。

---

## 10. 新版落地方案（Engine 先行，React 最后）

这版方案按“先引擎基础设施，再引擎视图与运行时，最后 UI 适配”执行，不做兼容层。

## Phase 0：冻结边界与接口契约（先统一规则）

1. 冻结实例分层：`commands`（写）/`state`（内部态）/`view`（渲染读模型）/`query`（工具查询）/`runtime`（输入与生命周期）。
2. 在类型层先定义稳定契约：`WhiteboardViewKey`、`WhiteboardViewSnapshot`、`WhiteboardViewNamespace`。
3. 规定 React 只允许两种引擎交互：`instance.view.*` + `instance.commands.*`；`instance.query.*` 只保留命中与工具用途。
4. 将命名规范固化到目录层：`runtime/edge`、`state/view`、`infra/derive`，避免 `xxxRuntime/xxxManager` 冗余后缀。

## Phase 1：先做 Engine 基础设施（核心优先）

1. 建立 `infra/derive`：统一 revision/dirty 机制，支持“按 key 增量失效”。
2. 建立 `infra/cache`：统一缓存键策略（节点几何签名、边路径签名、布局签名），禁止各模块各写一套。
3. 建立 `infra/query` + `infra/geometry`：将命中、锚点、布局基础计算集中到底层基础设施。
4. 在 `state/view` 建立 view 派生注册机制（view key -> derive function -> dependencies）。
5. 提供通用调试能力：每个 view key 的重算计数、命中率、耗时采样。

> 目标：先把“可复用的计算引擎”搭好，再谈业务模块迁移。

## Phase 2：构建 Engine View 读模型（渲染数据统一出口）

1. Edge View：`edge.entries`、`edge.reconnect`、`edge.preview`、`edge.endpoints`、`edge.controlPoints`。
2. Node View：`node.items`、`node.selectionOverlay`、`node.transformHandles`、`node.dragGuides`。
3. Mindmap View：`mindmap.items`、`mindmap.lines`、`mindmap.dragPreview`、`mindmap.dropHint`。
4. Viewport View：`viewport.transform`、`viewport.cssVars`（含 `--wb-zoom`）。
5. View namespace 统一 API：`read(key)`、`watch(key)`、`snapshot()`；React 不再依赖 `query + useMemo` 驱动主计算。

> 目标：把“UI 渲染所需的结构化数据”完全沉到引擎。

## Phase 3：迁移 Engine 关键运行时组件（重要组件第二优先）

1. `runtime/input` 全覆盖：canvas/node/edge/mindmap 的 pointer/keyboard 流程统一下沉。
2. 迁移状态机：`selection box`、`node drag`、`node transform`、`edge reconnect/control-point drag`、`mindmap root/subtree drag`。
3. lifecycle 统一装配：`start/update/stop` 只编排 service/controller，不承载业务算法细节。
4. shortcuts 与 interaction context 下沉为快照读模型（避免事件热路径临时拼装）。
5. `GroupAutoFitService`、`NodeTransformService`、`MindmapDragService` 保持 class 化与统一生命周期托管。

> 目标：输入事件与交互状态机全部在 engine 闭环，React 不再维护业务 `useRef` 状态机。

## Phase 4：收敛 Engine API（对外稳定后再动 UI）

1. `commands` 只暴露意图写入，不夹带 runtime 暂态逻辑。
2. `view` 成为唯一渲染读入口，`query` 收敛为 hit-test/辅助工具查询。
3. 形成跨框架 adapter 契约：React/Vue/Canvas 只需实现“事件桥接 + 渲染器”。
4. 统一类型来源到 `whiteboard-engine`，删除 React 侧运行时同构类型镜像。

> 目标：先把 engine 做成“可被任意 UI 壳复用”的稳定产品层。

## Phase 5：最后改 React（只做薄适配）

1. `Whiteboard.tsx` 只保留：实例创建、生命周期桥接、容器挂载、renderer 组合。
2. `useWhiteboardSelector` 升级为优先订阅 `instance.view`；state 订阅仅用于 UI 私有语义。
3. Edge/Node/Mindmap 组件改为“读 view -> 渲染 JSX”，移除业务 `useMemo` 几何计算。
4. 删除 React 业务 runtime hooks：`useSelectionRuntime`、`useNodeDrag`、`useNodeTransform`、`useMindmapRootDrag`、`useMindmapSubtreeDrag`（按迁移完成度逐步清理）。
5. React 只保留 UI 本地态（浮层显隐、DOM hover 等），不保留业务交互态。

> 目标：React 成为真正的 renderer 壳层，而不是半个 runtime。

---

## 11. 代码基线下的优先实施清单（结合当前仓库）

### 11.1 先做（Engine P0）

1. 已完成：在 `packages/whiteboard-engine/src/types/instance/index.ts` 增加 `view` 契约类型。
2. 已完成：在 `packages/whiteboard-engine/src/instance/whiteboardInstance.ts` 注入 `view` namespace。
3. 已完成：将 `packages/whiteboard-engine/src/instance/query/createInstanceQuery.ts` 中 edge 渲染缓存逻辑迁移到 `state/view`（query 仅保留工具查询）。
4. 已完成：新增并接入 `packages/whiteboard-engine/src/state/view/*` 的 view key 与派生注册。
5. 已完成：在 lifecycle 层补齐 node/edge/mindmap/selection box 的 pointer 输入链路（window binding）。
6. 已完成：`shortcut context` 从 query 迁移到 view（`shortcut.context`）并由 `runtime/input` 统一事件适配。

### 11.2 第二批（Engine P1）

1. 已完成：`useSelection.ts` 框选状态机迁移到 engine runtime（React 侧已删除）。
2. 已完成：`useNodeDrag.ts`、`useNodeTransform.tsx` 手势状态机迁移到 engine runtime（React 侧已删除）。
3. 已完成：`useMindmapLayout.ts`、`useMindmapRootDrag.ts`、`useMindmapSubtreeDrag.ts` 迁移到 engine（React 侧已删除）。
4. 已完成：geometry/selection/transform 重复工具已从 React 侧删除并统一收敛到 engine 实现。

### 11.3 最后做（React P2）

1. 已完成：`EdgeLayer.tsx`、`EdgePreviewLayer.tsx` 已改为直接订阅 edge view keys。
2. 已完成：`NodeLayer.tsx`、`NodeItem.tsx` 已改为直接订阅/消费 node view keys。
3. 已完成：`MindmapLayer.tsx`、`MindmapTreeView.tsx` 已改为直接订阅 mindmap view keys。
4. 已完成：React 侧重复工具与类型镜像已完成本轮收敛，当前以 UI 渲染与事件桥接职责为主。

---

## 12. 验收标准（Definition of Done）

1. 业务渲染计算（edge path/node handles/mindmap layout）只在 engine `view` 生成，React 不再主导计算。
2. 业务交互状态机（drag/transform/reconnect/box select）只在 engine runtime，React 不再持有 `pointerId/dragRef`。
3. React 组件渲染数据来源统一为 `instance.view`，`instance.query` 仅用于工具查询。
4. geometry/query/cache/derive 在 engine 内单一实现，无 React 重复算法。
5. 新增 Vue/Canvas 壳层时，不需要迁移业务状态机与几何算法，只需实现事件桥接与渲染器。

---

## 13. 一句话路线总结

先把 engine 做成完整的“状态 + 计算 + 输入 + 渲染读模型”平台，再让 React 做薄渲染壳。  
这样未来切 Vue 或 Canvas 时，重做的是壳，不是重做引擎。

---

## 14. 下一步（不做测试版本）

基于当前代码状态，建议按这个顺序继续：

1. **继续收敛 lifecycle 装配层**  
   把 lifecycle 的 `start/update/stop` 主流程按职责拆为更细粒度 orchestrator/controller，进一步减少 `WhiteboardLifecycleRuntime` 聚合复杂度。

2. **固化 `shortcut.context` 适配约束**  
   把 `resolveShortcutContextFromEvent` 明确为唯一入口，新输入链路禁止在 runtime 里直接拼装 `focus/modifiers/button`。

3. **保持“文档即现状”机制**  
   后续每次落地后同步回写第 0/4/5/11/14 章状态，避免文档再次滞后。
