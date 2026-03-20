# Whiteboard Toolbar 设计方案

## 目标

这份方案只回答一个问题：

当前白板产品里，`toolbar` 应该怎么设计，才最符合行业规范，同时又符合我们现在这套架构的长期最优。

这里的“toolbar”分成 3 层：

1. 左侧创建工具栏
2. 选中后的浮动工具栏
3. 右键上下文菜单

长期最优不是把这 3 套东西做成一堆平级按钮，而是严格遵守漏斗原则：

1. 左侧工具栏只负责“我要创建什么 / 我要处于什么模式”
2. popover 只负责“这个工具的预设或变体是什么”
3. 选中浮动工具栏只负责“我已经选中的对象该怎么改”
4. 右键菜单只负责“复制、删除、排列、锁定”这类动作

一句话结论：

1. 一级栏尽量纯图标
2. 变体进 popover
3. 样式编辑进 selection toolbar
4. 不要让同一个概念在 3 个入口重复出现

## 对标结论

这次主要对照了 Miro 和 FigJam 的官方帮助文档，结论非常一致。

### 1. 左侧创建栏是 icon-first

Miro 的 creation toolbar 和 FigJam 的 main toolbar 都是以图标为主，不会把“Rectangle / Ellipse / Triangle”这种文字直接铺在一级栏上。

原因很简单：

1. 一级栏是高频区，目标是扫一眼就点
2. 图形、便签、文本这类对象天然更适合视觉识别
3. 文字应该留给 tooltip、popover、模板卡片

所以：

1. `Shapes` 顶层一定应该是纯图标
2. `Sticky` 顶层一定应该是纯图标
3. `Text` 顶层一定应该是纯图标
4. `Mindmap` 顶层也应该是纯图标

### 2. shapes 的二级面板也应该 icon-first，不应该是纯文字 chip

Miro 的 shape picker、FigJam 的 shapes menu，本质上都是“图形选择器”，不是“文字列表”。

所以 `ShapeMenu` 最优形态不是：

1. Rectangle
2. Ellipse
3. Diamond
4. Triangle

而是：

1. 图标格子
2. 每个格子只表达一个形状
3. 文字只作为 tooltip 或很小的辅助 caption

结论：

1. `ShapeMenu` 不应该继续用纯文字 chips
2. 应该改成 icon grid
3. 只有像 `Callout`、`Highlight` 这类语义不够直观的项，才允许保留小 caption

### 3. text 是独立的一次性创建工具，不需要顶层 popover

Miro 和 FigJam 都把 `Text` 当成独立创建入口：

1. 选中 `Text`
2. 点画布
3. 立即进入编辑

这类工具的预设很弱，真正的样式编辑应该在对象创建后，通过选中工具栏完成，而不是在创建前先弹一堆字体选项。

结论：

1. `Text` 顶层应该是单击即进入插入模式
2. 不需要 `TextMenu`
3. 文本颜色、字号、粗细属于 selection toolbar，不属于 create toolbar

### 4. sticky 的核心变体是颜色，适合 preview grid，不适合文字列表

Miro 和 FigJam 都把 sticky 颜色当成最主要的插入预设，而且都强调“未来创建的 sticky 使用当前默认颜色”。

因此 `StickyMenu` 的最佳形态不是文字列表，而是：

1. 颜色 preview grid
2. 小便签预览块
3. 选中态外圈
4. 顶层按钮可反映当前默认颜色

### 5. mindmap 更像模板型工具，不像几何图形

FigJam 明确把 `Mind maps` 放在 `Shapes` 相关入口里，但使用方式其实更像模板型对象：

1. blank map
2. 从文本生成
3. 从已有节点扩展

Miro 也把它当作独立的创建对象，但它的内核仍然是“带结构的模板”，不是普通 shape。

结论：

1. `MindmapMenu` 不应该做成纯 icon grid
2. 应该做成小型模板卡片列表
3. `Blank` 必须是第一项
4. 其他 preset 应该是语义型模板，比如 `Project / Research / Meeting`

### 6. edge 应该是独立一级模式，不应该塞进 Tool 或 Shapes

这点是当前实现里最明显的异味之一。

