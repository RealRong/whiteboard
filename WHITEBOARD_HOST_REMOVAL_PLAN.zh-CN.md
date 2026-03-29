# Whiteboard Host 去除方案

## 1. 结论

`host` 作为一个独立的大 namespace，长期看可以全去掉。

但去掉 `host` 不等于把系统收成只有：

- `editor.read`
- `editor.commands`

这个二分法不够，因为当前 `host` 里有一批能力，既不是“读文档状态”，也不是“写文档命令”。

所以正确目标不是：

```ts
editor = { read, commands }
```

而是：

```ts
editor = {
  read,
  state,
  commands,
  input,
  viewport,
  registry,
  pick
}
```

如果这样拆，`host` 就没有继续存在的必要。

## 2. 为什么 `host` 可以去掉

当前 `host` 的存在，本质上是在给一些“公共 runtime 能力”找容器。

问题不在于这些能力不该存在，而在于：

- 它们被统一塞进了 `host`
- `host` 又混入了 editor 私有行为 runtime
- 最终变成一个 public / private 混杂的大袋子

既然这些能力本身都有更明确的归属，就没有必要继续用 `host` 这个中间层包起来。

换句话说：

- 需要保留的是能力
- 不需要保留的是 `host` 这个聚合容器

## 3. 为什么不能只剩 `read + commands`

这是最关键的边界判断。

### 3.1 `pick.bind` 不是 `read`，也不是 `commands`

React 当前通过 `editor.host.pick.bind` 给 DOM 元素绑定 pick 元信息。

这类能力的性质是：

- 它是运行时 DOM 绑定
- 它不读文档
- 它不写文档

所以它不能自然归入：

- `read`
- `commands`

更自然的去向是：

- `editor.pick.bind`
- 或 `editor.bind.pick`

### 3.2 viewport runtime 不是 `read`，也不是 `commands`

当前 React 侧用到的 viewport runtime 包括：

- `setRect`
- `input.wheel`
- `input.panScreenBy`
- `input.size`

这些能力的性质是：

- 依赖 DOM 容器尺寸
- 处理 wheel / pan runtime
- 参与 pointer 坐标转换

它们不是文档命令，也不是静态查询。

所以 viewport runtime 不能简单塞进：

- `read`
- `commands`

更自然的去向是：

- `editor.viewport`

但此时 `editor.viewport` 就不再只是 read，而应该成为真正的 viewport public runtime。

### 3.3 `input` 本来就是独立职责

当前已经存在：

- `editor.input.pointerDown`
- `editor.input.pointerMove`
- `editor.input.keyDown`
- `editor.input.blur`

这类 API 接受的是原始 DOM event，本质上是 runtime 事件入口。

把它们硬塞进 `commands` 会有两个问题：

- `commands` 被污染成“既包含 document write，也包含 raw event dispatch”
- `commands` 的语义从“命令”退化成“什么都能调用的入口”

所以 `input` 应该继续作为独立职责存在。

### 3.4 UI 会话态不是文档 read

当前 `host` 上一批 React 在读的状态，其实都属于瞬时 session/runtime state：

- draw preview
- marquee
- edge preview
- mindmap drag session
- snap guides

这些不是“从 document/index 推导出的稳定查询”，而是：

- 交互过程中创建
- 交互结束后清空
- 只服务 UI 展示

如果把它们全塞进 `read`，会把 `read` 这个概念变脏：

- `read` 原本表示查询/投影
- 结果会变成“什么都能读的 runtime bag”

更自然的去向是：

- `editor.state.session`
- 或 `editor.session`

## 4. 当前 `host` 里有哪些东西

当前 `host` 大体包含三类东西：

### 4.1 公共 runtime 能力

- `registry`
- `pick`
- `viewport`
- `interaction`

这些本质上是 editor 的公共能力，不一定需要一个 `host` 容器承载。

### 4.2 React 要读的 UI/runtime state

- `draw.preview`
- `selection.marquee`
- `edge.preview`
- `mindmap.session`
- `snap.node.guides`

