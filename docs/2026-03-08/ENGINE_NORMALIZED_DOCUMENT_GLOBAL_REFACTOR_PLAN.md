# Engine Normalized Document 全链路重构方案

更新日期：2026-03-07
范围：`packages/whiteboard-core`、`packages/whiteboard-engine`、`packages/whiteboard-react`
目标：以下一阶段 normalized `Document` 为唯一 canonical state，重构整条 write / reduce / history / read / projection / persistence 链路。

## 1. 目标文档模型

下一阶段的目标 `Document`：

```ts
type Document = {
  id: DocumentId

  nodes: {
    entities: Record<NodeId, Node>
    order: NodeId[]
  }

  edges: {
    entities: Record<EdgeId, Edge>
    order: EdgeId[]
  }

  viewport?: Viewport
  background?: Background
  meta?: {
    createdAt?: string
    updatedAt?: string
  }
}
```

核心原则：

1. `Document` 本身就是运行时唯一 canonical state。
2. `Operation` 架构不改，仍然保持当前领域语义。
3. `entities` 负责实体集合，`order` 负责顺序，彻底分离职责。
4. read side 的索引和投影继续是派生物，不再承担“补 canonical 索引”的职责。
5. 如果需要外部交换格式，可以在边界做 serializer，而不是让运行时 canonical state 为了导入导出妥协。

## 2. 最终核心判断

如果不在乎重构成本，这个 normalized `Document` 应该成为整套 engine 的中心事实来源，而不是 reducer 内部临时索引。

这意味着：

1. reducer 不再需要从 `nodes: Node[] / edges: Edge[]` 重新构造 `Map`。
2. read 不再需要额外补一层 `edgeMap`、`nodeMap` 才能进行 O(1) 查询。
3. history replay 不再需要数组查找路径。
4. invalidation 的 dirty ids 可以直接围绕 `entities` 语义生成。
5. whole-document commit 和 operation commit 的差异进一步缩小，都是提交 canonical `Document`。

一句话：

**当前链路里大量“中间索引”和“materialize 回数组”的复杂度，根因是 canonical `Document` 结构不适合引擎运行时。把 `Document` 自身升级成 normalized state，才能从根上拉直整条链。**

## 3. 最终目标链路

最终正式主链建议收敛为：

```text
commands
  -> write
  -> plan
  -> reduceOperations
  -> document.commit
  -> read.applyInvalidation
  -> react(invalidation)
  -> reactions
  -> system write
```

其中：

1. `commands` 只表达 public 意图。
2. `write` 只负责 plan、history、commit 编排。
3. `plan` 只负责把 command 翻译成 `Operation[]`。
4. `reduceOperations` 是唯一 mutation 内核。
5. `read` 只做索引、投影、查询。
6. `reactions` 只消费 invalidation 并按需回流到 system write。

需要删掉的中间概念：

1. `KernelSession` 公开对象。
2. reducer 内部“再造一份 maps”的过渡结构。
3. reducer 结束后再从文档重建 maps 的流程。
4. 任何为了数组型 `Document` 做的“补索引”语义。

## 4. reduce 最优形态

## 4.1 最终 API

保留：

```ts
reduceOperations(document, operations, context): KernelReduceResult
```

删除概念上的：

1. `createKernelSession()` 公开语义。
2. `session.applyOperations()`。
3. `session.exportDocument()`。

理由：

1. 当前没有真实 session 生命周期。
2. 每次 reduce 都是一次性创建、一次性消费、一次性销毁。
3. 对 core 来说，最清晰的语义是“纯 reducer 函数”，不是“伪 runtime session”。

## 4.2 reducer 内部状态

最终不建议直接在 public `Document` 上做两遍同步，而建议构造一份本次 reduce 私有的内部 draft：

