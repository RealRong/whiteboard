# Whiteboard Instance / State Model Design

## 1. 结论

这轮梳理之后，`whiteboard-react` 的长期最优实例模型可以直接定成下面这版：

- `instance.read`
  - 只保留共享 projection store 与 query helper
- `instance.state`
  - 只保留公开的 UI/runtime 语义 store
- `instance.commands`
  - 唯一写入口
- `instance.viewport`
  - 坐标与视口能力
- `instance.config`
  - 只读配置

也就是说，最终公开实例应该是：

```ts
type WhiteboardInstance = {
  config: Readonly<WhiteboardConfig>
  read: WhiteboardRead
  state: WhiteboardState
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (options: WhiteboardRuntimeOptions) => void
  dispose: () => void
}
```

内部实例才额外持有：

- `draft`
- `interaction` coordinator
- `registry`
- `engine`

对应地，当前模型里应被收掉的东西是：

- `instance.view`
- `read.selection`
- `read.container`

原因很简单：

- `view` 不是一个单一概念，里面已经混入了别名、派生 store、重复包装三种不同东西
- `read.selection` / `read.container` 不是共享 read contract，而是 react runtime 语义
- 同一语义不应该同时在 `read`、`view`、`state` 三个 namespace 里各放一份

一句话概括：

- `projection = read`
- `runtime semantic store = state`
- `write = commands`
- `geometry / conversion = viewport`

---

## 2. 目标

这个设计的目标不是“再加一层抽象”，而是把已经存在的能力重新归位。

需要达到的结果：

- `read` 只表示跨层共享的只读 contract
- `state` 只表示公开的 UI/runtime 语义 store
- `commands` 继续作为唯一写入口
- `viewport` 继续承载 hot-path 坐标与视口能力
- internal runtime object 不再混进 public instance

明确不做：

- 不为兼容旧词汇保留长期双轨
- 不把 helper 再包一层“大对象”
- 不把内部 draft / coordinator 暴露成 public state
- 不在 `state` 里塞入函数型 helper

---

## 3. 当前问题

### 3.1 `instance.view` 职责混杂

当前 `runtime/view` 里混在一起的是三类东西：

1. 纯别名
2. 真正的 derived store
3. 重复包装

典型例子：

- `view.nodeIds = read.node.list`
- `view.edgeIds = read.edge.list`
- `view.mindmapIds = read.mindmap.list`
- `view.tool = tool store`
- `view.selection = derived selection snapshot`
- `view.container = derived container snapshot`

这里的问题不是名字抽象，而是结构已经不干净：

- 有些字段只是转手别名，没有新语义
- 有些字段确实是有价值的 derived store
- 有些字段和别处的逻辑重复

继续保留 `view`，只会让后续收敛越来越困难。

### 3.2 `read` 被混入了 react runtime 语义

`read.selection` 和 `read.container` 不是 engine 共享 projection。

它们本质上都是 react runtime 本地状态衍生出来的语义对象：

- `selection` 来源于本地 selection source store + engine projection
- `container` 来源于本地 active container source store + engine descendants/index

把这两者放进 `read`，会造成边界混乱：

- 同样叫 `read`，但有些来自 engine，有些来自 react runtime
- 外部调用方很难判断哪一层是共享 contract，哪一层是 UI 语义

### 3.3 `container` 语义被做了两遍

当前 container 相关逻辑有两套：

- `runtime/container/read.ts`
- `runtime/view/container.ts` 与 `runtime/view/index.ts`

两边都在表达：

- 当前 active container
- 当前 container 下的 node ids
- node / edge 是否属于当前 container

这会直接导致：

- 规则重复
- 依赖面重复
- 后续任何 container 逻辑变更都要改两份

### 3.4 `selection` 顶层字段过多

当前 selection 快照里把三层信息平铺到一个对象顶层：

- 原始 target
- 解析后的 items
- 操作能力

这使得 selection 值类型越来越像“大 DTO”，不利于继续演进。

---

## 4. 最终实例边界

### 4.1 Public Instance

最终公开实例建议固定为：

```ts
type WhiteboardInstance = {
  config: Readonly<BoardConfig>
  read: WhiteboardRead
  state: WhiteboardState
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (options: WhiteboardRuntimeOptions) => void
  dispose: () => void
}
```

各块职责如下。

#### `config`

只读配置。

它表示“当前白板运行配置”，不承载行为。

#### `read`

只保留共享 projection store 与 query helper。

推荐最终边界：

