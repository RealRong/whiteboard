# Node Update 长期最优设计

## 1. 文档目标

这份文档只回答一个问题：

**`node.update` 从长期最优看，应该怎么设计。**

前提明确：

- 不考虑兼容成本
- 不保留双轨实现
- 不为迁移期设计公开概念
- 优先统一模型，而不是优先少改代码

同时，本文默认：

- `mindmap.set` 这一条独立写入链已经删除
- `mindmap` 只是 `type === 'mindmap'` 的普通 node
- tree 只存放在 `node.data.mindmap`

---

## 2. 结论

长期最优里，`node.update` 应该成为：

**唯一的、公开的、通用的“单 node 变更入口”。**

但它不应该再接收当前这种“快照式对象 patch”：

```ts
type NodePatch = {
  position?: Point
  size?: Size
  rotation?: number
  layer?: NodeLayer
  zIndex?: number
  children?: NodeId[]
  locked?: boolean
  data?: NodeData
  style?: NodeStyle
}
```

因为这种输入丢失了最重要的信息：

- 改的是 `data` 还是 `style`
- 是改整块，还是改某条路径
- 想删除某个 key，如何表达
- 想更新嵌套路径，如何表达
- 想更新数组，如何表达

所以，长期最优里应当改为：

1. `node.update` 保留为唯一公开命令
2. 公开输入改成 **意图型 mutation**
3. `fields` 保持强类型
4. `data/style` 合并成基于 `scope + path` 的统一 record mutation
5. kernel canonical mutation 只保留最小原语：`set / unset / splice`
6. reducer 直接消费 mutation，而不是先退化成整块 `data/style` replace
7. `commands.node.updateData` 删除
8. `NodeWrite.data` 删除
9. `mindmap` 相关命令只编译成普通 `node.create / node.update / node.delete`

一句话说：

**公开 API 表达“我要怎么改”，而不是表达“改完以后对象应该长什么样”。**

---

## 3. 当前代码状态与问题

这节先校正当前实现，避免把“目标设计”误写成“现状”。

## 3.1 已经完成的收敛

截至当前代码：

- kernel `Operation` 已经没有 `before`
- `reduceOperations` 的结果已经是 `Result<KernelReduceData, ResultCode>`
- inverse 已经放在 `KernelReduceData.inverse`，而不是挂在 `Operation` 上
- `mindmap.set` 已经从 kernel operation 中删除

这几件事都说明方向已经对了：

- `Operation` 正在回到纯输入模型
- undo/redo 的反向信息已经回到 reducer 产物
- `mindmap` 已经不再走独立 operation 线

## 3.2 当前 reducer 的真实语义

截至当前代码，reducer 主链路已经进入本文的目标形态：

- `node.update` 已经是 `{ id, update: NodeUpdateInput }`
- `applyOperation` 对 `node.update` 已统一走 `applyNodeUpdate`
- `buildInverse` 已生成 `{ type: 'node.update', id, update: inverseUpdate }`
- `trackReadImpact` 已直接基于 `fields / records` 分类
- `group` 节点的几何字段写入会直接失败，而不是 silent accept

当前还需要注意的，不再是“reducer 还是旧 patch 模型”，而是更细的语义打磨：

- inverse 在能精确回滚时按 path/mutation 精确生成
- 在 `set(path)` 创建了缺失祖先、无法用 `unset` 精确回滚时，会退化为对应 scope 的根级 `set`
- 这属于 canonical mutation 内部的可逆性策略，不再是回退到 `NodePatch`

## 3.3 写入口仍未统一

公开写入口已经完成第一轮统一：

- `commands.node.update(id, update: NodeUpdateInput)` 已经是唯一公开单点入口
- `commands.node.updateData` 已删除
- `NodeWrite.data` 已删除
- 主链路里的 `toNodeUpdateInput(...)` adapter 已移除

当前剩下的不是公开 API 重复，而是少量领域层 sugar / 局部 helper 是否还要继续向 `records` 进一步收敛。

