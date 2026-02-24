# Whiteboard Remaining Design & Implementation Plan

## 0. 当前执行状态（2026-02-24）

本计划对应的收敛项已完成：

1. Phase A-F 已全部落地（`NodeTransform`、`EdgeInput`、`MindmapInput`、`InputSessionContext`、`lint/build`、基准与文档）。
2. P2 架构收口已落地：
   - 输入目录命名统一为 `runtime/nodeInput` + `runtime/edgeInput` + `runtime/mindmapInput`
   - node 输入流水线输出协议收敛为统一 `RuntimeOutput`（按 slice：`interaction/selection/nodePayload/mutations`）
3. 已移除失效 `node-hint` 基准脚本，`bench:check` 改为三项有效基准：
   - `bench:drag-frame:check`
   - `bench:node-transform-frame:check`
   - `bench:edge-routing-frame:check`
4. 最新基准结果均通过阈值：
   - drag-frame：`p95=1.1642ms`（目标 `<4ms`）
   - node-transform-frame：`p95=1.1152ms`（目标 `<4ms`）
   - edge-routing-frame：`p95=15.1745ms`（目标 `<16ms`）
5. checklist 文档已回写到当前真实状态。

## 1. 范围与目标

本文聚焦在 `NodeDrag` 流水线化之后，Engine 仍未完成的收敛工作：

1. 输入会话仍在直接调用 actor（耦合高）。
2. `runtime/actors` 与 `runtime/nodeInput` 存在双轨职责。
3. 一组历史类型问题导致 `pnpm -F @whiteboard/engine lint` 失败。

目标是把输入热路径统一成“**Session -> Gateway -> Planner -> Writer -> Mutations**”，并将可见复杂度降到最小。

---

## 2. 当前状态（已完成）

1. `NodeDrag` 已迁移到新流水线。
2. `input/sessions/NodeDrag.ts` 不再直调 `commands.selection` 和 `actors.node.drag`。
3. 新增 `runtime/nodeInput` 目录，已包含：
   - `Gateway`
   - `node/Planner`
   - `node/Rules`
   - `node/CommitCompiler`
   - `node/SessionStore`
   - `RuntimeWriter`
4. 旧 `runtime/actors/node/Drag.ts` 已删除。
5. `build` 与 `bench:drag-frame:check` 通过。

---

## 3. 历史剩余问题（已完成）

## 3.1 P0（必须优先完成）

1. [x] `NodeTransform` 仍是旧模式（session 直调 `actors.node.*`）。
2. [x] `EdgeConnect`/`RoutingDrag` 仍是旧模式（session 直调 `actors.edge.*`）。
3. [x] `MindmapDrag` 仍是旧模式（session 直调 `actors.mindmap.*`）。
4. [x] `InputSessionContext.actors` 仍暴露过大接口面。
5. [x] `lint` 仍有历史报错，阻断“重构完成”验收。

## 3.2 P1（建议紧接完成）

1. [x] `SelectionBox` 里有 `window.requestAnimationFrame`，仍带有 host/DOM 味道。
2. [x] 基准脚本 `bench:node-hint` 指向缺失路径，`bench:check` 不完整。
3. [x] 新旧 checklist 文档状态未统一回写。

## 3.3 P2（架构收口，已完成）

1. [x] 输入流水线命名与目录统一（`runtime/nodeInput`、`runtime/edgeInput`、`runtime/mindmapInput`）。
2. [x] node 输入领域输出协议统一为通用 `RuntimeOutput`（按 slice）。

---

## 4. 目标架构（完成态）

统一输入写链：

1. Host/React 提供规范化事件。
2. Session 只做“是否可启动 + 转发”。
3. Gateway 做路由（按 domain）。
4. Planner 做会话状态与领域计算。
5. Writer 统一写 `state/projection/mutations`。
6. `mutate -> core.reduceOperations -> projection -> query/view`。

边界规则：

1. Session 层不直接写状态，不直接调 actor 细节 API。
2. Actor 层保留领域命令能力；输入交互态由 Pipeline 负责。
3. Engine 内部允许同步直调，但必须通过 Gateway 收口入口。

---

## 5. 详细实施方案

## Phase A: 完成 NodeTransform 迁移（P0）

目标：彻底移除 `session -> actors.node.transform` 直调。

实施：

1. 新增 `runtime/transform/`（或并入 `runtime/nodeInput/nodeTransform/`，二选一，保持命名简短一致）。
2. 组件结构对齐 `NodeDrag`：
   - `Planner`
   - `Rules`
   - `CommitCompiler`
   - `SessionStore`
   - `RuntimeWriter`（复用或扩展）
