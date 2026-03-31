# WHITEBOARD_EDITOR_EDGE_PROJECTION_OPTIMAL_PLAN.zh-CN

## 目标

这份文档只回答一件事：

- `packages/whiteboard-editor/src/runtime/projection/edge.ts` 这条线，长期最优应该怎么改
- `patch / hint / activeRouteIndex / public projection` 应该如何彻底收敛
- `whiteboard-core / whiteboard-editor / whiteboard-react` 三层边界在这条线上应该怎么划

本文只讨论长期最优。
不考虑兼容，不保留过渡层，不为历史 API 留壳。

---

## 核心结论

`edge projection` 当前最大的问题，不是“字段有点多”，而是：

- 把真正参与 edge 读模型的临时 patch
- 把只服务于 overlay 的交互提示
- 把 store 默认值和 convenience helper

揉成了一个 runtime。

长期最优不是继续优化这份 `EdgeProjectionRuntime`。
长期最优是直接拆掉这个概念。

最终应改成两条线：

### 1. `edgeTransient`

职责：

- 承载 edge 的临时 patch 结果
- 参与 `read.edge.item` / `read.edge.view`
- 作为所有 edge 预览写入的唯一入口

### 2. `edgeGuide`

职责：

- 承载 edge 交互过程中的引导信息
- 例如 connect draft line、snap point
- 只供 UI overlay 渲染使用

也就是说：

- `patch` 不是 `hint`
- `hint` 不是 `projection`
- `activeRouteIndex` 也不是 core edge patch 的一部分

最终 public surface 不应该再有：

- `editor.projection.edge.patch`
- `editor.projection.edge.hint`
- `editor.projection.edge.emptyPatch`

最终应该是：

- `editor.read.edge.view`
- `editor.feedback.edgeGuide`

内部则是：

- `ctx.transient.edge`
- `ctx.feedback.edgeGuide`

---

## 现状拆解

当前实现位于：

- `packages/whiteboard-editor/src/runtime/projection/edge.ts`

它现在同时暴露：

```ts
export type EdgeProjectionRuntime = {
  patch: EdgeProjectionPatchStore
  hint: EdgeProjectionHintStore
  emptyPatch: EdgeProjectionPatch
  writeEntries: (entries: readonly EdgeProjectionPatchEntry[]) => void
  clearPatch: () => void
  writePatch: (
    edgeId: EdgeId,
    patch: CoreEdgePatch,
    activeRouteIndex?: number
  ) => void
  writeRoute: (
    edgeId: EdgeId,
    points: readonly Point[],
    activeRouteIndex?: number
  ) => void
  writeHint: (next?: EdgeProjectionHint) => void
  clearHint: () => void
  clear: () => void
}
```

这个类型的问题不是命名不好，而是它把三层东西混了：

### 1. 读模型输入

- `patch`

这是 `read.edge.item` 真正会读取的东西。

当前 `read.edge.item` 会把它应用到 engine edge 上：

- `packages/whiteboard-editor/src/runtime/read/edge.ts`

逻辑本质是：

```ts
const nextEdge = applyEdgeProjectionPatch(entry.edge, readStore(patch, edgeId))
```

所以这一层的本质是：

- **edge transient patch**

它是真正参与 projected edge 结果的。

### 2. UI 反馈输出

- `hint`

它并不参与 `read.edge.item`。
React 直接在 overlay 里读取它：

- `packages/whiteboard-react/src/features/edge/components/EdgeOverlayLayer.tsx`

hover processor 也只是在写它：

- `packages/whiteboard-editor/src/features/edge/hoverProcessor.ts`

所以这一层本质上不是 projection，而是：

- **edge guide / feedback**

### 3. store 细节和 convenience wrapper

- `emptyPatch`
- `writeEntries`
- `writePatch`
- `writeRoute`
- `writeHint`
- `clearHint`
- 文件底部那组 `writeEdgeProjectionPatch(...)` / `clearEdgeProjectionPatch(...)`

这些不是领域模型，而是：

- store 默认值
- runtime 写口重复包装
- 历史实现残留

---