## 3.4 `node.update` 语义过载

当前 `NodePatch` 同时承载：

- 几何字段更新：`position / size / rotation`
- 结构字段更新：`layer / zIndex / children`
- 值字段更新：`locked / data / style`

这三类东西在 reducer、read impact、协同语义上的性质完全不同，但现在被塞进一个“自由对象 patch”里。

结果是：

- 调用方不知道哪些字段是 cheap update，哪些字段会触发更重的 invalidation
- reducer 只能靠字段名猜语义
- 无法表达细粒度嵌套修改

## 3.5 schema 是 `scope + path`，但 update 还是整对象

当前 schema 已经明确采用：

- `scope: 'data' | 'style' | 'label'`
- `path: string`

也已经有现成的 path helper：

- `getValueByPath`
- `setValueByPath`

这说明系统的元模型已经承认：

**开放字段的长期抽象不是“整对象”，而是“作用域 + 路径”。**

那 `node.update` 继续暴露整块 `data/style` 替换，就是模型不一致。

## 3.6 `mindmap` 的剩余问题已经不是独立 operation

这点要和旧分析区分开。

当前真正剩下的问题不是：

- 还有没有 `mindmap.set`

而是：

- `mindmap` 虽然已经回到了 `node.data.mindmap`
- 但写入仍然主要依赖整块 `data` patch
- `mindmap.nodes.xxx.data.text`
- `mindmap.children.xxx`
- `mindmap.meta.xxx`

这些局部修改，依然缺少统一的 path mutation 表达。

## 3.7 当前设计对协同不友好

当前最典型的问题是：

- 改 `data.text`
- 改 `data.background`
- 改 `style.fill`
- 改 `mindmap.nodes.xxx.data.text`

这些本质上都是局部更新，但现在很容易退化成：

- `patch.data = nextWholeData`
- `patch.style = nextWholeStyle`

这会直接放大并发覆盖风险。

---

## 4. 长期最优原则

最终设计应满足以下原则：

### 4.1 单一公开入口

单 node 的通用写入只保留一个入口：

- `commands.node.update`

不再暴露：

- `commands.node.updateData`
- `NodeWrite.data`

### 4.2 typed fields 与 open records 分开

`position / size / rotation / layer / zIndex / children / locked`

这些是 node 的核心字段，必须保留强类型。

`data / style`

这些是开放记录，必须改成显式 mutation。

### 4.3 公开输入表达“目标位置 + 原子动作”，不是“最终快照”

公开 API 不能再用“整块对象 patch”来偷渡 merge/replace 语义。

长期最优里的 canonical mutation 只保留：

- `set`
- `unset`
- `splice`

其中：

- `scope` 决定目标是 `data` 还是 `style`
- `path` 决定目标路径
- `set(path omitted)` 同时承担“整块替换根对象”的语义

`merge / replace` 如果要保留，只能作为 command / UI 层的 helper sugar，不能进入 kernel 的核心 op 代数。

### 4.4 reducer 直接处理 mutation

当前 reducer 已经不再把 inverse 挂回 `Operation`，这一步应当保留。

但长期最优里，reducer 仍然不应该依赖“先把 mutation 物化成整块 `data/style` 再 apply”。

正确方式是：

- reducer 直接 apply mutation
- reducer 直接构造 inverse operation
- reducer 直接计算 impact
- inverse 作为 reduce 结果存在，而不是回挂到 `Operation.before`

### 4.5 `mindmap` 只是 node data，不是第二套实体模型

当前代码里，`mindmap.set` 删除这一步已经完成。

接下来写侧模型必须彻底承认：

- mindmap root 是一个 node
- tree 是 `node.data.mindmap`
- 不再存在第二套 reducer 分支
- 不再存在第二套 operation 语义

---

## 5. 最终公开 API

从这一节开始，下面描述的都是**目标设计**，不是当前已经实现的 API。

## 5.1 `node.update`