```ts
type ReduceDraft = {
  base: Document
  next: Document

  touched: {
    nodeIds: Set<NodeId>
    edgeIds: Set<EdgeId>
    nodeOrder: boolean
    edgeOrder: boolean
    viewport: boolean
    background: boolean
    meta: boolean
    mindmap: boolean
  }

  changes: Operation[]
  inverseGroups: Operation[][]
  invalidation: InvalidationState
  timestamp: number
}
```

这里的关键不是 draft 字段长什么样，而是下面三点：

1. `next` 是 canonical `Document` 本体，不再额外 materialize 成另一个 shape。
2. reducer 只维护一份可变工作态，不再双写 `WorkingState + Document draft`。
3. `touched` 和 `invalidation` 直接围绕 canonical state 更新。

## 4.3 reducer 执行步骤

最终建议单循环处理：

```ts
const draft = createReduceDraft(document, context)

for (const rawOperation of operations) {
  const operation = normalizeOperation(draft, rawOperation)
  const inverse = buildInverse(draft, operation)
  if (!inverse) return invalid(...)

  draft.changes.push(operation)
  draft.inverseGroups.push(inverse)
  trackInvalidation(draft, operation)
  applyOperation(draft, operation)
}

finalizeDraft(draft)
return toReduceResult(draft)
```

也就是 reducer 最终只保留四个正式步骤：

1. `normalizeOperation`
2. `buildInverse`
3. `applyOperation`
4. `finalizeDraft`

当前 reducer 里最该删除的噪音，就是这两份重复语义：

1. 一份 `applyWorkingOperation(...)`
2. 一份 `applyOperation(...)`

最终最优方案里，两者必须合并成一份。

## 4.4 copy-on-write 规则

因为 canonical `Document` 已经是 reducer-friendly 结构，所以最终不需要“全量 deep clone”，也不需要 `Immer` 成为长期核心依赖。

最优实现建议是手写最小 copy-on-write：

1. `node.update` 时，只复制：
   - `nodes.entities`
   - 对应的单个 `Node`
2. `node.delete` 时，只复制：
   - `nodes.entities`
   - `nodes.order`
3. `edge.update` 时，只复制：
   - `edges.entities`
   - 对应的单个 `Edge`
4. `node.order.set` 时，只复制：
   - `nodes.order`
5. `viewport.update` 时，只复制：
   - `viewport`
6. `meta.updatedAt` 时，只复制：
   - `meta`

这会带来两个直接收益：

1. reducer 成本从“全图规模主导”变成“被 touched 分支主导”。
2. 读侧可以直接利用分支引用稳定性做更便宜的 projection 增量更新。

## 4.5 before 和 inverse 最优方案

`Operation` 架构不改，但 inverse 应该保持最小形态。

建议：

1. `node.create` 的 inverse：

```ts
{ type: 'node.delete', id }
```

2. `node.delete` 的 inverse：

```ts
{ type: 'node.create', node: before }
```

3. `node.update` 的 inverse：

```ts
{ type: 'node.update', id, patch: before }
```

4. `edge.create` 的 inverse：

```ts
{ type: 'edge.delete', id }
```

5. `edge.delete` 的 inverse：

```ts
{ type: 'edge.create', edge: before }
```

6. `viewport.update` 的 inverse：

```ts
{ type: 'viewport.update', after: beforeViewport }
```

核心原则：

1. reducer 统一捕获 `before`。
2. inverse 不重复携带多余字段。
3. replay 再次进入 reducer 时，由 reducer 自动补新的 `before`。

这和当前 history 的 forward / inverse 结构完全兼容，不需要改 `Operation` 架构。

## 4.6 normalizeDocument 最优边界

如果不在乎重构成本，`normalizeDocument` 不应该继续留在 reduce 热路径中。

建议分层：

1. `load / replace / import / deserialize` 时，做一次边界 normalize。
2. `reduceOperations` 默认假设输入 `Document` 已经是 normalized canonical state。
3. reducer 内部只保留极轻量的 fast-path 守卫，不再每次补齐结构。

也就是说：

1. normalize 是“边界职责”。
2. reduce 是“执行职责”。

不要再让 reducer 每次进入都重复做 shape 修正。

