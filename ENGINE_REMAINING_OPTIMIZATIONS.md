# Engine / Core 剩余可优化项总表（再次更新）

更新日期：2026-03-07
范围：`packages/whiteboard-core`、`packages/whiteboard-engine`、`packages/whiteboard-react`
目标：在主链已经收敛后，只保留真正还值得继续做的边缘减法项。

## 1. 最新完成项

这一轮继续完成的关键收敛：

1. public mutation commands 已统一为标准 `Promise<DispatchResult>` 返回风格。
2. `node.updateMany / edge.updateMany / edge.routing.* / node.updateData` 已不再是 `void` fire-and-forget。
3. `node.duplicate` 的 speculative reduce 已下沉为 core 纯 helper。
4. engine `shortcut` facade 已删除。
5. engine `selection` 已收薄为基础状态操作，不再承担 group / delete / duplicate 编排。
6. `node.deleteCascade / node.duplicate / node.group.ungroupMany` 已提升为 public primitive，供 UI adapter 直接组合。
7. react 侧已新增 `shortcutDispatch.ts`，负责 shortcut guard、action 路由和 selection 复合语义。
8. 顶层 `instance.query` 已删除，所有只读能力已统一收进 `instance.read`。
9. `read.viewport / read.canvas / read.snap` 已并入 `EngineRead`。
10. `READ_SUBSCRIPTION_KEYS.snapshot` 已语义化为 `READ_SUBSCRIPTION_KEYS.projection`。

因此，当前已经不再存在以下历史噪音：

1. public mutation API 返回风格不一致。
2. duplicate planner 在 engine 层一边规划一边 reduce 的角色混杂。
3. shortcut / selection facade 挂在 engine 上造成的 UI 编排泄漏。
4. facade / planner 对返回副产物的隐式依赖。
5. read / query 双顶层入口。

## 2. 当前总判断

现在真正剩下的问题，已经不再是主 mutation 链，而是外围边界和少量局部实现仍略厚：

1. `commands` 里仍混合文档 mutation、交互状态命令和 host 事件桥。
2. `read` 内部虽然已经统一成一棵树，但 `state / projection / viewport / canvas / snap` 的边界还能继续打磨。
3. core reduce 内部仍有 copy / normalize 边界可以继续瘦身。
4. reactions / autofit 的实现还能继续做局部减法，但优先级已经明显下降。

一句话判断：主链已经很干净，下一阶段只需要继续删边缘噪音。

## 3. P0：最值得优先动的项

### 3.1 继续分清 commands 里的“文档命令”和“临时状态命令”

当前问题：

1. `commands` 里仍同时混着：
   - 文档 mutation
   - 交互状态写入
   - host 事件桥
   - selection 基础状态命令
2. `commands` 这个 public 面虽然已经收薄，但职责仍偏宽。

涉及文件：

1. `packages/whiteboard-engine/src/instance/facade/commands.ts`
2. `packages/whiteboard-engine/src/runtime/write/api/interaction.ts`
3. `packages/whiteboard-engine/src/runtime/write/api/edge.ts`
4. `packages/whiteboard-engine/src/instance/facade/selection.ts`

最优设计：

1. 保留 `commands` 作为唯一 public mutation 入口，但在结构上显式区分：
   - `doc / node / edge / viewport / history`
   - `interaction / host / selection`
2. 如果继续追求极限收薄，可以把纯状态命令再逐步下沉到 `state` 或 `runtime`，让 `commands` 更聚焦文档写入。

收益：

1. public 面更清楚。
2. engine 的命令边界更稳定。
3. 后续再扩展不容易重新长胖。

建议优先级：`最高`

### 3.2 继续打磨统一后的 `read` 树

当前问题：

1. `read` 虽然已经统一为单入口，但内部仍包含：
   - `state`
   - `projection`
   - `viewport`
   - `canvas`
   - `snap`
2. 其中少量调用方仍可能继续混用 `doc.get()`、`projection` 和 `canvas`，后续还可以继续压缩边界。

涉及文件：

1. `packages/whiteboard-engine/src/runtime/read/kernel.ts`
2. `packages/whiteboard-engine/src/types/instance/read.ts`
3. `packages/whiteboard-react/src/common/hooks/useReadGetter.ts`

最优设计：

1. 保持单一 `instance.read` 入口不变。
2. 后续只继续优化树内分层，不再重新引入第二张只读面。
3. 如有必要，再把 projection 订阅粒度做得更语义化。

收益：

1. 读侧继续保持单漏斗。
2. UI 层更容易理解什么是状态、什么是稳定投影、什么是参数化只读能力。

建议优先级：`很高`

## 4. P1：高收益但不阻塞主链的项

### 4.1 `kernel` / reduce 的 copy 与 normalize 边界继续瘦身

当前问题：

1. `reduceOperations` 与 `session` 之间仍可能存在重复 defensive copy。
2. normalize、apply、collect invalidation 的边界还可以再拉直。

涉及文件：

1. `packages/whiteboard-core/src/kernel/reduce.ts`
2. `packages/whiteboard-core/src/kernel/session.ts`

最优设计：

1. defensive copy 只保留一个稳定位置。
2. normalize 只做 normalize，不再兼做 clone 或别的副职责。
3. reduce session 尽量保持单向、单次循环、无额外中间态。

建议优先级：`中高`

### 4.2 reactions / autofit 局部继续减法

当前问题：

1. reaction 主链已经很直，但 `Autofit` 仍有局部规则判断和脏数据整理逻辑。
2. 如果未来 reaction 模块长期仍然很少，这层还有继续抽平的空间。

涉及文件：

1. `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
2. `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`

最优设计：

1. 保持统一 microtask flush 不变。
2. 继续把 `Autofit` 的触发条件和任务构建压成更少、更稳定的语义节点。
3. 只有在 reaction 模块长期极少时，才继续考虑进一步内联。

建议优先级：`中`

## 5. P2：文档与边界清理项

### 5.1 public command / read 面文档继续同步

当前问题：

1. 近期 public 面收敛较快，文档容易滞后。
2. 特别是 `commands`、`read` 的边界，最容易在后续迭代中再次模糊。

最优设计：

1. 每次 public 面收缩或迁移时，同步更新根目录架构文档。
2. 避免文档里继续保留“待评估但实际上已经完成”的旧路线。

建议优先级：`中低`

## 6. 全局最优执行顺序

如果按“收益最高、结构最清楚”排序，建议顺序是：

1. 继续分清 `commands` 的 mutation / state 边界。
2. 继续打磨统一后的 `read` 树。
3. 再做 core reduce 的 copy / normalize 瘦身。
4. 最后视 reaction 模块增长情况决定是否继续内联 reactions。

## 7. 最终结论

现在的核心判断已经很明确：

1. 主 mutation 链已经收敛完成。
2. 副作用链也已经收敛完成。
3. public mutation API 已经统一。
4. shortcut / selection 编排已经移出 engine。
5. duplicate planner 也已经回到 core 纯 helper。
6. read / query 已经收口成单一 `read`。

如果继续按“全局最简”推进，下一步最值的是：

1. 把 `commands` 的 mutation / state 边界继续分开。
2. 继续打磨统一后的 `read` 树。
3. 再回头瘦身 core reduce 内部实现。
