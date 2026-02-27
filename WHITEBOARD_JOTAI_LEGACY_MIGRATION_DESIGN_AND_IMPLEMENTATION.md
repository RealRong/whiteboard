# WHITEBOARD Jotai 历史遗留清理：设计与实施文档

更新时间：2026-02-27  
基准原则文档：`JOTAI_REACTIVE_ARCHITECTURE.md`  
管线对齐文档：`WHITEBOARD_OPERATION_MM_QUERY_INDEX_OPTIMAL_ARCHITECTURE.md`  
策略：一步到位，不保兼容（No-Compatibility, One-Shot）

实施状态（2026-02-27）：
- 已完成：任务 S（统一 store 挂载到 `instance.runtime.store`）
- 已完成：任务 A（移除 `State.watch/watchChanges/batchFrame`）
- 已完成：任务 B（`StateWatchEmitter` -> `AtomWatchEmitter`，统一 `store.sub(atom)`）
- 已完成：任务 C（`useWhiteboardSelector` 切换到 atom 图）
- 已完成：任务 D（transient interaction store 实例隔离，移除 React 侧模块级 `createStore`）
- 已完成：任务 E（`GroupAutoFitActor` 改为 projection commit 数据订阅，不再依赖 `doc.changed`）
- 已完成：任务 F（MM/QI 管线收敛与顺序显式化）
- 已完成：任务 G（viewport 单真值收敛到 `stateAtoms.viewport`，移除 runtime 双状态桥）
- 已完成：任务 H（移除 `ProjectionStore` 与 `instance.projection`，切换为 `documentAtom + mutationMetaBus + derived projection atoms` 单管线）

补充说明（覆盖旧表述）：

1. 运行时不再存在 `projection.commit` 事件桥。
2. `QueryIndexRuntime` 与 `ReadRuntime` 已统一为 `applyMutation(meta)`。
3. `types/readSnapshot.ts` 已收敛为读侧 `ReadModelSnapshot` 结构类型，不再暴露 `ProjectionStore/ProjectionCommit` 契约。

---

## 1. 目标与边界

### 1.1 目标

基于 `JOTAI_REACTIVE_ARCHITECTURE.md`，把当前仍存在的“历史命令式中间层”进一步收敛为单一响应式链路：

- 写入：`commands -> operations -> mutation -> document/projection`
- 读取：`projection/state root atoms -> derived atoms -> React/engine consumers`
- 订阅：统一基于 Jotai store（`store.sub(atom)` / `useAtomValue`）

### 1.2 本文聚焦

本文只覆盖“可迁移到 Jotai 响应式模型”的历史遗留，不讨论以下内容：

- DOM 事件绑定生命周期（仍在 lifecycle/service 层）
- 调度器/任务队列（`Scheduler` / `TaskQueue`）
- 算法本体（edge path、mindmap layout、hit test）

### 1.3 Store 挂载决策（本次强制）

本方案明确采用：

- 统一 Store 入口：`instance.runtime.store`
- `instance.read.store` 与其保持同引用（迁移过渡期允许别名）
- 不再使用模块级 singleton store 承载实例相关状态

说明：

1. `instance.store` 与 `instance.runtime.store` 均可实现目标；本方案选 `instance.runtime.store`，以符合 `state/runtime/query/commands` 的分域规则。
2. 本次为 one-shot，不保兼容；可以直接把“读侧/交互侧”都收敛到该入口。

---

## 2. 现状审计（按优先级）

## 2.0 P0：Store 入口仍分散，未显式挂载到 instance

现状：

- engine 内已有 `instance.read.store`，但不是全系统唯一“公开锚点”。
- React 交互层存在多处模块级 `createStore()`（独立于引擎实例）。

问题：

- 单实例语义不清：调用方不知道该依赖哪个 store 入口。
- 多实例并发时，模块单例 store 天然有串扰风险。

结论：

- 必须将 store 创建与挂载前置到 `createEngine`，并统一到 `instance.runtime.store`。

## 2.1 P0：`State.watch` 第二套订阅系统（与 Jotai 并存）

现状：

- `createState` 内维护了自定义监听器、批处理和帧合并：
  - `keyListeners/changeListeners`
  - `pendingKeys`
  - `batchFrame + requestAnimationFrame flush`