`Tool` 的职责应该是导航模式，而不是创建对象。

最符合行业规范的分法是：

1. `Tool` 只管 `select / hand`
2. `Edge` 是独立的持续连线模式
3. `Edge` 的几何预设应该通过二级菜单选择
4. 如果已经有 connect handles 和 quick create，就更不应该把连线模式塞进导航菜单

所以长期最优是：

1. 顶部 `Tool` 不要 popover
2. 顶部 `Tool` 只在 `select / hand` 两态间切换
3. `Edge` 作为单独一级按钮
4. `EdgeMenu` 只负责选择 `Straight / Elbow / Curve`

### 7. disabled 的未来工具不应该占着一级栏

行业产品通常不会在最主入口长期展示一个不可用主工具。

因此：

1. `Freedraw` 作为长期目标可以在设计里保留
2. 但在真正可用之前，不建议正式展示 disabled slot
3. 如果内部开发阶段想保留，可通过 capability flag 控制

## 当前实现的主要问题

结合当前代码，问题主要集中在左侧工具栏。

### 1. LeftToolbar 的一级层级基本对，但二级表达太文字化

当前 `LeftToolbar.tsx` 的一级顺序已经接近正确方向：

1. tool
2. edge
3. sticky
4. text
5. shape
6. mindmap
7. freedraw

但二级菜单的问题很明显：

1. 顶部 `Tool` 不该是 popover
2. `EdgeMenu` 需要成为一等公民
3. `ShapeMenu` 不该是文字 chips
4. `MindmapMenu` 只有标题和描述，没有结构预览

### 2. 顶部 Tool 和连线模式不该混在一起

把 `select / hand` 和连线模式放在同一个入口里，会把“导航状态”和“绘制状态”混在一起。

这不是长期可持续模型，因为后面你会继续遇到：

1. `edge` 到底算导航还是绘制
2. 为什么 sticky / shape / text 是插入，但 edge 还挂在 tool 旁边
3. connect handles 已经存在时，edge 的全局模式怎么和二级预设统一

### 3. ShapeMenu 现在最不符合行业习惯

`ShapeMenu` 现在是两个 section 下的文字 chips。

这会带来 3 个问题：

1. 扫描速度慢
2. 形状的视觉识别优势完全浪费
3. 图形越多，文字列表越不可扩展

### 4. 当前左下角 hint 偏重

现在 insert/draw 模式下左下角会出现“点击画布放置”。

这个提示在开发期有帮助，但正式产品里它太像永久说明文，而不是自然交互反馈。

更优做法是：

1. 用 tooltip + cursor + 预览反馈说明模式
2. 必要时只在首次进入某工具时 transient 提示
3. 不让底部长期悬浮一条固定 hint

### 5. NodeToolbar 方向基本是对的

当前 `NodeToolbar` 反而比 `LeftToolbar` 更接近行业正常形态：

1. 顶栏图标化
2. 具体编辑项放到菜单
3. 多选时按 capability 交集收敛

所以这轮设计的重点不是推翻 `NodeToolbar`，而是把它定为“selection toolbar 的基线”，再把左侧 create toolbar 拉齐。

## 最终信息架构

长期最优建议采用下面这套固定分层。

### 1. 左侧创建工具栏

从上到下：

1. `Tool`
2. 分隔线
3. `Edge`
4. `Sticky`
5. `Text`
6. `Shapes`
7. `Mindmap`
8. `Freedraw`

其中：

1. `Tool` 负责 `select / hand`
2. `Edge` 负责持续连线模式
3. `Sticky / Text / Shapes / Mindmap` 负责一次性插入
4. `Freedraw` 负责持续绘制模式

### 2. 选中浮动工具栏

只负责编辑，不负责创建。

建议维持当前思路：

1. `Fill`
2. `Stroke`
3. `Text`
4. `Group`
5. `Arrange`
6. `Lock`
7. `More`

原则是：

1. 只显示当前 selection 真正支持的能力
2. 顶栏只放图标
3. 大量文字只进入 popover

### 3. 右键菜单

只保留动作类：

1. duplicate
2. delete
3. arrange
4. group / ungroup
5. lock