这些是 React 确实在消费的 runtime state。

### 4.3 editor 私有行为 runtime

- `draw.startStroke/startErase`
- `selection.press`
- `node.transform`
- `edge.connect`
- `edge.input`
- `mindmap.drag`

这些主要服务 editor 内部输入链路，不该继续暴露在公共 `host` 上。

## 5. 去掉 `host` 之后，各类能力该去哪

## 5.1 应放到顶层的公共 runtime 能力

### `registry`

当前：

- `editor.registry`
- `editor.host.registry`

这是一组重复入口。

建议最终只保留：

- `editor.registry`

前提是先把 React 侧需要的 registry 公共类型建正。

### `interaction`

当前：

- `editor.interaction`
- `editor.host.interaction`

这也是重复入口。

建议最终只保留：

- `editor.interaction`

React 直接改读顶层 `interaction`。

### `pick`

当前 React 只实际用到：

- `pick.bind`

建议最终保留为：

- `editor.pick.bind`

不需要再通过 `host.pick` 中转。

### `viewport`

当前：

- `editor.viewport` 更像 read
- `editor.host.viewport` 才是 React 真在绑定的 runtime

如果去掉 `host`，建议最终把 viewport 统一收成：

- `editor.viewport`

但这里的 `editor.viewport` 需要正式成为公共 viewport runtime，而不只是 read facade。

## 5.2 应放到 `state/session` 的 UI 会话态

这批对象建议统一从 `host` 移到一个明确的 session state namespace。

建议目标：

```ts
editor.state.session = {
  drawPreview,
  marquee,
  edgePreview,
  mindmapDrag,
  snapGuides
}
```

对应关系大致如下：

- `host.draw.preview` -> `state.session.drawPreview`
- `host.selection.marquee` -> `state.session.marquee`
- `host.edge.preview` -> `state.session.edgePreview`
- `host.mindmap.session` -> `state.session.mindmapDrag`
- `host.snap.node.guides` -> `state.session.snapGuides`

这样 React 读取这些状态时，也更容易理解：

- 这不是 document read
- 这是交互态 session state

## 5.3 应退回 `internals` 的行为 runtime

下面这些建议全部移出公共面，退回 editor 私有实现层：

- draw input runtime
- selection press runtime
- node transform runtime
- edge connect runtime
- edge input runtime
- mindmap drag runtime

它们更合理的归属是：

- `editor.internals.input.*`
- 或 `editor.internals.runtime.*`

原则只有一个：

- editor 内部用它们
- React 不直接消费它们
- 所以它们不应继续存在于公共 runtime 面

## 6. 去掉 host 后的推荐 Editor 形状

如果完全去掉 `host`，我认为更合理的公共结构是：

```ts
type Editor = {
  config: ...
  read: ...
  state: {
    tool: ...
    draw: ...
    edit: ...
    selection: ...
    frame: ...
    interaction: {
      busy: boolean
      chrome: boolean
      space: boolean
      mode: InteractionMode
    }
    session: {
      drawPreview: ...
      marquee: ...
      edgePreview: ...
      mindmapDrag: ...
      snapGuides: ...
    }
  }
  commands: ...
  input: ...
  viewport: ViewportRuntime
  interaction: InteractionCoordinator
  registry: NodeRegistry
  pick: {
    bind: ...
  }
  configure: ...
  dispose: ...
}
```

这个形状的好处是：

- 没有 `host` 中间层
- 没有 public / private 混杂袋子
- 顶层职责直接可见
- React 可以按职责读取

## 7. 为什么这个形状比保留 host 更好

### 7.1 概念更少

保留 `host` 时，系统会多出一个问题：

- “这个能力为什么挂在 host，而不是 editor 顶层？”

去掉 `host` 后，判断会简单很多：

- 读模型 -> `read`
- 会话状态 -> `state`
- 写命令 -> `commands`
- 原始输入 -> `input`
- 基础 runtime -> 顶层 `viewport / interaction / registry / pick`

### 7.2 React 侧更容易理解

