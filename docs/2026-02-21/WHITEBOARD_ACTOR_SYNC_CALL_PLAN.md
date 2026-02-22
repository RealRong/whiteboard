# Whiteboard Engine 同步直调 Actor 化方案

## 1. 目标

这份方案定义一套长期形态：

1. Engine 内部主链路全部采用同步直调。
2. Actor 是唯一领域入口，禁止“纯转发 Actor”。
3. 内部协作以调用为主，不再依赖内部事件串联业务。
4. 对外仍保留 `instance.events` 作为统一事件出口。
5. 输入层只接收规范化输入，不关心 DOM 绑定细节。

一句话：**内部像单进程微服务，外部像稳定 SDK。**

## 2. 当前问题

基于当前代码（`packages/whiteboard-engine/src/runtime/actors` + `runtime/interaction`）主要有三类复杂度：

1. 部分 Actor 只是把调用转发到 `runtime/interaction/*`，领域边界不真实。
2. 相同领域逻辑分散在 `actors`、`interaction`、`input/sessions`，新手难以定位“真正负责人”。
3. `createInteractionFacade` 和 `runtime.interaction` 形成额外抽象层，拉长调用链。

## 3. 核心设计原则

1. `Coordinator` 只负责编排，不持有领域实现细节。
2. 每个 Actor 对一个领域负责：状态、缓存、规则、命令入口在同目录收口。
3. 跨领域协作优先“Coordinator 顺序直调”；仅在强依赖场景使用受限端口调用。
4. 内部不使用事件总线驱动主业务；事件只用于对外通知和可选观测。
5. 输入采用统一标准事件，React 层只做采集与转换。

## 4. 目标架构

## 4.1 分层

1. `Input`：处理 `EngineInputEvent`，驱动对应 Actor 命令。
2. `Coordinator`：执行事务链（doc -> graph -> view -> notify）。
3. `Actors`：领域能力主体（node/edge/mindmap/graph/...）。
4. `Events`：仅对外发布 `InstanceEventMap`。

## 4.2 主链路

1. `instance.apply/tx` -> `Coordinator.applyChange`
2. `DocumentActor.apply`
3. `GraphActor.syncAfterApply`
4. `ViewActor.sync`
5. `Coordinator.emit(...)` 对外发事件

## 4.3 输入链路

1. React: `addEventListener` 采集原始事件
2. React: `DomEventMapper` 转 `EngineInputEvent`
3. Engine: `instance.input.handle(event)`
4. `InputPort` 根据 `target + gesture` 路由到 Actor 命令

## 5. Actor 目录与命名

规则：

1. 文件名 `PascalCase`。
2. 同目录减少重复后缀，避免 `EdgeEdge*`、`NodeNode*`。
3. 每个 Actor 目录至少包含一个“真实行为文件”，不允许只有转发层。

建议目录（示例）：

1. `packages/whiteboard-engine/src/runtime/actors/edge/Actor.ts`
2. `packages/whiteboard-engine/src/runtime/actors/edge/Connect.ts`
3. `packages/whiteboard-engine/src/runtime/actors/edge/Routing.ts`
4. `packages/whiteboard-engine/src/runtime/actors/edge/State.ts`
5. `packages/whiteboard-engine/src/runtime/actors/edge/Policy.ts`
6. `packages/whiteboard-engine/src/runtime/actors/node/Actor.ts`
7. `packages/whiteboard-engine/src/runtime/actors/node/Drag.ts`
8. `packages/whiteboard-engine/src/runtime/actors/node/Transform.ts`
9. `packages/whiteboard-engine/src/runtime/actors/node/Overrides.ts`
10. `packages/whiteboard-engine/src/runtime/actors/node/State.ts`
11. `packages/whiteboard-engine/src/runtime/actors/mindmap/Actor.ts`
12. `packages/whiteboard-engine/src/runtime/actors/mindmap/Drag.ts`
13. `packages/whiteboard-engine/src/runtime/actors/mindmap/Layout.ts`
14. `packages/whiteboard-engine/src/runtime/actors/mindmap/State.ts`

迁移完成后目标：逐步移除 `packages/whiteboard-engine/src/runtime/interaction/`。

## 6. 最小 API 设计（面向新手可读）

## 6.1 Actor 统一结构

```ts
export interface ActorLifecycle {
  start(): void
  stop(): void
  resetTransientState(): void
}
```

每个 Actor 公开两类能力：

1. `commands`：写操作（可改变状态/触发 core 命令）
2. `query`：只读查询（返回快照或计算值）

## 6.2 Edge Actor 示例

```ts
export interface EdgeActorType extends ActorLifecycle {
  commands: {
    startConnectFromHandle(nodeId: NodeId, side: AnchorSide, pointer: PointerInput): void
    startConnectFromPoint(nodeId: NodeId, pointer: PointerInput): void
    startReconnect(edgeId: EdgeId, end: 'source' | 'target', pointer: PointerInput): void
    updateConnect(pointer: PointerInput): void
    commitConnect(pointer: PointerInput): void
    cancelConnect(): void

    startRouting(edgeId: EdgeId, index: number, pointer: PointerInput): void
    updateRouting(pointer: PointerInput): void
    endRouting(pointer: PointerInput): void
    cancelRouting(): void

    hoverMove(pointer?: PointerInput, enabled?: boolean): void
    hoverCancel(): void
  }
  query: {
    isConnecting(): boolean
    isRouting(): boolean
  }
}
```

说明：`Actor.ts` 负责编排 `Connect.ts` 和 `Routing.ts`，不再依赖外部 `interaction` 转发。

## 6.3 Node Actor 示例

