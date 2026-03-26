# Whiteboard Core 根模型简化设计

## 1. 文档目标

这份文档只回答一个问题：

`packages/whiteboard-core` 能否从根上继续简化。

结论是：**可以，而且空间很大**。

这次不是继续做“小收口”，而是重新定义 `core` 的长期角色：

- 更简单的数据模型
- 更简单的写入模型
- 更少的公开概念
- 更纯的同步算法边界
- 更少的跨层泄漏

本设计明确：

- 不考虑兼容成本
- 不保留双轨实现
- 目标是长期最优
- 优先减少概念数量，而不是优先减少代码行数

## 2. 当前问题总览

当前 `whiteboard-core` 的问题，不是单个文件太大，而是 **边界和角色不够纯**。

它现在同时承载了这些东西：

- 文档模型
- 写入 operation 与 reducer
- 几何算法
- 读侧 projection 类型
- 交互/选择/press 策略
- 通用 store/runtime 基建
- 一部分插件注册与 schema 机制

这会带来两个直接后果：

1. `core` 内部出现很多“看似通用，实际只服务上层某个实现”的概念。
2. 上层 `engine/react` 的需求反过来塑造了 `core` 的模型，导致 `core` 不够底层。

换句话说，当前 `core` 不是一个纯领域核，而是一个混合包。

## 3. 当前复杂度的真实来源

### 3.1 关系模型过重

当前 `Node` 同时拥有：

- `containerId`
- `groupId`

这意味着 node 的归属关系不是单链，而是两套并存关系。

这会把复杂度扩散到整条链：

- group descendants
- container descendants
- move / reowner
- group 几何同步
- slice 导出与 remap
- transform targets
- selection owner
- read tree index

这是当前 `core` 最大的结构性复杂度来源。

### 3.2 mindmap 是双轨模型

当前 mindmap 同时表现为：

- 一种 node 类型：`type === 'mindmap'`
- 一组独立 operation：`mindmap.set` / `mindmap.delete`

这意味着它既像独立实体，又像 node data。

结果是：

- reducer 里有专门的 mindmap 分支
- read impact 有专门的 mindmap 分支
- 上层写入翻译要单独处理 mindmap
- 模型语义并不统一

这不是长期最优。

### 3.3 Operation 模型承载过多职责

当前 `Operation` 同时承担：

- 前向写入语义
- `before` 快照
- undo 反演来源
- reducer enrich 结果

这会导致 reducer 同时做太多事：

- 补 before
- apply
- build inverse
- 计算 read impact

因此 `Operation` 不是纯“输入模型”，而是混杂了内部执行细节。

### 3.4 core 混入了 read projection

当前 `core/read` 导出：

- `CanvasNode`
- `NodeItem`
- `EdgeItem`
- `MindmapItem`

这些不是文档模型，而是读侧 projection。

它们本质上属于 engine 的 read model，或者属于上层的投影产物，而不是 core 的基础领域模型。

更明显的是，`core` 中部分算法已经开始反向依赖这些 projection 类型。

这说明层级关系已经变形。

### 3.5 core 混入了 runtime/store 基建

当前 `core/runtime` 导出：

- `createValueStore`
- `createKeyedStore`
- `createDerivedStore`
- `createStagedValueStore`
- `createStagedKeyedStore`

这些是通用响应式存储基建，不是白板领域模型。

它们确实被 `engine/react` 大量使用，但“被大量使用”不等于“属于 core 领域层”。

长期最优里，`core` 应该尽量只保留领域模型与纯算法。

### 3.6 core 混入了交互语义

典型例子：

- `node/selection.ts` 中的 press / tap / hold / drag plan
- `edge/connect.ts` 中的 connect session / hint / commit state
- `edge/view.ts` 中的 `can.move / can.reconnect / can.editRoute`

这些不是纯领域模型，而是 UI/runtime 的交互组织方式。

长期最优里，core 可以保留纯计算函数，但不应保留“交互状态机的形状”。

### 3.7 注册表概念偏多

当前 `CoreRegistries` 里有：

- `nodeTypes`
- `edgeTypes`
- `schemas`
- `serializers`

其中：

