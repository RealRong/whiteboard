# WHITEBOARD_EDITOR_FRAME_FINAL_DESIGN.zh-CN

## 目标

这份文档只回答 `frame` 一件事：

- `frame` 在产品语义上到底是什么
- `frame` 在 `core / engine / editor / react` 四层分别应该承担什么职责
- 当前哪些实现是模型混淆
- 长期最优应该保留什么、删除什么

本文只写最终方案。
不讨论兼容层，不讨论过渡层，不为历史实现兜底。

---

## 核心结论

`frame` 的长期最优模型非常明确：

1. `frame` 是空间容器，不是结构父节点
2. `frame` 不是 editor state，也不是 interaction mode
3. `group` 才是唯一的结构归属模型
4. `frame` 内成员关系必须由几何关系派生，不能持久化到 `owner` 体系
5. `frame` 相关能力应该收敛为查询能力，而不是 `enter / exit / scope / gate`

一句话总结：

- `group` 解决“文档结构”
- `frame` 解决“空间归属”
- `editor` 不应该再维护“当前 active frame”

---

## 当前实现为什么不对

现在仓内把 `frame` 同时当成了四种东西：

1. 空间容器
2. 结构 owner
3. 编辑模式
4. selection / edit / input 的过滤器

这四种语义分别散在：

- `packages/whiteboard-core/src/node/owner.ts`
- `packages/whiteboard-core/src/node/move.ts`
- `packages/whiteboard-core/src/document/frameScope.ts`
- `packages/whiteboard-core/src/document/frameGate.ts`
- `packages/whiteboard-editor/src/runtime/state/frame.ts`
- `packages/whiteboard-editor/src/runtime/commands/frame.ts`
- `packages/whiteboard-editor/src/runtime/read/frame.ts`
- `packages/whiteboard-editor/src/runtime/input/pointer/gate.ts`
- `packages/whiteboard-react/src/canvas/shortcut.ts`
- `packages/whiteboard-react/src/features/selection/chrome/ContextMenu.tsx`
- `packages/whiteboard-react/src/runtime/hooks/useEditor.ts`

这会带来几个根本问题。

### 1. `frame` 被错误地塞进了 owner 模型

当前 `packages/whiteboard-core/src/node/owner.ts` 和 `packages/whiteboard-core/src/node/group.ts` 里，`frame` 和 `group` 都被当成 owner。

这不符合产品语义。

`group` 是结构上的父子关系。
`frame` 不是。

用户对 `frame` 的预期是：

- 节点在 `frame` 里，只是因为几何位置在里面
- 拖动 `frame` 时，把里面的节点一起带着
- 节点移出 `frame`，自然脱离
- `frame` 可以作为导出范围

这套语义的 source of truth 是几何关系，不是 `children`。

### 2. `frame` 被做成了一套编辑模式

当前 `packages/whiteboard-editor/src/runtime/state/frame.ts`、`packages/whiteboard-editor/src/runtime/input/pointer/gate.ts`、`packages/whiteboard-editor/src/runtime/editor/finalize.ts` 实际做的是：

- 记录“当前 active frame”
- 输入时判断是否退出
- selection / edit 自动裁剪到 frame scope

这本质上不是 `frame` 节点能力，而是“frame scoped editing mode”。

但从代码使用情况看，这套模式并没有形成完整、稳定、必要的产品闭环，反而把很多链路都绑复杂了：

- 输入解析里要带 `frame`
- `pointerDown` 里要算 `frameExit`
- shortcut 要负责 `exit frame`
- context menu 要随时判断是否退出 frame
- finalize 要兜底裁剪 selection / edit

这说明底层模型不对，不是业务天然复杂。

### 3. `frame` 和 `owner` 混用，导致写 API 语义错误

现在很多写接口会传 `ownerId`，例如插入、绘制、粘贴。

但这里的 `ownerId` 实际上同时承担过两种含义：

- group 结构父节点
- frame 容器目标

这是错误的。

这两个概念不是一回事。

如果 `frame` 改为几何派生关系，那么：

- 插入到 `frame` 内，不需要写任何 `ownerId`
- 只要位置落在 `frame` 内，成员关系自然成立

因此把 `frame` 塞进 `ownerId`，本质上是在用错误的数据结构补产品语义漏洞。

### 4. `frame` 现在不是“一个模型”，而是“三套半模型”

现在同时存在：

- `frame` 作为节点类型
- `frame` 作为 owner
- `frame` 作为 active scope
- `frameAt(point)` 作为容器查询

