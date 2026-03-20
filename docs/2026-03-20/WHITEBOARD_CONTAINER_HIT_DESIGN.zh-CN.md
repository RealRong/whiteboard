# Whiteboard Container Hit 设计

## 结论

当前 `group` 的长期最优设计，不应该继续按“普通 node”处理。

它在白板里的产品语义已经更接近：

1. `container`
2. `frame`
3. `section`

而不是传统设计工具里的：

1. `group`

一句话结论：

1. container 必须拆成 `body + shell`
2. `body` 负责大面积选择面
3. `shell` 负责明确操纵面
4. content 命中永远优先于 container
5. 实现上尽量简单，不做大而全的新 runtime 域

最终最优行为应当尽量贴近你观察到的 Miro：

1. 点击 container body 空白：选中 container
2. 选中后再次 `pointerdown + pointermove`：拖拽 container
3. `press` 超过阈值：取消 container 选择，开始 marquee
4. 点击 body 上的 node / edge：优先命中内容，不命中 container
5. title / border / handles 始终属于 container 自己的操纵区

## 为什么当前会出问题

当前仓库里的 `group` 有两个根本问题：

1. 它在产品语义上是 container
2. 但在 runtime 里仍然被当成普通 node

这会直接导致下面这些异味：

1. group 的整块 body 抢走组内 edge 的点击
2. group 的 body 和普通 node body 使用同一套 drag 入口
3. container 的“空白区选择”和“对象操纵”没有分开
4. 后面如果再加 frame / section，只会继续复制判断

也就是说，问题不是某一个 CSS z-index，而是 hit funnel 没立住。

## 目标

这份文档只回答一个问题：

长期最优的 container hit 应该怎么设计，既贴近 Miro，又尽量简单实现？

要求是：

1. 概念尽量少
2. 代码入口尽量少
3. 不新增大域
4. 不把普通 node 交互搞乱
5. 能一步步落地，不要求一次性重写全栈

## 设计原则

### 1. content 永远优先

container 只是组织壳子，不应该压过真实内容对象。

因此：

1. body 上如果命中 node，优先 node
2. body 上如果命中 edge，优先 edge
3. body 上如果命中 mindmap，优先 mindmap
4. 只有命中不到内容对象时，body 才解释成 container

这是整条链路最重要的一条原则。

### 2. 选择面和操纵面必须分开

container 的大面积 body 应该容易选中，但不应该承担全部操纵职责。

因此：

1. `body = select surface`
2. `shell = manipulate surface`

其中：

1. `body`
   - 负责大面积点击选中
   - 在已选中时进入 press funnel
2. `shell`
   - 负责 title
   - 负责 border
   - 负责 resize
   - 负责 menu

### 3. 不靠隐藏状态硬切换命中语义

不建议把规则设计成：

1. 第一次点 body 选中
2. 第二次 body 就完全变成拖拽区
3. 用户必须记住当前是否已选中

长期最优应该是明确 zone 语义：

1. body 一直是 body
2. shell 一直是 shell
3. 只是 body 在 selected 状态下，会进入 `press -> drag / hold-marquee` 分流

### 4. 不扩新的顶层 instance 域

不建议新增：

1. `instance.containerHit`
2. `instance.overlay.container`
3. `instance.api.container`

长期最优不是多一个抽象层，而是：

1. 让 container 成为 node 域里的一个明确 scene 角色
2. 让 body / shell 成为明确 hit zone

### 5. 先修 scene 角色，再修交互细节

当前最根本的问题是 container 还在普通 node scene 里。

因此优先级应该是：

1. 先把 container 从普通 node 命中面里拆出来
2. 再做 body press funnel
3. 最后再打磨 title / border 细节

## 最终模型

### 1. 最小新增语义

为了概念最少，只建议新增两个最小语义：

```ts
type NodeScene = 'content' | 'container'
type ContainerZone = 'body' | 'shell'
```

对应到 `NodeDefinition`，只需要一个最小字段：

```ts
type NodeDefinition = {
  type: string
  scene?: 'content' | 'container'
  // ...
}
```

说明：

1. 默认 `scene = 'content'`
2. 当前 `group` 标成 `scene = 'container'`
3. 以后 `frame / section` 也复用这个语义

不建议再加更多配置项，例如：

1. `hitMode`
2. `dragMode`
3. `overlayMode`
4. `selectionPolicy`

这些都会让模型膨胀。

### 2. ContainerZone

container 的命中区只保留两种：

1. `body`
2. `shell`

#### body

定义：

