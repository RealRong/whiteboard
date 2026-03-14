# Group 内部选择设计

## 问题

当前交互里，group 作为容器节点会优先吃掉命中：

- 点击 group 内部区域，通常选中的是整个 group
- 拖动时，通常移动的是整个 group
- 很难直接选中 group 内的某个 child node
- 更难连续选中 group 内的多个 child node

这导致一个核心问题：

**group 目前更像“不可进入的整体对象”，而不是“可进入的容器”。**

如果产品目标里允许用户把 group 当作容器来管理内部内容，那么当前交互是不够的。

## 结论

最优方案不是只加一个快捷键“忽略 group”，而是两层设计一起做：

1. 主方案：引入 group 编辑模式
2. 辅助方案：引入临时 drill-through modifier

这两层职责不同：

- group 编辑模式负责“持续地编辑 group 内部内容”
- modifier 负责“临时地穿透 group 容器命中”

## 为什么不能只靠 modifier

如果只做一个“按住某个键无视 group”的方案，虽然能解决一次点击，但解决不了连续编辑：

- 选第一个 child 要按键
- `Shift` 加选第二个 child 还要按键
- 框选一批 child 还要按键
- 后续拖动、调属性、连线都要继续维持额外心智负担

这会变成高手专用路径，不是正常产品交互。

所以：

- modifier 可以有
- 但不能成为主方案

## 推荐方案

### 主方案：Group 编辑模式

引入一个显式的“进入 group 内部编辑”的概念。

建议规则：

- 单击 group：选中整个 group
- 拖动 group：移动整个 group
- 双击 group：进入 group 编辑模式
- 或者 group 已选中时按 `Enter`：进入 group 编辑模式
- 在 group 编辑模式下：
  - 命中优先内部 child node
  - 可单选 child
  - `Shift` 可多选 child
  - 框选只作用于当前 group 内 descendants
  - handles / toolbar 面向内部选中的 child，而不是 group 本体
- `Esc`：退出 group 编辑模式
- 点击 group 外部空白：退出 group 编辑模式

这条路径是最应该被普通用户发现和使用的主路径。

### 辅助方案：临时 Drill-through

建议增加一个临时 modifier：

- `Alt / Option + click`
  - 本次点击忽略 group 容器，优先命中内部 child

- `Alt / Option + drag marquee`
  - 本次框选忽略 group 本体，只框内部 child

它的作用是：

- 不进入完整编辑模式的情况下，临时穿透一次
- 适合高手快速操作

## 不推荐的键位

### 不建议用 `Shift`

原因：

- `Shift` 已经天然承担 additive selection 语义
- 如果再让它表示“忽略 group”，会和多选冲突

### 不建议用 `Ctrl / Meta`

原因：

- 平台差异大
- macOS 上 `Ctrl + click` 和右键菜单语义冲突
- `Meta` 常常和系统/浏览器快捷键冲突

### 推荐用 `Alt / Option`

原因：

- 更适合表示“临时替代命中规则”
- 与现有多选语义冲突较少

## 推荐交互模型

建议增加一个独立状态：

```ts
type GroupScopeState = {
  activeGroupId?: NodeId
}
```

这个状态只表达一件事：

- 当前是否正在某个 group 内编辑

不要把它塞进 selection。

## 为什么不能把它塞进 selection

因为：

- `selection` 表示当前正式选中的对象
- `activeGroupId` 表示当前命中/框选/编辑作用域

这两个概念相关，但不相等。

举例：

- 当前选中了 group 内两个 child
- 这时 `selection = childA + childB`
- 但 `activeGroupId = groupX`

如果把两者混在一起，后面 hit-test、selection box、toolbar、breadcrumb 都会很乱。

## 命中规则

### 默认状态下

没有 `activeGroupId` 时：

- group 命中优先于其 descendants
- 点击 group 内部区域，优先命中 group
- 拖动 group，移动整个 group

这保证 group 作为整体对象的操作不被破坏。

### 进入 group 编辑模式后

有 `activeGroupId` 时：

- 命中只在这个 group 的 descendants 范围内优先解析
- descendants 优先于 group 容器
- group 本体退居次级命中对象
- 框选也仅针对当前 scope 内的 descendants

这时用户的心智模型就是：

- “我已经进入这个容器内部”

## Selection 规则

