# Whiteboard Mindmap API 收敛设计与实现方案

更新时间：2026-03-01

## 1. 决策结论（已执行）

本次按“尽量缩小 API，不保留兼容”完整落地：

1. 删除旧的 17 个公开 `mindmap` 写方法（不保留兼容别名）。
2. 最终对外只保留一个写入口：`mindmap.apply(command)`。
3. `whiteboard-react` 调用点已全部迁移到 `apply`。

## 2. 变更范围

核心文件：

1. 类型定义：
   - [packages/whiteboard-engine/src/types/commands.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/types/commands.ts)
2. 命令实现：
   - [packages/whiteboard-engine/src/runtime/write/commands/mindmap/index.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/commands/mindmap/index.ts)
   - [packages/whiteboard-engine/src/runtime/write/commands/mindmap/base.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/commands/mindmap/base.ts)
3. 实例导出：
   - [packages/whiteboard-engine/src/instance/create.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/instance/create.ts)
4. UI 调用迁移：
   - [packages/whiteboard-react/src/mindmap/components/MindmapTreeView.tsx](/Users/realrong/whiteboard/packages/whiteboard-react/src/mindmap/components/MindmapTreeView.tsx)
   - [packages/whiteboard-react/src/mindmap/hooks/useMindmapDragInteraction.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/mindmap/hooks/useMindmapDragInteraction.ts)

## 3. 新 API 设计

## 3.1 对外接口（最终）

```ts
type MindmapCommands = {
  apply: (command: MindmapApplyCommand) => Promise<DispatchResult>
}
```

说明：

1. `apply` 是唯一能力入口。
2. 命令字面量收敛为一词 `type`，通过 `mode` 表达同族子能力，减少公开字符串面。

## 3.2 命令模型

`MindmapApplyCommand` 使用 discriminated union，命令字面量收敛为：

1. `create`
2. `replace`
3. `delete`
4. `insert`（`mode`: `child | sibling | external | placement`）
5. `move`（`mode`: `direct | layout | drop | reorder`）
6. `remove`
7. `clone`
8. `update`（`mode`: `data | collapse | side`）
9. `root`

定义位置：

1. [packages/whiteboard-engine/src/types/commands.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/types/commands.ts)

## 4. 旧 API 映射

| 旧 API | 新命令 |
|---|---|
| `create` | `create` |
| `replace` | `replace` |
| `delete` | `delete` |
| `addChild/addSibling/attachExternal/insertNode` | `insert` + `mode(child/sibling/external/placement)` |
| `moveSubtree/moveSubtreeWithLayout/moveSubtreeWithDrop` | `move` + `mode(direct/layout/drop)` |
| `reorderChild` | `move` + `mode(reorder)` |
| `removeSubtree` | `remove` |
| `cloneSubtree` | `clone` |
| `setNodeData/toggleCollapse/setSide` | `update` + `mode(data/collapse/side)` |
| `moveRoot` | `root` |

## 5. 实现细节

## 5.1 类型层

1. 删除旧 `BaseMindmapCommands` 的对外公开结构。
2. `MindmapApplyCommand` 收敛为“少量一词 `type` + 局部 `mode`”模型，减少公开命令字面量。
3. `MindmapCommands` 收敛为仅 `apply`。

## 5.2 命令实现层

1. 在 `mindmap/index.ts` 内新增 `apply` 分发器。
2. 分发器统一路由到 `base` 层能力。
3. 旧语法糖实现与导出已移除。
4. `insert` 的 `placement` 决策改为复用 core 的 `resolveInsertPlan`（engine 不再自行判定侧别与插入模式）。
5. `apply` 采用 `type + mode` 收敛分发：`insert/move/update` 在同一入口内完成子能力路由，减少公开 API 断面。
6. 删除 `mindmap/helpers.ts`，`index.ts`/`base.ts` 分别内联所需辅助逻辑，不再保留中间 helper 对象转发。

## 5.3 基础命令层

1. `base.ts` 不再依赖 `Commands['mindmap']` 旧方法签名。
2. 提供内部 `BaseMindmapCommands` 显式类型，供 `apply` 调度。
3. 同父移动 index 归一化逻辑已从 engine 下沉到 core，`base.ts` 不再做 `requestedIndex > fromIndex` 修正。
4. 新增统一执行器 `runTreeCommand`，收敛重复的“读取 mindmap -> 调用 core 命令 -> 错误映射 -> replace/mutate”模板路径，减少中间转发与重复分支。
5. `replace/delete` 已改为直接调用 core 的 operation 构建函数（`createReplaceOp/createDeleteOps`），移除 helper 空转发。
6. `base.ts` 内联 `readMindmap/idGenerator/replaceOps` 等局部能力，仅保留一个文件作为写域核心实现。

## 5.4 实例装配层

`instance.commands.mindmap` 仅导出：

1. `apply`

## 5.5 UI 调用层

已将以下调用从语法糖迁移为 `apply`：