## 5. plan 链路怎么优化

normalized `Document` 落地后，`plan` 也应该同步瘦身。

## 5.1 plan 的职责不变

`plan` 继续只做两件事：

1. command 归一化
2. command -> `Operation[]`

不做：

1. reducer 级索引构建
2. `before` 捕获
3. read projection 依赖

## 5.2 plan 查询改成 direct canonical access

当前很多 helper 之所以需要 `.find(...)`、`.findIndex(...)`、`Map(...)`，是因为 `Document` 还是数组型。

切换到 normalized `Document` 后：

1. 单实体读取：

```ts
const node = doc.nodes.entities[id]
const edge = doc.edges.entities[id]
```

2. 顺序遍历：

```ts
for (const id of doc.nodes.order) {
  const node = doc.nodes.entities[id]
}
```

3. group / ungroup / duplicate / mindmap attach 这类 planner helper，不再需要额外建 map。

## 5.3 plan helper 最优收口方式

建议只保留极少数通用读取 helper：

1. `getNode(doc, id)`
2. `getEdge(doc, id)`
3. `orderedNodes(doc)`
4. `orderedEdges(doc)`
5. `getMindmapTree(doc, id)`

不要为了新 shape 再发明一大堆薄包装层。

## 6. history 链路怎么优化

normalized `Document` 落地后，history 的架构本身不需要大改，但可以变得更轻。

## 6.1 保持现有模型

保持：

1. `history.capture({ forward, inverse, origin })`
2. `undo -> replay(inverse)`
3. `redo -> replay(forward)`

这套模型现在已经对的。

## 6.2 history 不再承担 clone 责任

原则：

1. `Operation` 一旦创建即视为 immutable。
2. clone 责任只在 reducer 捕获 `before` 时发生。
3. history 只保存引用，不做复制。

这会让 history 继续保持极薄。

## 6.3 replay 成本明显下降

因为 reducer lookup 已经 O(1)：

1. undo/redo 不再需要围绕数组反复扫描。
2. 大量 replay 成本会从“文档规模主导”转向“操作量主导”。

## 7. read / projection / index 链路怎么优化

normalized `Document` 最大的收益之一，不在 write，而在 read。

## 7.1 read 不再承担“补 entity map”的隐性职责

现在 read 侧存在很多“为了高效访问而补 map / cache”的需求，本质上是 canonical `Document` 结构不适合查询。

当 canonical `Document` 已经是：

1. `nodes.entities`
2. `nodes.order`
3. `edges.entities`
4. `edges.order`

read 侧就不该再为“按 id 查实体”单独造 map。

read 侧真正应该保留的索引是：

1. `nodeRectIndex`
2. `snapIndex`
3. `visibleEdgeProjection`
4. `mindmapLayoutProjection`

这些都是真正的投影或空间索引，而不是“给文档本体补 canonical 索引”。

## 7.2 projection 最优读取方式

建议：

1. 节点投影按 `doc.nodes.order` 遍历。
2. 边投影按 `doc.edges.order` 遍历。
3. 单实体查询直接 `entities`。
4. projection cache 以分支引用为增量依据：
   - `doc.nodes.entities` 变没变
   - `doc.nodes.order` 变没变
   - `doc.edges.entities` 变没变
   - `doc.edges.order` 变没变

这会让 read side 的增量判断比现在简单很多。

## 7.3 invalidation 可以继续保留显式协议

normalized `Document` 不意味着 invalidation 必须删掉。

最优方案是：

1. 保留显式 invalidation 协议。
2. invalidation 直接围绕 reducer touched 集合生成。
3. read stage 同时可以借助分支引用相等做 fast-path。

也就是说：

1. 显式 invalidation 负责语义清晰。
2. 引用相等负责实现层 fast-path。

两者不冲突。

## 7.4 query 噪音进一步下降

比如当前一些 read/query 场景里还会为了单条 edge 或 node 额外建 map。

normalized `Document` 后：

