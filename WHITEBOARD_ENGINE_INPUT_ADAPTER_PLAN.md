# Engine 输入架构重构方案（Host Adapter 模式）

## 1. 目标与结论

结论：`DomInputBridge` 不应留在 engine 核心层。  
长期最优结构是：

- Host（React/DOM）负责事件监听与标准化。
- Engine 只处理规范化输入事件，输出可执行效果。
- Host 执行效果（capture/release/preventDefault/cursor/window tracking）。

一句话边界：

`Host 负责“事件从哪里来”，Engine 负责“事件意味着什么”。`

---

## 2. 设计原则

1. 单一职责：Engine 不直接依赖 `PointerEvent`/`window`/`HTMLElement`。
2. 协议优先：Host 和 Engine 只通过 `InputEvent` / `InputEffect` 交流。
3. 类职责清晰：每个 class 只负责一个层次（路由、会话、执行器）。
4. 一步到位：不保留旧 `DomInputBridge` 兼容路径。

---

## 3. 推荐命名（简洁、行业常见）

### Engine 侧

- `InputRuntime`：输入总入口（替代 `InputPort` 的语义名）。
- `PointerRouter`：pointer 会话路由与仲裁（替代 `PointerSessionEngine`）。
- `PointerSession`：会话定义（`canStart/start`）。
- `PointerSessionRuntime`：活跃会话运行时（`update/end/cancel`）。
- `InputContext`：会话可访问上下文（state/query/commands/runtime/config）。

### Host 侧（React/DOM）

- `DomInputAdapter`：绑定/解绑 DOM 事件，驱动输入流程。
- `DomEventMapper`：DOM Event -> `InputEvent` 标准化。
- `DomEffectRunner`：执行 `InputEffect`。

命名规则：

- 同目录不重复前后缀，例如 `PointerRouter.ts`、`PointerSession.ts`。
- API 方法统一用动词：`start/stop/handle/cancel`。
- 类型名用名词：`InputEvent`、`InputEffect`、`InputContext`。

---

## 4. 分层与目录建议

### `packages/whiteboard-engine/src/input/`

- `InputRuntime.ts`
- `PointerRouter.ts`
- `events.ts`（`InputEvent` 定义）
- `effects.ts`（`InputEffect` 定义）
- `context.ts`（`InputContext` 定义）
- `sessions/`
  - `NodeTransform.ts`
  - `NodeDrag.ts`
  - `EdgeConnect.ts`
  - `RoutingDrag.ts`
  - `MindmapDrag.ts`
  - `SelectionBox.ts`
  - `ViewportPan.ts`

### `packages/whiteboard-react/src/common/input/`

- `DomInputAdapter.ts`
- `DomEventMapper.ts`
- `DomEffectRunner.ts`

---

## 5. 核心 API 设计

## 5.1 Engine API

```ts
export type InputRuntime = {
  handle(event: InputEvent): InputEffect[]
  cancel(reason: CancelReason): InputEffect[]
}
```

说明：

- `handle` 是唯一输入入口。
- `cancel` 用于 blur/escape/unmount 等外部中断。

## 5.2 会话 API

```ts
export type PointerSession = {
  kind: PointerSessionKind
  priority: number
  canStart(event: PointerInputEvent, ctx: InputContext): boolean
  start(
    event: PointerInputEvent,
    ctx: InputContext
  ): PointerSessionRuntime | null
}

export type PointerSessionRuntime = {
  pointerId: number
  update(event: PointerInputEvent, ctx: InputContext): void
  end(event: PointerInputEvent, ctx: InputContext): void
  cancel(reason: CancelReason, ctx: InputContext): void
}
```

说明：

- 新手只需理解两段：
  1. `PointerSession` 决定能不能进会话。
  2. `PointerSessionRuntime` 负责会话生命周期。

## 5.3 Engine 输出协议

```ts
export type InputEffect =
  | { type: 'pointer.capture'; pointerId: number }
  | { type: 'pointer.release'; pointerId: number }
  | { type: 'pointer.trackWindow'; enabled: boolean }
  | { type: 'dom.preventDefault'; reason: string }
  | { type: 'dom.setCursor'; cursor: string }
  | { type: 'render.request'; reason: string }
```

说明：

- `InputEffect` 是声明，不执行副作用。
- 执行副作用只在 Host 侧。

---

## 6. Host Adapter API

```ts
export type DomInputAdapter = {
  start(): void
  stop(): void
}
```

内部流程：

1. DOM 事件进入 `DomEventMapper`。
2. 调用 `inputRuntime.handle(inputEvent)`。
3. `DomEffectRunner` 执行返回的 `InputEffect[]`。

---

## 7. 事件流（最终形态）

```text
PointerEvent/KeyboardEvent
  -> DomEventMapper
  -> InputEvent
  -> InputRuntime.handle(...)
  -> InputEffect[]
  -> DomEffectRunner
  -> DOM side effects / window tracking / cursor / preventDefault
```

---

## 8. 与当前实现的映射关系

- `runtime/lifecycle/dom/DomInputBridge.ts`
  - 拆分为 `DomEventMapper` + `DomEffectRunner` + `DomInputAdapter`（移出 engine）。
- `input/core/InputPort.ts`
  - 升级/更名为 `InputRuntime`（保留 handle/cancel 语义）。
- `input/core/PointerSessionEngine.ts`
  - 更名为 `PointerRouter`（职责不变：仲裁+路由）。
- `input/sessions/*`
  - 保持现有会话文件，继续使用二段式 runtime API。

---

## 9. 重构步骤（一步到位）

1. 在 engine 内统一 `handle/cancel` 输入接口与 `InputEffect` 输出类型。
2. 新建 React 侧 `DomInputAdapter/DomEventMapper/DomEffectRunner`。
3. 将 `Lifecycle` 从“直接处理 DOM 输入”改为“仅安装 adapter 生命周期”。
4. 删除 engine 内 `DomInputBridge` 及其调用链。
5. 全量回归：拖拽/变换/框选/连线/滚轮/快捷键/blur/escape。

---

## 10. 可读性与复杂度收益

### 新人可读主线（3 步）

1. 看 `events.ts`：输入协议是什么。
2. 看 `PointerRouter.ts`：事件如何进入会话。
3. 看具体 session：交互语义怎么实现。

### 复杂度下降点

- 去掉 engine 中 DOM 监听细节与 window tracking 细节。
- 去掉 `Lifecycle -> DomInputBridge -> 具体 DOM 副作用` 的耦合链。
- 把复杂度收敛到两条稳定边界：`InputEvent` 与 `InputEffect`。

---

## 11. 非目标（避免范围膨胀）

- 本次不重写交互语义算法（drag/resize/snap 逻辑保持）。
- 本次不改 state schema 与 commands schema。
- 本次不引入新的全局状态容器。

---

## 12. 验收标准

1. Engine 核心目录不再直接 import DOM 类型。
2. `DomInputBridge` 删除，宿主层可独立绑定输入事件。
3. `pointer` 会话路径统一通过 `PointerSessionRuntime`。
4. Lint + bench + 关键交互回归全部通过。

