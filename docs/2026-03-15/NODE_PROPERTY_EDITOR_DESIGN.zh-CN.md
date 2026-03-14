# 通用节点属性编辑设计

## 结论

主交互明确采用 Miro 风格：

- 点击选中 node
- 在 node 上方显示一条浮动 `Toolbar`
- toolbar 以图标为主，尽量少文字
- 点击某个图标后，在图标上方或下方弹出一个二级菜单
- 二级菜单用于调颜色、描边、文本、层级、锁定等属性

不要把“右侧 Sidebar”作为第一主入口。

第一版最优方案不是：

- 点击节点后固定打开右侧面板

而是：

- 以 `selection` 驱动 node 上方浮动 toolbar
- 以 `menu registry` 驱动二级菜单
- 以 `schema + common capabilities` 驱动可编辑项

一句话概括：

主入口做成 `Selected Node Toolbar`，不是 `Inspector Sidebar`。


## 为什么主交互要学 Miro

白板里最常见、最高频的属性调整，不是“复杂表单编辑”，而是这些：

- 填充色
- 描边色
- 描边粗细
- 文本颜色
- 字号
- 对齐
- 锁定
- 层级
- 复制样式

这些操作的共同特点是：

- 高频
- 快速
- 调一次马上看结果
- 用户希望视线留在画布上

如果主入口放到右侧面板，会有几个明显问题：

- 视线从 node 跳到侧边，反馈不够直接
- 高频调色、调描边显得太重
- 在小屏或窄视口下占空间
- 未来做 image / icon / sticker 时，很多操作并不需要面板

而 Miro 风格的 node 上方 toolbar 更符合白板心智：

- 选中即显
- 离对象最近
- 适合连续试样式
- 二级菜单能承载中等复杂度配置

所以这套系统的“主入口”应当是：

- 选中对象上方的浮动 toolbar

而不是 sidebar。


## 不同交互形态的角色分工

### 1. Toolbar

这是主入口。

职责：

- 快速属性编辑
- 高发现性
- 与当前 node 强绑定
- 可承载二级菜单

适合的内容：

- 颜色
- 描边
- 文字
- 对齐
- 层级
- 锁定
- 复制样式


### 2. 二级菜单

这是 toolbar 的延伸，不是独立系统。

职责：

- 承接某个图标背后的具体配置
- 可以是 palette、segmented、slider、switch、input 组合
- 根据空间自动弹到图标上方或下方

它不是右键菜单，也不是大面板。


### 3. 右键菜单

只负责命令，不负责主属性编辑。

适合放：

- 删除
- 复制
- 粘贴
- 锁定 / 解锁
- 置顶 / 置底
- 成组 / 解组
- 复制样式 / 粘贴样式

不适合放：

- 颜色面板
- 多段表单
- 高频样式编辑


### 4. Sidebar

不作为第一入口，但可以作为未来的“高级设置入口”。

适合放：

- 复杂 image 设置
- freehand 高级参数
- 元数据
- 调试信息
- schema 中低频、长表单字段

所以 sidebar 不是不要，而是：

- 第一阶段不做主入口
- 第二阶段作为 `More...` / `Advanced` 的补充入口


## 推荐最终交互

推荐交互链路：

1. 单击 node
2. node 上方出现 toolbar
3. toolbar 显示若干图标按钮
4. 点图标，弹出对应二级菜单
5. 调整属性，实时写回 node
6. 点击画布空白处，toolbar 与 menu 消失

补充规则：

- 双击文本类 node，继续走原地文本编辑
- 多选时显示 multi-select toolbar
- 右键菜单只放命令，不放属性面板
- 如果某个 node 有很复杂的配置，可在 toolbar 末尾放 `More`，以后再接 sidebar


## 为什么不是“node type -> menu renderers”直接硬绑

你提的方向：

- `node type -> menu keys -> menu renderers`

这是对的，但不能直接收成“每个 node type 自己决定所有 renderer”。

原因：

- 通用菜单会被重复实现
- 同样的颜色菜单会在 rect / sticky / callout / group 里复制很多份
- 多选 toolbar 也难复用
- edge / mindmap 未来也会重复一套

所以最优形态不是：

- `node type -> full toolbar renderer`

而是分三层：

