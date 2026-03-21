# Multi Selection Design

更新时间：2026-03-21

## 目标

当前多选的主要问题不是功能缺失，而是交互模型不对：

- 多选后给每个 node 都渲染一套 handles，视觉噪音大
- 用户真正想操作的是“这批对象的整体”，不是每个对象各自的 transform box
- 批量 resize、批量 rotate、按类型筛选，缺少一个统一的 selection-level 模型
- `node type -> 名称 / 图标 / 类别` 目前没有统一元数据源，后续 filter、右键菜单、统计摘要都会重复写映射

长期最优目标：

- 多选的主操作对象是一个整体 selection box
- 每个 node 仍可有轻量 membership indicator，但不再有逐节点 handles
- 批量 transform 是 selection-level 交互，node-level 只是参与计算
- filter 是“精炼当前选择”的能力，不是新的全局模式
- `type -> name/icon/category` 成为 registry 的一部分，作为所有 UI 的唯一来源

## 行业观察

### 1. 多选的主 affordance 是整体 bounding box

主流白板/设计工具的共同点不是“完全没有每个对象的蓝框”，而是：

- 稳态多选时，主 transform affordance 是一个整体 selection bounds
- per-node outline 可以存在，但只是 membership indicator，不是主操作手柄
- resize / rotate / move 的入口挂在整体 selection bounds 上

参考：

- Miro 官方帮助《Working with objects》在 2025-08-08 更新，明确写到“选中的对象可以一起 move 和 resize”，并且支持 filter by object type：
  - https://help.miro.com/hc/en-us/articles/360017730953-Working-with-objects
- FigJam 官方帮助《Resize, rotate, and flip objects in FigJam》说明对象通过 bounding box resize / scale：
  - https://help.figma.com/hc/en-us/articles/1500006206242-Resize-rotate-and-flip-objects-in-FigJam
- Figma 官方帮助《Select layers and objects》明确写到多选对象会被一个 blue bounding box 包住，并支持 bulk edit：
  - https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
- tldraw 官方文档把 indicator 明确定义为独立于 shape visual appearance 的系统，并且 Editor 暴露 `getSelectionPageBounds()` / `getSelectionRotation()`：
  - https://tldraw.dev/docs/indicators
  - https://tldraw.dev/reference/editor/Editor

结论：

- “多选显示一个大 box”是行业主流
- “每个对象都显示 handles”不是主流稳态交互
- “每个对象是否有淡 outline”可以保留，但它应该是 secondary，而不是 transform affordance

### 2. 精确框选和按类型过滤是成熟能力

Miro 官方帮助同一篇文档里给了两个很重要的行为：

- `precise selection`: 长按后框选，只有覆盖 90%+ 才算选中
- `object filter`: 先框选，再按类型过滤，只保留某类对象

这说明：

- selection 不只是 `ids`
- selection 还应该支持 refinement
- refinement 的维度首先就是 object type

这和你现在的直觉是一致的：`filter` 不应该是独立系统，而应该是 selection 的后处理

### 3. 类型元数据在成熟产品里一定是显式存在的

Figma 官方帮助《Select layers and objects》提到 “Select layer menu 会按 Layers panel 的顺序展示 layer name 和 icon”。

参考：

- https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects

Figma Developer Docs 也把 node type 明确做成了官方枚举。

参考：

- https://developers.figma.com/docs/plugins/api/nodes/

结论：

- 真实产品里一定有 `type -> display name / icon / category` 的元数据层
- 这层元数据不能散落在 toolbar、menu、filter 各自的 switch/case 里

## 对当前实现的判断

当前 whiteboard-react 里：

- selection 已经有 `box`
- toolbar 已经是挂在 `selection.box` 上的
- 但 overlay 仍然对 `selection.target.nodeIds` 逐个渲染 `NodeTransformHandles`
- registry 只有 `label`，没有 `icon / family / plural / filter meta`

这导致两个结构性问题：

1. 选择模型和变换模型不一致

- toolbar 把 selection 视为整体
- handles 却把 selection 视为若干独立 node

2. 类型信息没有统一来源

- 插入菜单、工具栏、后续 filter、右键菜单摘要，都容易各自维护一套文案/图标/分组

## 最终设计

### 一、Selection 分三层，不再混在一起

#### 1. membership

这批对象是谁：

- `nodeIds`
- `edgeIds`

#### 2. summary

这批对象由什么组成：

- 总数
- 按 type 聚合的 count
- 每种 type 的 name / icon / category
- 是否 mixed

#### 3. transform

这批对象整体能做什么：

- `box`
- `rotation`
- `move`
- `resize`
- `scale`
- `rotate`

这里最关键的是：

- 多选 handles 不再来自 node
- 多选 handles 来自 `selection.transform`

### 二、单选和多选的视觉模型分开

#### 单选

- 保持当前思路
- box node 显示自身 selection ring
- path node 显示自身 path halo
- handles 挂在该 node 上
- toolbar 锚到该 node 或其 box

#### 多选