## 当前最别扭的点

### 1. `patch` 和 `hint` 被强行视为一个对象

`patch` 进入 read。
`hint` 只进 UI overlay。

它们没有共享同一个“读模型结果”。
因此不应该继续挂在同一个 runtime 上。

### 2. `activeRouteIndex` 放错层

当前 core 里的：

- `packages/whiteboard-core/src/edge/projection.ts`

定义了：

```ts
export type EdgeProjectionPatch = {
  source?: Edge['source']
  target?: Edge['target']
  route?: Edge['route']
  activeRouteIndex?: number
}
```

但真正应用 patch 的纯函数：

```ts
export const applyEdgeProjectionPatch = (
  edge: Edge,
  patch: EdgeProjectionPatch
): Edge => { ... }
```

根本不会消费 `activeRouteIndex`。

这说明：

- `activeRouteIndex` 不是 edge patch
- 它只是 edge 编辑状态里的 UI metadata

把它塞进 core patch 模型，只会污染边界。

### 3. React 还要自己再读一次 patch

当前：

- `packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts`

会同时读取：

- `editor.read.edge.view`
- `editor.projection.edge.patch`
- `editor.projection.edge.emptyPatch`

React 只是为了知道：

- 当前哪一个 route point 是 active

这说明 `read.edge.view` 还不是最终读模型。
中间层没有把该收掉的东西收干净。

### 4. public API 泄漏了 store 默认值

`emptyPatch` 出现在：

- `packages/whiteboard-editor/src/types/editor.ts`

这种东西不应该出现在 public contract 里。
它只是在迁就 keyed store 的 empty value 语义。

用户不应该知道它。
React 也不应该依赖它。

### 5. 这不是 edge feature 私有状态

`edge` 的临时 patch 不是只有 edge feature 在写。

例如：

- `packages/whiteboard-editor/src/features/node/drag/interaction.ts`

node drag 过程中也会写 selected edge 和 related edge 的预览 patch。

这说明这条线的真实语义不是：

- edge feature 自己的一份 projection

而是：

- **整个 editor 的 edge transient surface**

所以它不应该藏在 edge feature 自己的内部模型里。
它必须是 editor 级全局 transient。

---

## 最简单的最终模型

## 一条原则

- **只有真正参与 projected edge 结果的东西，才叫 transient**
- **只给 UI 渲染提示的东西，单独叫 guide / feedback**

---

## 最终类型

### 1. `edgeTransient`

推荐类型：

```ts
type EdgeTransientEntry = {
  id: EdgeId
  patch?: EdgePatch
  activeRouteIndex?: number
}

type EdgeTransientProjection = {
  patch?: EdgePatch
  activeRouteIndex?: number
}

type EdgeTransientRuntime = {
  set: (entries: readonly EdgeTransientEntry[]) => void
  clear: () => void
}

type EdgeTransientReader =
  KeyedReadStore<EdgeId, EdgeTransientProjection>
```

这个模型有几个关键点：

- `patch` 直接使用 core 现有的 `EdgePatch`
- 不再定义 `EdgeProjectionPatch`
- `activeRouteIndex` 从“core patch 字段”降级为“editor transient metadata”
- 没有 `emptyPatch`
- 没有 `writePatch`
- 没有 `writeRoute`
- 没有 `writeEntries`
- 没有 `flush`

外部只记一件事：

- 要写 edge 临时结果，就调用 `edgeTransient.set(entries)`

### 2. `edgeGuide`

推荐类型：

```ts
type EdgeGuide = {
  line?: {
    from: Point
    to: Point
  }
  snap?: Point
}

type EdgeGuideRuntime = {
  get: () => EdgeGuide
  subscribe: (listener: () => void) => () => void
  set: (next?: EdgeGuide) => void
  clear: () => void
}
```

关键点：

- 它不是 projection
- 它不参与 `read.edge.item`
- 它只是 editor 输出给 React 的交互反馈

名字上推荐：

- `edgeGuide`

不推荐继续叫：

- `hint`

因为 `hint` 语义太弱，看不出这是 edge chrome/overlay 的输出模型。

