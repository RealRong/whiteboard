# Whiteboard Host 收敛方案

## 1. 背景

当前 `whiteboard-editor` 中的 `host` 同时承担了三类职责：

1. 提供给 `whiteboard-react` 读取和绑定的公共 runtime surface。
2. 作为 editor 内部输入链路的行为调度入口。
3. 作为 `internals` 的一层镜像，把内部 runtime 直接暴露出去。

这三类职责混在一起，会带来几个直接问题：

- `host` 过大，边界不清晰。
- `host` 和 `internals` 高度重复。
- editor 内部实现反向依赖 `host`，导致 public surface 和 private implementation 缠在一起。
- `whiteboard-react` 实际依赖的是 `host`，但 `host` 本身并不是显式设计出来的公共接口，而更像“内部对象的拼装结果”。

如果继续沿当前方向扩展，后续每加一个 runtime，都很容易顺手塞进 `host`，结果就是公共接口越来越大，内部结构越来越难收。

## 2. 当前结构判断

从当前实现看：

- `whiteboard-react` 不直接访问 `editor.internals`。
- `whiteboard-react` 主要通过 `editor.host.*` 读取运行时状态或绑定 runtime 能力。
- editor 内部输入链路同样在调用 `editor.host.*` 启动各 feature runtime。

这说明 `host` 事实上已经是一个公共运行时接口，只是这个接口还没有被明确限制和建模。

### 2.1 `host` 现在实际装了什么

当前 `EditorHost` 主要包含：

- `registry`
- `interaction`
- `viewport`
- `pick`
- `snap`
- `selection`
- `draw`
- `node`
- `edge`
- `mindmap`

其中既有 React 真正需要的“可读运行时”，也有 editor 私有的“输入启动 runtime”。

### 2.2 `whiteboard-react` 真正使用的 `host`

根据当前消费点，React 真正直接使用的是：

- `host.registry`
  - 查询节点 definition / schema / render 信息
- `host.pick.bind`
  - 绑定 DOM pick
- `host.viewport`
  - 绑定 viewport rect / wheel / pan 输入
- `host.interaction`
  - 读取 `busy` / `space` / `mode`
  - 触发 viewport-pan 一类 runtime
- `host.draw.preview`
  - 绘制预览层
- `host.selection.marquee`
  - 框选可视状态
- `host.edge.preview`
  - edge hint / patch / route preview
- `host.mindmap.session`
  - mindmap 拖拽中的可视状态
- `host.snap.node.guides`
  - 节点吸附参考线

反过来，React 基本不直接用这些：

- `host.draw.startStroke/startErase`
- `host.selection.press`
- `host.node.transform`
- `host.edge.connect`
- `host.edge.input`
- `host.mindmap.drag`

这批对象更像 editor 内部输入行为 runtime，不像 React 公共读模型。

## 3. 当前最明显的结构异味

## 3.1 `host` 和 `internals` 高度重复

当前 `EditorRuntime` 同时存在：

- `editor.host`
- `editor.internals`

两者包含大量重复对象：

- `pick`
- `viewport`
- `snap`
- `selection`
- `draw`
- `edge`
- `mindmap drag/session`

这意味着：

- 同一个 runtime 既是 public，又是 private。
- `host` 和 `internals` 没有明确边界。
- `createEditorHost` 更像“投影内部对象”，而不是“建公共接口”。

## 3.2 `createEditorHost` 通过 spread internals 生成公共接口

当前 `createEditorHost` 里最值得警惕的做法是：

- `node: { ...internals.node, transform }`
- `edge: { ...internals.edge, connect, input }`

这类写法意味着：

- `host` 的 shape 由内部对象偶然决定。
- 内部 runtime 一旦变化，public surface 也会被动变化。
- 无法明确回答“这个字段为什么是 public”。

这不是一个稳定公共接口应该有的形成方式。

## 3.3 editor 内部实现反向依赖 `host`

当前输入链路里：

