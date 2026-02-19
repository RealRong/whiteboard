# WHITEBOARD_EXPLICIT_CALL_CHAIN_REFACTOR_PLAN

## 1. 目标

在不改变现有功能与交互结果的前提下，把 engine 内部从“分散监听驱动”重构为“显式调用链驱动”，降低理解成本与维护复杂度。

约束：

1. 不引入兼容层。
2. 不改变对外语义（commands/query/view 行为等价）。
3. 性能不退化（基准维持当前阈值）。

---

## 2. 当前复杂度来源

核心问题不是算法复杂，而是触发路径分散：

1. `graph.watch`、`state.watch`、`derived.watch` 在多个模块各自注册。
2. `registry.ts` 同时承担组装、监听 wiring、同步触发，职责过重。
3. 同一个变更会经历“多点监听 -> 多点转发 -> 间接触发派生”。
4. 读模型（view/query）的失效来源不够显式，调试路径长。

典型位置：

1. `packages/whiteboard-engine/src/kernel/view/registry.ts`
2. `packages/whiteboard-engine/src/kernel/view/bindings.ts`
3. `packages/whiteboard-engine/src/kernel/derive/registry.ts`

---

## 3. 目标设计（显式调用链）

## 3.1 总体链路

```text
Input (commands / interaction / doc sync)
  -> apply(ChangeSet)
  -> reducer 写 canonical state
  -> collect affected (graph/state ids & keys)
  -> pipeline.sync(affected)
       -> graph.sync(affected.graph)
       -> query.syncGraph(change)
       -> view.syncGraph(change)
       -> view.syncState(keys)
  -> boundary emit (instance.events)
  -> React/host 只订阅 boundary event 或 view/query watch
```

原则：

1. 内核模块之间不用 watcher 通信，用显式函数调用。
2. watcher 只留在边界层（React/插件/宿主）。
3. 一次 `apply` 内同步完成失效与重算调度，减少“隐式后续动作”。

## 3.2 设计模式

采用 `Pipeline Orchestrator + Passive Projection`：

1. Orchestrator 负责顺序与依赖（谁先 sync）。
2. Graph/Query/View 只暴露 `syncXxx` 与 `read/watch`，不主动订阅彼此。
3. 事件总线只做边界通知，不参与内核模块编排。

---

## 4. 模块职责重排

## 4.1 Registry 只做装配

`registry` 文件只做：

1. create state/graph/query/view 实例。
2. 组装 pipeline。
3. 返回 instance。

`registry` 不再直接写监听逻辑。

## 4.2 新增 Pipeline 层

建议新增：

1. `packages/whiteboard-engine/src/kernel/pipeline/KernelPipeline.ts`
2. `packages/whiteboard-engine/src/kernel/pipeline/routes.ts`
3. `packages/whiteboard-engine/src/kernel/pipeline/types.ts`

`KernelPipeline` 统一暴露：

1. `apply(changeSet, meta?)`
2. `syncGraph(change)`
3. `syncState(keys)`
4. `flush()`

## 4.3 View 层 API 收敛

`view` 对内新增显式入口：

1. `view.syncGraph(change: GraphChange)`
2. `view.syncState(keys: StateKey[])`
3. `view.syncDerived(keys: ViewKey[])`（可选）

`view` 内部可以继续使用 derive/cache，但触发由 pipeline 显式调用。

## 4.4 DerivedRegistry 从“监听驱动”到“失效驱动”

把 `createDerivedRegistry` 的核心从 `watchDependency` 转为：

1. `invalidateByDependency(depKey)`
2. `invalidateMany(depKeys)`
3. `read/watch` 保持不变

依赖关系仍由 `deps` 描述，但失效动作由 pipeline 明确触发。

---

## 5. 文件与命名规范（简短可理解）

目录与命名采用“空间 + 职责”：

1. `kernel/pipeline/KernelPipeline.ts`（class，PascalCase）
2. `kernel/pipeline/routes.ts`（映射表，camelCase 文件名）
3. `kernel/view/ViewSync.ts`（可选，集中 view sync）
4. `kernel/view/registry.ts`（只保留 create）

命名规则：

1. 避免重复前后缀：`syncGraph`，不用 `syncGraphChangeEvent`.
2. 父目录已表达语义时，子文件名用短词：`routes.ts`、`types.ts`。
3. class 默认 PascalCase，函数默认 camelCase。

---

## 6. 迁移方案（功能等价）

## Phase 0：基线冻结

1. 固定 lint/bench 基线（drag-frame、node-hint）。
2. 记录关键行为回归清单（selection、edge connect、group autofit、mindmap drag）。

