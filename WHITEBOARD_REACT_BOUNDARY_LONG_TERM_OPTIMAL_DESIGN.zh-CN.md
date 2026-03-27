# Whiteboard React 边界长期最优重构设计

## 1. 文档目标

这份文档只回答一个问题：

**`packages/whiteboard-react` 接下来是否应该开始系统性收边界，如果要收，长期最优的方向是什么。**

本文明确：

- 不考虑兼容成本
- 不保留双轨实现
- 不为迁移期 API 设计公开概念
- 优先长期角色纯度，而不是优先少改代码
- 目标不是“把 import 变少”，而是“让每层只做自己该做的事”

本文重点覆盖两类问题：

- `react` 对 `core` 的直接使用是否过多
- `react` 包内部是否已经承载了过厚的 runtime / business logic

---

## 2. 结论

结论很明确：

**可以开始收边界，而且值得尽快做。**

但长期最优里，优先级不是：

1. 先消灭 `react -> core` 的直接 import

而是：

1. 先收 `whiteboard-react` 包内的 runtime / UI 边界
2. 再收 `react -> engine` 的运行时装配边界
3. 最后再决定哪些 `react -> core` 直接依赖需要下沉或抽象

换句话说：

**现在最大的问题不是 `react` “用了太多 core”，而是 `react` 已经不只是 React UI 包，而是长成了一层编辑器 runtime。**

这层 runtime 当前和 React 组件、feature hooks、菜单/toolbar UI、preview/session 写入、selection policy、命令编排混在一起，导致：

- 边界不清晰
- 交互问题难定位
- preview / selection / read 链路容易不一致
- UI 文件不断变厚
- 想做协同、插件、非 React host 时，复用边界很差

长期最优里，应当把当前体系收敛为：

- `@whiteboard/core`
- `@whiteboard/engine`
- `@whiteboard/editor`
- `@whiteboard/react`

其中：

- `core` = 纯领域模型与纯算法
- `engine` = 文档执行、历史、projection/read model
- `editor` = 编辑器 runtime、preview/session、interaction policy、命令 adapter
- `react` = React 宿主绑定、组件、hooks、视觉层组合

---

## 3. 当前现状的真实判断

## 3.1 `whiteboard-react` 已经不是一个纯 UI 包

当前粗略体量：

- `packages/whiteboard-react/src` 约 136 个源码文件
- 总行数约 2.1 万行
- `packages/whiteboard-core/src` 约 69 个源码文件
- 总行数约 1.26 万行

这不代表 `react` 一定有问题，但它至少说明：

**`react` 已经承载了相当多不只是“渲染”的职责。**

尤其是这些文件，已经明显超出“UI 组合层”的职责边界：

- `runtime/instance/createInstance.ts`
- `runtime/selection/policy.ts`
- `features/node/hooks/transform/session.ts`
- `features/node/drag/session.ts`
- `features/edge/hooks/useEdgeConnectInput.ts`
- `runtime/finalize.ts`
- `features/node/patch.ts`

这些模块共同构成了一层实际存在但未被正式命名的东西：

**编辑器运行时。**

---

## 3.2 当前真正过厚的不是所有 feature，而是以下两层

### A. 运行时交互层过厚

包括：

- selection press / drag / hold policy
- transform session
- node drag session
- edge reconnect / create session
- preview patch / node session / edge preview
- finalize
- frame scope
- pick runtime
- viewport runtime

这些逻辑本质上都不是 React 组件逻辑。

它们是：

- 事件驱动
- 会话驱动
- 命令驱动
- preview / commit 双态驱动
- 依赖 `engine.read + engine.commands + registry + interaction state`

这说明它们更像 `editor runtime`，而不是 `react feature`。

### B. UI view-model / menu action 层过厚

最典型的是：

- `features/selection/chrome/NodeToolbar.tsx`
- `features/selection/chrome/ContextMenu.tsx`

这些文件里混合了：

- selection summary
- schema 能力判断
- patch 编译
- 文本测量
- 菜单模型
- 布局与定位
- UI 状态
- 具体命令调用

