# Whiteboard Engine 内直调 + 外事件 设计与实施方案

## 1. 最终决策

采用混合模式：

1. 对外：保留 `EventCenter`，作为唯一公共事件出口（`instance.events`）。
2. 对内：不使用全局事件总线串联主业务，改为 `Coordinator` 同步编排直调。
3. Actor：保持领域拆分，但禁止 Actor 之间任意互相直接调用。

一句话：**内部直调优先，外部事件保留，内部事件最小化。**

## 2. 为什么这样最适合当前 engine

1. 当前主链路天然是同步事务式：`apply -> graph -> view`，改成事件驱动会拉长链路并降低可读性。
2. 你希望链条清晰、易追踪，直调可以直接看调用栈，不需要跨订阅跳转。
3. 外部生态仍需要事件订阅，所以公共事件中心不能移除。

## 3. 架构总览

## 3.1 组件

1. `Coordinator`：唯一内部业务编排入口。
2. `Actors`：按领域封装状态、缓存、变更逻辑。
3. `EventCenter`：仅负责公共事件 on/off/emit。

## 3.2 调用规则

1. 业务主链由 `Coordinator` 顺序调用 Actor。
2. Actor 不直接调用其他 Actor。
3. Actor 需要跨领域数据时，只能通过 `query/runtime getter`。
4. 公共事件只能由 `Coordinator` 或对应 Actor 在编排末端发出。

## 4. 详细 API 设计

### 4.1 Coordinator

```ts
export interface Coordinator {
  start(): void
  stop(): void

  applyChange(input: ChangeSetInput, options?: ApplyOptions): Promise<ApplyResult>
  updateLifecycle(config: LifecycleConfig): void

  handleInput(event: InputEvent): InputResult
  resetInput(reason?: CancelReason): InputResult
}
```

职责：

1. 固定主流程顺序。
2. 聚合上下文并调度 Actor。
3. 控制公共事件发射时机与顺序。

### 4.2 Actor 合约

```ts
export type ActorContext = {
  state: State
  graph: GraphProjector
  query: Query
  view: View
  runtime: RuntimeInternal
  commands: Commands
}

export interface Actor {
  readonly name: string
  start(ctx: ActorContext): void
  stop(): void
}
```

说明：

1. Actor 不持有其他 Actor 引用。
2. 跨领域协作由 `Coordinator` 完成。

### 4.3 EventCenter（公共）

```ts
export interface EventCenter<M extends Record<string, unknown>> {
  on<K extends keyof M>(type: K, listener: (payload: M[K]) => void): () => void
  off<K extends keyof M>(type: K, listener: (payload: M[K]) => void): void
  emit<K extends keyof M>(type: K, payload: M[K]): void
  clear(): void
}
```

## 5. Actor 拆分（保持你要的职责闭环）

### 5.1 Document Actor

1. 变更归一化与 reduce。
2. 输出 change summary（返回给 Coordinator）。
3. 不直接发公共事件，由 Coordinator 统一发。

### 5.2 Graph Actor

1. `GraphProjector + GraphCache + Hint`。
2. `syncByOperations + flush`。
3. 返回 `GraphChange` 给 Coordinator。

### 5.3 View Actor

1. 托管 `KernelPipeline`。
2. 接收 `GraphChange` 与状态变化进行同步。

### 5.4 Selection Actor

1. 管理 selection / edgeSelection 状态快照与 diff。
2. 输出事件 payload（不直接 emit）。

### 5.5 Tool Actor

1. 管理 tool 状态与工具切换副作用（如 edge hover cancel）。
2. 输出 `tool.changed` payload。

### 5.6 Viewport Actor

1. 管理 viewport 与输入配置同步。
2. 输出 `viewport.changed` payload。

### 5.7 History Actor

1. 订阅 core history 并写入 state。
2. 处理 doc/core 切换时 clear 策略。
3. 输出 `history.changed` payload。

### 5.8 Edge Actor

1. 统一 `edgeConnect` / `routingDrag` / edge cache 协作。
2. 处理 edge 领域状态变更与对外 payload。

### 5.9 Node Actor

1. 统一 `nodeDrag` / `nodeTransform` / `nodeOverrides` / `dragGuides`。
2. 处理 node 领域缓存与变更输出。

### 5.10 Mindmap Actor

1. 管理 `mindmapLayout` / `mindmapDrag`。
2. 输出 `mindmap.layout.changed` payload。

### 5.11 Input Actor

1. 托管 `InputController` 与 sessions。
2. 返回 `InputResult` 给 Coordinator。

## 6. 内部“直调”主链（核心）

