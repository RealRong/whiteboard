# Engine 全链路可收敛问题与详细解决方案

更新日期：2026-03-05
范围：`packages/whiteboard-engine`（含 `whiteboard-react` 与其交互边界）
目标：在不考虑改造成本的前提下，按“漏斗原则 + CQRS + CODE_SIMPLIFIER”做到架构最清晰、最短路径、最少概念。

---

## 1. 核心结论

当前链路已经显著收敛，但仍有可继续简化的结构性问题，主要集中在：

1. reaction 协议仍偏重（`init/create/merge/run/reset`）。
2. invalidation envelope 仍有冗余顶层字段与命令式子字段。
3. writer 内部事务函数类型复杂度偏高（`as unknown as`）。
4. node/edge 多处同构重复（API 与 planner 双重重复）。
5. selection 语义动作仍由多次写操作拼接，漏斗不够彻底。
6. 类型层仍存在 legacy CQRS 暴露，干扰真实心智模型。
7. 文档替换路径中 `silent` 语义仍是隐式分支。

结论：还可以做一轮“最终收口”，把概念数继续压缩，形成更稳定的单漏斗主链。

---

## 2. 优化目标形态（终态）

期望终态链路：

`commands (semantic) -> write.apply -> planner -> writer.commit -> changeBus -> reactions.ingest -> read.apply(plan) -> reactions.flush(system write)`

终态原则：

1. 单写入口：所有写只进 `write.apply`。
2. 单读失效协议：仅保留 stage 级 plan（`index/edge`）且字段语义化。
3. reaction 模块统一协议最小化：输入 change，输出一次 flush 结果。
4. 一次用户语义动作尽量一次事务（尤其 selection 族）。
5. 类型导出与真实运行时一致，移除未使用抽象。

---

## 3. 问题清单与详细方案

## 问题 1：Reactions 模块协议过重（`init/create/merge/run/reset`）

现状：

- `Reactions` 模块协议包含 5 个钩子，新增模块需要理解多段生命周期与 task 形态。
- `Autofit` 需要先 `create task`，再由队列 `merge`，最后 `run` 转写。

根因：

- 为了扩展性提前拆得太细，导致新增模块心智负担过高。

目标形态：

- 模块协议收敛为 `ingest(change)` + `flush()`，必要时可选 `seed()`。
- 合并逻辑（原 `merge`）下沉到模块内部 pending 状态。

详细改造方案：

1. 定义最小 reaction 模块协议：
   - `topic`
   - `ingest(change): void`
   - `flush(): WriteInput | null`
   - 可选 `seed(): void`
2. `Reactions` 只做三件事：
   - 订阅 changeBus。
   - 先 `readRuntime.applyInvalidation(change.readHints)`。
   - 调用每个模块 `ingest(change)`，再统一调度一次 `flush`。
3. 删除 `init/create/merge/run/reset` 类型和调用路径。
4. `Autofit` 内部维护 `pending`（`rebuild + dirtyNodeIds`），在 `flush` 时计算并清空。

涉及文件：

- `packages/whiteboard-engine/src/instance/reactions/Reactions.ts`
- `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`
- `packages/whiteboard-engine/src/instance/reactions/ReactionTaskQueue.ts`

风险：

- 模块行为从“显式 task”转为“内部聚合状态”，需保证 flush 时机正确。

验证：

1. 初始加载触发一次 autofit。
2. 连续 node 更新被正确合并为少量 system write。
3. dispose 后无残留写入。

---

## 问题 2：ReactionTaskQueue 提前支持 frame lane，当前未产生实际收益

现状：

- 队列支持 `microtask | frame`，当前模块全部是 `microtask`。

根因：

- 预扩展设计先行，增加了分支与类型复杂度。

目标形态：

- 阶段一仅保留 microtask 队列。
- 若未来出现 frame 反应，再增量引入。

详细改造方案：