- `serializers` 基本没有真实消费方
- `schemas` 只是 definition 之外又生长了一层

这类概念会拉高 core 的抽象密度，但并没有对应的收益。

## 4. 长期最优的 core 角色

长期最优里，`whiteboard-core` 应该重新收敛成：

### 4.1 core 负责什么

- 文档模型
- 最小写入模型
- 纯 reducer / normalize 规则输入
- 纯几何算法
- 纯图结构算法
- node / edge / draw / shape / route 的领域级纯计算

### 4.2 core 不负责什么

- UI 交互计划
- 指针 session 状态
- 读侧 projection store
- 响应式 runtime/store
- React 视图能力判断
- engine 的缓存与订阅机制

一句话说：

**core = 纯同步领域核，不是运行时框架。**

## 5. 最终目标模型

### 5.1 最小文档模型

长期最优建议收敛到：

```ts
type Doc = {
  id: string
  background?: Background
  meta?: DocMeta
  nodes: Record<NodeId, Node>
  nodeOrder: NodeId[]
  edges: Record<EdgeId, Edge>
  edgeOrder: EdgeId[]
}

type Node = {
  id: NodeId
  type: string
  position: Point
  size?: Size
  rotation?: number
  locked?: boolean
  children?: NodeId[]
  data?: Record<string, unknown>
  style?: Record<string, unknown>
}

type Edge = {
  id: EdgeId
  type: string
  source: EdgeEnd
  target: EdgeEnd
  route?: EdgeRoute
  style?: EdgeStyle
  label?: EdgeLabel
  data?: Record<string, unknown>
}
```

核心变化有几个：

- 不再保留 `containerId + groupId`
- 不引入几何意义上的 `parentId`
- 用 owner 侧的 `children` 表达稳定成员关系
- `zIndex` 从模型中移除
- `layer` 默认从 node type 推导，尽量不作为长期主字段

### 5.2 Flat Geometry + Owner Tree

这次修正后，长期最优不再是 `parentId` 模型，而是：

- 几何扁平
- 结构成树
- owner 不是几何 parent
- children 不是局部坐标嵌套

语义如下：

- 所有 node 都保持 world position
- group/frame 不建立局部坐标系
- group/frame 通过 `children` 持有稳定成员
- owner 关系用于结构、选择、导出、批量操作
- 几何计算仍然基于平面上的独立 node
- group 的 bounds 是结构投影，不是独立写入真相

也就是说，白板里的结构关系保留，但不是 DOM/scene graph 那种 transform hierarchy。

这有几个直接好处：

- 不会把模型误导成“父节点带局部坐标”
- group/frame 拖动时，语义清晰地表达为“移动一组成员”
- resize/selection/export 都仍然有稳定结构依据
- 复杂度从“两个关系字段”收敛成“一棵 owner tree”

这样以后所有“成员关系”问题都统一为 owner tree 问题：

- descendants
- roots
- reowner
- export roots
- transform targets
- selection owner

都不再需要区分“这次是 group 关系还是 container 关系”。

### 5.3 group 与 frame 的差异只由类型定义

不再通过 `containerId + groupId` 表达两套所有权关系。

而是通过同一套 owner 关系，由 owner 的类型决定行为差异：

- `group`
  - 语义是稳定成员集合
  - 无 padding
  - 自己不维护独立几何真相
  - group bounds 由 children 的 world bounds 派生
  - 拖动 group = 平移 descendants
  - resize group = scale descendants
  - 不需要 `autoFit/manual` 模式
- `frame`
  - 语义是容器/范围
  - 有自己的 shell/title/border/body
  - 自己的 rect 是显式输入，不由 children 自动包裹
  - 拖动 frame = 平移 descendants
  - resize frame 不自动缩放 children
  - 可作为插入与组织范围

换句话说：

- “谁拥有成员”是一套统一关系
- “owner 如何行为”由节点类型决定

这比“两个字段 + 几何父子”的模型更贴近白板语义，也更简单。

### 5.3.1 为什么不需要 group autofit

长期最优里，不应该把 `group autofit` 视为一项独立功能。

更准确的定义是：

