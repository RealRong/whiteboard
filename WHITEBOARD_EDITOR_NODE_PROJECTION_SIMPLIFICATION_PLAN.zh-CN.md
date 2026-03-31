# WHITEBOARD_EDITOR_NODE_PROJECTION_SIMPLIFICATION_PLAN.zh-CN

## 目标

这份文档只回答一件事：

- `packages/whiteboard-editor/src/runtime/projection/node.ts` 这条线，长期最优应该怎么改，才能做到模型简单、噪音最少、调用最短。

本文不考虑兼容，不保留过渡层。
结论以长期最优为准。

---

## 核心结论

node projection 这条线最重要的原则只有一句话：

- **最终全局只应该有一个 projected node 结果**

也就是说：

- 渲染侧不应该面对多份 node projection
- read 层最终只应该产出一套统一的 `read.node.item` / `read.node.interaction`

但这不等于当前这份 `NodeProjectionRuntime` 就是合理的。

当前问题是：

- 它把最终投影结果
- 交互过程中的写入入口
- 底层 store 与调度细节

全捏在了一个对象里。

当前类型：

```ts
export type NodeProjectionRuntime = {
  store: NodeProjectionStore
  get: (nodeId: NodeId) => NodeProjection
  flush: () => void
  patch: NodeProjectionPatchRuntime
  preview: NodeProjectionPreviewRuntime
  hidden: NodeProjectionHiddenRuntime
  clear: () => void
}
```

这不是“一个自然的领域对象”，而是“历史实现细节的聚合壳”。

长期最优不应该是：

- `nodePreview.write(...)`
- `nodeTextPreview.set(...)`
- `nodeHidden.set(...)`

这种 API 也太碎。

长期最优应该是：

- 一个统一的 `nodeTransient` 写入口
- 一个统一的 projected node 读结果

也就是：

```ts
type NodeTransientState = {
  patches: readonly NodePatchEntry[]
  hovered?: NodeId
  hidden: readonly NodeId[]
}

type NodeTransientRuntime = {
  set: (
    next:
      | NodeTransientState
      | ((current: NodeTransientState) => NodeTransientState)
  ) => void
  clear: () => void
}
```

然后：

- `read.node.item`
- `read.node.interaction`

统一从这份 `nodeTransient` 组合出来。

一句话总结：

- **写侧统一成一个 `setState` 风格入口**
- **读侧统一成一个 projected node 结果**

这才是这条线最简单、噪音最少的长期形态。

---

## 现状问题

当前实现的问题不是“字段多了几个”，而是三层东西混了：

### 1. 写入语义

当前写入入口：

- `patch.write(nodeId, patch)`
- `preview.write({ patches, hoveredContainerId })`
- `hidden.write(hiddenIds)`

它们其实都在改“节点的临时投影状态”。

### 2. 读取语义

当前还暴露了：

- `get(nodeId)`

这说明 runtime 既像 writer，又像 reader。

### 3. 底层实现细节

当前还暴露了：

- `store`
- `flush`

这说明业务层被迫理解：

- 底层是不是 staged
- 什么时候要手动 flush
- store 到底是什么结构

这三层混在一起，才会让这条线一直显得重。

---

## 最简单的最终模型

### 总原则

1. 最终只有一个 projected node 结果
2. 对外只有一个 node transient 写口
3. 不暴露 store、get、flush 这类实现细节
4. 不再把 patch / preview / hidden 暴露成三套兄弟 API

---

## 最终 API 应该长什么样

### 写侧

```ts
type NodePatchEntry = {
  id: NodeId
  patch: NodePatch
}

type NodeTransientState = {
  patches: readonly NodePatchEntry[]
  hovered?: NodeId
  hidden: readonly NodeId[]
}

type NodeTransientRuntime = {
  set: (
    next:
      | NodeTransientState
      | ((current: NodeTransientState) => NodeTransientState)
  ) => void
  clear: () => void
}
```

推荐默认空状态：

```ts
const EMPTY_NODE_TRANSIENT: NodeTransientState = {
  patches: [],
  hidden: []
}
```

说明：

- `patches` 表示当前所有临时节点 patch
- `hovered` 表示当前唯一的 hover 目标 node id
- 这里不再限制为 container；如果后续普通 node hover 也进入同一条 transient 链，这个字段仍然成立
- `hidden` 表示当前临时隐藏节点集合

这里故意不做 `Partial<NodeTransientState>`。

原因：

- 一旦变成 partial merge，复杂度马上就会回来
- “没传这个字段”到底表示“保留”还是“清空”，会重新制造噪音

所以 `set(next)` 的语义必须是：

- **整体替换**

`set(updater)` 的语义必须是：

- **基于当前完整状态生成下一份完整状态**

这和 React `setState` 的长期最优思路是一致的。

---

### 读侧

读侧不需要新增复杂 API。

继续保留：

- `read.node.item`
- `read.node.interaction`