```ts
type NodeFieldPatch = {
  position?: Point
  size?: Size
  rotation?: number
  layer?: NodeLayer
  zIndex?: number
  children?: NodeId[]
  locked?: boolean
}

type NodeRecordScope = 'data' | 'style'

type NodeRecordMutation =
  | { scope: NodeRecordScope; op: 'set'; path?: string; value: unknown }
  | { scope: NodeRecordScope; op: 'unset'; path: string }
  | {
      scope: 'data'
      op: 'splice'
      path: string
      index: number
      deleteCount: number
      values?: readonly unknown[]
    }

type NodeUpdateInput = {
  fields?: NodeFieldPatch
  records?: readonly NodeRecordMutation[]
}
```

这里有一个刻意的取舍：

- 不再用两套重复的 TS union 去分别编码 `data` / `style`
- `scope + path` 负责表达“写到哪里”
- 值是否合法，交给 schema / normalizer / node definition 做 scope-aware 校验

公开命令：

```ts
commands.node.update(id: NodeId, update: NodeUpdateInput): CommandResult
commands.node.updateMany(
  updates: readonly { id: NodeId; update: NodeUpdateInput }[],
  options?: { origin?: WriteOrigin }
): CommandResult
```

## 5.2 路径格式

长期最优里，公开 `path` 直接采用 dot-path 字符串：

- `text`
- `title`
- `mindmap.meta.updatedAt`
- `mindmap.nodes.mnode_xxx.data.text`
- `mindmap.children.mnode_root`

原因：

- 与现有 schema `field.path` 完全一致
- UI 表单、schema、命令输入可以直接对接
- 内部如需性能优化，可在 normalize 阶段转成 path segments
- `path` 为空时，表示直接作用于 `scope` 对应的根对象

## 5.3 `NodeWrite`

React 层只保留：

```ts
type NodeWrite = {
  update: (input: NodeUpdateInput) => void
}
```

不再保留：

```ts
type NodeWrite = {
  patch(...)
  data(...)
}
```

如果 UI 侧需要易用 helper，它们只能存在于 React 层本地：

```ts
writeText('text', value)
writeStyle('fill', value)
unsetStyle('fontSize')
```

但这些 helper 不是 engine 公开 API。

## 5.4 helper sugar 的边界

长期最优里，可以保留易用 helper，但它们不是 kernel canonical op。

例如：

```ts
mergeData({ text: 'A', color: 'red' })
replaceStyle({ fill: '#000' })
```

都只应该在 command / UI 层被编译成：

```ts
[
  { scope: 'data', op: 'set', path: 'text', value: 'A' },
  { scope: 'data', op: 'set', path: 'color', value: 'red' }
]
```

或：

```ts
[
  { scope: 'style', op: 'set', value: { fill: '#000' } }
]
```

也就是说：

- helper 可以保留易用性
- kernel 只保留最小原语
- op log / history / remote sync 不应该再携带 sugar verb

---

## 6. 最终 kernel operation 设计

长期最优里，`Operation` 对 `node` 只保留纯输入结构：

```ts
type Operation =
  | { type: 'node.create'; node: Node }
  | { type: 'node.update'; id: NodeId; update: NodeUpdateInput }
  | { type: 'node.delete'; id: NodeId }
  | { type: 'node.order.set'; ids: readonly NodeId[] }
```

反向信息不应该再挂回 `Operation`。

如果需要 undo / redo，应该继续放在 reduce 结果里：

```ts
type KernelReduceData = {
  doc: Document
  changes: ChangeSet
  inverse: readonly Operation[]
  read: KernelReadImpact
}
```

关键点：

- 当前代码里 `Operation` 已经没有 `before`，这个方向是对的
- 长期最优不应该把 inverse 再塞回 `Operation`
- `Operation` 必须保持 immutable 的纯输入语义
- inverse 属于 reducer / history runtime，不属于公开 operation 载荷

也就是说：

- 正向是 mutation
- 反向是 reducer 产出的 inverse operation

