# Whiteboard Pointer Handler 下沉到 Editor 的收敛改造方案

## 1. 文档目标

这份文档回答一个更具体的问题：

- `pointerdown` 这条链路里，真正的交互 handler 应该放在 `whiteboard-editor` 还是 `whiteboard-react`
- 如果决定继续收口，应该怎么改，才能把概念和边界都压到最少

本文聚焦的文件：

- `packages/whiteboard-editor/src/runtime/input/pointer.ts`
- `packages/whiteboard-editor/src/runtime/instance/createInstance.ts`
- `packages/whiteboard-react/src/canvas/useCanvasDown.ts`
- `packages/whiteboard-react/src/runtime/input/pointer.ts`
- `packages/whiteboard-react/src/features/draw/useDrawInput.ts`
- `packages/whiteboard-react/src/features/draw/useEraserInput.ts`
- `packages/whiteboard-react/src/features/toolbox/useInsertDown.ts`
- `packages/whiteboard-react/src/features/edge/hooks/useEdgeInput.ts`
- `packages/whiteboard-react/src/features/mindmap/hooks/drag/useMindmapDrag.ts`

---

## 2. 结论先行

结论很明确：

- `InteractionStart -> InteractionDecision` 的判定层应该放在 `editor`
- 真正执行 `edgeCreate / erase / draw / insert / transform / edge / mindmap / selection` 的 handler，也应该放在 `editor`
- `react` 只保留 DOM 事件绑定、React 生命周期清理、视觉状态读取和渲染适配

也就是说，最简边界不应该是：

1. React 监听 `pointerdown`
2. editor 读取 `start`
3. editor 解析 `decision`
4. React 再维护一套 handler map 去 dispatch

而应该是：

1. React 监听 `pointerdown`
2. editor 完成 `read -> resolve -> run`
3. React 只做事件接入和视觉呈现

一句话概括：

**交互判定和交互执行都属于 editor runtime；React 不应该成为交互行为的二次调度层。**

---

## 3. 当前问题到底在哪里

当前最大的问题不是 `useCanvasDown` 这个文件本身，而是职责被切成了一个不上不下的状态。

现在的实际链路大致是：

1. `useCanvasDown` 监听容器 `pointerdown`
2. React 调 `readInteractionStart(...)`
3. React 调 `resolveInteractionDecision(...)`
4. React 再调 `dispatchInteractionDecision(...)`
5. React 传入一组 handler map
6. 真正的行为实现散落在 React hooks 和 editor host controller 里

这会产生三个问题。

### 3.1 editor 只做了一半

`pointer.ts` 已经知道：

- 当前 tool 是什么
- 当前 pick 命中了什么
- 当前 frame 是否有效
- 当前 interaction 是否 busy
- 这次 down 最终应该交给谁

但它在得到 `decision` 之后没有继续执行，而是把执行权交还给了 React。

这意味着 editor 只拥有“判定权”，不拥有“执行权”。

这不是一个稳定边界。

### 3.2 React 被迫承担无意义的转发职责

当前 `useCanvasDown.ts` 里的这一圈：

- `edgeCreate: edge.create`
- `erase: eraser.down`
- `draw: draw.down`
- `insert: insert.down`
- `transform: transform.down`
- `edge: edge.down`
- `mindmap: mindmap.down`
- `selection: gesture.down`

看起来像“编排层”，但本质上只是一个把 `decision.kind` 再翻译一遍的转发表。

这层不是 UI 组合，也不是视觉逻辑，而是在承担 runtime 路由职责。

### 3.3 抽象多了一层，但没有换来真正解耦

当前 editor 导出了：

- `readInteractionStart`
- `resolveInteractionDecision`
- `dispatchInteractionDecision`

看起来像三段式抽象。

但最后一段 `dispatchInteractionDecision` 并没有拥有任何真正行为，它只是再做一次 `switch(decision.kind)`，然后把调用转回外面传进来的 handler。

这意味着：

- editor 没有真正把执行封起来
- React 也没有真正得到自由，它仍然得维护完整行为集合

所以这层 `dispatch` 是一层中空抽象。

---