1. 把 `ReactionTaskQueue` 收敛为单 lane（microtask）。
2. 删除 `FrameTask` 依赖和 lane 分支。
3. 若保留未来能力，使用注释 + 小接口占位，而非运行时分支。

涉及文件：

- `packages/whiteboard-engine/src/instance/reactions/ReactionTaskQueue.ts`

风险：

- 后续需要 frame 语义时需要重新引入。

验证：

1. reaction 合并频次与当前一致。
2. 快速交互无额外抖动。

---

## 问题 3：ReadInvalidation envelope 顶层冗余（`mode/revision/dirty*`）

现状：

- `ReadInvalidation` 顶层包含 `mode/revision/dirtyNodeIds/dirtyEdgeIds`，当前读侧消费几乎只依赖 `index` 与 `edge`。

根因：

- 协议为“可观察性”保留了额外字段，但读执行链路并不依赖。

目标形态：

- envelope 最小化：只保留读侧真正执行所需内容。

详细改造方案：

1. 新协议改为：
   - `readHints: { index: IndexPlan, edge: EdgePlan }`
2. 删除顶层冗余字段（`mode/revision/dirtyNodeIds/dirtyEdgeIds`）。
3. 若确实需要审计信息，另建 debug 通道，不污染运行协议。

涉及文件：

- `packages/whiteboard-engine/src/types/read/invalidation.ts`
- `packages/whiteboard-engine/src/runtime/write/stages/invalidation/readHints.ts`
- `packages/whiteboard-engine/src/runtime/read/kernel.ts`
- `packages/whiteboard-engine/src/types/write/change.ts`

风险：

- 若外部依赖 change payload 顶层字段，会有破坏性变更。

验证：

1. `rg` 确认无消费已删除字段。
2. read stage 全量/增量路径都可触达。

---

## 问题 4：read stage 子计划字段命令式，漏斗语义不够纯

现状：

- `edge` plan 使用 `clearPendingDirtyNodeIds`、`appendDirtyNodeIds`、`appendDirtyEdgeIds` 等偏内部实现字段。
- `index.mode` 使用 `dirtyNodeIds` 作为模式值，语义不自然。

根因：

- 计划结构向实现细节泄漏。

目标形态：

- 使用统一“重建等级 + dirty 集合”模型。

详细改造方案：

1. 统一计划定义：
   - `index: { rebuild: 'none' | 'full' | 'dirty', dirtyNodeIds }`
   - `edge: { rebuild: 'none' | 'full' | 'dirty', dirtyNodeIds, dirtyEdgeIds }`
2. stage 内部自行解释 rebuild 语义，不在协议层出现 `append/clear` 动词。
3. `NodeRectIndex`、`SnapIndex`、`edge cache` 内部 switch 统一按 `rebuild`。

涉及文件：

- `packages/whiteboard-engine/src/types/read/change.ts`
- `packages/whiteboard-engine/src/runtime/write/stages/invalidation/readHints.ts`
- `packages/whiteboard-engine/src/runtime/read/stages/index/NodeRectIndex.ts`
- `packages/whiteboard-engine/src/runtime/read/stages/index/SnapIndex.ts`
- `packages/whiteboard-engine/src/runtime/read/stages/edge/cache.ts`

风险：

- 协议改动面较大，但都是内部闭环可控。

验证：

1. `replace` 触发 full rebuild。
2. 仅节点几何变化触发 dirty index + dirty edge。
3. 仅 edge routing 更新触发 edge dirty。

---

## 问题 5：Writer 事务函数类型复杂（条件泛型 + 多处断言）

现状：

- `commitTransaction<T>` 使用条件泛型并依赖 `as unknown as`。

根因：

- 想复用 apply/replace 两条路径，但类型系统复杂化。

目标形态：

- 明确拆分：`commitApply` 与 `commitReplace`。

详细改造方案：

1. 拆分函数：
   - `private commitApply(input: ApplyTransaction): ApplyResult`
   - `private commitReplace(input: ReplaceTransaction): ResetResult`