```ts
type WhiteboardRead = {
  node: {
    list: ReadStore<readonly NodeId[]>
    item: KeyedReadStore<NodeId, NodeItem | undefined>
  }
  edge: {
    list: ReadStore<readonly EdgeId[]>
    item: KeyedReadStore<EdgeId, EdgeItem | undefined>
  }
  mindmap: {
    list: ReadStore<readonly NodeId[]>
    item: KeyedReadStore<NodeId, MindmapItem | undefined>
  }
  tree: KeyedReadStore<NodeId, readonly NodeId[]>
  index: {
    node: {
      all: () => CanvasNode[]
      get: (nodeId: NodeId) => CanvasNode | undefined
      idsInRect: (rect: Rect) => NodeId[]
    }
    snap: {
      all: () => SnapCandidate[]
      inRect: (rect: Rect) => SnapCandidate[]
    }
    tree: {
      has: (rootId: NodeId, nodeId: NodeId) => boolean
    }
  }
}
```

这里有两个关键原则：

- `projection` 继续保留为 store primitive，不 query 化
- `index` 继续保留为 imperative helper，不承担订阅职责

#### `state`

只保留公开的 UI/runtime semantic store。

推荐最终边界：

```ts
type WhiteboardState = {
  tool: ReadStore<Tool>
  selection: ReadStore<Selection>
  container: ReadStore<Container>
  interaction: ReadStore<InteractionMode>
}
```

#### `commands`

唯一写入口，不再新增第二条写路径。

#### `viewport`

负责：

- viewport 读写
- client / screen / world 转换
- hot-path interaction 数学

不负责：

- session policy
- selection/container 语义
- draft 生命周期

### 4.2 Internal Instance

内部实例在 public instance 基础上额外持有：

```ts
type InternalWhiteboardInstance = WhiteboardInstance & {
  draft: Drafts
  interactionCoordinator: InteractionCoordinator
  registry: NodeRegistry
  engine: EngineInstance
}
```

这里的关键点不是具体字段名，而是边界：

- 外部只依赖 public instance
- react runtime internals 才依赖 internal instance

---

## 5. `read` 的最终规则

### 5.1 `projection = store`

`projection` 不应该继续 query 化。

原因：

- engine projection 本身已经在做增量缓存与精确通知
- react 消费侧已经直接依赖 `item/list` store 订阅
- 如果再把 projection query 化，只会把订阅复杂度转嫁到 UI 层

因此继续保持：

- `read.node.list`
- `read.node.item`
- `read.edge.list`
- `read.edge.item`
- `read.mindmap.list`
- `read.mindmap.item`
- `read.tree`

### 5.2 `index = helper`

`index` 只承载命令式 helper，不承载订阅。

长期最优原则：

- `all / get / inRect / has` 这类 hot-path helper 放 `index`
- 如果某个结果已经有 projection store，就不要再在 `index` 暴露同样的“可订阅列表”

对应到 `tree`，推荐长期收敛为：

- `read.tree.get(rootId)` 提供 descendants list
- `read.index.tree.has(rootId, nodeId)` 提供 membership 快判

不建议长期同时保留：

- `read.tree.get(rootId)`
- `read.index.tree.list(rootId)`

这会导致同一语义暴露两次。

### 5.3 `tree` 保持 keyed store

`tree` 不建议硬并入 `item/list` 体系。

因为 `tree` 的语义不是“实体集合 + 实体项”，而是：

- 输入 `rootId`
- 输出 descendants ids

它天然就是一个 keyed projection。

因此结构上保留：

```ts
type TreeRead = KeyedReadStore<NodeId, readonly NodeId[]>
```

比改成 `read.tree.item` 更自然。

---

## 6. `state` 的最终公开面

### 6.1 只公开 4 个 store

最终公开的 `state` 只建议有 4 项：

- `tool`
- `selection`
- `container`
- `interaction`

这是“有公共语义的 runtime store”的最小集合。

### 6.2 不公开的 runtime object

下面这些都不应进入 public `state`：

- `draft`
- interaction coordinator 本体
- `registry`
- `engine`

原因：

- 这些不是稳定公共语义
- 它们是实现层对象
- 后续重构拖拽 / 预览 / 插件边界时需要保持自由度

### 6.3 `read.selection` / `read.container` 不再保留

如果 `state.selection` 与 `state.container` 成为统一语义 store，那么：

- `read.selection` 应删除
- `read.container` 应删除

原因：

- 它们不是共享 read contract
- 命令式代码可以直接 `instance.state.selection.get()`
- 没必要额外包一层函数式 facade

---

## 7. 命名规则

### 7.1 总规则

不要为了机械统一，把所有值类型都叫 `*State`。

推荐规则：

