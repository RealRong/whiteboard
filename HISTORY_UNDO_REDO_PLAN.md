# Whiteboard History（Undo/Redo）方案（Immer Patch First）

> 目标：基于 `immer` 的 `patches / inversePatches` 实现可逆历史，兼容当前 `instance-centric` 架构，并让 UI 可实时感知 `canUndo / canRedo`。

## 1. 目标

- 支持 `undo` / `redo`。
- UI 通过 `useWhiteboardSelector('history')` 直接读取状态。
- 历史写入口统一在 `instance.commands.history.*`。
- 保持后续可扩展（协同、压缩、分支历史）。

---

## 2. 关键结论

你说得对：**Immer 原生支持 inverse patches**。

核心 API：
- `produceWithPatches(base, recipe)` -> `[next, patches, inversePatches]`
- `applyPatches(state, patches)`

因此历史首版应优先采用 **Patch-First**，不走 snapshot-first。

---

## 3. 当前真实情况（改造前）

当前 `@whiteboard/core` 已有：
- `core.changes.onAfter` / `transactionStart` / `transactionEnd`
- `core.dispatch(...)`
- `core.model.*`

并且 `dispatch` 与 `model.*` 最终都会收敛到 `applyOperations -> applyDocument`（写入口几乎单点）。

但目前问题是：
- 这条链路只产出 `ChangeSet.operations`，**不产出 Immer patches/inversePatches**。
- `@whiteboard/react` 侧 `onDocChange` 目前是 `produce`，不是 `produceWithPatches`。
- 所以现在无法直接构建稳定的 patch 历史栈。

结论：**做 history 前，需要先补一个“Patch 单点收口层”**。

---

## 4. 先决步骤：Patch 单点收口（先做这个）

## 4.1 目标

在不改变业务行为的前提下，让所有文档写入都经过同一个 patch 管道，统一拿到：
- `patches`
- `inversePatches`
- `origin`（user/system/remote）
- `transaction` 边界信息

## 4.2 收口位置

优先在 `Whiteboard` 传给 `createCore({ apply })` 的 `apply(recipe)` 这一层实现统一包装：

- 外层使用 `produceWithPatches(prevDoc, recipe)`
- 得到 `nextDoc + patches + inversePatches`
- 再执行 `setDoc(nextDoc)`（替代当前仅 `produce`）
- 同步把 patch 信息投递给 HistoryRuntime（或暂存缓冲器）

这样可以覆盖：
- `core.dispatch(...)` 触发的写入
- `core.model.*` 触发的写入

## 4.3 事务聚合策略（先设计好）

依赖现有 `core.changes.transactionStart / transactionEnd`：

- `transactionStart`：开启 `txPatchBuffer`
- 每次 `apply(recipe)` 产生 patch 时：
  - 在事务内 -> 追加到 `txPatchBuffer`
  - 非事务 -> 直接形成一条历史 entry
- `transactionEnd`：把 `txPatchBuffer` 聚合为一条 entry

聚合规则：
- `forward = concat(all patches)`
- `backward = concat(all inversePatches in reverse order)`

## 4.4 过滤规则（先在收口层定死）

- `patches.length === 0`：丢弃
- 正在执行 `undo/redo`（`isApplying === true`）：不回录
- 可配置是否记录 `origin === 'remote'`

## 4.5 验收标准（先决步骤完成标准）

- 任意 `dispatch/model` 写入都能拿到 patch/inversePatch。
- transaction 内多次写入可聚合成单条 patch entry。
- 不开启 history UI 时也不影响现有编辑行为。

---

## 5. 总体设计（state/runtime/commands 收口）

## 5.1 State 新增 `history`

```ts
type HistoryState = {
  canUndo: boolean
  canRedo: boolean
  undoDepth: number
  redoDepth: number
  isApplying: boolean
  lastUpdatedAt?: number
}
```

