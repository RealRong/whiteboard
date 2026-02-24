# Whiteboard Engine Actor 化与 Host 化设计方案（精简版）

## 1. 目标

本方案目标是用最小复杂度实现四阶段解耦：

1. `React/Host`
2. `Gateway`
3. `Actors`
4. `Mutate`

每个阶段只处理自己的输入，并向下一阶段输出规范化结果，不跨层调用实现细节。

---

## 2. 为什么要重写

之前设计里有以下冗余：

1. `EngineRequest` / `ActorRequest` / `MutationPlan` 三层请求类型过多。
2. `routeInput` / `routeHost` / `routeCommand` 三套公开路由入口会膨胀。
3. 概念多于收益，不利于新成员理解和维护。

本版收敛策略：

1. 保留一个统一请求类型 `EngineRequest`。
2. Gateway 只保留一个公开入口 `dispatch(request)`。
3. Actor 返回 `Operation[]`，不单独引入 `MutationPlan` 类型。

---

## 3. 最小化四阶段架构

```text
React/Host
  -> EngineRequest
Gateway.dispatch(request)
  -> actor handler
Actor handler
  -> Operation[]
Mutate.apply(operations, source)
  -> reduce -> projection -> view -> events
```

### 3.1 统一请求契约（唯一）

```ts
type EngineRequest = {
  action: string        // 例如: input.pointerMove / host.nodeMeasured / node.update
  payload: unknown
  source: CommandSource // ui / interaction / system / ...
}
```

说明：

1. `action` 使用命名空间前缀表达类别，不再拆 `kind`。
2. `payload` 由上游 adapter 先做规范化。
3. Gateway 只依赖此契约。

### 3.2 Gateway（薄层，不做业务）

Gateway 只做四件事：

1. `normalize`（兜底校验）
2. `lookup`（通过 action 找 handler）
3. `dispatch`（调用 actor handler）
4. `commit`（统一提交 mutate）

对外仅暴露：

```ts
dispatch(request: EngineRequest): Promise<DispatchResult>
```

不对外暴露：

1. `routeInput`
2. `routeHost`
3. `routeCommand`

这些可以作为内部私有函数存在，但不是公开 API。

### 3.3 Actor（纯领域决策）

Actor handler 推荐签名：

```ts
type ActorHandler = (payload: unknown, ctx: ActorContext) => Operation[] | Promise<Operation[]>
```

约束：

1. Actor 不直接调用 `mutate`。
2. Actor 不直接写 projection/view。
3. Actor 只产出 operations（必要时返回附加值，但不新增一层通用 DTO）。

### 3.4 Mutate（唯一写入口）

Mutate 层职责：

1. `reduceOperations`
2. `projection.sync`
3. `view.applyProjection`
4. 对外事件发射（如 `doc.changed`）

所有写路径最终必须进入该层。

---

## 4. 服务发现模式（替代“大路由文件”）

为了避免 Gateway 变成巨大 `switch`，使用注册表：

```ts
register(action: string, handler: ActorHandler)
dispatch(request) => registry.get(request.action)
```

这等价于单进程内的“请求找服务”，但不会让请求对象耦合具体 actor 实现。

建议 action 命名：

1. `input.pointer.down`
2. `input.pointer.move`
3. `host.node.measured`
4. `host.container.resized`
5. `node.update`
6. `edge.create`

---

## 5. Host 化（保持简洁）

从 engine 移出的职责：

1. `NodeSizeObserver`
2. `ContainerSizeObserver`

放在 React/Host adapter 中，输出 `EngineRequest`：

1. `host.node.measured`
2. `host.container.resized`

Host adapter 职责：

1. 绑定 `ResizeObserver`
2. `requestAnimationFrame` 聚合
3. epsilon 去抖
4. 调用 `gateway.dispatch(request)`（或等价外部入口）

---

## 6. 现有对外 API 的兼容映射（内部统一到 dispatch）

对外仍可保留以下入口以保持易用：

1. `commands.*`
2. `input.handle(event)`
3. `commands.host.*`（新增）

但三者内部都转换成 `EngineRequest` 后进入同一 `dispatch`。

这样可以做到：

1. 外部 API 易用。
2. 内部执行路径统一。
3. 不引入额外请求层。

---

## 7. 迁移步骤（一步步降复杂度）

## Step 1：引入单入口 dispatch

1. 新增 `EngineRequest` 类型。
2. 新增 `dispatch(request)` 与 registry。
3. 先接入 `commands.node/edge/mindmap` 主路径。

## Step 2：接入 input 与 host

1. `input.handle` 转 `EngineRequest` 再 dispatch。
2. 新增 `commands.host`（或 host adapter 直接 dispatch）。

## Step 3：迁移 observer 到 React

1. 删除 engine 内 `NodeSizeObserver` 与 `ContainerSizeObserver`。
2. React adapter 接管监听并上报 host request。

## Step 4：清理装配层临时桥接

1. 去掉临时回调变量（如后绑定 hook）。
2. mutate 后直接走 gateway 内部协同（必要时直调对应 actor）。

---

## 8. 明确不做（防止过度设计）

1. 不新增 `ActorRequest` 类型。
2. 不新增 `MutationPlan` 通用类型。
3. 不做三套公开 route API。
4. 不引入内部事件总线。
5. 不做中间件框架化。

---

## 9. 验收标准

1. 公开写入路径最终都走 `dispatch -> actor -> mutate`。
2. `whiteboard-engine` 不再直接创建 `ResizeObserver`。
3. Gateway 文件不含业务规则，只含路由与提交。
4. Actor 内部职责清晰，返回 operations 为主。
5. 构建通过：
   1. `pnpm -r -F @whiteboard/core -F @whiteboard/engine -F @whiteboard/react build`

---

## 10. 目标状态

1. Host：负责环境监听与规范化输入。
2. Gateway：负责统一入口与服务发现。
3. Actor：负责领域决策与操作生成。
4. Mutate：负责唯一写入与读模型同步。