- `runtime/input/runtime.ts`
- `runtime/input/interactionStart.ts`

都在通过 `editor.host.*` 调用各 feature runtime。

这会造成职责方向反转：

- 原本 `host` 应该服务外部消费方
- 现在 editor 内部实现也依赖它

结果是：

- public surface 无法缩减
- private runtime 无法自然退回 internals
- 任何内部改动都容易牵动 React 类型面

## 3.4 存在重复入口

当前至少有两组重复入口：

- `editor.interaction`
- `editor.host.interaction`

以及：

- `editor.registry`
- `editor.host.registry`

其中 `interaction` 几乎是纯重复。

`registry` 稍特殊，因为 `whiteboard-react` 在类型上希望拿到更宽的 registry definition，但结构上依然属于重复入口。

## 4. host 的正确定位

建议明确：

`host = 提供给 whiteboard-react 和宿主层使用的公共 runtime surface`

而不是：

- `host = editor 内部 runtime 总袋子`
- `host = internals 的镜像`
- `host = 所有 feature 行为入口`

一旦采用这个定位，判断一个对象应不应该放在 `host` 上就很简单：

### 放进 `host` 的标准

- React 组件需要直接读取它的状态。
- React 生命周期层需要直接绑定它的 DOM/runtime 能力。
- 非 React 宿主未来也可能需要用到它。

### 不放进 `host` 的标准

- 它只被 editor 内部输入链路使用。
- 它只负责启动、取消、调度某个 feature session。
- 它本质上是内部协作对象，不是公共读模型。

## 5. 最简 host 设计

如果按“概念尽量少”的目标来设计，`host` 最终应该更接近下面这个结构：

```ts
type EditorHost = {
  registry: PublicNodeRegistry
  pick: {
    bind: PickRuntime['bind']
  }
  viewport: ViewportRuntime
  interaction: InteractionCoordinator
  draw: {
    preview: DrawPreviewStore
  }
  selection: {
    marquee: MarqueeSession
  }
  edge: {
    preview: EdgePreview
  }
  mindmap: {
    session: MindmapDragStore
  }
  snap: {
    guides: SnapGuidesStore
  }
}
```

这个设计有几个关键点：

- `host` 只承载 React 真正要读或绑定的运行时对象。
- `host` 不再暴露 feature 行为 runtime。
- `host` 不再 mirror `internals`。
- `host` 的每个字段都能回答“为什么它是 public”。

## 6. 哪些应该退回 internals

下面这些建议从 `host` 移出，退回 editor 私有实现层：

- draw input runtime
  - `startStroke`
  - `startErase`
  - `cancel`
- selection press runtime
- node transform runtime
- edge connect runtime
- edge input runtime
- mindmap drag runtime

这些对象的共同特点是：

- 主要服务 editor 输入链路
- React 不直接消费
- 它们是行为 runtime，不是读模型

更合理的归属是：

- `editor.internals.input.*`
- 或 `editor.internals.runtime.*`

只要原则一致，具体命名可以后面再统一。

## 7. 对 `internals` 的建议

当前 `internals` 也有一点混杂：

- 有的是 editor feature 私有状态
- 有的是可视 preview store
- 有的是运行时基础设施

建议后续进一步分成更清晰的几类：

### 7.1 `internals.ui`

放 editor 自己维护的 UI/session store，例如：

- node session preview
- edge preview
- mindmap drag session store

### 7.2 `internals.input`

放 editor 内部输入行为 runtime，例如：

- draw runtime
- selection press runtime
- transform runtime
- edge connect runtime
- edge input runtime
- mindmap drag runtime

### 7.3 `internals.runtime`

放 editor 内部基础设施，例如：

- pick runtime
- snap runtime
- viewport runtime

这样之后：

- `host` 是 public projection
- `internals` 是 private implementation

两边不会再彼此污染。

## 8. `interaction` 和 `registry` 怎么处理

## 8.1 `interaction`

`interaction` 当前同时存在于：