对于 `node.update` 而言，长期最优下的 inverse operation 仍然应是：

```ts
{ type: 'node.update', id, update: inverseUpdate }
```

只是这个 `inverseUpdate` 应该仍然由 `fields + records` 组成，而不是当前的快照式 `NodePatch`。

---

## 7. reducer 语义

这一节描述的已经是当前 reducer 的实际主语义，也是后续继续收紧的基线。

## 7.1 通用规则

`node.update` 的 reducer 规则必须明确且严格：

1. `id` 与 `type` 不可变
2. `group` 节点禁止 `position / size / rotation`
3. 非 `group` 节点允许几何字段
4. `fields` 直接赋值
5. `records` 通过 mutation apply
6. 非法路径、非法容器类型、非法数组操作必须直接失败
7. reducer 不允许 silent noop 掩盖错误输入

## 7.2 `fields` 规则

`fields` 只负责这些固定字段：

- `position`
- `size`
- `rotation`
- `layer`
- `zIndex`
- `children`
- `locked`

它们是 typed patch，不允许 path 化。

原因：

- 这是 node 的主干结构
- 这些字段直接驱动 geometry / index / selection / ordering
- typed patch 比 path patch 更安全、更清楚

## 7.3 `records` 规则

### `set`

```ts
{ scope: 'data' | 'style', op: 'set', path?: string, value: unknown }
```

语义：

- `path` 为空：直接替换 `scope` 对应的根对象
- `path` 存在：对目标路径执行精确写入
- 缺失的中间 object 允许自动创建
- 不允许跨越非 object 容器继续下钻

### `unset`

```ts
{ scope: 'data' | 'style', op: 'unset', path: string }
```

语义：

- 删除路径对应 key
- 如果路径不存在，直接视为无效输入并失败

长期最优里，`unset` 不是 silent noop。

### `splice`

```ts
{
  scope: 'data'
  op: 'splice'
  path: string
  index: number
  deleteCount: number
  values?: readonly unknown[]
}
```

语义：

- 仅允许用于 `data`
- 路径必须解析到 array
- 用于局部数组编辑
- 这是为 `mindmap.children.xxx` 这种嵌套 array 保留的最小必要能力

长期最优里，不再允许“为了改 array 的一个局部元素，却整块替换整个数组”成为默认写法。

## 7.4 helper sugar 的 normalize 规则

如果上层还需要 `merge / replace` 这种易用 API，它们只能在进入 kernel 前被编译掉。

例如：

- `mergeData({ a: 1, b: 2 })` 编译成两条 `scope: 'data', op: 'set'`
- `replaceData(next)` 编译成一条 `scope: 'data', op: 'set', path omitted`
- `mergeStyle({ fill: '#000' })` 编译成若干条 `scope: 'style', op: 'set'`

也就是说：

- reducer 不处理 sugar verb
- inverse 也不生成 sugar verb
- remote op translation 也只面对 canonical record mutation

---

## 8. read impact 计算

当前 read impact 的三分法是正确的，长期最优应继续保留：

- geometry
- list
- value

对应规则：

## 8.1 geometry

以下字段触发 `node.geometry`：

- `fields.position`
- `fields.size`
- `fields.rotation`

并联动：

- edge geometry invalidation

## 8.2 list

以下字段触发 `node.list`：

- `fields.layer`
- `fields.zIndex`
- `fields.children`

## 8.3 value

以下触发 `node.value`：

- `fields.locked`
- 所有 `records` mutation

## 8.4 mindmap view

如果目标 node 是 `type === 'mindmap'`，并且：

- 任一 `records` mutation 满足 `scope === 'data'`
- 且 `path` 为空
- 或 `path === 'mindmap'`
- 或 `path` 以 `mindmap.` 开头

则必须标记：

- `mindmap.view = true`

这样 read projection 就仍然可以从普通 node update 正常失效，而不需要独立 `mindmap.set` 分支。

---

## 9. `mindmap` 的最终角色

## 9.1 数据位置