## Phase 1：引入 Pipeline（旁路接入）

1. 新建 `KernelPipeline`，先只包裹现有调用，不改行为。
2. `registry` 改为创建 pipeline，再由 pipeline 启动旧 bindings。

目标：只改结构，不改触发语义。

## Phase 2：Graph/State 显式下发

1. 把 `bindings.ts` 中 `graph.watch -> node/edge` 转为 `pipeline.syncGraph(change)`。
2. 把 `state.watch -> node/tool/viewport` 转为 `pipeline.syncState(keys)`。

目标：把“转发监听”收敛到 pipeline 单点。

## Phase 3：Derived 失效 API 化

1. `createDerivedRegistry` 增加 `invalidateByDependency/invalidateMany`。
2. pipeline 根据 `affected` 显式失效 view keys。
3. 逐步移除 `watchDependency` 注册路径。

目标：derived 不再主动订阅 state/graph。

## Phase 4：删除旧 bindings/wiring

1. 精简 `view/bindings.ts`（最终可删除）。
2. `view/registry.ts` 只剩 create + 导出 API。
3. 内核仅剩 pipeline 一处编排入口。

---

## 7. API 草案（最终）

```ts
type Affected = {
  graph?: GraphChange
  stateKeys?: StateKey[]
  viewDeps?: ViewDependencyKey[]
}

class KernelPipeline {
  apply(changeSet: ChangeSet, meta?: ApplyMeta): ApplyResult
  syncGraph(change: GraphChange): void
  syncState(keys: StateKey[]): void
  flush(): void
}
```

View 内部：

```ts
type ViewRuntime = {
  syncGraph(change: GraphChange): void
  syncState(keys: StateKey[]): void
  read<K extends ViewKey>(key: K): ViewSnapshot[K]
  watch<K extends ViewKey>(key: K, listener: () => void): Unsubscribe
}
```

---

## 8. 行为等价校验标准

以下必须全部通过才算完成：

1. `commands` 与 `interaction` 对外结果不变。
2. `instance.view` 的 read/watch 结果不变。
3. 历史（undo/redo）语义不变。
4. 高频交互性能不低于当前基线。
5. `registry.ts` 不再出现业务监听编排代码。

---

## 9. 风险与控制

风险：

1. 失效顺序改变导致局部渲染时序差异。
2. 部分模块依赖“监听副作用”的隐式行为。

控制：

1. 每个 phase 保持“只迁移一层触发，不改计算逻辑”。
2. 先接管触发，再删旧监听，避免一次性切换。
3. 每 phase 后跑 lint + bench + 关键交互回归。

---

## 10. 执行顺序建议

1. 先做 `Phase 1-2`，把编排集中到 pipeline 单点。
2. 再做 `Phase 3`，把 derived 改为显式失效 API。
3. 最后做 `Phase 4` 清理旧 bindings。

一句话：先“集中触发”，再“移除监听”，最后“删壳收敛”。

---

## 落地状态

1. 已完成 `Phase 1` 首步：新增 `kernel/pipeline/KernelPipeline.ts`，并在 `view/registry` 使用 pipeline 启动同步编排。
2. 已删除旧 `view/bindings.ts`，避免双入口。
3. 已把 `query` 的 graph 同步并入 pipeline 注入：`query/projector` 不再自行注册 `graph.watch`。
4. 已引入 `state.watchChanges`，把 `selection/groupHovered/tool/viewport` 同步收敛为单状态变更通道。
5. 已为 `DerivedRegistry` 提供显式 `invalidateDependency/invalidateDependencies`，并由 `KernelPipeline` 直接喂 `state/graph` 依赖变化。
6. `view/registry` 已移除 `watchDependency` wiring。
7. `graph.watch` 与 `graph.setChangeHandler` 已移除，改为 `graph.flush(...) -> graphChange` 后由调用方显式 `syncGraph(graphChange)`。
8. `state` 已从 `watchWrites + watch(viewport)` 收敛为单 `watchChanges` 通道，pipeline 只保留一个 state 变更入口。
9. `pipeline` 已移除对 `derived.watch('edge.paths'|'mindmap.trees')` 的依赖，改为按 `graph/state` 依赖显式触发 `syncDerived`。
10. `change pipeline` 与 `transient nodeOverrides` 已接入显式 `syncGraph`，运行态与文档态都走同一显式同步入口。
11. `nodeRegistry` 已将 `syncSelectionState/syncGroupHoveredState/syncToolState/syncViewportState` 收敛为单 `syncState(key)`，`KernelPipeline` 同步改为单调用入口。
