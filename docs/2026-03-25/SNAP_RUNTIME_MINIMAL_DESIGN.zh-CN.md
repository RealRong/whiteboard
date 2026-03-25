# Snap Runtime 最简设计

## 结论

`ResizeSnapInput` 不需要现在这么多值。

当前这组输入之所以膨胀，不是因为 snap 本身复杂，而是因为现有实现把两件事混在了一起：

1. resize 原始几何计算
2. resize 之后的 snap 修正

长期最优里，snap 应该只接收“已经算好的几何草稿”，不应该接收 pointer session 的整套历史输入。

---

## 现状问题

当前 resize 链路里，`resolveResizePreview(...)` 同时负责：

- 根据 `startScreen/currentScreen/startCenter/startRotation/startSize/startAspect/zoom/altKey/shiftKey` 计算原始 resize rect
- 根据 `threshold/candidates` 做 snap
- 产出 `guides`

这导致 `snap` 的输入被迫包含了大量并不属于 snap 的字段。

这些值里，真正属于 snap 的只有：

- 当前待修正的几何结果
- 当前允许吸附的边
- 最小尺寸约束
- 需要排除的节点

不属于 snap 的值：

- `startScreen`
- `currentScreen`
- `startCenter`
- `startRotation`
- `startSize`
- `startAspect`
- `zoom`
- `altKey`
- `shiftKey`

这些都是 transform session 或 resize geometry 的输入，不是 snap 的输入。

---

## 设计原则

### 1. snap 是 interaction runtime，不是组件

snap 的计算发生在 pointer move 热路径里，必须同步、轻量、非 React。

所以：

- 组件只负责渲染 guides
- runtime 负责计算与瞬时状态

### 2. snap 不是 command，不是 read，也不是文档状态

它不属于：

- `instance.commands`
- `instance.read`
- `instance.state`

它属于交互期的瞬时能力，最合适的位置是：

```ts
instance.internals.snap
```

### 3. snap 只接收几何草稿，不接收手势历史

最小输入模型应该是：

- move：待移动的 rect
- resize：待 resize 的 rect + 当前生效的 source edges

### 4. guides 由 snap 自己维护

调用方不应再自己：

- 查询 candidate
- 算 threshold
- 过滤 exclude ids
- 手动写 guides store

调用方只拿回修正后的几何结果。

### 5. 不提前泛化

不要一开始就设计：

- `solve({ kind: 'move' | 'resize' | 'point' | ... })`
- snap session
- 组件内计算
- 多层 adapter

当前长期最优是两个动作：

- `move`
- `resize`

够用再扩。

---

## 最终 API

### 最小公开形态

```ts
type ResizeSnapSource = {
  x?: 'left' | 'right'
  y?: 'top' | 'bottom'
}

type MoveSnapInput = {
  rect: Rect
  excludeIds?: readonly string[]
  allowCross?: boolean
  disabled?: boolean
}

type ResizeSnapInput = {
  rect: Rect
  source: ResizeSnapSource
  minSize?: Size
  excludeIds?: readonly string[]
  disabled?: boolean
}

type SnapRuntime = {
  guides: ReadStore<readonly Guide[]>
  clear: () => void

  move: (input: MoveSnapInput) => Rect
  resize: (input: ResizeSnapInput) => {
    position: Point
    size: Size
  }
}
```

这就是最小长期最优模型。

---

## 为什么这是最小复杂度

### `move(...)` 为什么返回 `Rect`

move 的输入本来就是 rect。

返回 `Rect` 比返回 `{ dx, dy }` 或 `{ position }` 更通用：

- node drag 可以直接取 `x/y`
- 以后其他 rect 交互也能复用
- 不需要调用方再自己重建 rect

### `resize(...)` 为什么返回 `{ position, size }`

当前 transform 提交和 preview 流程天然使用 `position + size`。

所以 resize 返回 `ResizeUpdate` 最直接，避免调用方再做一次 rect -> patch 转换。

### 为什么保留 `disabled`

如果没有 `disabled`，调用方每次都要自己写：

- 是否跳过 snap
- 是否清空 guides
- 是否返回原始几何

这会把同一套分支逻辑重新复制回 drag 和 resize。

保留一个 `disabled`，可以让调用方始终以同一种方式调用 snap runtime：

```ts
snap.move({ rect, disabled: !snapEnabled })
snap.resize({ rect, source, disabled: rotate || alt })
```

这样更简单。

### 为什么不传 `zoom/candidates/threshold`

这些都应该是 runtime 内部依赖，不是调用方输入。

runtime 自己就能拿到：

- `instance.viewport.get().zoom`
- `instance.config.node`
- `instance.read.index.snap.inRect(...)`

如果继续把这些值暴露在 API 上，只会把内部实现细节泄漏出去。

### 为什么不用单个 `solve(...)`

例如：

```ts
solve({ kind: 'move', ... })
solve({ kind: 'resize', ... })
```

表面上少了一个方法名，实际会让：

- 输入 union 变复杂
- 返回 union 变复杂
- 调用方分支变复杂
- 实现内部判断变复杂

两个小方法比一个大而全的方法更简单。

---

## `ResizeSnapInput` 的最终最小模型

最终只需要这 4 类信息：

```ts
type ResizeSnapInput = {
  rect: Rect
  source: {
    x?: 'left' | 'right'
    y?: 'top' | 'bottom'
  }
  minSize?: Size
  excludeIds?: readonly string[]
  disabled?: boolean
}
```

逐项说明：

