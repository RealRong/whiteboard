# Whiteboard Engine 全量架构研究报告（漏斗原则 + CQRS）

## 1. 报告目标

本报告基于 `packages/whiteboard-engine` 与其关键依赖 `packages/whiteboard-core` 的静态代码研究，回答：

1. 按漏斗原则（写入入口单一、过程统一、出口一致）还能怎么重构。
2. 按 CQRS（Command/Query 分离、事件驱动投影）还能怎么重构。
3. 在“不计成本、允许大范围调整”的前提下，什么是最清晰、最简单的终局架构。

本报告是架构研究，不包含代码修改。

---

## 2. 研究范围

## 2.1 代码范围

- `packages/whiteboard-engine/src/instance/*`
- `packages/whiteboard-engine/src/runtime/write/*`
- `packages/whiteboard-engine/src/runtime/read/*`
- `packages/whiteboard-engine/src/runtime/{Scheduler,TaskQueue,Viewport,shortcut/*}`
- `packages/whiteboard-engine/src/state/*`
- `packages/whiteboard-engine/src/config/*`
- `packages/whiteboard-engine/src/types/*`
- `packages/whiteboard-core/src/{kernel,core}/*`（与 engine 写入链路相关）

## 2.2 研究方式

- 以静态代码阅读为主。
- 辅助多路并行代码探索结论汇总。
- 未进行完整运行时压测（当前工作区存在 bench 运行阻塞问题）。

---

## 3. 当前全链路架构（现状）

```text
UI hooks/components
  -> instance.commands.*
  -> runtime/write/api.ts (domain command adapter)
  -> runtime/write/runtime.ts (planner + writer.applyDraft)
  -> runtime/write/writer.ts (reduceOperations -> commit -> changeBus.publish)
  -> instance/reactions/Reactions.ts
      -> readRuntime.applyChange(change)
      -> system reactions (Measure/Autofit) may mutate again
  -> runtime/read/kernel.ts
      -> read/planner.ts (Change -> ReadChangePlan)
      -> index/stage caches
      -> query/read facade
```

并行存在的旁路与双轨：

1. `instance.mutate(operations, source)` 旁路（绕过 planner）。
2. `instance.state.write` 直写 UI 状态（不经过 writer/changeBus）。
3. `core/history` 与 `engine/history` 双栈并存。
4. `core/kernel/invert` 与 `core/history` 的逆推逻辑重复实现。

---

## 4. 关键发现（高优先级）

## 4.1 入口漏斗不单一（高）

表现：

1. 写入口不止 `commands -> plan -> writer`，还包括 `instance.mutate`、`doc.reset`、`state.write`。
2. `Measure/Autofit` 会直接调用 `instance.mutate`，绕过意图层 planner。

影响：

1. 审计、权限、幂等、可回放语义无法单点治理。
2. 同一业务变更可能走不同路径，历史与事件语义不一致。

证据：

- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/instance/engine.ts:245`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/writer.ts:210`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/instance/reactions/Measure.ts:70`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/instance/reactions/Autofit.ts:313`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/api.ts:317`

## 4.2 Command 与 Query 边界混杂（高）

表现：

1. `Commands` 接口里混有查询行为（如 `history.get`、`selection.getSelectedNodeIds`）。
2. 写命令实现反向读取 read/query/document/state 来推导写入。

影响：

1. CQRS 抽象被破坏，命令难以做到纯意图处理。
2. 读模型实现变更会反向影响写模型正确性。

证据：

- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/types/command/api.ts:407`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/types/command/api.ts:426`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/api.ts:229`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/api.ts:424`

## 4.3 读侧失效协议依赖写侧实现细节（高）

表现：

1. read planner 直接依赖 write impact tag（`read/planner.ts` import `write/impact`）。
2. 读失效协议不是独立契约，而是写内部标签的派生。

影响：

1. 写端 tag 演进容易破坏读端投影。
2. CQRS 中“读模型独立演化”被打穿。

证据：

- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/planner.ts:3`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/planner.ts:10`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/impact.ts:27`

