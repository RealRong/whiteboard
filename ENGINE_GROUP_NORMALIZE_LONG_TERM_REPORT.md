# ENGINE Group Normalize Long-Term Report

## 1. 结论

从长期最优角度看，当前 `Autofit` 不应该继续作为 `commit` 之后的 reaction 存在，也不应该继续沿着“增量更新器”方向深化。

最优抽象是：

- `group bounds autofit` 是 `Document` 的一种 **normalize / canonicalize** 过程。
- 它的职责不是维护读缓存，不是执行副作用，也不是独立的增量系统。
- 它应该在 **write funnel 内部** 完成，而不是在 `commit -> read -> reaction -> second write` 之后补一轮。

最优主链应收敛为：

```text
commands
-> plan
-> reduce
-> normalize document
-> commit final document
-> capture history
-> apply read impact
-> notify
```

而不是当前这条链：

```text
commands
-> plan
-> reduce
-> commit document
-> apply read impact
-> notify
-> autofit reaction
-> second write
-> second commit
-> second read impact
```

结论性的判断：

1. `Autofit` 的正确语义是 `normalize`，不是 `incremental updater`。
2. 增量只能作为 normalizer 内部优化，不能作为外部架构主语义。
3. 长期最优应把 `Autofit` 从 `engine reaction` 提升到 `write` 内部的 `normalize stage`。
4. 如果只追求最简而不在乎一轮额外扫描，现有 `ReadImpact` 已足够作为“是否需要跑 normalize”的 gate；但长期更优仍是把 `normalize` 直接放进 write funnel，连 gate 借用都不再需要。

---

## 2. 当前设计的问题

当前相关位置：

- `packages/whiteboard-engine/src/runtime/write/index.ts`
- `packages/whiteboard-engine/src/instance/reactions/autofit.ts`
- `packages/whiteboard-core/src/kernel/reduce.ts`
- `packages/whiteboard-engine/src/runtime/read/apply.ts`

当前 `Autofit` 机制本质上是：

1. 第一次写入通过 `plan + reduce` 产生 `doc`
2. 先提交这份 `doc`
3. 先驱动 read
4. 再把 `ReadImpact` 喂给 `Autofit`
5. `Autofit` 再产生一份 `system write`
6. 第二次提交、第二次 read

这种设计能工作，但从长期最优角度有五个结构问题。

### 2.1 文档会短暂落在“未归一化中间态”

如果 group rect 还没有包住 children，那么第一次 `commit` 后的 document 其实并不是 canonical state。

这会导致：

- read 先看见一次中间态
- `onDocumentChange` 可能先收到一次中间态
- history 的“用户一次操作”在语义上被拆成两段提交

### 2.2 `Autofit` 借用了 `ReadImpact`

当前 `Autofit` 触发依赖：

- `impact.reset`
- `impact.node.geometry`
- `impact.node.list`
- `impact.mindmap.view`

但这份契约本来是为 read/index/projection 设计的，不是为 group normalize 设计的。

这会带来两个问题：

1. 字段语义过宽，例如 `node.order.set`、`zIndex`、`layer` 会落进 read 侧的 `node.list`，但并不一定影响 group bounds。
2. `Autofit` 的主链语义变成“从 read invalidation 反推 normalize 触发”，这违反漏斗原则。

### 2.3 Second write 让 write funnel 不再单路

当前写链虽然已经比早期更直，但 `Autofit` 仍然以 reaction 的方式发起第二次写入，导致：

- 一次用户写操作可能对应两次 `commit`
- history/replay 要处理额外的 system write
- write 和 reaction 之间形成隐式回环

### 2.4 `Autofit` 现在更像“文档语义修正”，而不是“外部副作用”

如果我们承认 group bounds 是文档不变量的一部分，那么它就不该待在 reaction 这个层级。

reaction 更适合：

- 调度副作用
- host 交互
- 外部通知
- 非文档级派生行为

而 `group bounds canonicalization` 明显属于 `Document` 自身语义。

### 2.5 复杂度来源不是算法，而是放置位置不对

现在 `Autofit` 看起来复杂，根因不是“算 group rect”本身复杂，而是它被放在了一个错误的位置，必须去补：

- pending 状态
- second write
- read impact 借用
- reaction flush 调度
- 多次 commit/read/notify 的协同

