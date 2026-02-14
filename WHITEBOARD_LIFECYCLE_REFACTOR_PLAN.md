# Whiteboard Lifecycle 重构蓝图（React 最小化）

## 1. 目标

本方案只解决一件事：让 `useWhiteboardLifecycle` 成为“可一眼看懂流程”的薄桥接层，并将可下沉逻辑尽量下沉到 `instance/runtime`，避免不必要的 React 参与。

当前实施状态（2026-02-14）：

1. Phase A 已落地：`useWhiteboardLifecycle` 已切换为 `start/update/stop` 纯桥接。
2. Phase B 已落地：`edgeConnect` 窗口绑定与 selection 回调桥接均迁入 `runtime.lifecycle/bindings`。
3. Phase C 已基本落地：`common/hooks/internal` 与 `edge/lifecycle` 运行时链路已移除。
4. `groupAutoFit` 统一由 `runtime.lifecycle.start/stop` 管理，移除 instance 初始化时重复启动。
5. `Whiteboard.tsx` 已改为单点桥接 `useWhiteboardEngineBridge`，统一串联 history/context/lifecycle。
6. `history` 逻辑已下沉到 `WhiteboardLifecycleRuntime`：`configure/bind/clear` 不再由 React hook 管理，`useWhiteboardHistoryLifecycle` 已删除。
7. lifecycle 配置默认值拼装已下沉到 engine：通过 `toWhiteboardLifecycleConfig` 统一归一化，`useWhiteboardLifecycle` 仅负责 `start/update/stop`。
8. `useWhiteboardLifecycle` 已进一步压薄为“只接收 `instance + lifecycleConfig` 并执行 `start/update/stop`”；配置组装统一留在 `useWhiteboardEngineBridge`。

目标状态：

1. 打开 `packages/whiteboard-react/src/common/lifecycle/useWhiteboardLifecycle.ts` 就能看到清晰的 3 段流程：`start -> update -> stop`。
2. 输入事件处理、窗口事件编排、状态驱动监听尽量不依赖 React hooks。
3. `common/hooks/internal` 不再承载“运行时行为”，只保留真正 React 语义 hook（如果还需要）。
4. 生命周期相关代码按职责重组目录，避免跨 `common/hooks`、`edge/lifecycle`、`node/hooks` 到处跳。

---

## 2. 当前问题（基于现状扫描）

核心问题不是功能不对，而是组织方式导致理解成本高：

1. `useWhiteboardLifecycle` 同时混合了：
- 容器事件绑定
- 窗口按键绑定
- 视口同步
- shortcuts 更新
- edge lifecycle 调用
- selection 回调 bridge
- dispose

2. 生命周期链路分散：
- 主链路在 `common/lifecycle/useWhiteboardLifecycle.ts`
- 输入 handlers 在 `common/hooks/internal/*`
- edge 连接窗口监听在 `edge/lifecycle/useEdgeConnectLifecycle.ts`

3. 命名语义不稳定：
- 之前已把部分 `use*` 改为 `create*`，但目录仍叫 `hooks/internal`，语义冲突（“不是 hook，却放在 hooks”）。

4. 可下沉但还在 React 的逻辑仍有：
- edge connect 的 window pointermove/pointerup 编排
- selection/edgeSelection 的外部回调桥接（当前 useEffect）

---

## 3. 重构原则

### 3.1 React 只做桥接

React 层只承担：

1. 读取 props。
2. 将 props 同步给 lifecycle runtime。
3. 在 mount/unmount 时调用 runtime 的 `start/stop`。

除此之外，事件编排与规则一律下沉。

### 3.2 Runtime 负责行为

所有“可脱离 React 运行”的逻辑，统一放入 `instance` 侧：

1. DOM 事件处理编排。
2. window 事件按状态启停。
3. selection 回调/edge 回调桥接（基于 `instance.state.watch`）。
4. tool/viewport/shortcuts 的运行时更新。

### 3.3 文件命名和位置要表达职责

1. `useXxx` 只能是 React hook。
2. `createXxx` 只能是纯函数工厂。
3. `XxxService`/`XxxRuntime` 只能是 class（或明确 runtime 对象）。
4. 非 React 文件不能继续放在 `hooks/` 下。