`mindmap` tree 只允许存在于：

```ts
node.data.mindmap
```

不允许存在：

- 独立 `mindmap.set`
- 独立 `mindmap.delete`
- reducer 内部单独 upsert mindmap root 的分支

## 9.2 create / delete

mindmap root 的创建和删除必须回归普通 node 语义：

### create

```ts
node.create({
  type: 'mindmap',
  position,
  data: {
    mindmap: tree
  }
})
```

### delete

```ts
node.delete(rootId)
```

不再允许“用 update 偷偷创建 mindmap root”。

create 必须是 `node.create`，delete 必须是 `node.delete`。

## 9.3 domain commands 的角色

长期最优里，`commands.mindmap.*` 仍然可以存在，但它们只是一组：

**领域命令编译器**

它们的职责是：

- 读取当前 tree
- 计算下一步 tree / children / node data
- 编译成普通 node mutation

例如：

- `addChild`
- `addSibling`
- `moveSubtree`
- `reorderChild`
- `setNodeData`
- `toggleCollapse`

最终只生成：

- `node.create`
- `node.update`
- `node.delete`

不再生成独立 mindmap operation。

---

## 10. schema 与表单系统

长期最优里，schema 字段更新必须天然对接 `node.update`：

```ts
field.scope + field.path -> node.update mutation
```

例如：

### data 字段

```ts
field.scope === 'data'
field.path === 'text'
```

对应：

```ts
{
  records: [{ scope: 'data', op: 'set', path: 'text', value }]
}
```

### style 字段

```ts
field.scope === 'style'
field.path === 'fontSize'
```

对应：

```ts
{
  records: [{ scope: 'style', op: 'set', path: 'fontSize', value }]
}
```

### 删除 style key

```ts
{
  records: [{ scope: 'style', op: 'unset', path: 'fontSize' }]
}
```

这意味着：

- schema
- toolbar
- inline editor
- node registry

都可以共享同一种 update 形状。

---

## 11. UI 层建议写法

### 文本写入

```ts
write.update({
  records: [
    { scope: 'data', op: 'set', path: 'text', value: nextText }
  ]
})
```

### 样式写入

```ts
write.update({
  records: [
    { scope: 'style', op: 'set', path: 'fill', value: nextFill }
  ]
})
```

### 删除样式

```ts
write.update({
  records: [
    { scope: 'style', op: 'unset', path: 'fontSize' }
  ]
})
```

### 文本写入并同步尺寸

```ts
write.update({
  fields: nextSize ? { size: nextSize } : undefined,
  records: [
    { scope: 'data', op: 'set', path: 'text', value: nextText }
  ]
})
```

### 更新脑图节点文本

```ts
commands.node.update(rootId, {
  records: [
    {
      scope: 'data',
      op: 'set',
      path: `mindmap.nodes.${mindmapNodeId}.data.text`,
      value: nextText
    }
  ]
})
```

### 脑图 children 局部编辑

```ts
commands.node.update(rootId, {
  records: [
    {
      scope: 'data',
      op: 'splice',
      path: `mindmap.children.${parentId}`,
      index,
      deleteCount,
      values
    }
  ]
})
```

---

## 12. 明确删除的概念

长期最优里，应明确删除以下公开概念：

- `commands.node.updateData`
- `NodeWrite.data`
- 公开类型中的旧 `NodePatch` 作为 update 输入
- 把 `data` / `style` 拆成两套重复 mutation 类型的公开设计
- `merge / replace` 作为 kernel canonical mutation 的公开设计
- “`patch.data = nextWholeData` 表示局部写入”的隐式语义
- “`patch.style = nextWholeStyle` 表示只改一个 key”的隐式语义
- 任何独立的 `mindmap.set / mindmap.delete` operation
- 任何把 inverse / before 回挂到 `Operation` 上的公开设计

可以保留的只有：

- 本地临时预览 patch
- reducer 内部私有 normalize 结构

但这些都不能继续占据公开 API 的核心位置。

