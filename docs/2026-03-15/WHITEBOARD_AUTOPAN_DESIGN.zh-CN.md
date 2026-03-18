# WHITEBOARD Autopan Design

## 1. 结论

`autopan` 的长期最优模型不是第二个 interaction，也不是 `viewport-gesture` 的一种变体。

它应该是：

- 当前 active interaction 的附属 effect
- 由 session 决定是否启用
- 由一个通用 `pan` runner 负责执行
- 通过 `viewport` 的最小只读/写入能力完成推动

也就是说：

- `node-drag + autopan` 仍然只是 `node-drag`
- `selection-box + autopan` 仍然只是 `selection-box`
- direct pan 才是 `viewport-gesture`

这和当前统一后的 interaction coordinator 模型是一致的：

- `mode` 仍然只有一个
- `spec.pan` 只表达“当前 session 是否允许推动 viewport”
- coordinator 不负责具体 `pan` 计算，也不负责 RAF 驱动

---

## 2. 为什么不能把 autopan 当成 viewport interaction

如果把 autopan 当成第二个 interaction，会立即破坏当前已经整理好的统一语义：

- 同一时刻会出现两个 active interaction
- `mode` 不再是唯一事实源
- `node-drag` / `edge-connect` / `selection-box` 的主语义会被 viewport 抢走
- cancel / finish / reset 的边界会重新变乱

更重要的是，autopan 的本质不是“用户在直接操作 viewport”，而是：

- 用户在执行一个主 session
- 当指针靠近边缘时，session 顺便推动 viewport
- viewport 变化后，session 继续在新的 viewport 下推进自己的 preview

所以它在结构上一定是 effect，而不是 primary interaction。

---

## 3. 真实问题是什么

autopan 的难点不在“调一下 `viewport.panBy`”，而在于下面这件事：

1. 指针进入边缘区域
2. viewport 开始滚动
3. 即使指针停住，viewport 也要继续滚动
4. 每滚动一帧，都必须用同一个 client 点重新计算当前 session 的 preview

因此它不是普通的 `pointermove -> pan`。

它必须是一个 RAF session：

- `pointermove` 只负责更新“最后一次指针输入”
- RAF 每帧决定要不要继续 pan
- pan 之后再用同一份输入重新推进 session

如果没有最后一步，就会出现：

- viewport 已经移动
- 但节点预览 / selection 框 / edge 预览还是旧结果
- 视觉上就像“画布在动，拖拽对象没跟上”

---

## 4. 设计目标

### 4.1 必须满足

- 不引入第二个 interaction
- 不扩张 coordinator 复杂度
- 不把 DOM `containerRef` 到处传进 feature
- 规则统一，避免每条拖拽链路各写一套边缘滚动
- 支持“指针停住但 viewport 继续移动”
- 支持 viewport 移动后 session 继续精确更新

### 4.2 明确不做

- 不把 autopan 塞进 `useViewportController`
- 不把 autopan 做成通用全局开关系统
- 不为所有 session 强行启用 pan
- 不在 coordinator 里内联 drag / edge / selection 的业务推进

---

## 5. 分层

### 5.1 Coordinator

coordinator 继续只保留：

- `mode`
- `current()`
- `tryStart`
- `finish`
- `cancel`

以及内部 `spec.pan`：

```ts
type InteractionSpec = {
  menu: 'allow' | 'block'
  viewport: 'allow' | 'block'
  pan: 'none' | 'viewport'
}
```

这里 `pan` 的意义很窄：

- `none`: 这个 session 不允许边缘推动 viewport
- `viewport`: 这个 session 可以推动 viewport

coordinator 不再往外扩张 autopan 的具体 API。

### 5.2 Viewport

viewport 只负责：

- 读当前 viewport
- 进行 `panBy`
- 做 client / screen / world 坐标转换
- 提供最小的视口尺寸读取

viewport 不负责：

- 判断边缘区域
- 驱动 RAF
- 知道哪个 session 正在拖拽

### 5.3 Session / Runtime

session 自己负责：

- 何时开始 pan runner
- 何时更新最后一次 pointer 输入
- pan 后如何重算 preview
- 何时停止 runner

这部分最适合落在 `runtime/interaction` 下的一个通用小模块中，而不是散落在每个 feature 里重复实现。

---

## 6. 推荐结构

推荐新增一个很小的 runtime 模块，例如：

```ts
runtime/interaction/pan/
```

内部可以只有两层：

1. 纯规则
2. RAF runner

### 6.1 纯规则

只做这件事：

```ts
type PanInput = {
  point: Point
  size: { width: number; height: number }
  threshold: number
  maxSpeed: number
}

type PanVector = {
  x: number
  y: number
}

resolvePanVector(input): PanVector
```

输入是 screen-space：

- `point` 是当前指针 screen 点
- `size` 是当前 viewport 可视尺寸
- `threshold` 是边缘带宽
- `maxSpeed` 是最大屏幕像素速度

输出也是 screen-space：

- `x/y` 表示每秒应推动多少屏幕像素

