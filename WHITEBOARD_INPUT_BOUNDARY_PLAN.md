# Whiteboard Input Boundary Plan

## 1. 目标

把输入策略与 DOM 绑定彻底收敛到 UI/Host 层，Engine 只处理：

- 规范化后的请求（commands/mutations）
- 领域状态与投影
- 最小安全约束（invariants）

核心结论：

- `enablePan` / `enableWheel` / `wheelSensitivity` 不应由 Engine 持有。
- `minZoom` / `maxZoom` 由 UI/Host 作为交互策略执行；Engine 仅保留硬边界保护。

---

## 2. 当前问题

当前存在两类复杂度来源：

1. 配置重复与映射链
- `createDefaultInputConfig` 与 `toInputViewportConfig` 字段重复拷贝。
- `LifecycleViewportConfig -> InputConfig` 增加中间概念和同步链。

2. 职责混合
- UI 策略（是否允许 wheel/pan、缩放灵敏度）在 Engine 内部执行。
- Engine 需要维护 `input.configure` 与配置状态，增加生命周期耦合。

---

## 3. 目标架构（长期最简）

数据流：

1. React/Host：监听 DOM 事件，做目标识别、交互策略、手势识别。
2. React/Host：调用 `instance.commands.*`（或 `instance.input.handle` 仅处理纯领域输入）。
3. Engine：Actor 执行领域逻辑，产出 mutations。
4. Engine：写入管线 `applyMutations -> reduce -> projection/view`。

边界规则：

- Host 拥有 UI 输入策略。
- Engine 不再持有可变输入策略配置。
- Engine 不解析 DOM，不知道 UI 容器结构。

---

## 4. 职责拆分

### 4.1 Host（React）职责

- DOM 监听与事件归一化
- 背景/节点/边等 target 识别
- 视口交互策略：
  - 是否允许平移/缩放
  - 灵敏度
  - 交互级最小/最大缩放
- 手势状态机（pointer 拖拽、wheel 缩放）

建议组件（react 包内）：

- `ViewportPolicy`：纯配置对象
- `ViewportGestureController`：处理 pan/wheel
- `DomInputAdapter`：分发到 `commands` 或 `input.handle`

### 4.2 Engine 职责

- `commands.viewport.*` 执行领域动作
- `ViewportDomain` 维护最小硬边界（防止非法 zoom）
- 不维护 `InputConfig`、不维护 `input.configure`

---

## 5. API 设计（简洁版）

## 5.1 Host 侧 API（新增）

```ts
type ViewportPolicy = {
  panEnabled: boolean
  wheelEnabled: boolean
  minZoom: number
  maxZoom: number
  wheelSensitivity: number
}
```

```ts
type ViewportGestureController = {
  onPointerDown(event: PointerEvent): boolean
  onPointerMove(event: PointerEvent): void
  onPointerUp(event: PointerEvent): void
  onWheel(event: WheelEvent): boolean
  reset(): void
}
```

说明：

- `onWheel` 返回 `true` 表示已消费，Host 执行 `preventDefault`。
- 控制器内部直接调用 `instance.commands.viewport.panBy/zoomBy`。

## 5.2 Engine 侧 API（收敛后）

- 保留 `commands.viewport`（领域入口）
- 删除/停止使用：
  - `InputConfig`
  - `input.configure`
  - `LifecycleViewportConfig -> InputConfig` 同步机制

---

## 6. 实施方案（一步到位，破坏式）

## Phase 1: 去掉 Engine 输入配置层

目标：Engine 不再保存输入策略配置。

改动：

- `packages/whiteboard-engine/src/types/input.ts`
  - 删除 `InputConfig`
  - `InputController` 删除 `configure`
  - `InputSessionContext` 删除 `input.config`

- `packages/whiteboard-engine/src/input/core/InputPort.ts`
  - 删除 `config` 字段与 `configure` 方法
  - 删除依赖输入配置的分支

- `packages/whiteboard-engine/src/input/index.ts`
  - `createInputPort` 不再接收 `config`

