# Whiteboard 自动字体缩放设计

## 结论

`sticky` 和 `text` 随内容、节点尺寸自动调整字号，这在 Miro 风格白板里很常见，尤其是 `sticky`。

它不是所有编辑器的统一行业规范，但对“对象式白板”来说是非常合理的默认行为。

我的建议：

1. `sticky` 默认启用自动字号
2. `text` 也默认启用自动字号
3. 同时保留手动字号模式

也就是统一成：

1. `auto`
2. `manual`

两种模式。

## 为什么值得做

优点很明确：

1. 新建卡片时文字更大，更像 Miro
2. 内容变多时能自动缩小，不容易溢出
3. 卡片 resize 变大时文字能跟着放大，整体质感更强
4. 用户不需要一直手动调字号

如果 whiteboard 的产品方向是 Miro-like，这个能力值得做。

## 当前状态

现在的模型本质上还是固定字号：

1. `fontSize` 放在 `node.style.fontSize`
2. renderer 直接读取这个值
3. toolbar 里的字号菜单也直接改这个值

也就是说，当前没有“自动字号”这个概念。

## 最优状态模型

当前阶段不需要再引入单独的 `textFit` 字段。

最简单、也最干净的模型就是只保留：

```ts
node.style.fontSize?: number
```

语义直接定成：

1. `style.fontSize === undefined`
   - `auto`
2. `style.fontSize` 是数字
   - `manual`

渲染层派生：

```ts
resolvedFontSize = style.fontSize ?? autoFitFontSize(...)
```

也就是：

1. document 只存手动值
2. 自动模式不额外存状态
3. 自动字号是渲染派生值

## 为什么不要把自动字号写回 document

因为那会让状态语义变脏。

一旦自动 fit 的结果被持续写回 `style.fontSize`，后面你就无法区分：

1. 这是用户手动设置的字号
2. 还是系统根据卡片大小和文本内容算出来的字号

长期最优应该是：

1. document 只存手动字号
2. `fontSize` 未设置时即视为 `auto`
3. 自动模式下的实际字号是渲染派生值

### 明确不采用的方案

不建议使用这类模型：

```ts
style.fontSize = "auto-16px"
```

原因：

1. `fontSize` 本来应该是数值字段，这样会把类型弄脏
2. 一个字段同时承载了“模式”和“值”两层语义
3. 现有读取链路都把 `fontSize` 当数字处理，改成字符串会让 API 质感明显变差
4. 大量节点初始化时如果把自动测量结果持续写回 document，会引入大量无意义的 commit

所以这里要明确：

1. 自动字号不写回 document
2. document 里只保留用户手动设置的 `fontSize`

## 默认策略

我的建议很简单：

### Sticky

默认：

1. `style.fontSize` 不设置

原因：

1. 这是最符合 sticky note 心智的行为
2. Miro 也是这个方向

### Text

默认：

1. `style.fontSize` 不设置

前提是你们把 `text` 定义成“白板上的文本框对象”。

如果未来你们想把 `text` 做得更接近“自由文本”，那才考虑默认改回 `manual`。

按照现在这套 Miro-like 路线，我更建议默认 `auto`。

## 用户手动调字号时的规则

一旦用户在 toolbar 里手动点了字号，例如 `12 / 14 / 18 / 24`，推荐行为是：

1. 写入 `style.fontSize = value`

这就已经天然表示切到 `manual`。

如果用户想切回自动，推荐行为是：

1. 删除 `style.fontSize`

也就是：

1. `manual -> auto` = unset `fontSize`
2. `auto -> manual` = set `fontSize`

toolbar 可以提供一个简单入口：

1. `Auto`
2. 具体字号选项

## 实现方式

### 不推荐

不推荐用“按字符数猜字号”的粗略 heuristic。

原因：

1. 中英文宽度不一样
2. 换行会影响高度
3. 长单词、emoji、空行都容易把估算搞偏

### 推荐

推荐使用：

1. 真实测量
2. 二分求字号

输入：

1. 节点内容文本
2. 节点宽高
3. 节点 padding
4. 字号上下限
5. 行高

输出：

1. 一个能完整放进内容框内的最大字号

也就是：

1. 给定 box
2. 给定 text
3. 求最大可容纳字号

这个模型最稳定。

### canvas 能不能用

可以用，但不建议把 `canvas.measureText()` 当最终真值。

更适合的定位是：

1. 单行文本预估
2. 初始字号猜测

但对 `sticky/text` 这种多行自动换行文本，最终结果更应该以 DOM 实际排版为准。

原因：

1. 真正要拟合的是浏览器最终布局结果，不只是字符宽度
2. `canvas` 不天然等价于真实的多行换行、高度、行高、fallback font 行为

