# Whiteboard Engine Command/Mutation 统一改造清单

## 1. 目标

把 engine 内部统一为一条清晰主链：

1. `commands.*` 只表达业务请求（薄入口）。
2. 对应 `Actor` 同步直调执行业务规则。
3. Actor 只产出少量 `Mutation(Operation)[]`。
4. 统一提交到单一网关（建议 `MutationGateway`）执行并触发 graph/view/events。

核心原则：**外部 API 语义化，内部写路径唯一化，mutation 模型最小化**。

---

## 2. 当前现状（按代码）

## 2.1 统一管线已具备基础

- 已有 `plan -> execute` 结构：
  - `packages/whiteboard-engine/src/runtime/actors/document/command/plan.ts`
  - `packages/whiteboard-engine/src/runtime/actors/document/command/execute.ts`
- `executeMutationPlan` 已是 mutation 执行口：
  - `packages/whiteboard-engine/src/runtime/actors/document/command/handlers/helpers.ts`

## 2.2 仍存在可继续统一的问题

1. `Command` 类型仍较重，含较多“语法糖命令”：
   - `node.move/node.resize/node.rotate`
   - `edge.connect/edge.reconnect`
   - `viewport.panBy/zoomBy/zoomTo/reset`
   - `node.order.*` / `edge.order.*`
   - `group.create/group.ungroup`
2. 仍有旁路写路径，绕过统一提交网关：
   - `core.model.node.updateMany`
   - actor 内直接 `instance.apply(...)`
3. `planCommand` 仍是全局大 switch，职责集中在 document 层。

---

## 3. 全 Engine 可统一改造点（重点清单）

## 3.1 Node 域

当前入口：
- `packages/whiteboard-engine/src/api/commands/node.ts`

可统一项：
1. 将 `node.move/node.resize/node.rotate` 下沉为 NodeActor 内部能力。
2. 对外命令收敛为：
   - `node.create`
   - `node.update`
   - `node.delete`
3. `node.updateManyPosition` 从 `core.model.node.updateMany` 改为统一 mutation 提交（避免旁路）。

建议优先级：`P0`（高）。

---

## 3.2 Edge 域

当前入口：
- `packages/whiteboard-engine/src/api/commands/edge.ts`
- actor 写路径：
  - `packages/whiteboard-engine/src/runtime/actors/edge/Connect.ts`
  - `packages/whiteboard-engine/src/runtime/actors/edge/Routing.ts`

可统一项：
1. 将 `edge.connect/edge.reconnect` 下沉为 EdgeActor API（外部不再暴露为 command type）。
2. 对外命令收敛为：
   - `edge.create`
   - `edge.update`
   - `edge.delete`
3. `Connect/Routing` 内 `instance.apply(...)` 改成调用统一提交口（同一网关）。

建议优先级：`P0`（高）。

---

## 3.3 Viewport 域

当前入口：
- `packages/whiteboard-engine/src/api/commands/viewport.ts`

可统一项：
1. `panBy/zoomBy/zoomTo/reset` 作为 ViewportActor 内部 helper。
2. 对外仅保留一个最终写入命令（建议 `viewport.set`）。
3. 所有 viewport 变换在 actor 内计算后产 `viewport.update` mutation。

建议优先级：`P1`（中高）。

---

## 3.4 Order 域

当前入口：
- `packages/whiteboard-engine/src/api/commands/order.ts`

可统一项：
1. `bringToFront/sendToBack/bringForward/sendBackward` 下沉为 actor 计算逻辑。
2. 对外命令收敛为 `order.set`（node/edge 各一个）或统一 `order.update`。
3. 最终 mutation 可统一为 `node.order.set` / `edge.order.set`（由 actor 先算好结果）。

建议优先级：`P1`（中高）。

---

## 3.5 Group 域

当前入口：
- `packages/whiteboard-engine/src/api/commands/group.ts`

可统一项：
1. `group.create/ungroup` 下沉为 NodeActor（group 是 node 子语义）。
2. group 对外可保留语义 API，但不再占用独立 command type。
3. 最终只产 `node.create/node.update/node.delete` mutation。

建议优先级：`P1`（中）。

---

## 3.6 Mindmap 域

当前入口：
- `packages/whiteboard-engine/src/api/commands/mindmap.ts`

现状：
- document handler 已可直接产 mutation（不再依赖 intent build）。

可统一项：
1. 把 `mindmap.addChild/addSibling/moveSubtree/...` 从“command type”降为 MindmapActor API。
2. 对外 command 收敛为：
   - `mindmap.create`
   - `mindmap.replace`
   - `mindmap.delete`
3. 子树增删改移统一产：
   - `mindmap.node.create/update/delete/move/reorder`
4. `insertNode/moveSubtreeWithDrop` 这类组合动作保留在 actor，不进入 command type。

建议优先级：`P2`（中，改动面大）。

---

## 3.7 Input / Interaction / Transient / Lifecycle（非文档写路径）