1. `Menu Registry`
2. `Toolbar Item Registry`
3. `Contribution Resolver`

也就是：

- 菜单渲染器按 `menuKey` 注册
- toolbar item 也按 `itemKey` 注册
- 每种 node 只声明“我要哪些 item / menu”
- 最终由 resolver 合并出当前 toolbar

这比“每个 node type 自己画一整套 toolbar”更优雅，也更可维护。


## 最优架构

### 1. Menu Registry

这是二级菜单的注册中心。

```ts
type NodeMenuKey =
  | 'fill'
  | 'stroke'
  | 'text'
  | 'layout'
  | 'arrange'
  | 'lock'
  | 'group'
  | 'shape'
  | 'image'
  | 'more'
```

```ts
type NodeMenuRenderer = (props: {
  node: Node
  commands: Commands['node']
  close: () => void
}) => ReactNode
```

```ts
type NodeMenuRegistry = {
  get: (key: NodeMenuKey) => NodeMenuRenderer | undefined
  register: (key: NodeMenuKey, renderer: NodeMenuRenderer) => void
}
```

职责：

- 根据 `menuKey` 找到菜单 renderer
- 菜单 renderer 只关心自身 UI，不关心 toolbar 排序


### 2. Toolbar Item Registry

这是 toolbar 图标项的定义中心。

```ts
type NodeToolbarItemKey =
  | 'fill'
  | 'stroke'
  | 'text'
  | 'layout'
  | 'arrange'
  | 'lock'
  | 'group'
  | 'more'
```

type NodeToolbarItemDefinition = {
  key: NodeToolbarItemKey
  icon: ReactNode
  label: string
  menuKey?: NodeMenuKey
  isVisible?: (node: Node) => boolean
  isActive?: (node: Node) => boolean
  isDisabled?: (node: Node) => boolean
  run?: (ctx: { node: Node; commands: Commands['node'] }) => void
}
```

职责：

- 定义图标、tooltip、可见性
- 决定该按钮是直接执行命令，还是打开某个 menu


### 3. Contribution Resolver

这是核心层。

它负责回答：

- 当前选中的 node 应该显示哪些 toolbar item
- 它们按什么顺序排
- 哪些是通用项
- 哪些是类型专属项

```ts
type NodeToolbarContribution = {
  itemKeys: NodeToolbarItemKey[]
}
```

最终不建议直接做成：

- `node type -> renderer`

而建议做成：

- `node type -> contribution`

也就是每种 node 只声明：

- 我要哪些 `itemKeys`

然后统一交给 registry 去解释。


## 推荐的数据模型

### 通用 item

通用 item 不由 node type 一个个重复声明，而是由 capability 决定。

例如：

- 有 `style.fill` 或 fill schema 字段，就有 `fill`
- 有 `style.stroke` / `style.strokeWidth`，就有 `stroke`
- 有 `data.text` / `data.title`，就有 `text`
- 可锁定，就有 `lock`
- 几乎所有 node 都有 `arrange`

也就是说，第一层不是看“node type 是什么”，而是看“node 能调什么”。


### 类型专属 item

只有少数才需要 node type 专属：

- group
  - `group`
- image
  - `image`
- arrow-sticker
  - `shape`
- freehand
  - `stroke` 可能是专用 menu

所以最优模型是：

```ts
type NodeToolbarSpec = {
  common: NodeToolbarItemKey[]
  custom: NodeToolbarItemKey[]
}
```

先根据 schema / capabilities 生成 `common`，再由 node type 补 `custom`。


## 推荐解析流程

最优解析链路：

1. 读取当前单选 node
2. 读取它的 schema
3. 从 schema 推导 capabilities
4. 用 capabilities 生成 common item keys
5. 用 node type 追加 custom item keys
6. 去重、排序
7. 输出 toolbar view

```ts
type NodeToolbarView = {
  nodeId: NodeId
  anchorRect: Rect
  items: Array<{
    key: NodeToolbarItemKey
    label: string
    icon: ReactNode
    active: boolean
    disabled: boolean
    menuKey?: NodeMenuKey
  }>
}
```

这一步完成后，UI 只负责渲染，不负责拼逻辑。


## 最推荐的系统边界

### 不是：

`node type -> menu keys -> menu renderers`

### 而是：

`node -> capabilities -> toolbar item keys -> menu keys -> menu renderers`

其中：

- `capabilities` 决定通用能力
- `node type` 只补专属项
- `menu renderer` 只按 `menuKey` 注册

这是最优的，因为它把：

- 通用项
- 类型项
- 菜单渲染
- toolbar 编排

拆成了四个独立层次。


## 通用能力怎么推导

推荐新增一个纯 resolver：

```ts
type NodeToolbarCapabilities = {
  fill: boolean
  stroke: boolean
  text: boolean
  arrange: boolean
  lock: boolean
  group: boolean
}
```

推导来源：

- schema fields
- node.type
- node 本身字段

举例：

- 有 `scope=style, path=fill` 的字段，说明支持 fill
- 有 `scope=style, path=stroke` 或 `strokeWidth`，说明支持 stroke
- 有 `data.text` 或 `data.title`，说明支持 text
- `type === 'group'`，说明支持 group 专属菜单

这样未来新增 node 时，只要 schema 到位，大量通用 toolbar 就天然出现，不需要单独写 UI 分支。


## Toolbar 的显示系统如何做

这是这套设计最关键的一部分。

推荐做一个独立功能目录：

```txt
packages/whiteboard-react/src/toolbar/
  hooks/
    useNodeToolbarView.ts
    useToolbarPosition.ts
    useToolbarMenuState.ts
  components/
    NodeToolbarFeature.tsx
    NodeToolbar.tsx
    NodeToolbarItem.tsx
    NodeToolbarMenu.tsx
  registry/
    toolbarItems.tsx
    menus.tsx
    contributions.ts
  utils/
    capabilities.ts
    placement.ts
    ordering.ts
