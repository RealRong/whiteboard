# Whiteboard Read 链路全局最优收敛方案（orchestrator -> kernel -> stages/api -> core）

## 1. 背景与目标

当前 `packages/whiteboard-engine/src/runtime/read` 已完成一轮管线化拆分，但从全局看仍有明显“中间层过多、职责交叉、类型与装配重复”的问题：

- 入口链路过长：`orchestrator -> kernel -> api -> stages`。
- 运行时组装与业务增量调度混在同一层（`kernel.ts`）。
- `planner` 位于 read 侧，却依赖 write impact 语义，依赖方向不够干净。
- 多个 `stage.ts` 仅做一层包裹转发，文件跳转成本高。
- `Reactions` 同时承担 read 同步 + measure + autofit，关注点混杂。

本方案目标：

1. 将 read 收敛为 **两层模型**：`read runtime (composition)` + `read domains (business)`。
2. 删除低价值转发层与重复类型定义，减少阅读跳转。
3. 让依赖方向更清晰：write 负责产出变更语义，read 负责消费语义并更新缓存。
4. 不做兼容层、不做别名转发、不做 re-export 过渡。

---

## 2. 当前结构诊断（基于现状代码）

### 2.1 入口层

- `runtime/read/orchestrator.ts`
  - 仅调用 `createReadKernel(deps)`，无独立语义，属于纯壳。
- `runtime/read/kernel.ts`
  - 同时负责：context 适配、index/query 组装、read API 组装、applyChange 分发。
  - 责任过重，是后续扩展和理解的瓶颈点。

### 2.2 API 层

- `runtime/read/api/read.ts`：仅做 `Object.assign` 聚合。
- `runtime/read/api/query.ts`：仅从 index/query 函数组装 public query。

这两层本质是 composition 细节，可直接回收至 runtime 主文件，避免“多一跳”。

### 2.3 Plan 层

- `runtime/read/planner.ts`：把 `write Change` 映射到 `read ChangePlan`。
- 该文件位于 read 域但直接依赖 write impact (`../write/impact`)。

问题：
- read 反向理解 write 细节，打破边界。
- 语义所在域错位，导致改 write impact 时 read 也需要理解内部规则。

### 2.4 Stage 层

- `edge/stage.ts`、`mindmap/stage.ts`、`index/stage.ts` 都是薄壳。
- 真正复杂逻辑集中在 `cache.ts` 和 `Index` 类。

问题：
- 文件增多但信息密度下降。
- 读链路时需要跨 2~3 层才能看到真实逻辑。

### 2.5 Reaction 层

- `instance/reactions/Reactions.ts` 当前订阅 write `changeBus`，并调用 `readRuntime.applyChange(change)`。

问题：
- Reactions 把 read 同步和 host side-effects（measure/autofit）绑在一起。
- read 生命周期不自洽（谁订阅 changeBus 不在 read 内部定义）。

---

## 3. 全局最优目标架构

## 3.1 总体拓扑

```text
engine
  -> createReadRuntime(deps)
  -> readRuntime.attach(changeBus)
  -> instance.query = readRuntime.query
  -> instance.read = readRuntime.read

runtime/read/runtime.ts   // 唯一 composition 入口
  - createStateAccess(get/subscribe)
  - createReadDomains(node/edge/mindmap/index)
  - createReadQuery(...)
  - createReadGet(...)
  - onChange(changeOrPlan)

runtime/read/domains/*
  - node.ts
  - edge.ts (+ edge/cache.ts)
  - mindmap.ts (+ mindmap/cache.ts)
  - index.ts (+ NodeRectIndex.ts + SnapIndex.ts)
```

> 关键：runtime 只负责“装配和调度”；domain 只负责“计算和缓存”。

## 3.2 设计原则

- 单向依赖：`write -> read`（通过已计算的 plan/hint），read 不再读取 write 内部规则。
- 上层收敛：去掉纯转发壳，保留高信息密度文件。
- 下层自治：每个 domain 内部缓存、失效和视图复用自管理。
- 类型就近：能内联就内联，跨文件复用才提到 types。

---

## 4. 文件与职责重构方案

## 4.1 删除与合并（一步到位）

