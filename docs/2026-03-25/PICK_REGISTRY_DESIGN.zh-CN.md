# Pick Registry 设计

## 结论

`data-input-role` 不适合作为长期输入协议。

长期最优方案是：

- 以 `pick` 作为统一命中模型
- 以 `ref + WeakMap registry` 作为当前 DOM/SVG 渲染后端的实现
- 以根层单入口 `pointerdown` 漏斗作为交互入口
- 上层只消费 typed `pick`，不再直接读 `data-input-role`
- 未来如果切到 canvas，只替换 `pick` 后端，不改上层交互语义

一句话说，就是：

`data-*` 只能是临时 DOM 细节，`pick` 才应该是长期架构中心。

## 现状问题

当前命中链路的问题不在于“有没有命中”，而在于“命中协议散落在各处”。

主要问题有四个：

1. `data-input-role` 是字符串协议，天然膨胀
2. 多处代码自己读 DOM、取坐标、判断 target，重复较多
3. DOM 结构直接泄漏到交互层，不利于未来切换到 canvas
4. 同一个语义被多套 helper 表达，代码越来越像“修修补补的事件路由”

典型表现：

- `gesture / insert / draw / edge / context menu` 都在各自解析 target
- `data-node-id / data-edge-id / data-input-role` 被多处直接依赖
- 一部分逻辑是 DOM 查询，一部分是几何 fallback，一部分是业务判断
- 组件层还在大量透传 `onPointerDown`

这套方案短期能跑，但长期一定膨胀。

## 设计目标

目标只有五个：

1. 概念最少，只保留一套 `pick`
2. 上层不感知 DOM 细节
3. 根层只有一个画布文档交互入口
4. 向 canvas 渲染平滑过渡
5. 不再扩张新的字符串 role 协议

## 核心原则

### 1. 命中事实和业务语义分离

`pick` 只回答“命中了什么”，不回答“接下来要做什么”。

例如：

- `pick = node/body`
- `pick = node/transform`
- `pick = edge/end`
- `pick = background`

至于这是：

- 节点 press
- transform
- edge reconnect
- marquee
- insert

由上层路由决定，不由 `pick` 决定。

### 2. 统一的是 pick，不是事件总线

不做：

- `instance.interaction.on('pointerdown', ...)`
- `instance.node.handle(hit)`
- `instance.edge.handle(hit)`

因为这会把顺序、消费权、优先级重新做成一套框架。

长期最优仍然是：

- 一个根层 pointer 入口
- 一次 `pick`
- 普通 `if-return` 漏斗

### 3. DOM adapter 和交互层分开

DOM/SVG 现在可以用 `ref + WeakMap` 实现 pick。

未来切到 canvas：

- DOM adapter 可以整体替换
- `pick` 类型和上层路由保持不变

所以要区分：

- 稳定层：`Pick`
- 可替换层：DOM registry / canvas scene picker

## 最终模型

### Pick

建议把长期模型统一成这一套：

```ts
type Pick =
  | { kind: 'background' }
  | { kind: 'selection-box' }
  | {
      kind: 'node'
      id: NodeId
      part: 'body' | 'container' | 'transform' | 'connect'
      handle?: TransformHandle
      side?: EdgeAnchor['side']
    }
  | {
      kind: 'edge'
      id: EdgeId
      part: 'body' | 'end' | 'path'
      end?: 'source' | 'target'
      index?: number
      insert?: number
    }
  | {
      kind: 'mindmap'
      treeId: NodeId
      nodeId: MindmapNodeId
    }
```

说明：

- `kind` 表示命中的对象域
- `part` 表示对象上的局部区域
- `handle / side / end / index / insert` 是局部参数

不要再把这些语义揉成：

- `node-edge-handle`
- `edge-endpoint-handle`
- `edge-path-anchor`

这种字符串。

### PointerPick

统一的事件读取结果建议是：

```ts
type PointerPick = {
  pick: Pick
  point: {
    client: Point
    screen: Point
    world: Point
  }
  element: Element | null
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
  ignoreContent: boolean
}
```

这里保留 ignore/editorial 标志是合理的，因为它们描述的是“当前事件是否应该被白板文档交互消费”，不是业务对象模型。

### 最小 API

建议一步到位定成下面这两个入口：

```ts
instance.internals.pick.bind(element, pick)
instance.read.pick.from(event, container)
```

解释：

- `bind` 是 DOM 后端注册接口
- `from` 是统一的读取接口

