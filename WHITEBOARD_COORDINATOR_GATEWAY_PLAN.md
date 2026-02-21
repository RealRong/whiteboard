# Whiteboard Engine Coordinator 网关化下一阶段方案

## 1. 背景与目标

当前引擎已经完成大部分 Actor 化迁移，但主链路仍有明显“多入口直连”特征：

1. `instance/create.ts` 直接把 `createInputPort` 与 `edge/node/mindmap` actor 对接。
2. `Lifecycle` 的清理链路仍直接依赖多个 actor。
3. `commands`、`input sessions`、`lifecycle` 分别触达 actor，入口分散。

下一阶段目标是把 `Coordinator` 升级为**唯一网关**：

1. 外部只面对一个编排入口（逻辑上单入口，API 可保持原样）。
2. 领域逻辑全部收敛到 actor 内部。
3. `Coordinator` 只做路由、事务边界、结果聚合、事件发射。
4. Actor 尽量只处理自己领域，跨域依赖通过显式端口最小化。

## 2. 设计原则

1. 单入口原则：所有外部请求最终都经过 `Coordinator`。
2. 直调原则：内部协作优先同步调用，不用内部事件总线驱动业务。
3. 内聚原则：状态、缓存、规则、策略归 actor 自己维护。
4. 最小接口原则：actor 只暴露 `commands/query/lifecycle` 三组能力。
5. 单写口原则：文档与状态写入遵守既有写口，不在多个层级重复写。

## 3. 目标架构

## 3.1 逻辑分层

1. `Coordinator`：网关与编排。
2. `Actors`：领域服务（node/edge/mindmap/graph/view/document/...）。
3. `State/Graph/View`：存储、投影、派生。
4. `Events`：仅对外通知（`instance.events`）。

## 3.2 外部 API 形态

为了避免破坏 SDK，外部保持现有接口：

1. `instance.apply`
2. `instance.tx`
3. `instance.input.handle/configure/reset`
4. `instance.lifecycle.start/update/stop`

但这些接口全部仅是 `Coordinator` 的代理，不再各自直连 actor。

## 3.3 Coordinator 内部编排面

`Coordinator` 内部建议显式维护四组网关面（可先作为私有模块，不必拆文件）：

1. `change`：`apply/tx`，调 `DocumentActor -> GraphActor -> ViewActor`。
2. `input`：`handle/configure/reset`，调 `InputActor`（或输入域服务）再落到领域 actor。
3. `lifecycle`：`start/update/stop`，统一生命周期顺序和清理。
4. `queryBridge`：仅在需要跨域读快照时使用，避免 actor 互相读内部状态。

## 4. Actor 契约设计

## 4.1 统一返回模型

建议 actor command 返回统一结果结构，减少 Coordinator 特判：

```ts
type ActorResult<T = void> = {
  ok: boolean
  value?: T
  effects?: Array<{ type: string; [k: string]: unknown }>
  reason?: string
}
```

约束：

1. 失败由 `ok=false + reason` 表达，不抛业务异常。
2. 输入副作用通过 `effects` 返回给 `Coordinator/InputPort` 统一处理。
3. Actor 不直接操作 DOM，不直接 emit 对外事件。

## 4.2 Actor API 形态

每个 actor 暴露三组最小 API：

```ts
type DomainActor = {
  commands: Record<string, (...args: unknown[]) => ActorResult | Promise<ActorResult>>
  query: Record<string, (...args: unknown[]) => unknown>
  lifecycle?: {
    start?: () => void
    stop?: () => void
    resetTransient?: () => void
  }
}
```

说明：

1. `commands` 负责写行为。
2. `query` 只读且纯。
3. `lifecycle` 只处理本域资源。

## 5. 请求流转（目标形态）

## 5.1 输入请求

1. React 层把 DOM 事件规范化为 `InputEvent`。
2. 调用 `instance.input.handle(event)`。
3. 实际进入 `Coordinator.handleInput`。
4. Coordinator 调输入域路由，再调用目标 actor `commands.*`。
5. 汇总 `effects` 返回给外部执行。

## 5.2 变更请求