- namespace 用 `state`
- store 容器类型用 `*Store`
- store 值类型默认直接用领域名
- `State` 只留给内部运行态 / 会话态 / 算法态

### 7.2 推荐命名矩阵

| 角色 | 推荐名 |
| --- | --- |
| 工具值类型 | `Tool` |
| 工具字段 | `state.tool` |
| 选择值类型 | `Selection` |
| 选择字段 | `state.selection` |
| 容器值类型 | `Container` |
| 容器字段 | `state.container` |
| 交互值类型 | `InteractionMode` |
| 交互字段 | `state.interaction` |

### 7.3 为什么不推荐 `SelectionState / ContainerState`

如果已经有：

- `instance.state.selection`
- `instance.state.container`

那么值类型再叫：

- `SelectionState`
- `ContainerState`

会变成“state 里的 state”，语义重复。

更自然的是：

- `Selection`
- `Container`

### 7.4 什么时候才保留 `State`

`State` 更适合这些场景：

- reducer 内部状态
- pointer session 内部活动状态
- 算法步骤中的中间状态
- 不作为公共领域对象暴露的结构

例如：

- `PanState`
- `ResizeDragState`
- `RotateDragState`
- `HistoryState`

这类命名是自然的。

---

## 8. `Selection` 的最终 shape

### 8.1 设计原则

`Selection` 不应再把所有字段平铺在顶层。

更稳定的做法是拆成四块：

- `kind`
- `target`
- `items`
- `box`
- `caps`

### 8.2 推荐 shape

```ts
type Selection = {
  kind: 'none' | 'node' | 'nodes' | 'edge'
  target: {
    nodeIds: readonly NodeId[]
    nodeSet: ReadonlySet<NodeId>
    edgeId?: EdgeId
  }
  items: {
    nodes: readonly Node[]
    primary?: Node
    count: number
  }
  box?: Rect
  caps: {
    delete: boolean
    duplicate: boolean
    group: boolean
    ungroup: boolean
    lock: boolean
    unlock: boolean
    selectAll: boolean
    clear: boolean
    lockLabel: string
  }
}
```

### 8.3 各块职责

#### `kind`

表达当前 selection 语义分类：

- `none`
- `node`
- `nodes`
- `edge`

#### `target`

表达原始选中目标。

保留：

- `nodeIds`
- `nodeSet`
- `edgeId`

这是 selection 最基础、最稳定的事实源。

#### `items`

表达解析后的实体项结果。

保留：

- `nodes`
- `primary`
- `count`

这里的 `primary` 比 `primaryNode` 更短，也足够清晰。

#### `box`

表达当前 selection 的包围盒。

使用 `box` 比使用泛化的 `rect` 更贴近 selection 语义。

#### `caps`

表达所有基于 selection 计算出来的“命令可用性”。

放进 `caps` 的原因是：

- 避免 selection 顶层继续膨胀
- 便于后续增加 capability 字段
- UI 读取时也更自然

例如：

- `selection.caps.group`
- `selection.caps.clear`
- `selection.caps.lockLabel`

### 8.4 建议移除的平铺字段

不建议继续平铺保留：

- `nodeCount`
- `hasGroup`
- `allLocked`
- `primaryNode`
- `rect`
- `canDelete`
- `canDuplicate`
- `canGroup`
- `canUngroup`
- `canLock`
- `canUnlock`
- `canSelectAll`
- `canClear`

原因：

- `nodeCount` 应进入 `items.count`
- `primaryNode` 应进入 `items.primary`
- `rect` 应改成 `box`
- `can*` / `lockLabel` 应统一进入 `caps`
- `hasGroup` / `allLocked` 更像 capability 计算中间量，不是公共主语义

---

## 9. `Container` 的最终 shape

### 9.1 设计原则

`Container` 应尽量极简，只保留结构数据，不放行为。

### 9.2 推荐 shape

```ts
type Container = {
  id?: NodeId
  ids: readonly NodeId[]
  set?: ReadonlySet<NodeId>
}
```

### 9.3 字段含义

#### `id`

当前 active container id。

如果不存在，表示当前处于顶层画布上下文。

#### `ids`

当前 active container 下的 descendants ids。

无 active container 时为稳定空数组。

#### `set`

当前 descendants 的 membership 快判集合。

无 active container 时可以省略，表示顶层不做 container 限制。

### 9.4 不应进入 `Container` 的字段

不建议放入：

- `title`
- `rect`
- `hasNode`
- `hasEdge`
- `filterNodeIds`

原因：