1. 删除 `runtime/read/orchestrator.ts`。
2. 删除 `runtime/read/api/read.ts`。
3. 删除 `runtime/read/api/query.ts`。
4. 删除 `runtime/read/planner.ts`（详见 4.3）。
5. 合并 `stages/*/stage.ts` 到各 domain 主文件：
   - `stages/index/stage.ts` -> `stages/index/index.ts`（或 `runtime/read/domains/index.ts`）
   - `stages/edge/stage.ts` -> `stages/edge/index.ts`
   - `stages/mindmap/stage.ts` -> `stages/mindmap/index.ts`
6. `kernel.ts` 更名并收敛为 `runtime/read/runtime.ts`（唯一入口）。

## 4.2 保留并强化的核心模块

- `stages/snapshot.ts`：作为 read model 基础快照，继续保留。
- `stages/edge/cache.ts`：保留数据驱动复用策略。
- `stages/mindmap/cache.ts`：保留 tree/layout 复用。
- `NodeRectIndex.ts / SnapIndex.ts`：保留索引实现，后续可下沉 core。

## 4.3 planner 迁移策略（强烈建议）

将“Change -> ReadPlan”从 read 迁出：

- 方案 A（推荐）：在 write `Writer.publishChange` 前后生成 `readPlan` 并挂在 `Change` 上。
- 方案 B：write 暴露 `toReadPlan(change)`，由 read 调用但位于 write 域。

优先 A，原因：

- 语义闭包：impact 由 write 产出，plan 也应在 write 内完成。
- read 只消费，不理解 impact tag 组合规则。
- 后续新增 impact tag 不会破坏 read 模块边界。

---

## 5. 类型与接口收敛

## 5.1 Runtime 对外端口

统一为一个类型（建议放在 `types/read/runtime.ts` 或直接内联在 `runtime/read/runtime.ts`）：

- `query: Query`
- `read: EngineRead`
- `attach(changeBus): () => void` 或 `onChange(change): void`

`applyChange` 建议改名：

- 如果由外部手动推送：`onChange`
- 如果内部自订阅：`attach` + `dispose`

## 5.2 ReadContext 收窄

`ReadRuntimeContext` 从：

- `get`
- `subscribe`
- `query`
- `config`

收窄为 stage 所需：

- `get`
- `query`
- `config`

`subscribe` 不进 stage，避免域层误用订阅能力。

## 5.3 计划类型收敛

保留最小语义结构：

- `index: { mode: 'none' | 'full' | 'dirtyNodeIds'; dirtyNodeIds }`
- `edge: { resetVisibleEdges; clearPendingDirtyNodeIds; appendDirtyNodeIds }`

但定义归属迁移到 write（或共享 contracts），避免 read 侧自产。

---

## 6. Reactions 边界重整

当前：

- `Reactions.start()` 订阅 changeBus，触发 read + measure + autofit。

目标：

- `ReadRuntime` 自己订阅 changeBus（`attach`）。
- `Reactions` 仅管理 host lifecycle（measure/autofit）。

收益：

- read 生命周期和数据同步闭环在 read 内部。
- `Reactions` 关注点更纯粹，减少跨域耦合。

---

## 7. Core 下沉路线（第二阶段）

可继续把通用算法下沉到 `whiteboard-core`：

1. `NodeRectIndex` / `SnapIndex`
   - 若可做到配置纯输入、无引擎依赖，建议迁入 core `node/query` 或 `node/index` 子域。
2. `edge/cache` 中的 tuple 比较与复用判定
   - 抽为 core 的 projection helper。
3. `mindmap/cache` key 构建与复用判定
   - 抽为 core 的 projection helper。

注意：

- 下沉仅迁“纯算法+纯数据结构”；不要把 runtime store 或 instance query 下沉到 core。

---

## 8. 分批落地清单（执行顺序）

## 阶段 0：保护与基线

1. 执行类型检查与架构检查，记录基线。
2. 记录 read 关键路径行为：
   - `nodeIds/nodeById`
   - `edgeIds/edgeById/edgeSelectedEndpoints`
   - `mindmapIds/mindmapById`
   - `query.canvas/snap/geometry`

验收：当前行为快照一致。

## 阶段 1：入口层收敛（低风险，高收益）

