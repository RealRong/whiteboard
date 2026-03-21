# Menu System Architecture

更新时间：2026-03-21

## 目标

这份文档只回答一件事：

`whiteboard-react` 的 menu / toolbar / context menu / shortcut，长期最优到底怎么做，才能：

- 概念少
- 职责清晰
- 能复用
- 不继续膨胀

前提：

- 不考虑兼容成本
- 命名优先短、清晰、稳定
- 不做“大而全”的 menu framework

---

## 1. 最终结论

最简单且长期还能成立的模型，只保留 3 个核心概念：

1. `meta`
2. `selection`
3. `actions`

其它东西都不要再上升成新概念：

- `toolbar`
- `more menu`
- `context menu`
- `shortcut`

它们都只是不同的外壳，不是新的架构层。

一句话：

- `meta` 回答“节点是什么”
- `selection` 回答“当前能显示什么”
- `actions` 回答“当前能执行什么”

---

## 2. 为什么不要更复杂

上一版那种：

- `profile`
- `catalog`
- `preset`
- `block`

理论上很完整，但对这个项目来说有点过度建模。

问题不是它错，而是：

- 术语变多
- 文件会继续增加
- 心智负担会变大
- 还没真正解决“代码到处散”的主要矛盾

现在最需要抽出来的，其实只有三件稳定的事：

1. 节点元数据
2. 当前 selection 的公共能力
3. 可复用的动作执行

只要这三件事收住，menu 系统自然会变干净。

---

## 3. 最简长期模型

## 3.1 `meta`

位置：

- 节点定义
- registry

职责：

- 描述节点固有事实

建议最终结构：

```ts
type NodeMeta = {
  name: string
  icon: string
  family: NodeFamily
  controls: readonly ControlId[]
}
```

只保留这些字段就够了：

- `name`
- `icon`
- `family`
- `controls`

其中 `controls` 表示这个节点天然支持哪些编辑控件，不是动作。

例子：

- `text`
  - `['text']`
- `sticky`
  - `['fill', 'text']`
- `rect`
  - `['fill', 'stroke']`
- `group`
  - `['fill', 'stroke', 'group']`
- `draw`
  - `['stroke']`

不该放进 `meta` 的东西：

- `onClick`
- `visible`
- `enabled`
- `shortcut`
- `menu sections`
- `context-specific actions`

原则：

- `meta` 只回答“它是什么”
- 不回答“现在能不能做”

---

## 3.2 `selection`

位置：

- `selection` 的 read/view 层

职责：

- 描述当前选择的公共信息和公共能力

长期最优不是再单独发明一个 `profile` 概念，而是直接让 `selection.view` 长成 menu 真正需要的样子。

建议最终让 `selection.view` 至少提供这些内容：

```ts
selection.summary
selection.types
selection.can
```

### `selection.summary`

回答：

- 当前有几个对象
- 是否 mixed
- 是否有 group
- lock 状态如何

### `selection.types`

回答：

- 当前 selection 里有哪些类型
- 每种类型多少个
- 每种类型的 `name/icon/family`

### `selection.can`

回答：

- 当前 selection 能做哪些事

建议保持极简：

```ts
selection.can = {
  fill: boolean
  stroke: boolean
  text: boolean
  group: boolean

  align: boolean
  distribute: boolean
  makeGroup: boolean
  ungroup: boolean
  order: boolean
  filter: boolean
  lock: boolean
  copy: boolean
  cut: boolean
  duplicate: boolean
  delete: boolean
}
```

原则：

- toolbar 不自己判断
- context menu 不自己判断
- shortcut 不自己判断

都只读这一份。

说明：

- `fill / stroke / text / group` 表示控件是否该出现
- `align / distribute / makeGroup / ungroup / order` 表示动作是否可执行

如果实现里还需要“共同控件交集”，那也只应该是内部 helper，不应该成为公开 selection API。

---

## 3.3 `actions`

位置：

- 一个很薄的公共动作模块

职责：

- 执行当前 selection 相关动作

这里不需要做成一个很重的 action framework。

只需要把真正复用的动作收成一处，比如：

```ts
actions.copy()
actions.cut()
actions.duplicate()
actions.delete()
actions.group()
actions.ungroup()
actions.lockToggle()
actions.order(mode)
actions.align(mode)
actions.distribute(mode)
actions.filterType(type)
```

重点不是“动作系统有多通用”，而是：

- `toolbar`
- `context menu`
- `shortcut`

不要再各自维护一套执行逻辑。

原则：

- `actions` 只负责执行
- `selection.can` 负责是否可用
- `meta` 负责文案和图标来源

---

## 4. 不要做什么

为了保持简单，长期明确不做这些：

### 4.1 不做 `node type -> actions[]`

原因：

- 很多动作是 selection 级，不是 node type 级
- 多选、group、edge、canvas 空白处都无法优雅表达
- 最后还是会回到各入口自己补判断

### 4.2 不做通用 `action catalog` 框架

现在没有必要引入：

- `ActionSpec`
- `ActionRegistry`
- `resolveAction`
- `dispatchAction`

这些太重了。

当前更合理的是：

- 一个薄的 actions 模块
- 一个薄的 selection.can

这样已经足够复用。

### 4.3 不做通用 `preset engine`

不需要引入：

- `menu preset resolver`
- `block schema`
- `surface config runtime`

这些都会让系统变重。

不同菜单直接在各自文件里维护顺序即可，只要它们读的是同一份 `selection` 和 `actions`。

### 4.4 不做 menu DSL

不需要把菜单描述成一套抽象语言。

原因：

- menu UI 差异本来就大
- toolbar 和 context menu 不会完全共享结构
- 现在还没复杂到值得抽 DSL

---

## 5. 各个入口怎么复用