这是足够小的一套 API，不需要更多层。

不建议做：

```ts
instance.read.pick.node(...)
instance.read.pick.edge(...)
instance.read.pick.resolveBackground(...)
instance.interaction.on(...)
```

这些都会让 API 再次膨胀。

## DOM 后端：ref + WeakMap registry

### 结构

当前 DOM/SVG 后端建议使用：

```ts
type PickRegistry = {
  bind: (element: Element, pick: Pick) => () => void
  read: (element: Element | null, within: Element) => Pick | undefined
}
```

内部数据结构建议是：

```ts
WeakMap<Element, Pick>
```

这就够了。

不需要额外做复杂索引。

原因：

- `pointerdown` 只需要沿着事件路径向上找最近注册元素
- `event.composedPath()` 很短，不会像全文扫描那样贵
- `WeakMap` 自动随元素释放，不需要额外回收表

### 为什么不需要 Map<id, element>

对输入命中来说，不需要。

因为输入问题只关心：

- 当前事件路径上的哪个元素先命中

而不关心：

- 某个 node id 反查所有元素

后者是编辑聚焦、滚动定位、测试辅助的问题，不应混进 pick registry。

### 读取算法

根层 `pointerdown` / `contextmenu` / `dblclick` 统一走：

```ts
instance.read.pick.from(event, container)
```

算法建议是：

1. 先计算 `client / screen / world`
2. 取 `event.target`
3. 用 `event.composedPath()` 自内向外找第一个已注册元素
4. 如果找到了，直接返回对应 `pick`
5. 如果没找到，返回 `background`
6. ignore / editable 标志单独计算

这里关键点是：

- `pick` 不再通过 `closest('[data-input-role]')` 推导
- 而是通过“最近已注册元素”直接得到 typed 结果

### React 侧绑定方式

组件不要再传 `onPointerDown(nodeId, ...)`。

组件只负责把“自己是什么”注册进去。

推荐形态：

```ts
const ref = usePickRef({ kind: 'node', id, part: 'body' })
return <div ref={ref} />
```

也就是说：

- 组件声明自己的交互身份
- 根层统一消费事件

这样组件职责更纯。

## 为什么这比 data-input-role 更好

### 1. 类型是结构化的

`Pick` 是对象，不是拼字符串。

新增能力时，扩展的是：

- 新的 `kind`
- 已有 `kind` 下的新 `part`
- 少量局部字段

而不是再造一串新 role。

### 2. DOM 结构变化更安全

只要 ref 绑定还在，交互身份就稳定。

不再依赖：

- 元素层级刚好能被 `closest(...)` 找到
- 某些属性必须挂在祖先还是子节点

### 3. 上层不再关心 DOM

上层拿到的是：

```ts
{ kind: 'edge', id, part: 'end', end: 'source' }
```

而不是：

```ts
event.target.closest('[data-input-role="edge-endpoint-handle"]')
```

### 4. 未来 canvas 可复用

canvas 后端只要能回答同样的 `Pick`，上层逻辑不需要改。

## 顶层 pointer 漏斗

根层只保留一个文档交互入口。

建议最终形态：

```ts
const onPointerDown = (event: PointerEvent) => {
  const input = instance.read.pick.from(event, container)

  if (tryViewportPan(instance, input, container)) return
  if (tryTool(instance, input, container)) return
  if (tryDirect(instance, input, container)) return
  trySelect(instance, input, container)
}
```

这里的函数都应是普通函数，不是事件总线，也不是注册中心。

### tryTool

处理当前 tool 独占逻辑：

- draw
- insert
- edge create

### tryDirect

处理不依赖当前 tool 或应优先于节点 press 的局部控件：

- node transform
- node connect handle
- edge endpoint
- edge path point
- edge body
- mindmap node

### trySelect

最后处理选择语义：

- selection box
- node body
- container body
- background

### 为什么顺序必须固定

固定顺序比事件总线简单得多。

因为：

- 谁先吃事件，一眼可见
- 不存在隐式 priority
- 不需要 `on/off`
- 不需要 handler registration

## container/body 的处理

`container body` 不应该再用几何 fallback 作为长期方案。

更简单的做法是：

- container 背景层自身注册 `{ kind: 'node', id, part: 'container' }`

这样：

- 命中事实来自 registry
- “当前 active container 内点击 body 到底算 background 还是 container body”留给上层策略判断

也就是说：

