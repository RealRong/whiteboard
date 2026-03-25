# Shapes 设计方案

## 1. 结论

当前仓库里的 shapes 只够做很轻量的白板标注，不够支撑长期的 diagram / flowchart 场景。

最大的差距不是 shape 数量，而是产品定义还不对：

- 现在的 shape 更像“静态图形 + 展示文字”
- 行业主流产品里的 shape 是“可直接编辑文字的图形容器”

长期最优方向不是继续增加很多零散 node type，而是把 `shape` 收敛成一个统一节点域：

- 文档里只有一个主 shape 节点类型
- 不同形状通过 `kind` 或 `variant` 区分
- 文本编辑、样式、catalog、toolbar、shape switch 共享同一套能力

一句话：

`shape` 应该被定义为“可编辑文字的通用图形节点”，而不是“若干个各自独立的几何节点”。

---

## 2. 当前现状

当前实现的 shape 主要分布在这些文件里：

- [packages/whiteboard-react/src/features/node/registry/default/shape.tsx](/Users/realrong/whiteboard/packages/whiteboard-react/src/features/node/registry/default/shape.tsx)
- [packages/whiteboard-react/src/canvas/toolbar/menus/ShapeMenu.tsx](/Users/realrong/whiteboard/packages/whiteboard-react/src/canvas/toolbar/menus/ShapeMenu.tsx)
- [packages/whiteboard-react/src/canvas/toolbar/presets.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/canvas/toolbar/presets.ts)

### 2.1 当前已支持的 shape

现在左侧菜单里只有 7 个 shape preset：

- `Rectangle`
- `Ellipse`
- `Diamond`
- `Triangle`
- `Arrow`
- `Callout`
- `Highlight`

其中菜单只分两组：

- `Basic`
- `Annotation`

还没有：

- `Flowchart`
- `Containers`
- `Swimlanes`
- `Common symbols`

### 2.2 当前文字能力

当前 shape schema 已经有文本字段：

- 一部分 shape 用 `data.title`
- 一部分 shape 用 `data.text`
- 也支持 `style.color`

但交互能力没有接上：

- shape 没有暴露 `text` control
- 选中 shape 时 toolbar 不会出现 text 菜单
- shape 渲染层不是 `contentEditable`
- shape 也没有 `data-node-editable-field`

所以现在的实际体验是：

- 能显示文字
- 能通过外部 patch 改文字
- 不能像 text/sticky 那样直接进入编辑

### 2.3 当前结构异味

当前 `rect` 是单独实现，其他 shape 又走另一套 SVG 渲染。

这在 shape 很少时问题不大，但一旦补完整 flowchart catalog，会出现三个问题：

- 代码会快速膨胀
- shape 之间文字规则难统一
- toolbar / icon / shape switch 会变得分散

---

## 3. 行业规范研究结论

参考了主流白板与流程图产品的官方文档与产品行为：

- Miro Shapes
  - 官方文档：<https://help.miro.com/hc/en-us/articles/360017730713-Shapes>
- FigJam Shapes With Text
  - 官方文档：<https://help.figma.com/hc/en-us/articles/1500004414382-Visualize-information-using-shapes-with-text>
- Whimsical Flowcharts / Customize Shapes
  - 官方文档：<https://help.whimsical.com/get-started/flowcharts>
  - 官方文档：<https://help.whimsical.com/boards/customize-shapes>

得到的稳定结论如下。

### 3.1 Shape 默认就是可编辑文字容器

这是行业共识，不是附加能力。

主流行为通常是：

- 插入 shape 后可以直接输入
- 已选中 shape 再次点击或回车进入编辑
- toolbar 里能改文字颜色、字号、对齐
- 文本和 shape 共同组成一个对象，而不是两个对象拼起来

### 3.2 基础几何集和流程图集是分开的

行业里不会只做“矩形、圆、菱形、三角形”就结束。

通常会有三层：

1. Basic Shapes
   - rectangle
   - rounded rectangle
   - ellipse / circle
   - diamond
   - triangle
   - hexagon
   - pentagon
   - star
2. Flowchart Shapes
   - terminator / pill
   - process
   - decision
   - data / parallelogram
   - document
   - predefined process
   - manual input
   - cylinder / database
   - internal storage
   - delay
3. Annotation / Callout
   - callout
   - bracket
   - cloud
   - arrow label
   - highlight

### 3.3 Shape resize 的默认文本行为通常是 reflow，不是 text fit

对普通 shape 来说，行业更常见的是：

- resize 改变文本可用区域
- 文本重新换行
- 字号默认不自动缩放

也就是说，普通 shape 更接近“容器文本”而不是 sticky 的 auto-fit。

### 3.4 Change Shape 是高价值能力

主流产品普遍支持：

- 选中当前 shape
- 一键切换成另一种 shape
- 保留已有文字、颜色、描边、大小

