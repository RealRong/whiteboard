# Whiteboard Engine Actor 化与 Host 化设计方案

## 1. 目标与问题

当前 engine 仍保留部分宿主职责（如 `ResizeObserver`），并且在装配层存在业务规则（如 interaction/selection 的写入规则迁移前状态）。  
目标是把系统收敛到两条清晰边界：

1. **Engine 内部**：只保留领域行为与状态演算（Actor + Mutation）。
2. **Host/React 层**：负责 DOM 监听、事件采集、环境信号，并将规范化输入传给 engine。

最终效果：

1. engine 不直接依赖 DOM 观察器。
2. 写入链路统一为 `commands -> actor -> mutate -> reduce -> projection/view`。
3. 输入链路分为两类：
   1. 用户输入（pointer/keyboard/wheel）。
   2. 宿主信号（node size/container rect/focus visibility 等）。

---

## 2. 总体原则

1. **单向边界**：Host 只向 engine 输入信号，不读取 engine 内部实现细节。
2. **同步直调优先**：engine 内部 actor 之间通过方法调用协作，不用内部事件总线。
3. **事件仅对外**：`instance.events` 用于外部订阅，不用于内部编排。
4. **最小 API 面**：对外暴露语义化命令，不暴露原子状态结构。
5. **无兼容层迁移**：一步到位移除 engine 内的 DOM observer。

---

## 3. 目标架构（四阶段）

采用四阶段流水线，每一阶段只产出规范化输出，交给下一阶段：

```text
Stage 1: React/Host
  -> 输出 EngineRequest

Stage 2: Gateway
  -> 输出 ActorRequest

Stage 3: Actors
  -> 输出 MutationPlan (operations + source)

Stage 4: Mutate
  -> 输出 DispatchResult + Projection/View 更新
```

高层图：

```text
React/Host
  ├─ Pointer/Keyboard Adapter
  ├─ Resize Adapter (node/container)
  └─ Host Signal Normalizer
          │
          ▼
Gateway (统一入口，不做业务)
  ├─ request normalize
  ├─ route
  └─ context assemble
          │
          ▼
Actors (同步直调，纯领域决策)
  ├─ Node / Edge / Mindmap
  ├─ Selection / Interaction / Viewport
  └─ GroupAutoFit / Shortcut
          │
          ▼
Mutate (唯一写入)
  -> ChangeGateway.reduceOperations
  -> projection.sync
  -> view.applyProjection
```

### 3.1 阶段契约

每层只依赖下一层契约，不依赖实现：

1. `Stage1 -> Stage2`: `EngineRequest`
   1. `kind: 'input' | 'host' | 'command'`
   2. `payload: normalized data`
2. `Stage2 -> Stage3`: `ActorRequest`
   1. `actor: 'node' | 'edge' | 'selection' ...`
   2. `action: string`
   3. `args: unknown[]`
3. `Stage3 -> Stage4`: `MutationPlan`
   1. `operations: Operation[]`
   2. `source: CommandSource`

### 3.2 关键约束

1. React/Host 不直接调用 actor。
2. Gateway 不写业务规则，不读写业务状态。
3. Actor 不直接操作 projection/view，只产出 mutation。
4. Mutate 是唯一文档写入入口。
5. 对外事件仅由 mutate 后统一发出。

### 3.3 避免过度设计

这是“轻量分层”，不是中间件系统：

1. 不引入内部事件总线。
2. 不做可插拔管线框架。
3. 不做多层 DTO 套娃。
4. Gateway 保持薄层（normalize + route + assemble）。

---

## 4. Actor 化方案

## 4.1 Actor 分层

建议按职责拆成三层：

1. **Domain Actor（业务）**
   1. `node`
   2. `edge`
   3. `mindmap`
   4. `selection`
   5. `interaction`
   6. `viewport`
2. **Orchestration Actor（跨域协同）**
   1. `groupAutoFit`
   2. `shortcut`
3. **View/Query Actor（读模型）**
   1. `view`（投影输出）
   2. `query`（按需同步索引）

## 4.2 命名与目录

建议目录：

1. `packages/whiteboard-engine/src/runtime/actors/<domain>/Actor.ts`
2. `packages/whiteboard-engine/src/runtime/actors/<domain>/...`（子能力）

约束：

1. 类名统一 `Actor`（目录已表达域，不再重复前后缀）。
2. 对外能力使用动词语义：`select`, `clear`, `startDrag`, `commit`。
3. 共享逻辑放 `actors/shared`，只放纯工具或无域状态 helper。

## 4.3 create.ts 的目标职责

`create.ts` 仅保留：

1. 构建基础对象（state/document/projection/query/view）。
2. 构建 actors。
3. 将 `commands` 绑定到 actor 方法。
4. 构建 lifecycle/input。

`create.ts` 不应再包含：

1. 业务 merge 规则。
2. 复杂 selection/interaction 写入逻辑。
3. observer 实例化与 DOM 生命周期管理。

---

## 5. Host 化方案

## 5.1 迁移对象

从 engine 移出到 host（React）：