2. 保留公共函数：
   - `normalizeTrace`
   - `publishChange`
   - `syncDocumentState`
3. 删除全部 `as unknown as`。

涉及文件：

- `packages/whiteboard-engine/src/runtime/write/stages/commit/writer.ts`
- `packages/whiteboard-engine/src/types/write/writer.ts`（必要时轻调）

风险：

- 低风险，行为不变重构。

验证：

1. apply 成功/失败路径一致。
2. resetDoc、undo、redo 回归一致。

---

## 问题 6：node/edge planner 中 `toUpdateOperations` 重复

现状：

- node 与 edge 各有一份 `toUpdateOperations`，逻辑同构。

根因：

- 缺少稳定公共 helper。

目标形态：

- 抽单一 helper，保留类型清晰。

详细改造方案：

1. 新建 planner shared helper：
   - `mergeUpdatesById`
   - `toUpdateOperations(type, updates)`
2. node/edge planner 调用同一 helper。

涉及文件：

- `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/node.ts`
- `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/edge.ts`
- 新增 `packages/whiteboard-engine/src/runtime/write/stages/plan/shared/update.ts`

风险：

- 低，注意保持 patch 合并顺序。

验证：

1. 相同 id 多 patch 最终结果与现状一致。
2. 空 patch 过滤一致。

---

## 问题 7：node/edge API 的 order 族逻辑重复

现状：

- `bringToFront/sendToBack/bringForward/sendBackward` 在 node/edge 各重复一套。

根因：

- 同构逻辑未抽象。

目标形态：

- 通用 `createOrderCommands`。

详细改造方案：

1. 新建 `api/shared/order.ts`：
   - 输入 `readCurrentOrder`、`setOrder`。
   - 输出 4 个 order 方法。
2. node/edge 只保留各自特有方法。

涉及文件：

- `packages/whiteboard-engine/src/runtime/write/api/node.ts`
- `packages/whiteboard-engine/src/runtime/write/api/edge.ts`
- 新增 `packages/whiteboard-engine/src/runtime/write/api/shared/order.ts`

风险：

- 低，属于函数抽取。

验证：

1. order 行为回归。
2. `sanitizeOrderIds` 调用位置一致。

---

## 问题 8：selection 语义动作通过多次写操作拼接，不是单事务漏斗

现状：

- `duplicateSelected/groupSelected/ungroupSelected/deleteSelected` 使用循环与多次 command 调用。

根因：

- selection 定位在 façade 层，缺失 planner domain 承载复杂语义。

目标形态：

- selection 动作成为 write domain 中的一次计划生成，一次 commit。

详细改造方案：

1. 新增 `selection` write domain：
   - `selection.group`
   - `selection.ungroup`
   - `selection.delete`
   - `selection.duplicate`
2. planner 基于 snapshot 一次产出 operations。
3. selection API 层只发单条 command，不再多次 await。

涉及文件：

- `packages/whiteboard-engine/src/types/command/api.ts`
- `packages/whiteboard-engine/src/runtime/write/stages/plan/router.ts`
- 新增 `packages/whiteboard-engine/src/runtime/write/stages/plan/domains/selection.ts`
- `packages/whiteboard-engine/src/runtime/write/api/selection.ts`

风险：

- 中高风险（行为语义变化）：从部分成功模式变为单事务原子语义。

验证：

1. 历史步数与用户动作一致（1 动作 1 记录）。
2. 中间失败不产生部分残留。

---

## 问题 9：`types/command/api.ts` 文件过大且职责混合

现状：

- 单文件 470+ 行，混合 write command、public command、mindmap option、interaction option。

根因：

- 类型演化叠加，未分层归档。

目标形态：

- 类型文件按职责拆分，主入口只 re-export。

详细改造方案：

1. 拆分为：
   - `types/command/write.ts`
   - `types/command/public.ts`
   - `types/command/mindmap.ts`
   - `types/command/interaction.ts`
2. `types/command/api.ts` 保留导出聚合。

