# Whiteboard Hook 最简原则设计

## 目标

这份文档回答一个很具体的问题：

- `packages/whiteboard-react/src` 里的交互 hook 和 interaction runtime，是否拆得过多
- 在不牺牲行为清晰度和全局收尾能力的前提下，怎样把整条链路收成最少概念、最少文件、最少透传

这里的核心判断不是“职责拆得越细越好”，而是：

- 一个功能只有一个真实消费者时，不要为了结构对称拆出多层 hook
- 一个交互只有一套会话状态时，不要把 container/window 生命周期硬拆成多个文件
- feature 专属行为不要继续挂在全局 runtime 上
- 全局 runtime 只保留真正跨 feature 的协调能力

简化后的目标是：

- UI 侧仍然有稳定的 resolved interaction view
- feature 侧的交互逻辑尽量靠近 feature 自己
- hook 本身尽量短，但不为了短而把一个简单交互拆成三四个文件

---

## 总结结论

### 结论 1：`WhiteboardInteractionRuntime` 现在过重

当前 `runtime/interaction` 下承载了：

- node drag / transform
- selection box
- edge connect
- edge routing
- mindmap drag

这些逻辑大多不是“公共 runtime 基建”，而是 feature 专属行为。它们集中在 runtime 里会带来两个问题：

- `instance.interaction.xxx` 变成 feature 行为仓库，边界模糊
- feature hook 只剩一层薄薄的 lifecycle 包装，形成 `hook -> runtime -> feature math` 的长链

最优形态不是“把这些逻辑都塞回 hook 的 React state”，而是：

- 全局只保留一个极小的 interaction coordinator
- 各 feature 自己拥有自己的 session/controller
- hook 负责 lifecycle 绑定和返回 handlers

### 结论 2：不要为了“职责单一”过度拆 hook

像 `edge connect` 这类交互，业务本质非常简单：

- 记住 source / reconnect 起点
- 跟随 pointer 更新 transient preview
- pointer up 时 commit
- cancel 时清空 transient

对于这种只有一套会话状态、只有一个挂载点的交互，最优形态通常是：

- `useXxx.ts`
- `math.ts`
- 可选的 `session.ts`

而不是：

- `useXxx.ts`
- `useXxxContainer.ts`
- `useXxxWindow.ts`
- `runtime/interaction/xxx.ts`
- `types.ts`

除非 container 绑定和 window 绑定真的被多个 feature 复用，否则这种拆法只会增加阅读噪音。

### 结论 3：简化不是“全部塞进一个文件”

最简原则不等于“所有逻辑都回到一个巨型 hook”。

真正的判断标准应该是：

- 纯计算留在 `math.ts`
- 一套复杂 pointer 会话状态，可以抽一个 `session.ts`
- hook 只做组合和绑定
- 不再额外制造 `container/window/controller/runtime` 四层

换句话说：

- 简单交互：`useXxx.ts + math.ts`
- 中等交互：`useXxx.ts + session.ts + math.ts`
- 复杂交互：最多再多一个 feature 内部的 `types.ts`

再往上拆，大多数时候都不值。

---

## 最小全局基建应该保留什么

`runtime/interaction` 最终应该只保留真正跨 feature 的基础设施：

- `interactionLock.ts`
- `signal.ts`
- `useWindowPointerSession.ts`
- 一个极小的 `coordinator.ts`

### coordinator 的职责

全局 interaction coordinator 只做四件事：

- 维护当前 active interaction mode/session
- 提供 begin / end 语义
- 提供全局 `clear()`，供 `document.replace`、`dispose`、异常 reset 使用
- 作为 `runtime/view/interaction.ts` 的 mode 来源

它不应该再拥有：

- `node`
- `selection`
- `edgeConnect`
- `edgeRouting`
- `mindmapDrag`

也就是说，最终不应该再有这种结构：

```ts
instance.interaction.node
instance.interaction.selection
instance.interaction.edgeConnect
instance.interaction.edgeRouting
instance.interaction.mindmapDrag
```

而应该收成：

```ts
instance.interaction.session
instance.interaction.begin(...)
instance.interaction.end(...)
instance.interaction.clear()
```

或者更稳一点：

```ts
instance.interaction.tryStart(...)
instance.interaction.finish(...)
instance.interaction.clear()
instance.interaction.session
```

### 为什么 lock 必须继续全局保留

