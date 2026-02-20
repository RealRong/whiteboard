# 公共输入能力设计方案

## 1. 背景与问题

当前已经把 DOM 事件绑定迁到 React 侧，但 `DomInputAdapter` 仍需要访问内部能力：

- `runtime.shortcuts`
- `runtime.services.viewportNavigation`

这导致两点问题：

1. React 侧需要 `RuntimeInternal` 类型兜底（`as RuntimeInternal`）。
2. 输入能力边界不稳定，宿主层仍知道 engine 内部结构。

目标是把这些能力收敛为 **engine 的公共输入接口**，宿主层只面向稳定 API。

---

## 2. 目标

1. 宿主层只调用 `instance.input`，不再访问 `runtime.shortcuts/services`。
2. 输入语义全部通过规范化事件进入 engine。
3. engine 返回统一副作用描述（effects），由宿主执行。
4. `Lifecycle` 不再承担输入路由与输入配置桥接。

---

## 3. 目标 API（公共）

建议把 `InputPort` 升级为 `InputController`（`instance.input` 仍保留该字段名）：

```ts
export type InputController = {
  handle: (event: InputEvent) => InputResult
  configure: (config: InputConfig) => void
  reset: (reason?: CancelReason) => InputResult
}

export type InputResult = {
  effects: InputEffect[]
}
```

说明：

- `handle`：统一入口，处理 pointer/key/wheel/focus/composition。
- `configure`：同步运行时输入配置（主要是 viewport 配置）。
- `reset`：外部中断（blur/unmount/force）统一清理当前会话。

---

## 4. 统一输入协议

## 4.1 InputEvent

```ts
type InputEvent =
  | PointerInputEvent
  | KeyInputEvent
  | WheelInputEvent
  | FocusInputEvent
  | CompositionInputEvent

type PointerInputEvent = {
  kind: 'pointer'
  stage: 'capture' | 'bubble'
  phase: 'down' | 'move' | 'up' | 'cancel'
  pointer: PointerInput
  pointerId: number
  // ...已有字段
}

type KeyInputEvent = {
  kind: 'key'
  phase: 'down' | 'up'
  key: string
  code: string
  // ...已有字段
}

type WheelInputEvent = {
  kind: 'wheel'
  client: { x: number; y: number }
  deltaX: number
  deltaY: number
  deltaZ: number
  modifiers: { shift: boolean; alt: boolean; ctrl: boolean; meta: boolean }
  source: 'container' | 'window' | 'program'
  timestamp: number
}
```

关键点：

- `pointer.stage` 用于表达 capture/bubble，替代宿主直接调 shortcut 内部 API。
- `wheel` 增加 `client/modifiers`，让 engine 独立完成缩放决策。

## 4.2 InputEffect

```ts
type InputEffect =
  | { type: 'pointer.capture'; pointerId: number }
  | { type: 'pointer.release'; pointerId: number }
  | { type: 'pointer.trackWindow'; enabled: boolean }
  | { type: 'dom.preventDefault'; reason: string }
  | { type: 'dom.stopPropagation'; reason: string }
  | { type: 'dom.setCursor'; cursor: string }
  | { type: 'render.request'; reason: string }
```

说明：

- engine 只产出 effect，不直接触发 DOM 行为。
- `preventDefault/stopPropagation` 也通过 effect 回传，宿主统一执行。

---

## 5. Engine 内部结构（职责拆分）

建议在 `packages/whiteboard-engine/src/input/` 内组织为：

- `InputController.ts`：公共入口，编排各子模块。
- `PointerRouter.ts`：pointer session 路由（现有 PointerSessionEngine 职责）。
- `ShortcutRouter.ts`：处理 key 与 pointer-capture 的快捷键决策。
- `WheelRouter.ts`：处理 wheel 缩放（依赖 viewportNavigation）。
- `KeyboardStateRouter.ts`：处理 `Space` 状态与 `Escape` 会话取消。
- `HoverRouter.ts`：处理 edge hover move/cancel。
- `effects.ts` / `events.ts` / `config.ts`：协议与配置类型。

每个 router 只做一件事，`InputController` 只负责编排顺序。

---

## 6. 编排顺序（建议）

`handle(event)` 的固定顺序：

1. `KeyboardStateRouter`（先处理 `Space/Escape` 等全局键状态）
2. `ShortcutRouter`（capture 阶段优先，决定是否阻断）
3. `PointerRouter`（pointer session 主流程）
4. `WheelRouter`（wheel 缩放）
5. `HoverRouter`（edge hover）
6. 聚合 effects 返回

这样可读性高，新人按顺序即可理解输入系统。

---

## 7. 配置模型

新增 `InputConfig`（公开）：

```ts
type InputConfig = {
  viewport: {
    minZoom: number
    maxZoom: number
    enablePan: boolean
    enableWheel: boolean
    wheelSensitivity: number
  }
}
```

由 `lifecycle.update` 或上层配置更新时调用：

```ts
instance.input.configure({ viewport: lifecycleConfig.viewportConfig })
```

不再通过 `Lifecycle -> callback -> createEngine` 传递输入配置。

---

## 8. Host Adapter 目标形态

宿主层（React）只保留三类职责：

1. 监听 DOM 事件并 map 成 `InputEvent`。
2. 调用 `instance.input.handle(event)`。
3. 执行 `effects`（capture/release/window tracking/preventDefault/cursor）。

宿主层不再：

- import `RuntimeInternal`
- 调用 `runtime.shortcuts.*`
- 调用 `runtime.services.viewportNavigation.*`

---

## 9. 迁移步骤（一步到位）

1. 在 engine 输入层新增 `InputController + routers + InputConfig`。
2. 扩展 `InputEvent`（`pointer.stage` 与增强 `wheel`）。
3. 把 shortcut/wheel/space/escape/hover 逻辑迁入输入层 router。
4. 将 `instance.input` 类型从 `InputPort` 替换为 `InputController`。
5. React `DomInputAdapter` 改为仅 `map + handle + runEffects`。
6. 删除 React 内对 `RuntimeInternal` 的依赖和强转。

---

## 10. 验收标准

1. `packages/whiteboard-react` 不再出现 `RuntimeInternal` import。
2. 全仓搜索无 `runtime.shortcuts` 和 `runtime.services.viewportNavigation` 的宿主侧调用。
3. `instance.input` 能完整覆盖 pointer/key/wheel/focus 路径。
4. 交互行为无回归（拖拽/变换/连线/框选/快捷键/滚轮/blur/escape）。
5. `pnpm -C packages/whiteboard-engine lint` 与 `bench:check` 通过。

---

## 11. 风险与对策

风险 1：事件阶段时序变化导致快捷键拦截行为变化。  
对策：先写 capture/bubble 顺序测试用例（pointerdown shortcut 命中/未命中）。

风险 2：wheel 配置同步时机错误导致缩放行为抖动。  
对策：`configure` 在每次 lifecycle update 后同步，新增配置变更回归测试。

风险 3：一次性迁移面大。  
对策：按 router 分块提交，但不保留双轨运行。