## 4. 为什么 handler 应该放在 editor

判断 handler 应该归哪一层，不是看它从哪里被调用，而是看它在做什么。

当前这些 handler 真正在做的事包括：

- 启动 interaction session
- 调用 `instance.commands.*`
- 读写 `instance.host.*` runtime
- 处理 selection / transform / edge / draw / insert 的行为流
- 控制 frame 内 owner / pick / snap / route / reconnect 等运行时逻辑

这些都不是 React 的职责。

React 真正该拥有的是：

- `addEventListener` / `removeEventListener`
- `useEffect` 清理
- 视觉预览读取
- 组件渲染
- 必要时把 editor 的只读状态映射成 props / style / JSX

所以边界应当是：

### 4.1 editor 负责行为

- 输入读取
- 交互判定
- 交互执行
- session 启停
- commands 写入
- runtime host 协调

### 4.2 react 负责宿主接入

- DOM 事件接入
- 生命周期绑定
- 将 editor 中的 preview / snapshot / read state 渲染成 UI

如果继续让 React 保留这组 handler map，会持续出现两个后果：

1. editor 和 react 之间的交互边界始终是半截的
2. 每次新增一个 interaction kind，都要同时改 editor decision 和 react dispatch map

这正是应该被消掉的复杂度。

---

## 5. 目标形态

最简目标形态应该是一个单入口。

例如：

```ts
export const handlePointerDown = (
  instance: Editor,
  container: HTMLDivElement,
  event: PointerEvent
) => {
  const start = readInteractionStart(instance, container, event)
  const decision = resolveInteractionDecision(instance, start)
  return runInteractionDecision(instance, decision)
}
```

这里有三个重点。

### 5.1 `read` 和 `resolve` 仍然保留

它们是好抽象：

- 好测
- 好推理
- 可以单独用于调试

所以不必删除。

### 5.2 `dispatch` 不再对外暴露

取而代之的是 editor 内部的 `runInteractionDecision(...)`。

它不是一个“把 handler map 传进来”的通用调度器，而是 editor 自己拥有真实行为实现。

### 5.3 React 只调用一个入口

React 最后应该只保留类似：

```ts
const onPointerDown = (event: PointerEvent) => {
  const container = containerRef.current
  if (!container) {
    return false
  }

  return handlePointerDown(instance, container, event)
}
```

这样 `useCanvasDown.ts` 就会从“运行时调度器”退回成“事件绑定入口”。

---

## 6. 目标职责切分

## 6.1 editor 内部应拥有的内容

editor 应拥有：

- `InteractionStart`
- `InteractionDecision`
- `resolveInteractionDecision(...)`
- `runInteractionDecision(...)`
- `handlePointerDown(...)`
- 各类 interaction handler 的真实实现

建议放在 editor 的 handler 包括：

- `selection`
- `transform`
- `edge-create`
- `edge`
- `mindmap`
- `draw`
- `erase`
- `insert`

其中：

- `selection / transform / mindmap` 已经基本在 editor runtime
- `draw / erase / insert` 目前仍主要在 React
- `edge` 目前是 React 里组合 `connect / drag / route`

所以真正需要迁移的重点，是 `draw / erase / insert / edge-composite`

## 6.2 react 内部应保留的内容

React 侧应保留：

- canvas 事件绑定
- `pointermove / pointerleave / keydown` 这类纯宿主绑定
- preview / hint / overlay 的渲染
- 基于 editor read state 的视觉映射

React 不应继续保留：

- `InteractionDecision -> handler map` 的二次路由
- 对 pointer down 行为的再解释
- 交互行为的主调度权

---

## 7. 具体怎么改

下面给出推荐的改造顺序。

## 7.1 第一阶段：把 dispatch 收回 editor

第一步不要急着移动所有 feature 实现，先把“调度权”收回 editor。

### 目标

- `useCanvasDown.ts` 不再手工维护 handler map
- `dispatchInteractionDecision(...)` 不再作为公共 API 暴露给 React

### 做法

在 `packages/whiteboard-editor/src/runtime/input/pointer.ts` 内部新增：