---

## 4. 目标架构

## 4.1 目标调用链

```text
Whiteboard.tsx
  -> useWhiteboardEngineBridge (React 单点桥接)
       -> useWhiteboardContextHydration
       -> useWhiteboardLifecycle(start/update/stop)
```

## 4.2 新增 runtime 入口

在 `instance.runtime` 下新增 lifecycle 运行时：

- `runtime.lifecycle.start()`：绑定容器/窗口监听，初始化桥接。
- `runtime.lifecycle.update(config)`：更新 tool/viewport/shortcuts/callbacks。
- `runtime.lifecycle.stop()`：清理所有绑定。

---

## 5. 目录重构方案

## 5.1 目标目录

```text
packages/whiteboard-react/src/common/
  lifecycle/
    useWhiteboardEngineBridge.ts          # 单点桥接（history/context/lifecycle）
    useWhiteboardLifecycle.ts             # 仅 React bridge（薄）
    useWhiteboardContextHydration.ts

  instance/
    lifecycle/
      WhiteboardLifecycleRuntime.ts       # 生命周期总编排（核心）
      bindings/
        bindCanvasContainerEvents.ts      # DOM 容器事件绑定
        bindWindowSpaceKey.ts             # window 空格键绑定
        bindEdgeConnectWindow.ts          # edge connect window 事件编排
        bindSelectionCallbacks.ts         # selection/edgeSelection 回调桥接
      input/
        createCanvasInputHandlers.ts      # 组合 pointer/keyboard/wheel handlers
        createViewportInputHandlers.ts
        createEdgeHoverInputHandlers.ts
```

## 5.2 迁移映射

1. `common/hooks/internal/useCanvasHandlers.ts` -> `common/instance/lifecycle/input/createCanvasInputHandlers.ts`（或同等命名）。
2. `common/hooks/internal/createCanvasViewportHandlers.ts` -> `common/instance/lifecycle/input/createViewportInputHandlers.ts`。
3. `common/hooks/internal/createEdgeHoverHandlers.ts` -> `common/instance/lifecycle/input/createEdgeHoverInputHandlers.ts`。
4. `edge/lifecycle/useEdgeConnectLifecycle.ts` -> `common/instance/lifecycle/bindings/bindEdgeConnectWindow.ts`。
5. `edge/lifecycle/useEdgeLifecycle.ts` 删除。

---

## 6. API 设计草案

## 6.1 生命周期配置模型

```ts
export type WhiteboardLifecycleConfig = {
  tool: 'select' | 'edge'
  viewport: Viewport
  viewportConfig: {
    minZoom: number
    maxZoom: number
    enablePan: boolean
    enableWheel: boolean
    wheelSensitivity: number
  }
  shortcuts?: ShortcutOverrides
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: string) => void
}
```

## 6.2 runtime 生命周期接口

```ts
export interface LifecycleRuntime {
  start(): void
  update(config: WhiteboardLifecycleConfig): void
  stop(): void
}
```

## 6.3 instance 类型扩展

```ts
runtime: {
  // ...existing
  lifecycle: LifecycleRuntime
}
```

约束：

1. `start/stop` 幂等。
2. `update` 可在 `start` 前调用（先缓存配置，start 时应用）。
3. 所有回调引用内部用 ref 缓存，避免重复重绑事件。

---

## 7. useWhiteboardLifecycle 最终形态（目标）

目标是把 `useWhiteboardLifecycle` 压缩为“可读的流程文件”，例如：

```ts
export const useWhiteboardLifecycle = (props: Options) => {
  const { instance } = props
  const lifecycle = instance.runtime.lifecycle
  const config = useMemo(() => toLifecycleConfig(instance, props), [instance, props])

  useEffect(() => {
    lifecycle.start()
    return () => lifecycle.stop()
  }, [lifecycle])

  useEffect(() => {
    lifecycle.update(config)
  }, [lifecycle, config])
}
```

这份文件不再出现：

