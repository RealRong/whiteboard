# Toolbar / Menu 最终稿

## 1. 目标

这份文档定义 `whiteboard-react` 的 node toolbar / more menu / context menu 长期最优方案。

目标不是继续修补现有菜单，而是一次性收敛下面几个问题：

- 删除混合概念 `Arrange`
- 让 `Toolbar`、`MoreMenu`、`ContextMenu` 各自职责稳定
- 把动作可用性判断收敛成单一来源
- 减少 UI 概念和实现分叉
- 为后续继续加能力时保留清晰扩展点

前提：

- 不考虑兼容成本
- 命名优先短、清晰、稳定
- UI 概念尽量少
- 不再引入第二套平行菜单模型

## 2. 对标结论

这轮重点参考了 Miro 的 toolbar 心智，以及 Boardmix 的右键菜单组织方式。

### 2.1 可以借鉴的点

- 右键菜单应以纯文本为主，而不是图标网格
- 高扇出命令适合在右键菜单里做二级菜单
- `Layer >` 很适合承接 z-order 命令
- `Delete` 应该固定放在底部，和普通命令隔开
- 如果后续要加快捷键展示，应该放在菜单项右侧，而不是额外占一列标题

### 2.2 不该照搬的点

- 不照搬业务型菜单项、AI 菜单、外链菜单
- 不把菜单做得过长，避免一屏扫不完
- 不把视图命令、画布命令、node 命令混进一个右键菜单
- 不把 toolbar 做成目录式菜单

结论：

- `Toolbar` 继续走 icon-first
- `MoreMenu` 继续走扁平文本补充菜单
- `ContextMenu` 才是完整文本命令目录
- 二级菜单只在 `ContextMenu` 里做，不扩散到全局

## 3. 最终原则

### 3.1 UI 不再出现 Arrange

`Arrange` 同时混了：

- z-order
- align / distribute

这会导致用户心智和代码结构都继续发散。

最终 UI 概念只保留两个：

- `Layer`
- `Layout`

其中：

- `Layer` 表达前后层级
- `Layout` 表达对齐与分布

实现侧可以继续保留 `orderNodes()` 这类动词式命名，但 `Arrange` 不应再出现在 UI 和组件命名里。

### 3.2 入口可以不同，动作来源必须相同

下面三个入口不应各自维护一套判断逻辑：

- `NodeToolbar`
- `MoreMenu`
- `ContextMenu`

它们应该共享同一个 node selection action model。

共享的应该是：

- 可见性
- disabled 状态
- label
- handler

不共享的应该是：

- 渲染结构
- 是否使用图标
- 是否使用二级菜单
- 排版方式

### 3.3 Toolbar 只放高频、图形化强的动作

`Toolbar` 的职责是快速操作，不是悬浮版右键菜单。

因此：

- 保留属性类按钮
- 保留 `Layout`
- 保留 `More`
- 不把 `Layer` 放进主区
- 不把低频文本命令塞进主区

### 3.4 MoreMenu 是补充命令，不是第二个右键菜单

`MoreMenu` 的职责是：

- 承载 toolbar 主区不适合直接展示的命令
- 作为当前 selection 的补充命令面板

不是：

- 复刻完整右键菜单
- 再做一套 submenu 目录
- 再做一套独立 capability 判断

所以 `MoreMenu` 必须保持：

- 扁平
- 文本化
- 命令短
- 无二级菜单

### 3.5 ContextMenu 是完整命令目录

右键菜单适合：

- 纯文本扫描
- 完整命令发现
- 高扇出命令归类

因此：

- `ContextMenu` 是完整命令目录
- `Layer` 和 `Layout` 可以在这里做二级菜单
- `Delete` 放到底部
- 不要求视觉上复刻 toolbar

### 3.6 二级菜单只做局部能力，不做全局菜单基建

长期最优不是提前抽一个“大而全的菜单 DSL”，而是：

- 只给 `ContextMenu` 增加最小 submenu 能力
- 只用于少数高扇出命令组
- 不扩散到 `MoreMenu`
- 不抽成全局通用菜单系统

这能把复杂度压到最低。

## 4. 最终信息架构

## 4.1 NodeToolbar

### 单选普通 node

显示：

- `Fill`
- `Stroke`
- `Text`
- `Group`
- `More`

不显示：

- `Layout`
- `Layer`

### 单选 group

显示：

- `Fill`
- `Stroke`
- `Group`
- `More`

不显示：

- `Layout`
- `Layer`