### 默认状态

- 单击 group：选中 group
- `Shift` + 单击其他 node：进入普通多选
- group 与外部 node 的混合多选可以继续按现有产品策略处理

### group 编辑模式下

- 单击 child：选中 child
- `Shift` + 单击 child：多选 child
- 多选范围应限制在当前 active group scope 内

建议默认不要允许在 group 编辑模式里直接把外部 node 混进来，因为这会让 scope 语义变脏。

更稳的规则是：

- 进入某个 group scope 后，selection 只允许包含该 group 的 descendants

## Marquee / 框选规则

这是很重要的一部分，因为“选择 group 内某几个 node”很多时候不是点击，而是框选。

### 默认状态

- 框选按现有逻辑工作
- group 可以被框中
- child 是否被单独框中取决于你当前规则

### group 编辑模式下

- 框选区域只匹配 `activeGroupId` 的 descendants
- 不选 group 本体
- 不选 group 外部对象

这会让 group 编辑模式非常干净。

## 拖动规则

### 默认状态

- 选中 group 并拖动：拖整个 group
- 点击 group 内部空白拖动：仍然优先拖整个 group

### group 编辑模式下

- 选中 child 并拖动：拖 child
- 多选 child 并拖动：拖内部多选集合
- 点击 group 内部空白拖动：不拖 group，本质上应更接近内部背景点击

## Toolbar / Handles 规则

### 默认状态

- 选中 group：显示 group 的 handles 和 toolbar

### group 编辑模式下

- 如果选中的是 child：
  - 显示 child 的 handles / toolbar
- 如果当前没有内部 selection：
  - 不显示 group handles
  - 可以显示一个轻量的 group scope UI，而不是 transform handles

## 推荐视觉提示

如果进入 group 编辑模式，最好给用户一个明显但轻量的提示。

建议至少有一个：

- group 外框高亮
- 顶部出现 “Editing group” 的小条
- breadcrumb，例如：
  - `Canvas / Group A`

这样用户能明确知道：

- 我现在不是在全局画布上
- 我在某个容器内部

## 退出规则

建议统一为：

- `Esc` 退出当前 group scope
- 点击 group 外部空白退出
- 点击 breadcrumb 的上一级退出

如果未来支持 group 嵌套，这套退出语义还能自然扩展成逐级退出。

## 如果未来支持 group 嵌套

建议从一开始就把它设计成可嵌套，而不是只支持一级。

可以把状态建成：

```ts
type GroupScopeState = {
  path: readonly NodeId[]
}
```

当前激活 group 为：

```ts
const activeGroupId = path[path.length - 1]
```

这样未来支持：

- group 里套 group
- 逐级 drill-in / drill-out

就不会推翻现有模型。

但如果当前产品还没走到那里，第一版也可以先保守用：

```ts
type GroupScopeState = {
  activeGroupId?: NodeId
}
```

## 与右键菜单的关系

这套 group scope 会影响右键菜单 target 语义：

### 默认状态

- 右键 group：菜单 target 是 group

### group 编辑模式下

- 右键 child：菜单 target 是 child 或 child selection
- 右键内部空白：可以是 group-scope canvas menu，或者 group 本体 menu

推荐第一版简单一点：

- group 编辑模式下
  - 右键命中 child：child menu
  - 右键内部空白：canvas menu，但 scope 限制在 group 内

## 推荐实现优先级

### 第一阶段

先引入：

- `activeGroupId`
- 双击进入
- `Esc` 退出
- hit-test 按 scope 改写

### 第二阶段

补 selection box / marquee：

- 框选只选当前 group descendants

### 第三阶段

补 `Alt / Option` 临时 drill-through

### 第四阶段

补视觉提示：

- breadcrumb / editing group badge / outline

## 最优方案总结

如果只回答“要不要加快捷键无视 group”，我的结论是：

- 可以加，但只能作为辅助方案

真正最优的方案是：

1. 做 group 编辑模式
2. 双击进入，`Esc` 退出
3. 进入后，内部 child 命中优先
4. `Alt / Option` 作为临时 drill-through

## 一句话结论

不要只做“按住某个键忽略 group”。  
最优设计是把 group 当作“可进入的容器”，引入显式的 group 编辑模式，再用 `Alt / Option` 作为临时穿透的辅助能力。
