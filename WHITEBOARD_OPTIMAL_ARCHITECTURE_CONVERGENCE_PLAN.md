# Whiteboard 最优架构收敛方案

## 1. 目标与结论

本方案定义 Whiteboard Engine/React 的最终最优架构，以及从当前实现收敛到该架构的执行路径。

核心结论：

1. `document` 只保留一份真值，所有持久化变更只能走 `commands -> mutate -> reducer`。
2. `state` 只保留语义状态（低频、跨交互可见），不承载高频预览。
3. `render` 只保留交互临时态（高频、可丢弃），不参与历史与持久化。
4. `input/domain` 继续保留为输入领域编排层，但禁止重复实现 command/actor 的业务写逻辑。
5. `query/view` 只消费 `projection commit` 与状态快照，禁止反向写入。

---

## 2. 最终状态模型（SSOT）

| 层 | 存什么 | 写入口 | 是否持久化 | 典型频率 |
| --- | --- | --- | --- | --- |
| Document | 节点/边/脑图/order/viewport 等业务真值 | `commands.*` -> `mutate` | 是 | 中低频 |
| State | `tool/selection/interaction/mindmapLayout` 等语义状态 | `commands` 或受控 `InteractionWriter` | 否 | 中频 |
| Render | `interactionSession/nodePreview/guides/edgeConnect/routingDrag/...` | `InteractionWriter` | 否 | 高频（pointermove） |
| Projection | 由 document 归约后的读取快照 | `MutationExecutor` 同步 | 否（可重建） | 随 mutation |
| View | 面向 UI 的派生快照 | `view registry` 内部同步 | 否（可重建） | 随 projection/state/render |

硬约束：

1. 高频视觉预览一律写 `render`，禁止写 `state`。
2. 任何落库语义一律走 `mutate`，禁止直接改 `document store`。
3. `state` 中禁止放可由 `render/projection` 直接推导的字段。

---

## 3. 最优分层架构

## 3.1 L0 Host/UI 层（React/DOM）

职责：

1. DOM 事件归一化（pointer/key/wheel/focus）。
2. 交互策略（pan/wheel enable、min/max zoom、sensitivity）。
3. 调用 engine 的输入端口或 commands。

约束：

1. 不直接读写 engine 内部实现细节。
2. 不在 UI 层自行维护 document 真值副本。

## 3.2 L1 Input Session 层（`input/sessions`）

职责：

1. 会话识别与抢占（priority/canStart/start/update/end/cancel）。
2. 仅做路由转发，不做业务写入。

约束：

1. Session 不得直接写 `state/render/mutate`。
2. Session 不得包含领域算法（吸附、重排、group 规则等）。

## 3.3 L2 Input Domain 层（`input/domain`）

职责：

1. 领域交互编排（node/edge/mindmap/selection）。
2. 管理本交互 session（内存态）。
3. 生成统一输出（`RuntimeOutput`）。

约束：

1. 只负责交互流程，不重复 command 侧已有业务写逻辑。
2. 领域算法复用 shared/rules，不多处复制。

## 3.4 L3 InteractionWriter 层（统一写网关）

职责：

1. 统一将 `RuntimeOutput` 写入 `render/state/mutate`。
2. 统一处理 `interactionSession`、batch、frameBatch。
3. 统一互斥清理逻辑（clear kinds/reset transient）。

约束：

1. Domain 只 `emit(output)`，不自行散写。
2. Writer 是输入路径唯一写口。

## 3.5 L4 Command/Actor 层（领域命令）

职责：

1. 纯领域命令（create/update/delete/order/select...）。
2. 低频、显式业务动作。
3. 复用 mutation 编译与校验逻辑。

约束：

1. 不承载 pointer session 状态机。
2. 不与 input/domain 形成双实现。

## 3.6 L5 Mutation Pipeline（写入主链）

主链：

`commands -> WriteCoordinator -> MutationExecutor -> reduceOperations -> document -> projection -> events/history`

约束：

1. 任何持久化写入只能走该链路。
2. 历史记录只在该链路采集。

## 3.7 L6 Projection / Query / View（只读派生）

职责：

1. Projection：文档快照索引化。
2. Query：几何/命中/候选读取。
3. View：UI 渲染态派生。

约束：

1. 不反向写 document/state/render。
2. 不在 query/view 内嵌业务 mutation。

---

## 4. 目录收敛（目标形态）

```text
packages/whiteboard-engine/src/
  document/
  state/
  runtime/
    write/
    projection/
    query/
    view/
    actors/               # 仅命令与领域能力，不放输入会话
    render/               # render actor + store
  input/
    core/                 # InputPort / SessionEngine
    sessions/             # 仅会话路由
    domain/
      shared/
      node/
      edge/
      mindmap/
      selection/
      writer/             # 统一 InteractionWriter（可按域扩展）
    shortcut/
```

说明：