一旦把它改成 write 内部 normalize stage，大量结构噪音会自然消失。

---

## 3. `Autofit` 的正确抽象

`Autofit` 最佳抽象不是：

- reaction
- task
- invalidation consumer
- incremental projector

而是：

- `normalizeGroupBounds(document, options) -> patches`
- 或 `normalizeDocument(document, options) -> document/operations`

### 3.1 它的本质是 canonicalization

group 的不变量可以表达为：

- group 的 rect 必须覆盖自己的 direct children
- 外扩固定 padding
- 结果必须幂等
- 连续运行两次不应继续产出变化

这就是典型的 normalize 语义。

### 3.2 它不应该以“脏节点增量协议”定义自己

长期最优的定义不应该是：

```text
impact -> dirty node ids -> touched groups -> updateMany
```

而应该是：

```text
document -> normalize groups -> patches
```

增量只应存在于实现内部，例如：

- 跳过明显不受影响的 group
- 复用一次 children map
- 预排 group 深度

这些都不应成为顶层架构概念。

---

## 4. 最优 normalize 语义

### 4.1 输入

`group normalize` 的最小输入应为：

- `document`
- `nodeSize`
- `groupPadding`
- 可选的 `rectEpsilon`

不需要：

- `ReadImpact`
- `dirty node ids`
- `GroupLayoutIndex`
- `NodeRectIndex`
- `prevNodes`

### 4.2 输出

最实用的输出形态是：

```ts
readonly Operation[]
```

即直接输出标准 `node.update` operations。

原因：

1. write funnel 后续本来就以 operations 为统一中间形态。
2. normalize 如果输出 operations，就可以直接并回 `reduce` / `history` / `inverse` 主链。
3. 不需要额外再从 `NodePatch[]` 转一层。

如果只从纯算法可读性考虑，也可以先返回：

```ts
readonly { id: NodeId; patch: NodePatch }[]
```

但长期最优的 write 集成形态仍然是 operations。

### 4.3 处理单位

每个 group 只检查自己的 `direct children`，不要递归扫描所有 descendants。

### 4.4 处理顺序

必须按 **bottom-up** 顺序做，也就是从最内层 group 到最外层 group。

原因：

- 子 group 的 rect 先被规范化
- 父 group 在后面处理时才能看到更新后的 child rect
- 这样单轮 pass 就可以收敛到稳定状态

### 4.5 计算方式

单轮 normalize pass：

1. 扫一遍 document nodes
2. 构建 `childrenByParentId`
3. 收集全部 group
4. 计算每个 group depth
5. 按 depth 从大到小排序
6. 为每个 group 计算 direct children bounding rect
7. 与当前 group rect 比较
8. 如果不同，产出 `node.update`
9. 在本轮工作副本里同步这个 group 的新 rect，供父 group 后续读取

这一轮 pass 应当是：

- 纯函数
- 幂等
- 不依赖引擎状态
- 不依赖 read stage

---

## 5. 最优链路位置

从长期最优角度，normalize 有三种可能放置方式：

### 5.1 方案 A：保持 reaction 形式

```text
reduce -> commit -> read -> reaction -> second write
```

优点：

- 改动小

缺点：

- 双提交
- 双 read
- 中间态可见
- history 语义拆裂
- 仍然需要 reaction 调度

结论：不推荐。

### 5.2 方案 B：`reduce` 之后、`commit` 之前，作为 write 内部 normalize stage

```text
plan
-> reduce
-> normalize operations/doc
-> if changed: reduce once more or merge to final result
-> commit final doc
```

优点：

- 没有 second write
- 没有中间态暴露
- history/read/notify 只走一次
- `Autofit` 作为文档语义收进 write funnel

缺点：

- 需要重写 write 内部集成方式

结论：这是长期最优方案。

### 5.3 方案 C：把 normalize 直接塞进 `reduceOperations`

```text
reduceOperations(doc, operations) => reduced and normalized result
```

优点：

- 结果最集中

缺点：

- `reduce` 会从“应用 operations”膨胀成“应用 operations + 文档 canonicalization”
- 容易把 kernel reducer 与文档规则耦死
- 未来如果有多个 normalizer，`reduce.ts` 会快速变得混杂

结论：不如方案 B 清晰。