---

## 为什么 `edgeTransient` 不应该照搬 `nodeTransient.set(T | updater)`

`nodeTransient` 适合整体 state + updater，是因为它同时承载：

- `patches`
- `hovered`
- `hidden`

这些状态天然是同一个 node transient 总体。

但 edge 这条线不是这样。

edge 当前真正的 transient 写入，本质上都是：

- 每一轮交互重算当前整批 edge preview 结果
- 然后整体覆盖

典型例子：

- node drag 重算一组 related edge patch
- edge route drag 重算当前 edge 的 route preview
- edge reconnect 重算当前 edge 的 source/target patch

这类写法天然更适合：

```ts
edgeTransient.set(entries)
```

而不是：

```ts
edgeTransient.set((current) => next)
```

原因：

- producer 自己已经知道本轮完整预览集
- 不需要暴露“基于旧 state 拼接”的心智负担
- 不会把 store 组合逻辑重新泄漏给 feature

结论：

- `nodeTransient` 保持 `set(T | updater)` 是合理的
- `edgeTransient` 的长期最优是更窄的 `set(entries)`

不要为了对齐而强行统一成一个更重的抽象。

---

## `read.edge.view` 应该收敛成最终读模型

当前 React 为了得到 `activeRouteIndex`，还要额外订阅 `projection.edge.patch`。
这说明最终读模型还没闭合。

长期最优应该是：

- `read.edge.item` 使用 `edgeTransient.patch` 组合 projected edge
- `read.edge.view` 在此基础上继续产出完整 edge 视图
- `activeRouteIndex` 直接进入 `read.edge.view`

也就是说：

```ts
type EdgeView = {
  edge: Edge
  path: ...
  ends: ...
  handles: ...
  can: ...
  activeRouteIndex?: number
}
```

这样 React 侧就只需要：

- `editor.read.edge.view`

不再需要：

- `editor.projection.edge.patch`
- `editor.projection.edge.emptyPatch`

这一步非常关键。

如果这一步不做，即使 runtime 改名了，噪音还是会留在 React 消费面。

---

## public surface 的最终形态

最终 public API 应该是：

```ts
type Editor = {
  read: {
    edge: {
      item: ...
      view: ...
      ...
    }
  }
  feedback: {
    edgeGuide: Pick<EdgeGuideRuntime, 'get' | 'subscribe'>
  }
}
```

明确删除：

- `editor.projection.edge`

原因：

- edge patch 不应该公开给 React 当成半成品再拼
- edge guide 不属于 projection

React 只应该消费：

- 读模型结果
- 少量 editor 输出反馈

而不是再去碰 runtime 中间 store。

---

## featureContext 的最终结构

当前 feature context 里还是：

```ts
projection: {
  edge: edgeProjection
  mindmapDrag: ...
}
transient: {
  node: nodeTransient
}
```

长期最优应该改成：

```ts
transient: {
  node: nodeTransient
  edge: edgeTransient
}
feedback: {
  edgeGuide: edgeGuide
}
```

这才符合真实职责：

- `node` 和 `edge` 都是 transient
- `edgeGuide` 是 feedback

这一步也会让 `projection` 这个 namespace 变得更干净。

如果后续继续整理：

- `marquee`
- `mindmapDrag`
- `draw preview`

也应该分别审视它们到底是 transient、feedback，还是别的输出域。

但这超出本文范围。

---

## core / editor / react 的最终分工

## `whiteboard-core` 应该保留什么

应该保留：

- `EdgePatch`
- 纯 patch 应用函数
- 纯 patch equality 函数
- edge connect / move / route 的纯算法

推荐最终核心纯函数形态：

```ts
type EdgePatch = Partial<Omit<Edge, 'id'>>

const applyEdgePatch = (edge: Edge, patch?: EdgePatch): Edge
const isEdgePatchEqual = (left?: EdgePatch, right?: EdgePatch): boolean
```

也就是说：

- `applyEdgeProjectionPatch` 应改成更本质的 `applyEdgePatch`
- `EdgeProjectionPatch` 这个专用类型不再需要
- `EMPTY_EDGE_PROJECTION_PATCH` 不再需要

