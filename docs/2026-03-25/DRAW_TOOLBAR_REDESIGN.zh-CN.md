# Draw Toolbar 重设计

## 1. 目标

这份文档定义 `draw` 左侧 toolbar 的长期最优方案。

目标：

- 对齐你给的参考图：一级入口 + 二级竖向 rail + 三级样式面板
- UI 概念尽量少，不再把 `preset` 同时拿来表示“笔种”和“样式槽位”
- 保持 draw 链路可扩展，但不引入新的大 runtime
- `eraser` 作为 draw 家族能力进入同一套模型
- 后续实现时尽量复用现有 `tool / state.draw / useCanvasDown / node.delete / read.node.idsInRect`

前提：

- 不考虑兼容成本
- 命名优先短、清晰、稳定
- 先按白板产品最优实现，不为历史结构妥协

## 2. 最终结论

draw 最优上应该收成 3 个稳定概念：

- `kind`
  - 当前 draw 家族里的哪一种工具
  - 只有 `pen | highlighter | eraser`
- `slot`
  - 当前 brush 下的 3 个样式槽位之一
  - 只有 `1 | 2 | 3`
- `style`
  - 槽位真正保存的样式数据

也就是说：

- 一级 toolbar 只有一个 `draw` 入口
- 打开后，二级 rail 上半部切 `kind`
- 当前 `kind` 是 `pen / highlighter` 时，二级 rail 下半部切 `slot`
- 当前 `kind` 是 `eraser` 时，不显示 `slot`
- 当前 `kind` 是 `pen / highlighter` 时，显示右侧样式 panel
- 当前 `kind` 是 `eraser` 时，不显示右侧样式 panel
- 只要进入 `pen / highlighter / eraser`
  - 立即清空 `selection / edit`
  - 进入 draw-exclusive 模式
  - 在退出 draw 家族前禁止 selection / edit

`eraser` 不应设计成全局删除工具，而应明确属于 `draw` 家族：

- 它只处理 `draw` node
- 不负责 sticky / text / shape / edge 的删除
- 如果未来要做“全对象橡皮擦”，那应该是另一种工具，不要混进 draw
- 它只表达一个固定行为，不进入样式系统

## 3. 信息架构

## 3.1 一级 toolbar

左侧主栏保留一个 draw 按钮。

行为：

- 当前不在 `draw` 模式时
  - 点击进入 `draw`
  - 恢复上次使用的 `kind`
  - 立即清空 `selection / edit`
  - 打开 draw 菜单
- 当前已在 `draw` 模式时
  - 点击切换 draw 菜单开关

视觉：

- 图标显示当前 `kind`
  - `pen` 显示笔图标
  - `highlighter` 显示荧光笔图标
  - `eraser` 显示橡皮图标
- 如果当前 `kind` 是 `pen / highlighter`
  - 主按钮可带一层当前槽位颜色的轻量 tint
- 如果当前 `kind` 是 `eraser`
  - 主按钮不显示颜色 tint，只显示中性图标

这比固定显示一个铅笔更好，因为用户一眼就能知道自己当前到底是在画笔、荧光笔还是橡皮擦。

## 3.2 二级 rail

draw 菜单打开后，不要再做“一个小菜单 + 再开一个子菜单”的链式结构，而是直接渲染一个固定的组合体：

- 左边窄竖栏：`kind rail + 可选 slot rail`
- 右边样式卡片：只在 brush 下编辑当前样式

这样用户感受到的是三级结构，但代码上只有一个 `DrawMenu` 组件，不需要额外的三套弹层状态。

### rail 上半部

3 个纯图标按钮：

- `pen`
- `highlighter`
- `eraser`

要求：

- 不显示文字
- 有 tooltip
- 当前选中项高亮

### rail 下半部

只在 `pen / highlighter` 下显示 3 个槽位按钮：

- `slot 1`
- `slot 2`
- `slot 3`

每个槽位按钮是一个外圈 + 内点：

- 外圈表示这是一个可切换槽位
- 内点表示当前槽位样式
  - `pen / highlighter`：内点颜色取当前槽位颜色，大小映射当前槽位粗细

当前选中槽位：

- 外圈高亮
- 内点不再额外叠复杂阴影

结论：

- rail 只负责切换
- 右侧 panel 只负责编辑
- 不再在 rail 上出现文字、slider、颜色网格
- `eraser` 下不保留任何隐藏槽位

## 3.3 三级样式 panel

右侧 panel 只在 `pen / highlighter` 下出现。

- `pen / highlighter`
  - 绑定当前 `kind + slot`

### `pen`

显示：