```

### `NodeToolbarFeature`

职责：

- 读当前 selection
- 只在单选 node 时显示 toolbar
- 管理 active menu key
- 把 toolbar 和 menu 渲染到一个 overlay layer

### `useNodeToolbarView`

职责：

- 把 node、schema、definition、selection resolve 成一个纯 view model

### `useToolbarPosition`

职责：

- 计算 toolbar 的 anchor
- 根据视口空间决定菜单弹上方还是下方
- 必要时做横向偏移，避免出 viewport


## 菜单弹出位置怎么定

你的要求是：

- 图标下方或上方弹出，看空间决定

这个规则应该做成一个统一定位器，不要每个 menu 自己算。

建议：

```ts
type MenuPlacement = 'top' | 'bottom'
```

定位逻辑：

1. 先尝试 `bottom`
2. 如果 bottom 空间不够，切到 `top`
3. 水平方向尽量和图标中心对齐
4. 如果超出 viewport，则做 clamp

不要让菜单跟 node，而应该跟“当前被点中的 toolbar item”对齐。


## Toolbar 本身怎么定位

推荐规则：

- 默认在 node 上边缘外侧居中
- 如果 node 顶部空间不够，则贴下方
- 如果 node 太小，toolbar 仍然可以浮在外侧，不嵌入 node 内部

不要把 toolbar 塞进 node 内容区，否则会遮住内容，特别是小节点。


## 第一版 toolbar item 建议

单选 node 时，推荐先做这几类：

- `fill`
- `stroke`
- `text`
- `arrange`
- `lock`
- `more`

第一版已经足够覆盖绝大多数 shape / sticker / text / sticky / group。


## 各菜单的推荐内容

### `fill`

内容：

- 常用色盘
- 透明度
- 无填充

适用：

- rect
- sticky
- shape
- callout
- highlight
- group


### `stroke`

内容：

- 颜色
- 宽度
- dash

适用：

- rect
- shape
- arrow-sticker
- group


### `text`

内容：

- 文本颜色
- 字号
- 粗细
- 对齐
- 对于 `text/sticky/callout` 可跳到内联编辑


### `arrange`

内容：

- bring to front
- send to back
- bring forward
- send backward


### `lock`

可以是直接动作，也可以是小菜单：

- 锁定 / 解锁


### `more`

这是未来扩展口。

第一版可以先放：

- 复制样式
- 粘贴样式
- 删除
- 高级设置

以后如果真的需要 sidebar，可以从这里进。


## Group 的特殊处理

group 很特殊，因为它既有通用样式，又有结构语义。

建议 group toolbar 包含：

- fill
- stroke
- text
- group
- arrange
- lock

`group` 专属菜单里放：

- collapse / expand
- autoFit: `expand-only` / `manual`
- padding

这类配置不应该塞进通用 fill / stroke 菜单。


## 文本类节点的特殊处理

文本类节点仍然保留双击原地编辑，这是最快的文本输入方式。

但 toolbar 里仍然应该有 `text` 按钮，因为它负责：

- 颜色
- 字号
- 对齐

也就是说：

- 内容输入：内联编辑
- 样式调整：toolbar text menu


## 多选如何处理

多选时也应该有 toolbar，但不能直接复用单选逻辑。

推荐第一版：

- 多选显示简化 toolbar
- 只显示真正通用的项

例如：

- fill
- stroke
- arrange
- lock
- more

不要第一版就做：

- 文本菜单
- group 专属菜单
- 类型混合复杂菜单

多选的原则是：

- 只暴露对整个 selection 稳定成立的通用项


## Schema 在这套设计里的角色

虽然主交互改成 toolbar，不再是 sidebar 主导，但 schema 仍然很关键。

schema 主要承担三件事：

1. 决定 node 支持哪些属性
2. 决定某些 toolbar item 是否显示
3. 为 menu renderer 提供字段元数据

所以 schema 不是直接渲染整块面板，而是变成：

- capability source
- menu input source

这是更适合 toolbar 模式的用法。


## 第一版不建议做的事情

### 1. 不要每个 node 自己定义整条 toolbar JSX

这会马上导致：

- 重复
- 不一致
- 很难做多选
- 很难做通用菜单

node type 最多只应该补：

- `custom item keys`
- 可选的 `menu overrides`

而不是整条 toolbar renderer。


### 2. 不要把 toolbar 状态塞进 instance

例如：

- 当前打开哪个 menu
- toolbar 是否显示
- 当前激活的按钮

这些都属于 UI state，应该放 Jotai ui store。


### 3. 不要让 menu renderer 自己直接判断所有类型

例如不要在 `fillMenu` 里写：

- 如果是 rect 做这个
- 如果是 sticky 做那个
- 如果是 group 做另一个

应当提前通过 capability / toolbar view 把范围收好，menu renderer 只处理“这个菜单应该如何编辑这些字段”。


## 推荐的第一版落地顺序

### 第一步：单选 node toolbar

目标：

- 选中 node 后显示 toolbar
- 支持一个 active menu
- menu 自动上下翻转


### 第二步：做通用 item registry 和 menu registry

先做最小集合：

- `fill`
- `stroke`
- `text`
- `arrange`
- `lock`
- `more`


### 第三步：给默认节点补 capability / schema

至少覆盖：

- text
- sticky
- rect
- group
- ellipse
- diamond
- triangle
- arrow-sticker
- callout
- highlight


### 第四步：补 group 专属 menu

把：

- collapse
- autoFit
- padding

放进去。


### 第五步：补 multi-select toolbar

先只支持通用样式项，不做复杂混合逻辑。


## 命名建议

推荐命名：

- `NodeToolbarFeature`
- `useNodeToolbarView`
- `NodeToolbarItemRegistry`
- `NodeMenuRegistry`
- `resolveNodeToolbarCapabilities`
- `resolveNodeToolbarItems`
- `resolveMenuPlacement`

不建议叫：

- `NodeInspector`
- `SidebarEditor`
- `NodePropertyPanel`

因为主交互已经不是面板，而是 toolbar 系统。


## 最终建议

如果只给一个明确答案：

就按 Miro 做。

也就是：

- 点击 node
- node 上方出现图标 toolbar
- 点图标
- 图标上方或下方弹二级菜单

而技术实现上，最优结构不是简单地把它做成：

- `node type -> menu keys -> menu renderers`

而是做成：

- `node -> capabilities`
- `capabilities + node type -> toolbar item keys`
- `toolbar item -> menu key`
- `menu key -> menu renderer`

其中：

- 通用项优先由 capability 推导
- 类型项只补专属 item
- menu renderer 统一注册复用

这样后面你新增 node 时，大部分情况下只要：

- 补 schema
- 补少量 custom item contribution

就能自动接入整套 toolbar 编辑系统，而不用每个 node 再手写一份属性 UI。