这类文件变厚不是因为 JSX 多，而是因为：

**view-model、command building、UI rendering 没分层。**

---

## 3.3 `react -> core` 直接依赖本身并不是第一问题

当前 `whiteboard-react` 直接使用 `core`，可以分成两类。

### 第一类：合理依赖

这类依赖即使长期存在，也不是大问题：

- 类型依赖：`Node`、`Rect`、`Viewport`、`Document`
- 纯几何：`panViewport`、`zoomViewport`、`isPointInRect`
- 纯算法：`getNodeAnchorPoint`、`resolveAnchorFromPoint`
- 纯 schema helper：字段 path 读取、shape kind 解析
- 纯 layout / draw / outline helper

这些依赖本质上是：

**上层消费下层纯能力。**

这是健康的。

### 第二类：边界泄漏

这类才是真正需要收的：

- UI 直接编译 `NodeUpdateInput`
- feature hook 直接编排 preview -> commit 的完整交互链
- selection 规则直接揉在 React runtime 里
- finalize 负责 engine commit 之后的 UI 状态收缩
- command adapter 同时依赖 schema、selection、frame、history、tool

所以这次重构的目标不应该是：

`react` 以后完全不能 import `core`

而应该是：

**`react` 不再直接承载 editor runtime 和写语义编译。**

---

## 4. 当前最主要的结构性问题

## 4.1 `createInstance` 是未被命名的“超级装配器”

`runtime/instance/createInstance.ts` 当前同时负责：

- store 初始化
- runtime read 组装
- interaction / snap / pick / viewport 初始化
- session preview runtime 初始化
- command adapter
- history 同步
- commit finalize
- configure / dispose

这说明当前系统里真正的中心不再是 React component，而是这个装配器。

问题不在于它“大”，而在于：

**它把 editor runtime 的所有横切职责都集中在一个 React 包内的单文件入口里。**

长期最优里，这层应当升格为独立 package 的核心入口，而不是继续留在 `react` 内。

---

## 4.2 selection policy 是 runtime 规则，不是 React 逻辑

`runtime/selection/policy.ts` 当前做的不是“选择框显示逻辑”，而是：

- pointer pick 语义解释
- tap / drag / hold intent 规划
- group ancestor 选择规则
- selection box 的交互规则
- 当前 selection 与命中目标的关系裁决

这已经是一层明确的交互策略系统。

这类代码继续放在 `react` 包内部没有立即错误，但长期会产生两个问题：

1. 每次交互修 bug 都要同时理解 React 层和 runtime 层
2. 非 React host 无法复用这套策略

长期最优里，这应收敛到 `editor` 包，React 只负责把 DOM pointer event 翻译成输入。

---

## 4.3 transform / drag / edge connect 已经形成独立的 session runtime

以下模块本质类似：

- `features/node/hooks/transform/session.ts`
- `features/node/drag/session.ts`
- `features/edge/hooks/useEdgeConnectInput.ts`
- `features/selection/gesture.ts`
- `features/selection/Marquee.tsx`

它们共同特点：

- 都有 active session
- 都会写 preview/session state
- 都依赖 interaction coordinator
- 都会在结束时 commit 到 engine commands
- 都不是 JSX 组件

所以问题不是它们“在 hooks 目录里”不美观，而是：

**这些本来就是 editor runtime 的一部分。**

长期最优里，这些应当统一进入：

- `packages/whiteboard-editor/src/interactions/*`
- 或 `packages/whiteboard-editor/src/runtime/*`

而不是继续混在 feature hook 目录里。

---

## 4.4 UI 直接编译写语义，导致写入口边界不清晰

`features/node/patch.ts` 当前负责：

- schema field -> `NodeUpdateInput`
- data/style patch -> record update
- style removal patch

然后被 toolbar / context menu / node registry chrome / 各类 feature UI 直接消费。

这意味着：

- UI 组件知道 schema path 细节
- UI 组件知道 `NodeUpdateInput` 结构
- UI 组件自己决定 unset / set / merge 的表达

这会导致：