1. `edge by id` 直接走 canonical state。
2. `node by id` 直接走 canonical state。
3. projection 只处理真正的几何和布局派生。

这能进一步落实“读侧只做投影，不做 canonical 纠偏”。

## 8. reactions 链路怎么优化

reactions 不需要大改，但会自然变干净。

原因：

1. reducer 生成 touched ids 更直接。
2. read invalidation 更准确。
3. projection 增量更稳定。

这意味着：

1. `Autofit`、未来的 `Autoroute`、其他副作用模块可以依赖更清晰的 dirty 语义。
2. reaction 侧不再需要为了弥补读模型不稳定而兜大量条件判断。

## 9. persistence / import / export 怎么设计

如果完全不在乎兼容性，最优做法是：

1. 直接把 normalized `Document` 作为新的持久化格式。
2. 所有导入导出都围绕新 shape。

如果仍然想保留外部可读性，则建议分层：

1. runtime canonical state：normalized `Document`
2. snapshot / import / export：array-based `SnapshotDocument`

但从你这次的约束来看，不在乎重构成本，也不强调兼容性，那最直接的方案就是：

**全链路统一迁移到 normalized `Document`。**

这样最简单，也最干净。

## 10. 最优阶段性路线

如果按“可以大范围重构，一步到位”的标准，建议按下面顺序推进。

## 阶段 1：类型和边界统一

1. 把 `Document` 改成 normalized shape。
2. `load / replace / import` 边界统一做 normalize。
3. 删除所有数组型 `Document` 假设。

## 阶段 2：core reduce 重写

1. 删除 `KernelSession` 概念。
2. `reduceOperations` 改为单函数 reducer。
3. 删除 `WorkingState + Document draft` 双状态。
4. 删除 `createMaps / rebuildMaps` 热路径。
5. 删除 reducer 内为了数组文档服务的 `findIndex / includes / indexOf` 主路径。

## 阶段 3：plan helper 重写

1. group / ungroup / duplicate / mindmap helpers 全部改成 direct canonical access。
2. 删除所有“临时建 map”的 planner 代码。

## 阶段 4：read / projection 重写

1. 所有 stage 直接围绕 `entities + order` 读文档。
2. 删除“补 canonical map”的 query/cache。
3. 保留真正的几何和空间索引。

## 阶段 5：历史与副作用校正

1. 核查 undo / redo replay 正确性。
2. 核查 invalidation 与 projection 的最小 dirty 语义。
3. 校准 autofit 等 reaction 模块。

## 阶段 6：删除过渡兼容代码

1. 删除数组型 `Document` adapter。
2. 删除旧 helper。
3. 删除所有只为旧 shape 存在的兼容层。

## 11. 最终设计决策

最终我建议明确做下面这些决策。

### 决策 1

运行时 canonical `Document` 改成 normalized shape，不再使用 `Node[] / Edge[]` 作为引擎内核事实来源。

### 决策 2

`Operation` 架构保持不变。

### 决策 3

`reduceOperations` 改成纯 reducer，不再保留 session 对象语义。

### 决策 4

read side 的索引只保留真正的 projection / spatial index，不再承担 canonical 文档查找的补索引职责。

### 决策 5

history 继续存 forward / inverse operations，不改成 patch-based 模型。

### 决策 6

如果不在乎兼容性，持久化格式也直接迁移到 normalized `Document`。

## 12. 一句话结论

如果下一阶段的目标就是：

```ts
Document = {
  nodes: { entities, order }
  edges: { entities, order }
}
```

那么整条链路的最优方向不是“继续在 reducer 里补中间索引”，而是：

**让 normalized `Document` 本身成为引擎唯一 canonical state；删除 session 语义；把 reduce 重写成单循环纯 reducer；把 read 彻底收敛成真正的 projection layer。**

这会同时带来：

1. 更低的 reducer 固定成本
2. 更简单的 before / inverse 逻辑
3. 更干净的 invalidation
4. 更自然的 read projection 增量
5. 更少的中间层和补索引噪音
