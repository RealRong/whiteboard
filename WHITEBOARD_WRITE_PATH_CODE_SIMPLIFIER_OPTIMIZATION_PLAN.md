# Whiteboard Engine Write Path CODE_SIMPLIFIER 优化方案

更新时间：2026-03-01

## 1. 范围与目标

本方案从 `packages/whiteboard-engine/src/instance/create.ts` 出发，沿 write 主链路梳理与优化：

1. `instance/create.ts`（装配入口）
2. `runtime/write/createRuntime.ts`（write runtime 装配）
3. `runtime/write/commands/*`（命令入口）
4. `runtime/write/pipeline/*`（执行与历史）
5. `instance/reactions/*`（写后 reaction）

目标：提升可读性、简洁度、命名一致性，收敛目录结构，降低后续维护与迁移成本。

## 2. 当前 Write 链路（简化视图）

1. `createEngine` 初始化 state/read/write runtime。
2. write 入口通过 `instance.commands.*` 调用 `writeRuntime.commands.*`。
3. write 执行由 `Writer` 内聚协调 `apply/history/reset`，提交文档与 revision。
4. `ChangeBus` 广播 change 给统一 `reactions` 装配层。
5. `reactions` 内部负责：`readRuntime.applyChange`、`replace` 时 `measure.clear`、`autofit.start`。

## 3. 已实施优化（本次）

### 项目 A：write 装配目录扁平化（去单文件目录）
- 问题：
  - write 下存在单文件目录语义（`runtime/`、`postMutation/`），路径冗长，导航成本高。
- 修改建议：
  - 使用 `runtime/write/createRuntime.ts` 作为 write runtime 工厂单入口。
  - 写后 reaction 收敛到 `instance/reactions/`（`Reactions.ts` 组合、`Autofit.ts`、`Measure.ts`）。
- 收益：
  - 路径更短，目录语义更直接，符合“尽量避免单文件目录”的简化原则。
- 风险：
  - 文件移动后容易出现相对路径错误。
- 验证方式：
  - 运行 `pnpm --filter @whiteboard/engine lint`，确认模块解析与类型通过。

### 项目 B：commands 命名统一到“commands”语义
- 问题：
  - `mindmap/selection` 使用 `Controller` 命名，与目录 `commands` 语义不一致。
- 修改建议：
  - `createMindmapController` -> `createMindmapCommands`
  - `MindmapController` -> `MindmapCommandsApi`
  - `createSelectionController` -> `createSelectionCommands`
  - `SelectionController` -> `SelectionCommandsApi`
- 收益：
  - 工厂函数与目录语义一致，减少“Controller/Commands”混用造成的认知负担。
- 风险：
  - 导出名更新可能影响引用方。
- 验证方式：
  - 全局检索旧命名无残留。
  - `pnpm --filter @whiteboard/engine lint` 通过。

### 项目 C：写路径 ID 生成逻辑去重
- 问题：
  - `node/edge/mindmap` 与 `Writer` 中存在重复 ID 生成样板代码（seed + loop + random）。
- 修改建议：
  - 新增 `runtime/write/id.ts`：
    - `createScopedId(...)`
    - `createBatchId(...)`
  - 各模块改为复用该工具。
- 收益：
  - 删除重复逻辑，统一行为，降低未来变更时的漏改风险。
- 风险：
  - 共用工具若实现错误会影响多个命令路径。
- 验证方式：
  - 关键命令回归：node/edge/mindmap create、doc reset。
  - `pnpm --filter @whiteboard/engine lint` 通过。

### 项目 D：`createEngine` 装配可读性收敛
- 问题：
  - 入口文件承担过多对象拼装细节，主流程可读性下降。
- 修改建议：
  - 在 `create.ts` 内将命令映射与 runtime 生命周期映射收敛为局部装配函数（如 `createCommands`、`createRuntimePort`）。
- 收益：
  - 主流程更聚焦于“创建顺序”，细节噪音下降。
- 风险：
  - 过度拆分可能让跳转次数增多。
- 验证方式：
  - 确认 `Instance` 对外 API 不变。
  - 回归 `tool/history/host/selection/node/edge/mindmap/viewport` 的命令映射完整性。

### 项目 E：`mindmap` 命令按操作族目录化拆分
- 问题：
  - 原 `commands/mindmap.ts` 约 580+ 行，命令实现与辅助逻辑混杂，阅读与维护成本高。
- 修改建议：
  - 将 `commands/mindmap.ts` 拆为目录：
    - `commands/mindmap/index.ts`（组合层，仅装配）
    - `commands/mindmap/base.ts`（create/replace/delete/add/move 等基础命令）
  - 已在后续收敛中删除 `commands/mindmap/helpers.ts`，将必要辅助能力内联回 `index.ts`/`base.ts`，减少一层转发。
- 收益：
  - 降低单文件复杂度，职责边界清晰，定位问题更快。
  - 与 `CODE_SIMPLIFIER` 的“函数拆分/目录化操作族”原则一致。
- 风险：
  - 多文件拆分后，导出与相对路径容易出错。
- 验证方式：
  - `pnpm --filter @whiteboard/engine lint` 通过。
  - mindmap 关键路径回归：`addChild/addSibling/moveSubtree/insertNode/moveRoot`。