1. `NodeSizeObserver`（节点 DOM 尺寸监听）
2. `ContainerSizeObserver`（画布容器矩形监听）

原因：

1. 这两者本质是 DOM adapter，不是领域行为。
2. 它们依赖 host 框架生命周期（mount/unmount/ref 变化）。
3. 放在 host 可减少 engine 平台绑定，方便非 DOM 宿主接入。

## 5.2 Host -> Engine 新接口

新增 `commands.host`（建议）：

1. `nodeMeasured(id, size)`
2. `nodeMeasuredBatch(items)`
3. `containerResized(rect)`
4. `visibilityChanged(visible)`（可选）
5. `focusChanged(focused)`（可选）

类型建议：

```ts
type HostCommands = {
  nodeMeasured: (id: NodeId, size: Size) => void
  nodeMeasuredBatch: (items: Array<{ id: NodeId; size: Size }>) => void
  containerResized: (rect: { left: number; top: number; width: number; height: number }) => void
}
```

说明：

1. 这些命令是“宿主信号”，不是用户意图命令。
2. 进入 engine 后由对应 actor 同步处理。

## 5.3 React 侧建议

在 `whiteboard-react` 增加 host adapter 层：

1. `host/NodeMeasureAdapter.ts`
2. `host/ContainerResizeAdapter.ts`
3. `host/createHostSignals.ts`

职责：

1. 绑定 `ResizeObserver`。
2. 做帧级聚合（`requestAnimationFrame`）。
3. 做 epsilon 去抖（宽高微小变化不触发）。
4. 调用 `instance.commands.host.*`。

---

## 6. 调用链设计（四阶段映射）

## 6.1 用户输入链

`React events -> Stage1 request -> Stage2 gateway.routeInput -> Stage3 actor -> Stage4 mutate`

示例：

`pointermove -> InputRequest -> gateway -> nodeActor.updateDrag -> mutate`

## 6.2 宿主信号链

`ResizeObserver -> HostRequest -> gateway.routeHost -> actor -> mutate(必要时)`

示例：

`node measured -> HostRequest(nodeMeasured) -> gateway -> nodeActor.applyMeasuredSize -> mutate`

## 6.3 业务命令链

`commands.* -> CommandRequest -> gateway.routeCommand -> actor -> mutate`

示例：

`commands.node.update -> gateway -> nodeActor.update -> mutate`

## 6.4 GroupAutoFit 触发链

保持同步直调，不走内部事件总线：

1. mutate 完成后，gateway 根据 operations 计算影响。
2. 直接调用 `groupAutoFitActor.onMutationsApplied(operations)`。
3. 对外再统一发 `doc.changed`。

---

## 7. 落地步骤（建议顺序）

## Step 1：定义阶段契约

1. 定义 `EngineRequest` / `ActorRequest` / `MutationPlan` 类型。
2. 明确 gateway 只接受 request，不接受业务对象引用。

## Step 2：建立 Gateway 薄层

1. 新增 gateway route 方法：`routeInput` / `routeHost` / `routeCommand`。
2. 将现有 `commands` 与 `input` 入口改为先到 gateway。

## Step 3：host 侧适配

1. 在 `whiteboard-react` 新增 node/container observer adapter。
2. 由 adapter 发送 `HostRequest` 给 gateway（不直接触达 actor）。

## Step 4：engine 移除 DOM observer

1. 删除 `NodeSizeObserver`、`ContainerSizeObserver` 服务创建与引用。
2. 删除 lifecycle 中对应 dispose 流程。
3. 删除 `runtime.dom.*` 中 observer 暴露 API（若不再需要）。

## Step 5：Actor 收敛

1. host request 统一路由到 `HostActor` 或域 actor。
2. `groupAutoFit` 触发改为 mutate 后 gateway 直调。
3. 清理装配层中的临时回调变量与桥接代码。

## Step 6：文档与验收

1. 更新架构文档中的输入链与职责边界。
2. 补充测试用例（至少 smoke + 集成链路）。

---

## 8. 风险与规避

1. **风险：尺寸更新频率高导致写入抖动**
   1. 规避：host 层做 frame-batch + epsilon。
2. **风险：迁移后丢失清理时机**
   1. 规避：observer 生命周期完全跟随 React 组件卸载。
3. **风险：host 与 engine 坐标系不一致**
   1. 规避：host 只传“已规范化”的尺寸/容器 rect，不传业务推导值。

---

## 9. 验收标准

1. `whiteboard-engine` 不再直接 `new ResizeObserver`。
2. `create.ts` 不再创建 observer service。
3. `commands.host` 能覆盖 node/container 现有能力。
4. Node 尺寸变化、容器变化、拖拽/缩放/选区行为回归通过。
5. 构建通过：
   1. `pnpm -r -F @whiteboard/core -F @whiteboard/engine -F @whiteboard/react build`

---

## 10. 最终状态（期望）

1. Engine：纯领域运行时（Actor + Mutation + Projection）。
2. Host：纯环境适配层（DOM 监听 + 规范化输入）。
3. 两侧通过稳定、简洁、语义化命令接口对接。