- 文件：`packages/whiteboard-engine/src/state/factory/CreateState.ts`
- `state.watch` 实际消费点：
  - `StateWatchEmitter`：`packages/whiteboard-engine/src/runtime/actors/shared/StateWatchEmitter.ts`
  - `useWhiteboardSelector`：`packages/whiteboard-react/src/common/hooks/useWhiteboardSelector.ts`

问题：

- 同一份状态存在两种订阅机制（Jotai atom + 手写 watch）。
- 多余复杂度集中在 `CreateState`，维护成本高。
- 与“统一响应式源”原则冲突。

---

## 2.2 P0：React 侧 transient store 为模块级单例（跨实例共享风险）

现状（均为模块级 `createStore()`）：

- `sessionLockState`
- `selectionBoxState`
- `viewportGestureState`
- `edgeConnectPreviewStore`
- `edgeRoutingPreviewStore`
- `nodeInteractionPreviewState`

对应文件（示例）：

- `packages/whiteboard-react/src/common/interaction/sessionLockState.ts`
- `packages/whiteboard-react/src/common/interaction/viewportGestureState.ts`
- `packages/whiteboard-react/src/node/interaction/nodeInteractionPreviewState.ts`

问题：

- 如果同页面挂载多个 Whiteboard 实例，交互状态会互相污染（锁、预览、草图共享）。
- 这属于典型历史遗留单例模式，不符合实例隔离。

---

## 2.3 P1：`StateWatchEmitter` 仍通过 state.watch 监听状态事件

现状：

- `StateWatchEmitter` 是通用状态事件桥（selection/tool/viewport/mindmap layout）。
- 依赖 `state.watch`，再做 snapshot equals/clone 去重。

问题：

- 逻辑价值存在（事件投递），但数据源绑定方式不现代。
- 可直接改为 atom 订阅，不必依赖手写 watch 总线。

---

## 2.4 P1：`useWhiteboardSelector` 仍走 state.watch + 手工 snapshot 拼接

现状：

- Hook 内通过 `instance.state.watch(keys)` 触发重算。
- 再手动 `readSnapshotByKeys` + `selector`。
- 文件：`packages/whiteboard-react/src/common/hooks/useWhiteboardSelector.ts`

问题：

- 绕开了 `instance.read.store` 已有 atom 图。
- 与 `useReadAtom` 并存两套读模型。

---

## 2.5 P2：内部行为驱动仍依赖 `doc.changed` EventCenter（可进一步数据驱动）

现状：

- `DocChangePublisher` 生成 `operationTypes` 并 `emit('doc.changed')`。
- `GroupAutoFitActor` 通过 `instance.events.on('doc.changed')` 触发同步。

问题：

- 对内部行为而言，这是“事件总线驱动”，而非“数据源驱动”。
- 可改为订阅 mutation/projection 的结构化元信息（atom 或 commit stream）。

---

## 3. 迁移原则（落地化）

从 `JOTAI_REACTIVE_ARCHITECTURE.md` 抽象为可执行规则：

1. 只保留一套响应式订阅源：Jotai store。
2. Root Atom 只承载权威状态：`projectionSnapshot`、必要 state root。
3. 派生状态全部通过 atom 计算，不手写 if-else 调度链。
4. “事件”只用于外部 API 边界；内部流程优先“数据订阅”。
5. 按职责聚合 atom，不做过度细粒度碎片化。
6. 所有临时交互态必须实例隔离，禁止模块单例跨实例共享。
7. Store 必须直接挂载在 instance（本方案采用 `instance.runtime.store`）。

---

## 4. 目标架构（迁移后）

```text
Write Path:
commands -> mutate -> document/projection commit

Read Path:
projection/state root atoms -> derived atoms -> read getters / React hooks

Subscription:
store.sub(atom) / useAtomValue(atom)（由根层 `JotaiProvider` 注入 store）

Internal side effects:
由 atom 订阅触发（selection/tool/viewport/mindmap layout/group autofit）

External events (可选):
仅保留对外契约需要的 InstanceEvents

Store Anchor:
instance.runtime.store（instance.read.store 与其同引用）
```

---

## 5. 详细实施方案（一步到位）

## 5.0 任务 S：统一 Store 挂载与引用

### S1. 类型调整

文件：`packages/whiteboard-engine/src/types/instance/instance.ts`

- 为 `Instance` 增加 `runtime.store`（`ReturnType<typeof createStore>`）。
- `read.store` 改为与 `runtime.store` 同引用。

### S2. 创建与挂载

