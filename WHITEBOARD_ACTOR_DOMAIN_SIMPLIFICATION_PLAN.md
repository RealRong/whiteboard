# Whiteboard Engine Actor 领域化简化方案

## 1. 目标

将 engine 继续收敛为一套更容易理解的模型：

- Actor 就是领域边界（Node/Edge/Mindmap/Viewport/Order/Group）
- 外部请求统一从网关进入
- 文档写入统一走单一 mutation 网关
- 去掉 commands 中重复的业务装配逻辑
- 减少链路跳转层级，让新手能直接定位“谁负责什么”

---

## 2. 核心原则

1. Actor 即领域
- 每个 Actor 维护本领域规则、校验、组装 mutation。
- Actor 对外暴露最小可用 API。

2. 单写入口
- 只有 ChangeGateway 能调用 `core.apply.operations`。
- 任何领域写入都必须提交 mutation 给 ChangeGateway。

3. 网关编排，不做业务
- Coordinator（或同等网关）只做路由与编排，不做领域规则。
- 领域规则只在对应 Actor 内。

4. Commands 薄门面
- `src/api/commands` 不再组装复杂逻辑。
- commands 仅转发到网关或 Actor。

5. 无兼容层
- 一步迁移，不保留旧路径。
- 删除旧实现，避免双轨维护。

---

## 3. 目标链路

### 3.1 写入链（目标）

`instance.commands.* -> CoordinatorGateway.route(...) -> DomainActor -> Mutation[] -> ChangeGateway.applyMutations -> core.apply.operations -> graph/view sync -> events`

### 3.2 交互链（目标）

`DomInputAdapter -> instance.input.handle -> PointerSession -> Actor(交互会话) -> DomainActor API -> Mutation[] -> ChangeGateway`

说明：
- 交互 Actor 可以调用本领域 Actor 的领域 API。
- 交互 Actor 不直接调用 `core.apply`。

---

## 4. 模块职责重整

### 4.1 建议目录

- `packages/whiteboard-engine/src/runtime/gateway/`
  - `CoordinatorGateway.ts`（新增，统一路由入口）
  - `ChangeGateway.ts`（保留，唯一写入提交）
- `packages/whiteboard-engine/src/runtime/actors/node/`
  - `Actor.ts`（node 领域 API + 交互 API）
- `packages/whiteboard-engine/src/runtime/actors/edge/`
  - `Actor.ts`
- `packages/whiteboard-engine/src/runtime/actors/mindmap/`
  - `Actor.ts`
- `packages/whiteboard-engine/src/api/commands/`
  - 保留薄门面（后续可选删除）

### 4.2 明确禁止

- Actor -> commands 回调（反向依赖）
- Actor 直接调用 `core.apply.operations`
- 多处写入入口并存

---

## 5. API 设计（简洁版）

## 5.1 CoordinatorGateway

```ts
class CoordinatorGateway {
  execute(request: EngineRequest): Promise<DispatchResult>
  executeBatch(requests: EngineRequest[]): Promise<DispatchResult[]>
}
```

`EngineRequest` 示例：
- `node.create`
- `node.update`
- `edge.create`
- `mindmap.moveSubtree`

## 5.2 Domain Actor

```ts
class NodeActor {
  create(input: NodeCreateInput): Mutation[]
  update(input: NodeUpdateInput): Mutation[]
  delete(input: NodeDeleteInput): Mutation[]

  // 交互 API
  startDrag(input: StartDragInput): boolean
  updateDrag(input: UpdateDragInput): Mutation[]
  endDrag(input: EndDragInput): Mutation[]
}
```

约定：
- 领域 API 返回 `Mutation[]`。
- 需要即时 UI 状态（如 transient）时，仍由 actor 自己维护状态，但文档写入返回 mutation。

## 5.3 Commands（薄门面）

```ts
commands.node.create(payload)
=> coordinator.execute({ type: 'node.create', payload })
```

---

## 6. 分阶段落地计划

## Phase 1：建立网关路由骨架

目标：把 commands -> actor 的入口收敛到 `CoordinatorGateway.execute`。

动作：
- 新增 `runtime/gateway/CoordinatorGateway.ts`。
- 在 `instance/create.ts` 中注入 `actors + changeGateway` 给 coordinator。
- commands 改为统一调 coordinator，不再直接组装 mutation。

验收：
- `src/api/commands/*` 中不再出现复杂业务逻辑（只转发）。
- 所有写入最终都走 `changeGateway.applyMutations`。

## Phase 2：Node/Edge 领域逻辑归位

目标：把 node/edge 相关 mutation 组装都归到 actor。

动作：
- 将 `api/commands/node.ts`、`api/commands/edge.ts` 的业务装配迁入 `runtime/actors/node/Actor.ts`、`runtime/actors/edge/Actor.ts`。
- 清理 actor 对 `commands.transient` 的反向依赖，改成 actor 内直接处理 transient 状态。

验收：
- `api/commands/node.ts`、`api/commands/edge.ts` 仅保留参数适配和转发。
- Node/Edge 行为变更只需看对应 actor 目录。

## Phase 3：Group/Order/Viewport/Mindmap 归位

目标：消除 `api/commands` 的领域计算。

动作：
- 把 group/order/viewport/mindmap 的计算和 mutation 组装迁入对应 actor。
- `commands/*` 仅保留网关调用。

验收：
- `api/commands` 目录仅保留薄 facade。
- 领域规则 100% 在 actor 内。

## Phase 4：可选删除 commands 层

目标：进一步缩短链路。

动作：
- 若外部 API 允许变更，可让 `instance` 直接暴露 `coordinator.execute` 风格接口。
- 删除 `api/commands`。

验收：
- 对外入口统一单点。
- 链路更短：`instance -> coordinator -> actor -> changeGateway`。

---

## 7. 复杂度控制指标

每一阶段完成后检查：

1. 写链路层级
- 目标：主写链路不超过 4 跳。

2. 领域定位
- 目标：任一行为（如 node drag commit）能在一个 actor 目录内定位主要规则。

3. 双写入口
- 目标：`core.apply.operations` 仅由 `ChangeGateway` 调用。

4. 反向依赖
- 目标：actor 不依赖 commands。

5. 代码重复
- 目标：相同命令类型的 mutation 组装只出现一次。

---

## 8. 第一批建议先做的文件

- `packages/whiteboard-engine/src/runtime/gateway/CoordinatorGateway.ts`（新增）
- `packages/whiteboard-engine/src/instance/create.ts`（接入 coordinator）
- `packages/whiteboard-engine/src/api/commands/index.ts`（改为统一转发）
- `packages/whiteboard-engine/src/api/commands/node.ts`（去业务化）
- `packages/whiteboard-engine/src/api/commands/edge.ts`（去业务化）
- `packages/whiteboard-engine/src/runtime/actors/node/Actor.ts`（补充领域写 API）
- `packages/whiteboard-engine/src/runtime/actors/edge/Actor.ts`（补充领域写 API）

---

## 9. 最终预期形态

- 新手看入口：`instance -> CoordinatorGateway`
- 看领域行为：直接进对应 `runtime/actors/<domain>/Actor.ts`
- 看落盘路径：`runtime/gateway/ChangeGateway.ts`

即：
- 一个对外入口
- 一套领域实现
- 一个写入出口

这套结构最接近“同步直调微服务”在单进程内的简化实现。
