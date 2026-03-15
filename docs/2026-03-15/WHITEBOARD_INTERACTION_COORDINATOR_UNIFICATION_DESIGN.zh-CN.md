# WHITEBOARD Interaction Coordinator Unified Design

## 1. 背景

当前 `packages/whiteboard-react/src/runtime/interaction` 下实际并存两套机制：

1. `coordinator`
   - 负责当前 interaction `mode`
   - 负责 `tryStart / finish / clear`
2. `interactionLock`
   - 负责全局互斥
   - 通过 `lockOwner` 把 viewport gesture 与其他 session 绑定到同一锁域

这套设计能工作，但长期存在几个持续性的结构问题：

- `mode` 和 `lock` 不是同一事实源
- `idle` 不一定真的空闲，因为可能只是 `mode` 空闲、但锁已被占用
- `Whiteboard.tsx` 需要显式持有 `lockOwner`
- session 开始/结束需要同时处理 `tryAcquire/release` 与 `tryStart/finish`
- reset/cancel 会跨两套系统清理
- viewport 与其他交互的互斥关系隐藏在 `lockOwner` identity 里，语义不直观

本文档给出长期最优模型：

> 彻底移除独立的 `interactionLock` 体系，把 exclusivity 并入唯一的 `InteractionCoordinator`。

---

## 2. 目标

### 2.1 最终目标

一个 whiteboard 只保留一个全局 interaction runtime：

- 同一时刻最多只有一个 active interaction
- `mode` 与 exclusivity 来自同一个 coordinator
- `idle` 必须意味着真正没有 active session
- `viewport-gesture` 是一个真实的 primary interaction mode
- `auto-pan` 不是第二个 interaction，而是当前 session 的 effect
- 删除 `interactionLock.ts`
- 删除 `lockOwner`

### 2.2 非目标

本次设计不做以下事情：

- 不引入复杂状态机框架
- 不把所有 feature session 都上收成统一 mega runtime API
- 不把 drag / resize / routing 的具体数学逻辑塞进 coordinator
- 不把所有 interaction 元数据都暴露给 UI

coordinator 的职责应该保持非常窄，只做：

- 唯一 active session 生命周期
- `mode` store
- session spec
- cancel / reset 协调

---

## 3. 核心结论

### 3.1 最重要的原则

> 一个 board 同时只能有一个 primary interaction session。

这个 primary session 负责：

- 占用输入通道
- 决定当前 `InteractionMode`
- 驱动自己的 draft / preview / commit
- 选择性触发附属 effect，例如 auto-pan

### 3.2 `viewport` 移动不等于 `viewport-gesture`

统一模型里最关键的边界是：

存在两种 viewport 变化：

1. **Direct Viewport Interaction**
   - 用户直接进行平移/缩放
   - 例如 middle button drag、space + drag、wheel / trackpad zoom
   - 这时 primary mode 才是 `viewport-gesture`

2. **Viewport Auto-Pan During Session**
   - viewport 是当前 session 的副作用
   - 例如 node drag 接近边缘时自动滚动画布
   - 这时 primary mode 仍然是 `node-drag`

因此：

- `node-drag + auto-pan` 不是两个 interaction 并发
- 而是一个 `node-drag` session 内部驱动了 viewport effect

这个原则必须固定下来，否则统一模型会重新退化成两套含义。

---

## 4. 最终模型

### 4.1 对外模型

UI 与大多数调用方只需要一个极简事实：

```ts
type InteractionMode =
  | 'idle'
  | 'viewport-gesture'
  | 'selection-box'
  | 'node-drag'
  | 'mindmap-drag'
  | 'node-transform'
  | 'edge-connect'
  | 'edge-routing'
```

对外继续暴露：

- `coordinator.mode: ReadStore<InteractionMode>`
- `useInteraction(): InteractionMode`

对 UI 来说：

- chrome 是否显示
- 当前是否空闲
- 是否屏蔽右键菜单
- 是否隐藏某些 affordance

这些判断都直接从 `mode` 派生。

### 4.2 对内模型

coordinator 内部不应只存一个字符串，而应维护一个完整 active session：

```ts
type InteractionSpec = {
  menu: 'allow' | 'block'
  viewport: 'allow' | 'block'
  pan: 'none' | 'viewport'
}
```

```ts
type ActiveInteraction = {
  token: InteractionToken
  mode: Exclude<InteractionMode, 'idle'>
  cancel: () => void
  pointerId?: number
  spec: InteractionSpec
}
```

其中：

- `mode` 是对外主语义
- `pointerId` 用于 session 内 guard
- `spec` 只服务 runtime 规则，不给 UI 扩张成一个大而全 view

### 4.3 单一事实源

最终只有一个事实源：