`interactionLock` 不能拆成 feature 私有锁。它必须继续是全局唯一互斥点，否则这些操作会互相打架：

- node drag
- selection box
- edge connect
- edge routing
- mindmap drag

因此：

- feature session 可以分散
- lock 必须集中

---

## 按最简原则看每条 hook 链

下面的判断以“最少文件数 + 保持逻辑完整链路”为标准。

### 1. Edge Connect

当前形态：

- `features/edge/hooks/connect/useEdgeConnect.ts`
- `runtime/interaction/edgeConnect.ts`
- `features/edge/hooks/connect/math.ts`

当前问题：

- 业务属于 edge feature，但主会话却放在 runtime
- hook 只剩生命周期包装，价值过低
- 链路变成 `useEdgeConnect -> instance.interaction.edgeConnect -> runtime logic -> math`

业务本质：

- 从 node / handle / endpoint 启动
- 维护一个 active connect session
- 更新 transient connection preview
- commit 为 `edge.create` 或 `edge.update`

这类交互不需要再拆 `useEdgeConnectContainer` / `useEdgeConnectWindow`。

#### 最优形态

- `features/edge/hooks/connect/useEdgeConnect.ts`
- `features/edge/hooks/connect/math.ts`
- 可选：`features/edge/hooks/connect/session.ts`

#### 推荐方案

如果需要全局 `clear()` 能取消它：

- 使用 `session.ts`
- `useEdgeConnect.ts` 内部取 instance-scoped session
- session 自己通过 interaction coordinator 报告 `edge-connect`

如果不强依赖 instance 级 reset：

- 可以直接把 session state 写在 `useEdgeConnect.ts` 的 `useRef` 里

#### 文件数结论

- 推荐 2 个文件
- 最多 3 个文件
- 不建议再继续细拆

---

### 2. Edge Routing

当前形态：

- `features/edge/hooks/routing/useEdgeRouting.ts`
- `runtime/interaction/edgeRouting.ts`

当前问题和 edge connect 一样：

- feature 专属行为放在 runtime
- hook 本身只是 lifecycle 壳

业务本质：

- 选中路由点
- pointer move 更新 routing preview
- pointer up commit
- escape / blur cancel

#### 最优形态

- `features/edge/hooks/routing/useEdgeRouting.ts`
- 可选：`features/edge/hooks/routing/session.ts`

如果 routing 纯计算比较少，可以连 `math.ts` 都不需要；如果后续会继续长大，再补。

#### 文件数结论

- 推荐 1 到 2 个文件
- 不建议拆 `useEdgeRoutingWindow.ts`

---

### 3. Selection Box

当前形态：

- `ui/canvas/input/CanvasSelectionInput.tsx`
- `ui/canvas/input/useSelectionBoxInteraction.ts`
- `runtime/interaction/selection.ts`

当前问题：

- 选择框属于 canvas input feature，不属于公共 runtime
- `CanvasSelectionInput.tsx` 和 `useSelectionBoxInteraction.ts` 之间的分工价值偏低
- runtime 里承载了完整业务，而输入组件只剩一次 pointerdown 绑定

业务本质：

- 只在 idle + 非 edge tool 时允许启动
- pointer move 时更新 selection draft
- rAF flush selection
- pointer up 时提交 selection 结果

#### 最优形态

推荐直接收成：

- `ui/canvas/input/useSelectionBox.ts`
- 可选：`ui/canvas/input/selectionBoxSession.ts`

如果 `CanvasSelectionInput.tsx` 只负责“挂一个 useSelectionBox(containerRef)”而没有别的逻辑，它可以直接被删掉。

也就是说：

- 不是 `InputFeature -> CanvasSelectionInput -> useSelectionBoxInteraction -> runtime`
- 而是 `InputFeature -> useSelectionBox`

#### 文件数结论

- 推荐 1 到 2 个文件
- `CanvasSelectionInput.tsx` 这种纯壳组件可以删除

---

### 4. Mindmap Drag

当前形态：

- `features/mindmap/hooks/drag/useMindmapDrag.ts`
- `runtime/interaction/mindmapDrag.ts`
- `features/mindmap/hooks/drag/math.ts`

这条链其实很接近 edge connect 的问题：

- 主业务在 runtime
- hook 很薄
- 计算已经在 feature 下

业务本质：

- root drag 或 subtree drag
- pointer move 更新 transient mindmap draft
- pointer up commit root move 或 subtree drop