- 显示一个整体 selection box
- handles 只显示一套，挂在 selection box 上
- per-node 只保留轻量 membership indicator
- 不再给每个 node 单独渲染 handles

per-node membership indicator 的规则建议：

- box node：1px 的轻 outline，可选
- path node：保留自己的 path indicator，避免只看大 box 不知道选中了哪条线
- container/group：可保留轻 outline，但不出现自己的 handles

一句话：

- handles 只有一套
- indicators 可以有多份，但只能是轻量的

### 三、批量 resize 不是“把单节点 resize 复制 N 份”，而是 selection transform

批量 resize 的正确模型：

1. 用户拖 selection box 的 handle
2. 得到 `fromBox -> toBox` 和 anchor
3. 生成一个 selection-level transform
4. 把这个 transform 分发到每个被选中的 node

因此长期最优的命令模型不是：

- 每个 node 各自启动一个 resize session

而是：

- selection UI 发起一次整体 transform
- engine 按 node capability 把 transform 分解为每个 node 的 patch

### 四、批量 transform 能力按“共同能力”决定，不按“第一个节点”决定

多选后的 handles 应该由所有被选中对象的共同能力决定。

建议能力矩阵：

- `move`: 只要可选中，默认支持
- `resize`: 支持独立宽高变化
- `scale`: 支持按 selection box 比例缩放内容
- `rotate`: 支持整体旋转

selection-level 规则：

- 全部都支持 `resize`：显示完整 8 handles
- 不是全部支持 `resize`，但全部支持 `scale`：只显示角点 handles，做比例缩放
- 有对象既不支持 `resize` 也不支持 `scale`：隐藏多选 resize handles，仅支持 move / align / distribute
- 全部支持 `rotate`：显示整体 rotate handle
- 否则不显示整体 rotate handle

这是长期最稳的模型，因为它天然支持异构 selection。

### 五、selection box 必须是 derived view，不进入 finalize

这是实现里最容易走偏的一点。

`align right`、`distribute`、后续的 multi resize / multi rotate，本质上都会改变选中对象的几何。

长期最优规则应该明确为：

- `selection membership` 只存 ids
- `selection box` 永远由当前 selected items 的 rect 派生
- `finalize` 不负责重算 box
- `finalize` 只负责 prune / normalize membership

建议把 selection 清晰拆成三层：

#### 1. `selection.source`

只存身份：

- `nodeIds`
- `edgeId`

#### 2. `selection.prune`

只做合法性校正：

- 删除不存在的 node / edge
- 剔除超出 container scope 的 node
- 清理失效 edge selection

这个阶段就是今天 `selection/finalize.ts` 应该承担的职责。

#### 3. `selection.view`

全部派生：

- `items`
- `box`
- `summary`
- `types`
- `transform`

为什么必须这样做：

1. `align/distribute` 之后不需要手动 reconcile

只要 selected node 的 rect 变了，`selection.box` 就应该自动变化。

2. 未来 preview 态也能自动跟

如果后续要做：

- multi resize preview
- multi rotate preview
- drag preview

那么 `selection.box` 也应该跟着 preview 变化，而不是等提交后再刷新。

3. 不把 `finalize` 变成杂物箱

一旦把 `box` 重算放进 `finalize`，`finalize` 的语义就会从 membership 校正膨胀成“selection 的所有后处理”，后面会越来越乱。

因此文档建议：

- `finalize.ts` 长期应视为 `selection.prune`
- `selection box` 作为 read 层派生值存在
- 最终应依赖 `runtime read.node.item`，而不是仅依赖 engine committed rect

这意味着最终长期最优的能力边界是：

- commit 后：`selection box` 自动更新
- preview 中：`selection box` 也自动更新
- 不需要在 `align / distribute / resize / rotate` 每个动作后手动刷新 selection

### 六、filter 是 refine current selection，不是新的模式

`filter by type` 的长期最优设计应该非常简单：

- 输入：当前 selection
- 输出：筛成一个更小的 selection

不需要新的全局状态机，不需要新的工具模式。

建议交互：

- 只在 `selection.summary.types.length > 1` 时显示 Filter
- 点击后展示 type 列表：`icon + name + count`
- 选择一种 type 后，直接 `selection.replace(filteredIds)`
- 菜单里永远有一个 `All`

这个能力最适合挂在：

- 多选 toolbar 的 more 菜单
- 右键菜单 selection 分组里

而不是左侧主工具栏。

### 七、NodeDefinition 需要升级为带 meta 的 registry

当前只有：

```ts
type NodeDefinition = {
  type: string
  label?: string
  ...
}
```

这不够。

长期最优建议：

```ts
type NodeMeta = {
  name: string
  icon: string
  family: 'text' | 'shape' | 'draw' | 'container' | 'media' | 'connector' | 'mindmap'
  plural?: string
}

type NodeDefinition = {
  type: string
  meta: NodeMeta
  ...
}
```

说明：

