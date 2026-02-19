# WHITEBOARD_HINT_PIPELINE_PLAN

## 1. 目标

把当前“node operation -> graph dirty/order/fullSync”逻辑拆成**可读、可扩展、可追踪**的流水线结构，让新同学第一次看就能回答三件事：

1. 输入是什么（operations + 当前 nodes）。
2. 中间发生了什么（规则逐条判定，写入统一上下文）。
3. 输出是什么（`dirtyNodeIds` / `orderChanged` / `fullSync`）。

---

## 2. 命名规则（本方案约束）

为避免命名冗余，按目录语义去重：

1. 同目录不重复加 `Doc`/`Graph` 前缀。
2. 非 class 文件优先短语义词：`types.ts`、`index.ts`、`bench.ts`。
3. 规则与编排若为 class，实现文件使用 PascalCase：`HintPipeline.ts`、`UpdateRule.ts`。
4. class 名保持“短 + 语义明确”：`HintPipeline`、`HintContext`、`GraphSync`。
5. 类型名统一使用 `Hint` 语义，不再用 `CanvasNodeDirtyHint` 这种历史名。
6. **凡是 class 文件一律使用 PascalCase 文件名**（如 `HintPipeline.ts`、`UpdateRule.ts`）。

---

## 3. 目录落地（建议）

```txt
packages/whiteboard-engine/src/
  graph/
    hint/
      types.ts
      index.ts
      HintContext.ts
      HintPipeline.ts
      rules/
        UpdateRule.ts
        OrderRule.ts
        CreateRule.ts
        DeleteRule.ts
      trace.ts
      bench.ts

  change/
    GraphSync.ts
```

说明：

1. `graph/hint` 只做“计算 hint”，不直接调用 graph 写接口。
2. `change/GraphSync.ts` 只做“把 hint 应用到 graph”（`reportDirty/reportOrderChanged/requestFullSync`）。
3. 现有 `runtime/lifecycle/watchers/nodeHint.ts` 与 `nodeHint.bench.ts` 迁移到上述目录（语义对齐）。

---

## 4. 组件职责（一句话版）

### `change/GraphSync.ts`

- `GraphSync`：接收 operations，调用 hint pipeline，应用到 `instance.graph`。

### `graph/hint/HintPipeline.ts`

- `HintPipeline`：按顺序执行各条 rule，输出最终 `Hint`。

### `graph/hint/HintContext.ts`

- `HintContext`：统一承载缓存和中间状态，提供语义化写入方法（mark dirty/order/fullSync）。

### `graph/hint/rules/*.ts`（PascalCase）

- `UpdateRule`：处理 `node.update`（type/parent/layer/collapsed 等）。
- `OrderRule`：处理 `node.order.*`。
- `CreateRule`：处理 `node.create`。
- `DeleteRule`：处理 `node.delete`。

### `graph/hint/trace.ts`

- `HintTrace`：记录“哪条规则因为什么触发了哪种 hint”，只在 debug/bench 开启。

### `graph/hint/types.ts`

- 定义统一输出类型 `Hint` 与规则协议 `Rule`。

---

## 5. 统一上下文（HintContext）设计

`HintContext` 只暴露语义方法，不暴露可变字段，避免新手直接改内部状态。

核心能力：

1. 读模型（懒加载 + 缓存）
   - `readNodes()`
   - `readNodeById()`
   - `readChildrenByParent()`
2. 写 hint
   - `markNodeDirty(id)`
   - `markSubtreeDirty(id)`
   - `markAncestorGroupsDirty(parentId)`
   - `markOrderChanged()`
   - `requestFullSync()`
3. 结束输出
   - `buildHint(): Hint`

这样新同学只要看 `HintContext` 的公开方法，就能理解“哪些动作是合法动作”。

---

## 6. 流水线执行模型

`HintPipeline` 固定三步：