### 6.2 RAF runner

runner 只做：

```ts
type PanRunner = {
  update(pointer: { clientX: number; clientY: number }): void
  stop(): void
}
```

它内部每帧做的事情是：

1. 用 `clientToScreen` 把最新 client 转成 screen
2. 根据 `viewport.size()` 和边缘规则算 `vector`
3. 如果 `vector` 为 0，停在空转状态
4. 如果 `vector` 非 0，按 `dt` 计算本帧 `deltaScreen`
5. 换算成 world delta，调用 `viewport.panBy`
6. 调用 session 提供的 `onFrame(pointer)`，让 session 在新 viewport 下重算 preview

最关键的是第 6 步。没有它，autopan 不完整。

---

## 7. 为什么规则必须用 screen-space

autopan 的判定和速度都应该只在 screen-space 里做。

原因：

- 用户感受到的是“离画布边缘多近”
- 可视边缘是 screen 概念，不是 world 概念
- 不同 zoom 下，边缘触发行为应该尽量一致
- 速度也应该是“每秒多少屏幕像素”，否则 zoom 一变手感就漂

因此推荐规则是：

- 用指针 screen 点和 viewport 尺寸算与四边的距离
- 每个轴独立求一个 `[-1, 1]` 的强度
- 再乘上 `maxSpeed`

推荐不要做得太复杂，最简单的二次曲线就够了：

```ts
strength = ((threshold - distance) / threshold) ^ 2
```

然后：

- 靠左边：`x = -strength * maxSpeed`
- 靠右边：`x = strength * maxSpeed`
- 靠上边：`y = -strength * maxSpeed`
- 靠下边：`y = strength * maxSpeed`

这样越贴边越快，离开边缘立刻归零。

---

## 8. Viewport API 建议

当前 viewport 已经有：

- `get()`
- `panBy(worldDelta)`
- `clientToScreen(clientX, clientY)`
- `pointer(event)`
- `screenToWorld(point)`
- `worldToScreen(point)`

但通用 autopan runner 还缺一个最小只读能力：

```ts
size: () => { width: number; height: number }
```

推荐只补这个，不要暴露更重的 `rect()`。

原因：

- runner 只关心可视宽高
- `left/top` 已经被 `clientToScreen` 吃掉了
- 暴露完整 rect 会让 API 变重
- feature 不需要知道 DOM 布局细节

所以 viewport 最终最小接口建议是：

```ts
type WhiteboardViewport = {
  get(): Viewport
  subscribe(listener): () => void
  set(viewport): void
  panBy(deltaWorld): void
  zoomBy(factor, anchor?): void
  zoomTo(zoom, anchor?): void
  reset(): void
  size(): { width: number; height: number }
  clientToScreen(clientX, clientY): Point
  pointer(input): ViewportPointer
  screenToWorld(point): Point
  worldToScreen(point): Point
}
```

这已经足够支撑通用 pan runner，不需要额外再为 autopan 增加 viewport 专用 API。

---

## 9. Session 接口建议

runner 不应该知道 node/edge/selection 的业务数据，它只需要一个极小桥接接口：

```ts
type PanSession = {
  updatePointer(pointer: {
    clientX: number
    clientY: number
  }): void
  stop(): void
}
```

但仅有 `updatePointer` 不够，runner 还要能在每次 pan 后重新推进 session。

所以更完整的最小桥接应该是：

```ts
type PanDriver = {
  update(pointer: {
    clientX: number
    clientY: number
  }): void
  stop(): void
}
```

创建时由 session 提供：

```ts
createPanDriver({
  viewport,
  enabled: () => boolean,
  onFrame: (pointer) => void
})
```

其中：

- `viewport` 提供读写和坐标换算
- `enabled()` 决定当前 session 是否还允许继续 pan
- `onFrame(pointer)` 是 pan 后重算 preview 的回调

如果希望继续压缩 API，也可以把 `enabled` 去掉，只保留：

- `update(pointer)`
- `stop()`
- `onFrame`

session 在结束时自己 `stop()` 即可。

---

## 10. 各条链路的适配成本

### 10.1 Selection Box

文件：

- [useSelectionBox.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/ui/canvas/input/useSelectionBox.ts)

这条链路最容易接。

当前已经是：

- `start.world + current.world` 用于命中
- `start.screen + current.screen` 用于框选可视框

因此只要在 pan 帧里：

1. 用最后一次 client 重新调用 `viewport.pointer(...)`
2. 重算匹配节点
3. 重算 draft rect

就天然成立。

### 10.2 Edge Connect

文件：

- [useEdgeConnect.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/edge/hooks/connect/useEdgeConnect.ts)
- [math.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/edge/hooks/connect/math.ts)

这条链路也很好接。

当前预览本来就是：

- 读 `pointer.world`
- 做 snap target 查询
- 重算 preview line / snap point

autopan 后只需要在每帧拿同一个 client 重新求 `pointer.world`，再刷新 draft 即可。

### 10.3 Edge Routing

文件：