这个能力比“第一次就选对 shape”更符合真实工作流。

---

## 4. 和当前实现的核心差距

### 4.1 差距一：shape 不是一等文本节点

这是当前最重要的缺口。

后果：

- 产品体验不达标
- toolbar 的 text 能力无法自然复用
- 用户会觉得 shape 不如 text/sticky 完整

### 4.2 差距二：catalog 太薄，而且分类不对

现在的菜单结构只适合“小白板标注”，不适合“图示工具”。

缺失最严重的是 flowchart 高频 shape：

- terminator
- parallelogram
- cylinder
- document
- predefined process
- hexagon

### 4.3 差距三：shape 域内部没有统一模型

当前更像：

- `rect` 一套
- 其他 shape 一套
- 文字字段还分 `title/text`

长期会导致：

- schema 分叉
- toolbar 判断分叉
- 双击编辑规则分叉
- shape switch 难做

---

## 5. 长期最优目标

目标不是“再补十几个图标”，而是明确 shape 域的产品边界。

### 5.1 产品目标

`shape` 应满足：

- 是一个可直接编辑文字的图形节点
- 适合 basic diagram 与 flowchart
- 可以统一改 fill / stroke / text
- 可以在不同 shape 之间切换而不丢内容
- 菜单、toolbar、快捷键、右键菜单都能共享同一套 metadata

### 5.2 架构目标

`shape` 域应满足：

- 尽量少节点类型
- 尽量少特殊分支
- 尽量少独立 schema
- 尽量少 toolbar 判断

最优方向是：

- 一个 `shape` 节点类型
- 一个 `shape kind registry`
- 一套共享的 text editing 规则

---

## 6. 推荐的数据模型

## 6.1 节点类型

长期最优建议：

- 不再把 `rect / ellipse / diamond / triangle / ...` 做成多个 node type
- 统一成一个 `shape` type

示意：

```ts
type ShapeNode = {
  type: 'shape'
  data: {
    kind: ShapeKind
    text?: string
  }
  style: {
    fill?: string
    stroke?: string
    strokeWidth?: number
    color?: string
    fontSize?: number
    textAlign?: 'left' | 'center' | 'right'
  }
}
```

### 为什么这样最优

- shape toolbar 不需要按 node type 分叉
- text editing 不需要区分 `title/text`
- shape switch 只改 `data.kind`
- summary / icon / filter 都可从 registry 统一读取

## 6.2 文本字段

建议统一成一个字段：

- `data.text`

不要继续在 shape 域里混用：

- `title`
- `text`

原因：

- shape 不是表单卡片
- shape 的核心就是一个主文本区
- 统一字段后编辑、复制、切换 shape 都更简单

## 6.3 Shape Registry

建议建立一个纯描述型 registry：

```ts
type ShapeSpec = {
  kind: ShapeKind
  name: string
  icon: string
  group: 'basic' | 'flowchart' | 'annotation'
  defaultSize: { width: number; height: number }
  textBox: (rect) => Rect
  render: (options) => ReactNode
}
```

这个 registry 只负责：

- 名称
- 图标
- 菜单分组
- 默认尺寸
- 文字安全区域
- 图形渲染

它不负责：

- 编辑状态
- selection
- toolbar 状态

这样职责最干净。

---

## 7. 文字编辑设计

## 7.1 目标行为

普通 shape 的文字行为建议统一成：

- 插入后直接进入编辑
- 已选中 shape 再次点击进入编辑
- 双击也可进入编辑
- 开始输入字符时也可进入编辑

### 这里的关键原则

shape 文本和 text/sticky 可以共享“编辑 surface”，但默认排版规则不同：

- `text`
  - 更自由
  - 宽度可增长
- `sticky`
  - 可以 auto-fit
- `shape`
  - 默认是固定容器内 reflow
  - resize 不自动改字号

## 7.2 shape 的默认文本规则

建议：

- 默认居中
- 支持 left / center / right 对齐
- 多行换行
- overflow 时隐藏或裁剪，不做复杂 text-fit
- 不引入 shape 自动测字号

### 为什么不建议默认 text-fit

因为对 diagram / flowchart 来说，稳定的字号比自动缩放更重要：

- 用户更容易预测布局
- 多个节点放在一起时视觉更稳定
- 更符合 Miro / FigJam / Whimsical 这类 shape 心智

## 7.3 文本编辑入口

长期最优建议用统一规则：

1. 新建 shape
   - 自动选中
   - 自动进入 `edit.start(nodeId, 'text')`
2. 已选中 shape
   - 再次 click 或 Enter 进入编辑
3. 未选中 shape
   - 第一次 click 只选中
4. 当用户直接输入字符时
   - 如果当前是单选 shape，可直接转入编辑并写入首字符

---