- 顶部粗细 slider
- 下方颜色网格

不显示：

- opacity
- 额外 preset 名称输入
- 自定义复杂高级项

### `highlighter`

显示：

- 顶部粗细 slider
- 下方颜色网格

不显示：

- opacity slider

原因：

- 高亮笔最稳定的产品模型是“颜色 + 粗细”
- 透明度应该由 `kind === 'highlighter'` 固定派生
- 不把 draw 菜单重新做成一个通用样式面板

### `eraser`

不显示右侧 panel。

原因：

- 当前 eraser 是精确命中的 stroke eraser
- 它没有可编辑样式
- 如果继续给它保留 panel，只会制造假能力

## 4. 数据模型

## 4.1 命名修正

当前 `DrawPresetKey = 'pen' | 'highlighter'` 的命名不对，因为它实际上表达的是“笔种”，不是“样式预设”。

最终应该改成：

```ts
type DrawKind =
  | 'pen'
  | 'highlighter'
  | 'eraser'

type DrawSlot =
  | '1'
  | '2'
  | '3'
```

这里：

- `kind` 表示工具类别
- `slot` 只属于 brush，不属于 eraser

不要继续用 `preset` 同时指代这两层概念。

## 4.2 tool 模型

长期最优建议：

```ts
type DrawTool = {
  type: 'draw'
  kind: DrawKind
}
```

而不是：

```ts
type DrawTool = {
  type: 'draw'
  preset: 'pen' | 'highlighter'
}
```

原因：

- `tool` 只应该表达当前交互模式
- `slot` 属于 draw 样式状态，不应塞进 tool
- `tool` 不应再承担样式配置或样式记忆

## 4.3 state.draw 模型

最终建议：

```ts
type BrushStyle = {
  color: string
  width: number
}

type DrawSlots<T> = {
  active: DrawSlot
  slots: Record<DrawSlot, T>
}

type DrawState = {
  pen: DrawSlots<BrushStyle>
  highlighter: DrawSlots<BrushStyle>
}
```

说明：

- `pen / highlighter` 各自有 3 个槽位
- `pen / highlighter` 各自记住自己当前激活的槽位
- 切换到 brush 时恢复该 brush 上次使用的 `slot`
- `eraser` 不进入 `state.draw`

这是最清晰的地方：

- `tool` 管当前模式
- `state.draw` 只管 brush 样式槽位
- 二者职责稳定，不互相污染

## 4.4 派生样式

真正输入时，不应直接消费原始 `state.draw`，而应统一走一个解析函数：

```ts
type ResolvedDrawStyle =
  | {
      kind: 'pen'
      color: string
      width: number
      opacity: 1
    }
  | {
      kind: 'highlighter'
      color: string
      width: number
      opacity: 0.35
    }
```

也就是：

- `pen` 的透明度固定为 `1`
- `highlighter` 的透明度固定为设计值

这样可以把 brush UI 和 brush 输入都挂到同一个解析入口上，不会再在多个地方各自推导 opacity。

`eraser` 不走样式解析，而是直接由输入层消费固定常量：

```ts
const ERASER_HIT_EPSILON_SCREEN = 2
```

也就是：

- `eraser` 没有共享样式
- `eraser` 没有颜色
- `eraser` 没有宽度配置
- `eraser` 只有一个很小的命中容差

## 5. 命令设计

建议把 API 收成下面 3 个写入口：

```ts
instance.commands.tool.draw(kind?: DrawKind)
instance.commands.draw.slot(slot: DrawSlot)
instance.commands.draw.patch(patch: Partial<BrushStyle>)
```

语义：

- `tool.draw(kind)`
  - 切当前 draw 模式
- `draw.slot(slot)`
  - 切当前 brush 的活动槽位
  - 当前 `kind === 'eraser'` 时不会出现在 UI，也不需要调用
- `draw.patch(patch)`
  - 更新当前 brush 槽位样式

为什么不是把 `slot` 塞回 `tool.draw(...)`：

- 那会让 `tool` 带着样式身份到处跑
- 会让 “当前模式” 和 “当前样式选择” 继续耦合

为什么不是继续沿用 `patch(preset, patch)`：

- 因为现在已经不是单层 `preset`
- 继续用旧命名只会让概念越来越脏

为什么不再让 `draw.patch` 每次都带 `kind + slot`：

- 菜单永远在编辑当前 draw 上下文
- 把当前上下文再重复作为参数传下去，只会让调用面变长
- `ToolPalette` 和 `DrawMenu` 都能直接从当前 `tool.kind` 与 `state.draw` 解析出目标

## 6. 默认槽位

