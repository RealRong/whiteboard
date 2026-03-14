# Container Capability 设计

## 问题

当前 `group` 已经不只是“把几个 node 绑定一起移动”的最小语义了，它还逐渐承担了这些能力：

- parent / child 归属
- auto fit
- manual resize
- collapsed
- group 内部选择诉求
- group 作为容器的 hit-test 优先级

与此同时，产品上又开始出现另一类需求：

- 16:9 / 4:3 / 1:1
- 类似 Miro / Figma 的设计画板
- 导出区域 / 页面区域
- 更强的边界、标题、背景语义

这时自然会出现一个问题：

**要不要把 `group` 继续扩展成一个通用容器？**

## 结论

不建议把 `group` 直接扩展成“万能容器类型”。  
最优方案是：

1. 抽出通用的 `container capability`
2. 让 `group` 成为一种具体 container
3. 新增 `frame` 或 `artboard` 作为另一种具体 container

也就是说：

- 底层逻辑统一
- 上层节点语义分开

## 为什么不能直接把 Group 做大

### `group` 的天然语义

`group` 更偏结构容器，特点通常是：

- 把已有对象组织成一个整体
- 更偏内容驱动
- 往往和内部 children 的包围盒关系很强
- 常见能力是：
  - auto fit
  - collapse
  - padding

也就是说，它更像：

- 结构分组
- 内容容器
- 逻辑组织单元

### `frame / artboard` 的天然语义

16:9 / 4:3 / 1:1 这种更像：

- 画板
- 页面
- 导出区域
- 演示画面

它的特点是：

- 边界是第一性的
- 尺寸通常由用户显式决定
- 可以带固定比例
- 常见能力是：
  - title
  - background
  - border
  - ratio preset
  - clip / export / presentation

也就是说，它更像：

- 边界容器
- 页面容器
- 设计工作区

## 关键判断

它们底层是同一类问题：

- 都是 bounded container
- 都有 children
- 都需要容器命中规则
- 都需要进入内部编辑

但它们不是同一种产品语义。

所以正确的方向不是：

- 把 `group` 继续加属性，一路变成 `frame`

而是：

- 抽出 container 基建
- 让 `group` 和 `frame` 都站在这个基建上

## 推荐模型

## 第一层：Container Capability

这不是一个 node type，而是一组通用能力。

建议它覆盖下面几个方面。

### 1. 子节点归属

统一支持：

- `parentId`
- children 跟随父容器移动
- children 可被命中和框选
- children 可在容器之间迁移

### 2. 容器作用域

这部分是 group 内部选择问题的根本。

建议不要继续叫 `activeGroupId`，而叫：

- `activeContainerId`
- 或 `scopeContainerId`

这样以后：

- group
- frame
- 未来 section

都能复用同一个机制。

### 3. 命中规则

统一支持：

- 默认优先命中容器本体
- 进入 container scope 后优先命中内部 children
- `Alt / Option` 临时 drill-through

### 4. 容器内 selection / marquee

统一支持：

- container scope 内部单选
- container scope 内部多选
- container scope 内框选
- 作用域限制为当前 container descendants

### 5. 容器 resize policy

这部分是 container 通用能力里最重要的一层抽象。

建议做成策略，而不是写死在具体 node type 里。

例如：

- `content-fit`
  - 尺寸由 children 计算

- `expand-only`
  - 只能向外适配内容

- `manual`
  - 由用户直接控制尺寸

- `aspect-ratio`
  - resize 时保持指定比例

### 6. 容器视觉能力

由 capability 提供支持，但具体是否启用由 node type 决定。

建议统一支持这些属性：

- title
- background
- border
- corner radius
- padding
- clip content
- aspect ratio preset

## 第二层：具体节点类型

### `group`

建议保留 `group`，但明确它是“轻量结构容器”。

适合：

- 多个 node 的逻辑分组
- 结构组织
- auto fit
- collapse
- 内容驱动边界

建议特征：

- 默认允许 auto fit
- 支持 collapsed
- resize 可以切换 `expand-only / manual`
- 不强调固定比例
- 不强调导出语义

### `frame`

建议新增 `frame`，用于承接设计画板语义。

适合：

- 16:9 / 4:3 / 1:1
- 页面
- 设计区域
- 演示区域
- 导出区域

建议特征：