---

## 13. 为什么这就是长期最优

这个设计的长期价值在于：

### 13.1 概念更少

公开写入只有一个单 node 入口：

- `node.update`

没有重复的 `updateData`。

### 13.2 模型更一致

- typed fields 负责主干结构
- `scope + path + op` 的 record mutation 负责开放记录
- mindmap 只是 node.data

三者职责清晰，不再混杂。

### 13.3 reducer 更纯

reducer 不再依赖“对象快照 patch”来猜意图，而是直接执行意图型 mutation，并把 inverse 放在 reduce 结果里。

### 13.4 schema / UI / command 形状统一

现有 schema 已经是 `scope + path`，这个设计让写入模型终于和 schema 对齐。

### 13.5 更适合协同

不管最后接：

- Yjs
- Automerge
- 自定义同步层

这种 mutation 形状都明显优于整块 `data/style` replace。

它至少保留了这些信息：

- 改的是 `data` 还是 `style`
- 改的是哪条路径
- 是 set 还是 unset
- 是对象更新还是数组局部编辑

### 13.6 更适合工具化

以后如果要做：

- 表单自动生成
- inspector
- 变更日志
- command replay
- remote patch translation

这种结构化 mutation 会比当前自由 patch 好得多。

---

## 14. 分阶段实施方案

这里的“分阶段”只表示**实施顺序**，不表示要长期保留兼容层。

前提仍然不变：

- 不保留双轨公开 API
- 不为兼容旧调用方设计长期桥接
- 可以接受一次性改大量调用点

唯一允许存在的过渡物只有：

- 短期内部 normalizer / adapter

它的目的只是让改造顺序更稳，不是为了长期兼容。

## 14.1 阶段 0：冻结当前基线

目标：

- 把当前状态固定下来，避免后续改造时“到底是设计问题还是回归问题”说不清

涉及模块：

- `packages/whiteboard-core/src/types/core.ts`
- `packages/whiteboard-core/src/kernel/reduce.ts`
- `packages/whiteboard-engine/src/commands/node.ts`
- `packages/whiteboard-engine/src/write/translate/node.ts`
- `packages/whiteboard-react/src/types/node/registry.ts`
- 当前使用 `commands.node.updateData` / `NodeWrite.data` 的 React 调用点

要做的事：

- 确认 `Operation.before` 已彻底消失
- 确认 `mindmap.set` 已彻底消失
- 列出所有 `updateData`、`NodeWrite.data`、`patch.data = ...` 的调用点
- 为当前关键行为补最少量基线测试

完成标准：

- 可以明确回答“当前哪些地方还在发整块 `data/style` patch”
- 至少覆盖以下基线行为：
  - 普通 node 文本更新
  - style 单字段更新
  - mindmap 节点文本更新
  - undo / redo 对 `node.update` 的当前行为

## 14.2 阶段 1：先切公开写入面

目标：

- 先把 UI / engine 对外写入面统一成 `NodeUpdateInput`
- 在最上层消灭 `updateData` 和 `NodeWrite.data`

涉及模块：

- `packages/whiteboard-core/src/types/core.ts`
- `packages/whiteboard-engine/src/types/command.ts`
- `packages/whiteboard-engine/src/commands/node.ts`
- `packages/whiteboard-react/src/types/node/registry.ts`
- `packages/whiteboard-react/src/features/**`

要做的事：

- 新增 `NodeRecordScope`、`NodeRecordMutation`、`NodeUpdateInput`
- `commands.node.update` / `updateMany` 改签名为 `NodeUpdateInput`
- 删除 `commands.node.updateData`
- `NodeWrite` 收敛为 `update(input)`
- 所有 UI 写入调用点改成发 `fields + records`

这一阶段允许的唯一过渡：

- translate 层内部暂时把 `records` 编译回旧 `NodePatch`

原因：

- 这样可以先把调用方全部切干净
- 让“公开 API 重构”和“kernel 重构”分成两个可验证阶段