- `pick` 只给事实
- policy 决定行为

例如：

```ts
pick = { kind: 'node', id: groupId, part: 'container' }
```

如果当前 `activeContainer.id === groupId`，上层可以把它当成 scoped background。

这比在 pick 阶段硬编码业务规则更清晰。

## data-* 的保留策略

### 应该去掉的

输入协议层应去掉：

- `data-input-role`
- 依赖 `data-node-id / data-edge-id` 的输入命中读取

### 可以暂时保留的

下面这些可以暂时保留，但不再作为输入协议：

- `data-node-id`
- `data-edge-id`
- `data-node-editable-field`
- `data-selection-ignore`
- `data-input-ignore`
- `data-context-menu-ignore`

理由：

- `data-selection-ignore / data-input-ignore / data-context-menu-ignore` 是 UI opt-out 标记，不是对象命中协议
- `data-node-id / data-edge-id` 可以暂时保留给调试、样式、测试、迁移
- 但输入命中链不应再读取它们

长期来看：

- `data-node-id / data-edge-id` 也可以逐步降为纯调试属性
- 编辑聚焦可再单独做 `edit registry`

## 和 canvas 渲染的关系

这一套设计的关键就是让 DOM registry 成为“后端”，不是“协议”。

最终应抽成：

```ts
type PickBackend = {
  fromEvent: (event, container) => PointerPick
}
```

当前实现：

- DOMPickBackend
- 内部用 `WeakMap<Element, Pick>`

未来 canvas 实现：

- ScenePickBackend
- 内部用 scene graph / spatial index / geometry hit-test

上层始终只依赖：

```ts
instance.read.pick.from(event, container)
```

这才是长期最优的稳定边界。

## 迁移方案

### 阶段 1：引入 pick registry

目标：

- 新建 `pick` runtime
- 暂不改交互行为

要做的事：

- 新增 `instance.internals.pick.bind`
- 新增 `instance.read.pick.from`
- 用 registry 先替代局部 `closest('[data-input-role]')`

### 阶段 2：组件改为 ref 注册

目标：

- interactive element 不再声明 `data-input-role`

优先迁移这些元素：

- node body
- container body
- selection box
- transform handles
- connect handles
- edge body
- edge endpoints
- edge path points
- mindmap node

### 阶段 3：根层统一 pointerdown

目标：

- 画布文档交互只保留一个根入口

要做的事：

- 合并 node background / draw / insert / edge create 等 container 级 `pointerdown`
- 组件层删除大量 `onPointerDown` 透传

### 阶段 4：context menu / dblclick 统一走 pick

目标：

- 所有“基于命中对象”的入口统一使用同一套 pick

包括：

- context menu
- double click
- 未来可能的 hover / tooltip / inspector target

### 阶段 5：清理 DOM 协议残留

目标：

- `data-input-role` 完全删除
- 输入路径不再读 `data-node-id / data-edge-id`

## 不建议的方案

### 不建议做全局事件总线

不建议：

```ts
instance.interaction.on('pointerdown', ...)
```

问题：

- 会引入 handler 顺序协议
- 会产生消费权和优先级问题
- 会把协调器变成总线

### 不建议把 handle 全挂到 instance

不建议：

```ts
instance.node.handlePointerDown(input)
instance.edge.handlePointerDown(input)
```

问题：

- 会把画布宿主编排抬升成全局 API
- 顺序关系被打散
- 单消费者逻辑被错误升格

### 不建议继续扩展 data-input-role

不建议再新增：

- `edge-label`
- `node-toolbar-anchor`
- `shape-text`

这会让字符串协议继续膨胀。

## 最终建议

一步到位的最终建议如下：

1. 统一定义 `Pick` 和 `PointerPick`
2. 新增 `instance.internals.pick.bind` 和 `instance.read.pick.from`
3. 当前 DOM/SVG 后端使用 `ref + WeakMap<Element, Pick>`
4. 根层只保留一个文档 `pointerdown` 入口
5. 上层交互只看 `pick`，不再看 DOM dataset
6. `data-input-role` 全量退出
7. `data-node-id / data-edge-id` 降级为非输入协议属性

这套设计的优点是：

- 模型短
- API 少
- 迁移清晰
- DOM 和 canvas 边界明确
- 长期不会因为 role 字符串继续膨胀

如果只保留一句最终原则，那就是：

不要让 DOM 属性定义交互语义，要让 `pick` 定义交互语义。
