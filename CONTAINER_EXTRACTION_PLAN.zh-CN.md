# Container 抽象落地计划

## 目标

本文回答一个非常具体的问题：

如果要把当前 `group` 背后的能力抽成通用 `container capability`，在现有仓库里应该先改哪些模块，为什么，以及最稳的迁移顺序是什么。

本文不讨论产品语义本身，产品层结论已经在：

- [CONTAINER_CAPABILITY_DESIGN.zh-CN.md](/Users/realrong/whiteboard/CONTAINER_CAPABILITY_DESIGN.zh-CN.md)
- [GROUP_INTERNAL_SELECTION_DESIGN.zh-CN.md](/Users/realrong/whiteboard/GROUP_INTERNAL_SELECTION_DESIGN.zh-CN.md)

这里重点是代码落点。

## 先说结论

当前最应该先抽的不是 node type，也不是 UI 样式，而是下面三类能力：

1. container 关系与几何规则
2. container 作用域与命中规则
3. container 专属 schema / menu / toolbar capability

换句话说，先抽“行为基建”，再加 `frame` 节点类型。

如果顺序反过来，先加 `frame`，最后通常会出现：

- `group` 一套逻辑
- `frame` 再复制一套逻辑
- 命中、框选、drag、auto-fit、menu 都分叉

这会很快失控。

## 当前代码里已经存在的 Container 雏形

虽然现在没有显式的 `container` 层，但实际上 `group` 已经把很多 container 逻辑散在各处了。

### 1. 关系与几何

这些地方已经在处理 parent / child 和 group 边界：

- [group.ts](/Users/realrong/whiteboard/packages/whiteboard-core/src/node/group.ts)
- [group.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/write/normalize/group.ts)
- [math.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/hooks/drag/math.ts)
- [math.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/hooks/transform/math.ts)

这些文件做的事情，本质上已经不是“group UI”，而是：

- parent / child 关系
- descendants 计算
- collapsed ancestor 可见性
- container auto-fit
- container resize 影响 children
- drag 进出 group

这部分最像未来的 container kernel。

### 2. 命中与交互

这些地方已经在决定“点到哪里”“拖到哪里”“框到哪里”：

- [useSelectionBoxInteraction.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/selection/useSelectionBoxInteraction.ts)
- [useNodeInteractions.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/hooks/useNodeInteractions.ts)
- [math.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/hooks/drag/math.ts)

目前它们还不知道“container scope”这个概念，只知道：

- `parentId`
- `group`
- `hoveredGroupId`

这说明交互层已经隐式耦合到了 group。

### 3. 具体 group 语义

这些地方则是当前 `group` 这个具体 node type 的私有能力：

- [defaultNodes.tsx](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/registry/defaultNodes.tsx)
- [nodeSections.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/context-menu/nodeSections.ts)

它们处理的是：

- `collapsed`
- `autoFit`
- `padding`
- group title
- group menu item

这部分不应该被抽成通用 container kernel，而应该保留为具体 node type 的 capability 层。

## 推荐的抽象分层

我建议把未来的 container 体系拆成三层。

## 第一层：Container Kernel

这层放最底层的通用逻辑，不关心 UI 表现，不关心是不是 `group` 还是 `frame`。

建议最终放在：

- `packages/whiteboard-core/src/container/`
- `packages/whiteboard-engine/src/write/normalize/container.ts`
- `packages/whiteboard-react/src/container/interaction/`

### 它应该负责什么

- descendants / children / ancestor 关系
- container scope
- container-aware hit-test
- container-aware marquee
- container-aware drag/drop
- container resize policy 的底层几何规则

### 它不应该负责什么

- `collapsed` 文案
- group header UI
- frame title UI
- context menu 文案
- toolbar 图标

## 第二层：Container Capability

这层是“某个 node type 具有 container 能力”的配置层。

比如：

```ts
type ContainerCapability = {
  kind: 'group' | 'frame'
  resizeMode: 'manual' | 'expand-only' | 'content-fit'
  supportsCollapse: boolean
  supportsAspectRatio: boolean
  clipContent: boolean
}
```

建议这层未来跟 node registry 靠近，放在：

- `packages/whiteboard-react/src/node/registry/`
- 或单独的 `packages/whiteboard-react/src/container/capabilities/`

这层的作用是：

- 告诉 UI 和交互层，这个 node 是不是容器
- 支持哪些容器能力

## 第三层：Concrete Node Type

这层就是：

- `group`
- `frame`

它们负责：

- 默认 schema
- 默认样式
- type-specific menu
- type-specific toolbar

## 当前最应该先抽的模块

从现有代码看，最值得优先抽的模块是下面五个。

## 1. Core: `packages/whiteboard-core/src/node/group.ts`

这是第一优先级。

原因：

- 里面已经有很多并不属于“group 私有语义”的东西
- 比如：
  - `getGroupChildrenMap`
  - `getGroupDescendants`
  - `isHiddenByCollapsedGroup`
  - `expandGroupRect`
  - `normalizeGroupBounds`

其中真正明显属于 group 私有语义的，只有：

- `collapsed`
- `autoFit`
- `padding` 的一部分策略

建议拆法：

- `children/descendants/ancestor` 关系计算 -> `container/tree.ts`
- `expand rect / normalize bounds` 的几何部分 -> `container/geometry.ts`
- `collapsed` 可见性 -> 暂时保留 group，后续看 frame 是否需要折叠
- `group` 专属命名只保留在包装层

## 2. Engine: `packages/whiteboard-engine/src/write/normalize/group.ts`

这是第二优先级。

原因：

