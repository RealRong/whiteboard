# Whiteboard Draw 最终设计

## 1. 目标

这份文档定义 whiteboard `draw` 的最终定稿。

约束：

- 不考虑兼容成本
- 追求长期最优
- 概念尽量少
- API 尽量短
- 命名尽量清晰直接
- 不引入额外 runtime 概念

本文解决 4 个核心问题：

- `draw` 到底应不应该是 runtime
- `draw session` 到底是什么
- 为什么需要 preview
- `interaction` 模块应该负责到哪里

## 2. 最终结论

`draw` 最优上不应该设计成一个大的 `draw runtime`。

长期最优的最简模型只有 3 块：

- `tool.draw(preset)`：当前工具模式
- `state.draw`：各 draw preset 的持久样式
- `preview`：当前这“一笔”尚未提交前的本地临时可视化

也就是说：

- `draw style` 是状态
- `preview` 是局部临时态
- `pointer` 交互逻辑在 `useBindDrawInput`
- 文档写入只在 `pointerup`

不建议保留：

- `createDrawRuntime`
- `instance.read.draw`
- `instance.internals.draw`
- `draw session` 这个偏大的概念名

如果一定要给“当前这一笔”起名，最好的名字也不是 `draw session`，而是：

- `activeDraw`
- `drawPreview`

## 3. 职责拆分

### 3.1 tool

职责：

- 当前是否处于 draw 模式
- 当前 draw 使用哪个 preset

推荐模型：

```ts
type DrawPreset = 'pen' | 'highlighter'

type Tool =
  | { type: 'select' }
  | { type: 'hand' }
  | { type: 'edge'; preset: EdgePreset }
  | { type: 'insert'; preset: InsertPreset }
  | { type: 'draw'; preset: DrawPreset }
```

说明：

- `tool` 只表达模式身份
- `tool` 不承担样式配置
- `tool` 不承担临时交互数据

### 3.2 draw state

职责：

- 保存每个 preset 的持久样式

推荐模型：

```ts
type DrawStyle = {
  color: string
  width: number
  opacity: number
}

type DrawStyles = Record<DrawPreset, DrawStyle>
```

说明：

- 这是公开共享状态
- toolbar 会读它
- draw input 会读它
- 快捷键、插件未来也可以读写它
- 它不是 runtime

### 3.3 preview

职责：

- 表示当前这一笔尚未提交前的临时显示

推荐模型：

```ts
type DrawPreview = {
  preset: DrawPreset
  style: DrawStyle
  points: readonly Point[]
}
```

说明：

- preview 只用于渲染
- preview 不进入 engine
- preview 不进入文档
- preview 不进入 history
- preview 不应该挂到 instance internals 上供全局消费

### 3.4 active draw

职责：

- 表示本次 pointer 手势中的真实活动数据

推荐模型：

```ts
type ActiveDraw = {
  preset: DrawPreset
  style: DrawStyle
  parentId?: NodeId
  points: Point[]
  lastScreen: Point
  lengthScreen: number
}
```

说明：

- `ActiveDraw` 只存在于 `useBindDrawInput`
- 用 `ref` 保存
- 不进 React 共享状态
- 不进 instance

## 4. 为什么需要 preview

preview 是必要的，但 preview 不等于 runtime。

原因：

- 真正的 draw node 应该只在 `pointerup` 一次性写入文档
- 如果没有 preview，用户从按下到抬起期间画布上什么都没有，体验不成立
- 如果改成 `pointerdown` 先创建 node、`pointermove` 持续改 node，会污染文档写路径

持续写 document 的问题：

- history 会充满临时笔迹变更
- selection / finalize 更复杂
- 协作同步会出现大量临时脏写
- replace / reset / undo 链路更脆弱

所以长期最优不是“去掉 preview”，而是：

- 保留 preview
- 但把 preview 收成局部临时态

## 5. interaction 的职责

`interaction` 应该是 session coordinator，不应该是 canvas event router。

### 5.1 interaction 该负责的

- 一次交互开始后的会话维持
- `pointermove`
- `pointerup`
- `pointercancel`
- pointer capture / release
- `Escape` 取消
- `blur` 取消
- autopan
- document selection lock

也就是：

- 一旦某个 feature 已经决定“这次我接管”
- 后续生命周期交给 `interaction.start(...)`

### 5.2 interaction 不该负责的

- 入口 `pointerdown` 的 feature 分流
- 命中测试和 target 解析
- 哪个 tool 应该接管本次事件
- 普通 click / hover / contextmenu / wheel 路由

这些都依赖具体 feature 和具体 DOM 上下文，不能塞进 `interaction`。

### 5.3 draw 与 interaction 的关系

最优流程：

- `useBindDrawInput` 监听 `pointerdown`
- 发现 `tool.type === 'draw'` 后决定接管
- 接着调用 `instance.interaction.start(...)`
- 后续 move / up / cancel 全交给 interaction

所以不是 interaction 负责全部鼠标事件绑定，而是：

- `pointerdown` 入口：feature hook
- `move/up/cancel` 会话：interaction

