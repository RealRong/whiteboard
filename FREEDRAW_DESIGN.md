# Whiteboard FreeDraw 设计与实现

## 1. 目标

这份文档定义 whiteboard `freedraw` 的长期最优方案。

目标：

- 左侧 toolbar 增加一级图标入口
- 点击后切到 `draw` 工具，并弹出二级菜单
- 二级菜单用于修改笔样式
- 交互、数据、实现路径一次性收敛

设计前提：

- 不考虑兼容成本
- 优先长期最优
- 概念尽量少
- API 尽量短
- 不引入第二套平行 runtime

## 2. 总结论

`freedraw` 最优上应当被定义为：

- 一个独立工具 `tool.type = 'draw'`
- 一类独立 node `type = 'draw'`
- 一套独立但很小的 draw style runtime

一句话：

- 工具态负责“正在画”
- node 负责“画完后的对象”
- style runtime 负责“当前笔参数”

不建议把 freedraw 做成：

- edge
- 一串 document-level operation
- 纯 overlay 且不落文档的临时图层

因为用户画完以后，行业规范下它就应该是一个可选中、可移动、可复制、可分组的对象。

## 3. 行业规范

主流白板产品中，freedraw 大致遵循以下规范：

### 3.1 工具入口

- 左侧一级 toolbar 有单独图标
- 点击图标进入绘制模式
- 再点一次图标或点击已激活图标，弹出/收起笔设置菜单

### 3.2 绘制行为

- pointer down 开始一笔
- pointer move 连续采样
- pointer up 提交为一个对象
- 绘制过程中显示实时 preview
- 一次笔画只生成一个对象，不在 move 期间持续写 document

### 3.3 绘制结果

- 绘制完成后，通常自动选中新建笔迹
- 笔迹作为普通对象参与：
  - move
  - order
  - duplicate
  - copy / paste
  - group
  - delete

### 3.4 样式菜单

通常最少包含：

- 笔类型
- 颜色
- 粗细

第一阶段不必做：

- 压感
- 纹理笔刷
- 橡皮擦
- 局部擦除

## 4. 产品模型

## 4.1 只保留一个 draw 工具

不建议拆成：

- pen tool
- highlighter tool
- pencil tool

这会把工具栏一级菜单膨胀掉。

最优方案是：

- 一级菜单只有一个 `draw`
- 二级菜单切 preset / color / width

也就是：

- `draw` 是工具类型
- `preset` 是 draw 的内部模式

## 4.2 第一阶段 preset

建议第一阶段只做两个 preset：

- `draw.pen`
- `draw.highlighter`

理由：

- 这是行业里最常见的最小组合
- `pen` 解决普通手写/线稿
- `highlighter` 解决标注感
- 不需要一开始就做 pencil/brush

## 4.3 preset 与 style 的关系

不建议把所有样式都编码进 `tool.preset`。

例如不要做成：

- `draw.pen.black.2`
- `draw.pen.red.4`

这会导致：

- preset 爆炸
- 状态很难扩展
- UI 逻辑和数据语义耦合

正确拆法：

- `tool = { type: 'draw', preset: DrawPresetKey }`
- `draw state = 当前各 preset 对应的 style`

也就是：

- preset 决定行为类型
- style 决定颜色/粗细/透明度

## 5. 最优数据模型

## 5.1 工具态

延续现有 runtime/tool 结构：

```ts
type DrawPresetKey =
  | 'draw.pen'
  | 'draw.highlighter'
```

```ts
type DrawTool = {
  type: 'draw'
  preset: DrawPresetKey
}
```

`tool` 保持轻量，只表达当前模式。

## 5.2 draw style runtime

建议新增最小共享集：

```ts
type DrawStyle = {
  color: string
  width: number
  opacity?: number
}
```

```ts
type DrawState = {
  byPreset: Record<DrawPresetKey, DrawStyle>
}
```

推荐 API：

```ts
instance.read.draw.style(preset?)
instance.commands.draw.set(patch, preset?)
```

解释：

- `read.draw.style()` 默认读当前 preset
- `commands.draw.set(...)` 默认改当前 preset

不要做成：

- `instance.commands.tool.drawStyle.set(...)`
- `instance.state.tool.draw`

因为 `tool` 的职责应保持为“当前工具身份”，而不是承担绘制配置。

## 5.3 文档对象

长期最优建议是单独 node：

```ts
type Node = {
  type: 'draw'
  position: Point
  size: Size
  data: {
    points: Point[]
    baseSize: Size
  }
  style: {
    stroke: string
    strokeWidth: number
    opacity?: number
  }
}
```

说明：

- `position`
  - draw node 的左上角
- `size`
  - 当前显示尺寸
- `data.points`
  - 局部坐标系下的原始点列
- `data.baseSize`
  - 原始坐标空间大小

不建议把点存成世界坐标。

因为：

- move 时必须重写所有点
- resize 时更难收敛
- duplicate / copy / paste 不够优雅

`local points + baseSize` 是长期最稳的模型。

## 6. 绘制算法

## 6.1 输入阶段

pointer move 期间不直接写 document。

推荐流程：