- `title` 是纯 UI 展示信息，应在使用点本地推导
- `rect` 是 geometry/index 结果，不是 container 自身状态
- `hasNode / hasEdge / filterNodeIds` 是 helper，不是 state

### 9.5 推荐 helper 形态

如果这些逻辑需要复用，推荐做成纯函数，而不是挂到 instance 上：

```ts
hasContainerNode(container, nodeId)
hasContainerEdge(container, edge)
filterContainerNodeIds(container, nodeIds)
```

这样能保持：

- `Container` 纯数据
- helper 纯函数
- API 面最小化

---

## 10. Hooks 对应关系

长期最优下，runtime hooks 应只是 public `state` 的薄封装：

```ts
useTool(): Tool
useSelection(): Selection
useContainer(): Container
useInteraction(): InteractionMode
```

对应来源：

- `useTool()` -> `instance.state.tool`
- `useSelection()` -> `instance.state.selection`
- `useContainer()` -> `instance.state.container`
- `useInteraction()` -> `instance.state.interaction`

这意味着：

- hooks 不再依赖 `instance.view`
- hooks 尽量不依赖 internal-only object

---

## 11. `useInstance` / `useInternalInstance` 的边界

最终应该明确一条规则：

- 默认 feature / component 使用 `useInstance()`
- 只有 runtime internals 才使用 `useInternalInstance()`

为什么这很重要：

- 如果 public instance 足够完整，大部分 UI 逻辑不需要拿 internal object
- 只有确实依赖 `draft` / coordinator / registry / engine` 的地方，才应该拿 internal instance

这会迫使 public contract 更清晰，也能防止内部实现对象持续外溢。

---

## 12. 迁移策略

### 阶段 1：建立 `state`

新增 `instance.state`，把下面四项迁入：

- `tool`
- `selection`
- `container`
- `interaction`

同时保持现有实现可编译。

### 阶段 2：迁移 hooks

把下面 hooks 改成只读 `state`：

- `useTool`
- `useSelection`
- `useContainer`
- `useInteraction`

### 阶段 3：删掉 `view` 别名层

删除：

- `view.tool`
- `view.nodeIds`
- `view.edgeIds`
- `view.mindmapIds`
- `view.selection`
- `view.container`

直接替换为：

- `state.tool`
- `read.node.list`
- `read.edge.list`
- `read.mindmap.list`
- `state.selection`
- `state.container`

### 阶段 4：删掉 `read.selection` / `read.container`

命令式代码统一改为：

- `instance.state.selection.get()`
- `instance.state.container.get()`

### 阶段 5：收紧 internal 边界

让只需要 public contract 的 feature 从 `useInternalInstance()` 回退到 `useInstance()`。

---

## 13. 最终 API 示例

### 13.1 Public Instance

```ts
type WhiteboardInstance = {
  config: Readonly<BoardConfig>
  read: {
    node: {
      list: ReadStore<readonly NodeId[]>
      item: KeyedReadStore<NodeId, NodeItem | undefined>
    }
    edge: {
      list: ReadStore<readonly EdgeId[]>
      item: KeyedReadStore<EdgeId, EdgeItem | undefined>
    }
    mindmap: {
      list: ReadStore<readonly NodeId[]>
      item: KeyedReadStore<NodeId, MindmapItem | undefined>
    }
    tree: KeyedReadStore<NodeId, readonly NodeId[]>
    index: {
      node: {
        all: () => CanvasNode[]
        get: (nodeId: NodeId) => CanvasNode | undefined
        idsInRect: (rect: Rect) => NodeId[]
      }
      snap: {
        all: () => SnapCandidate[]
        inRect: (rect: Rect) => SnapCandidate[]
      }
      tree: {
        has: (rootId: NodeId, nodeId: NodeId) => boolean
      }
    }
  }
  state: {
    tool: ReadStore<Tool>
    selection: ReadStore<Selection>
    container: ReadStore<Container>
    interaction: ReadStore<InteractionMode>
  }
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (options: WhiteboardRuntimeOptions) => void
  dispose: () => void
}
```

### 13.2 使用方式

组件：

```ts
const tool = useTool()
const selection = useSelection()
const container = useContainer()
const interaction = useInteraction()
const nodeIds = useStoreValue(instance.read.node.list)
```

命令式逻辑：

```ts
const selection = instance.state.selection.get()
const container = instance.state.container.get()
const zoom = instance.viewport.get().zoom
const node = instance.read.index.node.get(nodeId)
```

这套模型下：

- `read` 负责共享只读数据
- `state` 负责 runtime semantic snapshot
- `commands` 负责写
- `viewport` 负责几何与视口

职责边界清晰，命名也更统一。