所以第一版最优方案仍然是：

1. DOM 实测
2. 二分求字号

而不是纯 `canvas` 测量。

## 推荐的实现落点

### 渲染层

最佳落点在 `whiteboard-react` 渲染层。

原因：

1. 这是纯展示策略
2. 依赖真实 DOM/CSS 文本布局
3. engine 不应该感知“字体如何 fit 到盒子里”

### renderer / hook

推荐新增一个局部语义层，例如：

1. `useResolvedTextStyle`
2. `useAutoFontSize`

职责只做一件事：

1. 根据 node、rect、text、mode 算出 `resolvedFontSize`

然后 renderer 直接消费它。

### runtime cache

自动字号的测量结果应该放在 runtime cache，而不是写回 document。

推荐模型：

1. document 只存 `style.fontSize?: number`
2. runtime 层维护 `resolvedFontSizeCache`

缓存内容可以是：

1. `nodeId -> resolvedFontSize`

或者更稳一点：

1. `signature -> resolvedFontSize`

其中 `signature` 由这些输入组成：

1. 文本内容
2. 节点宽高
3. padding
4. font family
5. font weight
6. line height
7. 颜色以外会影响排版的样式

核心原则：

1. cache 是性能优化
2. cache 不进入 document
3. cache 不进入 history / sync / commit 语义

### 不建议放 engine

engine 不适合做这件事，因为：

1. 它不知道浏览器的真实文本排版结果
2. 自动字号是 UI policy，不是文档语义内核

## 和当前 autoMeasure 的关系

你们现在已经有 `autoMeasure`，它会在内容变化后通过 `ResizeObserver` 把节点尺寸写回去。

自动字号和它的关系需要定一个明确优先级。

### Sticky / Text 的推荐优先级

我建议：

1. 节点尺寸是主输入
2. 自动字号去适配当前尺寸
3. 不再让字号变化反过来无限驱动节点尺寸变化

也就是说：

1. `resize node` -> `recompute font size`
2. `edit text` -> `recompute font size`

而不是：

1. `font size changed` -> `node size changed` -> `font size changed` -> 循环

### 这意味着什么

如果 `text/sticky` 走自动字号模式，长期更合理的是：

1. 它们不再依赖当前的“内容撑开节点尺寸”模式
2. 节点尺寸应更偏对象尺寸，而不是纯内容尺寸

这是一个产品取舍。

如果你们要完全像 Miro，我更推荐：

1. sticky/text 的节点尺寸是对象尺寸
2. 自动字号负责把内容塞进对象尺寸里

而不是继续让内容主导尺寸。

## 大量 sticky 初始化时的性能策略

如果白板里有大量 `sticky`，初次挂载时逐个做精确 DOM 测量，确实可能卡顿。

但正确优化方向不是把自动字号结果写回 `style.fontSize`，而是优化测量调度。

### 首帧策略

首帧不要同步精测全部节点。

推荐：

1. 先给一个便宜的默认字号或粗估值
2. 先完成首屏渲染
3. 后续再渐进精修

### 可见区优先

推荐只优先精测：

1. 当前 viewport 内节点
2. 视口附近的节点

不要一开始就精测整张白板所有 sticky。

### 分帧批处理

推荐把测量任务拆成批次：

1. 每帧只处理少量节点
2. 剩余任务排到后续帧

这样可以避免单帧卡顿。

### 缓存复用

如果下列输入没有变化，就直接复用上次结果：

1. 文本内容
2. 节点尺寸
3. padding
4. 影响排版的字体样式

### 第一版建议

第一版不要过度优化，先采用下面的顺序：

1. 首帧默认字号
2. 可见区渐进精测
3. runtime cache

等这版稳定后，再决定要不要补：

1. `canvas` 初值预估
2. 更复杂的调度器
3. 本地持久化 cache

## 最小可落地版本

如果先做第一版，我建议范围控制成：

1. 只给 `sticky` 和 `text` 做
2. 默认 `auto`
3. toolbar 里手动选字号即写入 `style.fontSize`
4. 提供一个 `Auto` 入口用于删除 `style.fontSize`
5. `manual` 下沿用现有 `style.fontSize`
6. `auto` 下使用渲染派生字号

先不要扩展到：

1. shape label
2. group title
3. mindmap 文本

这样边界最干净。

## 一句话结论

这个能力值得做，而且不算特别难，但前提是模型要对：

1. 不新增 `textFit`
2. `fontSize` 未设置即 `auto`
3. `fontSize` 有值即 `manual`
4. 自动字号做渲染派生值
5. 自动测量结果只进 runtime cache，不写回 document
6. `sticky/text` 默认 `auto`

如果这样做，概念最少，也最像 Miro。