#### 最优形态

- `features/mindmap/hooks/drag/useMindmapDrag.ts`
- `features/mindmap/hooks/drag/math.ts`
- 可选：`features/mindmap/hooks/drag/session.ts`

#### 文件数结论

- 推荐 2 个文件
- 最多 3 个文件

---

### 5. Node Drag / Transform

当前形态：

- `features/node/hooks/useNodeInteractions.ts`
- `runtime/interaction/node.ts`
- `features/node/hooks/drag/math.ts`
- `features/node/hooks/transform/math.ts`

这一块和前几条不一样。当前 `runtime/interaction/node.ts` 约 438 行，是当前最重的一块，而且实际混了两套不同会话：

- node drag
- node transform

这也是为什么它不能像 edge connect 一样简单“塞回一个 hook”。

业务复杂度来自：

- selection 参与
- container scope 参与
- group resize 特殊提交
- node draft / guides draft 都参与
- drag 与 transform 的行为边界不同

#### 最优形态

不建议继续维持单个 `node.ts` runtime，也不建议把全部逻辑直接塞回 `useNodeInteractions.ts`。

推荐收成：

- `features/node/hooks/useNodeInteractions.ts`
- `features/node/hooks/drag/session.ts`
- `features/node/hooks/drag/math.ts`
- `features/node/hooks/transform/session.ts`
- `features/node/hooks/transform/math.ts`

这里的关键不是“多文件”，而是“按真实会话拆边界”：

- drag 是一套 session
- transform 是另一套 session

`useNodeInteractions.ts` 自己只负责：

- 取两个 session
- 绑定 window pointer session
- 返回 `handleNodePointerDown / handleNodeDoubleClick / handleTransformPointerDown`

#### 文件数结论

- 推荐 5 个文件左右
- 这里不适合追求 2 文件极简
- 但必须把 `runtime/interaction/node.ts` 拆掉

---

## 非 pointer session 的 hook / 输入链也应按最简原则处理

### 6. Canvas Context Menu

当前形态：

- `ui/canvas/input/CanvasContextMenuInput.tsx`

这块反而已经接近最优：

- 只有一个组件
- 业务完整链路都在一个文件里
- 没有额外 hook 壳

它做的事情也确实集中：

- `pointerdown` 右键拦截
- `contextmenu` 兜底
- duplicate open 去重
- 调 `contextMenuOpenResult` 解析结果
- 调 surface commands 打开菜单

#### 结论

- 这块不要再拆
- 只需在未来如果内部继续膨胀，再抽 1 到 2 个小纯函数

### 7. Shortcut Input

当前形态：

- `ui/canvas/input/ShortcutInput.tsx`
- `runtime/interaction/shortcutBindings.ts`
- `runtime/interaction/shortcutDispatch.ts`

这里真正的问题不是“hook 太多”，而是文件归属略有点怪。

`ShortcutInput.tsx` 本身已经是很好的最简形态：

- 识别 chord
- 查 binding
- dispatch action

更合理的目录形态应该是：

- `ui/canvas/input/ShortcutInput.tsx`
- `ui/canvas/input/shortcutBindings.ts`
- `ui/canvas/input/shortcutDispatch.ts`

也就是说可以挪目录，但不需要再拆更多文件。

#### 结论

- 结构已经够简单
- 不要为了“统一交互系统”把它挂到 coordinator 下

### 8. Node Toolbar Surface

当前形态：

- `ui/canvas/surface/NodeToolbarSurface.tsx`

这块当前是一个大组件，但它不是 session runtime，不应该套用 pointer session 的拆法。

最简原则下，这里真正应该控制的是：

- 不要引入更多聚合 hook
- 不要再制造 `useToolbarOpen -> useToolbarPlacement -> useToolbarDismiss` 这种过长链路

它最适合的形态是：

- 维持一个主组件
- 仅在必要时抽小纯函数：
  - placement 计算
  - menu render switch
  - click-outside close

#### 结论

- 不必拆成一堆 hook
- 组件内保留完整交互链路更好读

---

## 最优目录建议

### 全局 interaction 基建

建议最终只保留：

- `packages/whiteboard-react/src/runtime/interaction/coordinator.ts`
- `packages/whiteboard-react/src/runtime/interaction/interactionLock.ts`
- `packages/whiteboard-react/src/runtime/interaction/signal.ts`
- `packages/whiteboard-react/src/runtime/interaction/useWindowPointerSession.ts`
- `packages/whiteboard-react/src/runtime/interaction/types.ts`