## 4.4 事件模型偏技术细节，不是稳定领域事件（中高）

表现：

1. `Change` 主要是 `operations + impact + docBefore/docAfter`。
2. 读侧继续对 `impact` 做二次推导，语义层级偏低。

影响：

1. 事件契约稳定性弱，不利于跨进程、插件、外部订阅。
2. 业务语义（例如 NodeMoved、EdgeReconnected）在事件层不可见。

证据：

- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/types/write/change.ts:4`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/writer.ts:95`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/planner.ts:10`

## 4.5 逆推与历史职责冲突（高）

表现：

1. 逆推逻辑有两套实现：`core/kernel/invert` 与 `core/history`。
2. 历史栈也有两套：`core/history` 与 `engine/runtime/write/history`。
3. `before` 在类型上可选，但逆推对多类操作强依赖，导致潜在失败。

影响：

1. 行为漂移风险高。
2. undo/redo 粒度与可逆性语义不稳定。
3. 写路径可能因 inverse 失败而整体失败。

证据：

- `/Users/realrong/whiteboard/packages/whiteboard-core/src/kernel/invert.ts:13`
- `/Users/realrong/whiteboard/packages/whiteboard-core/src/core/history.ts:56`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/history.ts:41`
- `/Users/realrong/whiteboard/packages/whiteboard-core/src/types/core.ts:193`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/plan/node.ts:57`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/writer.ts:130`

## 4.6 读接口暴露可变引用（高）

表现：

1. `query.doc.get` 可直接返回文档对象。
2. 多处 query/read cache 返回数组、Map、对象引用，缺少只读约束。

影响：

1. 外部潜在可绕过命令漏斗修改对象。
2. 投影缓存与真实状态一致性容易被破坏。

证据：

- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/api/query.ts:27`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/types/instance/query.ts:13`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/stages/index/NodeRectIndex.ts:157`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/stages/edge/cache.ts:173`

## 4.7 引擎装配过重且两阶段占位（中高）

表现：

1. `engine.ts` 同时处理装配、命令门面、配置端口、生命周期。
2. `instance` 先以 `null as unknown` 占位，再回填命令与 mutate。

影响：

1. 初始化期边界脆弱。
2. 后续演化容易引入循环依赖。

证据：

- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/instance/engine.ts:32`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/instance/engine.ts:221`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/instance/engine.ts:235`
- `/Users/realrong/whiteboard/packages/whiteboard-engine/src/instance/engine.ts:254`

---

## 5. 按漏斗原则的重构点清单

## 5.1 必改（否则无法形成单漏斗）

1. 封闭 `instance.mutate` 外部/跨模块直调用。
2. 把 `Measure/Autofit` 改为系统命令生产者，不直接提交 operations。
3. 把 `commands.write.apply` 升级为唯一文档写入入口。
4. 明确 UI state 是否走独立漏斗；若不是，则禁止 `state.write` 对外公开。

## 5.2 强建议

1. 引入 `CommandGateway.dispatch(CommandEnvelope)` 统一入口。
2. 组合意图（duplicate/group/deleteSelected）改为事务命令，一次提交一次事件批一次历史记录。
3. 事件发布总线增加异常隔离，避免“提交成功但 listener 抛错”的半失败语义。

---

## 6. 按 CQRS 的重构点清单

## 6.1 Command 侧

1. Commands 接口只保留写命令，不包含查询函数。
2. 命令处理不得直接依赖 read/query 文档投影，改为 command-side 所需最小查询接口（或前置上下文）。
3. 所有命令返回统一 `CommandResult`（成功/失败/元数据），禁止同域混用 `void` 与 `Promise<...>`。

## 6.2 Event 侧

1. 把当前 `Change` 技术事件演化为稳定 `DomainEvent` 契约。
2. `impact` 从“主契约”降为“优化 hint”。
3. 对外公开事件订阅接口（而不是只在 Reactions 内部消费）。

## 6.3 Query/Projection 侧

1. read invalidation 定义独立协议，不 import 写侧 impact helper。
2. `query/read` 返回只读 DTO（Readonly + 防御性拷贝/冻结策略）。
3. 投影层增加版本号（snapshot/index/edge/mindmap）和可观测指标。

---

## 7. 终局目标架构（不计成本，推荐）

## 7.1 总体结构

```text
[Command Gateway]
  -> [Application Services]            // 事务边界、用例编排
  -> [Command Kernel (core)]           // normalize + validate + reduce + invert
  -> [Event Journal]                   // append-only domain events
  -> [Projection Runtime]              // read model builders/indexers
  -> [Query Facade]                    // read-only DTO