文件：`packages/whiteboard-engine/src/instance/create.ts`

- 在实例创建阶段只创建一次 store。
- 在 instance 上直接挂载：`instance.runtime.store = store`。
- `createState/createReadRuntime` 均接收该同一 store，不再内部隐式创建第二份。

### S3. 验收

- 全仓不存在“实例相关但不经 instance 获取”的 store 创建点（测试例外）。

## 5.1 任务 A：移除 `State.watch/watchChanges/batchFrame` 机制

### A1. 类型收敛

文件：`packages/whiteboard-engine/src/types/instance/state.ts`

- 删除：
  - `watchChanges`
  - `watch`
  - `batchFrame`
- `State` 仅保留：
  - `read`
  - `write`
  - `batch`（可保留为轻量事务包装）

### A2. `CreateState` 收敛

文件：`packages/whiteboard-engine/src/state/factory/CreateState.ts`

- 删除内部：
  - `keyListeners/changeListeners`
  - `pendingKeys/frameFlush/scheduleFrameFlush`
  - `watchKey/watchChanges/batchFrame`
- `syncViewport` 已移除：`viewport` 初始化直接来自 `document.viewport`。
- `ViewportRuntime` 改为通过 `store.get/set(stateAtoms.viewport)` 读写，不再维护独立 viewport 内存副本。
- `batch` 简化为同步 action 包装（必要时保留深度计数，但不再承担通知聚合）。

### A3. 直接依赖 atom map

- 明确维护：
  - `stateAtoms`（含 `interaction/tool/selection/mindmapLayout/viewport`）
  - `stateAtomByKey`（按 `StateKey` 映射）
- 后续所有订阅改用 `stateStore.sub(stateAtomByKey[key], listener)`。

---

## 5.2 任务 B：`StateWatchEmitter` 改为 Atom 订阅版

### B1. 新增 `AtomWatchEmitter`

建议新增文件：

- `packages/whiteboard-engine/src/runtime/actors/shared/AtomWatchEmitter.ts`

核心能力：

- 输入：`store + atom + read + equals + clone + emit`
- 行为：`store.sub(atom, ...)` + `SnapshotState` 去重
- 输出：`start/stop`

### B2. 替换使用点

- `runtime/actors/tool/Actor.ts`
- `runtime/actors/viewport/Actor.ts`
- `domains/selection/commands.ts`（selection changed / edge selection changed）
- `domains/mindmap/commands.ts`（mindmap layout changed）

### B3. 结果

- engine 内部不再依赖 `state.watch`。
- `StateWatchEmitter` 已删除，统一为 `AtomWatchEmitter`（`WatchGroup` 作为通用订阅生命周期工具保留）。

---

## 5.3 任务 C：`useWhiteboardSelector` 全面切到 atom 图

### C1. 扩充 read atoms（语义入口）

文件：`packages/whiteboard-engine/src/runtime/read/Runtime.ts`

在 `read.atoms` 中补齐基础状态原子（聚合，不碎片化）：

- `tool`
- `selection`
- `viewport`
- `mindmapLayout`
- `interaction`（如需要）

建议规则：

- 这些 atom 直接复用 `stateAtoms`，不复制一份状态。

### C2. 改造 Hook 实现

文件：`packages/whiteboard-react/src/common/hooks/useWhiteboardSelector.ts`

- 单 key：直接 `useAtomValue(instance.read.atoms.<key>)`（由根层 `JotaiProvider` 注入 store）
- selector + keys：内部用 `selectAtom` 基于“组合基 atom”派生，再 `useAtomValue`
- 删除对 `instance.state.watch` 的依赖。

### C3. 结果

- React 层统一走 Jotai 订阅，不再有第二条 selector 通道。

---

## 5.4 任务 D：所有 transient interaction store 改为“挂载 store 作用域”

### D1. 问题必须一次性解决

当前模块级单例 store 会导致多实例污染，必须一步到位改掉。

### D2. 建议实现：直接使用 `instance.runtime.store`

迁移方式：

1. 交互态改为 atom 定义（可按模块拆文件）。
2. 读写统一使用 `instance.runtime.store.get/set/sub`。
3. hooks/components 通过 `useInstance()` 获取 instance 后访问 store。

优点：

- 在 `Whiteboard` 根层仅注入一次 `JotaiProvider store={instance.runtime.store}`，子树不再手传 store。
- 不再存在模块级 singleton 引起的跨实例污染。
- engine/read/react 三方共享同一 store 锚点，订阅模型一致。