加入：
- `WHITEBOARD_STATE_KEYS`
- `WhiteboardStateSnapshot`
- 对应 atom（建议 `historyAtom`）

UI 统一读取：

```ts
const { canUndo, canRedo } = useWhiteboardSelector('history')
```

## 5.2 Runtime 新增历史控制器

建议新增 `HistoryRuntime`（放 `common/instance/runtime/`）：

```ts
type HistoryEntry = {
  forward: Patch[]
  backward: Patch[]
  timestamp: number
  origin?: 'user' | 'system' | 'remote'
  source: 'single' | 'transaction'
}

type HistoryRuntime = {
  push(entry: HistoryEntry): void
  undo(): boolean
  redo(): boolean
  clear(): void
  canUndo(): boolean
  canRedo(): boolean
  depth(): { undo: number; redo: number }
  setApplying(flag: boolean): void
  isApplying(): boolean
}
```

## 5.3 Commands

新增：

```ts
instance.commands.history.undo(): boolean
instance.commands.history.redo(): boolean
instance.commands.history.clear(): void
```

快捷键、按钮都调这组命令。

---

## 6. undo / redo 执行流程

## 6.1 undo

1. 若无 undo 栈 -> `false`
2. `isApplying = true`
3. 取出顶部 entry
4. `setDoc(prev => applyPatches(prev, entry.backward))`
5. entry 推入 redo 栈
6. `isApplying = false`
7. 刷新 `historyAtom`

## 6.2 redo

同理执行 `entry.forward`。

---

## 7. 与 UI/快捷键对接

- UI：`useWhiteboardSelector('history')`
- Shortcut：保留现有 `history.undo` / `history.redo`，绑定到 `instance.commands.history`。
- Toolbar：
  - Undo 按钮禁用条件 `!canUndo`
  - Redo 按钮禁用条件 `!canRedo`

---

## 8. 配置建议

在 `WhiteboardConfig` 增加：

```ts
history?: {
  enabled?: boolean           // default true
  capacity?: number           // default 100
  captureSystem?: boolean     // default true
  captureRemote?: boolean     // default false
}
```

建议首版：
- `enabled: true`
- `capacity: 100`
- `captureSystem: true`（兼容当前 model.updateMany 链路）

---

## 9. 边界与一致性

- 新文档切换（`doc.id` 变化）-> `history.clear()`
- `undo/redo` 前后执行 `commands.transient.reset()`，避免临时态污染
- 回放后若选中对象不存在，自动清空 selection / edgeSelection
- 容量溢出时丢弃最旧 entry

---

## 10. 分阶段落地

### Phase 0（必须先做）Patch 单点收口
- 在 `apply(recipe)` 接入 `produceWithPatches`
- 打通 transaction 聚合缓冲
- 建立 patch 事件/回调通道（内部）

### Phase 1（可用版）
- 新增 `historyAtom` + `history` state key
- 实现 `HistoryRuntime`（undo/redo 栈）
- 增加 `commands.history.*`
- 快捷键与按钮读写打通

### Phase 2（体验增强）
- patch 压缩（同路径连续更新合并）
- 增加调试信息（最近 N 条历史 meta）

### Phase 3（高级能力）
- 协同模式下 remote 变更策略
- 可选分支历史

---

## 11. 验收标准

- 节点拖拽后：`canUndo = true`
- 连续 undo 到边界：按钮自动禁用
- redo 可恢复到 undo 前状态
- duplicate/group 等事务命令：一次 undo 回滚整个动作
- 不出现 undo 后 transient 残留或 selection 脏状态

---

## 12. 对外 API（首版）

- `instance.commands.history.undo(): boolean`
- `instance.commands.history.redo(): boolean`
- `instance.commands.history.clear(): void`
- `useWhiteboardSelector('history') => { canUndo, canRedo, undoDepth, redoDepth, isApplying }`

这套 API 与实现解耦：将来从 patch 实现切到更高级实现，UI 无需改动。

