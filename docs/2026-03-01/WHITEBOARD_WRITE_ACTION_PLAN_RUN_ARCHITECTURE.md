# Whiteboard Write 侧 Action-Plan-Run 架构设计与迁移方案

更新时间：2026-03-03
适用范围：`packages/whiteboard-engine/src/runtime/write`

## 1. 结论（先给答案）

Write 侧推荐收敛为单写入通道的三段式流水线：

1. `Action`：表达意图（命令语义），不执行写入。
2. `Plan`：纯函数产出 `Draft`（`operations`/`value`/失败信息）。
3. `Run`：唯一允许副作用的执行器（apply/history/changeBus/sync）。

核心规则：

1. `api/*` 不再直接调用 `instance.mutate`。
2. 任何写入都必须先产出 `Draft`，再进入 `Run`。
3. `core` 继续保持纯算法，不引入 runtime 副作用概念。

### 1.1 落地状态（已完成）

以下内容已在 `packages/whiteboard-engine/src/runtime/write` 完成落地：

1. 新增 `model.ts`，并由 `plan/index.ts` 统一规划，形成统一写流水线。
2. `plan/node.ts`、`plan/edge.ts`、`plan/viewport.ts`、`plan/mindmap.ts` 作为纯计划层。
3. 已新增单入口 `commands.write.apply({ domain, command, source? })`，并将语法糖收敛到 `runtime/write/api.ts`。
4. `mindmap` 纯计划基座已下沉到 `@whiteboard/core/kernel` 的 `corePlan.mindmap.*`，engine 不再保留 `plan/mindmapBase.ts`。
5. `flow.ts` 已删除，执行逻辑收敛为 `plan -> writer.applyDraft`。
6. 架构脚本已增加约束：`runtime/write/api` 禁止直接调用 `instance.mutate`。

---

## 2. 当前问题（为何要改）

当前 Write 侧存在以下结构性问题：

1. 命令层职责过重：部分 `commands` 同时做“决策 + 执行”，出现直连 `instance.mutate`。
2. 流水线不统一：有的路径先产 `operation`，有的路径直接执行，认知模型不一致。
3. 副作用分散：history/changeBus/sync 虽集中在 `Writer`，但命令层仍可绕过统一入口。
4. 可组合性弱：跨命令合并执行（事务化/batch）困难。
5. 可测试性一般：命令单测难以只验证“计划结果”，因为夹杂执行副作用。

---

## 3. 目标与非目标

## 3.1 目标

1. 单一写入口：`Run` 负责所有文档写入。
2. 命令纯化：命令产出 `Draft`，不触发写入副作用。
3. 流程一致：所有写能力统一为 `Action -> Plan -> Run`。
4. 边界清晰：`core` 算法层与 engine runtime 执行层严格分离。
5. API 收敛：对外保留语义糖，内部统一经由 `commands.write.apply({ domain, command, source })`。

## 3.2 非目标

1. 不改变业务语义（`invalid/cancelled`、返回 value、history 捕获策略保持一致）。
2. 不在本方案中引入多文档事务或分布式同步协议改造。
3. 不把 runtime 依赖下沉到 `core`。

---

## 4. 目标架构

```txt
api (语义入口)
    -> model (WriteInput + Draft)
    -> plan (纯函数，生成 Draft)
    -> writer.applyDraft (唯一副作用执行：apply/history/bus/sync)
```

### 4.1 分层职责

1. `api`
  - 兼容现有调用手感（如 `commands.node.create(...)`、`commands.mindmap.apply(...)`）。
  - 仅负责参数转 `WriteInput` + 调用 `commands.write.apply`。

2. `model`
  - 定义统一命令联合类型（`domain + command`）和 `Draft` 契约。
  - 不耦合执行细节。

3. `plan`
  - 读取只读上下文（`doc/query/config/registries/...`）。
  - 返回 `Draft`，不允许 mutate。

4. `writer.applyDraft`
  - 输入 `Draft + source`。
  - 执行 `reduce/apply`、history capture、changeBus publish、read 同步。
  - 映射统一 `DispatchResult`。

---

## 5. 类型契约（建议）

## 5.1 Draft 契约

```ts
type DraftOk<T = unknown> = {
  ok: true
  operations: Operation[]
  value?: T
}

type DraftFail = {
  ok: false
  reason: 'invalid' | 'cancelled'
  message?: string
}

type Draft<T = unknown> = DraftOk<T> | DraftFail
```

说明：

1. `Draft` 是 plan 层唯一输出。
2. 失败直接在 plan 层返回，run 层不再二次猜测失败原因。

## 5.2 Planner 上下文

```ts
type PlannerContext = {
  doc: Document
  query: Instance['query']
  config: InstanceConfig
  registries: InternalInstance['registries']
  ids: {
    node: () => string
    edge: () => string
    mindmapTree: () => string
    mindmapNode: () => string
  }
}
```

