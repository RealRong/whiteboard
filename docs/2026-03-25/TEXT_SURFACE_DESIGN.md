# Whiteboard Text Surface Design

## 1. 目标

这份文档定义 whiteboard 里三类文本表面的长期最优设计：

- `text`
- `sticky`
- `shape title`

目标不是讨论某一个局部 bug，而是一次性澄清：

- “拉大文本时字体是否应该跟着变大”
- 不同文本表面到底属于哪一种产品模型
- 哪些行为应该共享，哪些行为必须分开

设计前提：

- 不考虑兼容成本
- 优先长期最优，而不是短期 patch
- 概念尽量少
- 命名尽量短
- 同一类语义只保留一套实现

## 2. 结论

最重要的结论只有一句：

- 普通 `text` 不应在 resize 时自动放大字体

这是因为普通 `text` 的本质应是“排版文本”而不是“缩放对象”。

同时：

- `sticky` 应允许在自动字号模式下随容器变化而改变字号
- `shape title` 默认不应随 shape resize 自动放大字号

也就是说，这三类文本表面不应该共享同一套“放大框 = 放大字”规则。

## 3. 四种产品模型

讨论前先统一术语。

### 3.1 Point Text

特点：

- 以一个点为起点创建
- 本质是自由文本
- 宽度主要由内容决定
- 用户先感知到的是“写字”，不是“画框”

典型行为：

- 点击白板创建
- 输入时宽度先增长
- 到软上限后换行
- 用户手动调整宽度后，可转成 area text

### 3.2 Area Text

特点：

- 宽度是一个明确的排版区域
- 高度通常由内容决定
- resize 的主要语义是“调整排版宽度”

典型行为：

- 改宽度会改变换行
- 不应隐式改变字号

### 3.3 Auto Fit Text

特点：

- 文本是某个容器内容的一部分
- 目标不是严格排版，而是“尽量填满容器且可读”
- 字号可由容器几何反推

典型场景：

- sticky
- 某些卡片类 node
- 某些封面/标题模板

### 3.4 Scale Text

特点：

- 文本被当成一个视觉对象
- resize 的语义是“整体缩放对象”
- 字号、字间距、包围盒都可能一起变化

这类模型在海报、演示、品牌设计里合理，但不应作为白板普通文本默认行为。

## 4. 三类文本表面的最佳归类

## 4.1 `text`

`text` 应定义为：

- 默认是 `Point Text`
- 手动调宽后变成 `Area Text`

不应定义为：

- `Scale Text`

这意味着：

- 创建时给舒适的输入宽度
- resize 改的是排版宽度
- 字号是 typography 属性，不是 resize 副作用

### 为什么不能默认做成 Scale Text

因为这会把两种不同意图混在一起：

- “我想改换行”
- “我想让它更醒目”

一旦默认把 resize 解释成 scale：

- 用户很难预期换行何时变化
- `fontSize` 不再是稳定语义
- toolbar 调字号会和拖拽 resize 打架
- 文本从“可编辑内容”退化成“图形对象”

对白板来说，这不算长期最优。

## 4.2 `sticky`

`sticky` 应定义为：

- `Auto Fit Text`

原因：

- sticky 的首要目标是作为便签卡片承载内容
- 用户对 sticky 的直觉是“卡片变大，字可以更舒展；卡片变小，字要尽量塞进去”
- 这比普通 `text` 更强调“容器优先”

因此 sticky 最优规则应是：

- `style.fontSize` 未设置时：自动字号
- `style.fontSize` 已设置时：尊重手动字号，不再自动 fit

也就是：

- `undefined` = auto
- number = manual

这和普通 `text` 应当明显区分。

## 4.3 `shape title`

`shape title` 应定义为：

- 容器内嵌标签

它既不是 `Point Text`，也不应默认为 `Auto Fit Text`。

长期最优规则是：

- shape resize 改的是容器几何
- 文本只跟着重新布局
- 默认不自动放大字号

原因：

- shape title 本质是 node label，不是卡片内容
- 用户一般希望它稳定、可预测
- “把矩形拉宽一点”通常意味着“多留点空间”，而不是“把标题放大”

所以 shape title 更接近：

- 固定字号 + 自动换行/重新布局

而不是：

- 容器变大，字号也自动变大

## 5. 交互矩阵

## 5.1 创建

### `text`

- 点击即创建
- 默认进入编辑
- 起点是点击位置
- 初始视觉宽度应舒适，不应太窄
- 默认模型是 `Point Text`

### `sticky`

- 创建一个卡片
- 默认进入编辑
- 文本是 sticky 内容的一部分
- 默认使用 auto font

### `shape title`

- 跟随 shape 创建
- 文本是 shape 的属性，不是独立 node

## 5.2 编辑

### `text`

- 输入时先横向增长
- 达到软上限后换行
- blur 后按内容收敛尺寸
- 空文本 blur 直接删除