### D3. 迁移文件清单

- `common/interaction/sessionLockState.ts`
- `common/interaction/selectionBoxState.ts`
- `common/interaction/viewportGestureState.ts`
- `edge/interaction/connectPreviewState.ts`
- `edge/interaction/routingPreviewState.ts`
- `node/interaction/nodeInteractionPreviewState.ts`

### D4. 调用侧改造

- 相关 hooks/components 改为通过 `useInstance()` + `instance.runtime.store` 读写。
- 禁止再从模块级 singleton 直接读写。

---

## 5.5 任务 E：内部 `doc.changed` 事件改为数据驱动订阅

### E1. 目标

`GroupAutoFitActor` 等内部逻辑不再依赖 EventCenter 字符串事件。

### E2. 实现路径（推荐）

- 引入 `mutationMetaAtom`（或 `lastCommitAtom`）：
  - 内容：`revision/kind/impact/operationTypes`（按需要）
- `GroupAutoFitActor` 订阅该 atom 或直接订阅 mutation meta 结构化数据。

### E3. 事件边界

- `InstanceEvents` 保留给外部集成用途。
- 引擎内部行为调度不再依赖 `instance.events.on('doc.changed')`。

---

## 5.6 任务 F：补齐 Materialized Model / Query Index 管线一致性

该任务基于 `WHITEBOARD_OPERATION_MM_QUERY_INDEX_OPTIMAL_ARCHITECTURE.md` 与当前实现对齐，重点是“规则显式化”。

### F1. Query Index（当前实现映射）

现有实现：

- `runtime/read/api/Runtime.ts`：`mutationMetaBus.subscribe -> queryIndex.applyMutation`
- `runtime/read/indexes/QueryIndexRuntime.ts`：增量/全量策略
- `runtime/read/indexes/QueryIndexes.ts`：NodeRectIndex + SnapIndex 具体索引

需在文档与代码中固定的策略：

1. `replace/full`：全量 `sync`。
2. `order && !edges`：全量 `sync`。
3. `dirtyNodeIds`：`syncByNodeIds`。
4. `geometry/mindmap`：兜底全量 `sync`。

### F2. Materialized Model（当前实现映射）

现有实现：

- `runtime/read/Runtime.ts`：维护 `readModelSnapshotAtom + materializedRevisionAtom`
- `runtime/read/materialized/MaterializedModel.ts`：`nodeIds/edgePath/mindmap` 物化
- `runtime/read/materialized/edgePath/*`：invalidaton + cache/index

需在文档与代码中固定的策略：

1. mutation meta 到来时先 `materialized.applyMutation(meta)`，再按需发布 revision。
2. `materializedRevisionAtom` 仅在必要影响域（`full/edges/mindmap/geometry/dirty*`）递增。
3. 可变缓存（Map/Index）必须通过 revision atom 暴露可观察性。

### F3. 订阅顺序与一致性

已收敛为单一“read pipeline dispatcher”（`createEngine` 内统一订阅 mutation meta），顺序固定为：

1. `queryIndex.applyMutation(meta)`
2. `materialized.applyMutation(meta)`
3. `readModelSnapshotAtom` 由 `documentAtom + readModelRevisionAtom` 自动派生
4. 按需 bump revision atoms

结果：

- 避免多订阅者顺序不透明导致的边界不一致。
- 保证同一 commit 下 query/getter/react 观察结果一致。

---

## 6. 破坏性变更清单（明确不保兼容）

以下 API/行为按 one-shot 直接替换：

1. 删除 `State.watchChanges`。
2. 删除 `State.watch`。
3. 删除 `State.batchFrame`。
4. 引擎统一 Store 锚点改为 `instance.runtime.store`（`instance.read.store` 仅保留同引用别名，后续可移除）。
5. `useWhiteboardSelector` 内部实现切换到 atom 图（语义不变，触发机制变化）。
6. 所有 interaction preview/lock store 从模块级单例改为 `instance.runtime.store` 作用域。
7. 内部 actor 不再依赖 `doc.changed` 事件进行调度。
8. 移除 `InstanceEvents['doc.changed']` 与 `DocChangePublisher`（无兼容保留）。

---

## 7. 目录与命名建议（迁移后）

建议新增目录：

- `packages/whiteboard-engine/src/runtime/read/state/`  
  目的：集中 state 相关 read atoms（若不想混在 `read/Runtime.ts`）