### 多选 2 个 node

显示：

- `Layout`
- 共享能力下的 `Fill`
- 共享能力下的 `Stroke`
- `More`

行为：

- `Align` enabled
- `Distribute` disabled

### 多选 3 个及以上 node

显示：

- `Layout`
- 共享能力下的 `Fill`
- 共享能力下的 `Stroke`
- `More`

行为：

- `Align` enabled
- `Distribute` enabled

### 原则

- `Layer` 永远不进入 toolbar 主区
- `Layout` 只在多选出现
- toolbar 主区只承载高频图形化能力

## 4.2 LayoutMenu

`LayoutMenu` 保持纯 dumb component。

只负责：

- 6 个 align 图标
- 2 个 distribute 图标
- disabled 呈现
- 图标布局

输入只保留：

- `canAlign`
- `canDistribute`
- `onAlign`
- `onDistribute`

它不应负责：

- 读 selection
- 读 instance
- 决定命令是否可见
- 混入 `Layer`

## 4.3 MoreMenu

`MoreMenu` 保持扁平文本菜单，不做 submenu。

建议 section：

- `Layer`
- `Structure`
- `State`
- `Edit`
- `Danger`

建议内容：

- `Layer`
  - Bring to front
  - Bring forward
  - Send backward
  - Send to back
- `Structure`
  - Group
  - Ungroup
- `State`
  - Lock / Unlock
- `Edit`
  - Duplicate
- `Danger`
  - Delete

说明：

- `MoreMenu` 不承载 `Layout`
- `Layout` 已经在 toolbar 主区有明确入口
- `MoreMenu` 不做 hover submenu，否则交互变差

## 4.4 ContextMenu

`ContextMenu` 是完整命令目录，但只引入最小二级菜单能力。

### 顶层结构

- `Layout >`
- `Layer >`
- `Structure`
- `State`
- `Edit`
- `Delete`

其中：

- `Layout >` 只在多选 node 时出现
- `Layer >` 只要有 node selection 就出现
- `Delete` 永远在底部，并与其他项隔开

### Layout 二级菜单

- Align top
- Align left
- Align right
- Align bottom
- Align horizontal center
- Align vertical center
- Distribute horizontally
- Distribute vertically

### Layer 二级菜单

- Bring to front
- Bring forward
- Send backward
- Send to back

### 其他顶层命令

- `Structure`
  - Group
  - Ungroup
- `State`
  - Lock / Unlock
- `Edit`
  - Duplicate
- `Danger`
  - Delete

### 设计要求

- 右键菜单文本优先
- 不混入 icon grid
- 不展示 section title 堆叠成很长的说明板
- 用分隔线和 submenu 解决长度问题
- 后续若加快捷键，在 item 右侧展示，不新增额外布局概念

## 5. 状态矩阵

## 5.1 单选普通 node

- Toolbar
  - 属性类
  - More
- MoreMenu
  - Layer
  - State
  - Edit
  - Danger
- ContextMenu
  - Layer >
  - State
  - Edit
  - Delete

## 5.2 单选 group

- Toolbar
  - Fill
  - Stroke
  - Group
  - More
- MoreMenu
  - Layer
  - Structure
  - State
  - Edit
  - Danger
- ContextMenu
  - Layer >
  - Structure
  - State
  - Edit
  - Delete

## 5.3 多选 2 个 node

- Toolbar
  - Layout
  - 共享 Fill / Stroke
  - More
- LayoutMenu
  - Align enabled
  - Distribute disabled
- MoreMenu
  - Layer
  - Structure
  - State
  - Edit
  - Danger
- ContextMenu
  - Layout >
  - Layer >
  - Structure
  - State
  - Edit
  - Delete

## 5.4 多选 3 个及以上 node

- Toolbar
  - Layout
  - 共享 Fill / Stroke
  - More
- LayoutMenu
  - Align enabled
  - Distribute enabled
- MoreMenu
  - Layer
  - Structure
  - State
  - Edit
  - Danger
- ContextMenu
  - Layout >
  - Layer >
  - Structure
  - State
  - Edit
  - Delete

## 6. 动作模型

## 6.1 单一动作来源

建议继续以：

- `packages/whiteboard-react/src/features/node/actions.ts`

作为统一动作解析入口。

它负责：

- 输入当前 selection nodes
- 读取 summary
- 输出统一 action state 和 handlers

它不负责：

- 右键菜单布局
- more menu 排版
- toolbar 图标呈现

## 6.2 推荐动作域

