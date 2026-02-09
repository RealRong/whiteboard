# `packages/whiteboard-react/src/edge` 实例中心化简化方案（仅方案，不改代码）

## 0. 范围说明

- 用户提到的 `src/edge`，在当前仓库中对应路径为：`packages/whiteboard-react/src/edge`。
- 本文基于 `AGENTS.md` 的架构约束（`instance` 四域：`state/runtime/query/commands`，写入仅走 `instance.commands`，Hooks 语义化且纯粹）进行分析。
- 本文只给重构设计与迁移步骤，不包含代码实现。

---

## 1. 当前目录快照（现状）

- 文件规模：`22` 个文件，约 `1221` 行。
- 主要分层：
  - `components/`：渲染层 + 部分交互逻辑。
  - `hooks/`：几何、命中、连接状态、组装模型。
  - `lifecycle/`：连接态期间的 window 事件绑定。
  - `state/`：edge 专属 selector atoms。

### 1.1 与 instance 对接现状

- 已有正确方向：
  - 连接主流程已经通过 `instance.commands.edgeConnect` 驱动（`createEdgeConnectCommands.ts`）。
  - 只读几何有部分走 `instance.query`（如 `getCanvasNodeRectById`）。
- 仍有偏离点：
  - Edge 子模块内仍存在直接 `core.dispatch` 写入。
  - 多处重复几何/坐标换算，尚未形成 instance 单一读模型。
  - 组件层存在较重的“模型拼装 + 大量 props 透传”。

---

## 2. 关键问题清单（按优先级）

## P0：写路径不统一（违背“单写入口”）

- `useEdgePointInsertion.ts` 直接 `core.dispatch({ type: 'edge.update' ... })`。
- `EdgeControlPointHandles.tsx` 在拖拽、双击、删除键分支多次直接 `core.dispatch`。
- 这会导致：
  - Edge 写行为分散在组件/Hook，instance.commands 的语义边界被绕过。
  - 后续若要做审计、撤销归并、埋点、权限拦截，入口不统一。

## P0：几何逻辑重复，缺少单一事实源

- `getAnchorFromPoint` 算法重复：
  - `edge/hooks/useEdgeConnect.ts`
  - `common/instance/edge/edgeConnectUtils.ts`
- `getAutoAnchor` 算法重复：
  - `edge/hooks/useEdgeGeometry.ts`
  - `edge/components/EdgeEndpointHandles.tsx`
- 结果：
  - 参数/阈值细节未来容易漂移，出现“同一边在不同层计算不一致”。

## P1：坐标转换重复，热路径缺少统一入口

- `screen -> world` 转换在多个模块重复实现：
  - `useEdgeHitTest.ts`
  - `EdgeControlPointHandles.tsx`
  - `useNodeInteraction.ts`
  - `useEdgeConnectLifecycle.ts`
- 结果：
  - 逻辑重复，后续适配容器偏移/嵌套滚动/高 DPI 时维护成本高。

## P1：存在“聚合透传型 Hook”与 props drilling

- `useEdgeLayerModel.ts` 主要职责是打包 `edgeLayerProps/endpointHandlesProps/controlPointHandlesProps/previewProps`。
- `EdgeLayerStack.tsx` 以展开方式逐层透传。
- 这与 AGENTS 中“避免仅透传的聚合 Hook、组件应语义化组合”有冲突。

## P1：Hover 节流存在双层 RAF

- 第一层：`useCanvasHandlers.ts` 对 hover pointer move 做 RAF 聚合。
- 第二层：`createEdgeConnectCommands.ts` 的 `updateHover` 再做 RAF。
- 结果：
  - 双重延迟，不必要复杂度，行为难推断。

## P2：query 能力偏薄，edge 仍依赖局部临时计算

- 目前 `instance.query` 仅提供 node rect 查询（`createInstanceQuery.ts`）。
- Edge 几何（路径、端点、预览点）仍主要在 edge 模块本地重复计算，未沉淀为跨模块可复用读接口。

---

## 3. 目标架构（以 instance 为核心）

> 原则：**写全收敛到 `instance.commands`，读尽量通过 `instance.query`，UI 只做语义组合与渲染。**

## 3.1 instance.commands（唯一写入口）

将 edge 的编辑写操作全部归并到 `instance.commands.edge`（或 `instance.commands.edgeConnect`）：

- `edge.insertRoutingPoint(...)`
- `edge.moveRoutingPoint(...)`
- `edge.removeRoutingPoint(...)`
- `edge.resetRoutingAuto(...)`

迁移后：

- `useEdgePointInsertion`、`EdgeControlPointHandles` 不再直接 `core.dispatch`。
- 组件/Hook 仅调用命令，符合“single write entry”。

## 3.2 instance.query（统一只读几何）

在 `common/instance/query/` 增强 edge 相关查询（保持纯函数/只读）：

