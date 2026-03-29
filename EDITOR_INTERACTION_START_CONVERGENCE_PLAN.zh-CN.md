# Editor Interaction Start 收口方案

## 1. 结论

`whiteboard-editor` 里分散在各 feature 的 `interactionStart` 可以集中，而且应该集中。

最清晰、最简单的做法不是继续保留：

- `features/*/interactionStart.ts`
- `runtime/input/pointer.ts` 里的 route table
- feature 自己的 `down(input)` 二次 guard

而是把“pointer down 到底启动哪种交互”收成 editor input 层的**单一 owner**。

建议新增一个唯一决策文件：

- `packages/whiteboard-editor/src/runtime/input/interactionStart.ts`

这个文件只做一件事：

- 输入 `PointerDown`
- 输出唯一的 `InteractionStart`

feature 不再负责“这是不是我”，只负责“既然已经决定启动我，那就开始”。

---

## 2. 当前问题

当前结构里，交互启动知识被拆成了三层：

1. `pointer.ts` 做第一轮路由
   - `packages/whiteboard-editor/src/runtime/input/pointer.ts`

2. 各 feature 自己定义 `isXInteractionStart`
   - `packages/whiteboard-editor/src/features/draw/interactionStart.ts`
   - `packages/whiteboard-editor/src/features/edge/interactionStart.ts`
   - `packages/whiteboard-editor/src/features/mindmap/interactionStart.ts`
   - `packages/whiteboard-editor/src/features/selection/interactionStart.ts`
   - `packages/whiteboard-editor/src/features/toolbox/interactionStart.ts`
   - `packages/whiteboard-editor/src/features/node/session/transformStart.ts`

3. 各 feature 的 runtime/session 再做一次 guard
   - `packages/whiteboard-editor/src/features/edge/connectSession.ts`
   - `packages/whiteboard-editor/src/features/edge/input.ts`
   - `packages/whiteboard-editor/src/features/mindmap/dragSession.ts`
   - `packages/whiteboard-editor/src/features/node/session/transform.ts`

这会导致几个具体问题：

1. 同一个知识点没有单一 owner。
   - “什么情况下启动 draw”
   - “什么情况下启动 edge reconnect”
   - “什么情况下启动 selection press”

2. `pointer.ts` 只有粗粒度 action。
   - 例如只有 `edge`
   - 但 `edge body / edge route / edge reconnect` 实际是不同启动点

3. feature 入口职责不纯。
   - 现在的 `down(input)` 既要做启动判断，又要做真正启动

4. 类型没有统一。
   - 虽然现在所有入口都收 `PointerDown`
   - 但 feature 侧仍然保留很多 `DrawInteractionStart / MindmapInteractionStart / TransformInteractionStart` 这种局部概念

---

## 3. 目标

目标不是做一个更抽象的输入框架，而是把交互启动收成一条最短链路：

```ts
PointerEvent
  -> PointerDown
  -> resolveInteractionStart(start)
  -> runInteractionStart(start)
  -> feature.start(...)
```

对应约束：

1. `InteractionStart` 只有一个 owner。
2. `InteractionStart.input` 全局统一为 `PointerDown`。
3. feature 不再定义 `isXInteractionStart`。
4. feature 不再对同一个 start 做“我是不是该启动”的重复判断。
5. 只保留 feature 自己必须承担的数据合法性校验。

---

## 4. 推荐模型

### 4.0 推荐命名

为了避免当前代码里 `PointerStart`、`PointerAction`、`InteractionStartInput` 三层都带 `Start` 造成歧义，建议命名一起调整：

1. 原始 pointer down 快照
   - `PointerStart` -> `PointerDown`
   - `readPointerStart()` -> `readPointerDown()`

2. 输入路由后的交互启动结果
   - `PointerActionKind` -> `InteractionStartKind`
   - `PointerAction` -> `InteractionStart`
   - `resolvePointerAction()` -> `resolveInteractionStart()`
   - `runPointerAction()` -> `runInteractionStart()`

3. interaction coordinator 的 session 启动参数
   - `InteractionStartInput` -> `InteractionSessionInput`

最终三层语义应该明确分开：

- `PointerDown`
- `InteractionStart`
- `InteractionSessionInput`

### 4.1 统一结果类型

建议在 `runtime/input/interactionStart.ts` 中定义：

```ts
export type InteractionStartKind =
  | 'draw.stroke'
  | 'draw.erase'
  | 'insert.preset'
  | 'node.transform'
  | 'edge.create'
  | 'edge.reconnect'
  | 'edge.route'
  | 'edge.body'
  | 'mindmap.drag'
  | 'selection.press'

export type InteractionStart = {
  kind: InteractionStartKind
  start: PointerDown
}
```

这里最重要的是两点：

1. `kind` 要足够具体。
   - 不能只保留现在这种 `edge`
   - 否则 feature 内部还得继续分流

