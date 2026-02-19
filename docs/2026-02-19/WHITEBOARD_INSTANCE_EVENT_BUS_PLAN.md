# Whiteboard `instance.events` 统一方案（Engine 优先）

更新时间：2026-02-16  
范围：`packages/whiteboard-engine` + `packages/whiteboard-react`

## 1. 结论

完全统一到 `instance.events`：  
所有业务事件（selection/history/tool/viewport/doc 等）只通过 `instance.events` 暴露与订阅。

DOM 绑定职责统一下沉到 `engine host-dom`，由 lifecycle/input 消费。

---

## 2. 核心边界

1. `instance.events`：业务事件唯一入口（对外 API）。
2. `engine core`：`state/query/view/commands/events`，不依赖 DOM/React。
3. `engine host-dom`：容器/窗口 DOM 事件绑定与输入归一化（内部细节，不对外暴露）。
4. `react adapter`：挂载容器、调用 host attach/detach、渲染 UI。
5. `instance.commands`：唯一写入口，事件仅通知，禁止反向写状态。
6. 不新增 `instance.api`，保持当前项目约束。

说明：`onContainer/onWindow` 不属于 core，应该放在 `engine host-dom`，由 lifecycle/input 使用。

---

## 3. API 设计

## 3.1 对外形态（统一入口）

```ts
instance.events.on('selection.changed', handler)
instance.events.off('selection.changed', handler)
```

建议类型：

```ts
type Unsubscribe = () => void

type InstanceEvents<M> = {
  on<K extends keyof M>(type: K, listener: (payload: M[K]) => void): Unsubscribe
  off<K extends keyof M>(type: K, listener: (payload: M[K]) => void): void
}
```

## 3.2 内部发射原则

`emit` 只允许 engine 内部使用（lifecycle/watchers/services），不向业务调用方公开。  
实现可以放在 `instance/events` 模块，lifecycle/watchers 仅调用 emit。

---

## 4. DOM 输入内部化规范（Host 适配层）

1. DOM 监听能力从 `runtime` 公共类型中移除（删除 `runtime.events` 字段）。
2. 在 host-dom 层保留最小绑定能力：
   - `onContainer`
   - `onWindow`
   - 解绑函数管理
3. lifecycle/input 只消费 host-dom，不直接散落调用 `window.addEventListener`。
4. 禁止在 DOM 绑定层新增 `selection/tool/history` 等业务语义。
5. 生命周期层做桥接：DOM 输入 -> command/state -> `instance.events` 通知。
6. React/Vue 等宿主只需要提供容器引用，不直接依赖引擎内部 DOM 绑定 API。

---

## 5. 事件命名规范

1. 使用 `domain.changed` 或 `domain.phase`：
   - `selection.changed`
   - `node.drag.started|updated|ended|cancelled`
2. 不使用 `onXxx` 作为事件名；`on` 只用于订阅函数。
3. payload 一律对象，禁止裸值。
4. 名称短且可读，避免冗余前缀（不加 `whiteboard`）。

---

## 6. 事件清单

## 6.1 V1 核心稳定事件

1. `selection.changed`
2. `edge.selection.changed`
3. `tool.changed`
4. `viewport.changed`
5. `history.changed`
6. `mindmap.layout.changed`
7. `doc.changed`

示例：

```ts
type InstanceEventMap = {
  'selection.changed': { nodeIds: string[] }
  'edge.selection.changed': { edgeId?: string }
  'tool.changed': { tool: 'select' | 'edge' }
  'viewport.changed': { viewport: Viewport }
  'history.changed': { canUndo: boolean; canRedo: boolean; undoDepth: number; redoDepth: number }
  'mindmap.layout.changed': { layout: MindmapLayoutConfig }
  'doc.changed': { docId?: string; operationTypes: string[]; origin?: 'user' | 'system' | 'remote' }
}
```

## 6.2 V1.1 高频交互事件（按需开放）

1. `edge.connect.changed`
2. `node.drag.changed`
3. `node.transform.changed`
4. `mindmap.drag.changed`
5. `edge.routing.drag.changed`
6. `selection.box.changed`

---

## 7. 推荐目录

```text
packages/whiteboard-engine/src/instance/events/
  bus.ts            # 事件总线实现
  index.ts          # 对外 events 组装

packages/whiteboard-engine/src/types/instance/
  events.ts         # InstanceEventMap（类型定义）

packages/whiteboard-engine/src/host/dom/
  bindContainer.ts  # container DOM 绑定
  bindWindow.ts     # window DOM 绑定
  index.ts          # host-dom 组装（内部）

packages/whiteboard-engine/src/runtime/lifecycle/input/
  ...               # 仅消费 host-dom，编排输入生命周期

packages/whiteboard-engine/src/runtime/lifecycle/watchers/
  ...               # 监听 state/core 变更并 emit 到 instance.events
```

---

## 8. 与现有回调链路的迁移

当前待移除配置回调：

1. `onSelectionChange`
2. `onEdgeSelectionChange`

迁移后统一为：

1. `instance.events.on('selection.changed', ...)`
2. `instance.events.on('edge.selection.changed', ...)`

涉及文件：

1. `packages/whiteboard-engine/src/runtime/lifecycle/watchers/selectionEvents.ts`
2. `packages/whiteboard-engine/src/types/instance/lifecycle.ts`
3. `packages/whiteboard-engine/src/types/common/config.ts`
4. `packages/whiteboard-react/src/Whiteboard.tsx`

---

## 9. 迁移步骤（推荐顺序）

1. 增加 `instance.events`（先与旧回调并存）。
2. lifecycle/watchers 统一改为 `instance.events.emit(...)`。
3. 新建 `host/dom/*`，把 `onWindow/onContainer` 绑定逻辑从 runtime 公共面迁移到 host-dom。
4. lifecycle/input 改为只消费 host-dom 绑定能力。
5. 删除 `runtime.events` 类型与 `runtime/factory/events.ts` 对外组装。
6. React 移除配置回调透传；外部通过实例引用订阅 `instance.events`。
7. 移除 `onSelectionChange/onEdgeSelectionChange` 及对应类型。

---

## 10. 非目标

1. 不通过事件直接修改 state（写仍走 `commands`）。
2. 不暴露 DOM 绑定为长期公共 API。
3. 不一次性开放全部高频事件，优先核心稳定事件。

---

## 11. 与本次改造一起做（明确范围）

1. 本轮同步落地事件总线统一（`instance.events`）与 DOM 绑定下沉（`host-dom`）。
2. 不再保留“`runtime.events` 作为公共运行时能力”的兼容层。
3. React 保持薄适配：只做容器接入与渲染，不承载业务事件分发。