### `whiteboard-core` 不应该保留什么

不应该保留：

- `EdgeProjectionHint`
- `activeRouteIndex` 这种 UI metadata
- `toEdgeConnectHint`
- `toEdgeProjectionPatchEntry`

原因：

- `line / snap` 是 editor 对 UI 的反馈协议，不是 core 领域模型
- `activeRouteIndex` 是 edge edit 的交互态，不是 edge patch
- `PatchEntry` 只是 editor runtime store 的装配结构，不是 core 纯算法

## `whiteboard-editor` 应该承载什么

应该承载：

- `edgeTransient` runtime + reader
- `edgeGuide` runtime
- `read.edge.item` / `read.edge.view` 对 transient 的组合
- edge feature 和 node drag 对 edge transient 的写入
- 把 editor 交互态转换成 `edgeGuide`

也就是说：

- editor 负责“把 core 纯算法组织成 runtime 行为”
- editor 负责“输出给 React 的最小交互反馈”

## `whiteboard-react` 应该承载什么

应该承载：

- 读取 `editor.read.edge.view`
- 读取 `editor.feedback.edgeGuide`
- 纯渲染 overlay / handle / control point

不应该承载：

- 再次拼 edge patch
- 再次判断 empty patch
- 理解 `projection.edge.patch` 这种 runtime 内部结构

---

## 文件级最终落点

## 应删除

- `packages/whiteboard-editor/src/runtime/projection/edge.ts`
- `packages/whiteboard-core/src/edge/projection.ts`

## 应新增

- `packages/whiteboard-editor/src/runtime/transient/edge.ts`
- `packages/whiteboard-editor/src/runtime/feedback/edgeGuide.ts`

如果 core 需要独立纯函数文件，则新增：

- `packages/whiteboard-core/src/edge/patch.ts`

如果不想新增文件，也至少要把原 `projection.ts` 重命名并改造成 patch 纯函数文件。

## 需要修改

- `packages/whiteboard-editor/src/runtime/read/edge.ts`
- `packages/whiteboard-editor/src/runtime/read/index.ts`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`
- `packages/whiteboard-editor/src/runtime/editor/features/createInteractionFeatures.ts`
- `packages/whiteboard-editor/src/types/runtime/editor/featureContext.ts`
- `packages/whiteboard-editor/src/types/editor.ts`
- `packages/whiteboard-editor/src/features/node/drag/interaction.ts`
- `packages/whiteboard-editor/src/features/edge/connect/interaction.ts`
- `packages/whiteboard-editor/src/features/edge/edit/interaction.ts`
- `packages/whiteboard-editor/src/features/edge/hoverProcessor.ts`
- `packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts`
- `packages/whiteboard-react/src/features/edge/components/EdgeOverlayLayer.tsx`

---

## 详细实施方案

## 第一步：删除旧 `EdgeProjectionRuntime`

彻底删除以下概念：

- `patch + hint` 同 runtime
- `emptyPatch`
- `writePatch`
- `writeRoute`
- `writeHint`
- `clearHint`
- `clear()`
- 文件底部那组 projection wrapper helper

最终 runtime 不再有“projection.edge”。

## 第二步：建立 `edgeTransient`

新增：

```ts
type EdgeTransientEntry = {
  id: EdgeId
  patch?: EdgePatch
  activeRouteIndex?: number
}

type EdgeTransientProjection = {
  patch?: EdgePatch
  activeRouteIndex?: number
}