涉及文件：

- `packages/whiteboard-engine/src/types/command/api.ts`
- 新增若干类型文件。

风险：

- 低风险，主要是 import 路径变更。

验证：

1. 全仓类型通过。
2. public export 不变（如不做 breaking）。

---

## 问题 10：对外仍导出 legacy CQRS 类型，和当前真实链路不一致

现状：

- `index.ts` 仍导出 `CommandGateway/ProjectionRuntime/ReadFacade` 等。
- 实际运行已无 gateway/orchestrator 双层。

根因：

- 历史兼容导出未清理。

目标形态：

- 对外只暴露当前真实架构的类型。

详细改造方案：

1. 从 `src/index.ts` 删除 legacy CQRS 导出。
2. `types/cqrs/*` 迁移到 internal 或删除。
3. 如需兼容，给出一版明确 deprecate 期（仅文档，不保留双路径行为）。

涉及文件：

- `packages/whiteboard-engine/src/index.ts`
- `packages/whiteboard-engine/src/types/cqrs/*`

风险：

- 可能是 breaking change（若外部依赖这些类型）。

验证：

1. 仓内 `rg` 无引用。
2. 发布说明明确 breaking。

---

## 问题 11：trace 字段仍偏大（`transactionId/causationId/timestamp` 无有效消费）

现状：

- 当前只在 writer 端透传，未形成消费闭环。

根因：

- 历史 envelope 习惯残留。

目标形态：

- `trace` 最小集合。

详细改造方案：

1. `CommandTrace` 降到：
   - `commandId?`
   - `correlationId?`（可选）
2. `ChangeTrace` 降到：
   - `commandId`
   - `source`
   - `correlationId`（如保留）
3. 删除无消费字段：`transactionId/causationId/timestamp`。

涉及文件：

- `packages/whiteboard-engine/src/types/command/source.ts`
- `packages/whiteboard-engine/src/types/write/change.ts`
- `packages/whiteboard-engine/src/runtime/write/stages/commit/writer.ts`

风险：

- 若未来要做外部链路追踪，需要再扩展。

验证：

1. `rg` 确认无使用点。
2. changeBus payload 正常。

---

## 问题 12：`document.replace(..., { silent })` 是隐式语义，导致“reset 是否回传 onDocumentChange”可读性差

现状：

- `replaceDocument` 接受 `silent`，writer 在 replace 路径传 `silent: true`。
- 语义分散在 engine 与 writer 两处。

根因：

- “状态替换”和“对外回调策略”混在同一接口。

目标形态：

- 文档写入与外部回调策略解耦，接口语义显式。

详细改造方案：

1. 拆分 document port：
   - `setDocument(doc)` 纯写。
   - `emitDocumentChange(doc)` 由 writer 明确调用。
2. apply 路径调用 `set + emit`。
3. replace/reset 路径根据策略明确是否 emit（建议默认不 emit，避免 echo）。

涉及文件：

- `packages/whiteboard-engine/src/instance/engine.ts`
- `packages/whiteboard-engine/src/types/document/store.ts`
- `packages/whiteboard-engine/src/types/instance/engine.ts`
- `packages/whiteboard-engine/src/runtime/write/stages/commit/writer.ts`

风险：

- 中等风险，涉及 React 侧受控文档同步时序。

验证：

1. React 侧镜像防抖逻辑仍可用。
2. 外部 doc 注入与引擎回传不形成回声环。

---

## 问题 13：read 层仍有可降噪转发（context key map + property getter 转发）

现状：

- `createReadKernel` 内部通过 `keyAtomMap + get(key)` 间接读取。
- `readApi` 再做一层 getter 转发。

根因：

- 为抽象统一读接口引入额外跳层。

目标形态：

- 读路径尽量直通，减少不可见转发层。

详细改造方案：

1. `ReadRuntimeContext` 由“key string getter”收敛为“显式 state/snapshot getter”。
2. `readApi` 保留最终 public 形态，但内部直接引用 getter，不再 key map 反查。
3. `subscribe` 维持稳定接口。

