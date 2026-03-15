# Whiteboard React 统一入口降复杂度方案

## 目标

这份方案的目标只有两个：

1. 统一 UI 侧读取入口
2. 在不牺牲关键性能特性的前提下尽量减少复杂度

这里的“统一入口”不是指把所有东西塞进一个 mega hook，也不是把所有状态都提升到全局 store，而是明确一套稳定边界：

- `read` 负责同步读取原始或低级数据
- `view` 负责提供给 UI 的可订阅读模型
- `commands` 负责所有写入
- 局部 UI chrome 用本地 `useState`


## 当前主要问题

### 1. 同一类数据有多套消费路径

目前 UI 侧同时存在这些模式：

- `instance.read.xxx.get/subscribe`
- `instance.view.xxx.get/subscribe`
- 某些独立 hook 自己手写 `useSyncExternalStore`
- 某些局部 UI 自己用 `useState`
- 某些状态还会额外暴露 `instance.state.xxx.get()`

问题不在于这些单独看都不能工作，而在于阅读时必须先判断：

- 我应该读 `read` 还是 `view`
- 我应该用现成 hook 还是自己订阅
- 这个东西是不是只在 imperative 路径里可读
- 这个东西是不是其实应该是本地 UI 状态

这会显著增加理解成本。

### 2. `state` / `view` / hook 的职责边界不够清楚

当前一些状态既存在：

- `instance.state.xxx.get()`

又存在：

- `useXxx()`

再加上：

- `instance.view.xxx`

这类三套入口并存时，容易让人怀疑：

- `state` 和 `view` 到底差别是什么
- hook 是不是只是换个名字包一层
- 哪条链才是正式入口

### 3. 局部 UI 和全局编辑状态曾经混在一起

这部分已经开始收敛，但原则需要明确写下来。

像这些状态：

- context menu
- node toolbar menu
- popover
- hover panel

它们是局部 UI 会话，不应该进入 runtime 的全局编辑状态层。

### 4. `useSyncExternalStore` 不是问题本身，分散使用才是问题

`useSyncExternalStore` 对外部 store 是正确桥接方式，本身没有问题。

复杂度真正来自：

- 多个模块各自手写一遍
- 一些地方直接用 `read.subscribe`
- 一些地方用 `view.subscribe`
- 一些地方又额外包了一层专用 hook

结果是“模式没有收敛”。


## 设计原则

### 原则 1：`instance` 不直接暴露 React hook

`instance` 是 runtime 集成点，不应该知道 React hook 规则。

原因：

- hook 只能在 React render 中调用
- `instance` 还需要服务 imperative handler、service、测试、非 React host
- 把 hook 作为 instance method 会把 runtime 和 React 绑死

因此，不采用：

- `instance.useSelection()`
- `instance.useNode(nodeId)`
- `instance.useTool()`

而采用：

- `instance.view.selection`
- `instance.view.node`
- `instance.view.tool`

React 再通过通用 hook 去消费。

### 原则 2：UI 读取统一走 `view`

只要某个数据需要被 React 订阅，就应该优先通过 `instance.view.*` 暴露。

`view` 的职责是：

- 对 runtime / draft / read 做聚合
- 提供 `get`
- 提供 `subscribe`
- 必要时提供 `isEqual`

也就是说，`view` 是 UI 的正式读入口。

### 原则 3：`read` 只负责同步读取，不负责 UI 语义

`read` 保持为低层读接口：

- engine read
- index read
- geometry read
- container read

它可以有 `subscribe`，因为 runtime 自身也需要它，但对 UI 来说，不应该默认直接消费 `read`。

UI 应优先消费 resolved view，而不是自己拼装：

- committed data
- transient draft
- scope
- selection
- overlay state

### 原则 4：所有写入统一走 `commands`

无论数据最终放在 engine、editor store 还是局部 UI state：

- engine / editor state 的写入统一走 `instance.commands`
- 局部 UI chrome 的写入留在组件本地

