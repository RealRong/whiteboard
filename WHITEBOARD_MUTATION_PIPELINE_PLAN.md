# Whiteboard Mutation Pipeline 设计方案

## 1. 结论

当前 `change` 管线把 **Intent** 和 **Mutation** 混在一起，导致协调层和归约层复杂度持续上升。  
目标是改成行业常见的分层：

- 边界层：`Command`（Intent）
- 内核层：`Mutation`（唯一可执行变更）
- 存储与回放：基于 `Mutation`，不基于 `Command`

一句话：**Intent 只负责表达“想做什么”，Mutation 负责“实际改了什么”。**

---

## 2. 当前问题

当前 `packages/whiteboard-engine/src/types/change.ts` 的 `Change` 同时承载两类语义：

- Intent 风格：`edge.connect`、`mindmap.addChild`
- Mutation 风格：`node.update`、`edge.update`

这会带来三个问题：

1. `reduce.ts` 成为超大业务翻译层（职责过宽）。
2. `apply`/`history`/`sync` 无法只围绕一种稳定语义构建。
3. Actor 分层困难：每个 actor 都会被迫理解“别人领域的 intent”。

---

## 3. 目标架构

## 3.1 流程

1. 外部调用 `instance.commands.*`（或统一 `coordinator.request(command)`）。
2. `Coordinator` 路由到目标 actor。
3. actor 读取 query/state，产出 `Mutation[]`。
4. `Coordinator` 调用 `DocumentActor.apply(mutations, meta)`。
5. `DocumentActor` 调 `core.apply.operations` 执行。
6. `GraphActor`/`ViewActor`/`HistoryActor` 基于 mutation 结果同步。
7. 对外发事件（仅通知，不参与内部编排）。

## 3.2 职责边界

- `Coordinator`：网关、路由、提交事务。
- `Domain Actor`：领域规则与 Mutation 生成。
- `DocumentActor`：Mutation 执行与结果聚合。
- `GraphActor`：图快照/投影同步。
- `ViewActor`：派生视图同步。
- `HistoryActor`：记录 mutation 批次（undo/redo 入口）。

---

## 4. 核心类型设计

## 4.1 Command（Intent）

```ts
type CommandMeta = {
  source: 'ui' | 'shortcut' | 'remote' | 'import' | 'system'
  actor?: string
  timestamp?: number
}

type CommandEnvelope<T extends EngineCommand = EngineCommand> = {
  type: T['type']
  payload: T['payload']
  meta?: CommandMeta
}
```

`EngineCommand` 按领域拆分（node/edge/group/viewport/mindmap），仅表达业务意图。

## 4.2 Mutation（唯一执行单元）

建议直接对齐 core operation，避免重复 DSL：

```ts
type Mutation = Operation

type MutationBatch = {
  id: string
  docId?: string
  source: CommandMeta['source']
  actor?: string
  timestamp: number
  mutations: Mutation[]
}
```

## 4.3 Actor 契约

```ts
interface CommandActor<TCommand extends EngineCommand> {
  canHandle(type: TCommand['type']): boolean
  handle(command: TCommand, ctx: ActorContext): Promise<Mutation[]>
}
```

```ts
interface DocumentActor {
  apply(batch: MutationBatch): Promise<ApplyResult>
}
```

---

## 5. API 设计（简洁命名）

## 5.1 对外 API

- 保留：`instance.commands.node.* / edge.* / ...`
- 新增统一入口（推荐）：`instance.request(command)`

`commands.*` 内部只做参数组装，最终都走 `request(command)`。

## 5.2 Coordinator API

```ts
interface Coordinator {
  request(command: CommandEnvelope): Promise<DispatchResult | undefined>
  commit(mutations: Mutation[], meta: CommandMeta): Promise<ApplyResult>
}
```

`request` 用于 intent；`commit` 用于测试/导入等直接 mutation 场景。

---

## 6. 文件与命名方案

采用 PascalCase 文件命名，目录内避免重复前后缀。

```txt
packages/whiteboard-engine/src/
  commands/
    types.ts
    normalize.ts
  runtime/actors/
    document/
      Actor.ts
      MutationPipeline.ts
    node/
      Actor.ts
      Command.ts
      Mutation.ts
    edge/
      Actor.ts
      Command.ts
      Mutation.ts
    mindmap/
      Actor.ts
      Command.ts
      Mutation.ts
  runtime/coordinator/
    Coordinator.ts
    CommandRouter.ts
```

说明：

- `Command.ts`：该域 command 定义与校验。
- `Mutation.ts`：该域 command -> mutation 的纯函数。
- `Actor.ts`：组合 query/state + `Mutation.ts`，对外暴露最小 API。

---

## 7. 落地步骤（不保留兼容层）

## 阶段 A：类型解耦

1. 新增 `commands/types.ts`，定义 `EngineCommand`。
2. `types/change.ts` 拆分为：
   - `commands`（intent）
   - `mutations`（operation）
3. 将 `change` 命名逐步替换为 `command` 或 `mutation`，禁止混用语义词。

## 阶段 B：管线改造

1. 删除 document change `reduce.ts` 中的 intent 分发逻辑。
2. 各 actor 负责 `command -> mutations`。
3. `DocumentActor` 只处理 `mutations -> core.apply.operations`。

## 阶段 C：入口收敛

1. `Coordinator.request(command)` 成为唯一 intent 网关。
2. `instance.commands.*` 改成薄包装，统一调用 `request`。
3. history/remote replay 统一消费 `MutationBatch`。

---

## 8. 复杂度下降点

改造后复杂度下降来自三个方面：

1. **语义单一**：内核只看 mutation。
2. **职责收敛**：actor 只管本域 intent 翻译，不在中央大 switch 汇总。
3. **链路稳定**：undo/redo/sync/replay 都依赖同一批 mutation 数据模型。

---

## 9. 风险与约束

1. 迁移期需要一次性重命名与调用点替换，改动面较大。
2. mindmap/edge 这类高阶 intent 要优先落地 actor 内翻译，避免回流到 coordinator。
3. 必须禁止新增“intent 直接进入 document apply”的旁路。

---

## 10. 验收标准

1. `DocumentActor` 不再接受 `EngineCommand`，只接受 `MutationBatch`。
2. 不存在全局 `switch(change.type)` 的跨域大归约器。
3. 任意 command 可追踪到明确的 `Mutation[]` 产出。
4. history/sync/replay 数据源统一为 mutation 批次。

