# Whiteboard Engine 驱动渲染范式扫描与重构方案

更新时间：2026-02-14  
范围：`packages/whiteboard-react/src` + `packages/whiteboard-engine/src`  
目标：以行业最佳实践为标准，建立“**Engine 计算 + React 纯渲染**”范式，并给出全量可改造点。

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
2. selection/edgeConnect window 绑定已在 engine lifecycle。
3. group autofit 已 service 化并由 lifecycle 管理。
4. edge 几何已开始下沉（已有 `getEdgePathEntries/getEdgeReconnectPathEntry/getEdgeConnectPreview`）。

## 3.2 偏离目标的核心问题

1. React 仍在以 `useMemo` 驱动 query 计算（edge、mindmap 等）。
2. 多个手势状态机仍在 React hook 内（node drag/transform、mindmap drag、edge routing point drag）。
3. React 与 Engine 存在算法/类型重复（geometry、selection、transform、edge legacy types）。
4. Engine 缺少“标准化 read model 层（view atoms + revision）”。

---

## 4. whiteboard-react 可改造项（全量清单）

说明：以下均可按“Engine 驱动渲染”范式优化。

| 模块 | 文件 | 当前问题 | 建议下沉/改造 |
|---|---|---|---|
| 容器 | `packages/whiteboard-react/src/Whiteboard.tsx` | viewport transform 直接由 `doc.viewport` 组装样式 | 改为订阅 engine 的 `viewportViewModel`（含 transform/css vars） |
| lifecycle bridge | `packages/whiteboard-react/src/common/lifecycle/useWhiteboardEngineBridge.ts` | React 侧拼装 lifecycleConfig 依赖项较重 | engine 提供 `runtime.lifecycle.updateFromProps(...)` 或统一 config adapter |
| 节点层 | `packages/whiteboard-react/src/node/components/NodeLayer.tsx` | 节点 layer 排序在 React `useMemo` 内计算 | 下沉 `orderedCanvasNodesByLayerAtom` / `nodeRenderItemsAtom` |
| 节点呈现 | `packages/whiteboard-react/src/node/hooks/useNodePresentation.ts` | rect/style/selected/hover 等组合计算在 React | 下沉 `nodeRenderPresentationAtom`，React 只读 render props |
| 节点交互 | `packages/whiteboard-react/src/node/hooks/useNodeInteraction.ts` | pointer down 逻辑与 selection/edge-connect 分支在 React | 下沉 `NodeInputController`（engine runtime） |
| 节点拖拽 | `packages/whiteboard-react/src/node/hooks/useNodeDrag.ts` | 完整拖拽状态机（dragRef/pointer capture/snap）在 React | 下沉 `NodeDragRuntimeService`，使用容器级事件委托 |
| 节点变换 | `packages/whiteboard-react/src/node/hooks/useNodeTransform.tsx` | resize/rotate 手势状态机在 React | 下沉 `NodeTransformInputController` + `nodeTransformHandlesViewAtom` |
| 框选 | `packages/whiteboard-react/src/node/hooks/useSelection.ts` | 与 engine selection input 逻辑重复（双实现） | React 仅保留 state 读取 facade；runtime 版本删除 |
| 边图层 | `packages/whiteboard-react/src/edge/components/EdgeLayer.tsx` | 仍通过 `useMemo` 调 query 驱动 | 改为直接订阅 `edgeRenderEntriesAtom` + `edgeReconnectOverlayAtom` |
| 边预览 | `packages/whiteboard-react/src/edge/components/EdgePreviewLayer.tsx` | 仍通过 `useMemo` 调 query 驱动 | 改为订阅 `edgePreviewOverlayAtom` |
| 边端点手柄 | `packages/whiteboard-react/src/edge/components/EdgeEndpointHandles.tsx` | selectedEdge + endpoints 在组件内查询/查找 | 下沉 `selectedEdgeEndpointHandlesAtom` |
| 边控制点 | `packages/whiteboard-react/src/edge/components/EdgeControlPointHandles.tsx` | 控制点拖拽状态机在 React | 下沉 `EdgeRoutingEditRuntimeService` + `edgeControlPointsViewAtom` |
| 边命中 | `packages/whiteboard-react/src/edge/hooks/useEdgeHitTest.ts` | 命中行为与插点策略在 React hook | 下沉 `EdgeInputController`，React 只传 data-id |
| 脑图层 | `packages/whiteboard-react/src/mindmap/components/MindmapLayer.tsx` | 过滤 mindmap 节点 + parse tree 在 React | 下沉 `mindmapViewTreesAtom` |
| 脑图树视图 | `packages/whiteboard-react/src/mindmap/components/MindmapTreeView.tsx` | layout、连线、drag preview、drop target 组合都在 React | 下沉 `MindmapLayoutSystem + MindmapDragRuntime + mindmapRenderModelAtom` |
| 脑图布局 hook | `packages/whiteboard-react/src/mindmap/hooks/useMindmapLayout.ts` | 布局计算在 React | 下沉 engine 派生模型 |
| 脑图根拖拽 | `packages/whiteboard-react/src/mindmap/hooks/useMindmapRootDrag.ts` | 手势状态机在 React | 下沉 engine runtime |
| 脑图子树拖拽 | `packages/whiteboard-react/src/mindmap/hooks/useMindmapSubtreeDrag.ts` | 手势状态机 + drop target 组合在 React | 下沉 engine runtime |
| 几何工具 | `packages/whiteboard-react/src/common/utils/geometry.ts` | 与 engine geometry 大量重复 | React 删除运行时几何实现，统一引用 engine |
| 节点选择工具 | `packages/whiteboard-react/src/node/utils/selection.ts` | 与 engine `node/utils/selection.ts` 重复 | 删除重复，统一 engine |
| 变换工具 | `packages/whiteboard-react/src/node/utils/transform.ts` | 与 engine `node/utils/transform.ts` 重复 | 删除重复，统一 engine |