### `sticky`

- 在固定容器中编辑
- 自动字号模式下，编辑只影响排版，不直接写回字号
- 手动字号模式下，始终尊重显式字号

### `shape title`

- 在 shape 内编辑
- 编辑只改文本内容
- 字号是否变化只由 toolbar / style 显式控制

## 5.3 Resize

### `text`

规则：

- resize 不改字号
- resize 改宽度语义
- 一旦手动 resize，`text` 从 point text 转成 area text

更具体地说：

- 横向 resize：改变宽度
- 高度由内容自动决定
- 不建议把“普通 resize = scale text”作为默认行为

### `sticky`

规则：

- resize 改容器
- auto font 模式下，字号可随容器重新计算
- manual font 模式下，字号不变，只改排版空间

### `shape title`

规则：

- resize 的主体是 shape
- title 只重新布局
- 默认不自动放大字号

## 5.4 Toolbar Font Size

### `text`

- toolbar 改字号是显式 typography 操作
- 不应被 resize 隐式覆盖

### `sticky`

- 当用户显式设字号后，应切到 manual
- 之后 sticky resize 不再自动改字号

### `shape title`

- 只通过显式字号控制改变文本大小

## 6. 数据模型建议

## 6.1 `text`

建议保留一个最小宽度语义：

```ts
type TextWidthMode = 'auto' | 'fixed'
```

含义：

- `auto`
  - point text / content-driven width
- `fixed`
  - area text / width-driven layout

推荐字段：

```ts
node.data = {
  text: string
  widthMode?: 'auto' | 'fixed'
}
```

说明：

- 不需要再引入 `scaleText`
- 不需要再引入第二种 text node type
- 只需要一个最小模式位

## 6.2 `sticky`

建议不引入额外 width mode。

原因：

- sticky 本来就是容器文本
- 容器几何天然就是 layout 边界

字号模式直接用：

```ts
style.fontSize?: number
```

解释：

- `undefined` = auto
- `number` = manual

## 6.3 `shape title`

建议不引入额外数据位。

只保留：

- `data.title` 或 `data.text`
- `style.fontSize?`

shape title 的布局策略由 node renderer 决定，不需要额外模式字段。

## 7. 为什么 `text` 不该默认随 resize 自动放大字体

这个问题本质上是在问：

- `text` 是“内容”
- 还是“视觉对象”

长期最优答案是：

- 默认应是内容

原因有四个。

### 7.1 语义更纯

`fontSize` 应该代表明确的 typography 设定，而不是某次 resize 的副作用。

### 7.2 可预测性更高

用户很容易理解：

- 改宽度 = 改换行
- 改字号 = 改字大小

而不容易理解：

- 改框大小时，为什么字也偷偷变了

### 7.3 更适合编辑态

普通 `text` 是高频编辑对象。

一旦 resize 同时改变字号：

- 光标视觉会跳
- 换行点不稳定
- 编辑态和展示态更难统一

### 7.4 更方便工具栏和批量操作

如果 resize 会偷偷改字号，那么：

- toolbar 里显示的字号会变成“历史副产物”
- 多选时很难做一致的 typography 控制

## 8. 什么时候才适合做 Scale Text

`Scale Text` 不是不能做，但它不该是默认语义。

只有在以下场景才适合：

- 标题模板
- 演示封面
- 贴纸式大字
- 海报/视觉强调对象

如果未来真的要做，最优方式也不是把普通 `text` 的 resize 改掉，而是：

- 单独做 scale 交互
- 或单独做模板化 node

而不是让所有 `text` 都默认 scale。

## 9. 最终推荐

最终推荐矩阵如下：

| Surface | 默认模型 | Resize 是否改字号 | 显式字号后是否停用自动字号 |
| --- | --- | --- | --- |
| `text` | `Point Text -> Area Text` | 否 | 不适用 |
| `sticky` | `Auto Fit Text` | 仅 auto 模式下允许 | 是 |
| `shape title` | `Embedded Label` | 否 | 不适用 |

## 10. 实施顺序

如果后续继续落地，建议顺序如下。

### 第 1 阶段

- 先稳定 `text`
- 明确 `auto / fixed` 宽度模型
- 禁止 `text` resize 隐式改字号

### 第 2 阶段

- 稳定 `sticky`
- 保持 `fontSize?: number` 的 `auto / manual` 语义
- 明确 sticky resize 对 auto font 的影响边界

### 第 3 阶段

- 清理 `shape title`
- 统一为“shape layout changes text layout, not font size”

### 第 4 阶段

- 如果未来确实需要，再新增明确的 scale text 语义
- 但不要反向污染普通 `text`

## 11. 最终原则

最后只保留三条原则：

- 普通 `text` 是排版文本，不是缩放文本
- `sticky` 是容器内容，可以在 auto font 模式下随容器变化
- `shape title` 是嵌入标签，应稳定、克制、可预测