并行：
[Interaction State Runtime]            // tool/selection/interaction 等 UI state（独立轨）
[System Policies]                      // autofit/measure 等，输出 system commands
[Infrastructure]                       // scheduler/viewport/config/shortcut adapters
```

## 7.2 关键边界

1. `core`：只做命令语义与可逆性，不管调度和 UI policy。
2. `engine/write`：只做编排、策略、事务与事件发布。
3. `engine/read`：只消费领域事件 + 失效协议并维护投影。
4. `react`：只发命令、读查询，不触达内部 store/可变对象。

## 7.3 核心契约（推荐）

1. `CommandEnvelope`：命令意图 + source/actor/correlation。
2. `DomainEvent`：稳定业务事件 + revision。
3. `ReadInvalidation`：独立于 write impact 的投影失效契约。
4. `QueryDTO`：只读输出，不回传内部引用。

---

## 8. 大范围重构路线（不计成本版）

## 阶段 A：契约先行（2-4 周）

1. 新建 `types/cqrs/{command,event,query,projection}.ts`。
2. 定义 `ReadInvalidation` 独立协议。
3. 给现有路径加 tracing（commandId/transactionId/source/correlationId）。

输出：新契约落地，旧逻辑不改行为。

## 阶段 B：写入漏斗收口（4-8 周）

1. 新增 `CommandGateway.dispatch` 唯一入口。
2. `commands.*` 全量改为 envelope adapter。
3. `instance.mutate` 改为内部私有能力。
4. `Measure/Autofit` 改为 system command producer。

输出：所有文档变更都经过统一命令入口。

## 阶段 C：读写解耦（4-8 周）

1. read 侧删除对 `write/impact` 的直接依赖。
2. `Change -> ReadInvalidation` 映射迁移到 adapter 层。
3. 读接口切换到只读 DTO，清理可变引用返回。
4. 使用 `dirtyEdgeIds` 实现 edge 增量，减少全量退化。

输出：读模型可独立演化，失效协议稳定。

## 阶段 D：core/kernel 语义统一（4-8 周）

1. 逆推逻辑单实现（kernel/history 共用）。
2. `before` 补齐单点化（reducer/normalizer 入口统一）。
3. 拆出轻量 command reducer，避免每次 `createCore` 全量实例化。
4. 明确 history 所有权：engine 保策略，core 不再与 engine 双栈并行。

输出：可逆性语义一致，热路径更轻。

## 阶段 E：基础设施清理（3-6 周）

1. `engine.ts` 拆成三段装配器（core/ports/facade）。
2. `Viewport` 拆 `read api` 与 `write api`。
3. `shortcut` 明确单入口（接入 engine 或移回 react，二选一）。
4. `config` 归一化只保留一处（建议 engine 层）。

输出：横切模块职责清晰，依赖方向稳定。

---

## 9. 目标目录结构（建议）

```text
packages/whiteboard-engine/src/
  cqrs/
    command/
    event/
    query/
    projection/
  application/
    services/
    transactions/
  runtime/
    command/
    projection/
    interaction/
    infrastructure/
  instance/
    assembler/
    facade/