- 写语义散落在各 UI feature
- 后续 `node.update` 再演进时，受影响面很大
- 业务写入与展示层强耦合

长期最优里：

- UI 层只发“意图”
- command adapter / mutation compiler 统一编译成 `engine.commands.node.update(...)`

---

## 4.5 toolbar / context menu 不是单纯“文件太大”，而是边界混层

`NodeToolbar.tsx` 和 `ContextMenu.tsx` 的问题不是行数本身，而是同时承载：

- selection summary
- schema 能力推导
- menu model
- command binding
- patch 编译
- 位置计算
- 文本测量 / 特殊节点 UI 规则
- React state
- 浮层渲染

这类模块最容易把系统变成“任何改动都只能继续往里堆”。

长期最优里应拆成三层：

1. selection view-model / menu model
2. command adapter / action binding
3. 纯 React render

---

## 4.6 `react` 包里已经存在一层“伪 editor platform”

现在 `whiteboard-react` 内部实际已经有：

- state stores
- interaction coordinator
- pick runtime
- viewport runtime
- read adapter
- finalize
- command adapter
- preview/session runtime

但它没有被正式定义为一个独立层。

结果是：

- 它既不纯 UI
- 也不纯 engine
- 又不纯 core

于是每次要收边界时，都会陷入一种错误选择：

- 要么把东西硬塞回 `core/engine`
- 要么继续留在 `react`

长期最优应该承认这层存在，并把它正式命名出来。

---

## 5. 长期最优的目标分层

## 5.1 `@whiteboard/core`

只负责：

- 文档模型
- operation / update / reducer 输入输出
- 纯几何算法
- 纯 layout / outline / hit-test / draw / shape / text 领域计算
- 纯 selection / move / transform / route / mindmap 算法
- schema 定义与纯 schema 编译

不负责：

- preview/session store
- pointer session
- selection press / hold / drag plan 的宿主编排
- DOM 测量
- React render
- engine 的订阅缓存与 read projection runtime

一句话：

**core = 纯同步领域核。**

---

## 5.2 `@whiteboard/engine`

只负责：

- 文档实例
- commands / history / applyOperations
- committed read model
- projection / indexes / query
- read store / derived store / staged store
- 与 preview 无关的 runtime cache

不负责：

- DOM
- React
- preview/session
- selection UI policy
- toolbar/context menu
- clipboard

一句话：

**engine = committed document runtime。**

---

## 5.3 `@whiteboard/editor`

这是长期最优里新增的关键包。

它负责：

- editor instance 组装
- interaction coordinator
- pick runtime
- viewport runtime
- frame scope
- selection source / selection press policy
- preview/session state
- node drag / transform / edge connect / marquee / mindmap drag
- finalize
- 写语义 adapter
- 统一 editor-level commands

它不负责：

- React hooks
- JSX 组件
- DOM 菜单
- 浮层渲染
- 具体 node render

它可以依赖：

- `core`
- `engine`

但不依赖：

- React

一句话：

**editor = 框架无关的编辑器运行时。**

---

## 5.4 `@whiteboard/react`

长期最优里，`react` 应收敛为：

- `Whiteboard` React 容器
- DOM lifecycle binding
- hooks
- layer/component 渲染
- toolbar/context menu 的 render
- node registry 的 React render 定义
- 文本 DOM 测量实现

它可以依赖：

- `core` 的类型与少量纯 helper
- `editor` 暴露的 runtime instance / selection view / interaction command

它不应再直接承载：

- 会话状态机
- preview 写入逻辑
- selection press policy
- 通用命令 adapter
- finalize

一句话：

**react = host binding + rendering。**

---

## 6. 长期最优的目录与包结构

建议最终演进到：

```txt
packages/
  whiteboard-core/
  whiteboard-engine/
  whiteboard-editor/
  whiteboard-react/
```

其中 `whiteboard-editor` 可按以下结构组织：

