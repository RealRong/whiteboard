# Whiteboard Engine Remaining Optimizations

## 目标

整理 `packages/whiteboard-engine` 当前仍然存在的结构性异味与可优化项，按高 / 中 / 低优先级分级，给出问题、影响、建议路线与落地顺序。

这份文档只讨论 **engine 本体**，不讨论 React 侧 viewport / selection / UI lifecycle。

---

## 当前总体判断

`viewport` 完全迁出 engine 之后，主骨架已经明显变干净：

1. `engine` 只负责 document 语义
2. `write` 只负责 document mutation
3. `read` 只负责 document 派生
4. `history` 只留在 write 语义内部

也就是说，**顶层方向已经基本正确**。

现在剩下的问题，主要不是总架构方向错误，而是：

1. `write` 侧还没有完全收成单一漏斗
2. `read` 侧局部复杂度过高，尤其是 `edge projection`
3. 类型层和调度层还有历史噪音

---

## 高优先级

### 1. `write/normalize` 仍然是双 `reduce`

**问题**

当前 `createWriteNormalize()` 的逻辑是：

1. 先用原始 operations 做一次 `reduce`
2. 基于 `planned.doc` 生成 group normalize operations
3. 再回到原始 `document` 上，把两批 operations 合并后再 `reduce` 一次

这说明 normalize 还没有真正进入单次提交漏斗，而是挂在外部补了一轮。

**位置**

- `packages/whiteboard-engine/src/write/normalize.ts`
- `packages/whiteboard-engine/src/write/index.ts`

**影响**

1. 每次提交至少两次完整 `reduce`
2. normalize 语义不是提交 session 的一部分，而是外接补丁
3. 后续如果新增更多 normalize 规则，提交路径会越来越厚
4. 这会让“写提交到底什么时候完成”这个边界继续模糊

**建议**

长期最优方案是：

1. 把 normalize 下沉进单次 commit / reduce session
2. `plan -> reduce -> normalize -> finalize` 发生在一个提交上下文里
3. 不要再做“先 reduce 一次，再重新 reduce 一次”的外层包裹

**优先级判断**

这是目前最应该优先收的点之一，因为它同时影响：

- 性能
- 提交漏斗清晰度
- 后续扩展成本

---

### 2. `commands` 层仍然在做前置 planning

**问题**

`commands` 本来应该是北向意图边界，但现在仍然承载了部分 planning：

1. `node.updateData()` 会先读当前 node，再 merge `data`
2. `order` 系列会先读当前顺序，再生成新的 order ids，然后再下发 `order.set`

这意味着写语义被拆散到了：

1. `commands`
2. `write/plan`

两层。

**位置**

- `packages/whiteboard-engine/src/commands/node.ts`
- `packages/whiteboard-engine/src/commands/edge.ts`
- `packages/whiteboard-engine/src/commands/order.ts`

**影响**

1. 违反漏斗原则，上层不再只是表达意图
2. planning 分散后，很难知道真正的写规则在哪
3. 未来新增命令时，很容易继续把逻辑塞进 `commands`
4. `commands` 变成了 service/orchestrator，而不是纯 API boundary

**建议**

长期最优方案是：

1. `commands` 只负责北向 API 语义
2. 所有需要读当前 document 再决定写法的逻辑，统一收回 `plan`
3. 如果 `updateData` / `order` 的能力保留，应该让它们成为明确的 plan 语义，而不是 command 层自己算

**优先级判断**

这个点和 `normalize` 一样，属于结构性污染源，越晚收越容易继续扩散。

---

### 3. `write` 仍然维护两套命令语言

**问题**

当前同时存在：

1. 对外 `Commands` 方法树
2. 对内 `WriteInput / WriteCommandMap` union

链路是：

`commands/* -> WriteInput union -> write/plan/* -> operations`

这中间有大量“只是改名、搬字段、再 switch 一次”的适配层。

**位置**

- `packages/whiteboard-engine/src/types/command.ts`
- `packages/whiteboard-engine/src/commands/*`
- `packages/whiteboard-engine/src/write/plan/*`

**影响**

1. 重复层多
2. 增加新命令时要改两套协议
3. 同一个语义要在 methods / union / plan switch 里出现多次
4. 让 `commands` 和 `plan` 的边界变得不够直

**建议**

长期有两条路，必须二选一：

1. 保留 `Commands` 作为北向 API，内部直接进入 plan，不再保留独立的 `WriteCommandMap`
2. 保留 `WriteInput` 作为唯一写协议，`commands` 退化成极薄 façade，甚至删除一部分包装

当前更适合的方向是第 1 条：

- 北向保留方法树
- 内部减少镜像 union 层

---

### 4. `document.replace` 仍然是一条特例提交流程

**问题**

现在：

1. `apply`
2. `history.undo/redo`

都经过 `publish()`

但：

1. `replace`

只经过 `syncRead()`

这说明同样是 document mutation，post-commit 管道没有完全统一。

**位置**

- `packages/whiteboard-engine/src/instance/engine.ts`

**影响**

1. 后续如果添加 post-commit side effect，很容易漏掉 `replace`
2. 提交流程存在“主路 + 特例路”
3. API 名义上是同一层 mutation，行为边界却不统一