不要重新出现第二套 write API。

### 原则 5：局部 UI 会话不进 `view`

以下状态统一留在本地组件层：

- context menu open session
- toolbar active menu
- popover open state
- hover panel visibility
- menu anchor / placement 临时信息

这类状态不需要：

- `instance.state`
- `instance.view`
- `uiStore/editorStore`


## 最优目标模型

### 1. `instance.read`

职责：

- 原始同步读取
- index / geometry / engine read
- imperative 逻辑使用

典型例子：

- `instance.read.node.get(nodeId)`
- `instance.read.edge.get(edgeId)`
- `instance.read.index.node.byId(nodeId)`
- `instance.read.container.activeId()`

适用场景：

- pointermove 热路径
- 命中检测
- 计算逻辑
- view 内部聚合

### 2. `instance.view`

职责：

- 给 UI 的正式可订阅读入口
- 输出 resolved data
- 聚合 committed data + transient + scope + selection

目标包含：

- `view.tool`
- `view.selection`
- `view.scope`
- `view.interaction`
- `view.node`
- `view.edge`

可选后续扩展：

- `view.viewport`
- `view.mindmap`

### 3. `instance.commands`

职责：

- 所有可共享的 editor 写入入口

包括：

- engine document / node / edge 命令
- tool 切换
- selection 修改
- container enter / exit

### 4. local UI state

职责：

- 单个 surface / component 局部会话

包括：

- context menu session
- toolbar menu key
- popover state
- hover panel state


## 关于 `get/subscribe + useSyncExternalStore`

### 为什么存在

这是 React 接入外部 store 的标准模式。

对于 whiteboard 这类系统，很多数据并不是 React `useState`，而是 runtime 自己维护的外部状态源：

- engine read
- transient draft
- selection
- viewport
- keyed node/edge read model

这些外部状态要安全接入 React，`useSyncExternalStore` 是正确方式。

### 它解决什么问题

它同时解决三件事：

1. React 并发/严格模式下的外部 store 一致性
2. 细粒度订阅
3. runtime 与 React 解耦

### 它不应该到处手写

最优做法不是删掉 `useSyncExternalStore`，而是收敛它的使用位置。

建议：

- `useView`
- `useKeyedView`

作为通用桥接层存在。

不建议继续扩散：

- 每个业务 hook 都自己手写一遍 `useSyncExternalStore`
- 每个模块都发明一套本地 subscribe wrapper


## 为什么 UI 侧不应该直接消费 `instance.read`

因为 `read` 输出的是原始低层数据，UI 会被迫自己处理这些事情：

- committed data 与 transient draft 合并
- edge 是否受 node draft 影响
- scope / selection 过滤
- resolved geometry / style
- hovered / preview / overlay 派生

一旦这些合并逻辑散落到各个组件里，复杂度会迅速回升。

所以 UI 侧原则上应该消费 `view`，而不是自己拼 `read + transient + selection`。


## 为什么不让 `instance` 直接暴露 hook

### 1. hook 不是 runtime API

hook 只能在 React render 生命周期中调用，这和 runtime 对象的语义不一致。

### 2. 会破坏边界

一旦 `instance` 暴露 hook，就等于 runtime 直接依赖 React。

### 3. 无法复用于 imperative 路径

热路径里的 handler 需要：

- `get()`

而不是 hook。

### 4. API 形态不稳定

对象方法是 anywhere API，hook 是 React-only API，把两者混在一个对象上会造成认知混乱。

因此，推荐结构是：

- `instance.view.xxx`
- `useView(instance.view.xxx)`

而不是：

- `instance.useXxx()`


## 统一入口方案

### 统一规则

UI 读取只允许三类正式入口：

1. `useView(instance.view.xxx)`
2. `useKeyedView(instance.view.xxx, key)`
3. 组件本地 `useState`

其余都视为次优或临时形态。

### 应该保留的少量语义 hook