就够了。

如果内部要更明确，可以把它理解成：

- `read.node.projected`

但对外不一定要新开名字。

关键点不是加新 read API，而是让现有 read API 的来源更干净。

---

## `set(T | updater)` 为什么是最优

### 1. 比 `patch/preview/hidden` 三套 API 更短

外部只记一件事：

- 改 node transient 就用 `nodeTransient.set(...)`

而不是：

- 这次到底该调 `patch.write`
- 还是 `preview.write`
- 还是 `hidden.write`

---

### 2. 比 `get + write + flush` 更干净

当前 text preview 的链路之所以别扭，是因为它会变成：

- 先 `get(nodeId)`
- 再组 patch
- 再 `patch.write(...)`
- 再 `flush()`

这整个过程都说明 API 过于泄漏底层实现。

如果改成：

```ts
nodeTransient.set((current) => next)
```

那么：

- 不需要对外暴露 `get`
- 不需要对外暴露 `flush`

这条线会短很多。

---

### 3. 仍然能满足“基于当前状态修改”的需求

这是 `setState` 形态最关键的好处。

像 text preview 这种场景，有时候确实需要：

- 保留当前别的 patch
- 只改某个 node 的 size patch

这时候用 updater 就够了：

```ts
nodeTransient.set((current) => {
  // 从 current.patches 推导 next.patches
  return next
})
```

这样：

- API 还是一个
- 逻辑还是可表达
- 不需要抬出顶层 `get()`

---

### 4. 底层调度仍然可以自由实现

对外是：

- `set`
- `clear`

对内可以是：

- sync store
- microtask staged
- raf staged

这都属于内部实现，不应该再出现在 runtime contract 上。

---

## 必须坚持的两条规则

如果采用 `set(T | updater)`，有两条规则不能破。

### 规则 1：不是 partial merge

不要做成这样：

```ts
set({ hidden })
set({ patches })
```

否则马上会出现：

- 没传的字段要不要保留
- 想清空某个字段怎么表达
- 多个 feature 会互相依赖当前对象的残留状态

这会把当前的复杂度重新带回来。

正确做法是：

```ts
set(completeNextState)
set((current) => completeNextState)
```

---

### 规则 2：updater 必须基于 `pending ?? current`

如果一个事件循环里连续多次调用：

```ts
set((current) => stepA(current))
set((current) => stepB(current))
```

那么第二次 updater 不能再读旧 committed state。

必须是：

- 如果已有 pending，就基于 pending
- 没有 pending，才基于 current

否则它只是“看起来像 React setState”，实际上并不对。

所以如果做这个 API，就必须把 updater 语义做完整。

---

## 当前字段逐项判断

### `store`

不该留。

原因：

- 它只是读模型装配时的内部依赖
- feature 不应知道底层 store 的存在

最终形态：

- `createRead(...)` 直接接收 `nodeTransient` 的 reader
- 不再通过 `NodeProjectionRuntime.store` 中转

---

### `get`

不该留。

原因：

- 它只是为了补偿当前没有 `set(updater)` 这种统一入口
- 一旦有统一 updater，就不需要通过 `get()` 暴露当前状态

最终形态：

- 删除顶层 `get(nodeId)`

---

### `flush`

不该留。

原因：

- `flush` 是 store primitive 的实现细节
- 不是 node transient 的业务语义

最终形态：

- 删除顶层 `flush()`
- sync/raf/microtask 都收回内部实现

---

### `patch`

不该留。

原因：

- 它只是 `patches` 这个字段的一种写法
- 不值得单独做一级 API

最终形态：

- 删除 `patch.write` / `patch.clear`

---

### `preview`

不该以子命名空间形式保留。

原因：

- `preview.write(...)` 本质上也只是给 `patches + hovered` 赋值
- 它不是比 `set` 更稳定的抽象

最终形态：

- feature 直接构造完整 `NodeTransientState` 或 updater

---

### `hidden`

不该以子命名空间形式保留。

原因：

- 它只是 `hidden` 字段
- 不值得再做一套 `hidden.write` / `hidden.clear`

最终形态：

- 通过 `set(next)` 直接改 `hidden`

---

### `clear`

可以保留，但只作为 `set(EMPTY_NODE_TRANSIENT)` 的语法糖。

也就是说：

- 它不是一个独立领域能力
- 只是方便调用

最终形态：

```ts
clear() === set(EMPTY_NODE_TRANSIENT)
```

---

## 整条线应该怎么运作

### 写入方

不同 feature 只是构造不同的 next state。

#### node drag / node transform

写入：

- `patches`
- `hovered`

例如：

```ts
nodeTransient.set({
  patches: preview.nodes.map((entry) => ({
    id: entry.id,
    patch: {
      position: entry.position,
      size: entry.size,
      rotation: entry.rotation
    }
  })),
  hovered: preview.hoveredContainerId,
  hidden: []
})
```

