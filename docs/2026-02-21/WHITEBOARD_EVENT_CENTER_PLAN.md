# Whiteboard Engine 事件中心方案

## 1. 结论

采用一套架构：

1. Engine 内只有一个事件中心（`events`）。
2. 事件生产由多个职责组件完成（`StateEventSource`、`SelectionEventSource` 等）。
3. 各组件只通过统一 API 与事件中心通信，不互相直接调用。

这套方案比“多个 stateEvents 中心并存”更清晰，也更容易维护。

## 2. 设计目标

1. 对外 API 稳定：外部永远只使用 `instance.events`。
2. 内部职责分离：状态监听、事件计算、事件发布分开。
3. 新手易懂：入口唯一，命名统一，启动顺序固定。
4. 可扩展：后续新增事件源时，不改事件中心。

## 3. API 设计

### 3.1 对外公共 API（保持简洁）

```ts
export type InstanceEvents = {
  on: <K extends keyof InstanceEventMap>(
    type: K,
    listener: (payload: InstanceEventMap[K]) => void
  ) => () => void
  off: <K extends keyof InstanceEventMap>(
    type: K,
    listener: (payload: InstanceEventMap[K]) => void
  ) => void
}
```

可选增强（建议加，但不强制）：

```ts
export type EventCenterMetrics = {
  listenerCount: <K extends keyof InstanceEventMap>(type: K) => number
  hasListener: <K extends keyof InstanceEventMap>(type: K) => boolean
}
```

用途：后续实现按需启停 watcher（无监听者时不订阅 state）。

### 3.2 内部事件中心 API

```ts
export interface EventCenter<M extends Record<string, unknown>> {
  on<K extends keyof M>(type: K, listener: (payload: M[K]) => void): () => void
  off<K extends keyof M>(type: K, listener: (payload: M[K]) => void): void
  emit<K extends keyof M>(type: K, payload: M[K]): void
  clear(): void
}
```

命名建议：

1. 类名：`EventCenter`。
2. 实例字段：`events`。
3. 不再新增第二个 “center/bus/hub” 实例。

### 3.3 事件源 API（职责组件）

```ts
export interface EventSource {
  readonly name: string
  start(): void
  stop(): void
}
```

```ts
export type EventSourceContext = {
  state: State
  emit: <K extends keyof InstanceEventMap>(
    type: K,
    payload: InstanceEventMap[K]
  ) => void
}
```

约束：

1. `EventSource` 只负责“读状态 -> 判断变化 -> emit”。
2. `EventSource` 不直接调用 commands，不做副作用。
3. 事件去重逻辑在 source 内部完成。

### 3.4 事件运行时（统一注册与生命周期）

```ts
export interface EventRuntime {
  register(source: EventSource): void
  start(): void
  stop(): void
}
```

建议实现为类：`EventRuntime`。

职责：

1. 持有 `EventSource[]`。
2. 在 `Lifecycle.start()` 时统一 `start()`。
3. 在 `Lifecycle.stop()` 时统一 `stop()`。

## 4. 事件命名规范

统一规则：`<domain>.<verb-past>`。

保留并规范以下事件：

1. `change.applied`
2. `doc.changed`
3. `selection.changed`
4. `edge.selection.changed`
5. `tool.changed`
6. `viewport.changed`
7. `history.changed`
8. `mindmap.layout.changed`

命名约束：

1. `domain` 使用业务词，不带实现词（不用 `watcher/state` 这类词）。
2. `verb` 使用过去式（`changed/applied`）。
3. payload 使用业务字段名，不使用 `data/payload` 这类泛名。

## 5. 文件与类命名规范

按你的约束，类文件统一 PascalCase，且目录内避免重复前后缀。

建议目录：

1. `packages/whiteboard-engine/src/kernel/events/EventCenter.ts`
2. `packages/whiteboard-engine/src/runtime/events/EventRuntime.ts`
3. `packages/whiteboard-engine/src/runtime/events/sources/StateEventSource.ts`
4. `packages/whiteboard-engine/src/runtime/events/sources/SelectionEventSource.ts`
5. `packages/whiteboard-engine/src/runtime/events/sources/WatcherLifecycle.ts`

命名建议：

1. 旧 `stateEvents.ts` -> `StateEventSource.ts`
2. 旧 `selectionEvents.ts` -> `SelectionEventSource.ts`
3. 旧 `createWatcherLifecycle` -> `WatcherLifecycle`（类）或 `createWatcherLifecycle`（函数，二选一）

选择原则：

1. 要持有状态与 start/stop 生命周期时，用类。
2. 纯函数工具保持函数命名。

## 6. 推荐拆分粒度

当前阶段建议 2 个 source 即可：

1. `StateEventSource`：`tool/viewport/history/mindmapLayout`。
2. `SelectionEventSource`：`selection/edgeSelection`。

不建议拆成过多 source（如 `ViewportEventSource`、`HistoryEventSource`）直到有明确收益。

判断标准：

1. 同一 source 文件超过 ~200 行且持续增长。
2. 某类事件需要单独启停策略。
3. 某类事件需要完全不同依赖。

## 7. 与现有模块的边界

1. `change/pipeline.ts` 继续负责 `change.applied`、`doc.changed`。
2. `runtime/events/sources/*` 负责 state 派生事件。
3. `Lifecycle` 只做编排，不写事件业务逻辑。
4. `GroupAutoFit` 继续订阅 `change.applied`，不与 source 直接耦合。

## 8. 生命周期流程（新手视角）

1. `createEngine` 创建唯一 `EventCenter`。
2. 创建 `EventRuntime`，注册 `StateEventSource` 与 `SelectionEventSource`。
3. `Lifecycle.start()` 调 `eventRuntime.start()`，source 开始 watch state。
4. state 变化时 source 判断 diff 并 `events.emit(...)`。
5. `Lifecycle.stop()` 调 `eventRuntime.stop()`，释放全部 watch。

## 9. 落地步骤（一步到位）

1. 新建 `runtime/events/` 目录与 `EventRuntime`。
2. 将 `watchers/stateEvents.ts` 重命名并迁移到 `sources/StateEventSource.ts`。
3. 将 `watchers/selectionEvents.ts` 重命名并迁移到 `sources/SelectionEventSource.ts`。
4. `Lifecycle` 改为仅依赖 `EventRuntime`，移除直接持有两个 watcher 字段。
5. 保留 `InstanceEventMap` 不变，确保外部 API 无变更。
6. 运行 lint 与 bench，确认行为无回归。

## 10. 验收标准

1. Engine 内只有一个事件中心实例。
2. `Lifecycle` 不再直接创建 `stateEvents/selectionEvents`。
3. 事件源类职责单一，文件命名 PascalCase。
4. 事件名全部符合 `<domain>.<verb-past>`。
5. 外部订阅 API 保持 `instance.events.on/off`。

## 11. 后续可选优化

1. 按监听数量按需启动 source（提升性能）。
2. 给 `events.emit` 增加调试 trace 钩子（仅开发模式）。
3. 给高频事件加采样/节流策略（仅在必要时）。