相关位置：
- `packages/whiteboard-engine/src/input/**`
- `packages/whiteboard-engine/src/runtime/coordinator/ActorPort.ts`
- `packages/whiteboard-engine/src/api/commands/selection.ts`
- `packages/whiteboard-engine/src/api/commands/transient.ts`
- `packages/whiteboard-engine/src/runtime/lifecycle/**`

策略：
1. 这部分保持“状态控制命令”，不进入 mutation 管线（它们不是 document mutation）。
2. 但其内部如果要落盘写 doc，必须通过统一 mutation 提交口，禁止直接 `core.model` 或散落 `instance.apply`。

建议优先级：`P0`（规则落地）。

---

## 3.8 旁路写路径清理（必须做）

当前可见旁路：
1. `packages/whiteboard-engine/src/runtime/actors/node/Actor.ts`  
   `core.model.node.updateMany(...)`
2. `packages/whiteboard-engine/src/runtime/actors/node/services/NodeSizeObserver.ts`  
   `core.model.node.updateMany(...)`
3. `packages/whiteboard-engine/src/runtime/actors/node/Drag.ts`  
   `instance.apply(...)`
4. `packages/whiteboard-engine/src/runtime/actors/node/Transform.ts`  
   `instance.apply(...)`
5. `packages/whiteboard-engine/src/runtime/actors/edge/Connect.ts`  
   `instance.apply(...)`
6. `packages/whiteboard-engine/src/runtime/actors/edge/Routing.ts`  
   `instance.apply(...)`

统一目标：
- 引入单一提交口（建议 `MutationGateway.apply(mutations, meta)`），上述路径全部改为走该网关。

---

## 4. 建议目标架构（最终形态）

## 4.1 对外层（API）

- `commands` 保留语义，但是薄封装，直接调用对应 actor。
- `commands` 不直接拼操作，不直接调用 `core.model`。

## 4.2 领域层（Actor）

- Actor 暴露语义方法（同步直调）。
- Actor 内完成校验、推导、组合，产出最小 `Mutation[]`。

## 4.3 提交层（单网关）

- 单一写入口：
  - 执行 mutation
  - 同步 graph/view
  - 统一发事件（`doc.changed` / `command.applied`）
- 所有写路径只允许经过该层。

---

## 5. 分阶段实施（建议顺序）

## 阶段 A（P0）：先消除旁路，建立唯一写入口

1. 新增 `MutationGateway`（或在现有 `CommandGateway` 增 `applyMutations`）。
2. 把所有 `core.model.*` / actor 内 `instance.apply` 改走网关。
3. 保持现有 `Command` 类型不动，先保证“写路径唯一”。

验收：
- engine 代码中不再出现业务写入用 `core.model`、散落 `instance.apply`。

## 阶段 B（P1）：Node/Edge/Viewport/Order/Group 收敛命令

1. Node 收敛到 `create/update/delete`。
2. Edge 收敛到 `create/update/delete`。
3. Viewport 收敛到 `set`（内部 helper 负责 pan/zoom）。
4. Order 收敛到 `set`（actor 先计算最终顺序）。
5. Group 下沉到 NodeActor（不占独立 command type）。

验收：
- `types/command.ts` 体量明显下降。
- `planCommand` switch case 显著减少。

## 阶段 C（P2）：Mindmap 收敛

1. 高阶 mindmap 语义留在 MindmapActor。
2. command 侧仅保留 `mindmap.create/replace/delete`。
3. document 执行层只认最终 mindmap mutation。

验收：
- mindmap 高阶 command type 移除。
- 复杂树操作只在 actor 中维护。

---

## 6. 需要修改的目录（统一改造范围）

1. `packages/whiteboard-engine/src/types/command.ts`
2. `packages/whiteboard-engine/src/api/commands/*`
3. `packages/whiteboard-engine/src/runtime/actors/document/command/*`
4. `packages/whiteboard-engine/src/runtime/coordinator/CommandGateway.ts`
5. `packages/whiteboard-engine/src/runtime/actors/node/*`
6. `packages/whiteboard-engine/src/runtime/actors/edge/*`
7. `packages/whiteboard-engine/src/runtime/actors/mindmap/*`
8. `packages/whiteboard-engine/src/runtime/actors/node/services/NodeSizeObserver.ts`

---

## 7. 命名建议（简洁）

1. `Command`：只保留外部可见语义命令。
2. `Mutation`：统一等价于 `Operation`。
3. `planCommand`：仅做 command -> executionPlan。
4. `applyMutations`：唯一 mutation 提交入口。
5. 避免重复前后缀，目录内优先短名（如 `plan.ts` / `execute.ts` 已符合）。

---

## 8. 验收标准（全局）

1. engine 内部仅一条文档写路径（单网关）。
2. 无业务旁路 `core.model.*` 与散落 `instance.apply(...)`。
3. command 类型数下降，语义更聚焦。
4. Actor 直接负责本域能力，document 层只负责执行 mutation。
5. graph/view/event 同步逻辑在每次写入后一致触发。

