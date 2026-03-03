# Orchestrator -> Kernel -> Stages/API -> Core 全局收敛方案 V2

## 1. 执行摘要

本版是完整重写版，明确采用并固化：

1. **方案 B（强约束）**：`write` 生成唯一 plan（含 `readHints`），`read` 不再二次规划。
2. **漏斗原则**：公共协议只描述业务语义和领域增量，不暴露 read 内部 stage/index 实现。
3. **单一主链路**：`plan -> commit -> publish envelope -> read apply hints`。
4. **单一逆推实现**：`core/history` 与 `kernel/invert` 收敛为同一 inversion engine。

目标：把当前“多次语义翻译链”收敛为“单次语义生产 + 多节点执行链”。

---

## 2. 当前痛点（复盘）

1. `Draft -> Change(impact) -> ReadChangePlan` 多层翻译，语义容易漂移。
2. `read/planner` 依赖 write impact helper，耦合高且难演进。
3. `dirtyEdgeIds` 等信息存在但 read 侧消费不足，增量价值被削弱。
4. `ReadHints` 若直接暴露 stage 字段，会把 write 与 read 实现细节锁死。
5. `core/history` 与 `kernel/invert` 双实现，维护成本高且一致性风险大。

---

## 3. 设计原则

## 3.1 方案 B（必须）

1. `write` 是唯一语义生产者。
2. `read` 是语义消费者，不再拥有主链路“二次规划权”。
3. read 可做保守降级（如 `full rebuild`），但不能重写 write 语义。

## 3.2 漏斗原则（必须）

公共协议按 3 层漏斗表达：

1. **全局层**：这次变更是否需要全量重建。
2. **语义层**：影响了哪些业务语义（geometry/order/visibility/...）。
3. **领域层**：节点/边的增量集合（`DeltaIds`）。

read 内部再把这 3 层编译为 stage/index 执行计划。stage 细节不进入公共协议。

## 3.3 行业规范（建议强制）

1. 显式 schema version（不可隐式推断）。
2. 时间字段统一 `*Ms`（epoch milliseconds）。
3. 错误码统一枚举。
4. Schema 演进只增字段，不做破坏式改名。
5. 事件可选 CloudEvents 外层封装，内部主模型保持轻量。

---

## 4. 目标链路（拉直后）

```text
Command Payload
  -> MutationPlanner.plan(...)                      // write 唯一规划
  -> MutationWriter.commit(plan)                    // 执行并生成 envelope
  -> MutationBus.publish(envelope)                  // 发布统一信封
  -> ReadKernel.applyEnvelope(envelope)             // 只消费 readHints
  -> compileReadHints(envelope.readHints)           // read 内部编译 stage plan
  -> stage.onChange(compiledPlan.*)                 // 分发到各 stage
  -> read/query getters                             // 对外读取
```

关键点：

1. 删除 read 主链路二次 planner。
2. 统一消息体为 `MutationEnvelopeV1`。
3. stage 生命周期统一，新增 stage 不改 kernel 主干分发。

---

## 5. MutationEnvelope V1（最优形态）

## 5.1 核心类型

```ts
import type {
  Operation,
  Origin,
  NodeId,
  EdgeId,
  Document
} from '@whiteboard/core/types'
import type { CommandSource } from '@engine-types/command/source'

export type EnvelopeSchemaVersion = 'wb.mutation-envelope.v1'

export type DeltaIds<TId extends string> =
  | { mode: 'none' }
  | { mode: 'ids'; ids: readonly TId[] }
  | { mode: 'full' }

export type ReadSemantic =
  | 'geometry'
  | 'order'
  | 'visibility'
  | 'mindmap'
  | 'viewport'
  | 'selection'

export type ReadPolicyV1 = {
  // 允许策略级提示，但不暴露 stage 实现字段
  edgeVisibility?: 'auto' | 'force-reset'
}

export type ReadHintsV1 = {
  version: 1

  // 漏斗层 1：全局决策
  rebuild: 'none' | 'full'

  // 漏斗层 2：业务语义
  semantics: readonly ReadSemantic[]

  // 漏斗层 3：领域增量
  dirty: {
    nodes: DeltaIds<NodeId>
    edges: DeltaIds<EdgeId>
  }

  // 非必需策略参数
  policy?: ReadPolicyV1
}

export type MutationEnvelopeV1 = {
  schemaVersion: EnvelopeSchemaVersion

  envelopeId: string     // ULID / UUIDv7
  batchId: string        // 对齐 ChangeSet.id

  kind: 'apply' | 'replace'
  documentId: string

  revision: {
    before: number
    after: number
  }

  createdAtMs: number
  origin: Origin
  source: CommandSource

  operations: readonly Operation[]
  inverse?: readonly Operation[]

  readHints: ReadHintsV1

  meta?: {
    traceId?: string
    correlationId?: string
    actorId?: string
  }
}
```