建议初始值直接给出：

### pen

- `slot 1`
  - 深色，细
- `slot 2`
  - 蓝色，中
- `slot 3`
  - 紫色，粗

### highlighter

- `slot 1`
  - 黄色，中
- `slot 2`
  - 绿色，中
- `slot 3`
  - 粉色，中

### eraser

- 无状态
- 使用固定命中容差常量

原则：

- 不新造 draw 专属颜色体系
- 直接复用现有 Notion 风格颜色 token
- pen / highlighter 的三个槽位要一眼区分
- eraser 不进入样式系统

## 7. Eraser 设计

## 7.1 产品定义

`eraser` 是 draw 家族工具，不是通用删除器。

它只擦除：

- `node.type === 'draw'`

它不处理：

- text
- sticky
- shape
- group
- edge

原因：

- 这和白板里“笔工具附带橡皮擦”的用户心智一致
- 也最符合我们当前 `draw = 单笔一条 node` 的文档模型

## 7.2 最优擦除模型

当前产品长期最优上，先做 `stroke eraser`，不做 `segment eraser`。

也就是：

- 橡皮擦碰到一条 draw stroke
- 整条 stroke 删除

不做：

- 局部切断
- 一条 stroke 被擦成两段再重新生成多个 node

原因：

- 我们是白板对象模型，不是位图画板
- 当前 free draw 的最小单位本来就是一条 node
- 整条删除可以和 selection / history / collaboration / clipboard 完全对齐

如果未来真的需要局部擦除，那应该单独升级成：

- `eraser mode = stroke | segment`

而不是把 v1 直接做复杂。

## 7.3 命中方式

橡皮擦最优上直接做“point hit”。

单个手势样本的处理模型：

1. 读出上一个点与当前点
2. 读取当前 world point
3. 用一个很小的 screen epsilon 转成极小 query rect
4. 用 `instance.read.node.idsInRect(rect, { match: 'touch' })` 找候选
5. 过滤 `node.type === 'draw'`
6. 将命中的 stroke id 收入当前手势的 `erasedIds`

这里不需要单独造新的 hit 系统，因为当前链路已经有：

- `read.node.idsInRect(...)`
- draw path 的 `matchDrawRect(...)`

因此 eraser 应该完全建立在现有 read 能力上。

这套实现的产品语义是：

- 用户感觉上是“指针碰到才会擦掉”
- 实现上保留一个极小容差，避免数学单点过于脆弱

## 7.4 提交策略

一个橡皮擦手势应该只产生一个 undo step。

因此最优策略是：

- 整个 pointer 手势期间不断累积 `erasedIds`
- 同时把命中的 node 写入 `node.session`
- `useNodeView` 统一读取这些本地 visual 状态
- `NodeItem` 根据 view 决定隐藏或淡化
- `pointerup` 时再一次性提交真正删除

推荐实现：

```ts
type NodeSession = {
  patch?: NodePatch
  hovered: boolean
  hidden?: boolean
}
```

也就是：

- `erasedIds` 只是输入层内部的命中集合
- 真正给 UI 用的预览态走 `node.session.hidden`
- 这样不会新开一条从 `Whiteboard -> NodeSceneLayer` 传临时态的平行路线
- 已提交 node 与本地预览仍然走同一条 `useNodeView -> NodeItem` 渲染链

为什么不直接把 `erasedIds` 从 `Whiteboard` 往下传：

- 那会形成一条新的 prop drilling 预览通道
- 和现有 `node.session` 的本地可视投影并行
- 长期看更容易把“文档视图”和“工具预览”拆成两套

为什么不把 `hidden` 投进底层 `read.node.item`：

- `read.node.item` 应该保持文档真实状态
- `hidden` 只是本地交互预览，不应该污染原始 read
- hit / overlay / selection 等读取真实文档时不该看到“节点真的消失了”

- pointermove 期间累积 `erasedIds`，并写 `node.session.hidden`
- pointerup 时一次性 `node.delete([...ids])`

这样依然有即时消失反馈，而且由于删除只在 `pointerup` 提交一次，当前实现天然就是单手势单 undo。

## 7.5 选择与编辑行为

进入 `pen / highlighter / eraser` 后：

- 不进入 node selection
- 不显示 node chrome
- 进入工具时立即清掉 selection / edit
- 不允许同时进行 text editing
- 不允许通过 pointer 重新进入 selection
- 只有切回 `select / hand / edge / insert` 后，selection / edit 才重新开放

也就是：

- draw 家族工具一旦激活，就是排他的 direct tool

## 7.6 视觉反馈

最简版不做独立 overlay。

原因：