- `rect`
  - resize 原始几何结果
  - snap 只应该修正这个结果
- `source`
  - 当前是哪一侧在吸附
  - 这是 resize snap 的真实几何语义
- `minSize`
  - snap 可能让尺寸继续缩小，必须保留最小尺寸约束
- `excludeIds`
  - 避免吸附到自身或当前批量变换目标
- `disabled`
  - 统一“禁用吸附 + 清空 guides + 返回原值”的逻辑

除此之外都不应进入 `ResizeSnapInput`。

---

## 推荐实现边界

### 放置位置

推荐新增：

```ts
packages/whiteboard-react/src/runtime/interaction/snap.ts
```

导出：

```ts
export const createSnapRuntime = (...)
```

并挂到：

```ts
instance.internals.snap
```

### 为什么不放到 node runtime

当前 guides 被放在 `instance.internals.node.guides`，这其实语义不纯。

guides 不是 node 专属，它是 snap 的视觉结果。

后续只要有别的交互需要吸附：

- edge route
- selection resize
- 其他 box 类拖拽

都可能复用同一套 guides。

所以 guides 应该从 `node runtime` 收到 `snap runtime`。

---

## 内部实现建议

### 内部依赖

`createSnapRuntime(instance)` 内部自己读取：

- `instance.read.index.snap`
- `instance.viewport.get().zoom`
- `instance.config.node`

### 内部私有 helper

```ts
const readThreshold = () => ...
const readCandidates = (rect, excludeIds) => ...
const writeGuides = (guides) => ...
```

### `move(...)`

内部流程：

1. `disabled` 时清空 guides，直接返回原 rect
2. 根据 zoom + config 算 threshold
3. 扩 query rect
4. 从 `read.index.snap.inRect` 取 candidates
5. 过滤 `excludeIds`
6. 调 `computeSnap`
7. 写 guides
8. 返回修正后的 rect

### `resize(...)`

内部流程：

1. `disabled` 时清空 guides，直接返回 `rect -> { position, size }`
2. 根据 zoom + config 算 threshold
3. 扩 query rect
4. 从 `read.index.snap.inRect` 取 candidates
5. 过滤 `excludeIds`
6. 调 `computeResizeSnap`
7. 写 guides
8. 返回 `{ position, size }`

---

## 对现有链路的简化效果

### 当前 drag

现在 drag 里还要自己做：

- threshold 计算
- query rect
- read.index.snap 查询
- exclude filter
- `computeSnap`
- `guides.write`

收敛后只需要：

```ts
const snappedRect = instance.internals.snap.move({
  rect: movingRect,
  excludeIds: active.members.map((member) => member.id),
  allowCross: active.allowCross,
  disabled: !snapEnabled
})
```

### 当前 resize

现在 resize 里还要自己做：

- `computeResizeRect`
- threshold 计算
- query rect
- candidate 查询
- `resolveResizePreview`
- `guides.write`

收敛后应该变成：

```ts
const raw = computeResizeRect(...)

const update = instance.internals.snap.resize({
  rect: raw.rect,
  source: getResizeSourceEdges(handle),
  minSize,
  excludeIds,
  disabled: altKey || startRotation !== 0
})
```

这比现在明显更简单。

---

## 对 core API 的影响

长期最优里，core 保持纯函数，不感知 runtime store。

推荐保留并复用：

- `computeSnap`
- `computeResizeSnap`
- `getResizeSourceEdges`
- `resolveSnapThresholdWorld`
- `expandRectByThreshold`

不推荐继续把 `resolveResizePreview(...)` 作为长期主入口。

原因：

- 它把 resize geometry 和 snap 混成一个 API
- 导致输入膨胀
- 阻碍 React 侧把 snap 收成独立 runtime

长期最优里，链路应拆成：

1. `computeResizeRect(...)`
2. `snap.resize(...)`

而不是一个大函数全包。

---

## 与组件的职责边界

组件层只负责读：

```ts
instance.internals.snap.guides
```

并负责渲染线条。

组件层不负责：

- 查询 candidate
- 计算 threshold
- 运行 snap
- 存储 snap 状态

所以“让 snap 组件自己负责计算、存储、渲染”不是长期最优。

长期最优是：

- runtime 计算和存储
- component 渲染

---

## 实施顺序

### 阶段 1

- 新增 `createSnapRuntime`
- 将 guides store 从 `node runtime` 挪到 `snap runtime`
- `NodeOverlayLayer` 改读 `instance.internals.snap.guides`

### 阶段 2

- drag 改成只调用 `snap.move(...)`
- 删除 drag 内部 threshold/query/filter/guides 写入逻辑

### 阶段 3

- resize 改成 `computeResizeRect(...) + snap.resize(...)`
- 删除 `transform/session.ts` 里的重复 snap 逻辑

### 阶段 4

- 评估并下线 `resolveResizePreview(...)` 在 React 主链路中的使用

---

## 最终定稿

长期最优、复杂度最低的 snap 设计是：

- `snap` 是 `instance.internals.snap`
- `snap` 不是组件，不是 command，不是 read
- `snap` 只做同步几何修正和 guides 状态维护
- `move` 与 `resize` 分开，不做大 union
- `ResizeSnapInput` 只保留：
  - `rect`
  - `source`
  - `minSize?`
  - `excludeIds?`
  - `disabled?`

其中最关键的判断是：

`ResizeSnapInput` 不应该接收 pointer session 历史值。

它只应该接收“已经算好的 raw rect”和“snap 修正所需的最小几何语义”。
