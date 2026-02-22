# WHITEBOARD_CORE_STATELESS_MIGRATION_PLAN

## 1. 目标与结论

结论：`core` 无状态化是长期最优方向。  
最终边界应为：

- `@whiteboard/core`：纯函数内核（算法与规则），不持有文档状态、不持有 history 栈、不持有事件总线。
- `@whiteboard/engine`：唯一状态拥有者（doc、history、runtime、事件、调度、actor 协作）。
- `@whiteboard/react`：输入与渲染层，只通过 engine 的公开 API 交互。

> 核心原则：**状态单一归属（Single Source of Truth）**。  
> 不能再出现“core 一份真实状态 + engine 一份投影状态”的语义混合。

---

## 2. 当前问题（为何要迁）

当前 `core` 仍是 stateful runtime（`createCore`），包含：

- `query`（读当前内部 doc）
- `apply`（对内部 doc 生效）
- `history`（undo/redo 栈）
- `tx`（事务）
- `events/changes/plugins/registries`

导致的问题：

- 认知边界不清：engine 也有状态，core 也有状态。
- 写路径复杂：命令、变更、history、图投影在多层传播。
- 演进受限：很难做到“engine 网关统一写入 + actor 同步直调”。
- 复用不佳：纯算法能力无法独立复用到 worker/server。

---

## 3. 目标架构（最终态）

### 3.1 Core（无状态）

`packages/whiteboard-core` 仅保留纯能力：

1. `build(intent, ctx) -> operations`
2. `reduce(doc, operations, ctx) -> { doc, changes }`
3. `invert(changes|operations, ctx) -> inverseOperations`
4. `validate(intent|operations, ctx) -> result`
5. `query(doc, ctx) -> derived data`
6. geometry/layout/router 等纯算法

特点：

- 输入显式，输出显式。
- 无内部可变状态。
- 无订阅机制、无生命周期。

### 3.2 Engine（有状态）

`packages/whiteboard-engine` 成为 runtime 主体：

- `DocumentStore`：当前 doc 与版本。
- `HistoryActor`：undo/redo 栈（包含 tx 聚合策略）。
- `Coordinator`：唯一写网关。
- `Actors`：领域能力（node/edge/mindmap/viewport/...）。
- `EventCenter`：对外事件输出。

写入主链路（最终）：

1. `instance.commands.*`
2. `Coordinator.execute(command | mutation)`
3. `CoreKernel.build/reduce/invert`（纯函数）
4. `DocumentStore.commit(nextDoc, changes)`
5. `HistoryActor.record(changes, inverse)`
6. `GraphActor/ViewActor` 同步
7. `EventCenter.emit(...)`

---

## 4. API 设计（简洁版）

## 4.1 Core API（建议）

```ts
export type KernelContext = {
  registries: RegistrySnapshot
  tuning?: KernelTuning
}

export type BuildResult =
  | { ok: true; operations: Operation[]; value?: unknown }
  | { ok: false; reason: string; message?: string }

export type ReduceResult =
  | {
      ok: true
      doc: Document
      changes: ChangeSet
      inverse: Operation[]
    }
  | { ok: false; reason: string; message?: string }

export const build = (intent: Intent, doc: Document, ctx: KernelContext): BuildResult
export const reduce = (doc: Document, operations: Operation[], ctx: KernelContext): ReduceResult
export const invert = (changes: ChangeSet, docBefore: Document, ctx: KernelContext): Operation[]
```

说明：

- `reduce` 直接返回 `inverse`，避免 engine 再做二次推导。
- `query` 一律改成 `queryXxx(doc, ...)` 风格，不依赖单例状态。

## 4.2 Engine API（建议）

公开仅保留：

- `instance.commands.*`
- `instance.query.*`
- `instance.events.*`
- `instance.input.handle` / `instance.lifecycle.*`

不对外暴露：

- `instance.apply`
- `instance.mutate`
- `instance.tx`
- `runtime.core.apply.*`

这些全部作为 engine 内部写实现细节。

---

## 5. 目录迁移方案

## 5.1 Core 目录（目标）

建议新增：

- `packages/whiteboard-core/src/kernel/build.ts`
- `packages/whiteboard-core/src/kernel/reduce.ts`
- `packages/whiteboard-core/src/kernel/invert.ts`
- `packages/whiteboard-core/src/kernel/validate.ts`
- `packages/whiteboard-core/src/kernel/query.ts`
- `packages/whiteboard-core/src/kernel/types.ts`

建议删除（完成迁移后）：