- 当前 eraser 没有宽度语义
- 用户心智是“指针碰到即擦除”
- 额外加 cursor ring 只会制造“它应该有半径”的错觉

## 8. 组件结构

## 8.1 ToolPalette

`ToolPalette` 继续作为一级入口容器，但 draw 部分不再把自己拆成“按钮 + 普通弹层菜单 + 子菜单”。

它只负责：

- 管理 `openMenu`
- 给出 anchor 位置
- 在 `openMenu === 'draw'` 时挂一个 `DrawMenu`

## 8.2 DrawMenu

`DrawMenu` 直接渲染完整组合体：

- `DrawKindRail`
- `DrawSlotRail`
- `DrawStylePanel`

不再拆成多层 menu state。

最优 props：

```tsx
<DrawMenu
  kind={kind}
  slots={slots}
  activeSlot={activeSlot}
  onKind={(kind) => {...}}
  onSlot={(slot) => {...}}
  onPatch={(patch) => {...}}
/>
```

这样：

- `DrawMenu` 不知道 instance
- `ToolPalette` 负责上抛逻辑
- 组件职责最干净

其中：

- `kind === 'eraser'`
  - `activeSlot` 可为 `undefined`
  - `slots` 可为 `undefined`
  - `onSlot` 不会被渲染层触发
  - `onPatch` 不会被渲染层触发

## 8.3 输入层

输入侧建议拆成两条：

- `useDrawInput`
  - 只处理 `pen / highlighter`
- `useEraserInput`
  - 只处理 `eraser`

不要把三种逻辑揉回一个大 hook。

因为：

- `draw` 需要 preview points
- `eraser` 需要 hit + `node.session.hidden`

两者已经不是同一种输入模型。

另外：

- `useEraserInput` 不直接决定最终渲染
- 它只负责：
  - 命中 draw node
  - 维护 `erasedIds`
  - 写入 / 清理 `node.session.hidden`
- 已提交 node 的显示仍然统一走：
  - `useNodeView`
  - `NodeItem`

## 9. 文件改动建议

后续真正落地时，建议改这些点：

- `packages/whiteboard-react/src/runtime/tool/index.ts`
  - `DrawPresetKey` 改成 `DrawKind`
  - `DrawTool` 从 `preset` 改成 `kind`
- `packages/whiteboard-react/src/features/draw/state.ts`
  - 改成 `pen / highlighter` 的槽位状态
- `packages/whiteboard-react/src/runtime/instance/createInstance.ts`
  - tool / draw commands 接新模型
- `packages/whiteboard-react/src/features/toolbox/ToolPalette.tsx`
  - draw 按钮与菜单布局重做
- `packages/whiteboard-react/src/features/toolbox/menus/DrawMenu.tsx`
  - 改成“rail + panel”的组合体
- `packages/whiteboard-react/src/features/draw/useDrawInput.ts`
  - 只保留 `pen / highlighter`
- `packages/whiteboard-react/src/features/draw/useEraserInput.ts`
  - 新增 eraser 输入
- `packages/whiteboard-react/src/features/node/session/node.ts`
  - 增加 `hidden`
- `packages/whiteboard-react/src/features/node/hooks/useNodeView.ts`
  - 读取 `hidden`
- `packages/whiteboard-react/src/features/node/components/NodeItem.tsx`
  - `hidden` 时直接不渲染
- `packages/whiteboard-react/src/canvas/useCanvasDown.ts`
  - 接入 `useEraserInput`

## 10. 分阶段实施

## 阶段 1

先完成模型重命名与状态收敛：

- `DrawPresetKey -> DrawKind`
- `tool.draw(kind)`
- `state.draw` 改为：
  - `pen / highlighter -> active slot + slots`
  - `eraser -> 无状态`

这一步完成后，draw 菜单就不会再继续建立在错误命名上。

## 阶段 2

重做 `DrawMenu` 的 UI 结构：

- 一级主按钮
- 二级 kind rail + brush slot rail
- 三级 style panel
  - 只在 brush 下显示

先不做 eraser 输入，也可以先把 UI 跑通。

## 阶段 3

接入 `eraser`：

- tool
- `node.session.hidden`
- hit & delete

先做 stroke eraser。

## 11. 最终原则

这套方案的关键不是把菜单画得像参考图，而是把 draw 的内部概念一次性理顺：

- `kind` 不是 `preset`
- `slot` 不是 `tool`
- `eraser` 不是全局删除器
- 二级和三级不是两个弹层系统，而是一个组合菜单

只要这 4 点守住，后续实现会比现在明显更稳，也更容易继续扩展。