1. container 内部的大面积空白区域
2. 不包括 title / border rail / resize handles / menu

职责：

1. 在没有内容命中时，负责选中 container
2. 在 selected 状态下进入 press funnel

#### shell

定义：

1. title
2. border rail
3. resize handles
4. collapse / menu / badge

职责：

1. 选中 container
2. 拖拽 container
3. resize container
4. title edit / menu

## 最终交互规则

### 1. 点击 body 空白

结果：

1. 选中 container
2. 显示 container handles 和 toolbar

### 2. body 已选中后快速 move

行为：

1. `pointerdown`
2. 在 hold delay 内移动超过 drag threshold

结果：

1. 开始拖拽 container
2. body 进入 drag 分支

### 3. body 已选中后长按

行为：

1. `pointerdown`
2. 未明显移动
3. 超过 hold delay

结果：

1. 取消当前 container 选择
2. 开始 marquee
3. marquee 语义等同背景框选，但作用域受当前 container 约束

### 4. 点击 shell

结果：

1. 选中 container
2. title / border 可直接进入拖拽或 resize

这里不需要走 body 的 press funnel。

### 5. 点击 body 上的内容对象

结果：

1. 优先命中内容对象
2. container 不参与这次命中

这是必须保证的。

### 6. 点击 body 空白但未选中时拖拽

长期最优建议：

1. 第一阶段先只做点击选中
2. 不让未选中 body 第一拍直接拖 container

原因：

1. body 面积太大
2. 很容易和框选、内容操作冲突
3. 先选中再进入 selected-body funnel，手感会更稳

这是最简单且最稳的版本。

## Hit Funnel

最终 hit funnel 建议明确为：

1. overlay / handles / toolbar
2. content
3. container shell
4. container body
5. canvas background

这意味着：

1. container body 不是全局前景层
2. 它只是“空白 body 命中层”
3. content 一定要压在它上面

## 图层设计

长期最优不一定要把 container 做成 3 个独立 layer。

如果目标是：

1. 概念少
2. 组件少
3. pointer-events 叠层尽量简单

那么更推荐的方案是：

1. `ContainerLayer`
2. `ContainerChromeLayer`
3. `body hit` 不做独立 layer，而是做 background fallback hit rule

也就是：

1. 可见层只有 2 个
2. `body` 只是一个命中语义，不是一个单独的渲染层

### 1. ContainerLayer

职责：

1. 只画 container 背景
2. 只画填充与视觉区域

规则：

1. `pointer-events: none`
2. 放在 edge 和 content node 下面

### 2. ContainerChromeLayer

职责：

1. title
2. border rail
3. resize handles
4. menu / badge

规则：

1. 放在 edge / content node 之上
2. 只有 shell 区域 `pointer-events: auto`
3. 其余区域继续透明

### 3. Body Hit 作为命中回退规则

职责：

1. 当一次 pointerdown 没有命中 content
2. 也没有命中 shell
3. 再去判断当前位置是否落在某个 container body 空白区

规则：

1. 不需要额外的 React layer
2. 不需要额外的透明 DOM 覆盖层
3. 直接并到现有 canvas / background hit 解释里

这样可以天然保证：

1. content 优先于 container body
2. shell 仍然独立可操纵
3. body 仍然可选中 container

### 4. 推荐顺序

```text
ContainerLayer
EdgeLayer
ContentNodeLayer
MindmapLayer
ContainerChromeLayer
NodeOverlayLayer
EdgeOverlayLayer
```

body hit 不在这条图层顺序里，它属于：

1. background pointer fallback

这套顺序能同时保证：

1. 组内 edge 能点中
2. body 空白还能选中 container
3. shell 依然可操纵
4. 不额外引入一个 `ContainerBodyHitLayer`

## 最简单的实现方案

下面是长期最优里最简单的实现路径，不追求一次性完美，只追求结构不走歪。

### 1. 保留 `group` 类型，不急着改名

先不要在这一轮把 `group` 全部改成 `container`。

原因：

1. 当前问题是 runtime 语义，不是数据命名本身
2. 先把 `group` 当作 `scene = 'container'` 即可

也就是：

1. 数据层继续叫 `group`
2. 交互层把它当 container

### 2. 只给 NodeDefinition 增加 `scene`

这是最小的新增概念。

示意：

```ts
type NodeDefinition = {
  type: string
  scene?: 'content' | 'container'
}
```

当前只有：

1. `group -> container`
2. 其它全部默认 `content`

### 3. 不新增 provider / store / instance 顶层域

不建议新增：

1. container provider
2. container atom
3. container instance namespace

实现上只需要：