type EdgeTransientRuntime = {
  set: (entries: readonly EdgeTransientEntry[]) => void
  clear: () => void
}
```

注意：

- runtime 只暴露 `set / clear`
- 内部可以继续用 staged keyed store
- 调度可以是 RAF，也可以是 microtask
- 但 `flush` 绝不能暴露出去

## 第三步：建立 `edgeGuide`

新增：

```ts
type EdgeGuide = {
  line?: {
    from: Point
    to: Point
  }
  snap?: Point
}
```

运行时只保留：

- `get`
- `subscribe`
- `set`
- `clear`

它的职责就是：

- 让 editor 输出当前 edge 交互引导状态

不要再叫：

- `hint`

## 第四步：收敛 `read.edge`

`createEdgeRead` 改为依赖：

- `edgeTransient.reader`

`read.edge.item` 只读取：

- `transient.patch`

`read.edge.view` 额外读取：

- `transient.activeRouteIndex`

并把它直接写进 view。

改完后：

- React 不再读取 transient store
- React 只读取 `read.edge.view`

## 第五步：改写所有 feature 写入口

### node drag

把：

- `ctx.projection.edge.writeEntries(...)`
- `ctx.projection.edge.clearPatch()`

改成：

- `ctx.transient.edge.set(entries)`
- `ctx.transient.edge.clear()`

### edge connect

把：

- reconnect preview 写到 `ctx.transient.edge.set(...)`
- connect / reconnect 的 overlay line 和 snap 写到 `ctx.feedback.edgeGuide.set(...)`

清理时分别：

- `ctx.transient.edge.clear()`
- `ctx.feedback.edgeGuide.clear()`

### edge edit

把：

- body move preview
- route drag preview

都改为：

- `ctx.transient.edge.set([...])`

不再使用 `writePatch / writeRoute`

### edge hover

只写：

- `ctx.feedback.edgeGuide`

不再碰任何 edge patch runtime。

## 第六步：收紧 public editor surface

删除：

```ts
projection: {
  edge: {
    patch
    hint
    emptyPatch
  }
}
```

改成：

```ts
feedback: {
  edgeGuide: Pick<EdgeGuideRuntime, 'get' | 'subscribe'>
}
```

如果当前 `Editor` 还没有 `feedback` 顶级域，就直接新增。

不要为了维持旧命名，把 `edgeGuide` 继续挂在 `projection` 下。

## 第七步：清理 React 消费面

### `useSelectedEdgeView`

删除：

- 对 `editor.projection.edge.patch` 的读取
- 对 `editor.projection.edge.emptyPatch` 的依赖

改为：

- 直接从 `editor.read.edge.view` 取 `activeRouteIndex`

### `EdgeOverlayLayer`

把：

- `editor.projection.edge.hint`

改成：

- `editor.feedback.edgeGuide`

React 不再知道 edge transient 的存在。

---

## 最终不应该再出现的东西

以下概念在长期最优里都应该消失：

- `EdgeProjectionRuntime`
- `EdgeProjectionPatch`
- `EdgeProjectionPatchEntry`
- `EdgeProjectionHint`
- `EMPTY_EDGE_PROJECTION_PATCH`
- `writeEdgeProjectionPatch`
- `writeEdgeProjectionRoute`
- `writeEdgeProjectionHint`
- `clearEdgeProjectionPatch`
- `clearEdgeProjectionHint`
- `editor.projection.edge`
- `emptyPatch`

这些名字本身就说明模型已经混层。

---

## 一个更底层的判断

这条线真正暴露出来的问题，其实不是 edge 特例，而是：

- 当前 `projection` 这个名字已经过宽

因为它同时被拿来表示：

- 真正投影到 read 结果里的临时状态
- 只给 UI 渲染用的反馈状态
- 以及一些历史残留中间 store

在 edge 这条线上，这个问题已经非常明显，所以应该先彻底做干净。

edge 这条线做完以后，editor 内部会形成更清晰的长期方向：

- `read` 负责最终读模型
- `transient` 负责临时投影输入
- `feedback` 负责 editor 输出给 UI 的反馈状态

这才是噪音最少、职责最稳、后续最好扩展的结构。

---

## 最终一句话

`edge projection` 不应该继续优化。
它应该被拆成：

- `edgeTransient`
- `edgeGuide`

然后：

- `read.edge.view` 收敛成最终结果
- `editor.projection.edge` 彻底删除
- `activeRouteIndex` 从 core patch 中移出
- React 只读 `read.edge.view` 和 `feedback.edgeGuide`

这就是这条线长期最优、最解耦、噪音最少的最终形态。