---

## 5. engine 设计可改造项（全量清单）

| 模块 | 文件 | 当前问题 | 建议 |
|---|---|---|---|
| Query 聚合 | `packages/whiteboard-engine/src/instance/query/createInstanceQuery.ts` | 读模型仍是“调用时计算/缓存”，而非状态驱动派生 | 建立 `view` 层（atoms + revision），query 仅做轻量查询 |
| State key 集合 | `packages/whiteboard-engine/src/state/whiteboardStateAtomMap.ts` | 只有基础状态与少量 derived，缺 render model keys | 增加 `viewStateAtoms`（node/edge/mindmap overlays） |
| Derived atoms | `packages/whiteboard-engine/src/state/whiteboardDerivedAtoms.ts` | 仅到 `visibleEdges/canvasNodes` | 增加 `orderedCanvasNodesByLayer`, `edgeRenderEntries`, `mindmapRenderModel` 等 |
| 命令聚合 | `packages/whiteboard-engine/src/instance/commands/createWhiteboardCommands.ts` | 过大，混合 domain + runtime | 拆分 domain command modules；runtime-only 操作移出 commands |
| edge connect | `packages/whiteboard-engine/src/instance/commands/createEdgeConnectCommands.ts` | 逻辑集中于命令函数，缺 system 化边界 | 拆 `EdgeConnectSystem`（state transition + snap read model） |
| lifecycle input | `packages/whiteboard-engine/src/instance/lifecycle/input/createCanvasInputHandlers.ts` | 当前只覆盖 canvas/selection/viewport/edgeHover | 纳入 node/edge/mindmap 的统一输入委托 |
| node transform service | `packages/whiteboard-engine/src/instance/services/NodeTransformService.ts` | 计算在 engine，但手势编排仍在 React | 增加 input controller，React 不再持 dragRef |
| mindmap drag service | `packages/whiteboard-engine/src/instance/services/MindmapDragService.ts` | 仅 drop target 计算，不含完整拖拽 runtime | 扩展为完整 runtime + preview overlay |
| shortcut context | `packages/whiteboard-engine/src/shortcuts/runtime/createShortcutRuntime.ts` | 每次事件通过 query 拼 context | 用 `shortcutContextAtom` / interaction snapshot 派生，降低事件热路径开销 |
| 类型命名债务 | `packages/whiteboard-engine/src/types/edge/connect.ts` `packages/whiteboard-engine/src/types/edge/geometry.ts` | 仍有 `UseXxx` React 风格命名 | 重命名为 engine-native：`EdgeConnectModel/EdgePathEntry` 等 |
| 类型重复 | `packages/whiteboard-react/src/types/node/drag.ts` 等与 engine 同构 | 双份维护风险高 | Runtime/geometry/drag 类型统一只在 engine 定义 |

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

1. 在 `packages/whiteboard-engine/src/types/instance/index.ts` 增加 `view` 契约类型。
2. 在 `packages/whiteboard-engine/src/instance/whiteboardInstance.ts` 注入 `view` namespace。
3. 将 `packages/whiteboard-engine/src/instance/query/createInstanceQuery.ts` 中 edge 渲染缓存逻辑迁移到 `state/view`（query 仅保留工具查询）。
4. 新增 `packages/whiteboard-engine/src/state/view/*` 的 view key 与派生注册。
5. 在 `packages/whiteboard-engine/src/instance/lifecycle/input/*` 下补齐 node/edge/mindmap 输入控制器入口。

### 11.2 第二批（Engine P1）

1. 将 `useSelection.ts` 的框选状态机迁移到 engine runtime。
2. 将 `useNodeDrag.ts`、`useNodeTransform.tsx` 的手势状态机迁移到 engine runtime。
3. 将 `useMindmapLayout.ts`、`useMindmapRootDrag.ts`、`useMindmapSubtreeDrag.ts` 的核心计算与拖拽状态机迁移到 engine。
4. 抽取并复用 geometry/selection/transform 到 `infra`，去重算法实现。

### 11.3 最后做（React P2）

1. `EdgeLayer.tsx`、`EdgePreviewLayer.tsx` 改为直接订阅 edge view keys。
2. `NodeLayer.tsx`、`NodeItem.tsx` 改为直接订阅 node view keys。
3. `MindmapLayer.tsx`、`MindmapTreeView.tsx` 改为直接订阅 mindmap view keys。
4. 删除 React 侧重复工具与类型镜像，保留最小 UI 语义 hooks。

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