## 6. 推荐公开 API

最终推荐只保留这几个公开入口：

```ts
instance.commands.tool.draw(preset?: DrawPreset): void

instance.state.draw: ReadStore<DrawStyles>

instance.commands.draw.patch(
  preset: DrawPreset,
  patch: Partial<DrawStyle>
): void
```

说明：

- `tool.draw(preset)` 只切到 draw 模式
- `state.draw` 只负责样式状态
- `commands.draw.patch` 只负责更新样式

## 7. 为什么用 `patch(preset, patch)`

推荐：

```ts
instance.commands.draw.patch('pen', { width: 4 })
```

不推荐：

```ts
instance.commands.draw.set({ width: 4 }, maybePreset)
```

原因：

- `patch` 清楚表达“部分更新”
- `preset` 显式传入，不依赖当前 tool
- toolbar / 快捷键 / 插件都更容易复用
- API 没有隐式上下文

## 8. 不推荐的 API

不建议保留：

```ts
instance.read.draw.style(...)
instance.internals.draw.preview
createDrawRuntime(...)
```

原因：

- `style` 是状态，不是 read domain
- `preview` 是本地临时态，不该作为全局 internal state 暴露
- `runtime` 这个命名会误导职责，把配置状态和临时会话混在一起

## 9. 最优数据流

### 9.1 WhiteboardCanvas

推荐在 canvas 层本地持有 preview：

```ts
const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null)

useBindDrawInput({
  containerRef,
  setPreview: setDrawPreview
})

<DrawPreview preview={drawPreview} />
```

这就足够了。

不需要：

- `drawPreviewStore`
- `instance.internals.draw.preview`
- `draw session runtime`

### 9.2 useBindDrawInput

推荐最小 API：

```ts
useBindDrawInput({
  containerRef,
  setPreview
})
```

职责：

- 监听 `pointerdown`
- 判断是否由 draw 接管
- 创建 `activeRef`
- 在 move 期间采样点
- 更新 preview
- 在 up 时一次性提交 node

### 9.3 DrawPreview

组件只负责渲染：

```ts
<DrawPreview preview={preview} />
```

它不负责：

- 采样
- 模式判断
- node 创建
- session 管理

## 10. 输入路径

### 10.1 pointerdown

步骤：

1. 判断 `event.button === 0`
2. 判断 `interaction.mode === 'idle'`
3. 判断 `tool.type === 'draw'`
4. 判断 target 在白板容器内且不属于 ignore target
5. 读取当前 container 作用域
6. 从 `state.draw` 读取当前 preset 样式
7. 创建 `activeRef.current`
8. 写入 preview
9. 清空 edit / selection
10. 调用 `interaction.start(...)`

### 10.2 pointermove

步骤：

1. 从 event 读 world point / screen point
2. 按屏幕距离阈值采样
3. 追加到 `activeRef.current.points`
4. 更新 length
5. 合帧更新 preview

### 10.3 pointerup

步骤：

1. 追加最后一个点
2. 长度不足则丢弃
3. simplify
4. resolve stroke
5. `instance.commands.node.create({ type: 'draw', ... })`
6. 成功后选中新 node
7. 清空 preview
8. 清空 `activeRef`

### 10.4 cleanup

在以下场景清空临时态：

- `pointercancel`
- `Escape`
- `blur`
- interaction cancel
- unmount

## 11. 性能原则

最优方式不是把所有点放进 `useState`。

推荐：

- 热路径用 `ref`
- 渲染快照用 `state`

即：

- `ActiveDraw` 存在 `useRef`
- `DrawPreview` 存在 `useState`

如果需要进一步稳住性能，可以在 `useBindDrawInput` 内做一层 `requestAnimationFrame` 合帧，让 `setPreview` 最多一帧更新一次。

这仍然不需要引入新的全局 store。

## 12. 点数控制

`draw` 的点数控制应分成两个阶段：

- preview 阶段：允许较密采样，优先保证手感
- 持久化阶段：必须压缩，优先控制文档体积与 hit-test 成本

### 12.1 行业规范

主流白板产品通常不会把每个原始 pointer 事件点都直接存进文档。

更常见的做法是：

1. 输入阶段允许较密采样
2. 绘制过程中实时显示 preview
3. `pointerup` 时做一次或多次简化
4. 最终只保存“视觉上足够接近”的点列或控制点

这意味着：

- preview 可以点多
- 持久化不能无上限地存点

### 12.2 当前推荐策略

长期最优建议保持为：

- 采样阈值使用屏幕空间阈值
- 提交阈值也使用屏幕空间误差换算到世界空间
- 最终保存简化后的局部点列

也就是：

- 采样手感跟缩放解耦
- 持久化误差跟视觉误差对齐
- 文档不保存原始 world points

### 12.3 采样阶段

采样阶段目标是“顺滑”，不是“最省点”。

建议：

- `pointermove` 时按屏幕距离阈值采样
- 未来如需更顺滑，可选支持 `getCoalescedEvents()`
- 活动笔迹保存在 `activeRef`
- preview 只读当前采样结果