1. `insertNode` -> `apply({ type: 'insert', mode: 'placement', ... })`
2. `moveRoot` -> `apply({ type: 'root', ... })`
3. `moveSubtreeWithDrop` -> `apply({ type: 'move', mode: 'drop', ... })`

## 5.6 Core 下沉完成项（本轮）

1. 新增插入决策纯函数：`resolveInsertPlan`，统一 `placement -> child/sibling/towardRoot` 规则。
2. `moveSubtree` 内置同父节点 index 归一化（同父重排时自动对插入索引做 -1 修正）。
3. 新增锚点补偿纯函数：`resolveAnchorPatch`，将 mindmap layout 计算与位移补偿从 engine `helpers` 下沉到 core。
4. 新增操作组装纯函数：`createReplaceOps`，统一 `mindmap.replace + anchor node.update` 的 operation 构建与 clone 语义。
5. 新增 `createReplaceOp` 与 `createDeleteOps`，将 `replace/delete` 场景的 clone+operation 模板下沉到 core，engine 不再内联构建。
6. 新增 `createCreateOp`，将 `mindmap.create` 的 operation 构建也收敛到 core。

文件：

1. [packages/whiteboard-core/src/mindmap/query.ts](/Users/realrong/whiteboard/packages/whiteboard-core/src/mindmap/query.ts)
2. [packages/whiteboard-core/src/mindmap/commands.ts](/Users/realrong/whiteboard/packages/whiteboard-core/src/mindmap/commands.ts)
3. [packages/whiteboard-engine/src/runtime/write/commands/mindmap/index.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/commands/mindmap/index.ts)
4. [packages/whiteboard-engine/src/runtime/write/commands/mindmap/base.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/commands/mindmap/base.ts)

## 6. 兼容策略

本次明确不保留兼容：

1. 不提供旧 API 同名别名。
2. 不提供 `legacy` 命名空间。
3. 外部若调用旧方法将直接类型报错。

## 7. 风险与应对

## 7.1 风险

1. 外部集成（仓外）若依赖旧 API，会在升级时中断。
2. 调用方手写 `type/mode` 字段时仍有拼写风险。

## 7.2 应对

1. 使用 discriminated union 保证分发分支可类型穷尽。
2. 通过 lint + UI 核心链路回归确保行为不退化。

## 8. 已执行验证

1. `pnpm --filter @whiteboard/core lint`
2. `pnpm --filter @whiteboard/engine lint`
3. `pnpm --filter @whiteboard/react lint`

结果：均通过。

## 9. 后续建议（可选）

1. 可评估将命令 `type` 从字符串字面量进一步收敛到常量枚举（或命名常量对象），减少调用端拼写风险。
2. 可评估将 `base.ts` 的 `replace/delete` 前置校验（id 存在、数组为空等）进一步抽成可复用校验器，继续减少边界层重复分支。

## 10. 2026-03-02 增量落地（继续收敛）

本轮在不改变行为的前提下，继续做“单词命名 + 减少转发噪音”的增量优化：

1. read 路径去掉 `runtime as xxx` 别名风格，改为直接语义导出：
   - `edge/runtime.ts` 导出 `edge`
   - `node/runtime.ts` 导出 `node`
   - `mindmap/runtime.ts` 导出 `mindmap`
   - `index/runtime.ts` 导出 `indexer`
2. `orchestrator.ts` 组装层进一步降噪，索引运行时改为 `indexer(...)` 直连。
3. `Writer` 收敛 `apply/replace` 为一个 `run(input)`（`type` 判别 union），不使用函数重载。
4. `HistoryDomain` 命名收敛为 `History`，文件名改为 `history.ts`。
5. `mindmap/edge/node/viewport` 命令里 `createInvalidResult/createCancelledResult` 收敛为 `invalid/cancelled` 等短名。
6. `shortcut/manager.ts` 继续收敛冲突选择相关命名，减少阅读噪音（如 `pick`, `hits`）。

主要文件：

1. [packages/whiteboard-engine/src/runtime/read/orchestrator.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/orchestrator.ts)
2. [packages/whiteboard-engine/src/runtime/read/layer.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/layer.ts)
3. [packages/whiteboard-engine/src/runtime/read/index/runtime.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/index/runtime.ts)
4. [packages/whiteboard-engine/src/runtime/read/edge/runtime.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/edge/runtime.ts)
5. [packages/whiteboard-engine/src/runtime/read/node/runtime.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/node/runtime.ts)
6. [packages/whiteboard-engine/src/runtime/read/mindmap/runtime.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/mindmap/runtime.ts)
7. [packages/whiteboard-engine/src/runtime/write/pipeline/Writer.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/pipeline/Writer.ts)
8. [packages/whiteboard-engine/src/runtime/write/history/history.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/history/history.ts)
9. [packages/whiteboard-engine/src/runtime/write/commands/mindmap/index.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/write/commands/mindmap/index.ts)
10. [packages/whiteboard-engine/src/runtime/shortcut/manager.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/shortcut/manager.ts)