1. 复用当前 `node.item / node.list / selection / container / marquee`
2. 新增一个很薄的 container read projection
3. 新增一个很薄的 body press session
4. 在现有 canvas background hit 里增加 container body fallback

### 4. 复用现有 node press 思路，不重做复杂状态机

container body 的交互，最简单的做法不是重新设计一大套 interaction framework，而是直接复用现有 node press 思路：

1. `pending press`
2. `drag threshold`
3. `hold delay`
4. `click finalize`

也就是：

1. `body` 点击后进入 pending
2. 若 selected 且快速 move，进入 container drag
3. 若 hold 超过阈值，清 selection 并开始 marquee
4. 若 pointerup，无移动，保留或切换为 selected

这样实现最简单，因为：

1. 你已经有成熟的 node press runtime
2. 只需要做一个 container 版薄封装
3. 不需要重新发明 interaction model

### 5. 不让 body 自己负责 resize

resize 只留在 shell。

这是必须收紧的边界。

否则 body 的职责又会膨胀成：

1. select
2. drag
3. resize
4. 菜单

这会重新回到现在的问题。

## 推荐实现拆分

为了尽量简单，建议最终只增加 4 个小入口：

1. `useContainerSceneView`
   - 读取 container 节点最小几何与标题信息
2. `ContainerLayer`
   - 只画背景
3. `ContainerChromeLayer`
   - 只画 shell
4. `createContainerPressSession`
   - 只解释 body press

以及一条很薄的命中函数：

5. `readContainerBodyTarget(point)`
   - 只做“这个空白点是否命中某个 container body”判断

其中最重要的一点是：

1. 不要让 `ContainerLayer` 处理任何交互
2. 不要让 `ContainerChromeLayer` 解释 body 逻辑
3. 不要把 body press 写回普通 node drag session 里到处加 `if group`
4. 不要为了 body hit 再建一个透明的大覆盖层

## 为什么不建议的方案

### 1. 不建议把 EdgeLayer 直接提到最上面

问题：

1. edge 会开始压过普通 node
2. 线经过节点时容易抢点击
3. 后面又要补一堆命中优先级特判

### 2. 不建议只改 group 的 CSS

例如：

1. group body `pointer-events: none`

这只能临时修 edge 命中，但会丢掉：

1. body 点击选中 container
2. body 的 selected press funnel

### 3. 不建议继续把 container 当普通 node body

这会让下面这些语义永远打架：

1. 普通 node body = 对象本体
2. container body = 组织空白区

它们不是一类东西，不应该继续共用同一个入口。

## 分阶段落地方案

### Phase 1: Scene 收口

目标：

1. 先修组内 edge 点不中

做法：

1. `group` 标成 `scene = 'container'`
2. 从普通 `NodeSceneLayer` 里拆出去
3. 增加：
   - `ContainerLayer`
   - `ContainerChromeLayer`
4. body hit 先不做独立 layer
5. 在 background hit fallback 里先只做点击选中

这是第一阶段最值的一步。

### Phase 2: Body Press Funnel

目标：

1. 对齐你观察到的 Miro 行为

做法：

1. 新增 `createContainerPressSession`
2. selected body：
   - move -> drag
   - hold -> marquee
3. body pointerdown 时不立刻清掉 handles / toolbar
4. 只有真正进入 drag 或 marquee 后才切 chrome

### Phase 3: 细节打磨

目标：

1. 打磨 shell 和 body 的视觉反馈

做法：

1. title hover / border hover
2. rail hit thickness
3. selected container 的 outline / toolbar 显示时机
4. active container scope 下的 body marquee 语义

### Phase 4: 命名清理

如果后面确认产品语义已经完全是 container，不再是传统 group，可以再考虑：

1. UI 上把 `group` 文案替换为 `Container` 或 `Frame`
2. 内部命名逐步从 `group` 收口到 `container`

这一步不是当下必须。

## 最终建议

长期最优而且实现最简单的方案是：

1. 把当前 `group` 当作 `container scene`
2. 用最小语义 `scene = 'container'`
3. 命中上只保留 `body + shell`
4. body 负责：
   - 空白点击选中
   - selected 后 press funnel
5. shell 负责：
   - drag
   - resize
   - title/menu
6. content 永远优先于 container
7. 通过 background fallback body hit 修掉组内 edge 点不中

一句话定稿：

1. 普通 node 的 body 是对象本体
2. container 的 body 是大面积选择面
3. container 的 shell 才是操纵面

这就是最符合白板行业习惯、概念最少、实现也最稳的长期方案。