1. pointer down
2. 建立本地 draw session
3. 连续采样 world points
4. 生成 preview path
5. pointer up 时一次性 `node.create`

这符合行业规范，也避免：

- history 膨胀
- document 高频写入
- React 层抖动

## 6.2 采样

推荐按屏幕距离采样，而不是每个原始事件都记。

例如：

- 只有当新点与上一个采样点的屏幕距离超过 `1.5 ~ 2px` 时才入列

原因：

- 体验和 zoom 无关
- 点数更稳定
- 后续平滑和 hit test 更轻

## 6.3 平滑

第一阶段建议：

- 存 polyline points
- 渲染时用平滑 path

也就是：

- 数据是折线
- 显示是平滑曲线

这比“直接存贝塞尔控制点”更稳。

推荐做法：

- 采样后先做 radial simplification
- 渲染时用 quadratic / catmull-rom to bezier

这样：

- 数据简单
- 复制/缩放/命中都更稳定
- 以后也容易做导出

## 6.4 提交

pointer up 时：

- 如果有效点数不足
  - 丢弃
- 否则：
  - 计算 bounds
  - 转成 local points
  - 创建 `draw` node
  - 自动选中新节点

建议同时设一个最小笔画阈值：

- 非常短的点击抖动不生成对象

## 7. 渲染模型

## 7.1 作为 node 渲染

推荐新增默认 node 定义：

- `packages/whiteboard-react/src/features/node/registry/default/draw.tsx`

渲染方式：

- 一个 `svg`
- `viewBox = 0 0 baseSize.width baseSize.height`
- path 根据 `data.points` 生成
- `width/height = 100%`

这样 resize 时天然成立：

- node `size` 变了
- `svg` 自动缩放
- 不必重写点集

## 7.2 stroke 行为

draw node 的 `strokeWidth` 应是对象的一部分，随 zoom 一起缩放，不应该像 handles 一样保持屏幕常量。

这是白板行业规范。

也就是说：

- 笔画是内容，不是 UI chrome

## 7.3 透明度

`highlighter` 建议通过 `opacity` 实现，而不是新做 blend runtime。

第一阶段推荐：

- `pen`
  - opacity = 1
- `highlighter`
  - opacity = 0.3 ~ 0.45

不必第一阶段引入：

- multiply
- mix-blend-mode
- 特殊合成逻辑

## 8. 命中与选择

## 8.1 行业最优

行业最优不是 bbox hit，而是 stroke hit。

也就是：

- 点击笔迹附近能选中
- 点击 bounding box 空白区域不应选中

## 8.2 当前架构下的建议

你当前 node 体系默认偏向 box hit。

要长期最优，建议给 node definition 增加最小命中语义：

```ts
type NodeHit = 'box' | 'path'
```

并让 draw node 走：

- `hit = 'path'`

渲染上使用两条 path：

- visible path
- invisible hit path

其中 invisible hit path：

- `stroke: transparent`
- 更大的 `strokeWidth`
- 只用于 pointer 事件

这和 edge 的 hit path 设计是同一思路，也是长期最优。

## 8.3 第一阶段与最终形态

如果要快速上线，可以先接受 bbox hit。

但从长期最优看，draw node 应尽快切到 path hit。

因为 bbox hit 对自由笔迹体验很差，尤其是：

- 弯折笔画
- 细长笔画
- 中空 scribble

## 9. Toolbar 设计

## 9.1 一级菜单

左侧 toolbar 增加一个图标按钮：

- 建议使用 `lucide-react` 中单支笔图标
- 优先 `PencilLine`
- 若当前版本没有，可退到 `PenTool`

位置建议：

- 放在 `mindmap` 下方或紧邻 `text / shapes` 区域

更推荐：

- 放在 `mindmap` 下方，作为最后一个绘制类工具

因为现有顺序大致是：

- navigation
- edge
- sticky
- text
- shape
- mindmap

`draw` 应属于“创建内容”类，但比 `mindmap` 更轻、更高频。

如果只从白板行业习惯看，最自然顺序是：

- select/hand
- edge
- sticky
- text
- shape
- draw
- mindmap

## 9.2 一级按钮行为

建议行为：

- 当前不在 `draw`
  - 点击：切到最近一次 draw preset，并打开菜单
- 当前已经在 `draw`
  - 点击：切换菜单开合

这和现有 `edge` 一级按钮行为保持一致，概念最少。

## 9.3 二级菜单

建议新增：

- `packages/whiteboard-react/src/canvas/toolbar/menus/DrawMenu.tsx`

组件保持 dumb：

```tsx
<DrawMenu
  preset="draw.pen"
  color="#222"
  width={3}
  onPresetChange={(preset) => ...}
  onColorChange={(color) => ...}
  onWidthChange={(width) => ...}
/>
```

职责：

- 只负责展示
- 不直接读 instance
- 不直接写 instance

这和你现在对 menu 的要求一致。

## 9.4 二级菜单内容

第一阶段建议三段：

### Preset

- Pen
- Highlighter

表现形式：

- 两个大预览行或两个 chip
- 每个预览要能一眼看出线条质感

### Color