- `current() === null` -> `mode = 'idle'`
- `current() !== null` -> `mode = current().mode`

不再允许：

- 一个地方说 `idle`
- 另一个地方说“锁已被占用”

---

## 5. Coordinator 职责

### 5.1 应该做的

最终 `InteractionCoordinator` 只做五件事：

1. 维护唯一 active session
2. 对外暴露 `mode`
3. 提供 `tryStart`
4. 提供 `finish`
5. 提供 `cancel`

### 5.2 不应该做的

coordinator 不应该：

- 直接做 drag / resize / routing 数学
- 管理具体 draft patch 结构
- 绑定 DOM/window 事件
- 直接执行 auto-pan 计算
- 派生大而全 interaction view 给 UI

这些应该仍然留在各自 session runtime 或 feature hook 中。

---

## 6. 推荐 API

### 6.1 基础类型

```ts
export type InteractionMode =
  | 'idle'
  | 'viewport-gesture'
  | 'selection-box'
  | 'node-drag'
  | 'mindmap-drag'
  | 'node-transform'
  | 'edge-connect'
  | 'edge-routing'

export type InteractionSpec = Readonly<{
  menu: 'allow' | 'block'
  viewport: 'allow' | 'block'
  pan: 'none' | 'viewport'
}>

export type InteractionToken = Readonly<{
  id: number
}>
```

### 6.2 Coordinator API

```ts
export type InteractionCoordinator = {
  mode: ReadStore<InteractionMode>
  current: () => ActiveInteraction | null
  tryStart: (input: {
    mode: Exclude<InteractionMode, 'idle'>
    cancel: () => void
    pointerId?: number
  }) => InteractionToken | null
  finish: (token: InteractionToken) => void
  cancel: () => void
}
```

### 6.3 设计说明

这里推荐 `tryStart({ ... })`，而不是 `tryStart(mode, cancel)`，原因如下：

- `pointerId` 一定会进入启动协议
- 位置参数会逐步膨胀
- 对象参数更易读，也更稳定

但 `tryStart` 不应再接 `spec` 参数。

原因是：

- 绝大多数运行规则是由 `mode` 固定决定的
- 如果每个调用点都重复传 `spec`，最终会出现重复与不一致
- 更合理的做法是：`mode -> spec` 由 coordinator 内部静态映射

即：

```ts
const specByMode: Record<ActiveInteractionMode, InteractionSpec>
```

调用点只声明：

- 我想开始哪个 `mode`
- 它的 `cancel`
- 可选 `pointerId`

而不需要每次手动拼装规则。

---

## 7. `spec` 的设计

### 7.1 为什么要用 `spec`

这里不推荐继续使用：

- `capabilities`
- `ownsPointer`
- `blocksContextMenu`
- `blocksViewportGesture`
- `autoPan`

原因：

- `capabilities` 这个词偏泛，显得过重
- 一组 `owns / blocks / auto` 风格字段整体太长
- 布尔命名经常带来正反值阅读成本

更短、更稳的一版应该是：

```ts
type InteractionSpec = {
  menu: 'allow' | 'block'
  viewport: 'allow' | 'block'
  pan: 'none' | 'viewport'
}
```

这组名字的特点是：

- 短
- 一眼能看出是 runtime 规则
- 值的方向明确，不依赖布尔语义猜测

### 7.2 为什么不用 `pan: boolean`

不建议写成：

```ts
pan: boolean
```

原因：

- `true` 到底代表什么不够直接
- 未来一旦出现其他 pan 目标，会继续扩字段
- `'none' | 'viewport'` 当前复杂度几乎没有增加，但语义更清楚

所以推荐：

```ts
pan: 'none' | 'viewport'
```

### 7.3 推荐默认值

```ts
const DEFAULT_SPEC: InteractionSpec = {
  menu: 'block',
  viewport: 'block',
  pan: 'none'
}
```

不同 mode 只覆盖需要变化的字段。

### 7.4 推荐 `specByMode`

```ts
const specByMode = {
  'viewport-gesture': {
    menu: 'block',
    viewport: 'block',
    pan: 'none'
  },
  'selection-box': {
    menu: 'block',
    viewport: 'block',
    pan: 'viewport'
  },
  'node-drag': {
    menu: 'block',
    viewport: 'block',
    pan: 'viewport'
  },
  'mindmap-drag': {
    menu: 'block',
    viewport: 'block',
    pan: 'viewport'
  },
  'node-transform': {
    menu: 'block',
    viewport: 'block',
    pan: 'none'
  },
  'edge-connect': {
    menu: 'block',
    viewport: 'block',
    pan: 'viewport'
  },
  'edge-routing': {
    menu: 'block',
    viewport: 'block',
    pan: 'viewport'
  }
} satisfies Record<ActiveInteractionMode, InteractionSpec>
```