可以保留极少数语义 hook，但它们必须足够薄，并统一建立在 `view` 之上：

- `useTool()`
- `useSelectionState()`
- `useInteractionView()`

它们的职责只应是：

- 取 `instance`
- 调 `useView(instance.view.xxx)`

不再自己维护额外状态协议。

### 应该逐步移除的形态

- 业务模块自己手写 `useSyncExternalStore`
- `state.xxx.get()` 和 `view.xxx.get()` 长期并存
- UI 组件直接组合 `read + draft + selection`
- 为局部菜单/浮层引入全局 store


## `tool` 的最优形态

### 结论

- 保留名称 `tool`
- 不改成裸 `mode`
- 不继续保留 `state.tool.get()`
- 收敛为 `view.tool + commands.tool`

### 原因

`mode` 在当前代码库里已经是高度泛化词：

- interaction mode
- selection mode
- routing mode
- toolbar mode

如果改成 `instance.mode`，语义会变差。

`tool` 才准确表达：

- select
- edge
- pen
- text
- shape

### 推荐接口

- `instance.view.tool.get()`
- `instance.view.tool.subscribe(listener)`
- `instance.commands.tool.set(nextTool)`

React 侧：

- `useView(instance.view.tool)`

imperative 侧：

- `instance.view.tool.get()`


## `uiStore` 的最优定位

### 是否保留

底层 store 机制可以保留。

当前使用 Jotai vanilla store 作为 whiteboard editor runtime 的共享外部状态容器，这本身没有问题。

### 是否改名

建议长期改名为：

- `editorStore`

原因是它承载的不只是 UI chrome，而是更广义的 editor session state：

- viewport
- selection
- activeContainer
- tool

`uiStore` 这个名字会误导人把局部菜单/浮层也往里放。

### editorStore 中应该放什么

应该放：

- tool
- selection
- activeContainer
- viewport

不应该放：

- context menu
- toolbar menu
- popover
- hover panel


## 推荐收敛顺序

### 第一阶段：统一读入口

目标：

- 所有 UI 订阅读统一走 `instance.view`

动作：

- 为 `tool` 提供 `view.tool`
- 所有 React 读 `tool` 改成基于 `view.tool`
- imperative 读 `tool` 改成 `instance.view.tool.get()`
- 删除 `state.tool`

### 第二阶段：收敛 hook

目标：

- React 侧只剩少量薄 hook

动作：

- `useTool` 改成 `useView(instance.view.tool)`
- 能删掉的 `useNode/useEdge` 逐步删掉，或改成对 `view` 的薄包装
- 避免继续新增 ad hoc `useSyncExternalStore` hook

### 第三阶段：明确 `read` 与 `view` 边界

目标：

- UI 不再自己拼 resolved data

动作：

- 新的 UI 组件默认从 `view` 读
- `read` 只给 imperative 逻辑和 view 内部聚合使用

### 第四阶段：局部 UI 彻底本地化

目标：

- 避免把 chrome state 再放回 runtime

动作：

- context menu、toolbar menu、popover、hover panel 统一留在组件本地


## 最终希望形成的心智模型

写 UI 组件时，只问自己两个问题：

1. 这是可共享的编辑状态，还是局部 UI 状态？
2. 如果是可共享编辑状态，我是不是应该直接从 `view` 读？

对应答案：

- 可共享编辑状态：`view`
- 局部 UI 状态：`useState`
- 同步热路径读取：`read` / `view.get`
- 所有写入：`commands`


## 一句话总结

最优方向不是废掉 `get/subscribe + useSyncExternalStore`，也不是让 `instance` 直接暴露 hook，而是把整套 UI 读模型收敛成：

- `read` 负责同步底层读
- `view` 负责 UI 可订阅读
- `commands` 负责写
- 局部 UI state 留在组件本地

这样既保留白板需要的精确更新能力，又能最大程度减少入口数量和概念负担。