- `name`: 给 toolbar / filter / context menu / analytics / debug 用
- `icon`: 给 filter chip、selection summary、insert menu 用
- `family`: 给 menu 分组、批量能力默认规则、统计摘要用
- `plural`: 可选，给文案优化用

为什么 `icon` 建议是字符串而不是直接 React 组件：

- registry 元数据更稳定
- 非 React 宿主也能读
- UI 层可以统一把 `icon key -> lucide icon` 或自定义 glyph

如果你想更少概念，也可以先不引入独立 `NodeMeta` 类型，直接：

```ts
type NodeDefinition = {
  type: string
  name: string
  icon: string
  family: ...
  ...
}
```

但从长期演进看，`meta` 更干净。

## 推荐的最终行为

### 1. 单选

- 显示 node indicator
- 显示单节点 handles
- 显示 node toolbar

### 2. 多选，同类 box nodes

- 显示一个整体 selection box
- 显示整体 resize / rotate handles
- 每个 node 可选显示轻 outline
- toolbar 针对共同属性展示

### 3. 多选，混合 box + path nodes

- 显示一个整体 selection box
- path node 保留轻 path indicator
- box node 可选保留轻 outline
- handles 只显示整体那一套
- 若共同 transform 能力不足，则只给 move / align / distribute，不给 resize

### 4. marquee 后 refine

- marquee 先得到一批 `candidateIds`
- summary 按 type 聚合
- 用户可一键 filter 成某一类
- refine 后 selection box 更新为子集 bounds

## 对 whiteboard 的最小长期最优实现建议

### 阶段 1：先把 UI affordance 收对

目标：

- 多选时不再渲染逐节点 handles
- 改为渲染一个整体 selection box

改法：

- 继续保留单选的 node-level handles
- 当 `selection.items.count > 1` 时：
  - `NodeOverlayLayer` 不再遍历 `selection.target.nodeIds` 渲染 `NodeTransformHandles`
  - 改为渲染一个 `SelectionTransformBox`
  - `SelectionTransformBox` 锚到 `selection.box`

这是最优先的，因为它直接修正产品手感。

### 阶段 2：补 selection summary

在 selection view 里新增派生数据：

- `types`
- `mixed`
- `families`

例如：

```ts
selection.types = [
  { type: 'sticky', count: 3, name: 'Sticky', icon: 'sticky' },
  { type: 'text', count: 2, name: 'Text', icon: 'text' }
]
```

这样 filter、toolbar 文案、右键菜单都不用自己数。

### 阶段 3：把 selection box 收到 read 层派生

当前方向上，selection box 不能作为写入状态维护。

建议收敛为：

- `selection.source` 继续保留在 state
- `selection.view` 收到 read 层
- `selection.view.box` 依赖当前 `runtime read.node.item`

这样：

- align / distribute 后自动更新
- 后续 preview 态也自动更新
- `finalize` 无需承担几何刷新职责

### 阶段 4：补 selection transform capability

selection 再新增：

```ts
selection.transform = {
  move: true,
  resize: 'none' | 'resize' | 'scale',
  rotate: boolean
}
```

计算规则来自所有 selected node definition 的共同能力。

### 阶段 5：加入 filter by type

UI 建议：

- 多选 toolbar 的 more 菜单
- 右键菜单里的 `Filter selection`

数据来源：

- `selection.types`

行为：

- 一次点击，直接 refine 当前 selection

### 阶段 6：把 registry 升级到 meta

把当前 scattered label / icon / menu grouping 收到 registry。

最终所有地方都读：

- `registry.get(type)?.meta.name`
- `registry.get(type)?.meta.icon`
- `registry.get(type)?.meta.family`

## 为什么这是长期最优

### 1. 交互模型统一

- 单选操作 node
- 多选操作 selection box

### 2. 视觉层次正确

- per-node indicator 是 secondary
- selection transform box 是 primary

### 3. 能力扩展自然

后面你要加：

- 批量 rotate
- 批量 resize
- 批量 scale
- filter by family
- mixed selection style summary

都不需要再推翻模型。

### 4. registry 终于能做真正的一等元数据源

不再到处手写：

- 文案
- 图标
- 类型分组
- filter 列表

## 不推荐的方案

### 1. 继续保留“多选时每个 node 一套 handles”

问题：

- 噪音过大
- 无法表达 selection-level resize
- 和 toolbar 已经 selection-level 的现实矛盾

### 2. filter 做成全局模式

问题：

- 状态机变复杂
- 用户心智不对
- 本质上它只是 refine selection

### 3. `type -> name/icon` 继续散在 toolbar/menu/context menu

问题：

- 最终一定失控
- 修改一种 type 需要改多个地方

## 一句话结论

长期最优模型是：

- 多选的主操作对象是一个整体 selection box
- per-node 只保留轻 membership indicator
- 批量 resize / rotate 是 selection-level transform
- filter 是对当前 selection 的 refine
- `type -> name / icon / family` 收到 registry meta，作为唯一来源

这比现在“selection 只有 ids 和 box，handles 却按 node 单独渲染”的模型更收敛，也更符合行业规范。