- 复用当前项目已有 stroke swatch 色板
- 不新造一套颜色系统

### Width

- 预设档位，不用 slider

推荐档位：

- `1`
- `2`
- `4`
- `8`
- `12`

原因：

- 白板里离散档位比 slider 更稳、更快
- 与 edge/stroke menu 风格一致

## 10. 默认样式

建议默认值：

### `draw.pen`

- `stroke = hsl(var(--ui-text-primary, 40 2.1% 28%))`
- `strokeWidth = 2`
- `opacity = 1`

### `draw.highlighter`

- `stroke = hsl(var(--tag-yellow-foreground, 38.1 59.2% 50%))`
- `strokeWidth = 12`
- `opacity = 0.35`

颜色上优先复用项目现有 token，不新增 draw 专用 token。

## 11. 交互边界

## 11.1 与 selection

draw tool 激活时：

- pointer down 在画布空白处，开始绘制
- 不进入 node press / marquee

draw 提交后：

- 新建 node 成为当前 selection

这和插入 shape / sticky 的“创建后选中”保持一致。

## 11.2 与 edit

draw tool 不进入 edit。

需要明确：

- draw node 没有文本编辑态
- 双击不进入 edit

## 11.3 与 pan

沿用现有全局规则：

- 空格或 hand tool 优先 pan

draw tool 下不建议额外做双指逻辑。

## 11.4 与 copy / paste

draw node 既然是普通 node，就应天然支持：

- duplicate
- copy / paste
- cut

不需要专门为 freedraw 重做 clipboard 协议。

## 12. 实现方案

## 12.1 React runtime

建议新增最小模块：

- `packages/whiteboard-react/src/features/draw/session.ts`
  - 维护当前笔画 session
- `packages/whiteboard-react/src/features/draw/input.ts`
  - 处理 pointer down/move/up
- `packages/whiteboard-react/src/features/draw/components/DrawPreview.tsx`
  - 绘制中的 preview
- `packages/whiteboard-react/src/runtime/draw/index.ts`
  - draw style state / read / commands

这里不要拆得更细。

例如不建议同时再拆：

- `store.ts`
- `selectors.ts`
- `actions.ts`
- `service.ts`

第一阶段没有必要。

## 12.2 node registry

新增：

- `packages/whiteboard-react/src/features/node/registry/default/draw.tsx`

职责：

- 定义 `type = 'draw'`
- 渲染 draw node
- 暴露 schema

schema 第一阶段只需要：

- `style.stroke`
- `style.strokeWidth`
- `style.opacity`

不需要把 `points` 暴露到 schema。

## 12.3 core

如果需要共享算法，建议新增：

- `packages/whiteboard-core/src/node/draw.ts`

职责：

- bounds 计算
- local points 转换
- simplification
- path string 生成辅助

因为 freedraw 最终是 node，而不是 edge，所以这套辅助更适合落在 `node`。

不建议放到：

- `geometry/freehand.ts`
- `utils/freehand.ts`

除非后续确认有跨 node/edge 的复用需求。

## 12.4 instance API

推荐新增：

```ts
instance.read.draw.style(preset?)
instance.commands.draw.set(patch, preset?)
```

以及沿用已有：

```ts
instance.commands.tool.draw(preset?)
```

不要新增：

- `instance.api.draw`
- `instance.runtime.draw`

保持 `state / read / commands` 结构即可。

## 13. 分阶段实施

## 第 1 阶段：最小可用

- toolbar 新增 draw 一级图标
- 新增 `DrawMenu`
- 支持 `draw.pen` / `draw.highlighter`
- pointer 绘制 session
- preview overlay
- pointer up 创建 `draw` node
- 绘制完成后自动选中

这阶段先不做 path hit，允许 bbox hit。

## 第 2 阶段：对象化完善

- draw node 支持 duplicate / copy / paste / group / order
- NodeToolbar / ContextMenu 接入 stroke 样式
- draw node 默认不进入 edit

## 第 3 阶段：命中优化

- node definition 支持 `hit = 'path'`
- draw node 改成 hit path
- 只在笔迹附近响应 pointer down

这一步对体验提升最大，是长期最优的关键。

## 第 4 阶段：变换能力

如果后续需要，再做：

- resize
- rotate

但第一阶段不建议强上。

原因：

- freehand 的首要价值是“画”
- 不是“变换”

如果要加 resize，建议：

- 缩放几何
- 不默认缩放 strokeWidth

## 14. 不建议现在做的事

以下都不建议首版实现：

- 压感
- 多种笔刷纹理
- 擦除器
- 局部节点切割
- SVG path 控制点编辑
- draw 与 edge 合并
- draw 直接写成 edge path

这些都会让第一版模型失焦。

## 15. 最终建议

最终建议非常简单：

- 左侧新增一个 `draw` 一级按钮
- 点击进入 `tool.draw`
- 右侧二级菜单只改 `preset / color / width`
- 绘制时本地 preview，抬笔一次性创建 `draw` node
- `draw` 作为普通 node 存入 document
- 第一阶段先 bbox hit，第二阶段升级成 path hit

这条路线最符合行业规范，也最贴合你当前代码结构。