### Edge

- `packages/whiteboard-react/src/features/edge/hooks/connect/useEdgeConnect.ts`
- `packages/whiteboard-react/src/features/edge/hooks/connect/math.ts`
- 可选：`packages/whiteboard-react/src/features/edge/hooks/connect/session.ts`

- `packages/whiteboard-react/src/features/edge/hooks/routing/useEdgeRouting.ts`
- 可选：`packages/whiteboard-react/src/features/edge/hooks/routing/session.ts`

### Selection Box

- `packages/whiteboard-react/src/ui/canvas/input/useSelectionBox.ts`
- 可选：`packages/whiteboard-react/src/ui/canvas/input/selectionBoxSession.ts`

### Mindmap

- `packages/whiteboard-react/src/features/mindmap/hooks/drag/useMindmapDrag.ts`
- `packages/whiteboard-react/src/features/mindmap/hooks/drag/math.ts`
- 可选：`packages/whiteboard-react/src/features/mindmap/hooks/drag/session.ts`

### Node

- `packages/whiteboard-react/src/features/node/hooks/useNodeInteractions.ts`
- `packages/whiteboard-react/src/features/node/hooks/drag/math.ts`
- `packages/whiteboard-react/src/features/node/hooks/drag/session.ts`
- `packages/whiteboard-react/src/features/node/hooks/transform/math.ts`
- `packages/whiteboard-react/src/features/node/hooks/transform/session.ts`

### Input / Surface

- `packages/whiteboard-react/src/ui/canvas/input/CanvasContextMenuInput.tsx`
- `packages/whiteboard-react/src/ui/canvas/input/ShortcutInput.tsx`
- `packages/whiteboard-react/src/ui/canvas/input/shortcutBindings.ts`
- `packages/whiteboard-react/src/ui/canvas/input/shortcutDispatch.ts`
- `packages/whiteboard-react/src/ui/canvas/surface/NodeToolbarSurface.tsx`

---

## 文件数量判断规则

为了避免以后再次过度设计，建议明确一个简单规则。

### 一个交互是否需要单独 `session.ts`

满足以下任一条件时，值得有 `session.ts`：

- 需要 instance 级 `clear()` / reset / dispose 时统一取消
- 会话状态明显超过 4 到 5 个字段，并且包含 begin/update/commit/cancel
- 同一个 feature 内会被多个 UI 挂载点读取

否则，直接放回 `useXxx.ts`。

### 一个交互是否值得拆 `useXxxContainer` / `useXxxWindow`

只有在这些条件下才值得拆：

- container 和 window 绑定逻辑分别被多个调用点共享
- 一个文件里已经出现两套独立生命周期，互相干扰阅读
- 拆开后能明显减少重复代码，而不是仅仅让文件名更“规范”

默认情况下一律不拆。

### 一个功能是否应该继续留在 runtime

只有在这些条件下才应该留在 runtime：

- 它是跨 feature 的公共协调能力
- 它不属于某个单独 feature 的业务语义
- 它被多个 feature 共享而且共享价值明确

否则，下沉回 feature。

---

## 建议的迁移顺序

按风险从低到高：

1. 先把 `runtime/interaction` 收成 coordinator
2. 拆 `edgeConnect`
3. 拆 `edgeRouting`
4. 拆 `selectionBox`
5. 拆 `mindmapDrag`
6. 最后拆 `node drag / transform`
7. 顺手把 `shortcutBindings.ts` / `shortcutDispatch.ts` 挪出 `runtime/interaction`

原因：

- `edgeConnect` 和 `mindmapDrag` 已经明显依赖 feature 自己的 math，收益高
- `selectionBox` 属于 canvas input，自然应该回到 input
- `node.ts` 最大，最后拆更稳

---

## 最终原则

可以把这份文档压成一句设计准则：

> feature 专属交互留在 feature，runtime 只保留全局协调；简单交互保持一个 hook 完整讲清链路，不为结构整齐额外拆层。

再展开成三条执行原则：

- 一个交互只有一套会话状态时，优先 `useXxx.ts + math.ts`
- 只有需要 instance 级 reset 时，才补 `session.ts`
- 不要再让 `instance.interaction.xxx` 成为 feature 行为集合

