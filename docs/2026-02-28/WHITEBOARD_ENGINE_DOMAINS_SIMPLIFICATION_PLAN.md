# whiteboard-engine domains 目录降复杂度方案（不改功能）

## 1. 现状结论（基于当前代码扫描）

基线（`packages/whiteboard-engine/src/domains`）：

1. 文件数：35
2. 总行数：2624
3. 空目录：2（`mindmap/interaction`、`selection/interaction`）
4. 体量最大文件：
   - `mindmap/commands/Actor.ts`（631 行）
   - `node/commands/nodeCommands.ts`（291 行）
   - `edge/commands/edgeCommands.ts`（253 行）
   - `selection/commands/Actor.ts`（233 行）
5. class 数：3
   - `node/view/NodeProjectionCache.ts`
   - `mindmap/commands/Actor.ts`
   - `selection/commands/Actor.ts`

关键问题不是单点算法，而是“跳转链路和壳层”叠加：

1. `runtime/query` 依赖 `domains/*/query` 再转到 core（多一层）
2. `runtime/view/Registry` 依赖 `domains/*/view/index.ts` 再进真实实现（多一层）
3. `domains/index.ts` 仅做 re-export，又被 `instance/create.ts` 作为中转入口（多一层）
4. `domains/node/view` 被拆成 `NodeDomain + NodeRegistry + NodeProjectionCache + NodeProject`，定位成本高
5. `mindmap/commands/Actor.ts` 单文件职责过宽（命令编排 + id 生成 + layout 锚点补偿 + lifecycle emit）
6. `selection/commands/Actor.ts` 也同时承担命令与 lifecycle 事件发射

## 2. 收敛目标（保持功能/接口不变）

目标：在不改 `Instance` 对外行为的前提下，减少文件、目录层级、类与跳转。

硬约束：

1. `instance.commands`、`instance.query`、`instance.view`、`instance.domains` 对外类型不变
2. 现有交互行为不回退（选中、mindmap、edge routing、node drag/transform）
3. 性能基线不退化（继续以 `bench:check` 约束）

建议的最终边界：

1. `domains/` 仅保留“对外 domain API 适配 + domain commands（必要时）”
2. `runtime/query|view` 保留运行时读模型和派生
3. 纯算法直接落在 `@whiteboard/core` 或 `runtime/*/helpers`，不通过 domains 再转发

## 3. 三阶段降复杂度方案

实施状态（2026-02-26）：

1. Phase A 已落地（删除空目录 + 删除壳文件 + 改直连 import）。
2. Phase B 已部分落地：`edge/view` 收敛为 `Store.ts`；`node/view` 四文件收敛为 `NodeDomain.ts`。
3. Phase C 已完成：`selection/commands/Actor.ts`、`mindmap/commands/Actor.ts` 均已改为函数式 controller（`createSelectionController` / `createMindmapController`），并且 `domains/*/api.ts` + `bind*ById` 已合并为 `domains/api.ts` 单入口。
4. 可选后续优化：统一 id 生成策略（`runtime/write/idFactory.ts`），属于增量整洁性优化，不影响当前 Phase C 完成判定。
5. 已完成一次性 core 收敛：`domains/node/model/*`、`domains/node/query/*`、`domains/edge/query/*`、`domains/mindmap/query/*` 以及 `edge/commands/createOperation.ts` 的纯逻辑已下沉到 `@whiteboard/core`，engine 侧转发/重复层已删除并改为直连 core。

## Phase A（低风险，先减跳转）

目标：先删除明显壳层和空目录，做到“看一眼就能追到实现”。

变更清单：

1. 删除空目录：
   - `packages/whiteboard-engine/src/domains/mindmap/interaction`
   - `packages/whiteboard-engine/src/domains/selection/interaction`
2. 去掉纯转发 index/壳文件（改直接 import）：
   - `domains/index.ts`
   - `domains/edge/view/index.ts`
   - `domains/mindmap/view/index.ts`
   - `domains/node/query/index.ts`
   - `domains/edge/query/segment.ts`
3. 将 `runtime/query` 直接依赖具体实现文件或 core：
   - `runtime/query/Canvas.ts` 直接引入 `domains/node/query/hitTest`（或迁到 runtime helper）
   - `runtime/query/Geometry.ts` 直接引入 `domains/edge/query/anchor` + `@whiteboard/core/edge`
4. 将 `runtime/view/Registry.ts` 直接 import 具体文件：
   - `domains/edge/view/query/index.ts`
   - `domains/edge/view/Derivation.ts`
   - `domains/mindmap/view/Derivation.ts`