`Coordinator.applyChange(...)` 固定顺序：

1. `DocumentActor.apply(...)` -> `ApplyResult`
2. `GraphActor.syncByOperations(...)` -> `GraphChange?`
3. `ViewActor.syncGraph(change)`（有 change 时）
4. `Selection/Tool/Viewport/History/Mindmap Actor` 做状态快照对比，产出事件 payload
5. `Coordinator` 统一 `EventCenter.emit(...)`

这样可以保证：

1. 一次事务只走一条主链。
2. 事件在稳定状态后发出。
3. 调试时直接沿调用栈追踪。

## 7. 内部事件的使用边界（严格收口）

允许内部事件的场景（少量）：

1. debug/trace
2. telemetry
3. devtools 插件扩展点

禁止内部事件的场景：

1. 业务主链路（doc/graph/view/selection/edge/node）
2. Actor 之间的核心协作

结论：内部事件不是主干，只是旁路扩展点。

## 8. 对外事件设计

保留现有公共事件：

1. `change.applied`
2. `doc.changed`
3. `selection.changed`
4. `edge.selection.changed`
5. `tool.changed`
6. `viewport.changed`
7. `history.changed`
8. `mindmap.layout.changed`

可选新增（后续）：

1. `graph.changed`
2. `node.changed`
3. `edge.changed`

命名规则：`<domain>.<verb-past>`。

## 9. 命名与目录规范

文件 PascalCase；同目录避免重复前后缀。

1. `packages/whiteboard-engine/src/runtime/coordinator/Coordinator.ts`
2. `packages/whiteboard-engine/src/runtime/coordinator/contracts.ts`
3. `packages/whiteboard-engine/src/runtime/events/EventCenter.ts`
4. `packages/whiteboard-engine/src/runtime/actors/document/Actor.ts`
5. `packages/whiteboard-engine/src/runtime/actors/graph/Actor.ts`
6. `packages/whiteboard-engine/src/runtime/actors/view/Actor.ts`
7. `packages/whiteboard-engine/src/runtime/actors/selection/Actor.ts`
8. `packages/whiteboard-engine/src/runtime/actors/tool/Actor.ts`
9. `packages/whiteboard-engine/src/runtime/actors/viewport/Actor.ts`
10. `packages/whiteboard-engine/src/runtime/actors/history/Actor.ts`
11. `packages/whiteboard-engine/src/runtime/actors/edge/Actor.ts`
12. `packages/whiteboard-engine/src/runtime/actors/node/Actor.ts`
13. `packages/whiteboard-engine/src/runtime/actors/mindmap/Actor.ts`
14. `packages/whiteboard-engine/src/runtime/actors/input/Actor.ts`

## 10. 实施步骤（一步到位但分阶段提交）

### Phase 1：搭骨架

1. 引入 `Coordinator`。
2. `createEngine` 改为通过 Coordinator 组装主链。
3. EventCenter 保持对外 API 不变。

### Phase 2：迁移 watcher

1. 删除 `runtime/lifecycle/watchers/stateEvents.ts`。
2. 删除 `runtime/lifecycle/watchers/selectionEvents.ts`。
3. 对应事件逻辑迁入 `Selection/Tool/Viewport/History/Mindmap Actor`。

### Phase 3：收口 change + graph

1. `change/pipeline` 纯化为变更执行组件。
2. `Coordinator` 负责调用 `DocumentActor + GraphActor + ViewActor`。
3. 统一公共事件发射点。

### Phase 4：Edge / Node 收口

1. Edge 相关交互与缓存统一进 `Edge Actor`。
2. Node 相关交互与 overrides 统一进 `Node Actor`。

### Phase 5：Lifecycle 退化

1. `Lifecycle` 只做 `coordinator.start/stop/updateLifecycle`。
2. 清理旧 wiring。

## 11. 验收标准

1. 内部核心链路不依赖全局内部事件。
2. Actor 间无 peer-to-peer 直接调用。
3. 对外 `instance.events.on/off` 行为保持。
4. 交互主路径无回归（拖拽/缩放/框选/连线/快捷键/history/mindmap）。
5. 通过：
- `pnpm -C packages/whiteboard-engine lint`
- `pnpm -C packages/whiteboard-react lint`
- `pnpm -C packages/whiteboard-engine run bench:check`

## 12. 关键 trade-off

1. 纯事件驱动优点是解耦，但在你这个 engine 场景会显著增加链路追踪成本。
2. 纯直调优点是清晰，但扩展性稍弱。
3. 本方案用“内直调 + 外事件 + 少量内部旁路事件”平衡两者，是长期可维护的最优解。