1. `init`：创建 `HintContext`。
2. `run`：按 operations 顺序遍历，每条 operation 交给第一个 `canHandle` 的 rule。
3. `finalize`：`context.buildHint()` 返回结果。

约束：

1. 一条 operation 只由一个 rule 处理（防止重复标记）。
2. 一旦 `fullSync` 触发，后续 operation 可直接跳过（与现逻辑一致）。
3. rule 只读 operation + context，不直接访问外部 graph。

---

## 7. 调用链时序图（无代码）

```text
change/pipeline.apply
  -> GraphSync.syncByOperations(operations)
      -> HintPipeline.run(operations, getNodes)
          -> Rule(Update/Order/Create/Delete).apply(...)
          -> HintContext 累积 dirty/order/fullSync
      -> 得到 Hint
      -> GraphSync.applyHintToGraph(hint)
          -> requestFullSync | reportDirty | reportOrderChanged
  -> graph.flush('doc')
  -> syncGraph(graphChange)
```

---

## 8. 规则矩阵（新手速查）

| Operation | 触发动作 |
|---|---|
| `node.update` + `type` 涉及 `group` | subtree dirty + order changed |
| `node.update` + `parentId` | subtree dirty + order changed |
| `node.update` + group `collapsed` 变化 | subtree dirty + order changed |
| `node.update` + `layer` | node dirty + order changed |
| 普通 `node.update` | node dirty |
| `node.order.*` | order changed + ancestor groups dirty |
| `node.create` | node dirty + ancestor groups dirty + order changed |
| `node.delete` group | subtree dirty + ancestor groups dirty + order changed |
| `node.delete` normal | node dirty + ancestor groups dirty + order changed |
| 无法安全判断类型变更 | full sync |

---

## 9. 可观测性（让“为什么脏”一眼可见）

建议加一个轻量 trace 开关（默认关）：

1. 输出字段：`operationIndex`、`operationType`、`rule`、`effect`、`reason`。
2. 只在 debug/bench/测试开启。
3. 对外只暴露只读 trace，避免业务层依赖 trace 结构。

---

## 10. 迁移步骤（最小风险）

### Phase 1：搬家不改行为

1. 把 `nodeHint.ts` 迁到 `graph/hint`，导出接口不变。
2. 把 bench 一起迁移到 `graph/hint/bench.ts`。
3. `change/pipeline.ts` 只改 import 路径，行为保持一致。

### Phase 2：引入 class 编排

1. 增加 `HintContext` + `HintPipeline` + `rules`。
2. 保持输出和旧实现一致（回归 bench + snapshot）。
3. 引入 `GraphSync`，把 `syncGraphByOperations` 从 `change/pipeline.ts` 挪出去。

### Phase 3：可读性与可观测收口

1. 增加规则矩阵文档和 trace。
2. 补齐关键 case 的单测（group type switch / collapsed / reparent / order）。
3. 清理旧命名（`CanvasNodeDirtyHint` -> `Hint`）。

---

## 11. 验收标准（Done）

1. `runtime/lifecycle/watchers` 下不再出现 hint 计算实现。
2. `change/pipeline.ts` 不再内联 `syncGraphByOperations` 细节。
3. hint 输出类型统一为一个 `Hint`（含 dirty/order/fullSync）。
4. 规则组件单一职责清晰，可独立测试。
5. 新同学能通过“目录 + 流程图 + 规则矩阵”在 10 分钟内理解链路。

---

## 12. 推荐最终命名（简洁版）

旧名 -> 新名：

1. `buildCanvasNodeDirtyHint` -> `buildHint`（位于 `graph/hint` 目录时）
2. `CanvasNodeDirtyHint` -> `Hint`
3. `syncGraphByOperations` -> `graphSync.syncByOperations`
4. `nodeHint.bench.ts` -> `bench.ts`

说明：目录已经提供语义，函数名不再重复 `Doc/Graph/Node` 前缀。