- `packages/whiteboard-engine/src/instance/create.ts`
  - 删除 `toInputViewportConfig`
  - 删除 `createDefaultInputConfig`
  - `createInputPort` 调用去掉 `config`

- `packages/whiteboard-engine/src/runtime/lifecycle/Lifecycle.ts`
  - 删除 `LifecycleInputSyncOptions` 和 `onViewportConfigChange`

## Phase 2: 把 viewport 交互迁到 Host

目标：wheel/pan 不再走 engine input session。

改动：

- `packages/whiteboard-engine/src/input/sessions/defaults.ts`
  - 移除 `createViewportPan`

- `packages/whiteboard-engine/src/input/sessions/ViewportPan.ts`
  - 删除文件

- `packages/whiteboard-engine/src/input/core/InputPort.ts`
  - `handleWheel` 改为 no-op（或删除 wheel 分支）

- `packages/whiteboard-react/src/common/input/`
  - 新增 `ViewportGestureController.ts`
  - `DomInputAdapter.ts` 中接管 pointer pan + wheel zoom
  - 读取 `resolvedConfig.viewport` 作为 `ViewportPolicy`

## Phase 3: 收敛 lifecycle 配置语义

目标：`lifecycle` 仅管文档态与运行态，不管 UI 输入策略。

改动：

- `packages/whiteboard-engine/src/types/instance/lifecycle.ts`
  - 删除 `LifecycleViewportConfig`
  - `LifecycleConfig` 删除 `viewportConfig`

- `packages/whiteboard-engine/src/runtime/lifecycle/config.ts`
  - 删除 `viewportConfig` 默认构造

- `packages/whiteboard-engine/src/config/index.ts`
  - `toLifecycleConfig` 删除 `viewportConfig` 相关参数与映射

- `packages/whiteboard-react/src/Whiteboard.tsx`
  - 调用 `toLifecycleConfig` 时不再传 `viewportConfig`

## Phase 4: Engine 侧硬边界

目标：即使外部错误调用，也不会产生非法视口。

改动：

- `packages/whiteboard-engine/src/runtime/actors/viewport/Domain.ts`
  - `set/zoomBy/zoomTo` 统一做 hard clamp
  - hard boundary 建议：
    - `min`: `DEFAULT_INTERNALS.zoomEpsilon`
    - `max`: 常量（例如 `64` 或 `100`，固定即可）

策略：

- UI 层 clamp 决定交互体验。
- Engine hard clamp 仅做安全兜底，不承载产品策略。

---

## 7. 命名与目录规范

命名要求：简短、语义化、避免重复前后缀。

建议：

- `ViewportPolicy`（配置）
- `ViewportGestureController`（host 手势）
- 不使用 `InputViewportConfig`、`ViewportNavigationService` 这类叠词名

目录建议：

- `packages/whiteboard-react/src/common/input/`
  - `ViewportGestureController.ts`
  - `DomInputAdapter.ts`
  - `DomEventMapper.ts`

---

## 8. 验收标准

满足以下条件视为完成：

1. Engine 中不存在 `input.configure`。
2. Engine 中不存在 `InputConfig` 与 `Lifecycle -> Input` 的 viewport 配置同步。
3. `createViewportPan` 不在 engine input sessions 中。
4. wheel/pan 策略逻辑仅存在于 react/host。
5. `commands.viewport.*` 仍是唯一写入入口。
6. core/engine/react 构建全部通过。

---

## 9. 风险与处理

风险：

- 迁移初期 pan/wheel 行为与旧逻辑有细微差异（锚点、clamp 顺序）。

处理：

- 增加交互回归用例（至少覆盖：wheel 缩放锚点、space+drag、middle drag、min/max clamp）。
- 在 react 层保留一处统一策略函数，避免散落在多个 handler。

---

## 10. 一句话总结

把“如何输入”留在 Host，把“如何写文档”留在 Engine；Engine 只做领域写入与安全兜底，这是长期复杂度最低的边界。  