这会持续制造命名混乱和实现重复。

长期最优必须把它收回成一套模型：

- `frame` 只是一种空间容器节点
- 其余都是围绕这个节点展开的查询或命令策略

---

## 最终产品语义

## 1. `group` 和 `frame` 必须彻底分叉

最终语义如下：

- `group`：结构容器，负责父子树、结构移动、结构复制、结构导出
- `frame`：空间容器，负责空间归属、空间拖带、空间导出范围

两者都叫“容器”，但不是同一种容器。

### `group`

- 结构关系持久化在文档里
- 有稳定的 parent/children 语义
- 是文档树的一部分

### `frame`

- 不持久化成员列表
- 成员关系由几何关系实时推导
- 是画布空间的一部分，不是文档树的一部分

### 关键结果

一个节点未来可以同时满足两件事：

- 结构上属于某个 `group`
- 空间上位于某个 `frame`

这才符合真实产品语义。

---

## 2. `frame` 成员关系必须是派生关系

最终定义：

- 一个空间节点的直属 `frame`，是“所有包含它的 frame 中最内层的那个”
- 如果没有任何 `frame` 包含它，则直属于 root canvas

这里的“包含”是几何包含，不是树包含。

建议规则：

- 使用节点的视觉边界来判断，而不是中心点
- `frame` 的直接成员关系是排他的
- 一个节点同一时刻最多只有一个直属 `frame`

这样做有几个好处：

- 插入、拖拽、粘贴都不需要写 `owner`
- 节点移入移出 `frame` 不需要额外 mutation
- 嵌套 `frame` 的语义自然成立
- 可以在查询层稳定得到“直属 frame”和“深层 descendants”

---

## 3. `frame` 可以嵌套，但语义必须清晰

长期最优应该允许：

- `frame` 包含 `frame`

但成员关系必须区分：

- 直属成员：当前 `frame` 直接包含的节点，若其中有子 `frame`，只算子 `frame` 本身
- 深层成员：直属成员再递归展开所有子 `frame` 的内容

举例：

- `frameA` 里有 `frameB`
- `frameB` 里有 `node1`

则：

- `frameA` 的直属成员包含 `frameB`
- `frameA` 的深层成员包含 `frameB` 和 `node1`
- `node1` 的直属 `frame` 是 `frameB`，不是 `frameA`

这样才能同时满足：

- 内层 `frame` 有自己的空间归属
- 外层 `frame` 拖动时可以整体带走内层 `frame` 及其内容

---

## 4. `frame` 不是 mode

最终不再存在这些概念：

- active frame
- frame scope
- frame gate
- frame enter
- frame exit
- frame scoped selection
- frame scoped edit

`frame` 不再控制编辑上下文。

selection、edit、pointer input 都应该是全局的。

如果产品以后想做“聚焦某个 frame”的 UI 体验，那也是视图层能力，例如：

- viewport 聚焦
- 面包屑
- 顶部标题栏
- 只渲染某个局部视图

这些都不应该回到 editor kernel 里变成全局交互状态。

---

## 最终数据模型

## 1. 文档层

### `group` 是唯一 owner

最终文档结构应该满足：

- 只有 `group` 拥有 `children`
- 只有 `group` 参与 owner tree
- `frame` 不再被视为 owner

这意味着：

- `packages/whiteboard-core/src/node/owner.ts` 中 owner 判定不再包含 `frame`
- `packages/whiteboard-core/src/node/group.ts` 中 `isOwnerNode` 不再包含 `frame`
- `packages/whiteboard-core/src/document/slice.ts`、`packages/whiteboard-core/src/node/duplicate.ts` 等基于 owner 的逻辑只处理 `group`

### `frame` 只是一个普通的空间节点类型

`frame` 保留：

- 位置
- 尺寸
- 样式
- 标题

`frame` 移除：

- owner 语义
- `children`
- 被 `ownerId` 写入的可能性

如果类型层未来要进一步收紧，长期最优是：

- `children` 不应该留在 `BaseNode`
- `children` 应该只属于 `GroupNode`

这能从类型层彻底阻止再次把 `frame` 当结构 owner。

---

## 2. 查询层

`frame` 的 source of truth 应该在查询层，而不是 state。

长期最优应该提供单独的 `read.frame` 领域，而不是把相关能力散在：

- `read.node.frameAt(...)`
- `editor.state.frame`
- `editor.read.frame.scope`
- `editor.commands.frame`

