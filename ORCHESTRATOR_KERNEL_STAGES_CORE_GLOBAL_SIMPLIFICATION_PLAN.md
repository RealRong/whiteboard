# Orchestrator → Kernel → Stages/API → Core 全局收敛方案（不改代码版）

## 1. 结论先行

### 1.1 是否还能继续收敛、简化
可以，而且空间仍然很大。当前链路已经具备“可工作的增量模型”，但存在三类结构性复杂度：

1. `plan` 多层语义映射（write plan / write impact / read plan）。
2. `kernel` 与 `core` 的逆推与执行职责重叠（`history` 与 `invert` 双轨）。
3. `read` 侧 stage 生命周期不统一，导致新增 stage 需要改 kernel 分发。

### 1.2 `plan` 应该从 read 推导还是从 write 生成
最优答案：**从 write 生成为单一事实来源（SSOT）**，read 不再二次“重新规划”，只做“执行失效提示（hints）+ 兜底回退”。

理由：

1. 变更语义在 write 端最完整（命令上下文、操作意图、before/after 最接近源头）。
2. read 端二次推导会产生语义漂移风险（当前已看到 `impact.tags -> read mode` 映射偏差）。
3. 单一来源可以把正确性与性能优化放在一处迭代，减少双侧同步成本。

### 1.3 链路能否“完全拉直”
可以拉直为一条主干，但要保留 read stage 作为“计算节点”，不是去掉 stage。

目标不是“把所有逻辑揉成一个函数”，而是：

1. 单一写入计划。  
2. 单一变更信封。  
3. 单一失效协议。  
4. 单一逆推实现。  
5. 单一 kernel 分发生命周期。

---

## 2. 现状链路（基于代码）

## 2.1 运行时主链路（现在）

```text
Write API payload
  -> write/plan/* 生成 Draft(operations)
  -> Writer.applyDraft 执行并产出 Change(operations + impact)
  -> Reactions 把 change 送到 readRuntime.applyChange
  -> read/planner.ts: toReadChangePlan(change)
  -> read/kernel 把 plan 分发给 indexes / edge stage
  -> read/api.get 按需触发 node/edge/mindmap stage
```

同时 `whiteboard-core` 侧还有：

```text
kernel.plan -> kernel.reduce(createCore + apply + invert) -> kernel.query(core.query 透传)
```

## 2.2 已暴露的关键问题

1. **同一语义多次翻译**：`Draft -> Change(impact) -> ReadChangePlan`。
2. **read planner 与 write impact 耦合**：read 直接依赖 write impact helper。
3. **增量粒度不对齐**：`dirtyEdgeIds` 生产了但 read plan 几乎不消费。
4. **正确性隐患**：`node.data.collapsed` 等语义字段可能触发可见性变化，但被归类后 read 索引未必刷新。
5. **kernel 扩展性一般**：`applyChange` 目前硬编码 index/edge 分发。
6. **core/kernel 重叠**：`history` 与 `invert` 都做逆推；`reduce` 使用完整 `createCore`，有额外开销。

---

## 3. 北极星目标架构（推荐）

## 3.1 目标链路（拉直后）

```text
Command Payload
  -> Unified Mutation Planner (Write SSOT)
      产出 MutationEnvelope {
        operations,
        inverseSpec(optional),
        readHints,
        meta(source/revision/time)
      }
  -> Writer Commit (apply operations)
  -> ChangeBus 发布同一个 MutationEnvelope
  -> ReadKernel.dispatch(envelope.readHints)
      -> 每个 stage.onChange(hints)
  -> Read API/getters 按需读取 stage 快照
```

关键点：

1. **不再有 read/planner 二次规划层**。
2. **readHints 与 operations 同源**，避免二次解释差异。
3. **stage 仍保留**，但统一生命周期接口。

## 3.2 统一协议建议

建议定义单一协议（名字可调整）：

- `MutationEnvelope`
  - `operations`: 写入执行的事实。
  - `hints.read`
    - `nodes.dirtyIds`
    - `edges.dirtyIds`
    - `visibilityChanged`
    - `geometryChanged`
    - `selectionChanged`
    - `viewportChanged`
    - `fallbackMode`（`none | partial | full`）
  - `inverse`（可选，或可延迟计算）

- `StageLifecycle`
  - `get`: 提供读模型。
  - `onChange(hints)`: 接收统一失效信号。
  - `rebuild(mode)`: 统一兜底重建入口。

---

## 4. 对“plan来源”问题的最终裁决

## 4.1 选型对比

### 方案 A：继续 read 侧推导 plan（维持现状）
优点：改动小。  
缺点：语义双写、漂移风险持续、长期维护成本高。

### 方案 B：write 生成唯一 plan + readHints（推荐）
优点：