不要把颜色、字体、形状选择塞进右键菜单。

## 左侧工具栏的最终设计

### 1. 顶层按钮统一规则

所有一级按钮统一遵守：

1. 纯图标
2. 40 x 40 hit target
3. 图标 18px
4. `strokeWidth = 1`
5. hover 只有淡背景
6. active 用更明显但仍然克制的底色
7. tooltip 显示“名称 + 快捷键”

建议 tooltip 文案：

1. `Tool (V / H)`
2. `Edge (X)`
3. `Sticky note (N)`
4. `Text (T)`
5. `Shapes (S)`
6. `Mindmap (M)`
7. `Freedraw (P)`

说明：

1. `M` 给 mindmap 很自然
2. `P` 给 pen / freedraw 比 `D` 更接近行业直觉
3. `V` 和 `H` 保留给 select / hand

### 2. Tool 按钮

`Tool` 是导航按钮，不是创建按钮。

最优交互：

1. 顶层是一个按钮
2. 没有 popover
3. 点击时只在 `Select` 和 `Hand` 之间切换
4. 当前是 `select` 就显示 pointer icon
5. 当前是 `hand` 就显示 hand icon

这里不应该再出现 `Edge`。

### 3. Edge 按钮

`Edge` 是独立一级按钮，不属于 `Tool`，也不属于 `Shapes`。

最优交互：

1. 点击一级 `Edge` 按钮，进入 edge mode
2. 同时打开 `EdgeMenu`
3. `EdgeMenu` 只选择当前连线几何预设
4. 选择后保持 edge mode
5. `Esc` 回到 `select`

`EdgeMenu` 最优内容：

1. `Straight`
2. `Elbow`
3. `Curve`

这 3 个已经足够覆盖大部分白板场景，不需要把内部所有 edge type 一次性暴露给用户。

### 4. Sticky 按钮

`Sticky` 顶层是纯图标，但按钮本身最好反映当前默认色：

1. 图标背景或角标体现当前 sticky 默认色
2. 不用文字
3. 点击后打开 `StickyMenu`

`StickyMenu` 最优形态：

1. 8 色 preview grid
2. 每个 cell 是迷你便签，而不是纯色圆点
3. 默认不显示大标签文字
4. 悬停显示颜色 tooltip
5. 选中态用细外圈

如果未来支持 sticky 类型扩展，比如：

1. square
2. rectangle
3. author label
4. stack

也应该把“类型切换”放在颜色 grid 上方的小型 segmented control，而不是把整个面板做成长列表。

### 5. Text 按钮

`Text` 最优设计非常明确：

1. 一级栏纯图标
2. 不弹菜单
3. 点击后进入 text insert
4. 点击画布即创建 text
5. 创建后立即 focus 并进入编辑
6. 创建完成后回到 `select`

原因：

1. 文本创建是高频快操作
2. 创建前的样式选择会拖慢主路径
3. 文本样式更适合 selection toolbar

### 6. Shapes 按钮

`Shapes` 顶层应该是纯图标，最好能体现“当前默认 shape”：

1. 默认可显示最近一次使用的 shape glyph
2. 如果不想让顶层动态变化，也至少要保持 generic shape icon

点击后打开 `ShapeMenu`。

`ShapeMenu` 最佳结构：

1. 第一组 `Basic`
2. 第二组 `Annotation`

推荐内容：

1. `Basic`: rect / ellipse / diamond / triangle
2. `Annotation`: arrow-sticker / callout / highlight

注意：

1. 每个 item 应优先显示真实形状预览，而不是通用 lucide 图标
2. 对于 `rect / ellipse / diamond / triangle`，用纯 icon 就够
3. 对于 `callout / highlight`，可以保留很小 caption，避免歧义

所以对你最关心的问题，明确结论是：

1. `Shapes` 顶层应该纯图标
2. `ShapeMenu` 也应该以纯图标为主
3. 不是完全禁止文字
4. 但文字只能退到 tooltip 或少量辅助 caption，不应该再是主表达

### 7. Mindmap 按钮

这里有两个选择。

严格按行业平均值：

1. 放进 `Shapes` 或 `More inserts`

按我们当前产品路线的最佳选择：