这里的 `viewport: 'block'` 表示：

- 当当前 session 活跃时，不允许 direct viewport gesture 再开始

它不表示：

- viewport 不能被当前 session 自己通过 auto-pan 推动

---

## 8. Auto-Pan 的最终定位

### 8.1 Auto-Pan 不是 mode

`auto-pan` 不应该有自己的 `InteractionMode`。

原因：

- 它只是某个 active session 的 effect
- 它不会取代当前 primary interaction
- UI 也不需要“当前是否 auto-pan 中”作为一级语义

### 8.2 Auto-Pan 也不应该并进 coordinator 逻辑

coordinator 只声明：

- 这个 session 的 `spec.pan` 是什么

它不负责：

- 具体滚动计算
- 边缘阈值
- 滚动速度

也就是说：

- coordinator 说：当前 session `pan = 'viewport'`
- 具体 session runtime 说：当前 pointer 接近边缘，需要触发 pan
- auto-pan runtime 说：根据 screen-space 边界与速度规则，给出 viewport delta

### 8.3 推荐拆分

长期最优是三层分离：

1. `InteractionCoordinator`
   - active session
   - exclusivity
   - mode
   - spec

2. `ViewportController`
   - direct viewport gesture
   - viewport 数学
   - viewport store / clientToScreen / screenToWorld

3. `InteractionAutoPan`
   - 给 active session 复用的边缘滚动运行模块

### 8.4 Auto-Pan 的触发规则

auto-pan 应使用 **screen-space** 规则，而不是 world-space：

- 触发阈值按容器边缘像素计算
- 速度按离边缘距离或分段曲线计算
- zoom 不应改变触发区的人体感知大小

推荐流程：

1. 读取 pointer screen / client 位置
2. 判断是否进入边缘 pan zone
3. 计算 screen-space delta
4. `viewport.panBy(...)`
5. 再以新的 viewport 重新计算当前 session preview

---

## 9. `viewport-gesture` 的最终语义

必须严格定义：

> `viewport-gesture` 只表示“用户当前正在直接操控 viewport”。

它不表示：

- viewport 发生了变化
- viewport 正在被别的 session 带动
- wheel / auto-pan / animation 任意一种画面移动

因此：

- `node-drag + auto-pan` 的 mode 仍然是 `node-drag`
- `selection-box + auto-pan` 的 mode 仍然是 `selection-box`
- 只有 middle drag / space drag / direct zoom 这样的 direct gesture 才是 `viewport-gesture`

这个定义可以彻底避免“拖拽时 viewport 也在动，到底该算哪个 mode”的歧义。

---

## 10. Runtime 行为示例

### 10.1 Node Drag

开始：

1. pointerdown 命中 node
2. session 逻辑构造 drag state
3. `coordinator.tryStart({ mode: 'node-drag', pointerId, cancel })`
4. 成功后进入 active session

更新：

1. pointermove
2. drag session 计算 preview / snap / guides
3. 若 pointer 接近边缘，则 auto-pan runtime 计算 delta
4. `instance.viewport.panBy(delta)`
5. 继续以新的 viewport / pointer 状态更新 drag preview

结束：

1. commit
2. `coordinator.finish(token)`

### 10.2 Viewport Gesture

开始：

1. middle button drag 或 space + drag
2. `coordinator.tryStart({ mode: 'viewport-gesture', pointerId, cancel })`
3. 成功后 viewport controller 开始处理 pan

更新：

1. pointermove
2. viewport controller 直接 pan

结束：

1. `coordinator.finish(token)`

### 10.3 Reset / Replace Document

当 document replace 或 runtime reset 时：

1. `coordinator.cancel()`
2. 当前 active session 的 `cancel` 被调用
3. 具体 session 清理 draft / pointer / preview
4. coordinator 回到 `idle`

这里不再需要额外 `interactionLock.forceReset(...)`

---

## 11. 为什么这是长期最优

### 11.1 单一事实源

当前交互是否活跃、谁占用输入、当前 mode 是什么，全部来自一个 active session。

### 11.2 `idle` 语义干净

`idle` 不再是“view 说 idle，但 lock 其实被占用”这种半真半假的状态。

### 11.3 Whiteboard 装配层更干净

`lockOwner` 消失后，`Whiteboard.tsx` 不再承担 runtime 锁域 identity 的装配职责。

### 11.4 生命周期闭环

开始 / 结束 / cancel / reset 全部走同一套 coordinator 协议。

### 11.5 更容易测

从“外部 WeakMap + object identity”收敛成“显式 active session”后，行为可以直接围绕 coordinator 编写单测。

---

## 12. 为什么不建议保留现状

不建议长期保留：