#### draw eraser

写入：

- `hidden`

例如：

```ts
nodeTransient.set({
  patches: [],
  hidden: [...state.ids]
})
```

#### text preview

如果需要在当前 patch 基础上改单个 node 的 size，就用 updater：

```ts
nodeTransient.set((current) => {
  const nextPatches = rewriteTextSizePatch(current.patches, nodeId, size)
  return {
    ...current,
    patches: nextPatches
  }
})
```

注意：

- 这仍然是“返回完整 next state”
- 不是 partial merge

---

## 读模型怎么组合

长期最优里，`read.node.item` 和 `read.node.interaction` 都应该直接从：

- committed node
- `nodeTransient`

组合出来。

### `read.node.item`

规则：

1. 先读 committed item
2. 找到当前 node 在 `nodeTransient.patches` 里的 patch
3. 应用 patch 后得到 projected item

### `read.node.interaction`

规则：

```ts
hovered = nodeTransient.hovered === nodeId
hidden = nodeTransient.hidden.includes(nodeId)
hasPatch = patchExists(nodeId)
hasResizePreview = patchHasSize(nodeId)
```

也就是说：

- 最终 projected 结果仍然只有一套
- 只是它来自一份更干净的 transient state

---

## 为什么这版比“拆成多个 source runtime”更合适

因为在你们当前 editor 里，更重要的不是“来源绝对解耦”，而是：

- API 短
- ownership 清楚
- 结果统一

如果写侧直接拆成：

- `nodePreview.write(...)`
- `nodeTextPreview.set(...)`
- `nodeHidden.set(...)`

概念上是干净的，但 API 会变长，也会让 feature context 更碎。

对你们当前这套内部系统来说，这不是长期最优。

更合理的是：

- 外部统一成一个 `nodeTransient.set`
- 内部如果以后真的需要，再在实现里拆 source
- 但这种拆分不要先暴露成 public/internal runtime contract

也就是说：

- **对外统一**
- **对内保留以后再拆的自由**

---

## feature context 应该怎么改

现在 [packages/whiteboard-editor/src/types/runtime/editor/featureContext.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/types/runtime/editor/featureContext.ts) 里是：

```ts
projection: {
  node: NodeProjectionRuntime
  edge: EdgeProjectionRuntime
  mindmapDrag: MindmapDragProjectionStore
}
```

长期最优不应继续给 feature 一整份 `projection.node`。

建议改成：

```ts
transient: {
  node: NodeTransientRuntime
}
```

原因：

- `projection.node` 这个名字会误导人，以为它是 public projection 的内部同构版
- 实际上它只是内部节点临时状态
- `transient.node` 更符合真实职责

---

## 最终 API 裁剪结果

### 应删除

- `NodeProjectionRuntime`
- `NodeProjectionStore`
- `NodeProjectionReader`
- `NodeProjection`
- 顶层 `store`
- 顶层 `get`
- 顶层 `flush`
- `patch` 子命名空间
- `preview` 子命名空间
- `hidden` 子命名空间

### 应新增

- `NodeTransientState`
- `NodePatchEntry`
- `NodeTransientRuntime`

---

## 文件结构建议

不要继续保留一个大而全的：

- `packages/whiteboard-editor/src/runtime/projection/node.ts`

建议改成一个更明确的 transient 文件，例如：

```txt
packages/whiteboard-editor/src/runtime/transient/node.ts
```

原因：

- 这条线不是真正的 public projection
- 它是 editor 内部 transient state
- 换成 `transient` 命名后，职责更直接

如果当前改目录成本太大，短期也可以先保留文件位置，但内部模型仍按 `NodeTransientRuntime` 改。

---

## 实施顺序

后续如果开始落代码，推荐顺序如下：

1. 先定义 `NodeTransientState` 和 `NodeTransientRuntime`
2. 把当前 `patch/preview/hidden` 写入口全部收敛到 `set(T | updater)`
3. 删掉顶层 `get` / `flush` / `store`
4. 改 `runtime/commands/node/text.ts`，让它改用 updater，不再手动 `get + flush`
5. 改 `createRead(...)`，直接从 `nodeTransient` 组合 `read.node.item` / `read.node.interaction`
6. 把 `featureContext.projection.node` 改成 `featureContext.transient.node`
7. 删除旧 `NodeProjectionRuntime` 相关类型和辅助函数

---

## 最终一句话结论

这条线长期最优不是：

- 多套 node preview source API

也不是：

- 继续维护一个大而全的 `NodeProjectionRuntime`

而是：

- **一个统一的 `nodeTransient.set(T | ((current) => T))` 写入口**
- **一个统一的 projected node 读结果**

这样才能同时满足：

- 全局只有一个 projected node 结果
- 写侧足够短
- 不暴露 store/get/flush
- feature 不再围着 `patch/preview/hidden` 三套子命名空间转

这就是这条线长期最简单、噪音最少的最终做法。
