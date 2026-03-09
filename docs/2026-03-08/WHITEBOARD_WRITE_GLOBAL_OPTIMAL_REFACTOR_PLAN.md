# Whiteboard Write 全局最优重构方案（零兼容约束）

更新时间：2026-03-03
适用范围：
- `packages/whiteboard-engine/src/runtime/write/*`
- `packages/whiteboard-core/src/{node,edge,mindmap,kernel}/*`
- `packages/whiteboard-engine/src/types/{command,write}/*`
- `packages/whiteboard-engine/src/instance/engine.ts`

---

## 1. 前提声明（强约束）

本方案明确采用以下前提：

1. 不考虑兼容性，不保留旧 API。
2. 不考虑迁移成本，不提供过渡层或适配层。
3. 不考虑重构风险，允许一次性重写关键链路。
4. 当前无外部用户，架构最优优先级高于短期稳定。

结论：允许进行破坏性重构（breaking by default）。

---

## 1.1 当前实施状态（截至 2026-03-03）

已完成：

1. `runtime/write` 已按 `api + plan + writer` 收敛，旧 `commands/planners/pipeline/mutation` 多层命名已压平。
2. core 结果契约已统一为 `CoreResult<T>`，mindmap 失败字段从 `error` 收敛到 `message`。
3. `packages/whiteboard-core/src/kernel/plan.ts` 已接入 `node/edge/viewport/mindmap` 四个 domain façade。
4. `packages/whiteboard-engine/src/runtime/write/plan/mindmapBase.ts` 已删除，mindmap tree->operations 适配已下沉到 `corePlan.mindmap.*`。
5. 已引入单入口 `instance.commands.write.apply({ domain, command, source? })`，`api/node|edge|viewport|mindmap` 已改为其薄语法糖。
6. `WriteInput` / `WriteDomain` / `WriteCommandMap` 已沉淀为统一命令契约，`plan`/`writer.applyDraft` 统一走 `domain + command` 判别联合。
7. `runtime/write/api/*` 已合并为 `runtime/write/api.ts` 单文件，目录层级进一步收敛。
8. `runtime/write/model.ts` 已去除 domain 私有命令别名导出，planner/api 改为就地使用 `WriteCommandMap['x']`，类型噪音进一步下降。
9. `@whiteboard/core`、`@whiteboard/engine`、`@whiteboard/react` 三包 lint 已通过。

进行中：

1. 可继续做命名层面最小化（例如少量 `Write*` 类型别名进一步压缩），但不影响当前主链路最优性。

---

## 2. 最终目标（Global Optimum）

将当前 `api -> plan -> core -> writer` 从“可维护”推进到“最优一致性”：

1. **单写入口**：所有写操作统一为一个入口函数（一个 API）。
2. **单命令模型**：命令类型仅有一套定义，消除 action/command 双表达。
3. **单结果契约**：core 的所有 domain 返回统一结果结构。
4. **单执行器**：副作用执行仅在一个执行器内发生。
5. **单职责边界**：
   - core：纯算法与 pure plan
   - engine plan：仅路由与上下文拼装
   - writer：仅执行与副作用

---

## 3. 现状问题（全局视角）

### 3.1 接口层冗余

1. `api/node|edge|viewport` 中存在大量重复 dispatch 包装。
2. `mindmap` 已有 `apply`，但其他 domain 仍是多函数风格，接口风格不统一。

### 3.2 模型层重复

1. `model.ts` 中的 `WriteAction` 与 `types/command/api.ts` 中命令定义存在重复语义。
2. action 与 command 之间存在“翻译成本”。

### 3.3 结果契约曾不一致（已修复）

1. 历史状态：core 的 node/edge 使用 `message`，mindmap 使用 `error`。
2. 当前状态：四个 domain 已统一为 `message`，engine 不再需要双轨容错。

### 3.4 mindmap 边界曾偏厚（已修复）

1. 历史状态：engine 的 `plan/mindmapBase.ts` 承担 tree->operations 适配。
2. 当前状态：该层已下沉到 core `kernel/plan.ts`，engine planner 只保留路由与上下文拼装。

### 3.5 执行层曾轻微重叠（已修复）

1. 历史状态：`flow.ts` 与 `writer.ts` 共同定义写执行路径。
2. 当前状态：`flow.ts` 已删除，执行统一收敛到 `Writer.applyDraft`。

---

## 4. 最优架构（目标蓝图）

```txt
instance.commands.* (语法糖，可选)
  -> write.apply({ domain, command, source? })      // 唯一写入口
    -> plan.apply(input, ctxSnapshot)               // 纯路由 + 纯规划
      -> core.plan.<domain>(ctx, command)           // 统一 pure 规划
    -> writer.applyDraft(draft, source)             // 唯一副作用执行
```

### 4.1 单入口协议

```ts
type WriteInput<D extends Domain = Domain> = {
  domain: D
  command: DomainCommandMap[D]
  source?: CommandSource
}

type WriteApi = {
  apply: <D extends Domain>(input: WriteInput<D>) => Promise<DispatchResult>
}
```

说明：
1. 对外只有 `apply` 为第一公民。
2. `node.create` / `edge.update` 等仅作为语法糖，不作为主协议。

### 4.2 单命令模型

```ts
type Domain = 'node' | 'edge' | 'viewport' | 'mindmap'

type DomainCommandMap = {
  node: NodeCommand
  edge: EdgeCommand
  viewport: ViewportCommand
  mindmap: MindmapCommand
}
```

说明：
1. 删除重复 action 联合类型，直接复用 command 模型。
2. engine/internal 也以 `DomainCommandMap` 作为单一真相。

### 4.3 单结果契约（core 统一）

```ts
type CoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; code?: string }
```