- group 的成员关系才是 source of truth
- group 的 box 只是成员关系的派生结果
- 成员一变，group bounds 自然变化
- 这不是 normalize 后补的一轮 geometry 修复
- 这就是 group 本身的定义

因此长期最优不应再存在：

- group `autoFit/manual` 模式
- 写侧持久化的 group `position/size`
- 每次成员变化后再补一次 group geometry normalize

应该改成：

- 写侧只维护 group membership
- 读侧提供 group bounds 投影与缓存
- UI 的 selection / handles / hit / transform 统一读取这个派生 bounds

如果一个实体需要：

- 固定大小
- 独立 rect
- 不跟成员自动贴合

那它应该是 `frame`，不是 `group`。

### 5.4 mindmap 作为 node subtype

长期最优建议：

- mindmap 保留为 node subtype
- mindmap tree 放到 node.data
- 不再保留 `mindmap.set` / `mindmap.delete` 作为底层 operation

命令层仍然可以保留：

- `instance.commands.mindmap.addChild(...)`
- `instance.commands.mindmap.move(...)`

但这些命令最终都只产出：

- `node.patch`

这样：

- reducer 不再知道“mindmap 是额外实体”
- read impact 不再需要单独的 mindmap 域
- 写入模型更统一

## 6. 最小写入模型

### 6.1 公开 operation 只表达前向意图

长期最优建议：

```ts
type Op =
  | { type: 'doc.patch'; patch: DocPatch }
  | { type: 'node.create'; node: Node }
  | { type: 'node.patch'; id: NodeId; patch: NodePatch }
  | { type: 'node.remove'; id: NodeId }
  | { type: 'node.order'; ids: readonly NodeId[] }
  | { type: 'edge.create'; edge: Edge }
  | { type: 'edge.patch'; id: EdgeId; patch: EdgePatch }
  | { type: 'edge.remove'; id: EdgeId }
  | { type: 'edge.order'; ids: readonly EdgeId[] }
```

这里最重要的是：

- 公开 `Op` 不带 `before`
- 不把 undo/inverse 需求塞进类型本体
- 不单独保留 mindmap op 域

### 6.2 before / inverse 只属于 reducer 内部

内部 reducer 可以自己构造：

- before snapshot
- inverse ops
- change set

但这些不应该污染公共输入模型。

这样可以让整个系统更清晰：

- 上层负责表达“我要怎么改”
- reducer 负责决定“怎么回滚”

### 6.3 返回模型统一成一套 Result

当前 `Result` 和 `DispatchResult` 是重复的。

长期最优建议统一为一套：

```ts
type Result<T, C extends string = string> =
  | { ok: true; data: T }
  | { ok: false; error: { code: C; message: string; details?: unknown } }
```

这样：

- core command builder
- reducer
- engine translate

都可以围绕同一套错误模型工作。

## 7. 包边界重画

### 7.1 建议保留在 core 的内容

- `types`
- `geometry`
- `graph` 或 `owner tree` 级基础关系算法
- `node` 的纯领域算法
- `edge` 的纯领域算法
- `draw` / `text` / `shape` 纯算法
- `schema` 的默认值与校验
- `kernel` 的纯 reducer

### 7.2 建议从 core 移出的内容

- `read`
- `runtime`
- `node/selection.ts` 中的交互 press 计划
- `edge/connect.ts` 中的 session/hint/commit 状态模型
- `edge/view.ts` 中的 UI capability 表述

### 7.3 建议新边界

#### core

- 只导出纯模型与纯算法

#### engine

- 读模型 projection
- read impact
- store/cache/index
- normalize pipeline
- write pipeline

#### react

- gesture / press / interaction
- view capability
- preview / hint / overlay

## 8. 目录层面的长期收敛方向

不是立刻按这个名字重排，但长期最优建议向下面收敛：

```txt
packages/whiteboard-core/src/
  model/
    doc.ts
    node.ts
    edge.ts
    op.ts
    result.ts
  geometry/
  graph/
    owner.ts
    order.ts
  node/
    anchors.ts
    bounds.ts
    transform.ts
    snap.ts
    draw.ts
    text.ts
    shape.ts
  edge/
    ends.ts
    route.ts
    hit.ts
  schema/
  kernel/
    reduce.ts
```