- `packages/whiteboard-react/src/common/interaction/atoms/`  
  目的：统一管理挂载到 `instance.runtime.store` 的 transient atoms

命名规则：

- `xxxAtom` / `xxxDerivedAtom`
- `useXxxState(instance.runtime.store)`
- 禁止新的模块级 singleton `xxxStore`

---

## 8. 实施顺序（建议执行计划）

## 阶段 0：防回归准备

1. 增补基准用例（至少脚本化）：
   - 单实例交互正常
   - 双实例同时交互不串扰
2. 基准命令：
   - `pnpm --filter @whiteboard/engine lint`
   - `pnpm --filter @whiteboard/react lint`
   - `pnpm -r build`
   - `pnpm --filter @whiteboard/engine run bench:check`

## 阶段 1：引擎侧订阅统一

1. 完成任务 S。
2. 完成任务 A/B。
3. 删除 `StateWatchEmitter` 及关联冗余工具。
4. 回归 lint/build/bench。

## 阶段 2：React selector 统一

1. 完成任务 C。
2. 将 `useWhiteboardSelector` 全量迁移到 `instance.runtime.store`。
3. 回归 lint/build。

## 阶段 3：transient store 实例化

1. 完成任务 D（高风险，改动面广）。
2. 强制验证双实例并发交互场景。
3. 回归 lint/build + 关键交互手测。

## 阶段 4：内部事件去总线化

1. 完成任务 E。
2. 完成任务 F（MM/QI 管线顺序与策略固化）。
3. 校验 group autofit、history、doc reset 行为。
4. 回归完整链路。

---

## 9. 验收标准

### 9.1 架构标准

1. 引擎内部不存在 `state.watch`/`watchChanges` 调用。
2. `CreateState` 不再有自定义监听队列与帧 flush 逻辑。
3. `instance.runtime.store` 是唯一 Store 锚点（`instance.read.store` 同引用）。
4. React 层 selector 统一基于 atom/store。
5. interaction transient store 全部使用 `instance.runtime.store`，无模块级共享写态。
6. 内部行为调度不再依赖 `doc.changed` 字符串事件总线。

### 9.2 功能标准

1. 单实例交互功能无回归：拖拽、缩放、选框、连线、改线、脑图拖拽。
2. 双实例并行交互无串扰（锁、预览、选择态）。
3. 生命周期 start/update/stop 正常，资源无泄漏。

### 9.3 性能标准

1. `bench:check` 全通过。
2. 高频交互路径无额外全局重渲染热点。
3. 不引入多余对象分配（尤其 pointermove 链路）。

---

## 10. 关键实现草图（伪代码）

### 10.1 以 atom sub 实现状态事件桥

```ts
type AtomWatchOptions<T> = {
  store: ReturnType<typeof createStore>
  atom: Atom<unknown>
  read: () => T
  equals: (a: T, b: T) => boolean
  clone?: (v: T) => T
  emit: (v: T) => void
}
```

```ts
const unsub = store.sub(atom, () => {
  const next = read()
  if (!snapshot.update(next)) return
  emit(next)
})
```

### 10.2 挂载到 instance 的统一 store

```ts
const runtimeStore = createStore()
instance.runtime = {
  ...instance.runtime,
  store: runtimeStore
}
instance.read.store = runtimeStore
```

```ts
const setViewportGesturePreview = (instance: Instance, next: Viewport) => {
  instance.runtime.store.set(viewportGestureAtom, next)
}
```

### 10.3 `useWhiteboardSelector` 的 atom 化

```ts
const baseAtom = atom((get) => ({
  selection: get(read.atoms.selection),
  viewport: get(read.atoms.viewport)
}))

const selectedAtom = selectAtom(baseAtom, selector, equality)
const value = useAtomValue(selectedAtom)
```

---

## 11. 结论

当前架构已经完成 read/runtime/query 的主干收敛，并已完成 transient store 的实例隔离；剩余主要是 watch 总线、内部事件桥和 MM/QI 订阅顺序治理。  

按本文 one-shot 方案执行后，可得到：

1. 单一响应式链路（更清晰、更可维护）。
2. 统一 Store 锚点（`instance.runtime.store`）与实例级状态隔离。
3. MM/QI 管线顺序显式化，读侧一致性更强。
4. 更少中间层和手写调度代码（降低复杂度与耦合）。