1. `input/domain` 保留，不迁回 `runtime/actors`。
2. `runtime/actors` 与 `input/domain` 职责严格分离：前者命令，后者交互。

---

## 5. 当前收敛重点（必须清零的分散点）

1. Edge routing 业务写逻辑在 `input/domain/edge/Gateway` 与 `runtime/actors/edge/Actor` 双份实现。
2. Selection 规则存在重复（框选与 actor 中各有 `applySelection` 语义）。
3. `interactionSession` 写逻辑分散在多个 RuntimeWriter。
4. 部分高频交互语义仍落入 `state`（应迁至 `render`）。

---

## 6. 收敛路线（不考虑重构成本版本）

## Phase 0：冻结规则与防回退

1. 定义 lint/CI 规则：
   - `input/sessions` 禁止 `state.write/render.write/mutate`。
   - `query/view` 禁止导入 `commands/mutate`。
2. 建立架构约束文档与 reviewer checklist。

完成标准：

1. 规则落地并在 CI 生效。

## Phase 1：抽象统一 InteractionWriter

1. 新建 `input/domain/writer/InteractionWriter`。
2. 统一 `interactionSession`、batch、frameBatch、mutations 提交。
3. 迁移 node/edge/mindmap/selection 各自 RuntimeWriter 到统一基类或组合实现。

完成标准：

1. 不再存在 3 份以上重复 `interactionSession` 写逻辑。

## Phase 2：消除双实现（Edge 优先）

1. Routing point 的增删改仅保留一套实现（建议命令侧单实现，input 仅调用）。
2. `input/domain/edge` 只保留交互流程与 payload 维护。

完成标准：

1. edge routing 的 mutation 生成实现只剩一个源码入口。

## Phase 3：Selection 规则单源化

1. `resolveSelectionMode/applySelection` 收敛到 `input/domain/shared/selection`。
2. actor 与 box 复用同一规则模块。

完成标准：

1. selection 规则函数在仓库中仅一份实现。

## Phase 4：状态边界校正（高频态 render 化）

1. 将高频 hover/group 预览态从 `state` 迁移到 `render`（如 `groupHovered`）。
2. React 渲染层改用 `useWhiteboardRenderSelector` 读取预览态。

完成标准：

1. pointermove 场景中 `state.write` 次数显著下降。

## Phase 5：actor 纯化

1. `runtime/actors/*` 去除输入会话清理/互斥细节，保留命令语义。
2. 输入取消与 transient reset 统一由 `input/domain + writer` 负责。

完成标准：

1. actor 中不再出现输入会话状态机分支。

## Phase 6：生命周期收口

1. `Lifecycle.stop/reset` 只调用输入域统一接口（如 `input.resetAll()`）。
2. 移除分散 `cancelX/resetX` 拼接。

完成标准：

1. 生命周期停止路径不再了解各域内部细节。

## Phase 7：读链路最终收敛

1. view registry 只监听：`projection commit + state keys + render keys`。
2. 删除一切额外旁路同步入口。

完成标准：

1. `view` 的状态同步入口可在一个文件一眼看全。

## Phase 8：回归与验收

1. 构建与类型检查。
2. 交互回归：拖拽/缩放/连线/重连/框选/undo/redo。
3. 基准：drag/transform/routing。

完成标准：

1. 行为不回退，性能不退化，架构约束全部通过。

---

## 7. 最终写入策略（必须遵守）

1. 持久化动作：`commands.*` -> `mutate`。
2. 语义 UI 状态：`commands` 或受控 writer 写 `state`。
3. 交互临时态：writer 写 `render`。
4. 禁止跨层直写：
   - session 直写 store
   - query/view 直写任何状态
   - actor 直管输入会话

---

## 8. 迁移后目标调用链

```text
DOM Event
  -> InputPort
  -> PointerSession (route only)
  -> Domain Planner/Rules/SessionStore
  -> InteractionWriter
      -> render/state (transient/semantic)
      -> mutate (document)
  -> Mutation Pipeline
      -> document
      -> projection
      -> query/view
      -> events/history
```

---

## 9. Definition of Done

满足以下全部条件才视为“收敛到最优架构”：

1. Document/State/Render 三层边界明确，且有自动化约束防回退。
2. 输入交互路径统一为 `Session -> Domain -> Writer -> Mutation Pipeline`。
3. command/actor 不再与 input/domain 双轨实现同一业务逻辑。
4. 高频交互不污染 state。
5. view/query 仅消费快照，不产生写行为。
6. 构建、类型、交互回归、性能基准全部通过。

---

## 10. 推荐执行策略（高强度版本）

在“不在乎重构成本”前提下，建议采用：

1. 两周内完成 Phase 0-4（先清边界和重复实现）。
2. 一周完成 Phase 5-7（纯化与收口）。
3. 一周回归与压测（Phase 8）。

优先级顺序：

`Edge 双实现清理` > `Writer 统一` > `State/Render 边界校正` > `Lifecycle/Actor 纯化`。