**建议**

长期最优方案是明确二选一：

1. `replace` 就是特殊静默加载通道，那么必须在命名上显式表达，不要叫 `replace`
2. `replace` 也是标准 document mutation，那么必须走统一 post-commit 漏斗

如果继续保留 `replace` 这个命名，更合理的是第 2 条。

---

### 5. `read` 的失效协议已经分裂

**问题**

现在三种 projection 的失效协议不一致：

1. `node projection` 直接吃 `ReadImpact`
2. `edge projection` 吃的是 `none | dirty | full + nodeIds + edgeIds`
3. `mindmap projection` 只看 `reset / view`

于是 `createReadApply()` 被迫把同一份 impact 再翻译一次。

**位置**

- `packages/whiteboard-engine/src/types/read.ts`
- `packages/whiteboard-engine/src/read/apply.ts`
- `packages/whiteboard-engine/src/read/projection/node.ts`
- `packages/whiteboard-engine/src/read/projection/edge.ts`
- `packages/whiteboard-engine/src/read/projection/mindmap.ts`

**影响**

1. projection 表面统一，内部 freshness 协议却不统一
2. 新增 projection 时，`read/apply.ts` 会继续膨胀
3. `read` 内核变成手工翻译器，而不是统一协议调度器

**建议**

长期最优方案：

1. `read` 内部只保留一种标准 invalidation contract
2. 如果确实需要 specialized rebuild，应当在 projection 内部自行解释，而不是让 `createReadApply()` 替它翻译
3. `createReadApply()` 最终应只做统一分发，不做每个 projection 的手工协议适配

---

### 6. `edge projection` 已经过厚，边界开始失真

**问题**

`edge projection` 内部同时维护：

1. `relations`
2. `cacheById`
3. `ids`
4. `byId`
5. geometry tuple
6. structure tuple
7. reconcileAll / reconcileEdges 增量同步逻辑

这已经不只是 projection，而像是一个隐藏的 `edge index + edge view cache subsystem`。

**位置**

- `packages/whiteboard-engine/src/read/projection/edge.ts`

**影响**

1. projection / index 边界开始失真
2. edge 读链复杂度远高于其他 projection
3. 后续任何 edge read 能力都容易继续堆进这里
4. 维护成本会持续上升

**建议**

长期最优方案是明确拆边界：

1. `edge relations / edge dependency graph` 抽成独立 index 或 cache domain
2. `edge projection` 只负责把稳定输入 materialize 成公开 view
3. 不要让一个 projection 同时承担关系维护、缓存策略和对外视图三层职责

---

### 7. `mindmap projection` 存在 `raw layout / resolved layout` 语义不一致

**问题**

当前 cache key 用的是 `resolvedLayout`，但真正 `buildTree()` 用的仍然是原始 `layout`，对外暴露的 `MindmapViewTree.layout` 也是原始值。

这意味着：

1. cache 认为两次输入等价
2. 但对外暴露的 layout 却不一定是规范化后的当前语义

**位置**

- `packages/whiteboard-engine/src/read/projection/mindmap.ts`

**影响**

这不是纯味道问题，而是潜在行为不一致。

**建议**

必须统一成一条语义：

1. cache key 用 resolved
2. buildTree 用 resolved
3. 对外暴露的 `MindmapViewTree.layout` 也用 resolved

---

## 中优先级

### 8. `read` 派生层过厚，存在 `model -> index -> projection` 连续缓存

**问题**

同一批实体在多层反复 materialize：

1. `ReadModel` 持有 `canvasNodeById / canvasNodeIds`
2. `NodeRectIndex` 再维护一份
3. `NodeProjection` 又包一层 `entryById / idsRef`
4. `EdgeProjection` 也维护自己的 `ids / byId / cache`

**位置**

- `packages/whiteboard-engine/src/read/model.ts`
- `packages/whiteboard-engine/src/read/indexes/*`
- `packages/whiteboard-engine/src/read/projection/*`

**影响**

1. 派生层层叠加
2. invalidation 成本增加
3. 认知负担显著提高
4. 很难判断某类数据应该缓存在哪一层

**建议**

长期最优方案：

1. `model` 只保留最基础、可复用的派生
2. `index` 负责空间/关系查询
3. `projection` 只负责对外读视图

也就是三层职责重新拉开，不要每层都再缓存一份相似数据。

---

### 9. projection 对 index 的依赖还是隐式调用顺序契约

**问题**

projection 并没有完全把 index 当作稳定输入：

1. `NodeProjection` index 取不到时会 fallback 到自己算 rect
2. `EdgeProjection` 直接依赖 node index 算 endpoints

这说明 projection 和 index 的边界还在互相渗透。

**位置**

- `packages/whiteboard-engine/src/read/projection/node.ts`
- `packages/whiteboard-engine/src/read/projection/edge.ts`

**影响**

1. projection 不再是纯 consumer
2. index 的时序要求变成隐式契约
3. 读链的稳定性依赖人工维持初始化顺序

**建议**

长期最优方案：