### 项目 F：write pipeline 去协调器中间层
- 问题：
  - `WriteCoordinator` 主要承担薄包装与转发，形成 `createRuntime -> WriteCoordinator -> Writer` 额外层级。
- 修改建议：
  - 删除 `runtime/write/pipeline/WriteCoordinator.ts`。
  - 将 `mutate/history/resetDoc` 协调逻辑内聚到 `runtime/write/pipeline/Writer.ts`，`createRuntime.ts` 仅保留装配。
- 收益：
  - 减少一个中间类与一次对象跳转，写链路更直观。
  - `createWriteRuntime` 更薄，`Writer` 作为写执行入口更集中。
- 风险：
  - 历史捕获与 reset 行为若迁移遗漏会产生语义退化。
- 验证方式：
  - `pnpm --filter @whiteboard/core lint`、`pnpm --filter @whiteboard/engine lint`、`pnpm --filter @whiteboard/react lint` 全通过。
  - 回归 `history.undo/redo/clear`、`doc.reset`、常规 `mutate` 路径。

### 项目 G：change 订阅统一为 reactions + Autofit 显式生命周期
- 问题：
  - `create.ts` 与 group 自动收敛模块分散订阅 `changeBus`，生命周期与职责边界不够集中。
  - autofit 运行时构造即订阅，启动语义不显式。
- 修改建议：
  - 新增 `instance/reactions/Reactions.ts` 类，统一装配 change 反应器并内聚 `Measure`、`Autofit` 创建。
  - 将 `readRuntime.applyChange` 与 `replace -> measure.clear` 收口到 `Reactions`。
  - `Autofit` 改为显式 `start(changeBus)` + `dispose()` 生命周期。
  - `Autofit` 单次 sync 改为批量收集 `node.update`，一次 `mutate` 提交；dirty 节点优先、diff 兜底。
- 收益：
  - create 入口更清晰，change 下游职责更集中，新增 reaction 扩展点更明确。
  - 降低 group auto-fit 热路径重复计算与多次提交成本。
- 风险：
  - reaction 释放顺序若处理不当，可能引入重复订阅或遗漏订阅。
  - auto-fit 批量提交需确保与旧逻辑的最终收敛一致。
- 验证方式：
  - `pnpm --filter @whiteboard/core lint`、`pnpm --filter @whiteboard/engine lint`、`pnpm --filter @whiteboard/react lint` 全通过。
  - 回归 group 嵌套、节点跨组移动、`doc.replace` 场景。

## 4. 文件与命名调整清单（write path）

### 4.1 目录与文件
1. `runtime/write/createRuntime.ts` 作为 write runtime 工厂入口。
2. `instance/reactions/Reactions.ts` 作为 change reaction 组合入口。
3. `instance/reactions/Autofit.ts` 作为 group 自动收敛入口。
4. `instance/reactions/Measure.ts` 作为测量写入队列入口。
5. `runtime/write/id.ts` 新增公共 ID 生成工具。
6. `runtime/write/commands/mindmap/` 目录化拆分：
   - `index.ts`
   - `base.ts`
7. 删除 `runtime/write/pipeline/WriteCoordinator.ts`，由 `Writer` 内聚 `apply/history/reset`，`createRuntime.ts` 仅保留装配。
8. `runtime/write/pipeline/MutationExecutor.ts` 重命名为 `runtime/write/pipeline/Writer.ts`。

### 4.2 命名
1. `MindmapController` -> `MindmapCommandsApi`
2. `createMindmapController` -> `createMindmapCommands`
3. `SelectionController` -> `SelectionCommandsApi`
4. `createSelectionController` -> `createSelectionCommands`
5. `MutationExecutor` -> `Writer`
6. `GroupAutoFitRuntime` -> `Autofit`
7. `NodeMeasureQueue` -> `Measure`

## 5. 下一步优化建议（未实施）

### 建议 1：拆分 `selection.ts` 的复合流程
- 问题：
  - 复制、删除、分组逻辑聚集，局部复杂度高。
- 修改建议：
  - 提取 `selectionDelete.ts`、`selectionDuplicate.ts` 等内部 helper 文件。
- 收益：
  - 控制流更平坦，单函数职责更单一。
- 风险：
  - 拆分后共享上下文的参数设计需要谨慎，避免过度抽象。
- 验证方式：
  - 回归 selection delete/duplicate/group/ungroup。

### 建议 2：write pipeline 类型命名对齐
- 问题：
  - `Change`、`ChangeBus` 在读写模块边界上语义仍偏泛化。
- 修改建议：
  - 逐步收敛为更显式的类型命名（如 `WriteChange`）。
- 收益：
  - 读写边界更清晰，减少跨层误用。
- 风险：
  - 类型重命名波及 read 侧订阅类型。
- 验证方式：
  - 全量 TypeScript 检查 + read runtime 变更订阅回归。

## 6. 本次最小验证结果

已执行：

```bash
pnpm --filter @whiteboard/core lint
pnpm --filter @whiteboard/engine lint
pnpm --filter @whiteboard/react lint
```

结果：均通过（engine 包含 architecture check + TypeScript noEmit）。