3. 在 `InputSessionContext` 增加 `nodeInput.transform.start/update/end/cancel`。
4. `input/sessions/NodeTransform.ts` 改为仅调用 `context.nodeInput.transform.*`。
5. 删除 `actors.node` 对 input 专用 transform 入口（保留纯领域命令即可）。

验收：

1. `NodeTransform` 不再依赖 `context.actors.node.*`。
2. 节点缩放/旋转交互行为与当前一致。

## Phase B: 完成 Edge 输入迁移（P0）

目标：把 `EdgeConnect` 与 `RoutingDrag` 统一进输入流水线。

实施：

1. 新增 `runtime/edgeInput/`（命名可简化为 `runtime/edge/interaction`，关键是与 edge 领域目录相邻）。
2. 提供：
   - `connect` 子流水线（start/update/commit/cancel）
   - `routing` 子流水线（start/update/end/cancel/removePoint）
3. `InputSessionContext` 增加 `edgeInput.connect.*`、`edgeInput.routing.*`。
4. `EdgeConnect.ts`、`RoutingDrag.ts` 改为仅转发。

验收：

1. Session 不再直调 `actors.edge.*`。
2. 连线、重连、routing 拖拽与双击删点行为不回退。

## Phase C: 完成 MindmapDrag 迁移（P0）

目标：`MindmapDrag` 走同一套 Pipeline 协议。

实施：

1. 新增 `runtime/mindmapInput/`（或 `runtime/mindmap/interaction`）。
2. 抽出 `Planner` 负责 root/subtree 两类拖拽会话。
3. Writer 统一写 `mindmapDrag`、`interactionSession` 与 commit 操作。
4. `input/sessions/MindmapDrag.ts` 改为只调 `context.mindmapInput.drag.*`。

验收：

1. session 不再直接调用 `actors.mindmap.*`。
2. root 移动与 subtree drop 逻辑不回退。

## Phase D: 收敛 InputSessionContext（P0）

目标：减少输入上下文噪音，降低理解成本。

实施：

1. `InputSessionContext` 保留最小入口：
   - `state`（只读为主）
   - `query`
   - `commands`（保留非交互类命令）
   - `pipelines`（`nodeInput/edgeInput/mindmapInput/...`）
2. 将 `actors` 从输入上下文逐步移除。
3. session 统一按 `context.<pipeline>.<action>` 风格调用。

验收：

1. 输入层不再依赖 actor 细节。
2. 新手可在一个上下文对象中快速找到所有输入入口。

## Phase E: 修复 lint 基线（P0）

当前待修问题（历史遗留）：

1. `src/input/core/InputPort.ts`：`interaction.pointer.isDragging` 赋值缺失。
2. `src/runtime/actors/edge/Actor.ts`：`ConnectInstance` 类型缺字段（`viewport/config`）。
3. `src/runtime/actors/mindmap/Actor.ts`：`DragInstance` 类型缺 `config` + 若干可空分支。
4. `src/runtime/write/MutationExecutor.ts`：`KernelRegistriesSnapshot` 类型引用失效。

验收：

1. `pnpm -F @whiteboard/engine lint` 通过。
2. `pnpm -r -F @whiteboard/engine -F @whiteboard/react build` 通过。

## Phase F: 补齐基准与文档（P1）

1. 修复 `bench:node-hint` 缺失路径（重建基准或移除脚本）。
2. 新增至少 2 个输入热路径基准：
   - `node-transform-frame`
   - `edge-routing-frame`
3. 回写 checklist：
   - `WHITEBOARD_ENGINE_SSOT_CHECKLIST.md`
   - `WHITEBOARD_SINGLE_PROJECTION_SNAPSHOT_CHECKLIST.md`

---

## 6. 建议执行顺序（一步到位）

1. Phase A（NodeTransform）
2. Phase B（EdgeConnect + RoutingDrag）
3. Phase C（MindmapDrag）
4. Phase D（InputSessionContext 收敛）
5. Phase E（lint 基线清零）
6. Phase F（基准与文档收口）

---

## 7. 完成定义（DoD）

满足以下条件，视为本轮“输入流水线收敛”完成：

1. 所有 pointer session 不再直接调用 `actors.*` 交互 API。
2. 输入路径统一为 `Session -> Gateway -> Planner -> Writer -> mutate`。
3. `runtime/actors` 中仅保留领域命令能力，不承载输入会话状态机。
4. `engine lint/build` 全通过。
5. `drag/transform/routing` 基准均满足既定阈值，无明显回归。

---

## 8. 非目标（本轮不做）

1. 不重写 core 的 operation/reducer 模型。
2. 不引入状态机框架（先用当前同步直调模型收敛复杂度）。
3. 不做对外 API 破坏式重命名（优先完成内部收口）。