## 5.1 `NodeToolbar`

职责：

- 显示高频编辑控件
- 多选时显示 `layout`
- 不承载完整命令目录

它应该读：

- `selection.can.fill`
- `selection.can.stroke`
- `selection.can.text`
- `selection.can.group`
- `selection.can.align`
- `selection.can.distribute`
- `selection.summary`

它不应该自己维护：

- 某些 type 才有 fill/stroke/text 的白名单
- 多选能不能 layout 的判断
- 文案和图标映射

也就是说：

- toolbar 决定“怎么排”
- 不决定“能不能做”

## 5.2 `MoreMenu`

职责：

- 承载 toolbar 主区不适合放的低频动作
- 展示 summary
- 展示 type filter

它应该读：

- `selection.summary`
- `selection.types`
- `selection.can`
- `actions`

它不应该自己：

- 拼 summary 文案
- 算哪些 type 可筛
- 再写一遍 delete / duplicate / group handler

## 5.3 `ContextMenu`

职责：

- 完整命令目录
- 更长文本扫描
- 适合承载二级菜单

它和 `MoreMenu` 的差别只应该是：

- 排版不同
- 菜单层级不同
- 展示更完整

它不应该有自己独立的一套业务判断。

## 5.4 `Shortcut`

职责：

- 触发同一批动作

最优不是：

- `shortcut.ts` 自己再写一套 delete / duplicate / group 逻辑

而是直接复用同一份 `actions`。

也就是说：

- `selection.can.delete` 决定能不能删
- `actions.delete()` 决定怎么删

shortcut 只是触发入口，不是独立业务层。

---

## 6. 最简单的预设方式

如果还需要“预设”这个词，它只表示顺序，不表示系统。

也就是：

- 哪些按钮先显示
- 哪些 section 先显示

不要把它上升成框架。

例如：

```ts
toolbar.single = ['fill', 'stroke', 'text', 'group', 'more']
toolbar.multi = ['layout', 'common-controls', 'more']
more.sections = ['summary', 'filter', 'layer', 'structure', 'state', 'edit', 'danger']
context.nodes = ['summary', 'filter', 'layout', 'layer', 'structure', 'state', 'edit', 'danger']
```

这里的预设只负责：

- 顺序
- 编排

不负责：

- 判断能不能显示
- 判断能不能点
- 执行动作

所以它非常轻，不值得单独做一套“preset engine”。

---

## 7. 对当前实现的判断

## 7.1 已经对的部分

### 1. `summary`

文件：

- `packages/whiteboard-react/src/features/node/summary.ts`

这是对的，因为它已经把 selection 的聚合信息从组件里拿出来了。

### 2. `meta`

文件：

- `packages/whiteboard-react/src/types/node/registry.ts`

这已经是统一元数据源的雏形。

### 3. summary/filter UI 已经在共用

文件：

- `packages/whiteboard-react/src/features/node/components/SelectionSummaryHeader.tsx`
- `packages/whiteboard-react/src/features/node/components/SelectionTypeFilterStrip.tsx`

这说明方向已经对了：

- 统一读 selection 数据
- 不让 menu 自己重复拼装

## 7.2 当前最该继续收敛的点

### 1. `NodeToolbar.tsx` 的 capability 推导太硬编码

文件：

- `packages/whiteboard-react/src/canvas/NodeToolbar.tsx`

现在的问题是：

- `NodeTypesByCapability`
- schema sniffing
- toolbar 自己推导 fill/stroke/text/group

长期最优应该改成：

- 优先读 `meta.controls`
- 再把结果收进 `selection.can.fill/stroke/text/group`
- toolbar 不再知道哪些 type 属于哪类

### 2. `actions.ts` 还混了“执行”和“菜单组织”

文件：

- `packages/whiteboard-react/src/features/node/actions.ts`

长期最优应该让它更薄：

- 保留动作执行
- 保留少量组合 helper
- 不再承担过多 menu section 组织

### 3. `shortcut.ts` 还是旁路

文件：

- `packages/whiteboard-react/src/canvas/actions/shortcut.ts`

长期最优应该改成直接复用同一份 `actions`。

---

## 8. 最小目录建议

不需要新增很多目录。

最简单的做法就是：

- `registry` 继续放 node meta
- `selection` 继续放 summary / types / can
- `actions` 继续放公共动作
- `canvas/*` 继续放各个 surface 的渲染

也就是：

```txt
features/node/registry/*
features/node/summary.ts
features/node/actions.ts
canvas/NodeToolbar.tsx
canvas/ContextMenu.tsx
canvas/menus/*
canvas/actions/shortcut.ts
```

后面如果一定要拆，也只拆最少：

- `summary.ts`
- `actions.ts`
- `controls.ts`

不要一下子长出：

- `profile/`
- `catalog/`
- `preset/`
- `blocks/`
- `resolver/`

那会把问题重新复杂化。

---

## 9. 最终原则

### 9.1 `meta` 只描述节点

只放：

- `name`
- `icon`
- `family`
- `controls`

### 9.2 `selection` 是唯一上下文来源

所有入口都读：

- `summary`
- `types`
- `can`

### 9.3 `actions` 是唯一执行来源

所有入口都调：

- `copy / cut / duplicate / delete`
- `group / ungroup`
- `order / align / distribute`
- `filterType`

### 9.4 menu 只负责排版和顺序

menu 不负责：

- 业务判断
- 业务执行
- 元数据映射

---

## 10. 一句话总结

最简单且长期最稳的方案就是：

- `meta` 解决“节点是什么”
- `selection` 解决“当前能显示什么”
- `actions` 解决“当前能执行什么”
- `toolbar / more / context / shortcut` 只是不同外壳

不要把 menu 系统做成框架，只要把这三件事收住，整条链路就会自然变干净。