1. 继续保留顶层 `Mindmap`

我建议最终采用第二种。

原因：

1. 我们不是通用办公板，而是偏结构化白板
2. 当前心智里，mindmap 已经是核心对象，不是附属形状
3. 顶层只有 6 个主入口，并不算拥挤

`MindmapMenu` 不应该用 icon grid，而应该用模板卡片：

1. `Blank map`
2. `Project`
3. `Research`
4. `Meeting`

每张卡片应包含：

1. 小型树状预览
2. 标题
3. 1 行说明

不要只显示纯文字标题，否则用户很难形成“这是结构模板”的感知。

### 8. Freedraw 按钮

长期产品上它应该在左栏。

但当前阶段建议明确区分两件事：

1. 设计里保留这个 slot
2. 实际产品里如果没做好，不要长期显示 disabled

等真正做时，推荐模型是：

1. 顶层按钮进入 draw mode
2. 默认是 last-used pen preset
3. 点击按钮打开 `DrawMenu`
4. `DrawMenu` 中才选 marker / pen / highlighter / width / color

draw 是少数应该“持续保持激活”的工具，不像 sticky/text/shape 那样一次放置后回到 select。

## 选中浮动工具栏的最终设计

### 1. 保持 icon-only 顶栏

当前方向基本正确，建议继续保持：

1. 顶栏只放 icon
2. 菜单里再展开编辑项
3. 不要把 `Fill / Stroke / Text` 直接写在顶栏

### 2. capability-first，不要 node-type-first

selection toolbar 应该继续按 capability 交集收敛：

1. 单选时展示该对象支持的所有主要能力
2. 多选时只展示共享能力
3. 不为每种 node 做一套独立 toolbar

这是最符合漏斗原则的做法。

### 3. selection toolbar 和 create toolbar 不要重复分工

职责必须明确：

1. create toolbar 负责插入前预设
2. selection toolbar 负责插入后编辑

例如：

1. sticky 插入前在 `StickyMenu` 选默认颜色
2. sticky 插入后在 `FillMenu` 调整颜色
3. text 插入前不选字号
4. text 插入后在 `TextMenu` 调字号

### 4. NodeToolbar 里最值得统一的是视觉和菜单 primitive，不是概念扩张

不建议再额外做一个“toolbar domain”去同时托管左栏和 node toolbar。

最小共享应该只是：

1. 视觉 token
2. menu primitives
3. 图标规格
4. palette 顺序

而不是做一个总的 toolbar runtime。

## 行为规范

### 1. 一次性插入 vs 持续模式

建议明确分成两类：

一次性插入：

1. sticky
2. text
3. shape
4. mindmap

持续模式：

1. hand
2. edge
3. freedraw

这样做最符合白板行业里减少模式错误的经验。

### 2. popover 打开规则

建议统一：

1. 点击一级按钮打开对应 popover
2. 选择 preset 后关闭 popover
3. outside click 关闭
4. `Esc` 关闭
5. tool 切换时关闭

不建议：

1. hover 打开
2. split button
3. 同一个按钮一会儿直接插入，一会儿打开菜单

那样概念会变多，学习成本会上升。

### 3. 默认值记忆

建议记住：

1. sticky 默认颜色
2. shape 默认类型
3. edge 默认线型
4. mindmap 默认模板
5. freedraw 默认 preset

不建议记住：

1. text 默认复杂样式

text 的默认创建最好保持克制。

### 4. quick create 比继续加一级按钮更重要

对 shapes 和 sticky 来说，真正影响效率的不是再加更多 toolbar 按钮，而是：

1. 从已选对象快速再创建一个
2. shape quick create 自动连线
3. sticky quick create 快速铺陈

所以长期看，toolbar 只负责起始入口，真正的高速创建应该更多依赖 canvas 上的 quick create。

## 视觉规范

这里遵守我们已经定下来的 notion 风格，不改现有颜色体系。

### 1. 图标

建议：

1. 顶层 rail 和 selection toolbar 的通用图标使用 `lucide-react`
2. 大小统一 18px
3. `strokeWidth = 1`
4. `absoluteStrokeWidth = true`

但要注意：