2. `start` 继续统一为 `PointerDown`。
   - 不再给每个行为配一个专属 start input 类型

### 4.2 唯一决策入口

```ts
export const resolveInteractionStart = (
  editor: ...,
  input: PointerDown
): InteractionStart | undefined
```

职责：

1. 统一做早退
   - `defaultPrevented`
   - `button !== 0`
   - `interaction.busy`

2. 统一做 frame normalize

3. 按固定优先级决定唯一 `kind`

### 4.3 唯一执行入口

```ts
export const runInteractionStart = (
  editor: ...,
  resolved: InteractionStart | undefined
) => boolean
```

这里只负责 `kind -> feature.start()` 的 dispatch，不再做判定。

---

## 5. 最小优先级规则

推荐保持现有语义，只把它显式化。

### 5.1 draw tool

```ts
erase > stroke
```

### 5.2 edge tool

```ts
create
```

### 5.3 insert tool

```ts
insert.preset
```

### 5.4 select tool

```ts
node.transform
> edge.reconnect
> edge.route
> edge.body
> mindmap.drag
> selection.press
```

这个顺序有两个意义：

1. 它就是当前真实交互优先级，只是现在分散在多个文件里。
2. 它能把 edge 内部的重连、改路由、选中拖动彻底区分开，消掉 feature 内部的大部分二次 route。

---

## 6. 为什么不要做重型映射表

不建议做这种高度表驱动的统一器：

```ts
[
  { kind, tools, pickKinds, requiresEditableFalse, ... }
]
```

原因：

1. 规则数量不多。
2. 每条规则并不对称。
3. edge / selection / transform 的条件组合并不适合被硬压成同构配置。
4. 显式 `switch (tool.type)` 加有顺序的 `if`，会比伪通用映射表更好读。

所以最简解法应该是：

- 少量 helper
- 显式分支
- 明确顺序

而不是抽象出一个新 DSL。

---

## 7. 文件级改造方案

### 7.1 新增

新增统一 owner：

- `packages/whiteboard-editor/src/runtime/input/interactionStart.ts`

建议内容：

1. `InteractionStartKind`
2. `InteractionStart`
3. 少量共享 helper
   - `allowsCanvasContent(start)`
   - `isEdgeRoutePick(start.pick)` 这类小 helper
4. `resolveInteractionStart()`
5. `runInteractionStart()`

### 7.2 删除

建议删除这些分散文件：

- `packages/whiteboard-editor/src/features/draw/interactionStart.ts`
- `packages/whiteboard-editor/src/features/edge/interactionStart.ts`
- `packages/whiteboard-editor/src/features/mindmap/interactionStart.ts`
- `packages/whiteboard-editor/src/features/selection/interactionStart.ts`
- `packages/whiteboard-editor/src/features/toolbox/interactionStart.ts`
- `packages/whiteboard-editor/src/features/node/session/transformStart.ts`

### 7.3 改薄 pointer 入口

需要修改：

- `packages/whiteboard-editor/src/runtime/input/pointer.ts`

调整为：

1. 保留 `PointerDown`
2. 保留 `readPointerDown()`
3. 保留 frame normalize
4. 删除 route table
5. 删除对各 feature `interactionStart.ts` 的 import
6. 改成：
   - `resolveInteractionStart()`
   - `runInteractionStart()`

### 7.4 收紧 feature 入口命名

不建议继续保留大量 `down(input)`，因为它隐含“我自己判断要不要启动”。

更清晰的做法：

#### draw

- `draw.startStroke(start)`
- `draw.startErase(start)`

来源文件：

- `packages/whiteboard-editor/src/features/draw/input.ts`

这个文件内部已经有：

- `startDraw()`
- `startErase()`

所以这里改动最小。

#### edge connect

- `edge.connect.startCreate(start)`
- `edge.connect.startReconnect(start)`

来源文件：

- `packages/whiteboard-editor/src/features/edge/connectSession.ts`

#### edge input

- `edge.input.startBody(start)`
- `edge.input.startRoute(start)`

来源文件：

- `packages/whiteboard-editor/src/features/edge/input.ts`

#### transform

- `node.transform.start(start)`

来源文件：

- `packages/whiteboard-editor/src/features/node/session/transform.ts`

#### mindmap

- `mindmap.controller.startDrag(start)`

来源文件：

- `packages/whiteboard-editor/src/features/mindmap/dragSession.ts`

#### selection

- `selection.gesture.start(start)`

来源文件：

- `packages/whiteboard-editor/src/features/selection/gesture.ts`

### 7.5 调整 host 组合层

需要修改：

- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`
- `packages/whiteboard-editor/src/runtime/editor/createEditorHost.ts`

目标不是把更多逻辑塞进 host，而是把 host 的接口语义变干净。

从现在这种：

```ts
draw.down(start)
edge.input.down(start)
selection.gesture.down(start)
```

收成：

```ts
draw.startStroke(start)
draw.startErase(start)
edge.connect.startCreate(start)
edge.connect.startReconnect(start)
edge.input.startBody(start)
edge.input.startRoute(start)
mindmap.controller.startDrag(start)
node.transform.start(start)
selection.gesture.start(start)
```

这样 `runtime/input/interactionStart.ts` 的 dispatch 就是直接的。

---

## 8. 哪些 guard 应该删除

应该删除的是“我是不是这个 interaction”的判定。

具体包括：

1. `isDrawInteractionStart`
2. `isEraseInteractionStart`
3. `isEdgeCreateInteractionStart`
4. `isEdgeInteractionStart`
5. `isMindmapInteractionStart`
6. `isSelectionInteractionStart`
7. `isInsertInteractionStart`
8. `isTransformInteractionStart`

这些判断迁到中心以后，不应该再在 feature 内重复存在。

---

## 9. 哪些 guard 必须保留

必须保留的是 feature 自己的数据合法性校验。

例如：

1. node / edge / view 是否还存在
2. route point 是否还存在
3. transform target 是否还能构造
4. node 是否 `locked`
5. treeView / position 是否存在
6. session 当前是否已 active

这些不是“interaction start 判定”，而是 feature 自己的真实运行时保护，不能砍。

一句话区分：

- “这次 pointerdown 归谁处理”属于 input owner
- “真正开始时数据还成不成立”属于 feature owner

---

## 10. selection 的特殊边界

selection 不应该被过度吸进全局 start resolver。

全局只需要决定：

- 这次是 `selection.press`

selection 内部仍然自己做：

- `press -> tap`
- `press -> drag`
- `press -> hold`

也就是说：

- `InteractionStart` 只决定 owner
- `resolveSelectionPressPlan()` 仍然留在 selection 域

否则全局 start 文件会继续膨胀成一个新的大泥球。

---

## 11. 推荐的最小落地顺序

### 阶段 1：建立中心 owner

1. 新建 `runtime/input/interactionStart.ts`
2. 把 `pointer.ts` 里的 route table 迁过去
3. 先保留 feature 侧的 `down()` 和二次 guard
4. 让 `pointer.ts` 改成只调用中心 resolver

目的：

- 先把 owner 从“分散”变成“集中”

### 阶段 2：把 coarse kind 收细

1. `edge` 拆成：
   - `edge.create`
   - `edge.reconnect`
   - `edge.route`
   - `edge.body`
2. `draw` 拆成：
   - `draw.stroke`
   - `draw.erase`

目的：

- 让中心决策足够具体，feature 内部不再需要 route

### 阶段 3：删掉 feature interactionStart 文件

1. 删除各 feature `interactionStart.ts`
2. 删除 `transformStart.ts`
3. 删掉 feature 内部 `isXInteractionStart` 的 import

目的：

- 真正完成 owner 收口

### 阶段 4：把 feature `down()` 改成语义入口

1. `down()` 改成 `startXxx()`
2. `host` 组合层改名
3. `runInteractionStart()` 直接分发到语义入口

目的：

- 最终把职责模型收顺

---

## 12. 最终状态

理想的最终状态应该接近这样：

```ts
const down = readPointerDown(editor, container, event)
const resolved = resolveInteractionStart(editor, down)
return runInteractionStart(editor, resolved)
```

其中：

```ts
switch (resolved.kind) {
  case 'draw.stroke':
    return editor.host.draw.startStroke(resolved.start)
  case 'draw.erase':
    return editor.host.draw.startErase(resolved.start)
  case 'edge.create':
    return editor.host.edge.connect.startCreate(resolved.start)
  case 'edge.reconnect':
    return editor.host.edge.connect.startReconnect(resolved.start)
  case 'edge.route':
    return editor.host.edge.input.startRoute(resolved.start)
  case 'edge.body':
    return editor.host.edge.input.startBody(resolved.start)
  case 'node.transform':
    return editor.host.node.transform.start(resolved.start)
  case 'mindmap.drag':
    return editor.host.mindmap.controller.startDrag(resolved.start)
  case 'selection.press':
    return editor.host.selection.gesture.start(resolved.start)
  case 'insert.preset':
    return editor.host.insert.startPreset(resolved.start)
}
```

这样会得到三个直接收益：

1. 交互启动规则只有一个 owner。
2. feature 入口职责会明显变纯。
3. `pointer -> interaction -> feature` 这条链会比现在更短、更平。

---

## 13. 最终判断

如果目标是“概念尽量少、链路尽量平、职责尽量准”，那么最优解不是保留一堆 `isXInteractionStart` 文件再做一层包装，而是：

1. 把 `interactionStart` 明确成 editor input 层的统一决策。
2. 把 `kind` 细化到足以消掉 feature 内部 route。
3. 把 feature 入口改成纯 `startXxx()`，不再回答“是不是我”。

这就是这条链路里最简单的设计。