完成标准：

- 全仓库不再有 `commands.node.updateData`
- 全仓库不再有 `NodeWrite.data`
- React / schema / toolbar / registry 的写入全部统一为 `fields + records`
- 即使 reducer 还没改，公开 surface 已经不再暴露旧模型

## 14.3 阶段 2：切 kernel operation 载荷

目标：

- 把 kernel / history / changeset 里的 `node.update` 从 `{ patch }` 切到 `{ update }`

涉及模块：

- `packages/whiteboard-core/src/types/core.ts`
- `packages/whiteboard-core/src/kernel/types.ts`
- `packages/whiteboard-core/src/kernel/reduce.ts`
- 所有依赖 `Operation['type'] === 'node.update'` 的辅助函数

要做的事：

- `Operation` 改为：
  - `{ type: 'node.update', id, update: NodeUpdateInput }`
- `ChangeSet.operations` 里的 `node.update` 全部切换到新载荷
- inverse 的 `node.update` 结果也切到 `{ update }`
- 删除所有对 `operation.patch` 的读取

这一阶段结束后，不应该再出现：

- `node.update.patch`
- 基于 `NodePatch` 的 `node.update` changeset

完成标准：

- op log / history / inverse / remote transport 看到的 `node.update` 全都是 `update`
- `NodePatch` 只剩下删除中的遗留类型，不能再是 `node.update` 的载荷

## 14.4 阶段 3：重写 reducer 为 canonical records（已完成）

目标：

- 把 reducer 从“快照 patch merge”彻底切成“canonical record mutation apply”

涉及模块：

- `packages/whiteboard-core/src/kernel/reduce.ts`
- 相关 path helper / normalizer

要做的事：

- 实现 `applyRecordSet`
- 实现 `applyRecordUnset`
- 实现 `applyRecordSplice`
- `fields` 与 `records` 分开 apply
- `buildInverse` 不再生成快照式 `NodePatch`
- inverse 改为生成 `fields + records`
- `trackReadImpact` 不再按 `NodePatch` 分类，而是按 `fields` / `records` 分类

这里要特别坚持：

- reducer 不接受 `merge / replace`
- reducer 不理解 sugar verb
- reducer 只处理 `set / unset / splice`

当前状态：

- reducer 内部已经不再依赖 `NodePatch` 处理 `node.update`
- `node.update` 的 inverse 已经不再依赖 `toNodeSnapshotPatch(current)`
- `read impact` 已经直接读 `fields + records`
- 主链路里的 `toNodeUpdateInput` adapter 已删除

剩余优化点：

- 继续把领域层 helper 收敛成更细粒度 `records`
- 如有必要，为 inverse 的复杂路径回滚补更明确的规则/测试

## 14.5 阶段 4：统一 schema、表单、mindmap 编译器（进行中）

目标：

- 把所有领域层写入都对齐到同一种 `records` 表达
- 让 schema / 表单 / mindmap / finalize helper 都不再依赖迁移 adapter

当前进展：

- mindmap 主链路编译已直接产出 `fields / records`
- `mindmap.update.data` 已改为 canonical data mutations，不再传 `patch` 做隐式 merge
- `createMindmapUpdateOps` 已从整块 `nextData` 根替换改为 `path: 'mindmap'` scoped record
- finalize 主链路已直接产出 `records`
- node translate 主链路已直接产出 `fields`
- node / mindmap 已复用同一套 path mutation apply 语义，避免局部更新规则漂移
- core schema 已新增 field compiler：`compileNodeFieldRecord / compileNodeFieldUpdate / compileNodeFieldUpdates`
- React 主写入口里，`toolbar + text/frame/shape inline editor` 已切到统一 field compiler

剩余重点：

- inspector / property panel
- `packages/whiteboard-engine/src/write/translate/*`
- `commands.mindmap.*`

要做的事：