```txt
packages/whiteboard-editor/src/
  instance/
    createEditor.ts
    types.ts
    commands.ts
  state/
    tool.ts
    edit.ts
    selection.ts
    frame.ts
    draw.ts
  read/
    node.ts
    edge.ts
    selection.ts
    runtimeRead.ts
  interaction/
    coordinator.ts
    press.ts
    pick.ts
    viewport.ts
    snap.ts
  sessions/
    nodeDrag.ts
    nodeTransform.ts
    edgeConnect.ts
    marquee.ts
    mindmapDrag.ts
  preview/
    nodeSession.ts
    edgePreview.ts
  finalize/
    finalizeEditorState.ts
  commands/
    selectionCommands.ts
    nodeUpdateCompiler.ts
    editorCommands.ts
```

`whiteboard-react` 最终应收敛到：

```txt
packages/whiteboard-react/src/
  Whiteboard.tsx
  canvas/
  common/hooks/
  common/components/
  features/*/components
  features/*/hooks
  chrome/
  registry/
```

这里的 hooks 应主要负责：

- 读 editor runtime
- 绑定 DOM event
- 组合 render props

而不是自己实现完整交互 session。

---

## 7. 哪些边界应该收，哪些不用急着收

## 7.1 应立即收的边界

### A. `react` 内部 runtime / UI 边界

优先级最高。

先把这些逻辑从 React feature/UI 中正式收成 editor runtime：

- selection policy
- marquee / gesture
- node drag
- node transform
- edge connect / reconnect
- preview/session
- finalize
- createInstance

### B. UI write helper 边界

把以下逻辑从 UI feature 中抽离：

- `NodeUpdateInput` 编译
- schema field -> patch 的转换
- toolbar/context menu 的动作绑定

### C. 运行时装配边界

`createInstance` 应该从 `react` 包迁出，成为 `editor` 包的核心入口。

---

## 7.2 暂时不用急着收的边界

### A. `react -> core` 的纯类型依赖

这些没有必要刻意清理。

### B. `react -> core` 的纯几何 / 纯算法消费

例如：

- viewport 数学
- anchor 计算
- edge path bounds
- shape kind / text helper

这类依赖很健康。

### C. 节点规格与展示常量

例如：

- `features/node/shape.tsx`
- `features/node/text.ts`

虽然文件很大，但它们更像“节点展示规格 + DOM 测量工具”。

它们不是现在最优先要往下沉的边界债。

---

## 8. 关键设计原则

## 8.1 不做“形式主义去 import”

如果一个 React render helper 读取：

- `Rect`
- `Point`
- `getNodeAnchorPoint`
- `isPointInRect`

这不是边界问题。

真正的边界问题是：

- 它是否在编排 editor session
- 它是否在编译写语义
- 它是否在维护 preview/commit 双态
- 它是否在承担策略决策

---

## 8.2 不把 DOM 相关能力硬塞进 `core` 或 `engine`

以下能力长期就该留在上层：

- 文本测量
- contenteditable / input 绑定
- context menu 定位
- clipboard host 适配
- ResizeObserver
- pointer capture 与浏览器事件细节

边界收缩不应以“下沉所有东西”为目标。

---

## 8.3 editor runtime 应独立于 React，但可以保留宿主接口

长期最优不是让 `editor` 直接操纵 DOM。

而是：

- `editor` 定义输入、状态、命令、session
- `react` 负责把 DOM 事件与宿主 API 翻译给 `editor`

比如：

- clipboard 可在 `react` 层保留 host adapter
- 但 paste / selection restore / 插入后选中策略可以收进 editor action 层

---

## 8.4 写语义必须统一从 UI 层后退

长期最优里，不应继续出现大量 UI 文件直接组装：

- `NodeUpdateInput`
- `updateMany`
- `schema path`
- `style patch`

而应逐步收敛为：

- `editor.commands.node.setStyle(...)`
- `editor.commands.node.setField(...)`
- `editor.commands.node.applyMenuAction(...)`

内部再统一编译到 engine command。

---

## 9. 长期目标下的具体重构方向

## 9.1 第一阶段：先把 editor runtime 正式命名出来

这是最关键的一步。

目标：

- 不改行为
- 只重组职责
- 从 `whiteboard-react` 中抽出一个 `whiteboard-editor`