1. shape variant 不要强依赖 lucide
2. 最终 shape picker 里的图形预览，最好直接画成产品自己的 mini SVG
3. 否则图标和真正插入出来的节点会不一致

### 2. 按钮

建议：

1. 无边框
2. 无按钮阴影
3. hover 只有淡背景
4. active 用更强一点的 surface
5. 键盘 focus 时才出现轻量 outline

### 3. 面板

建议：

1. popover 宽度 220 到 280
2. radius 10
3. 字号 14px
4. section title 11 到 12px
5. 文字用 secondary，不要太重

### 4. rail

建议保留当前基本骨架：

1. 左上悬浮
2. 窄竖栏
3. 两段式分组

但最好把底部 hint 收掉，只保留更轻量的状态反馈。

## 最终方案

如果只保留一套最终推荐方案，我建议就是下面这套：

### 左侧创建栏

顺序：

1. `Tool`
2. divider
3. `Edge`
4. `Sticky`
5. `Text`
6. `Shapes`
7. `Mindmap`
8. `Freedraw`

规则：

1. 一级纯图标
2. `Tool` 无 popover，只切 `select / hand`
3. `Edge` 是独立一级模式
4. `EdgeMenu` 只含 `Straight / Elbow / Curve`
5. `Text` 无菜单
6. `StickyMenu` 用 preview color grid
7. `ShapeMenu` 用 icon grid
8. `MindmapMenu` 用模板卡片
9. `Freedraw` 未完成前不正式展示 disabled

### 选中浮动工具栏

规则：

1. 保持 icon-only 顶栏
2. 菜单继续按能力分组
3. 不和 create toolbar 抢职责
4. palette 和 menu primitive 尽量复用

### 架构边界

规则：

1. `instance` 只保留 `tool` 状态与命令
2. popover 打开关闭、锚点、hover 都留在 React 本地
3. 不新增全局 toolbar runtime
4. create toolbar 和 selection toolbar 只共享最小视觉 primitive

## 实施优先级

如果后面开始落地，建议顺序如下：

### P1

1. `Tool` 去掉 popover，收成 `select / hand` 双态切换
2. 新增一级 `Edge` 与 `EdgeMenu`
3. `ShapeMenu` 从文字 chips 改成 icon grid
4. `StickyMenu` 压缩成更紧凑的 preview grid
5. 收掉左下角长期 hint

### P2

1. `MindmapMenu` 加 mini preview
2. 顶层 `Sticky / Edge` 按钮反映当前默认 preset
3. 顶层 `Shapes` 按钮反映当前默认 preset

### P3

1. `Freedraw` 真正可用后再放回一级栏
2. 加 toolbar drag-to-canvas
3. 加 quick create 和最近使用项联动

## 参考资料

本方案主要参考以下官方资料，结论都已体现在上面的设计中：

1. Miro Toolbars
   - https://help.miro.com/hc/en-us/articles/360017730553-Toolbars
2. Miro Shapes
   - https://help.miro.com/hc/en-us/articles/360017730713-Shapes
3. Miro Text
   - https://help.miro.com/hc/en-us/articles/360017572094-Text
4. Miro Sticky Notes
   - https://help.miro.com/hc/en-us/articles/360017572054-Sticky-notes
5. Miro Mind Map
   - https://help.miro.com/hc/en-us/articles/360017730753-Mind-Map
6. FigJam Explore
   - https://help.figma.com/hc/en-us/articles/15300412458647-Explore-FigJam-files
7. FigJam Sticky notes
   - https://help.figma.com/hc/en-us/articles/1500004414322-Sticky-notes-in-FigJam
8. FigJam Quick create
   - https://help.figma.com/hc/en-us/articles/1500004291601-Build-faster-with-quick-create-in-FigJam
9. FigJam Connectors
   - https://help.figma.com/hc/en-us/articles/1500004414542-Create-diagrams-and-flows-with-connectors-in-FigJam
10. FigJam Mindmaps
   - https://help.figma.com/hc/en-us/articles/18917944627095-Create-mindmaps-in-FigJam
11. FigJam Colors
   - https://help.figma.com/hc/en-us/articles/1500004291341-Apply-colors-in-FigJam