### 5.4 最终推荐

长期最优推荐 **方案 B**：

在 `write` 内部引入显式 `normalize stage`，位于：

```text
plan -> reduce -> normalize -> commit -> history/read/notify
```

这比“把 normalize 硬塞进 reducer”更清晰，也比“挂在 reaction 后面补第二刀”更直。

---

## 6. 最优模块边界

### 6.1 `whiteboard-core`

`whiteboard-core` 负责：

- `normalizeGroupBounds(...)` 纯算法
- 未来如有需要，可扩展为 `normalizeDocument(...)` 组合多个 normalizer

它不应依赖：

- engine state
- scheduler
- read model
- reactions
- read indexes

### 6.2 `whiteboard-engine`

`whiteboard-engine` 负责：

- 在 write funnel 内部调用 normalizer
- 传入 config
- 把 normalize 产生的 ops 合并进最终提交
- 保证 history/read/notify 只发生一次

### 6.3 read/index/projection

read 只处理：

- 已经规范化后的 final document
- 自己的 projection/index invalidation

read 不应再为 normalize 提供主契约。

---

## 7. 最优 write 集成方式

这里有两种实现路线。

### 7.1 路线 1：二段 reduce

```text
base = reduceOperations(doc, plannedOps)
normalizeOps = normalizeGroupBounds(base.doc)
final = normalizeOps.length ? reduceOperations(base.doc, normalizeOps) : base
commit(final.doc)
```

优点：

- 复用现有 reducer
- 集成简单
- 不需要改 reducer 内部结构

缺点：

- 一次写可能做两次 reduce

如果 group normalize 的操作量通常很小，这条路线完全可接受，而且实现最清楚。

### 7.2 路线 2：reduce 内工作副本直接继续归一化

```text
apply planned operations on draft
run group normalize on current draft
append normalize operations and inverse
finalize once
```

优点：

- 单次 reducer 流水
- 性能更极致

缺点：

- 会显著增加 reducer 复杂度
- `reduce.ts` 更难保持单一职责

### 7.3 最终推荐

长期演进建议分两步：

1. 先落地路线 1，结构最清晰，风险最低。
2. 只有在基准确认二段 reduce 成为瓶颈时，再考虑并入 reducer 内部。

也就是说，从长期最优的工程路径看：

- **架构最优**：normalize stage 在 write 内部
- **实现首选**：先用二段 reduce 实现它

---

## 8. history 的最优行为

normalize 并入 write 内部后，history 行为应当是：

- 用户一次写入
- 对应一次 history capture
- capture 的 forward 包含：`plannedOps + normalizeOps`
- capture 的 inverse 也包含两者的完整逆序

这样 history 语义最稳定：

- undo 回到写前 canonical state
- redo 回到写后 canonical state
- 不会出现“用户操作 undo 一次，但 group rect 还要再补一次”的割裂感

这也是把 normalize 并入 write funnel 的核心收益之一。

---

## 9. read / notify 的最优行为

normalize 并入 write 后，read 和 notify 都只看最终 doc。

### 9.1 read

最优行为：

- 只 apply 一次 impact
- 这份 impact 对应 final canonical doc

这里可以有两种策略：

1. `plannedOps` 和 `normalizeOps` 各自产生 impact，再做 merge
2. 直接对 final forward operations 统一做一次 reduce/impact finalize

长期最优是第 2 种：

- 最终提交什么 ops
- 就对这套 ops 计算一次最终 impact

这样不会保留“计划写入的 impact”和“规范化补写的 impact”两套概念。

### 9.2 notify

`onDocumentChange` 应该只收到一次，而且只收到 final canonical document。

这是比当前 reaction second write 方案更合理的行为。

---

## 10. mindmap 语义

这里必须先明确一条产品级语义，否则 normalize 的边界会反复摇摆。

### 10.1 路线 A：group 只包节点原始 rect

如果 group 只按 node 自身 `position/size/rotation` 参与 normalize：

- 算法最简单
- normalizer 完全独立于 read
- mindmap root 只按 root node 自身 rect 参与 group bounds

### 10.2 路线 B：group 包真实可见内容

如果 group 需要包住真实可见内容，那么 mindmap root 的 visual bbox 也应参与 group normalize。

这时需要新增一个更稳定的纯算法输入，例如：