- 这里已经不是“group UI”，而是在做容器写后归一化
- 它维护的 index 本质上是：
  - `parentById`
  - `childrenByParentId`
  - `groupIds`

将来如果引入 `frame`，这里肯定不能继续只认 `groupIds`

建议演进方向：

- `groupIds` -> `containerIds`
- `isManualGroup` -> `readContainerResizeMode`
- `readGroupPadding` -> `readContainerPadding`
- 文件名最终从 `group.ts` 改到 `container.ts`

但第一步不一定马上改名，可以先抽逻辑，最后统一 rename。

## 3. React 交互: `packages/whiteboard-react/src/node/hooks/drag/math.ts`

这是第三优先级。

原因：

- 这里已经直接依赖：
  - `findSmallestGroupAtPoint`
  - `getGroupDescendants`
  - `hoveredGroupId`
  - `anchorType !== 'group'`

这说明当前 drag 规则已经被 `group` 命名绑死了。

建议演进方向：

- `hoveredGroupId` -> `hoveredContainerId`
- `findSmallestGroupAtPoint` -> `findSmallestContainerAtPoint`
- “drag into group” -> “drag into container”

这里会直接影响后续：

- frame children 归属
- container 内 drag/drop
- 从一个 container 拖到另一个 container

## 4. React 交互: `packages/whiteboard-react/src/selection/useSelectionBoxInteraction.ts`

这是第四优先级。

原因：

- 这是未来 group / frame 内部框选最关键的入口
- 如果不把这里变成 container-aware，后面“进入容器内部编辑”根本做不干净

当前问题是：

- 它只知道背景点击和全局框选
- 还没有“当前 activeContainer scope”这个概念

建议演进方向：

- 引入 `activeContainerId`
- 框选只在当前 scope 内匹配 descendants
- 背景点击在 scope 内和 scope 外要区分语义

## 5. Node registry / default node: `packages/whiteboard-react/src/node/registry/defaultNodes.tsx`

这是第五优先级。

原因：

- 这里是 `group` 具体 node type 的承载点
- 后续新增 `frame` 一定会先落这里

但它不是第一优先级，因为：

- 在 container kernel 没抽之前，直接加 `frame` 只会复制 `group` 的散乱逻辑

建议做法：

- 先保留 `group`
- 等 container kernel 和 interaction 抽完，再加 `frame`

## 当前不建议优先动的模块

有些地方虽然也会受影响，但现在不该优先改。

### `context-menu`

像：

- [nodeSections.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/context-menu/nodeSections.ts)

虽然未来要支持 frame 菜单，但现在不是抽 container 的第一步。

原因：

- 菜单只是能力暴露层
- 底层 container 行为没抽之前，菜单只是表面分叉

### `toolbar`

同理，toolbar 也不是第一优先级。

先把：

- container scope
- hit-test
- selection box
- drag/drop

做对，再谈 toolbar 更稳。

## 推荐迁移顺序

我建议按下面顺序做。

## 阶段 1：先抽 container 关系和命名

目标：

- 只做重命名和关系抽象
- 先不加 `frame`

建议改动：

- `group descendants` 相关 helper 抽到 `core/container/`
- `groupIds` 概念改成 `containerIds`
- `hoveredGroupId` 改成 `hoveredContainerId`

这一步的目标是把“语义写死 group”先拆开。

## 阶段 2：做 container scope

目标：

- 支持进入某个容器内部编辑

建议改动：

- 新增 `activeContainerId`
- 改 hit-test
- 改 selection box
- 改 node pointer selection 逻辑

这一阶段完成后，group 内部选择问题就应该能解决。

## 阶段 3：做 container resize policy

目标：

- 让不同容器可以使用不同尺寸策略

建议改动：

- `manual`
- `expand-only`
- `content-fit`

这一步先服务 group，把当前 group 的 auto-fit 从 group 特判，往 container policy 推一层。

## 阶段 4：新增 `frame`

目标：

- 在已有 container kernel 上落一个新 node type

第一版建议只做：

- fixed size
- ratio preset
- title
- background
- border
- children containment

不要一开始就做：

- export
- clip
- presentation

那些可以第二版再上。

## 阶段 5：统一菜单和 toolbar capability

最后再做：

- container common menu
- group-only menu
- frame-only menu
- toolbar capability merge

这时 UI 才有稳定的底层可以依赖。

## 最关键的命名收口

如果你准备开始动代码，我最建议先统一下面这些命名：

- `groupIds` -> `containerIds`
- `hoveredGroupId` -> `hoveredContainerId`
- `findSmallestGroupAtPoint` -> `findSmallestContainerAtPoint`
- `activeGroupId` -> `activeContainerId`
- `group normalize` -> `container normalize`

这不是表面 rename，而是给后续抽象留空间。

## 对当前仓库最现实的第一刀

如果只选一个最合适的切入点，我会选：

- [math.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/node/hooks/drag/math.ts)
- [group.ts](/Users/realrong/whiteboard/packages/whiteboard-core/src/node/group.ts)
- [group.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/write/normalize/group.ts)

这三处一起改，收益最大。

原因：

- 它们构成了当前 group 作为容器的核心闭环：
  - core 关系与几何
  - engine 归一化
  - react drag/drop

把这三处先抽出来，后面再做：

- selection scope
- frame node

就顺很多。

## 一句话结论

当前最该先抽的不是 `group` 节点本身，而是散落在 core / engine / react 里的“group 作为容器”的底层行为。  
最优的第一阶段目标是把这些逻辑改造成通用 `container` 语义，再基于这套基建去解决 group 内部编辑，并最终新增 `frame/artboard`。