1. 新建 `runtime/read/runtime.ts`，把 `kernel + api/read + api/query` 逻辑合并。
2. `engine.ts` 改为直接引入新入口（删除 orchestrator 依赖）。
3. 删除 `orchestrator.ts`、`api/read.ts`、`api/query.ts`。

验收：
- 类型通过。
- `instance.query`、`instance.read` 行为不变。

## 阶段 2：stage 壳文件拍平

1. 合并 `stages/index/stage.ts` 到 index domain 主文件。
2. 合并 `stages/edge/stage.ts` 到 edge domain 主文件。
3. 合并 `stages/mindmap/stage.ts` 到 mindmap domain 主文件。
4. `runtime.ts` 直接依赖 domain 主文件，不再经过 `stage.ts`。

验收：
- `applyChange`（或新 `onChange`）仍可正确触发 edge 缓存失效。
- 快照和 query 行为不回退。

## 阶段 3：planner 迁移（中风险，关键收益）

1. 在 write 域新增 `toReadPlan`（或直接在 `Writer` 产出 `readPlan`）。
2. read runtime 改为消费 `change.readPlan` 或 write 导出的 plan 函数。
3. 删除 `runtime/read/planner.ts` 及 read 对 write impact 的直接依赖。

验收：
- 不同 impact tag 组合下，index/edge 更新策略与原逻辑一致。
- full replace、geometry dirtyNodeIds、mindmap 变更路径均正确。

## 阶段 4：Reactions 解耦

1. `ReadRuntime.attach(changeBus)` 在 engine 初始化时调用。
2. `Reactions` 移除 readRuntime 依赖，仅保留 measure/autofit。
3. 校正 dispose 顺序：read unsubscribe -> reactions dispose。

验收：
- 无重复订阅。
- replace 后 measure clear 逻辑保持正确。

## 阶段 5：类型收敛

1. 收窄 `ReadRuntimeContext`（移除 subscribe）。
2. 合并重复端口类型定义（orchestrator/kernel 中重复的 `ReadRuntimePort`）。
3. 清理 read types 中已无使用项。

验收：
- `rg` 无孤儿类型。
- `tsc --noEmit` 通过。

## 阶段 6：可选 core 下沉

1. 抽离 `NodeRectIndex/SnapIndex` 到 core（先无行为改变迁移）。
2. 抽离 edge/mindmap cache 的纯比较函数到 core。
3. engine read 仅保留装配与依赖注入。

验收：
- runtime/read 目录体积显著下降。
- core 新增模块具备单元测试或最小用例验证。

---

## 9. 风险点与控制

1. 风险：plan 迁移后策略偏差导致 index 或 edge 漏更新。
   - 控制：保留“旧/新 plan 对比日志开关”，短期并行对照。

2. 风险：read 与 reactions 双订阅或漏订阅。
   - 控制：统一在 engine 创建点管理 attach/dispose 顺序。

3. 风险：拍平文件时发生导入环。
   - 控制：先执行 `rg` 检查 import graph，再删旧文件。

4. 风险：cache 复用条件被改坏导致频繁重算。
   - 控制：对 edge/mindmap 增加命中率埋点（开发期），确认未退化。

---

## 10. 验收标准（Definition of Done）

1. 目录结构
   - read 入口仅一个 composition 文件（`runtime.ts`）。
   - 无 `orchestrator.ts`、无 `api/*`、无 stage 壳文件。

2. 依赖边界
   - read 不再直接依赖 write impact 细节。
   - read domain 不持有 subscribe 能力。

3. 功能一致性
   - 对外 API 语义一致：`instance.query`、`instance.read`。
   - edge/node/mindmap 行为一致。

4. 工程质量
   - `pnpm -C packages/whiteboard-engine lint` 通过。
   - 关键热路径无明显性能回退（至少持平）。

---

## 11. 建议优先级（如果只做一轮）

优先做 1~4 阶段：

- 阶段 1（入口收敛）
- 阶段 2（stage 拍平）
- 阶段 3（planner 迁移）
- 阶段 4（reactions 解耦）

这是“复杂度下降最大、风险可控、收益最直接”的组合。

---

## 12. 一句话结论

最优方案不是继续堆抽象，而是把 read 收敛成“一个 runtime 组装层 + 少量高信息密度 domain 模块”，并把 plan 语义前移到 write，最终实现依赖边界清晰、跳转路径最短、维护成本最低。