- `editor.interaction`
- `editor.host.interaction`

建议最终只保留一个公共入口。

更自然的方向是：

- `editor.interaction` 作为 runtime 顶层能力
- React 直接读取 `editor.interaction`

这样 `host.interaction` 可以删除。

原因：

- `interaction` 是 editor 全局 runtime，不是 feature host
- 它本来就已经是顶层字段
- 放到 `host` 里没有带来额外抽象价值

## 8.2 `registry`

`registry` 也存在重复：

- `editor.registry`
- `editor.host.registry`

这里不建议先简单粗暴删除，因为当前 React 侧对 `registry` 的类型期望更宽。

更合理的处理顺序是：

1. 先统一 editor / react 对 registry 的公共类型定义。
2. 让 React runtime 顶层拿到正确的 registry 类型。
3. 再决定是只保留 `editor.registry`，还是保留 `host.registry` 作为 UI runtime projection。

我的倾向是最终只保留一个顶层 `editor.registry`。

## 9. 对 whiteboard-react 的影响

当前 `whiteboard-react` 里的 `useEditorRuntime()` 直接把完整 runtime 暴露给组件。

这意味着：

- `host` 一旦变化，会直接影响组件代码
- `EditorRuntime` 的内部命名会外溢到 React

如果继续收敛，建议 React 最终依赖的不是“完整 editor runtime”，而是更稳定的“React runtime projection”。

可以理解为：

```ts
type WhiteboardRuntime = {
  read: ...
  state: ...
  commands: ...
  input: ...
  viewport: ...
  interaction: ...
  registry: ...
  host: {
    pick: ...
    viewport: ...
    draw: ...
    selection: ...
    edge: ...
    mindmap: ...
    snap: ...
  }
}
```

这里的重点不是一定保留 `host`，而是要让 React 依赖一个稳定且显式的运行时投影，而不是 editor 内部实现对象。

## 10. 推荐实施顺序

建议按下面顺序推进，避免一次性大改：

### 阶段 1：先切职责边界

- 禁止 editor 内部输入链路再通过 `host` 调 feature runtime。
- 把 feature 行为 runtime 收回到 `internals.input` 或类似私有层。
- 让 `runtime/input` 只依赖 internals，不依赖 host。

这是最关键的一步。

### 阶段 2：缩减 host

- 从 `host` 删除不被 React 使用的行为 runtime。
- `host` 只保留读模型和少量公共绑定能力。
- `createEditorHost` 改成显式投影，不再 spread internals。

### 阶段 3：处理重复顶层入口

- 收掉 `host.interaction`
- 评估并收掉 `host.registry`
- 清理 `EditorRuntime` 顶层字段和 `host` 的重复关系

### 阶段 4：稳定 React 运行时类型

- 不再让 `whiteboard-react` 直接依赖 editor 内部 runtime 类型路径
- 改为 editor 明确导出的 public runtime type
- 把 `WhiteboardRuntime` 从“结构覆盖”改成“显式公共类型”

## 11. 最终判断

当前 `host` 最大的问题不是名字不够好，而是边界错位：

- 它应该是 public projection
- 现在却仍然夹带了 private behavior runtime

因此最优先的优化不是继续做局部命名微调，而是：

1. 把 public 和 private 分开。
2. 让 editor 内部不再依赖 host。
3. 让 host 只保留 React 真正需要的 runtime surface。

一旦这个边界切开，后面很多问题会自然消失：

- `host` 会明显变瘦
- `internals` 会更清晰
- `createEditorHost` 会更简单
- `whiteboard-react` 的 runtime API 会更稳定
- 后续继续收 editor 时，不会再陷入“改一个内部 runtime 就牵动整条 UI surface”的局面

## 12. 一句话方案

`host` 不应该继续做 internal bag，而应该收敛成 explicit public runtime projection。  
行为 runtime 退回 internals，读模型和公共绑定能力留在 host，重复顶层入口随后清理。