- `runInteractionDecision(instance, decision)`
- `handlePointerDown(instance, container, event)`

其中 `runInteractionDecision(...)` 先仍然可以调用现有 controller / runtime：

- `instance.host.selection.gesture.down`
- `instance.host.node.transform.down`
- `instance.host.mindmap.controller.down`

对于目前还在 React 的部分，第一阶段允许先通过 editor 装配时注入 runtime handler。

也就是说，第一阶段的重点不是“一次把所有实现都搬完”，而是先把“总入口”和“总调度权”收回 editor。

### 第一阶段结束后的形态

React 侧：

```ts
handlePointerDown(instance, container, event)
```

而不是：

```ts
readInteractionStart(...)
resolveInteractionDecision(...)
dispatchInteractionDecision(decision, handlers)
```

## 7.2 第二阶段：把 draw / erase / insert 从 React 挪到 editor

这是最关键的一步。

### 7.2.1 `draw`

当前 `useDrawInput.ts` 混合了两类职责：

- 行为 runtime
- React preview state

建议拆成：

1. editor runtime
   - 负责开始 draw session
   - 负责采样 pointer
   - 负责生成 stroke
   - 负责 commit draw node
   - 负责维护 draw preview store
2. react adapter
   - 只读取 draw preview store
   - 只负责把 preview 渲染出来

也就是说，React 不再拥有 `draw.down(...)`，只拥有 `useDrawPreview()`。

### 7.2.2 `erase`

`useEraserInput.ts` 几乎全是行为逻辑：

- 采样 pointer
- 命中 draw node
- 临时隐藏
- 最终 delete

这部分应整体进入 editor。

React 不需要保留对应 hook，只需要渲染被 editor runtime 写出的视觉状态。

### 7.2.3 `insert`

`useInsertDown.ts` 基本就是一个命令入口：

- 判断 tool
- 判断 background
- 算 owner/frame
- 调 `commands.insert.preset`
- 切回 `select`

这显然属于 editor 行为层，应整体迁入 editor。

## 7.3 第三阶段：把 edge 组合 handler 收到 editor

当前 `useEdgeInput.ts` 同时负责：

- `create`
- `down`
- `keyDown`
- pointer move hint
- pointer leave clear

这里要分开处理。

### 应迁入 editor 的部分

- `edge-create`
- `edge` down
- `connect / reconnect / drag / route` 的主行为编排

### 可继续留在 React 的部分

- DOM 级 `pointermove`
- DOM 级 `pointerleave`
- 键盘绑定入口

但即便这些事件入口仍在 React，它们也应调用 editor 侧单入口，而不是继续由 React 自己编排行为。

例如：

- React 绑定 `pointermove`
- editor 负责 `handlePointerMove(...)`
- React 只消费 edge preview / hint 的只读状态

## 7.4 第四阶段：把 React runtime/input/pointer 包装层清掉

当前 `packages/whiteboard-react/src/runtime/input/pointer.ts` 基本只是把 editor 输入接口再包一层原样导出。

这层只有在两种情况下才有意义：

1. React 真的需要额外适配
2. React 需要暴露更少、更稳定的 UI 侧接口

如果两者都没有，这层就是噪音。

在 pointer handler 收口完成之后，建议：

- 直接删掉这层薄包装
- 或者让它只保留 React 真正需要的 UI 侧 adapter

不能继续让它只是一个“转发站”。

---

## 8. 推荐的最终 API 形态

推荐最终对 React 暴露的是一个薄入口，而不是一组判定和 dispatch 工具。

建议形态：

```ts
export const handlePointerDown = (
  instance: Editor,
  container: HTMLDivElement,
  event: PointerEvent
) => boolean
```

如果后续还要统一 `pointermove / pointerup / keydown / contextmenu`，可以继续扩展成一组 editor input 入口：

```ts
handlePointerDown(...)
handlePointerMove(...)
handlePointerLeave(...)
handleKeyDown(...)
handleContextMenu(...)
```

但这组入口的本质仍然是：

- editor runtime 的宿主接入点

而不是 React 自己的行为层。

---

## 9. 文件级改造建议

建议按下面方式落文件，而不是继续在 React 里堆 hook。