- 尺寸边界第一性
- 默认 `manual`
- 可设置固定比例
- 通常有 title / background / border
- 可以进一步支持 clip / export

### `section`

可选，不一定现在就做。

更适合：

- 大块语义区域
- 白板信息分区
- 不一定强 fixed ratio
- 不一定强 export

如果当前目标主要是：

- group
- frame

那 `section` 可以后置。

## 推荐状态模型

### 容器作用域

第一版可用：

```ts
type ContainerScopeState = {
  activeContainerId?: NodeId
}
```

如果考虑未来容器嵌套，更好的长期模型是：

```ts
type ContainerScopeState = {
  path: readonly NodeId[]
}
```

其中：

```ts
const activeContainerId = path[path.length - 1]
```

这样未来支持：

- group 内嵌 group
- frame 内嵌 group
- 多级 drill-in / drill-out

就不会推翻模型。

## 命中与选择规则

### 默认状态

无 `activeContainerId`：

- 容器本体优先命中
- 点击容器内部区域，默认选中容器
- 拖动容器，移动整个容器

### 进入容器作用域后

有 `activeContainerId`：

- 当前容器 descendants 优先命中
- 内部 child 可直接单选 / 多选
- 框选只作用于当前容器 descendants
- 不应优先选中容器本体

### 临时穿透

建议统一支持：

- `Alt / Option + click`
  - 临时忽略容器本体命中

- `Alt / Option + marquee`
  - 临时框选内部 child

这条规则应该是通用 container 规则，而不是 group 专属。

## Resize Policy 建议

建议把不同容器的尺寸策略显式建模。

```ts
type ContainerResizeMode =
  | 'manual'
  | 'content-fit'
  | 'expand-only'

type ContainerAspectRatio =
  | 'free'
  | '1:1'
  | '4:3'
  | '16:9'
```

这里可以这样落：

### group

- 默认：`expand-only`
- 可切到：`manual`
- 不建议默认暴露 `aspectRatio`

### frame

- 默认：`manual`
- 可设置：
  - `free`
  - `1:1`
  - `4:3`
  - `16:9`

如果未来需要更复杂的 preset，可以扩展为：

- `A4`
- `iPhone`
- `Presentation`
- `Custom`

## 是否需要统一为单一 Container 节点

我不建议把所有容器都做成一个 `container` node type，然后靠配置完全区分。

原因：

- 产品语义不清晰
- toolbar/menu/schema 会变复杂
- 演示给用户时，“group”和“frame”是不同工具
- 后面 node registry、快捷创建、默认样式都会更难管理

更合理的是：

- 内部能力共享
- 外部 node type 区分

也就是：

- `group` 是一种 container
- `frame` 是另一种 container

## 对现有 whiteboard 代码的建议

### 第一阶段

先把 group 背后的交互命名抽通用：

- `activeGroupId` 改为 `activeContainerId`
- hit-test 改成 container-aware
- selection box 改成 container-scoped

这一步先只服务 group，但命名和接口不要写死 group。

### 第二阶段

把现有 group 的尺寸行为整理成策略化：

- `expand-only`
- `manual`
- 后续如果要也可以加 `content-fit`

### 第三阶段

新增 `frame` node type

第一版建议只支持：

- 手动尺寸
- ratio preset
- title
- background
- border
- children containment

### 第四阶段

如果未来需要，再继续补：

- clip
- export frame
- presentation frame
- section

## Toolbar / Context Menu 层面的影响

如果引入通用 container，UI 层应该也按能力分，而不是按 node type 一把梭。

例如：

- 通用 container 菜单：
  - enter container
  - exit container
  - arrange
  - lock

- group 专有菜单：
  - collapse
  - auto fit

- frame 专有菜单：
  - aspect ratio
  - background
  - clip
  - export

这意味着：

- toolbar / context menu 最终要按 capability + type 双维度生成
- 不能再只按“是不是 group”分支

## 最优演进方向

最优的长期形态是：

1. 抽通用 container capability
2. 让 group 变成 content-oriented container
3. 新增 frame 作为 boundary-oriented container
4. 后续如有需要再加 section

## 一句话结论

16:9 / 4:3 / 1:1 和现在的 group，底层确实是同一个“容器问题”，但产品语义不是一个东西。  
最优方案不是把 `group` 继续做大，而是抽出通用 `container capability`，然后让 `group` 和 `frame/artboard` 分别作为两种不同的容器节点站在这个基础上。