- `packages/whiteboard-core/src/core/createCore.ts`
- `packages/whiteboard-core/src/core/history.ts`
- stateful event bus / tx / history 相关 runtime 文件

## 5.2 Engine 目录（目标）

建议新增：

- `packages/whiteboard-engine/src/document/Store.ts`
- `packages/whiteboard-engine/src/document/Version.ts`
- `packages/whiteboard-engine/src/runtime/actors/history/Stack.ts`
- `packages/whiteboard-engine/src/runtime/gateway/Coordinator.ts`
- `packages/whiteboard-engine/src/runtime/gateway/WriteContext.ts`

建议收敛：

- 所有写操作仅通过 `Coordinator`。
- actor 内禁止直接访问 core stateful API。

---

## 6. 分阶段实施（完整迁移）

## Phase 0：冻结边界（1 次 PR）

目标：先防止新增技术债。

- 禁止新增 `instance.apply/mutate/tx` 外部调用。
- 禁止新增 `runtime.core.apply.build` 的跨层直连。
- 新写入仅允许 `commands -> coordinator`。

验收：

- 全仓检索无新增违规调用。

## Phase 1：抽离 Core Kernel（2~3 次 PR）

目标：让 core 同时具备纯函数 kernel。

- 从 stateful core 提取 `build/reduce/invert/query` 纯函数实现。
- 提供 `kernel` 出口，不改行为。
- 现有 engine 暂用 adapter 调 kernel，行为对齐旧路径。

验收：

- 同一组 fixture 下，旧 core 与 kernel 的 `operations/changes` 结果一致。

## Phase 2：Engine 建立 DocumentStore（2 次 PR）

目标：doc 状态从 core 转移到 engine。

- 引入 `DocumentStore`（current doc + version + replace/commit）。
- `Coordinator` 使用 kernel + store 完成写入。
- query 改读 `DocumentStore`，不再依赖 core 内部 doc。

验收：

- commands/input/shortcut 场景回归通过。
- graph/view 同步与现状一致。

## Phase 3：History 完整迁入 Engine（2 次 PR）

目标：undo/redo 栈完全在 engine。

- `HistoryActor` 持有 `undo/redo` entry。
- `Coordinator.commit` 时产出并记录 `inverse`。
- `history.undo/redo/clear/configure` 改调 engine history。

验收：

- `undo/redo` 行为与当前一致（含 tx、capacity、captureSystem/captureRemote）。

## Phase 4：删除 Stateful Core（1 次 PR）

目标：完成无状态化收口。

- 删除 `createCore` stateful runtime 与相关 history/event/tx 状态层。
- `@whiteboard/core` 只导出 kernel 能力与类型。
- engine 中清理适配代码。

验收：

- `core` 包不再包含可变 runtime 状态。
- engine 成为唯一状态归属。

---

## 7. 一步到位策略（不保留兼容层）

你当前偏好是“一步清理干净，不保留兼容层”。按该要求执行时建议：

1. 在单分支连续提交 Phase 1~4。  
2. 允许中间提交短暂不可编译，但每阶段结束必须恢复绿色。  
3. 合并前仅保留最终结构，不保留 adapter/legacy 文件。

---

## 8. 关键风险与控制

1. 风险：undo/redo 语义偏移。  
控制：对比基线回放（录制 operations 序列）逐条比对 doc hash。

2. 风险：性能退化（reduce 复制成本）。  
控制：reduce 实现结构共享；graph sync 维持增量 hint。

3. 风险：事件时序变化。  
控制：固定事件顺序契约：`doc -> graph -> view -> events`。

4. 风险：插件/命令注册耦合。  
控制：插件 runtime 留在 engine，core 仅保留 schema/算法级 registry 快照。

---

## 9. 完成标准（Definition of Done）

满足以下条件才算“core 无状态化完成”：

- `@whiteboard/core` 不再维护内部 document/history/event runtime 状态。
- `undo/redo` 栈只存在于 engine。
- 外部使用方只通过 `instance.commands/query/events/input/lifecycle`。
- 代码中不存在跨层写捷径（`runtime.core.apply.*` 对业务层不可见）。
- engine/core/react 全量 build 通过，关键交互回归通过。

---

## 10. 推荐下一步（落地顺序）

建议直接从这 3 件事开工：

1. 在 `core` 新建 `kernel/reduce.ts`，先把当前 `apply.operations` 纯化并返回 `inverse`。  
2. 在 `engine` 新建 `document/Store.ts`，让 `Coordinator` 先接管 doc commit。  
3. 把 `history` 从 core 移到 `engine/runtime/actors/history/Stack.ts`，再删除 core history。