1. 调用 `instance.apply/tx`。
2. `Coordinator.change` 执行 `DocumentActor.apply`。
3. 调 `GraphActor.syncAfterApply`。
4. 调 `ViewActor.sync`。
5. Coordinator 在事务尾部统一 `emit` 外部事件。

## 5.3 生命周期请求

1. 调用 `instance.lifecycle.start/update/stop`。
2. 统一进入 `Coordinator.lifecycle`。
3. Coordinator 按固定顺序调各 actor/service lifecycle。
4. Coordinator 统一处理 reset/cleanup，不再分散在多个入口。

## 6. 职责边界矩阵

| 领域 | 负责内容 | 不负责内容 |
| --- | --- | --- |
| Coordinator | 请求路由、顺序编排、事务边界、事件发射 | 领域规则实现、几何计算细节 |
| Node Actor | node 拖拽/变换/override/提交 | edge 连接策略、mindmap 布局 |
| Edge Actor | 连接、重连、路由拖拽、hover | node transform 规则 |
| Mindmap Actor | mindmap 拖拽与布局域状态 | 通用 node/edge 行为 |
| Graph Actor | graph hint/sync/projector 协调 | DOM 输入、UI 事件采集 |
| View Actor | graph change 到 view 同步 | 业务变更决策 |

## 7. 目录与命名建议

保持简洁和一致，文件名使用 PascalCase：

1. `packages/whiteboard-engine/src/runtime/coordinator/Coordinator.ts`
2. `packages/whiteboard-engine/src/runtime/coordinator/InputGateway.ts`
3. `packages/whiteboard-engine/src/runtime/coordinator/ChangeGateway.ts`
4. `packages/whiteboard-engine/src/runtime/coordinator/LifecycleGateway.ts`

说明：

1. 如果暂时不拆文件，可先在 `Coordinator.ts` 内部私有类实现，后续再拆。
2. 同目录下避免重复前后缀，例如用 `ChangeGateway`，不写 `CoordinatorChangeGateway`。

## 8. 分阶段实施（一步到位风格）

## Phase 1：入口收敛

1. 让 `instance` 暴露的 `apply/tx/input/lifecycle` 全部只代理 `Coordinator`。
2. 移除 `create.ts` 中对 actor 的外部直连路径。
3. 让输入链经过 Coordinator 再下发 actor。

完成标准：从 `instance` 看不到对 actor 的直接调用装配。

## Phase 2：输入域收敛

1. 把 `InputPort` 中的业务判定逐步下沉到输入域路由或 actor。
2. `InputPort` 保留最小职责：事件分发与 effect 执行协议。
3. 统一 pointer session 到 Coordinator 注入的输入能力端口。

完成标准：`InputPort` 不再承载跨域业务规则。

## Phase 3：生命周期收敛

1. `Lifecycle` 行为通过 Coordinator 编排，不直接跨域触达。
2. `Cleanup` 的跨域调用改为 Coordinator 统一顺序调度。
3. 各 actor 只公开本域 `lifecycle/resetTransient`。

完成标准：生命周期依赖图可由 Coordinator 单点读懂。

## Phase 4：文档与查询收敛

1. 统一 `change -> graph -> view -> emit` 链路的网关实现。
2. 补齐跨域只读桥（queryBridge），减少 actor 直接互查。
3. 删除遗留兼容路径与重复入口。

完成标准：主业务只需看 `Coordinator` + 单域 actor 即可追踪全链路。

## 9. 风险与控制

1. 风险：Coordinator 膨胀成大类。  
控制：拆 `Input/Change/Lifecycle` 子网关，Coordinator 只组合。

2. 风险：Actor 接口过大。  
控制：强制 `commands/query/lifecycle` 三分组，定期裁剪未用 API。

3. 风险：迁移过程行为回归。  
控制：每个 phase 结束后执行 `engine lint + bench + react lint`。

## 10. 验收标准

1. 外部入口逻辑上只有 Coordinator 一个网关。
2. 领域行为都在 actor 目录内可定位。
3. `InputPort`、`Lifecycle`、`Commands` 不再直接分散耦合 actor 实现细节。
4. 对外 `instance.events` 保持稳定，内部不以事件总线驱动主业务。
5. 新人可按“Coordinator -> Actor”两跳定位任何主流程。