- `field.scope + field.path` 直接产出 `records`
- inspector / property panel 不再手写 `records`
- 如果业务上还想保留 `mergeData` / `replaceStyle`，就在这一层编译成 canonical records
- `commands.mindmap.*` 只负责：
  - 读取当前 tree
  - 计算下一步树
  - 编译成 `node.create / node.update / node.delete`
- mindmap 的局部 children 编辑统一走 `scope: 'data', op: 'splice'`

完成标准：

- 领域层不再手写整块 `nextData`
- 除了显式根替换，没有局部编辑再走 whole-object replace
- schema、toolbar、mindmap compiler 输出同一套结构

## 14.6 阶段 5：收尾删除遗留类型与私有适配层

目标：

- 删掉所有只为过渡存在的旧结构

涉及模块：

- `NodePatch`
- `translateNodeUpdateToPatch` 一类临时 adapter
- snapshot patch inverse helper
- 所有只服务旧路径的辅助函数

要做的事：

- 删除旧 `NodePatch` 作为公开更新输入
- 删除临时 normalize 到旧 patch 的桥接
- 删除旧的 snapshot-based node.update inverse helper
- 清理类型别名、废弃注释、无用测试分支

完成标准：

- 仓库里不存在新的 `node.update -> NodePatch` 路径
- `NodePatch` 如果还存在，只能用于其他尚未重构的局部场景，不能再参与 node.update 主链路

## 14.7 阶段 6：协同层接入前的最终校验

目标：

- 在接 Yjs 之前，先把本地 op 语义彻底压实

涉及模块：

- history / replay
- remote op translation
- future sync adapter

要做的事：

- 验证 `set / unset / splice` 的可重放性
- 验证 inverse 是否稳定可逆
- 明确 `records.path` 的编码规范
- 明确 `scope + path + op` 到 Yjs 的一一映射

建议的映射原则：

- `scope: 'data', op: 'set'` -> `Y.Map` / nested map set
- `scope: 'style', op: 'set'` -> `Y.Map` set
- `op: 'unset'` -> `Y.Map.delete`
- `scope: 'data', op: 'splice'` -> `Y.Array` insert/delete

完成标准：

- 本地 operation model 已经不依赖 whole-object replace 才能表达局部修改
- Yjs adapter 不需要再猜 “这次 patch 到底是 merge 还是 replace”
- remote translation 面对的是稳定的 canonical op，而不是 UI sugar

## 14.8 推荐实施顺序总结

如果按最稳的顺序，我建议严格按下面推进：

1. 先切公开 surface
2. 再切 operation 载荷
3. 再重写 reducer
4. 再统一 schema / mindmap / toolbar 编译器
5. 最后删临时 adapter，并接协同层

原因很简单：

- 先切 surface，能最快消灭重复入口
- 再切 operation，能尽早统一 history / remote 载荷
- reducer 放在中段重写，能避免 UI 与 kernel 同时大爆炸
- mindmap / schema 放在 reducer 之后，能直接对接最终语义
- 协同永远放最后接，否则你会把旧 patch 语义一起固化进同步层

---

## 15. 最终定稿

长期最优里，`node.update` 的最终角色应该是：

- **公开层：唯一单 node 通用写入口**
- **输入层：typed fields + records**
- **kernel 层：直接消费 mutation，并把 inverse 放在 reduce 结果**
- **模型层：`mindmap` 只是 `node.data.mindmap`**

因此最终方案应定为：

1. 删除 `commands.node.updateData`
2. 删除 `NodeWrite.data`
3. 删除旧 `NodePatch` 作为公开输入
4. 新增 `NodeUpdateInput`
5. `NodeUpdateInput` 只保留 `fields + records`
6. reducer 直接支持 canonical `set / unset / splice`
7. `merge / replace` 仅作为 command / UI 层 helper sugar
8. `commands.mindmap.*` 只作为领域命令编译器存在
9. `mindmap` 不再拥有独立 operation 线

这条方案不是“迁移成本最低”的方案。

但它是：

**概念最统一、语义最清楚、长期可维护性最强的方案。**