不建议：

- 在采样阶段就过度做重型简化
- 为了省点而牺牲手感

### 12.4 提交阶段

`pointerup` 时必须进行持久化压缩。

推荐顺序：

1. 去掉非法点和重复点
2. 做一次径向简化
3. 再做一次基于线段误差的简化
4. 生成最终 stroke bounding box
5. 将点转成局部坐标后写入 node

这个阶段的目标不是“数学最优”，而是：

- 视觉误差足够小
- 点数足够少
- 实现足够简单稳定

### 12.5 持久化预算

长期最优建议再明确一层“持久化预算”。

建议原则：

- 对普通笔画，按视觉误差阈值压缩即可
- 对超长笔画，再附加一层软上限控制

可选策略：

- 如果简化后点数仍明显过多，则逐步增大 tolerance 再压一次
- 或者设置一个大致目标区间，而不是硬编码极小上限

推荐思路：

- 不做死板的固定点数上限
- 做“误差优先，点数兜底”的二段式控制

这样可以避免两种问题：

- 短笔画被过度压扁
- 超长笔画最终点数过多

### 12.6 为什么要控最终点数

最终点数不只是影响文档大小，还会影响：

- path 渲染成本
- 复制粘贴负载
- hit-test 成本
- marquee / selection 计算成本

尤其对白板来说，draw node 不只是显示，还要参与：

- 选中
- 移动
- 复制
- 分组
- 命中测试

所以“最终点数预算”比“输入点数预算”更重要。

### 12.7 不建议的方向

当前阶段不建议直接改成：

- 存每一个原始 pointer 点
- move 期间持续写 document
- 一开始就上复杂的 bezier 拟合控制点模型

原因：

- 第一种会让数据和 hit-test 膨胀
- 第二种会污染文档写路径和 history
- 第三种会显著增加编辑、命中和实现复杂度

对白板产品来说，长期最优仍是：

- preview 阶段密采样
- 提交阶段轻量简化
- 最终持久化为压缩后的局部点列

## 13. 文件结构建议

最终推荐只保留这些核心文件：

- `packages/whiteboard-react/src/features/draw/state.ts`
- `packages/whiteboard-react/src/features/draw/useBindDrawInput.ts`
- `packages/whiteboard-react/src/features/draw/DrawPreview.tsx`
- `packages/whiteboard-react/src/features/draw/stroke.tsx`

建议删除：

- `packages/whiteboard-react/src/runtime/draw/index.ts`
- `packages/whiteboard-react/src/runtime/read/draw.ts`

理由：

- `draw` 不需要独立 runtime
- `draw style` 不需要额外 read 层
- preview 不应挂到 instance internals

## 14. instance 侧的最终形态

### 13.1 state

```ts
instance.state = {
  tool,
  draw,
  edit,
  selection,
  container,
  interaction
}
```

其中：

- `state.draw` 是公开共享状态

### 13.2 commands

```ts
instance.commands = {
  tool: {
    draw(preset?)
  },
  draw: {
    patch(preset, patch)
  }
}
```

### 13.3 不再存在

```ts
instance.read.draw
instance.internals.draw
```

## 15. toolbar 的正确读法

toolbar 应该读：

```ts
useStoreValue(instance.state.draw)
```

不应该读：

```ts
useStoreValue(instance.internals.draw.style)
```

因为 toolbar 读的是公开产品状态，不是内部会话态。

## 16. 为什么这是长期最优

这套方案的优点：

- 公开 API 少
- 概念少
- 状态与临时态边界清楚
- 没有把 preview 塞进 instance
- 没有把 style 伪装成 runtime
- 没有让 interaction 膨胀成全局输入路由器
- draw 的真正复杂度集中在一个 hook 里
- 以后扩展 pressure / smoothing / eraser 也仍然可以留在 feature 内部

一句话总结：

- `tool` 决定是不是 draw
- `state.draw` 决定怎么画
- `useBindDrawInput` 决定这一笔怎么走
- `preview` 决定用户现在看到什么
- `pointerup` 决定何时把结果写进文档

## 17. 实施顺序

推荐按以下顺序落地：

1. 新建 `features/draw/state.ts`
2. 把 draw style store 和 `commands.draw.patch` 从 `runtime/draw` 挪到 `state.draw`
3. 删除 `runtime/read/draw.ts`
4. 把 toolbar 改成读 `instance.state.draw`
5. 把 `useDrawInput` 改成 `useBindDrawInput`
6. 把 preview 改成本地 `useState`
7. 删除 `instance.internals.draw.preview`
8. 删除 `createDrawRuntime`
9. 清理 instance types 和 read assembly

## 18. 最终定稿

最终定稿可以压成一句话：

`draw` 最优上不是 runtime，而是 `tool + state + local preview`。

其中：

- `interaction` 只负责已开始交互后的 session 协调
- `pointerdown` 入口仍由 feature hook 决定
- preview 只表示“这一笔尚未提交前的临时显示”
- draw node 只在 `pointerup` 一次性提交