```ts
getNodeBounds(nodeId) -> Rect
```

其中：

- 普通节点：来自原始 rect/AABB
- mindmap 节点：来自 mindmap layout visual bbox

### 10.3 推荐

如果目标是先把链路收直，建议分两阶段：

1. 第一阶段先落地路线 A，把 normalize stage 放进 write funnel。
2. 第二阶段再扩展到路线 B，把“视觉 bounds”抽象接进 normalizer。

这样可以先解决主链结构问题，再处理更细的视觉语义问题。

---

## 11. 最优命名

如果它已经被定义为 normalize，那么长期看命名也应收口。

不推荐继续把核心能力叫成一个强行为色彩的 reaction 名字。

推荐命名：

- `normalizeGroupBounds`
- `groupBoundsNormalizer`
- `normalizeDocumentGroups`

如果后续扩展为文档级 normalize 组合器，可进一步收为：

- `normalizeDocument`
- `createDocumentNormalizer`

而 `autofit` 更适合作为 UI/交互层面的术语，不适合作为内核 canonicalization 的总称。

---

## 12. 建议的阶段化重构顺序

### Phase 1：把算法定型为纯 normalizer

目标：先把“它是 normalize”这个事实固化下来。

动作：

1. 在 `whiteboard-core` 提供 `normalizeGroupBounds` 纯函数
2. 输入只接受 document + options
3. 输出标准 operations 或 patches
4. 算法采用 direct children + bottom-up 单轮 pass

### Phase 2：把 reaction 模式降级为临时适配层

目标：在不一次性大改 write 的情况下，先让 `Autofit` 只是调用 normalizer。

动作：

1. engine 的 `autofit.ts` 不再维护复杂增量语义
2. 只保留简单 gate 或直接全量 schedule
3. `flush()` 直接调用 core normalizer

这一步仍可保留 reaction，但其意义已经变成“临时接线层”。

### Phase 3：把 normalizer 并入 write funnel

目标：删除 second write。

动作：

1. `createWrite` 在 `reduce` 后引入 `normalize stage`
2. 最终只 commit 一次
3. history/read/notify 只走一次
4. 删除 `reactionQueue` 与 `autofit reaction` 依赖

### Phase 4：收掉残余概念

动作：

1. 删除 `WriteReaction` 中与 group normalize 相关的职责
2. `Autofit` 文件迁移为 `normalize` 模块或彻底删除
3. `ReadImpact` 不再作为 normalize gate 被借用
4. 更新 `ENGINE_CURRENT_CHAIN_FLOW.md`

---

## 13. 风险与取舍

### 13.1 风险：二段 reduce 的额外开销

这是可接受的工程 trade-off。

理由：

- 结构清晰度收益远高于一次额外 reduce 的局部成本
- group normalize 产出的 ops 数一般很小
- 真有性能问题，再做内部融合即可

### 13.2 风险：mindmap 视觉范围尚未统一

这是独立问题，不应阻塞 normalize stage 入 write funnel。

先解决：

- `Autofit` 的链路位置
- second write
- history/read 中间态

再解决：

- visual bounds 语义统一

### 13.3 风险：现有 system write/history 行为改变

这是必要的正确变化，不应视为架构风险。

normalize 本来就应属于用户写入的一部分，而不是额外的一次系统提交。

---

## 14. 最终推荐方案

长期最优路线明确如下：

1. 把 `Autofit` 重新定义为 `group bounds normalize`。
2. core 提供纯 `normalizeGroupBounds(document, options)`。
3. engine write 在 `reduce` 后、`commit` 前执行 normalize stage。
4. normalize 输出并入同一次最终提交与同一次 history capture。
5. read / notify 只消费 final canonical document。
6. 增量优化只保留为 normalizer 内部实现细节，不再上升为主链语义。

最终主链：

```text
commands
-> plan
-> reduce planned operations
-> normalize group bounds
-> reduce normalize operations if needed
-> commit final canonical document
-> capture history once
-> apply read impact once
-> notify once
```

这是比当前 reaction 方案更清晰、更单路、更符合漏斗原则的长期最优形态。

---

## 15. 一句话总结

**`Autofit` 不应再被视为 reaction 或增量更新器；它应被收敛为 write funnel 内部的 document normalize stage。**