## 5.2 为什么这是漏斗版最优

1. 不再暴露 `nodeRectIndex/snapIndex/nodeStage/mindmapStage/edgeStage`。
2. 协议层只表达“发生了什么”，不表达“read 里怎么做”。
3. read 可自由重构 stage/index，不破坏 envelope 契约。
4. `DeltaIds` 统一增量表达，降低类型分叉。

## 5.3 字段硬约束（必须）

1. `schemaVersion` 必须是固定字面量。
2. `revision.after >= revision.before`。
3. `kind = 'replace'` 时必须 `readHints.rebuild = 'full'`。
4. `DeltaIds.mode = 'ids'` 时 `ids.length > 0`。
5. `readHints` 只能由 write 生产，read 只能消费或降级。
6. `rebuild = 'full'` 时 read 必须忽略细粒度 dirty 集合。

---

## 6. Read 内部编译（协议外）

`ReadHintsV1` 不包含 stage 字段。read kernel 负责内部编译：

```ts
import type { NodeId, EdgeId } from '@whiteboard/core/types'

type CompiledReadPlan = {
  index: {
    nodeRectIndex: DeltaIds<NodeId>
    snapIndex: DeltaIds<NodeId>
  }
  stage: {
    node: DeltaIds<NodeId>
    mindmap: DeltaIds<NodeId>
    edge: {
      mode: 'none' | 'partial' | 'full'
      dirtyNodeIds: readonly NodeId[]
      dirtyEdgeIds: readonly EdgeId[]
      resetVisibleEdges: boolean
    }
  }
}
```

建议编译规则（示例）：

1. `readHints.rebuild = 'full'` -> `CompiledReadPlan` 全部 `full`。
2. `semantics` 包含 `visibility` -> edge `resetVisibleEdges = true`。
3. `dirty.nodes.mode = 'ids'` -> index/node/mindmap 优先做 ids 增量。
4. `dirty.edges.mode = 'ids'` -> edge stage 优先 partial 增量。
5. `semantics` 包含 `mindmap` 且 `dirty.nodes` 不可用 -> index/stage 升级 `full`。

说明：这些规则属于 read 私有实现，可持续调优，不影响公共 envelope。

---

## 7. API 设计（行业规范 + 简洁）

## 7.1 统一错误模型

```ts
export type MutationErrorCode =
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'CANCELLED'
  | 'INVARIANT_VIOLATION'
  | 'INTERNAL'

export type MutationError = {
  code: MutationErrorCode
  message: string
  retryable?: boolean
  detail?: unknown
}
```

## 7.2 Planner API（write 唯一规划入口）

```ts
import type { WriteDomain, WriteCommandMap } from '@engine-types/command/api'

export type MutationPlan<T = unknown> = {
  operations: readonly Operation[]
  readHints: ReadHintsV1
  value?: T
}

export type PlanRequest<D extends WriteDomain = WriteDomain> = {
  domain: D
  command: WriteCommandMap[D]
  source: CommandSource
}

export type PlanResult<T = unknown> =
  | { ok: true; plan: MutationPlan<T> }
  | { ok: false; error: MutationError }

export type MutationPlanner = {
  plan: <D extends WriteDomain>(request: PlanRequest<D>) => Promise<PlanResult>
}
```

## 7.3 Writer API（提交 + 产出 envelope）

```ts
import type { ChangeSet } from '@whiteboard/core/types'

export type CommitRequest<T = unknown> = {
  kind: 'apply'
  plan: MutationPlan<T>
  source: CommandSource
}

export type ReplaceRequest = {
  kind: 'replace'
  doc: Document
  source: CommandSource
}

export type CommitResult<T = unknown> =
  | {
      ok: true
      envelope: MutationEnvelopeV1
      changes: ChangeSet
      value?: T
    }
  | { ok: false; error: MutationError }

export type MutationWriter = {
  commit: <T = unknown>(request: CommitRequest<T>) => Promise<CommitResult<T>>
  replace: (request: ReplaceRequest) => Promise<CommitResult>
}
```

## 7.4 Bus API（统一发布体）

```ts
export type MutationBus = {
  publish: (envelope: MutationEnvelopeV1) => void
  subscribe: (listener: (envelope: MutationEnvelopeV1) => void) => () => void
}
```

## 7.5 Read Kernel API（只消费 envelope）

```ts
import type { Query } from '@engine-types/instance/query'
import type { EngineRead } from '@engine-types/instance/read'

export type ReadRuntimePort = {
  query: Query
  read: EngineRead
  applyEnvelope: (envelope: MutationEnvelopeV1) => void
}
```

## 7.6 Stage 生命周期 API

```ts
export type StageKey = 'index' | 'node' | 'edge' | 'mindmap'

export type StageContext = {
  rebuild: (mode: 'partial' | 'full') => void
}

export type ReadStage = {
  key: StageKey
  onChange: (plan: CompiledReadPlan, context: StageContext) => void
}
```