1. 单一事实来源，语义一致。
2. 消除 `read/planner` 与 `write/impact` 耦合。
3. 性能调优点集中。
4. 可在 hints 缺失时退化到 full rebuild，风险可控。

缺点：

1. 需要一次协议迁移。
2. 写侧 planner/impact 责任变重，需要更严格测试。

### 方案 C：从快照 diff 推导统一 plan
优点：理论中立。  
缺点：成本高、延迟高、热路径不友好，不适合高频交互。

## 4.2 最终建议
选择 **方案 B**，并保留 `fallback full rebuild` 作为安全网。

---

## 5. Core / Kernel 收敛策略（全局关键）

## 5.1 收敛原则

1. `core` 负责“状态执行与纯查询”。
2. `kernel` 负责“编排与门面”，不再复制业务逻辑。
3. 逆推逻辑只保留一份（`history` 与 `invert` 共用）。

## 5.2 具体收敛动作

1. **单一逆推引擎**  
把 `kernel/invert` 与 `core/history` 的逆推 switch 收敛成共享模块。

2. **轻量 reduce 内核**  
`kernel.reduce` 不再依赖完整 `createCore`，只使用 `state + apply + query + inversion` 必需能力。

3. **可逆契约显式化**  
统一 `before` 字段策略：
- 要么 planner 端保证可逆所需 before。  
- 要么允许不可逆操作明确标记并跳过 inverse。

4. **registry 职责收敛**  
把 registry 明确限定在“规划期校验/默认值”（优先）或“执行期约束”（若必要），不能两边语义模糊。

---

## 6. 分阶段迁移计划（建议顺序）

## 阶段 0：观测与护栏（先做）

目标：避免“改完才发现退化”。

1. 增加指标：
- 每次变更的 `hints` 命中率
- stage `full rebuild` 触发次数
- `node/edge` 索引更新时间
- 关键交互帧耗时（drag / resize / edge routing）

2. 增加一致性断言（开发态）：
- hints.partial 执行后与 full rebuild 结果抽样对比。

## 阶段 1：引入统一 `readHints` 协议（与现有 read planner 并行）

目标：先并行，再切流。

1. write 端在 `Change` 上附加新 `readHints`。  
2. read 侧优先消费 `readHints`，缺失时走旧 `toReadChangePlan`。  
3. 记录两条路径结果差异。

## 阶段 2：移除 `read/planner.ts` 二次规划

目标：read 仅执行 hints，不再推导。

1. 删除（或冻结）`toReadChangePlan` 主路径。  
2. `read/kernel` 改为 stage 生命周期分发器。

## 阶段 3：统一 stage 生命周期

目标：kernel 不再硬编码 index/edge 特例。

1. 所有 stage 实现 `onChange(hints)` 可选接口。  
2. kernel 用注册表循环分发，新增 stage 零改分发主干。

## 阶段 4：core/kernel 逆推与 reduce 收敛

目标：去重并减轻 reduce 热路径开销。

1. 共享 inversion 模块落地。  
2. 引入 lightweight reduce core。  
3. 明确可逆契约，补齐/放宽策略二选一并文档化。

## 阶段 5：接口瘦身与文档固化

目标：防止回潮。

1. `orchestrator` 保留兼容壳，但不再承担实质逻辑。  
2. 文档固化“一条主干链路 + 单一协议 + 单一逆推实现”。

---

## 7. 风险与回滚策略

## 7.1 风险

1. hints 过窄导致 read 缓存漏失效（正确性风险）。
2. hints 过宽导致频繁 full rebuild（性能风险）。
3. inverse 契约调整影响历史/撤销重做语义（行为风险）。

## 7.2 回滚策略

1. 任一阶段都保留 `fallback full rebuild`。
2. 阶段 1 保留旧 `read planner` 作为 feature flag 回退路径。
3. 逆推收敛前保留双实现 A/B 对比，差异超阈值自动降级。

---

## 8. 验收标准（必须量化）

1. 架构标准
- 运行时仅保留一个 plan 来源（write SSOT）。
- read 侧不再存在独立二次 planner 主链路。
- 逆推实现只有一份。

2. 正确性标准
- 增量路径与 full rebuild 抽样一致率达到目标阈值（例如 99.99%+）。

3. 性能标准
- 高频交互场景下 `full rebuild` 比例显著下降。
- node drag / edge routing 的 P95 延迟不回退。

4. 可维护性标准
- 新增 stage 不需要改 kernel 硬编码分发。
- 新增 operation 不需要改两套逆推逻辑。

---

## 9. 建议的最终一句话架构

**“写侧一次规划（operations + readHints + inverse），读侧只执行失效协议，core/kernel 共享一套执行与逆推基础能力。”**

这条原则可以把当前 `orchestrator -> kernel -> stages/api -> core` 从“多次语义翻译链”拉直为“单次语义生产 + 多节点执行链”，在保证性能的同时显著降低复杂度。