- `getEdgePathEntries({ edges, connectState })`
- `getEdgeEndpointPoints(edgeId)`
- `getEdgeConnectPreview(state)`
- 统一提供 `getAnchorFromPoint` / `getAutoAnchor` 所需几何逻辑（避免多处复制）

迁移后：

- `useEdgeGeometry`、`EdgeEndpointHandles`、`useEdgePreview` 共享同一套查询结果。
- 算法阈值与锚点策略只有一份实现。

## 3.3 runtime/hot-path（事件期 getter 优先）

- 统一一个语义化工具（建议在 common hooks/runtime 中）：`getPointerWorldPoint(event)`。
- 所有边交互热路径统一用 runtime getter：
  - `instance.runtime.containerRef`
  - `instance.runtime.viewport.screenToWorld`
  - `instance.runtime.viewport.getZoom()`

## 3.4 edge hooks/components（薄组合）

- 去掉“透传型”`useEdgeLayerModel`，改为小粒度语义 Hook：
  - `useEdgeLayerData`（读模型）
  - `useEdgeSelectionHandles`（端点/控制点交互）
  - `useEdgePreviewModel`（预览点）
- 组件尽量“就地取数 + 就地绑定”，减少中转 props。

---

## 4. 建议的目录简化方向（目标形态）

> 不是要求文件名完全一致，而是职责收敛方向。

- `edge/components/`
  - 保留：`EdgeLayerStack.tsx`, `EdgeLayer.tsx`, `EdgeItem.tsx`, `EdgePreviewLayer.tsx`, `EdgeMarkerDefs.tsx`
  - 合并倾向：`EdgeEndpointHandles.tsx` + `EdgeControlPointHandles.tsx` 可统一为一个 `EdgeEditHandles.tsx`（内部再按语义拆小 Hook）
- `edge/hooks/`
  - 保留语义 Hook，减少“模型打包器”
  - `useEdgeLayerModel.ts` 可删除/并入语义 Hook
  - `useEdgeConnect.ts` 内的重复锚点算法移除，改复用 instance/query 公共实现
- `edge/lifecycle/`
  - 保留 `useEdgeConnectLifecycle.ts`
  - 与 `useCanvasHandlers` 明确分工：hover 节流只保留一处
- `edge/state/`
  - 简化 selector，避免为透传而聚合 `canvasNodes + state + tool` 的“大对象 atom”

---

## 5. 迁移路线图（可分阶段落地）

## 阶段 A（低风险，先统一写入口）

1. 在 `instance.commands.edge` 增加 routing 点增删改命令。
2. 替换 `useEdgePointInsertion` 与 `EdgeControlPointHandles` 的直接 `core.dispatch`。
3. 保持 UI 行为不变，只做调用路径迁移。

**验收**：Edge 控制点拖拽/插入/删除行为一致，且 edge 模块不再直接 dispatch。

## 阶段 B（统一几何读模型）

1. 将锚点算法统一到 `common/instance/query`（或 edge query 子模块）。
2. `useEdgeGeometry`、`EdgeEndpointHandles`、`useEdgePreview` 切换到统一 query。
3. 删除重复 `getAnchorFromPoint/getAutoAnchor` 代码。

**验收**：连接预览、端点手柄、edge path 三处锚点一致性通过。

## 阶段 C（去透传化，简化组件树）

1. 移除 `useEdgeLayerModel` 聚合透传模式。
2. EdgeLayerStack 改为“少量语义 Hook + 直接组合组件”。
3. 控制点与端点 handles 视情况合并为单编辑层。

**验收**：`EdgeLayerStack` props 显著减少，逻辑分区更清晰。

## 阶段 D（事件节流单点化）

1. 只保留一层 hover RAF（建议留在容器事件层 `useCanvasHandlers`）。
2. `edgeConnect.updateHover` 改为无 RAF 的纯状态写入（或保留命令层 RAF、移除外层 RAF，二选一）。
3. 明确文档：谁负责采样，谁负责写状态。

**验收**：hover 响应更线性，调试链路简化。

---

## 6. 风险与回归点

- 路由点编辑命令迁移后，需重点回归：
  - `linear` 边的插点、拖点、删点。
  - `bezier/curve` 的“不可编辑控制点”约束是否保持。
- 锚点算法统一后，需回归：
  - 旋转节点（`rotation`）连接精度。
  - reconnect 过程中的 source/target 替换正确性。
- hover 节流改单点后，需观察：
  - 高频 pointermove 下 CPU 占用与视觉延迟。

---

## 7. 结论（建议执行顺序）

- **先做 A（单写入口）+ B（单读几何）**：收益最大、风险可控。
- 再做 C（去透传简化结构）+ D（节流单点化）：进一步降低复杂度与维护成本。
- 最终状态将更贴合 AGENTS 的目标架构：
  - `instance.commands` 负责行为写入
  - `instance.query` 负责跨模块只读几何
  - edge 组件/Hook 负责语义组合与薄渲染