```

`packages/whiteboard-core/src/`：

```text
kernel/
  commandReducer/
  inversion/
  normalization/
```

---

## 10. 验收标准（终局）

## 10.1 架构标准

1. 文档写入只有一个公开入口：`dispatch(CommandEnvelope)`。
2. Commands 不包含查询函数。
3. 读侧不直接依赖写侧 impact 实现。
4. 逆推实现只有一份。
5. history 栈只有一套业务所有权定义。

## 10.2 正确性标准

1. 增量投影与全量重建抽样一致率达到目标阈值（建议 >= 99.99%）。
2. undo/redo 在复合意图场景具备事务级一致性。
3. system policies 触发的写入与用户写入在审计链路可区分且可追踪。

## 10.3 性能标准

1. 高频交互下全量重建占比显著下降。
2. 写路径对象构建成本下降（剥离 createCore 全量实例化）。
3. 关键链路 P95（drag/transform/edge routing）不回退。

---

## 11. 主要风险与对策

1. 风险：大规模接口改动导致适配层爆炸。  
对策：先契约后迁移，保留旧接口 adapter 与 feature flag。

2. 风险：读写解耦后短期投影错误率上升。  
对策：双轨对比（新失效协议 vs 旧 planner），异常自动降级全量。

3. 风险：撤销重做语义变化影响用户体验。  
对策：先固化“事务历史”规则，再切换 capture 粒度。

4. 风险：shortcut/viewport/config 拆分引起行为漂移。  
对策：先拆接口不改行为，使用契约测试锁行为。

---

## 12. 结论

在当前代码基础上，按漏斗原则和 CQRS 可重构空间非常大，且核心瓶颈已明确：

1. 写入入口多头与旁路。
2. Command/Query 责任交叉。
3. 读失效协议与写实现耦合。
4. 逆推/历史双实现与语义冲突。

不计成本的最优路线不是“局部优化”，而是“契约先行 + 入口收口 + 读写解耦 + core语义统一 + 基础设施拆层”的系统性重构。该路线能最大化架构清晰度和长期简化效果。

---

## 13. 详细重构方案（实施级）

本节把第 8 章的五阶段路线细化为可执行方案。目标是做到：

1. 每个阶段都有明确输入、输出、边界和回滚。
2. 每个改造项都能映射到具体目录与文件。
3. 可以按 PR 串行推进，也可以按工作流并行推进。

## 13.1 工作流拆分

建议按 8 条工作流并行，避免单条主线过长：

1. `WF-1`：命令漏斗与网关（CommandGateway）。
2. `WF-2`：事件模型与日志（DomainEvent + Journal）。
3. `WF-3`：读投影与失效协议（ReadInvalidation + ProjectionRuntime）。
4. `WF-4`：core 命令内核（normalize/reduce/inversion 单实现）。
5. `WF-5`：历史系统（事务级历史、单所有权）。
6. `WF-6`：instance 装配重构（assembler/facade 拆分）。
7. `WF-7`：基础设施拆层（viewport/shortcut/config/state）。
8. `WF-8`：兼容层与迁移工具（adapter/feature flag/双轨比对）。

## 13.2 阶段门禁（必须满足才可进下一阶段）

1. `Gate-A`：新契约类型落地，旧逻辑行为零变化。
2. `Gate-B`：文档写入统一从 `dispatch` 进，旁路入口仅保留内部兼容桥。
3. `Gate-C`：read 不再 import write/impact，失效协议独立。
4. `Gate-D`：逆推单实现完成，history 所有权单点化。
5. `Gate-E`：旧接口默认关闭，仅保留受控兼容开关。

---

## 14. 分阶段实施细化（按文件落点）

## 14.1 阶段 A：契约先行（2-4 周）

目标：定义稳定接口，不改业务行为。

变更清单：

1. 新增目录 `packages/whiteboard-engine/src/types/cqrs/`。  
文件：`command.ts`, `event.ts`, `query.ts`, `projection.ts`, `index.ts`。
2. 新增 `ReadInvalidation` 契约。  
建议位置：`packages/whiteboard-engine/src/types/read/invalidation.ts`。
3. 为现有写链路增加 tracing 字段（`commandId`, `transactionId`, `correlationId`）。  
改动点：`runtime/write/model.ts`, `runtime/write/writer.ts`, `types/write/change.ts`。
4. 在 `types/instance/engine.ts` 增加 `events.subscribe` 草案（先只类型暴露）。  
实现仍可先复用 `changeBus`。

阶段输出：

1. 新类型可编译并导出。
2. 不改变现有命令调用语义。
3. CI 能跑过现有 build。

回滚策略：

1. 新增文件可整体回滚，不影响旧运行时。
2. tracing 字段为可选字段，不破坏旧序列化结构。

## 14.2 阶段 B：写入漏斗收口（4-8 周）

目标：所有文档写入统一走 `CommandGateway.dispatch`。

变更清单：

1. 新增 `runtime/command/gateway.ts`。  
职责：`dispatch(CommandEnvelope) -> plan -> commit -> publish`。
2. `runtime/write/api.ts` 从“直接调 apply”改为“封装并转发 CommandEnvelope”。  
保持 API 兼容，但实现统一入口。
3. 限制 `instance.mutate`：  
只在内部保留，外部 facade 移除或标记 internal。
4. `Measure/Autofit` 改为输出 system command，不直接提交 operations。  
改动：`instance/reactions/Measure.ts`, `instance/reactions/Autofit.ts`, `instance/reactions/Reactions.ts`。
5. `commands.write.apply` 标记 deprecated，并引导到 gateway。

阶段输出：

1. 文档写入路径单一化（至少逻辑单一）。
2. 旁路调用点清零（Measure/Autofit）。
3. 事件发布入口单点可观测。

回滚策略：

1. 保留 `LEGACY_MUTATE_ENABLED` feature flag。
2. `gateway` 异常时自动回退旧 `writer.applyDraft` 路径。

## 14.3 阶段 C：读写解耦（4-8 周）

目标：read 侧只消费 `ReadInvalidation`，不依赖 write impact 细节。

变更清单：

1. 新增 `runtime/read/invalidationAdapter.ts`。  
职责：`DomainEvent | Change -> ReadInvalidation`。
2. `runtime/read/planner.ts` 改为消费 `ReadInvalidation`，移除 `import ../write/impact`。
3. `runtime/read/kernel.ts` 从 `applyChange(change)` 过渡到 `applyInvalidation(invalidation)`。
4. query/read 返回只读结构。  
改动：`runtime/read/api/query.ts`, `runtime/read/api/read.ts`, `types/instance/query.ts`, `types/instance/read.ts`。
5. 使用 `dirtyEdgeIds` 提升 edge 增量。  
改动：`runtime/read/planner.ts`, `runtime/read/stages/edge/cache.ts`。

阶段输出：

1. read 模块无 write/impact 依赖。
2. 投影失效协议稳定且可独立测试。
3. 读接口不再直接泄露可变核心引用。

回滚策略：

1. 双轨运行 `legacyPlanner` 与 `newInvalidationPlanner`，结果比对不一致时回退 legacy。

## 14.4 阶段 D：core/kernel 语义统一（4-8 周）

目标：逆推单实现，before 补齐单点化，reduce 轻量化。

变更清单：

1. 新增 `packages/whiteboard-core/src/kernel/inversion/`（或 `core/inversion/`）单实现模块。
2. `kernel/invert.ts` 与 `core/history.ts` 复用同一 inversion 实现，删除重复 switch。
3. 在 reducer 前置引入 operation normalization，统一补齐 `before`。  
改动点：`kernel/reduce.ts`, `core/model.ts`（或新增 `kernel/normalize.ts`）。
4. 从 `createCore` 拆出轻量 `commandReducer`。  
目标：`reduceOperations` 不再每次全量 `createCore`。
5. 明确 history 所有权：engine history 作为唯一对外历史系统；core history 只留 core 独立模式使用。

阶段输出：

1. 逆推逻辑只有一个实现来源。
2. 写路径不会因 `before` 缺失产生隐式失败。
3. reduce 热路径对象开销下降。

回滚策略：

1. 保留 `LEGACY_INVERT` 与 `LEGACY_REDUCER` 切换开关。
2. 对比新旧 inverse 结果，不一致时降级旧实现。

## 14.5 阶段 E：基础设施清理与收口（3-6 周）

目标：完成结构清洁，关闭旧接口默认入口。

变更清单：

1. `instance/engine.ts` 拆为 `instance/assembler/*` + `instance/facade/*`。
2. `runtime/Viewport.ts` 拆 `ViewportReadApi` 与 `ViewportWriteApi`。
3. `runtime/shortcut/*` 明确单入口策略（接入 engine 或回归 react 二选一）。
4. `config/index.ts` 只保留一个 normalize 主入口，避免 UI 与 engine 双归一化。
5. 默认关闭 legacy flags，兼容路径进入“仅测试保留”状态。

阶段输出：

1. 模块职责边界清晰。
2. 运行时入口与依赖方向稳定。
3. 旧路径可移除。

回滚策略：

1. 发布周期内保留“紧急开关”恢复 legacy 入口。

---

## 15. 目标接口草案（详细）

## 15.1 命令网关

```ts
export type CommandEnvelope<TType extends string, TPayload> = {
  id: string
  type: TType
  payload: Readonly<TPayload>
  meta: {
    source: 'ui' | 'shortcut' | 'remote' | 'import' | 'system' | 'interaction'
    actorId?: string
    correlationId: string
    causationId?: string
    timestamp: number
  }
}

export type CommandResult = {
  ok: boolean
  commandId: string
  revision?: number
  error?: { code: string; message: string; detail?: unknown }
}

export type CommandGateway = {
  dispatch: (command: CommandEnvelope<string, unknown>) => Promise<CommandResult>
}
```

## 15.2 领域事件

```ts
export type DomainEventEnvelope<TType extends string, TPayload> = {
  id: string
  type: TType
  payload: Readonly<TPayload>
  revision: number
  commandId: string
  origin: 'user' | 'system' | 'remote'
  timestamp: number
}

export type EventJournal = {
  append: (events: readonly DomainEventEnvelope<string, unknown>[]) => void
  subscribe: (
    listener: (events: readonly DomainEventEnvelope<string, unknown>[]) => void
  ) => () => void
}
```

## 15.3 读失效协议

```ts
export type ReadInvalidation = {
  mode: 'none' | 'partial' | 'full'
  reasons: ReadonlyArray<'nodes' | 'edges' | 'order' | 'geometry' | 'mindmap' | 'viewport'>
  dirtyNodeIds?: readonly string[]
  dirtyEdgeIds?: readonly string[]
}
```

## 15.4 投影运行时

```ts
export type ProjectionRuntime = {
  applyInvalidation: (invalidation: ReadInvalidation) => void
  query: QueryFacade
  read: ReadFacade
}
```

---

## 16. 兼容迁移矩阵（旧 -> 新）

| 旧入口/契约 | 新入口/契约 | 兼容策略 |
|---|---|---|
| `instance.commands.*` | `CommandGateway.dispatch` | commands 变 adapter，不改调用方 |
| `instance.mutate` | internal writer api | 对外隐藏，内部临时保留 |
| `types/write/change.ts` | `DomainEventEnvelope` | 双发一段时间，逐步移除 change |
| `read/planner` + `write/impact` | `ReadInvalidation` | adapter 过渡，双轨比对 |
| `query.doc.get` 可变对象 | `ReadonlyQueryDTO` | 先 freeze 开发态，再切只读 DTO |
| `core/history + engine/history` | 单所有权 history | core 历史降级为内部模式 |

---

## 17. PR 拆分建议（可执行清单）

以下拆分强调“每个 PR 可独立验证与回滚”。建议顺序执行，部分可并行：

1. `PR-01`：新增 CQRS 类型目录与导出。
2. `PR-02`：新增 ReadInvalidation 类型与 adapter 草稿。
3. `PR-03`：写链路 tracing 字段贯通（不改行为）。
4. `PR-04`：引入 CommandGateway，commands 仍走旧实现。
5. `PR-05`：commands 切为 gateway adapter。
6. `PR-06`：Measure 改为 system command producer。
7. `PR-07`：Autofit 改为 system command producer。
8. `PR-08`：对外隐藏/降级 `instance.mutate`。
9. `PR-09`：read/kernel 新增 applyInvalidation。
10. `PR-10`：read/planner 移除 write/impact 直接依赖。
11. `PR-11`：edge 增量接入 dirtyEdgeIds。
12. `PR-12`：query/read 返回 readonly 防御层。
13. `PR-13`：逆推单实现模块落地（core）。
14. `PR-14`：kernel/history 统一使用新 inversion。
15. `PR-15`：operation normalization（before 单点补齐）。
16. `PR-16`：reduce 轻量化（摆脱全量 createCore）。
17. `PR-17`：history 所有权收口（engine 主栈）。
18. `PR-18`：engine.ts 拆 assembler/facade。
19. `PR-19`：viewport read/write API 拆分。
20. `PR-20`：legacy flags 默认关闭，文档/类型清理。

---

## 18. 测试与验证计划（详细）

## 18.1 契约测试

1. CommandEnvelope 校验测试：source/origin/correlation 映射正确。
2. DomainEvent 稳定性测试：事件字段兼容旧序列化。
3. ReadInvalidation 映射测试：旧 impact 到新协议一致。

## 18.2 行为回归测试

1. 节点拖拽、边编辑、viewport 交互、mindmap 拖拽全链路回归。
2. 组合意图（duplicate/group/deleteSelected）事务粒度回归。
3. undo/redo 跨事务与跨 source 场景回归。

## 18.3 投影一致性测试

1. 新旧 planner 双轨对比（抽样或全量）：
   - `nodeRects`
   - `edgeView`
   - `mindmapView`
2. 不一致自动记录并触发 `full` 降级。

## 18.4 性能基线测试

1. node drag P95/P99。
2. edge routing P95/P99。
3. read full rebuild 比率。
4. reduce 热路径 CPU 与对象分配量。

---

## 19. 发布与回滚策略（详细）

1. 全程使用 feature flag：
   - `cqrs.gateway.enabled`
   - `read.invalidation.enabled`
   - `core.inversion.unified`
   - `legacy.mutate.enabled`
2. 采用三段发布：
   - Canary（内部）
   - Beta（部分用户）
   - GA（全量）
3. 回滚优先级：
   - 先回滚 read invalidation（切回 legacy planner）
   - 再回滚 command gateway（切回旧 runtime.apply）
   - 最后回滚 core inversion（切回 legacy invert）

---

## 20. 组织与职责建议

建议最小团队配置：

1. 架构负责人 1 名：跨工作流决策与 gate 审核。
2. 写链路负责人 1 名：WF-1/WF-2/WF-5。
3. 读链路负责人 1 名：WF-3。
4. core 负责人 1 名：WF-4。
5. 基础设施负责人 1 名：WF-6/WF-7。
6. 质量负责人 1 名：WF-8 + 回归框架。

协作机制：

1. 每阶段结束必须过 `Gate` 审核。
2. 所有 PR 必须附“旧路径回滚开关状态”。
3. 所有关键路径变更必须附性能对比数据。