- [useEdgeRouting.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/edge/hooks/routing/useEdgeRouting.ts)

当前是标准 world anchor 模型：

- 开始时记录 `start.world`
- 后续根据当前 `world - start.world` 推导 routing point

所以它也可以平滑接入 autopan。

### 10.4 Mindmap Drag

文件：

- [useMindmapDrag.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/mindmap/hooks/drag/useMindmapDrag.ts)
- [math.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/mindmap/hooks/drag/math.ts)

mindmap drag 当前本质上也是 world 推进：

- root drag 根据 `world - start`
- subtree drag 根据 `world` 重算 ghost / drop

因此结构上没有障碍。

### 10.5 Node Transform

文件：

- [session.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/node/hooks/transform/session.ts)

这条链路建议先不要接。

原因：

- resize 是明显的 screen-space 交互
- rotate 通常不需要边缘推动 viewport
- 实际收益不高
- API 上让 `node-transform` 保持 `pan: 'none'` 更干净

### 10.6 Node Drag

文件：

- [session.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/node/hooks/drag/session.ts)
- [math.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/node/hooks/drag/math.ts)

这是当前唯一必须先改模型的一条链路。

现在 `node-drag` 的核心位置推导是：

```ts
basePosition = origin + (client - startClient) / zoom
```

这个公式隐含前提是：

- 拖拽过程中 viewport 不变

一旦 autopan 生效，会出现：

- 指针 client 没变
- viewport 已经变了
- 但公式仍然认为 world 位移没变

结果就是拖拽对象和 viewport 不同步。

因此 `node-drag` 的长期最优做法不是补丁，而是直接改成 world anchor 模型。

推荐改法：

- 开始时记录 `startWorld`
- 或者记录 pointer 与 anchor 的 world offset
- 每次都根据当前 `pointer.world` 求 anchor 位置

一旦改成这样，viewport 在 session 中怎么移动都不影响拖拽语义。

---

## 11. 为什么不把 containerRef 传进每个 feature

表面看，autopan 只需要 container rect，于是似乎可以把 `containerRef` 传给每个 feature 自己算。

但长期这是更差的方案：

- DOM 依赖扩散到 node / edge / selection / mindmap 各条链路
- 每条链路都可能重复写 `getBoundingClientRect()`
- 不同 feature 可能出现不同的边缘规则
- React hook 组合会变重
- 非 React host 更难复用

更优做法是：

- viewport 统一维护容器信息
- 只暴露最小 `size()`
- 其他一切都走统一 pan runner

这样 DOM 依赖仍然集中在 viewport runtime。

---

## 12. 与 useWindowPointerSession 的关系

当前 [useWindowPointerSession.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/interaction/useWindowPointerSession.ts) 只负责：

- 在指定 `pointerId` 活跃期间，转发 window pointer/keyboard/blur 事件

它本身没有问题，但它不解决 autopan 的核心需求，因为：

- autopan 需要在“没有新 pointermove”的情况下继续跑

所以最佳方式不是改造 `useWindowPointerSession` 本体，而是：

- session 继续用它接收真实 pointermove
- pan runner 独立跑 RAF
- pointermove 只负责更新 pan runner 的最后输入

这样职责最清楚。

---

## 13. 与 direct viewport gesture 的边界

direct pan:

- 用户主动拖动画布
- mode 是 `viewport-gesture`

autopan:

- 用户在执行其他 session
- viewport 只是附属 effect
- mode 保持原 session

这两个路径都可以调用 viewport 写接口，但语义完全不同，不能合并。

这也是为什么不建议把 autopan 塞进 `useViewportController` 主体：

- `useViewportController` 是 direct viewport input runtime
- autopan 是 generic interaction effect runtime

把两者混在一起会把边界重新做乱。

---

## 14. 推荐落地顺序

### 阶段 1

补 viewport 最小只读能力：

- `size()`

### 阶段 2

实现通用 `pan` 规则和 RAF runner。

### 阶段 3

先接最容易验证的链路：

- `selection-box`
或
- `edge-connect`

### 阶段 4

扩展到：

- `edge-routing`
- `mindmap-drag`

### 阶段 5

重写 `node-drag` 的坐标模型为 world anchor，再接 autopan。

### 阶段 6

如果需要，再统一检查 `spec.viewport` 与 wheel / direct viewport input 的屏蔽规则是否完全一致。

---

## 15. 最终建议

最终最优方案可以收敛成一句话：

> `autopan` 是允许推动 viewport 的 session effect；统一规则在 `runtime/interaction/pan`；判定和速度用 screen-space；viewport 只补 `size()`；session 在每次 pan 后用同一份 client 输入重新推进 preview；`node-drag` 先切到 world anchor 模型再接入。

这套方案的优点是：

- 不破坏现有 interaction 统一模型
- 不把 coordinator 再次做重
- 不把 viewport runtime 变成杂物间
- 不让 DOM 依赖扩散到 feature
- 可以先接容易的链路，再单独处理 `node-drag`

这也是当前代码状态下风险最低、长期最干净的实现路径。