- `coordinator` 只管 mode
- `interactionLock` 只管 exclusivity
- `viewport` 通过 `lockOwner` 间接共享锁

即使把命名改漂亮，这也仍然是两套系统：

- 一套描述“当前是什么模式”
- 一套描述“当前谁有交互排他权”

这会导致后面每次扩展新 interaction，都要同时考虑两套协议。

---

## 13. 为什么不建议让 UI 直接读 session 细节

可以让 UI 直接读 `current()` 再自己判断，但不推荐。

原因：

- UI 真正需要的是稳定的一阶语义
- `mode` 是最合适的 UI 契约
- `spec` 更适合 runtime 内部使用

因此推荐：

- UI 只用 `mode`
- runtime session 使用 `spec`
- 若以后个别 UI 确有需要，再追加极少量专门 selector，而不是直接暴露整份 session

---

## 14. 包边界建议

### 14.1 短期建议

先保留在：

- `packages/whiteboard-react/src/runtime/interaction/*`

原因：

- 当前所有消费者都在 react runtime
- 先把模型统一比先抽 package 更重要

### 14.2 中长期建议

当 store/runtime primitive 进一步稳定后，可以考虑：

- `@whiteboard/core/runtime` 提供通用 coordinator primitive
- `@whiteboard/react` 只定义 whiteboard 专属 `InteractionMode`

但不建议在模型尚未统一前就提前抽象。

---

## 15. 最终目录目标

长期目标下，`runtime/interaction` 可收敛成极小基建：

```txt
runtime/interaction/
  coordinator.ts
  types.ts
  autoPan.ts
  useWindowPointerSession.ts
```

删除：

```txt
runtime/interaction/interactionLock.ts
```

其中：

- `coordinator.ts`：唯一 active session 协调
- `types.ts`：mode / token / active / spec
- `autoPan.ts`：通用 auto-pan 运行模块
- `useWindowPointerSession.ts`：window pointer 生命周期绑定工具

---

## 16. 迁移计划

### Phase 1：Session 化 Coordinator

目标：

- coordinator 内部从“只存 mode”升级为“存 active interaction”
- `tryStart` 改成对象参数
- 增加 `current()`
- `mode` 仍保持现有对外接口

此阶段不删 `interactionLock`，只是让 coordinator 先具备承载 exclusivity 的能力。

### Phase 2：把 `viewport-gesture` 纳入 mode

目标：

- `InteractionMode` 新增 `viewport-gesture`
- viewport direct gesture 通过 coordinator 启动/结束

此阶段仍可暂时保留 `interactionLock` 作为兼容护栏，但 viewport 已开始走 coordinator。

### Phase 3：删除 `interactionLock`

目标：

- 所有 session 都只通过 coordinator 竞争 active interaction
- 删除 `lockOwner`
- 删除 `interactionLock.ts`
- reset / cancel 改成只走 coordinator

### Phase 4：引入 `autoPan` runtime

目标：

- 把 selection-box / node-drag / edge-connect / edge-routing / mindmap-drag 的边缘滚动逻辑收敛到一个复用模块
- coordinator 只保留 `spec.pan` 声明

### Phase 5：文档与测试收口

补齐：

- coordinator 行为单测
- viewport-gesture 与 node-drag 互斥测试
- drag + auto-pan 保持 `mode = node-drag` 的测试
- document replace / dispose 时 cancel 清理测试

---

## 17. 关键测试用例

### 17.1 Exclusivity

- `node-drag` 活跃时，`selection-box` 无法开始
- `viewport-gesture` 活跃时，`node-drag` 无法开始
- `edge-connect` 活跃时，context menu 不应打开

### 17.2 Mode Correctness

- 无 active interaction -> `mode = idle`
- viewport direct pan -> `mode = viewport-gesture`
- node drag -> `mode = node-drag`
- node drag 期间 auto-pan -> `mode` 仍然是 `node-drag`

### 17.3 Cancel / Reset

- `document.replace` 会 cancel 当前 active interaction
- `dispose` 会 cancel 当前 active interaction
- blur / pointercancel / Escape 能正确清理

### 17.4 Pointer Guard

- pointerId 不匹配时 session update 不应生效
- finish 非当前 token 时不应错误清理

---

## 18. 一句话总结

长期最优模型不是“给现有 lock 包一层更好看的名字”，而是：

> 让 `InteractionCoordinator` 成为唯一 active interaction 的单一事实源，`viewport-gesture` 成为真实 primary mode，`pan` 作为当前 session 的 spec，而不是第二套 lock / mode 系统。

最终结果应该是：

- 一个 board，一个 coordinator
- 一个时刻，一个 primary interaction
- 一个对外 mode
- 一套开始/结束/取消协议
- 零 `lockOwner`
- 零 `interactionLock`