统一动作域保持：

- `layer`
- `layout`
- `structure`
- `state`
- `edit`
- `danger`

其中：

- `layer` 对应 z-order
- `layout` 对应 align / distribute

不要再保留：

- `arrange`

这种混合域。

## 6.3 动作模型与视图投影分离

长期最优不是让 action model 直接等于菜单结构，而是分两层：

### 动作层

只表达：

- 能力是否存在
- label
- disabled
- onClick / onSelect

### 视图投影层

把同一份动作层投影成：

- `buildMoreMenuSections(actions)`
- `buildContextMenuItems(actions)`

原因：

- `MoreMenu` 需要扁平 section
- `ContextMenu` 需要 submenu
- 两者渲染形态不同，但动作来源相同

这比让两个组件各自判断简单，也比强行共用同一份菜单 JSON 更稳定。

## 7. 命名与文件结构

### 7.1 命名原则

- UI 不再出现 `Arrange`
- 组件名保持 PascalCase
- 菜单 dumb component 放在 `menus/*`
- handler 命名尽量短

### 7.2 推荐文件边界

- `packages/whiteboard-react/src/features/node/actions.ts`
  - node selection action model
- `packages/whiteboard-react/src/canvas/menus/LayoutMenu.tsx`
  - 纯图标 layout 菜单
- `packages/whiteboard-react/src/canvas/menus/MoreMenu.tsx`
  - 扁平文本菜单
- `packages/whiteboard-react/src/canvas/ContextMenu.tsx`
  - target 解析 + 右键菜单渲染

如果要给 `ContextMenu` 增加二级菜单，优先放在：

- `packages/whiteboard-react/src/canvas/ContextMenu.tsx`

或一个很薄的本地目录，例如：

- `packages/whiteboard-react/src/canvas/contextMenu/*`

不建议：

- 抽全局菜单 DSL
- 抽通用 submenu framework
- 为 `MoreMenu` 和 `ContextMenu` 建第二套平行 action schema

## 8. 分阶段实施方案

## 第 1 阶段：定型动作域

- 明确 `layer / layout / structure / state / edit / danger`
- 删除残余 `Arrange` 概念
- 统一 toolbar / more / context menu 的可用性判断来源

目标：

- 只有一处 capability 解析

## 第 2 阶段：收敛 MoreMenu

- `MoreMenu` 保持扁平文本菜单
- `Layer` 放入 `MoreMenu`
- `Delete` 置底
- 不给 `MoreMenu` 加 submenu

目标：

- toolbar popover 保持快、浅、短

## 第 3 阶段：给 ContextMenu 增加最小 submenu

- 只做本地 submenu 能力
- 先支持 `Layer >`
- 保持 hover / focus 即开
- 不抽象成通用大系统

目标：

- 把右键菜单长度降下来

## 第 4 阶段：把 Layout 也收进 ContextMenu submenu

- 多选时显示 `Layout >`
- 单选不显示
- 复用同一 submenu 能力

目标：

- 右键菜单信息架构完整

## 第 5 阶段：可选补充

- 菜单项右侧展示 shortcut
- group / mindmap 专属命令精细化

这属于增强项，不阻塞主结构。

## 9. 非目标

本方案明确不做：

- 把 `MoreMenu` 也改成 submenu
- 让 `Toolbar` 变成目录式命令入口
- 把 canvas 右键菜单和 node 右键菜单强行并成一套大系统
- 提前做插件化菜单注册中心
- 复刻 Boardmix 的全部业务菜单
- 在 context menu 里镜像 fill / stroke / text 属性编辑

## 10. 验收标准

完成后应满足：

- 代码与 UI 中不再出现 `Arrange`
- `Toolbar` 主区没有 `Layer`
- `Layout` 只负责 align / distribute
- `MoreMenu` 保持扁平，不含 submenu
- `ContextMenu` 支持最小 submenu，但仅用于高扇出命令
- `Delete` 固定在右键菜单底部
- `Toolbar`、`MoreMenu`、`ContextMenu` 三者动作可用性一致
- 不再有三套独立 capability 判断

## 11. 一句话结论

最终方案是：

- `Toolbar` 负责高频图形化操作
- `MoreMenu` 负责扁平补充命令
- `ContextMenu` 负责完整文本命令目录
- `Layer` 和 `Layout` 在概念上彻底拆开
- 二级菜单只在 `ContextMenu` 局部引入

这是当前概念最少、结构最清晰、长期维护成本最低的方案。