推荐最终收敛为：

```ts
type FrameRead = {
  list: () => readonly NodeId[]
  at: (point: Point) => NodeId | undefined
  of: (nodeId: NodeId) => NodeId | undefined
  rect: (frameId: NodeId) => Rect | undefined
  members: (
    frameId: NodeId,
    options?: { deep?: boolean }
  ) => readonly NodeId[]
  contains: (
    frameId: NodeId,
    nodeId: NodeId,
    options?: { deep?: boolean }
  ) => boolean
}
```

其中语义如下：

- `at(point)`：给定世界坐标，返回该点所在的最内层 `frame`
- `of(nodeId)`：给定节点，返回它当前直属的 `frame`
- `rect(frameId)`：返回 `frame` 几何边界
- `members(frameId)`：返回直属成员
- `members(frameId, { deep: true })`：返回深层成员
- `contains(...)`：成员判断的便捷读口

### 为什么查询层要有 `of(nodeId)`

因为很多行为真正关心的是：

- 这个节点当前在哪个 `frame` 里

而不是：

- 当前 editor 是否进入了哪个 `frame`

`of(nodeId)` 才是对的模型。

### 为什么要有 `members(..., { deep: true })`

因为 `frame` 最核心的两个消费方就是：

- 拖动 `frame`
- 导出 `frame`

这两者都需要“包含内层 `frame` 内容的完整空间闭包”，而不是只拿直属成员。

---

## 3. 纯算法层

和 `frame` 相关的纯算法应该下沉到 `whiteboard-core`，但它们必须是“纯几何 / 纯集合规则”，不能夹带 editor state。

应该保留或新增这类纯函数：

- `isNodeInsideFrame(...)`
- `resolveFrameAtPoint(...)`
- `resolveNodeFrame(...)`
- `collectFrameMembers(...)`
- `collectFrameMembersDeep(...)`

这些函数的输入应该是：

- frame 几何信息
- node 几何信息
- z-order / area / nesting 规则

而不是：

- active frame
- selection
- input router
- pointer state

也就是说：

- `frameScope.ts` 这种文件不应该存在
- `frameGate.ts` 这种文件不应该存在

因为它们不是 `frame` 的纯模型，而是旧编辑模式的副产物。

---

## editor 的最终职责

## 1. editor 不再持有 `frame state`

最终 editor kernel 里不应该再有：

- `frame: FrameState`

也不应该对外暴露：

- `editor.state.frame`
- `editor.read.frame.scope`
- `editor.commands.frame`

`frame` 不需要 state。

editor 只需要在真正用到时读取：

- `read.frame.at(point)`
- `read.frame.of(nodeId)`
- `read.frame.members(frameId, { deep: true })`

这会直接简化这些链路：