1. `addEventListener` 细节。
2. pointermove/wheel 逻辑细节。
3. edge connect 监听细节。
4. selection callback 的 useEffect 细节。

---

## 8. 模块职责边界（强约束）

## 8.1 React 层允许的内容

1. props -> config 映射。
2. start/stop 调用。
3. context hydration（保留）。

## 8.2 React 层禁止的内容

1. 业务输入处理逻辑（命中/节流/规则判断）。
2. window 事件条件绑定状态机。
3. selection/edge callback 的 state 差异判断与派发。

## 8.3 Runtime 层允许的内容

1. 使用 `instance.state.read/watch`。
2. 使用 `instance.commands` 写入。
3. 使用 `instance.runtime.events` 进行 DOM/window 绑定。

---

## 9. 分阶段迁移计划

### Phase A（低风险，先做）

状态：已完成。

1. 新增 `WhiteboardLifecycleRuntime` 壳子，支持 `start/update/stop`。
2. 将当前 `bindCanvasContainerEvents` 迁入 runtime/bindings。
3. `useWhiteboardLifecycle` 改为仅调用 runtime API，不再内联绑定细节。

### Phase B（核心下沉）

状态：已完成。

1. 将 `edge/lifecycle/useEdgeConnectLifecycle.ts` 完整迁入 runtime（基于 `state.watch('edgeConnect')` 控制 window 监听）。
2. 将 selection/edgeSelection 外部回调 bridge 迁入 runtime（基于 `state.watch`，并做回调重复触发抑制）。

### Phase C（目录收口）

状态：已完成（待最终收尾复核）。

1. 清空 `common/hooks/internal`（迁到 `common/instance/lifecycle/input`）。
2. 删除 `edge/lifecycle`（若无剩余职责）。
3. 更新导出与索引文件，统一命名规则。

### Phase D（收尾）

状态：进行中（D1 已完成，D2 待完成）。

1. 删除临时兼容 API（已完成）：
- 已移除 `*TransientAtom` 别名导出：`edgeConnectTransientAtom`、`dragGuidesTransientAtom`、`groupHoveredTransientAtom`、`nodeViewOverridesTransientAtom`。
- 已移除 `common/state/whiteboardAtoms.ts` 中历史别名导出：`interactionAtom`、`spacePressedAtom`、`toolAtom`、`nodeSelectionAtom`、`edgeSelectionAtom`、`historyAtom`、`edgeConnectAtom`。
- 已移除 `node/hooks/useSelection.ts` 中的 `selection` 聚合命名空间导出（保留 `useSelection*` 语义 hooks）。
- 已移除 `common/shortcuts/useShortcuts.ts` 兼容桥接 hook 及其索引导出。
2. 增补文档、回归测试清单、代码评审 checklist。

---

## 10. 验收标准

1. `useWhiteboardLifecycle.ts` 不超过 60 行，且只有“start/update/stop”可读流程。
2. `common/hooks/internal` 不再承载非 React 行为模块。
3. `edge/lifecycle` 不再包含 window 事件编排。
4. React 层无 `core.dispatch`、无复杂 pointer/wheel 业务逻辑。
5. `pnpm --filter @whiteboard/react lint` 通过。
6. 手工回归通过：
- 画布平移/缩放
- 框选
- edge connect（拖拽连线）
- edge hover
- shortcuts
- selection/edgeSelection 回调

---

## 11. 风险与注意事项

1. `state.watch` 迁移要注意初始触发行为，避免 mount 时重复触发外部回调。
2. window 事件绑定要保证 pointerId 过滤逻辑不退化。
3. lifecycle runtime 需要显式幂等，避免 `start` 被多次调用时重复绑定。
4. React StrictMode 下 mount/unmount 双调用需要稳定（不得残留监听器）。

---

## 12. 建议的命名规范（本次专项）

1. React hook：`useXxxLifecycleBridge` / `useXxxBridge`。
2. 纯工厂：`createXxxHandlers` / `bindXxx`。
3. 运行时类：`XxxRuntime`。
4. side-effect 服务：`XxxService`。
5. 禁止 `internal` 作为长期目录名，改为语义目录：`bindings` / `input` / `bridge`。