预期收益：

1. 文件减少约 5-8 个
2. import 跳转层级减少 1 层
3. 无行为变化，回归风险低

## Phase B（中风险，合并碎片 view/query）

目标：减少 `domains/node/view` 和 `domains/edge/view` 的多文件跳转。

变更清单：

1. 合并 `domains/node/view` 四件套为单文件：
   - 现状：`NodeDomain.ts` + `NodeRegistry.ts` + `NodeProjectionCache.ts` + `NodeProject.ts`
   - 目标：`domains/node/view/store.ts`（单入口，内部局部函数）
2. `domains/edge/view/query/*` 收敛：
   - 将 `query/index.ts + query/endpoints.ts + query/types.ts + Derivation.ts` 合并为 `domains/edge/view/store.ts`
3. `domains/mindmap/view/Derivation.ts` 移到 `runtime/view/mindmapDerivation.ts`（如果只被 runtime 使用）
4. `runtime/view/Registry.ts` 只组装 `createNodeViewStore/createEdgeViewStore/createMindmapViewStore`

预期收益：

1. `node/view` 文件数 4 -> 1
2. `edge/view` 文件数 5 -> 1
3. view 相关跳转路径明显缩短

## Phase C（中高风险，收敛命令 actor 与 domains API 壳）

目标：压缩大类和 API 壳层，减少“this 跳转 + bind 包装”。

变更清单：

1. `selection/commands/Actor.ts` class -> 函数式 controller：
   - `createSelectionController({ instance, resetTransient })`
   - 返回 `{ start, stop, select, toggle, clear, ... }`
2. `mindmap/commands/Actor.ts` class -> 函数式 controller：
   - `createMindmapController({ instance })`
   - 内部按职责拆局部段：`idFactory`、`layoutAnchorPatch`、`mutationBuilders`
   - 仍保持单文件优先（减少横跳），只在必要时再抽 helper
3. 统一 id 生成策略（避免 node/edge/mindmap 三套重复）
   - 建议新增 `runtime/write/idFactory.ts`（或内联到 `runtime/write`）
4. `domains/*/api.ts` + `bind*ById` 壳层收敛：
   - 方案 A：保留类型，合并到 `domains/api.ts` 单文件
   - 方案 B：在 `instance/create.ts` 直接组装 domains（最少文件）
   - 推荐 A：兼顾可读性与风险

预期收益：

1. class 数量减少（domains 内可降到 0）
2. 最大文件可读性提升（按职责段落组织）
3. domains API 层文件进一步减少

## 4. 目录收敛目标（建议）

当前：

1. `domains/node/{api,commands,model,query,view}`
2. `domains/edge/{api,commands,query,view}`
3. `domains/mindmap/{api,commands,query,view,interaction(empty)}`
4. `domains/selection/{api,commands,interaction(empty)}`
5. `domains/viewport/api.ts`

目标（完成 Phase C 后）：

1. `domains/node/{api.ts,commands.ts,viewStore.ts}`
2. `domains/edge/{api.ts,commands.ts,viewStore.ts}`
3. `domains/mindmap/{api.ts,commands.ts}`
4. `domains/selection/{api.ts,commands.ts}`
5. `domains/viewport/api.ts`

即：`domains` 只保留“对外域能力”；算法/派生尽量归 runtime/core。

## 5. 文件删减预估

保守估计（按阶段累计）：

1. Phase A：-5 ~ -8 文件
2. Phase B：再 -6 ~ -8 文件
3. Phase C：再 -3 ~ -6 文件

总体：`35 -> 15~21` 文件区间（按是否保留 api/bind 拆分）。

## 6. 验收与回归标准

每个 phase 必跑：

1. `pnpm --filter @whiteboard/engine lint`
2. `pnpm --filter @whiteboard/react lint`
3. `pnpm --filter @whiteboard/engine run bench:check`

手工回归（最小集）：

1. node drag / transform（含 snap、guide）
2. edge routing / connect
3. selection（node + edge）
4. mindmap 插入/移动/折叠
5. viewport pan/wheel

## 7. 实施顺序建议（避免大爆炸）

1. 先做 Phase A（可一次性落地，风险最低）
2. 再做 Phase B（先 edge/view，再 node/view）
3. 最后做 Phase C（selection 再 mindmap，最后 domains api 壳）

这样可以保证每一步都“可回滚、可验收、可发布”。