- `packages/whiteboard-editor/src/runtime/editor/kernel.ts`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`
- `packages/whiteboard-editor/src/runtime/input/pointer/index.ts`
- `packages/whiteboard-editor/src/runtime/input/router.ts`
- `packages/whiteboard-editor/src/runtime/editor/finalize.ts`

---

## 2. input 不再处理 `frame gate`

最终 pointer input 只负责：

- point
- pick
- modifiers
- tool
- samples

不再负责：

- `frame`
- `frameExit`

最终应该删除：

- `packages/whiteboard-editor/src/runtime/input/pointer/gate.ts`
- `resolvePointerFrameGate(...)`
- `PointerDown.frame`
- `PointerDown.frameExit`
- `PointerMove.frame`
- `PointerUp.frame`

这件事非常关键。

因为 input 本来就不应该知道“当前是不是处在某个 frame mode 里”。

input 只应描述事实输入。

`frame` 作为空间归属，只能在 feature 需要时通过 query 主动读取。

---

## 3. feature 在需要时直接读 `read.frame`

最终 feature 处理 `frame` 的方式应该是：

- 插入时：按落点查询 `frame`
- 拖动节点时：按拖拽结果自然改变几何归属
- 拖动 `frame` 时：在手势开始时抓取 `deep members`
- 导出时：按当前 `frame members` 生成导出集合

而不是：

- 从 input 里拿 `frame scope`
- 从 editor state 里拿 active frame
- 结束时判断要不要 `frame.exit()`

### 插入

长期最优：

```ts
editor.commands.insert.sticky({
  at: point
})
```

不需要：

```ts
ownerId
frameId
currentFrameId
```

因为落点决定一切。

### 绘制

draw stroke 最终也不需要写入 `frame owner`。
stroke 的空间归属由生成后的几何结果自然决定。

### 移动普通节点

普通节点拖进 `frame`，不需要：

- `setOwner(frameId)`

普通节点拖出 `frame`，也不需要：

- `clearOwner()`

只要位置变了，`read.frame.of(nodeId)` 的结果就会变。

### 拖动 `frame`

拖动 `frame` 时的正确方式不是 owner tree，而是：

1. 手势开始时读取 `read.frame.members(frameId, { deep: true })`
2. 形成这次手势的固定 move set
3. `frame` 本身和其 deep members 一起按同一 delta 运动
4. 手势结束后不写任何 frame membership mutation

这里的 snapshot 是交互局部状态，不是 editor 全局 state。

---

## 4. `ownerId` 必须退出 `frame` 语义

一旦 `frame` 不再是 owner，现有很多 API 都会自然变简单。

当前很多地方之所以有 `ownerId`，本质上是在为 `frame` 的错误建模买单。

最终应该遵守两条规则：

1. `frame` 相关链路不再出现 `ownerId`
2. 如果还存在结构父节点参数，它只表示 `group`

长期最优甚至应该进一步改名：

- 不再叫 `ownerId`
- 直接叫 `groupId` 或 `parentId`

因为在最终模型里，唯一稳定的结构 parent 就是 `group`。

---

## React 的最终职责

## 1. React 只渲染 `frame`，不维护 `frame mode`

React 层应保留：

- frame 外观
- frame header
- frame shell hit 区域
- frame selection chrome

React 层应删除：

- `useFrameScope`
- active frame overlay
- Escape 退出 frame
- 右键菜单里的“先判断要不要 exit frame”

最终应该删除或改造：

- `packages/whiteboard-react/src/runtime/hooks/useEditor.ts` 里的 `useFrameScope`
- `packages/whiteboard-react/src/canvas/shortcut.ts` 中与 `frame.exit()` 相关逻辑
- `packages/whiteboard-react/src/features/selection/chrome/ContextMenu.tsx` 中 `maybeExitFrame(...)`
- 任何基于 `editor.read.frame.scope` 的 UI 分支

---

## 2. 菜单和快捷键都不应该感知 active frame

长期最优里不存在 active frame，所以：

- context menu 不需要“退出 frame 后再决定菜单内容”
- Escape 不需要承担 `frame.exit()`
- selection clear 只负责 clear selection

如果右键点在某个世界坐标，要决定“在这个位置插入什么”，就直接用那个点做查询。

例如：

- 粘贴到鼠标点
- 在该点插入便签
- 在该点创建文本

这类逻辑只需要：

- point
- `read.frame.at(point)` 或干脆只靠最终几何位置

不需要先切换一个 editor frame state。

---

## frame 行为的最终规则

## 1. 选中 `frame`

选中 `frame` 只表示：

- 当前选中了这个容器节点本身

它不自动意味着：

- editor 进入该 frame
- selection 被限制在该 frame

如果产品希望“选中 frame 后某些操作默认作用于其内容”，那也应该是命令语义，不是 editor mode。

例如：

- `exportFrame(frameId)` 可以导出 `frame + deep members`
- `moveFrame(frameId)` 可以移动 `frame + deep members`

但这些都不需要先 `enter(frameId)`。

---

## 2. 拖动 `frame`

拖动 `frame` 时应把它看作一个空间 bundle。

这个 bundle 由两部分组成：

- `frame` 节点自身
- `read.frame.members(frameId, { deep: true })`

这套 bundle 只在本次交互 session 内存在。

它不是文档结构，也不是 editor state。

---

## 3. 导出 `frame`

导出能力也应该基于同一个空间查询模型。

推荐区分两种导出语义：

- 导出 `frame shell`
- 导出 `frame contents`

如果产品定义为“导出 frame 及其内容”，则导出集合应为：

- `frameId`
- `read.frame.members(frameId, { deep: true })`

然后再把这个节点集合交给 document slice builder 去做结构闭包。

这里的重点是：

- `frame` 提供空间范围
- `group` 继续提供结构闭包

两者各司其职，不再互相冒充。

---

## 4. 结构闭包由 `group` 补，不由 `frame` 假装 owner

`frame` 导出时，如果 deep members 里有节点在结构上属于某个 `group`，那最终 slice 是否需要带上对应 `group` 祖先，应该由 slice builder 负责补结构闭包。

也就是说：

- `frame` 负责给出“空间选中集合”
- `document slice` 负责给出“结构合法集合”

这比“把 frame 直接塞进 owner tree”要干净得多，也稳定得多。

---

## 需要删除的现有概念

以下概念在最终设计里都不应该存在：

- `FrameScope`
- `ROOT_FRAME_SCOPE`
- `createFrameScope(...)`
- `isFrameScopeEqual(...)`
- `isNodeInFrameScope(...)`
- `isEdgeInFrameScope(...)`
- `resolveFrameGateDecision(...)`
- `FrameState`
- `createFrameState(...)`
- `editor.state.frame`
- `editor.read.frame.scope`
- `editor.commands.frame`
- `frame.enter()`
- `frame.exit()`
- `frame.clear()`
- `PointerDown.frame`
- `PointerDown.frameExit`
- `PointerMove.frame`
- `PointerUp.frame`
- `useFrameScope`
- `NodeDefinition.enter` 中仅为 frame mode 服务的能力位

其中最关键的是最后一条。

如果 `enter` 在整个系统里只剩 frame mode 在用，那么这个能力位本身也不应该继续存在。

---

## 需要保留并重建的能力

最终应该保留的 `frame` 能力只有三类。

## 1. 节点定义

保留：

- `frame` 作为节点类型
- frame 的标题、样式、渲染

---

## 2. 查询能力

保留并强化：

- `frame.at(point)`
- `frame.of(nodeId)`
- `frame.members(frameId, { deep })`
- `frame.contains(...)`

---

## 3. 基于查询的高阶行为

保留并重做：

- 拖动 frame 时的空间 bundle
- frame 导出
- 如有需要，frame duplicate / frame delete 的 bundle 策略

这些都是命令语义，不是 state 语义。

---

## 文件层面的最终调整

## core

应删除：

- `packages/whiteboard-core/src/document/frameScope.ts`
- `packages/whiteboard-core/src/document/frameGate.ts`

应改造：

- `packages/whiteboard-core/src/node/owner.ts`
- `packages/whiteboard-core/src/node/group.ts`
- `packages/whiteboard-core/src/node/move.ts`
- `packages/whiteboard-core/src/document/slice.ts`
- `packages/whiteboard-core/src/node/duplicate.ts`

目标是：

- owner 只剩 `group`
- frame membership 改由纯几何规则和查询层负责

## engine

应新增或重构独立的 `read.frame` 查询模块。

不要再把这类能力散在：

- `node.frameAt`
- editor 派生 store
- feature 私有扫描逻辑

## editor

应删除：

- `packages/whiteboard-editor/src/runtime/state/frame.ts`
- `packages/whiteboard-editor/src/runtime/commands/frame.ts`
- `packages/whiteboard-editor/src/runtime/read/frame.ts`
- `packages/whiteboard-editor/src/runtime/input/pointer/gate.ts`

并同步清理：

- `packages/whiteboard-editor/src/runtime/editor/kernel.ts`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`
- `packages/whiteboard-editor/src/runtime/editor/finalize.ts`
- `packages/whiteboard-editor/src/runtime/input/pointer/index.ts`
- `packages/whiteboard-editor/src/runtime/input/router.ts`
- 所有依赖 `input.frame`、`frameExit`、`editor.commands.frame` 的 feature

## react

应删除或改造：

- `packages/whiteboard-react/src/runtime/hooks/useEditor.ts` 中 `useFrameScope`
- `packages/whiteboard-react/src/canvas/shortcut.ts` 中 frame mode 逻辑
- `packages/whiteboard-react/src/features/selection/chrome/ContextMenu.tsx` 中 frame mode 逻辑
- 任何 active frame overlay

---

## 最终判断

从产品形态看，你的判断是对的：

- `frame` 里的节点只是空间上位于其中
- 拖拽 `frame` 时应整体带走
- 节点移出后自然脱离
- 导出时可以把 `frame` 当空间范围

这套模型的关键，不是“让 frame 拥有 children”，而是：

- 让几何关系成为 membership 的 source of truth

因此最终最优方案不是：

- 继续修补 `active frame / frame scope / frame gate`

也不是：

- 继续把 `frame` 塞进 owner 体系

而是：

- `group` 负责结构
- `frame` 负责空间
- `engine` 负责空间查询
- `editor` 负责基于查询组织交互
- `react` 只负责 UI 呈现和宿主交互

这才是长期最稳定、最解耦、最少噪音的 `frame` 设计。