## 7.7 Core / Kernel 逆推 API（去重目标）

```ts
export type InversionEngine = {
  invert: (args: {
    operations: readonly Operation[]
    docBefore: Document
  }) => readonly Operation[]
}
```

说明：`history` 与 `kernel.reduce` 都调用这一份引擎。

---

## 8. 与现有类型的对照映射

## 8.1 类型映射

| 当前 | 目标 | 说明 |
|---|---|---|
| `Draft { operations, value }` | `MutationPlan { operations, readHints, value }` | readHints 前移到 plan 阶段 |
| `Change` | `MutationEnvelopeV1` | 统一发布体，替换 `impact + docBefore/docAfter` 的分散表达 |
| `MutationImpact.tags` | `ReadHintsV1.semantics` | 从标签集合升级到语义漏斗 |
| `dirtyNodeIds/dirtyEdgeIds` | `ReadHintsV1.dirty.nodes/dirty.edges` | 统一为 DeltaIds |
| `toReadChangePlan(change)` | `compileReadHints(readHints)` | read 内部编译，不是对外协议 |
| `readKernel.applyChange` | `readKernel.applyEnvelope` | API 语义更清晰 |

## 8.2 旧 ReadHints（stage 暴露版）到漏斗版映射

旧结构（不再推荐）：

```ts
invalidate: {
  nodeRectIndex: DeltaIds<NodeId>
  snapIndex: DeltaIds<NodeId>
  nodeStage: DeltaIds<NodeId>
  mindmapStage: DeltaIds<NodeId>
  edgeStage: {
    mode: 'none' | 'partial' | 'full'
    dirtyNodeIds: readonly NodeId[]
    dirtyEdgeIds: readonly EdgeId[]
    resetVisibleEdges: boolean
  }
}
```

新结构（推荐）：

1. 这些字段全部下沉为 read 内部 `CompiledReadPlan`。
2. 公共协议只保留 `rebuild/semantics/dirty/policy`。
3. `resetVisibleEdges` 由 `semantics + policy` 推导，不再作为公共主字段。

---

## 9. 迁移计划（可灰度、可回滚）

## 阶段 0：观测与护栏

1. 增加指标：`full rebuild` 触发比率、增量命中率、P95 延迟。
2. 增加一致性检查：增量结果抽样对比 full rebuild 结果。

## 阶段 1：引入新类型，不改主行为

1. 增加 `ReadHintsV1`（漏斗版）与 `MutationEnvelopeV1` 类型。
2. Planner 保持输出 `Draft`，同时在内部计算 `readHints`。

## 阶段 2：Writer 双发

1. 继续发布旧 `Change`。
2. 同步发布 `MutationEnvelopeV1`（feature flag 控制）。

## 阶段 3：Read 侧接入 applyEnvelope

1. `readKernel.applyEnvelope` 接入。
2. 内部 `compileReadHints` 先走保守策略（必要时 full）。
3. 旧 `applyChange -> toReadChangePlan` 保留回退窗口。

## 阶段 4：切主路径并删除 read 二次 planner

1. 默认走 `applyEnvelope`。
2. 冻结并移除 read 主链路二次 planner。

## 阶段 5：Core/Kernel 逆推收敛

1. 提取 `InversionEngine`。
2. `history` 与 `kernel.reduce` 改为共用。

---

## 10. 验收标准（量化）

1. 架构验收
- 运行时仅保留一个 plan 来源（write）。
- read 主链路不再存在独立二次 planner。
- 逆推实现只有一份。

2. 正确性验收
- 增量与 full rebuild 抽样一致率达到目标阈值（例如 99.99%+）。

3. 性能验收
- 高频交互场景下 `full rebuild` 比例显著下降。
- node drag / edge routing P95 不回退。

4. 可维护性验收
- 新增 stage 不修改 kernel 主分发逻辑。
- 新增 operation 不需要同时改两套逆推实现。

---

## 11. 风险与回滚

1. 风险：hints 过窄导致漏失效。
2. 风险：hints 过宽导致频繁 full。
3. 风险：逆推契约调整影响 undo/redo。

回滚策略：

1. 保留 `full rebuild` 总开关。
2. 保留 `applyChange` 旧路径 feature flag。
3. 对 `compileReadHints` 结果设置异常阈值，超阈值自动降级 full。

---

## 12. 附录：可选 CloudEvents 适配

内部建议直接传 `MutationEnvelopeV1`。跨进程场景可封装：

```ts
type MutationCloudEvent = {
  specversion: '1.0'
  id: string
  type: 'whiteboard.mutation.applied.v1'
  source: string
  subject: string
  time: string
  data: MutationEnvelopeV1
}
```

---

## 13. 最终一句话架构

**写侧一次规划（operations + readHints），读侧只执行漏斗语义并在内部编译 stage 计划，core/kernel 共用同一套逆推能力。**