## 8. Catalog 设计

## 8.1 第一阶段必须补齐的 shape

如果只做一轮最小但长期正确的补齐，建议先做：

### Basic

- rectangle
- rounded rectangle
- ellipse
- diamond
- triangle
- hexagon

### Flowchart

- terminator
- parallelogram
- cylinder
- document
- predefined process

### Annotation

- callout
- cloud
- bracket

### 当前已有但应重新归类的

- `highlight`
  - 保留
  - 放到 annotation
- `arrow-sticker`
  - 如果保留，也放 annotation
  - 不应作为基础 shape 的代表之一

## 8.2 第二阶段再补的 shape

- pentagon
- star
- octagon
- manual input
- manual operation
- delay
- internal storage
- multi-document
- folder
- package

## 8.3 菜单组织

左侧二级菜单建议固定三组：

- `Basic`
- `Flowchart`
- `Annotation`

不建议一开始就照抄图里全部大 catalog，原因很简单：

- 图标太多会稀释常用项
- 你们当前还没有 shape switch
- toolbar 和 registry 还没统一

更好的顺序是：

1. 先把模型做对
2. 再补第一批高频 shape
3. 最后再扩 catalog

---

## 9. UI 设计建议

## 9.1 左侧 Shape Menu

建议继续用纯图标网格，不带文字主列表。

但 hover / tooltip / aria-label 需要保留名称。

### 推荐结构

- 顶部显示最近使用或当前选中 shape
- 下方按 section 分组
- 每个 item 只显示 glyph

### 不建议

- 在主 grid 中给每个 shape 都加一行文字
- 把 annotation 和 basic 混在一起

## 9.2 Node Toolbar

选中单个 shape 后应出现：

- fill
- stroke
- text
- more

其中 `text` 菜单最少包含：

- text color
- font size
- align left / center / right

如果继续保留现有 toolbar 结构，那么最小改动就是：

- 给 shape 的 `meta.controls` 增加 `text`
- shape schema 统一有 `data.text`
- shape renderer 接入 `data-node-editable-field="text"`

## 9.3 Context Menu

长期应该补一个高价值动作：

- `Change shape`

它的作用是把当前 shape 切成另一个 `kind`，保留：

- text
- fill
- stroke
- size
- position

---

## 10. 推荐的实现顺序

## 阶段 1：先修产品定义

只做 shape 的基础统一，不急着补太多新图形。

### 目标

- 统一成一个 shape 文本模型
- 让 shape 可直接编辑文字
- 让 shape 拥有 toolbar text 能力

### 需要完成

- shape 文本字段统一为 `data.text`
- shape 接入 `meta.controls: ['fill', 'stroke', 'text']`
- shape 渲染层支持 `data-node-editable-field="text"`
- shape 进入编辑行为与 text/sticky 接轨

## 阶段 2：统一 shape registry

### 目标

- 收掉 `rect` 特例
- 建立 `shape kind registry`

### 需要完成

- 统一 shape 的 icon / name / group / defaultSize / render / textBox
- `shape` 插入 preset 从 registry 自动生成
- selection summary / filter / toolbar 使用同一份 meta

## 阶段 3：补第一批 flowchart shapes

优先补：

- rounded rectangle / terminator
- parallelogram
- cylinder
- document
- predefined process
- hexagon

## 阶段 4：支持 Change Shape

### 目标

- 单选 shape 时可以切换 `kind`

### 价值

- 降低用户选择成本
- 让 catalog 扩容后依然好用

## 阶段 5：继续扩 catalog

等前四步完成后，再补大 catalog。

---

## 11. 明确不建议的方案

### 11.1 不建议继续堆很多独立 node type

例如：

- `rect`
- `roundedRect`
- `diamond`
- `process`
- `database`
- `document`
- `manualInput`

全部都做成独立 node type。

这样短期看起来直接，长期会明显变差：

- schema 很多
- toolbar 判断很多
- summary/filter/icon 很多映射
- change shape 几乎必然复杂化

### 11.2 不建议给普通 shape 默认做 text-fit

这会把 shape 和 sticky 的产品语义混在一起。

普通 shape 更适合：

- 固定字号
- 固定容器
- 换行 reflow

### 11.3 不建议先补 30 个 shape 再补文字编辑

顺序反了。

先补 catalog，只会把现有结构的复杂度放大。

---

## 12. 最终建议

如果只允许做一件最关键的事，应该先做：

**把 shape 定义成“可直接编辑文字的统一图形节点”。**

如果允许做第二件事，再做：

**统一 shape registry，收掉 `rect` 特例和多 node type 分叉。**

如果允许做第三件事，再做：

**补完整第一批 flowchart 高频 shapes。**

按这个顺序走，后面无论你是要接近 Miro、FigJam，还是 Whimsical，都不会走偏。