说明：

1. 只读上下文，不暴露 `mutate`。
2. `ids` 允许 planner 产可执行 operation，但仍是纯计算。

## 5.3 Run 接口

```ts
type RunInput<T = unknown> = {
  draft: Draft<T>
  source: CommandSource
}

type RunOutput<T = unknown> = Promise<DispatchResult & { value?: T }>
```

---

## 6. 推荐目录重排（可逐步迁移）

建议按“流水线优先”组织，而不是按“命令类型优先”组织：

```txt
runtime/write/
  api.ts
  model.ts
  writer.ts
  plan/
    node.ts
    edge.ts
    mindmap.ts
    viewport.ts
```

说明：

1. `api.ts` 是语义糖层（薄）。
2. `plan/*` 是纯计划层（核心）。
3. `writer.applyDraft` 是唯一执行层（强约束）。

---

## 7. 与现有模块映射

1. 当前 `writer.ts` 承担 apply/history/changeBus/sync 执行内核。
2. 原 `commands/mindmap/base.ts` 已进一步下沉到 `@whiteboard/core/kernel/plan.ts` 的 `corePlan.mindmap.*`，`plan/mindmap.ts` 仅保留路由与上下文拼装。
3. 当前 `api.ts` 改造为 API 适配层，仅负责构造 `domain + command`。
4. 当前 `instance.mutate` 对外语义不变，但内部应改为：
  - `mutate(operations, source)` 作为 run 层低级能力。
  - `commands.write.apply({ domain, command, source })` 作为命令层标准入口。

---

## 8. 命令调用形态（内部目标）

当前（问题形态）：

1. `commands.xxx()` 内部直接 `instance.mutate(...)`。

目标（统一形态）：

1. `commands.xxx()` -> `commands.write.apply({ domain, command, source: 'ui' })`
2. `write.apply` -> `plan({ domain, command }, ctx)` -> `writer.applyDraft(draft, source)`

---

## 9. 迁移步骤（低风险顺序）

## Phase 0：基线锁定

1. 保持现有 API 不变。
2. 补一组快照/行为回归（至少覆盖 create/update/delete/mindmap move）。

## Phase 1：引入 Draft 与单入口壳层

1. 新增 `Draft` 类型与 `commands.write.apply({ domain, command, source })`。
2. 单入口先桥接旧实现（保证无行为变化）。

## Phase 2：优先迁移 mindmap

1. `commands/mindmap` 改成纯 action 适配。
2. 把现有 `base.ts` 迁入 `planners/mindmap.ts`（去掉 mutate 依赖）。
3. `run` 统一提交 draft.operations。

## Phase 3：迁移 node/edge/viewport

1. 按 domain 逐个把 `commands/*` 中的 `instance.mutate` 清零。
2. 同步删除 domain 内历史执行 helper。

## Phase 4：收口与强约束

1. lint 规则：禁止 write api 层（`api.ts`）直接引用 `instance.mutate`。
2. 文档约束：所有新增写能力必须先定义 command + planner。

---

## 10. 行为保持清单（迁移验收）

必须保持：

1. `DispatchResult` 的 `ok/reason/message/value` 语义不变。
2. `source -> origin` 映射规则不变（user/system/remote）。
3. history capture 行为不变（含 capacity/captureRemote/captureSystem）。
4. changeBus 事件时机与内容不变。
5. read runtime 同步时机不变。

---

## 11. 风险与控制

## 11.1 风险

1. 迁移中出现双写路径并存，导致行为不一致。
2. planner 与 run 边界处理不严，出现重复校验或重复失败映射。
3. value 透传遗漏，影响 UI 依赖结果（如新建节点 id）。

## 11.2 控制措施

1. 每个 phase 结束前执行 engine/react/core lint + 关键路径回归。
2. 引入断言：命令层禁止直接 mutate（静态扫描）。
3. 先迁移 mindmap，验证稳定后再推广到 node/edge。

---

## 12. 为什么这是“最简单、最优雅”

1. 简单：所有写路径同构，不再猜“这个命令会不会直接写”。
2. 优雅：层次职责单一，读代码按流水线自然展开。
3. 可维护：新增功能只需补 command + planner，不用复制执行样板。
4. 可测试：planner 可纯单测，run 可集中集成测。

---

## 13. 建议的最小实施切口

如果只做最小一步且收益最大，建议：

1. 先在 write 中引入 `commands.write.apply({ domain, command, source })` 与 `Draft`。
2. 优先把 `mindmap` 从“命令即执行”迁到“命令产 plan -> run 执行”。
3. 等 mindmap 稳定后再批量迁移其他 domain。

这一步完成后，write 侧的认知模型会立刻统一。