优先迁出的模块：

- `runtime/instance/*`
- `runtime/read/*`
- `runtime/selection/*`
- `runtime/frame/*`
- `runtime/edit/*`
- `runtime/pick/*`
- `runtime/interaction/*`
- `runtime/viewport/*`
- `runtime/finalize.ts`
- `features/node/session/*`
- `features/node/drag/session.ts`
- `features/node/hooks/transform/session.ts`
- `features/edge/preview.ts`
- `features/edge/hooks/useEdgeConnectInput.ts`
- `features/selection/gesture.ts`
- `features/selection/Marquee.tsx`
- `features/mindmap/session/*`
- `features/mindmap/hooks/drag/useMindmapDrag.ts`

这一步完成后，`react` 包内剩余逻辑就会更接近真正的 UI 层。

---

## 9.2 第二阶段：收 UI 写语义

目标：

- UI 不再直接编译 patch
- toolbar / menu 只处理 intent 与 render

优先迁出或重组：

- `features/node/patch.ts`
- `features/node/actions.ts`
- toolbar/context menu 内直接构造 update 的逻辑
- 与 schema path 强绑定的菜单写入逻辑

长期最优形态：

- `editor` 暴露语义化 action
- `react` 菜单只绑定动作

---

## 9.3 第三阶段：瘦身 UI 超大文件

### `NodeToolbar.tsx`

拆成：

- toolbar view-model
- toolbar actions binding
- toolbar placement
- toolbar render
- text-specific action / size service

### `ContextMenu.tsx`

拆成：

- context open state
- target resolution adapter
- node menu model
- node menu action binding
- render

这一步的目标不是拆文件数，而是让：

- UI 组件只负责 render
- 业务判断留在 model
- 写语义留在 editor action

---

## 9.4 第四阶段：把 `react -> core` 依赖收敛到健康模式

完成前面三步之后，再来做这一步才有意义。

目标不是“完全禁止”，而是明确规则：

允许：

- 类型
- 纯几何
- 纯算法
- 纯展示规格辅助

不鼓励：

- 写语义编译
- editor policy
- session state machine
- preview/commit 组织

---

## 10. 最终判定标准

当重构完成后，应满足以下标准。

## 10.1 `whiteboard-react` 的组件不再直接理解 editor 内部协议

例如组件不再直接知道：

- selection press plan
- preview patch 结构
- node session 写入细节
- `NodeUpdateInput` 的 records 结构

---

## 10.2 交互 bug 修复主要落在 `editor`，不是组件层

例如：

- selection box 不跟随 preview
- group 内部点击被拦截
- edge reconnect preview 错位
- marquee / selection 与 frame scope 冲突

这些问题应主要在 editor runtime 修复，而不是在 React layer 打补丁。

---

## 10.3 `react` 包主要由三类文件构成

- render components
- host binding hooks
- node registry / presentation spec

如果未来 `react` 仍然持续增长交互策略和 preview session，说明边界并没有真正收住。

---

## 10.4 `editor` 成为非 React host 的复用点

如果未来要支持：

- 非 React host
- headless editor host
- 更轻量的嵌入式宿主

能够直接复用 `editor runtime`，而不是只能复用 `engine + core` 再重新写一套交互层。

这才说明边界真的对了。

---

## 11. 最终建议

如果只给一句话建议：

**下一步应该开始收边界，但第一优先级不是“减少 `react` 对 `core` 的直接 import”，而是正式把当前藏在 `whiteboard-react` 里的 editor runtime 抽出来。**

长期最优路线是：

1. 新增 `packages/whiteboard-editor`
2. 把 interaction / preview / selection / runtime read / instance / finalize 全部迁入
3. 把 UI 的 patch 编译和 action binding 逐步迁出组件
4. 最后再做 `react -> core` 依赖清理，只保留类型与纯算法消费

这样得到的不是“更干净的 import 图”，而是：

- 更稳定的交互层
- 更薄的 React 层
- 更明确的预览态边界
- 更好的协同与宿主扩展基础
- 更清晰的长期架构

这才是长期最优。