目标不是机械改目录，而是表达一个原则：

**先有最底层模型与基础设施，再有 node/edge 领域算法，最后才是 reducer。**

## 9. 哪些东西值得直接删除或下移

### 9.1 `core/read`

建议整体移出 `core`。

原因：

- 读 projection 不是文档模型
- 它依赖上层消费方式
- 它反向污染 `core` 层级

### 9.2 `core/runtime`

建议整体移出 `core`。

原因：

- 它不是白板领域模型
- 它属于通用 store 基建
- 目前主要消费方是 engine/react，不是核心文档算法

### 9.3 `serializers`

建议从 `CoreRegistries` 移除。

原因：

- 当前没有真实仓内消费者
- 这不是当前白板核心建模所需的一级概念

### 9.4 独立 `SchemaRegistry`

建议删除，schema 直接挂 definition。

从：

- `nodeTypes`
- `edgeTypes`
- `schemas`

收敛为：

- `nodeTypes`
- `edgeTypes`

其中每个 definition 自带 schema。

## 10. 哪些复杂度是正常复杂度

不是所有大文件都代表模型有问题。

下面这些复杂度大体上属于“算法本身复杂”，优先级低于根模型重构：

### 10.1 `node/outline.ts`

shape outline、anchor 投影、路径采样，本来就是图形几何问题。

### 10.2 `edge/path.ts`

step/curve/linear 的 path router，本来就是线型算法问题。

### 10.3 `node/draw.ts`

freedraw 的采样、简化、命中，属于正常算法复杂度。

这些模块可以后续继续整理，但不是当前“从根上简化 core”的第一刀。

## 11. 分阶段落地方案

### 阶段 1：Owner 结构模型

目标：

- 把 `containerId` 和 `groupId` 收敛为一套 owner tree
- 明确 group/frame 不是几何 parent，而是结构 owner

要做的事：

- 重写 `Node` 类型
- 重写所有 descendants / roots / reowner 辅助算法
- 重写 group/frame 相关命令与 normalize
- 删掉 group geometry autofit 这套写侧机制
- 把 group bounds 改成读侧派生结果
- 重写 slice 中的 owner remap
- 重写 engine tree index

阶段结果：

- 关系模型统一
- group/container 双轨彻底消失
- 几何仍然保持 flat，不引入局部坐标嵌套
- group 不再有独立几何真相

### 阶段 2：写入模型瘦身

目标：

- 把 `Operation` 收成前向写入模型

要做的事：

- 去掉 `before`
- 统一 `Result`
- reducer 内部自己补反演与 change
- mindmap 不再作为独立 operation 域

阶段结果：

- op 模型清晰
- reducer 职责清晰

### 阶段 3：清理 core 边界

目标：

- core 只剩纯领域核

要做的事：

- 移出 `core/read`
- 移出 `core/runtime`
- 移出 selection press plan
- 移出 edge connect session/hint/view capability

阶段结果：

- core 不再承担上层运行时组织职责

### 阶段 4：mindmap 收口

目标：

- mindmap 彻底收为 node subtype

要做的事：

- tree 统一放到 node.data
- 相关命令只返回 node patch
- reducer 删除 mindmap 独立分支

阶段结果：

- 文档模型和 op 模型都更统一

### 阶段 5：算法层再整理

目标：

- 让算法围绕更低层基础设施复用

要做的事：

- tree / order / bounds / hit / route 的基础设施继续抽纯
- 将 domain-specific 算法建立在统一底层之上

阶段结果：

- node / edge / draw / shape 继续收敛

## 12. 最终判断

`whiteboard-core` 现在当然可以继续简化，而且不是“还能挤一点”的程度，而是 **根模型和边界都还可以重画一次**。

长期最优的方向非常明确：

- 一个更小的文档模型
- 一个更纯的前向 op 模型
- 一套 flat geometry + owner tree 结构模型
- mindmap 收为 node subtype
- core 只保留纯领域与纯算法
- read/runtime/interaction 全部移出 core

如果后续开始落地，优先级应该始终是：

1. 先改模型
2. 再改边界
3. 最后才改文件组织

不要反过来。

因为这不是“目录整理”问题，根上是 **模型与职责问题**。