现在 React 代码里经常出现：

- `editor.host.viewport`
- `editor.host.interaction`
- `editor.host.edge.preview`
- `editor.host.selection.marquee`

这些其实混了三种完全不同的概念：

- runtime capability
- runtime state
- feature private object

如果改成按职责顶层暴露，React 侧心智模型会更直：

- 读取文档和投影：`editor.read`
- 读取 editor 状态：`editor.state`
- 发命令：`editor.commands`
- 送原始输入：`editor.input`
- 绑定 viewport：`editor.viewport`
- 绑定 pick：`editor.pick`
- 读 interaction：`editor.interaction`

### 7.3 public/private 边界会真正清楚

当前最根本的问题是：

- `host` 看起来像 public
- 但内部又混了 private runtime

一旦去掉 `host`，并把行为 runtime 全退回 `internals`，边界会变得非常清楚：

- public API 明确
- private runtime 明确

## 8. 风险和前提

虽然 `host` 可以去掉，但不建议直接一刀切删除。

主要风险有三个：

### 8.1 viewport 公共形态还没完全整理

当前：

- `editor.viewport`
- `editor.host.viewport`

两者职责不完全一致。

如果要去掉 `host`，必须先决定：

- 是把 runtime viewport 提升到顶层
- 还是把 read/runtime 再细分成两个顶层对象

### 8.2 interaction state 还不够完整

React 当前不只是读：

- `busy`
- `space`

还在读：

- `mode`

而 `mode` 当前在 `editor.interaction` 上，不在 `state.interaction` 的统一对象里。

如果要推动 React 全部离开 `host.interaction`，建议先把 `state.interaction` 补成完整交互状态。

### 8.3 registry 的公共类型要先建正

当前 React 侧对 `NodeRegistry` 的类型期望比 editor 侧更宽，尤其是 render/style 相关信息。

如果直接删掉 `host.registry`，而顶层 `editor.registry` 类型还没统一，React 代码会继续靠 cast 维持。

这不是一个稳定方案。

## 9. 推荐实施顺序

如果最终目标是完全删除 `host`，建议按下面顺序推进：

### 阶段 1：先把 private 行为 runtime 从 host 挪走

- `draw.start*`
- `selection.press`
- `node.transform`
- `edge.connect`
- `edge.input`
- `mindmap.drag`

先让 editor 内部输入链路改依赖 `internals`，而不是 `host`。

这是最关键的一步。

### 阶段 2：把 UI 会话态单独沉到 `state.session`

先给 React 一个稳定替代：

- `host.draw.preview` -> `state.session.drawPreview`
- `host.selection.marquee` -> `state.session.marquee`
- `host.edge.preview` -> `state.session.edgePreview`
- `host.mindmap.session` -> `state.session.mindmapDrag`
- `host.snap.node.guides` -> `state.session.snapGuides`

### 阶段 3：把基础 runtime 能力顶层化

- `host.interaction` -> `editor.interaction`
- `host.registry` -> `editor.registry`
- `host.pick.bind` -> `editor.pick.bind`
- `host.viewport` -> `editor.viewport`

### 阶段 4：删掉 host

在 React 侧所有消费点迁移完成后，再删除：

- `editor.host`

这时 `host` 才会自然消失，而不是硬砍。

## 10. 最终判断

我认为：

- `host` 可以全去掉
- 而且长期应该去掉

但我不认为最终系统应该只有：

- `read`
- `commands`

因为这会把：

- runtime capability
- raw input
- session state

全都错误地压进两个不合适的概念里。

更合理的最终方案是：

- `read` 负责查询
- `state` 负责状态
- `commands` 负责写入
- `input` 负责原始输入
- `viewport / interaction / registry / pick` 负责公共 runtime 能力

在这个形状下，`host` 就不再需要存在。

## 11. 一句话结论

`host` 可以删，但不能靠“只剩 read + commands”来删。  
真正正确的做法是把 `host` 拆散回各自正确的顶层职责，再让 private behavior runtime 全部退回 `internals`。