涉及文件：

- `packages/whiteboard-engine/src/runtime/read/kernel.ts`
- `packages/whiteboard-engine/src/runtime/read/api/read.ts`
- `packages/whiteboard-engine/src/types/read/context.ts`

风险：

- 低风险，主要是结构重排。

验证：

1. 读接口返回引用稳定性不变。
2. 订阅行为与现状一致。

---

## 问题 14：write runtime 仍有轻微“compose 分裂”噪音（runtime/execution/commands）

现状：

- `runtime.ts -> createWriteExecution -> createWriteCommands` 三段组合。
- 当前已很薄，但阅读仍需跨文件来回跳。

根因：

- 模块组织追求职责清晰，牺牲部分“路径直观性”。

目标形态：

- 保留职责边界，但缩短主路径心智跳转。

详细改造方案：

1. 维持 `execution.ts + commands.ts` 双文件，不再继续拆层。
2. 在 `runtime.ts` 顶部加入 8~10 行“链路注释”，明确调用图。
3. `ENGINE_CURRENT_CHAIN_FLOW.md` 同步到终态链路。

涉及文件：

- `packages/whiteboard-engine/src/runtime/write/runtime.ts`
- `ENGINE_CURRENT_CHAIN_FLOW.md`

风险：

- 低风险，文档化为主。

验证：

1. 新人仅看 `runtime.ts` 即可理解主链。

---

## 问题 15：index stage 的 `IndexApplySource` 与 `snapshot` 重复透传可再收敛

现状：

- `NodeRectIndex` 与 `SnapIndex` 分别通过 source 读取 `snapshot/canvas`。

根因：

- 为通用接口设置了中间 source 结构。

目标形态：

- 方法签名更直接。

详细改造方案：

1. `NodeRectIndex.applyPlan(plan, snapshot)`。
2. `SnapIndex.applyPlan(plan, nodeRectIndex)`。
3. 删除 `IndexApplySource` 类型。

涉及文件：

- `packages/whiteboard-engine/src/runtime/read/stages/index/stage.ts`
- `packages/whiteboard-engine/src/runtime/read/stages/index/NodeRectIndex.ts`
- `packages/whiteboard-engine/src/runtime/read/stages/index/SnapIndex.ts`
- `packages/whiteboard-engine/src/types/read/indexer.ts`

风险：

- 低风险，签名收敛。

验证：

1. full/dirty 索引刷新结果一致。

---

## 4. 建议执行顺序（一步到位路线）

建议按下列顺序落地，保证“先低风险高收益，再改核心协议”：

1. Writer 去泛型断言（问题 5）。
2. node/edge 同构抽取（问题 6、7）。
3. read index source 参数收敛（问题 15）。
4. reaction 协议最小化（问题 1、2）。
5. invalidation 协议重塑（问题 3、4）。
6. trace 精简（问题 11）。
7. document replace 语义显式化（问题 12）。
8. selection 单事务化（问题 8）。
9. 类型文件拆分与 legacy 导出清理（问题 9、10）。
10. read 内部转发降噪与文档收尾（问题 13、14）。

---

## 5. 每阶段验收基线

每个阶段最少执行：

1. `pnpm -r lint`
2. `pnpm -r build`
3. 关键回归手测：
   - node create/update/delete/group/ungroup/order
   - edge create/update/delete/routing/order
   - viewport pan/zoom/reset
   - doc reset（同 id 与跨 id）
   - history undo/redo
   - selection group/delete/duplicate
   - autofit 与 read projection 同步

---

## 6. 最终效果预期

完成后可达到：

1. 引擎主链从“可用”升级到“最短可解释路径”。
2. API 表面语义更稳定，内部实现细节不外泄。
3. 新增功能时不会线性膨胀 Reactions 维护成本。
4. 写读协同保持单漏斗，避免隐式双语义与历史包袱。