```ts
export interface NodeActorType extends ActorLifecycle {
  commands: {
    startDrag(nodeId: NodeId, pointer: PointerInput): void
    updateDrag(pointer: PointerInput): void
    endDrag(pointer: PointerInput): void
    cancelDrag(): void

    startResize(nodeId: NodeId, pointer: PointerInput, handle: ResizeHandle): boolean
    startRotate(nodeId: NodeId, pointer: PointerInput): boolean
    updateTransform(pointer: PointerInput, minSize?: Size): void
    endTransform(pointer: PointerInput): void
    cancelTransform(): void

    setOverrides(updates: NodeViewUpdate[]): void
    clearOverrides(ids?: NodeId[]): void
    commitOverrides(updates?: NodeViewUpdate[]): void
  }
  query: {
    hasOverrides(): boolean
    getOverrides(): NodeViewUpdate[]
  }
}
```

## 6.4 Mindmap Actor 示例

```ts
export interface MindmapActorType extends ActorLifecycle {
  commands: {
    startDrag(treeId: string, nodeId: NodeId, pointer: PointerInput): void
    updateDrag(pointer: PointerInput): void
    endDrag(pointer: PointerInput): void
    cancelDrag(): void
    setLayout(layout: MindmapLayoutConfig): void
  }
  query: {
    getLayout(): MindmapLayoutConfig
  }
}
```

## 7. 协作规则（同步直调版）

## 7.1 必须遵守

1. `InputPort` 不再调用 `runtime.interaction`，只调用 Actor `commands`。
2. `Commands API` 写操作统一调用 Actor `commands`。
3. `Coordinator` 只调 Actor 对外 API，不触碰 Actor 内部实现。
4. `Actor` 之间不通过事件总线协作。

## 7.2 允许的调用关系

1. `Coordinator -> Actor`
2. `InputPort -> Actor.commands`
3. `Actor -> core/state/graph/query/runtime getter`
4. `Actor -> Actor` 仅允许通过显式端口接口且必须在构造函数声明依赖

## 7.3 禁止的调用关系

1. `Actor` 调 `runtime/interaction/*`
2. `Actor` 直接触发另一个 Actor 的内部子模块
3. 业务主链由内部 `events.emit` 反向驱动

## 8. 对外事件策略

对外保留 `instance.events.on/off`，事件命名保持：

1. `change.applied`
2. `doc.changed`
3. `selection.changed`
4. `edge.selection.changed`
5. `tool.changed`
6. `viewport.changed`
7. `history.changed`
8. `mindmap.layout.changed`

约束：

1. 事件只在事务稳定态发出（优先在 `Coordinator` 末端发）。
2. 事件 payload 由对应 Actor 提供快照，`Coordinator` 负责发射时机。

## 9. 分阶段实施计划

## Phase 1：Edge 收敛（优先）

1. 将 `runtime/interaction/EdgeConnect.ts` 逻辑迁入 `actors/edge/Connect.ts`。
2. 将 `runtime/interaction/RoutingDrag.ts` 逻辑迁入 `actors/edge/Routing.ts`。
3. `actors/edge/Actor.ts` 改为真实编排 + 状态边界。
4. `Input sessions` 与 `commands` 改为调用 `edgeActor.commands`。

完成标志：`edge/Actor.ts` 无 `interaction` 依赖。

## Phase 2：Mindmap 收敛

1. 将 `runtime/actors/mindmap/Interaction.ts` 合并回 `mindmap/Actor.ts` 或 `mindmap/Drag.ts`。
2. 消除 `MindmapInteraction` 薄壳。
3. 输入会话改为直调 `mindmapActor.commands`。

完成标志：`mindmap/Interaction.ts` 删除。

## Phase 3：Node 收敛

1. 将 `runtime/interaction/NodeDrag.ts` 迁入 `actors/node/Drag.ts`。
2. 将 `runtime/interaction/NodeTransform.ts` 迁入 `actors/node/Transform.ts`。
3. `node/Actor.ts` 统一对外最小 API。

完成标志：Node 领域行为全部在 `actors/node/*`。

## Phase 4：删除 interaction 层

1. 删除 `runtime/interaction/create.ts`、`runtime/interaction/index.ts`。
2. 删除 `runtime/actors/interaction/facade.ts`。
3. `runtime.interaction` 从 `RuntimeInternal` 缩减为兼容别名后最终移除。

完成标志：Engine 内无 `runtime/interaction/*` 运行时依赖。

## 10. 验收标准

1. Actor 目录成为每个领域唯一行为实现入口。
2. `InputPort`、`commands`、`coordinator` 全部通过 Actor API 协作。
3. 主链路调试只需沿同步调用栈即可定位问题。
4. 对外 API 保持稳定：`instance.apply/tx/input/events/lifecycle` 不破坏。
5. lint、bench、demo 手势路径（node/edge/mindmap）全部通过。

## 11. 风险与缓解

1. 风险：迁移过程中行为回归。
   缓解：按领域分 phase，单领域完成后立即跑 lint + bench + demo smoke。
2. 风险：Actor API 膨胀。
   缓解：API 仅保留 `commands/query/lifecycle` 三组，禁止暴露内部结构。
3. 风险：跨领域调用失控。
   缓解：跨 Actor 依赖必须走显式端口并在构造函数声明。

## 12. 给新同学的理解路径

1. 先看 `instance/create.ts`，理解 Actor 如何装配。
2. 再看 `Coordinator`，理解事务主链。
3. 然后看某个领域 `actors/<domain>/Actor.ts`，这是该领域唯一入口。
4. 最后看该领域子文件（`Drag/Connect/Routing/Transform`）理解行为细节。

做到这四步，就能在不读全仓库的情况下快速定位问题和扩展能力。
