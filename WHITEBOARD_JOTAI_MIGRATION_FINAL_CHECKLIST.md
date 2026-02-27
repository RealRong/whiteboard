# WHITEBOARD Jotai 迁移最终收口清单

更新时间：2026-02-27  
策略：一步到位（No-Compatibility, One-Shot）

---

## 1. 最终目标架构（已落地）

### 1.1 单一 Store 锚点

- 引擎与 React 统一使用 `instance.runtime.store`。
- React 根层统一注入 `JotaiProvider`，子树直接 `useAtomValue(atom)`。

核心落点：

- `packages/whiteboard-engine/src/instance/create.ts`
- `packages/whiteboard-react/src/Whiteboard.tsx`

### 1.2 单一路径（Write / Read / Subscribe）

Write Path：

- `commands -> mutate -> projection commit`

Read Path：

- `projection/state root atoms -> derived atoms -> query/getters/React`

Subscribe Path：

- `store.sub(atom)`（引擎内部）
- `useAtomValue(atom)`（React 消费）

### 1.3 Read Pipeline 顺序显式化

当前在 `createEngine` 中固定为单一 dispatcher：

1. `queryRuntime.applyCommit(commit)`
2. `readRuntime.applyCommit(commit)`（materialized + snapshot/revision atoms）

代码位置：

- `packages/whiteboard-engine/src/instance/create.ts:79`

---

## 2. 已完成清单（Checklist）

- [x] S：Store 挂载到 `instance.runtime.store`（全局唯一锚点）
- [x] A：移除 `State.watch/watchChanges/batchFrame`
- [x] B：`StateWatchEmitter` 替换为 `AtomWatchEmitter`
- [x] C：`useWhiteboardSelector` 切换到 atom 图
- [x] D：React transient interaction 状态实例隔离（移除模块级 `createStore`）
- [x] E：内部行为从 `doc.changed` 事件桥切到数据订阅（GroupAutoFit）
- [x] F：MM/QI commit 管线顺序统一并固定
- [x] G：viewport 单真值收敛（`stateAtoms.viewport`）

---

## 3. 已删除的历史层（确认）

### 3.1 引擎 State 自定义 watch 系统

已删除能力：

- `state.watch`
- `state.watchChanges`
- `state.batchFrame`

相关代码：

- `packages/whiteboard-engine/src/types/instance/state.ts`
- `packages/whiteboard-engine/src/state/factory/CreateState.ts`

### 3.2 旧状态事件桥

已删除：

- `StateWatchEmitter`
- `DocChangePublisher`
- `InstanceEvents['doc.changed']`

相关代码：

- 删除：`packages/whiteboard-engine/src/runtime/actors/shared/StateWatchEmitter.ts`
- 删除：`packages/whiteboard-engine/src/runtime/write/DocChangePublisher.ts`
- 更新：`packages/whiteboard-engine/src/types/instance/events.ts`

### 3.3 React 交互层模块级 singleton store

已完全移除 `createStore()` 的模块级交互单例，统一改为实例作用域 `instance.runtime.store`。

当前交互状态文件（命名已统一为 `*State`）：

- `packages/whiteboard-react/src/common/interaction/sessionLockState.ts`
- `packages/whiteboard-react/src/common/interaction/selectionBoxState.ts`
- `packages/whiteboard-react/src/common/interaction/viewportGestureState.ts`
- `packages/whiteboard-react/src/edge/interaction/connectPreviewState.ts`
- `packages/whiteboard-react/src/edge/interaction/routingPreviewState.ts`
- `packages/whiteboard-react/src/node/interaction/nodeInteractionPreviewState.ts`

---

## 4. 保留层（刻意保留，不是遗留）

### 4.1 `ProjectionStore`

保留原因：

- 作为 mutation 输出的 commit 边界，承载 `snapshot + impact`，是读写边界的稳定契约。

### 4.2 `WatchGroup` / `SnapshotState`

保留原因：

- 这两者作为轻量通用工具仍有价值：
  - `WatchGroup`：管理订阅生命周期
  - `SnapshotState`：变更去重/快照比较

### 4.3 projection 额外订阅者

除 read pipeline dispatcher 外，仍有特定目的订阅者（例如 replace 时清理测量队列），属于业务副作用，不影响 read pipeline 顺序确定性。

### 4.4 viewport 提交后同步

保留原因：

- `document.viewport` 是持久化快照，mutation 成功后需要把文档值同步回 runtime。
- 同步目标是同一个 `viewport` atom（`ViewportRuntime` 已无独立 viewport 内存字段），不再存在 runtime/state 双副本。

---

## 5. 最终命名与目录语义

### 5.1 命名规则（当前状态）

- React transient 状态统一使用 `*State`（不再使用 `*Store` 命名）。
- 引擎读侧语义入口统一在 `instance.read.atoms/*`。

### 5.2 禁止项（执行中）

- 禁止新增模块级 singleton 交互写态。
- 禁止恢复第二条写入或订阅路径（例如重引入 `state.watch`/事件中转桥）。

---

## 6. 验收结果（本次）

已通过：

1. `pnpm --filter @whiteboard/engine lint`
2. `pnpm --filter @whiteboard/react lint`
3. `pnpm -r build`

---

## 7. 当前结论

迁移主目标已经完成：

1. 单一响应式基座（Jotai + 单一 store 锚点）。
2. 读写链路明确且顺序可验证。
3. 历史中间层（watch 系统、`doc.changed` 内部桥、模块单例交互 store）已清除。
4. 目录与命名已完成第一轮收口（React 交互态 `Store -> State`）。