## 9.1 editor

建议新增或收敛到这些区域：

- `packages/whiteboard-editor/src/runtime/input/pointer.ts`
  - 保留 `readInteractionStart`
  - 保留 `resolveInteractionDecision`
  - 新增 `runInteractionDecision`
  - 新增 `handlePointerDown`
- `packages/whiteboard-editor/src/features/draw/*`
  - 新增 draw session runtime
  - 新增 eraser runtime
  - 新增 draw preview runtime store
- `packages/whiteboard-editor/src/features/toolbox/*`
  - 新增 insert down runtime
- `packages/whiteboard-editor/src/features/edge/*`
  - 新增 edge composite input runtime

## 9.2 react

建议把这些文件变薄：

- `packages/whiteboard-react/src/canvas/useCanvasDown.ts`
  - 只保留事件绑定
  - 移除 handler map
- `packages/whiteboard-react/src/runtime/input/pointer.ts`
  - 删除无意义转发
  - 或只保留少量 React 专属 adapter
- `packages/whiteboard-react/src/features/draw/useDrawInput.ts`
  - 改成 preview 读取 / 渲染辅助
- `packages/whiteboard-react/src/features/draw/useEraserInput.ts`
  - 删除或迁空
- `packages/whiteboard-react/src/features/toolbox/useInsertDown.ts`
  - 删除或迁空
- `packages/whiteboard-react/src/features/edge/hooks/useEdgeInput.ts`
  - 保留 DOM 绑定入口
  - 移除主行为编排

---

## 10. 改造时要避免的误区

## 10.1 不要把 handler 重新塞成一个新的大 `instance.api`

目标是收口，不是新增一层更宽的全局表面。

所以不建议：

- `instance.api.pointer.down`
- `instance.api.interaction.run`

这类新的大而全入口。

更合理的是：

- 对外提供少量明确输入入口
- 内部把真实 handler 收在 editor runtime 自己的模块里

## 10.2 不要把 preview 也一起绑死在 React

有些行为目前留在 React，只是因为它顺手用了 `useState`。

这不是合理边界。

像 draw preview 这种东西，更适合：

- editor 持有 preview store
- react 只订阅和渲染

## 10.3 不要把“事件绑定权”和“行为执行权”混为一谈

React 继续绑定 DOM 事件完全没问题。

要消掉的是：

- React 对交互行为的主调度权

而不是：

- React 对浏览器事件的接入职责

---

## 11. 验收标准

当这轮收口真正完成时，应该满足下面几条。

### 11.1 React 侧不再维护 pointer down handler map

也就是说，`useCanvasDown.ts` 不再出现：

- `edgeCreate: ...`
- `erase: ...`
- `draw: ...`
- `insert: ...`
- `transform: ...`
- `edge: ...`
- `mindmap: ...`
- `selection: ...`

### 11.2 editor 侧拥有完整的 down 执行链

也就是说，editor 内部已经能独立完成：

- `read`
- `resolve`
- `run`

### 11.3 React 只保留宿主接入和视觉适配

也就是说，React 里的相关文件主要只做：

- DOM 事件绑定
- 视觉状态读取
- UI render

### 11.4 新增 interaction kind 时只需要改 editor 主链

而不是每次都要：

1. editor 加一个 `decision`
2. React 再手工补一条 dispatch map

这条标准非常重要。

如果新增一个 interaction kind 仍然要求 editor 和 react 两边同时补主分发，说明这轮收口还没有真正完成。

---

## 12. 最终建议

如果只给一个建议，那就是：

**把 handler 放进 editor，把 React 从“交互行为调度器”降回“事件绑定和视觉层”。**

具体落地顺序建议是：

1. 先把 `dispatch` 收回 editor
2. 再迁 `draw / erase / insert`
3. 再迁 `edge` 的组合编排
4. 最后清掉 React 的薄转发包装层

这样改的好处不是“代码看起来更整齐”，而是：

- 概念更少
- 边界更稳定
- editor/react 之间的职责更清楚
- 后续新增 interaction 分支时不再双边改主路由

这才是这条链路真正的长期收敛方向。