说明：
1. 禁止 `message/error` 双轨。
2. 所有 domain 失败均使用 `message`。

### 4.4 单执行器

`flow.ts` 合并入 `writer.ts`，形成：

```ts
writer.applyDraft(draft, source)
writer.applyOperations(operations, source)
writer.replaceDocument(doc)
```

说明：
1. runtime 不再拥有执行编排逻辑。
2. runtime 只负责组装依赖和导出能力。

---

## 5. 目录最终态（目标，不保留历史痕迹）

```txt
packages/whiteboard-engine/src/runtime/write/
  api.ts                 # 仅暴露 write.apply + 可选语法糖生成
  model.ts               # DomainCommandMap / WriteInput / Draft / Result adapters
  plan.ts                # 统一入口；路由到 domain planner
  planner/
    node.ts
    edge.ts
    viewport.ts
    mindmap.ts
  writer.ts              # applyDraft + history + bus + change publish
  bus.ts
  history.ts
  impact.ts
  runtime.ts             # 装配
  index.ts
```

备注：
1. `api/` 目录可直接压成单文件 `api.ts`。
2. `mindmapBase.ts` 删除，能力下沉 core 后不再需要。

---

## 6. Core 下沉与统一（最关键）

### 6.1 新增 core planner façade（推荐）

在 core 新增统一纯规划入口：

```ts
corePlan.node(ctx, command) => CoreResult<DraftPayload>
corePlan.edge(ctx, command) => CoreResult<DraftPayload>
corePlan.viewport(ctx, command) => CoreResult<DraftPayload>
corePlan.mindmap(ctx, command) => CoreResult<DraftPayload>
```

其中：

```ts
type DraftPayload = {
  operations: Operation[]
  value?: unknown
}
```

### 6.2 mindmap 彻底下沉

将 engine 中以下职责移动到 core：

1. tree->replaceOps 的操作拼装。
2. `layout hint` 导致的 anchor 补丁拼装。
3. insert/move/update 的 command 分派。

最终 engine `planner/mindmap.ts` 仅做：

1. 准备 context（当前文档、关联 node、配置）
2. 调 corePlan.mindmap
3. 将 CoreResult 映射为 Draft

---

## 7. API 面收敛策略（无兼容模式）

### 7.1 对外 API

仅保留：

1. `instance.commands.write.apply(input)`

可选保留（语法糖，不承诺稳定）：

1. `instance.commands.node.create(...)`
2. `instance.commands.edge.update(...)`
3. 由代码生成器自动派生，禁止手写重复包装。

### 7.2 删除项

1. 删除手写 `api/node.ts`、`api/edge.ts`、`api/viewport.ts` 重复 dispatch 模板。
2. 删除任何“非 apply 主路径”的写入口。

---

## 8. 类型系统优化（减少噪音）

### 8.1 engine-types 收敛

1. `types/command/api.ts` 成为命令唯一来源。
2. `types/write/commands.ts` 仅保留 runtime 特有增量（若有）。
3. 删除重复 alias 与镜像类型。

### 8.2 Draft 工具统一

保留最小集：

1. `success`
2. `invalid`
3. `cancelled`
4. `op` / `ops`

禁止新增 domain 私有 result adapter。

---

## 9. 实施顺序（最优优先，不做保守路径）

### Phase A：契约统一（core）

1. mindmap `error` -> `message`。
2. 所有 domain result 统一 `CoreResult<T>`。
3. 引入 `corePlan.*` façade。

### Phase B：plan 瘦身（engine）

1. 删除 `plan/mindmapBase.ts`。
2. `plan/*` 仅保留 command->corePlan 路由。
3. `plan/index.ts` 统一 context snapshot。

### Phase C：api 单入口

1. 引入 `write.apply`。
2. 清理手写 domain dispatch 样板。
3. 语法糖转为生成式或最薄包装。

### Phase D：执行层单点化

1. `flow.ts` 并入 `writer.ts`。（已完成）
2. runtime 仅组装，不做执行编排。（已完成）

### Phase E：清理与硬约束

1. 架构检查：
   - 禁止 `api` 直接 `instance.mutate`
   - 禁止 planner 访问副作用对象
   - 禁止 writer 引用 UI state
2. 删除废弃文件与旧命名。

---

## 10. 质量门槛（在“无用户”前提下依然要求）

尽管不考虑风险和成本，仍要求满足：

1. `engine/react/core` lint 全绿。
2. 行为一致性基线：
   - node create/update/delete
   - edge create/update/routing
   - viewport set/pan/zoom
   - mindmap insert/move/update/remove/clone
   - history undo/redo
3. 架构约束脚本全绿。

---

## 11. 非目标（明确不做）

1. 不保留旧路径兼容导出。
2. 不保留 deprecated API。
3. 不提供 migration adapter。
4. 不在本轮优化 UI hooks 架构。

---

## 12. 最终判定标准（Done Definition）

当以下条件全部满足时，视为“全局最优状态达成”：

1. 写入主路径只有一个协议：`write.apply`。
2. planner 层不包含业务算法，仅做路由与上下文。
3. core 负责全部纯算法与 operation 规划。
4. writer 负责全部副作用执行与历史。
5. 类型与错误契约完全统一，无双轨语义。

---

## 13. 附：建议的新文档索引

为避免后续方案漂移，建议保留三份文档：

1. `WHITEBOARD_WRITE_GLOBAL_OPTIMAL_REFACTOR_PLAN.md`（本文件，目标态）
2. `WHITEBOARD_WRITE_IMPLEMENTATION_STEPS.md`（执行清单，逐项打勾）
3. `WHITEBOARD_WRITE_ARCHITECTURE_CONSTRAINTS.md`（可机检规则）