1. projection 明确只消费稳定 index 输出
2. 不要在 projection 中对 index 缺失做兜底
3. 如果需要 fallback，应在 index 层内部解决，而不是下游 projection 自己算

---

### 10. `Scheduler / Task` 更像残留抽象

**问题**

主链里 `Scheduler` 现在基本只剩：

1. `now()`
2. `cancelAll()`

`Task.ts` 里的 `FrameTask / MicrotaskTask` 已经不在主链里。

**位置**

- `packages/whiteboard-engine/src/scheduling/Scheduler.ts`
- `packages/whiteboard-engine/src/scheduling/Task.ts`
- `packages/whiteboard-engine/src/instance/engine.ts`
- `packages/whiteboard-engine/src/write/index.ts`

**影响**

1. 抽象还在，但没有真实 domain 价值
2. 目录结构保留了已经退出主舞台的 runtime 语义
3. 增加理解成本

**建议**

长期最优方案：

1. 如果 engine 只需要 `now()`，直接注入 clock / now function
2. 如果确实不再有统一调度语义，删除 `Task.ts`
3. 不要为了过去的 runtime 形态保留现在不再需要的抽象

---

### 11. `read` rebuild 入口还没有完全收成单路

**问题**

现在存在三类入口：

1. 初始化 prime
2. 正常 `commit`
3. `mindmapLayout` 变更的 synthetic impact

**位置**

- `packages/whiteboard-engine/src/read/index.ts`
- `packages/whiteboard-engine/src/read/impacts.ts`
- `packages/whiteboard-engine/src/instance/engine.ts`

**影响**

新增 projection / index 时，需要同时改多个接线点。

**建议**

长期最优方案：

1. 初始化也走统一 rebuild 协议
2. runtime option 变更也走统一 rebuild 协议
3. `createRead()` 不要手工知道每类 projection 的启动方式

---

## 低优先级

### 12. 类型层还有重复协议与 alias 噪音

**问题**

典型例子：

1. `Apply` 在两处定义
2. failure helper 在两处定义
3. 一些 type alias 只是纯转发，没有真正形成稳定语义

**位置**

- `packages/whiteboard-engine/src/write/draft.ts`
- `packages/whiteboard-engine/src/commands/result.ts`
- `packages/whiteboard-engine/src/types/write.ts`
- `packages/whiteboard-engine/src/types/read.ts`
- `packages/whiteboard-engine/src/types/instance.ts`

**影响**

1. 代码跳转多
2. 容易出现同名不同来源的协议
3. 小噪音会持续拖累可读性

**建议**

1. `Apply` 只保留一份定义
2. failure result helper 只保留一份定义
3. 纯转发 alias 能删就删

---

### 13. `CommandSource` 粒度可能已经偏细

**问题**

现在 `CommandSource` 里有：

- `ui`
- `shortcut`
- `remote`
- `import`
- `system`
- `history`
- `interaction`

但进入 write 后基本只会被折叠成：

- `user`
- `system`
- `remote`

**位置**

- `packages/whiteboard-engine/src/types/command.ts`
- `packages/whiteboard-engine/src/write/index.ts`

**影响**

1. 北向协议携带了比内部真正需要更多的标签
2. source 粒度和真实历史语义不匹配

**建议**

如果后续没有更多 source-specific 行为，建议收窄或明确分层：

1. engine 内部只保留真正影响写语义的 source
2. 更细的来源标签留在 UI / host

---

### 14. `mindmap.ids` impact 粒度比实现更细，但当前没有收益

**问题**

上游 impact 在维护 `mindmap.ids`，但 engine 侧 `MindmapProjection.applyChange()` 并没有利用这份 ids 粒度，而是整体 `reconcile`。

**位置**

- `packages/whiteboard-core/src/kernel/*`
- `packages/whiteboard-engine/src/read/projection/mindmap.ts`

**影响**

协议复杂度高于实际收益。

**建议**

二选一：

1. 真的用起来，做增量 mindmap refresh
2. 否则删除这层多余粒度

当前更倾向第 2 条。

---

## 推荐执行顺序

### 第一阶段：先收主漏斗

1. 把 `normalize` 下沉进单次 commit
2. 统一 `replace` / `apply` / `history replay` 的 post-commit 出口
3. 把 `commands` 收回成纯意图边界

### 第二阶段：再收 `read`

1. 统一 read invalidation protocol
2. 修掉 `mindmap projection` 的 raw/resolved layout 不一致
3. 抽出或重构 `edge projection` 的隐藏 index 职责

### 第三阶段：最后做清洁

1. 删除 `Scheduler / Task` 残留抽象
2. 删除重复 `Apply / failure helpers`
3. 清理低价值 alias 与过细 source 标签

---

## 总结

现在 `whiteboard-engine` 的问题已经不是“架构方向错”，而是“内部还有几处关键结构没有收干净”。

最关键的两条判断：

1. `write` 还没有完全成为单一漏斗
2. `read` 内部已经开始出现局部 subsystem 化

如果继续追求长期最优，优先顺序应该是：

1. `normalize`
2. `read invalidation`
3. `edge projection`
4. `commands/planning`
5. `scheduler/types cleanup`
