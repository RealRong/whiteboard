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

- `data` 是 merge 还是 replace
- `style` 是改一个 key，还是整块替换
- 想删除某个 key，如何表达
- 想更新嵌套路径，如何表达
- 想更新数组，如何表达

所以，长期最优里应当改为：

1. `node.update` 保留为唯一公开命令
2. 公开输入改成 **意图型 mutation**
3. `fields` 保持强类型
4. `data/style` 改成基于 `path` 的显式 mutation
5. reducer 直接消费 mutation，而不是先退化成整块 `data/style` replace
6. `commands.node.updateData` 删除
7. `NodeWrite.data` 删除
8. `mindmap` 相关命令只编译成普通 `node.create / node.update / node.delete`

一句话说：

**公开 API 表达“我要怎么改”，而不是表达“改完以后对象应该长什么样”。**

---

## 3. 当前问题

## 3.1 `node.update` 语义过载

当前 `NodePatch` 同时承载：

- 几何字段更新：`position / size / rotation`
- 结构字段更新：`layer / zIndex / children`
- 值字段更新：`locked / data / style`

这三类东西在 reducer、read impact、协同语义上的性质完全不同，但现在被塞进一个“自由对象 patch”里。

结果是：

- 调用方不知道哪些字段是 cheap update，哪些字段会触发更重的 invalidation
- reducer 只能靠字段名猜语义
- 无法表达细粒度嵌套修改

## 3.2 `updateData` 是重复入口，而且抽象层次不对

当前 `commands.node.updateData` 做的事情不是新的领域语义，只是：

1. 读取当前 node
2. 本地 merge `current.data`
3. 再发一个 `node.update({ data: nextData })`

也就是说它不是新的领域命令，只是一个“帮你先 merge 再整块 replace”的 helper。

这会带来两个问题：

- 公开 API 重复
- 并发语义被隐藏

## 3.3 schema 是 `scope + path`，但 update 还是整对象

当前 schema 已经明确采用：

- `scope: 'data' | 'style' | 'label'`
- `path: string`

也已经有现成的 path helper：

- `getValueByPath`
- `setValueByPath`

这说明系统的元模型已经承认：

**开放字段的长期抽象不是“整对象”，而是“作用域 + 路径”。**

那 `node.update` 继续暴露整块 `data/style` 替换，就是模型不一致。

## 3.4 当前设计对协同不友好

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

### 4.3 公开输入表达“意图”，不是“最终快照”

公开 API 不能再用“整块对象 patch”来偷渡 merge/replace 语义。

必须显式表达：

- merge
- replace
- set
- unset
- splice

### 4.4 reducer 直接处理 mutation

长期最优里，reducer 不应该依赖“先把 mutation 物化成整块 `data/style` 再 apply”。

正确方式是：

- reducer 直接 apply mutation
- reducer 直接构造 inverse mutation
- reducer 直接计算 impact

### 4.5 `mindmap` 只是 node data，不是第二套实体模型

一旦 `mindmap.set` 删除，写侧模型必须彻底承认：

- mindmap root 是一个 node
- tree 是 `node.data.mindmap`
- 不再存在第二套 reducer 分支
- 不再存在第二套 operation 语义

---

## 5. 最终公开 API

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

type NodeDataMutation =
  | { op: 'merge'; path?: string; value: Record<string, unknown> }
  | { op: 'replace'; path?: string; value?: unknown }
  | { op: 'set'; path: string; value: unknown }
  | { op: 'unset'; path: string }
  | { op: 'splice'; path: string; index: number; deleteCount: number; values?: readonly unknown[] }

type NodeStyleMutation =
  | { op: 'merge'; path?: string; value: Record<string, string | number> }
  | { op: 'replace'; path?: string; value?: unknown }
  | { op: 'set'; path: string; value: string | number }
  | { op: 'unset'; path: string }

type NodeUpdateInput = {
  fields?: NodeFieldPatch
  data?: readonly NodeDataMutation[]
  style?: readonly NodeStyleMutation[]
}
```

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

---

## 6. 最终 kernel operation 设计

长期最优里，`Operation` 对 `node` 只保留：

```ts
type Operation =
  | { type: 'node.create'; node: Node }
  | { type: 'node.update'; id: NodeId; update: NodeUpdateInput; before?: NodeUpdateInverse }
  | { type: 'node.delete'; id: NodeId; before?: Node }
  | { type: 'node.order.set'; ids: readonly NodeId[]; before?: readonly NodeId[] }
```

其中：

```ts
type NodeUpdateInverse = {
  fields?: NodeFieldPatch
  data?: readonly NodeDataMutation[]
  style?: readonly NodeStyleMutation[]
}
```

关键点：

- `before` 不再是整份 `Node`
- `before` 也不再是“整块 `data/style` 快照”
- `before` 是最小可逆 mutation

也就是说：

- 正向是 mutation
- 反向也是 mutation

这比“先拍整份 before 快照，再反推出一个粗 patch”更纯。

---

## 7. reducer 语义

## 7.1 通用规则

`node.update` 的 reducer 规则必须明确且严格：

1. `id` 与 `type` 不可变
2. `group` 节点禁止 `position / size / rotation`
3. 非 `group` 节点允许几何字段
4. `fields` 直接赋值
5. `data/style` 通过 mutation apply
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

## 7.3 `data/style` 规则

### `merge`

```ts
{ op: 'merge', path?: string, value: Record<string, unknown> }
```

语义：

- `path` 为空：对根对象 merge
- `path` 存在：对目标对象 merge

约束：

- 目标必须是 object
- 不允许对 array 做 merge

### `replace`

```ts
{ op: 'replace', path?: string, value?: unknown }
```

语义：

- `path` 为空：整块 `data/style` 替换
- `path` 存在：替换该路径下的值

### `set`

```ts
{ op: 'set', path: string, value: unknown }
```

语义：

- 对路径执行精确写入
- 缺失的中间 object 允许自动创建
- 不允许跨越非 object 容器继续下钻

### `unset`

```ts
{ op: 'unset', path: string }
```

语义：

- 删除路径对应 key
- 如果路径不存在，直接视为无效输入并失败

长期最优里，`unset` 不是 silent noop。

### `splice`

```ts
{ op: 'splice', path: string, index: number, deleteCount: number, values?: readonly unknown[] }
```

语义：

- 路径必须解析到 array
- 用于局部数组编辑
- 这是为 `mindmap.children.xxx` 这种嵌套 array 保留的最小必要能力

长期最优里，不再允许“为了改 array 的一个局部元素，却整块 replace 整个数组”成为默认写法。

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
- 所有 `data` mutation
- 所有 `style` mutation

## 8.4 mindmap view

如果目标 node 是 `type === 'mindmap'`，并且：

- 任一 `data` mutation 的 `path` 为空
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
  data: [{ op: 'set', path: 'text', value }]
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
  style: [{ op: 'set', path: 'fontSize', value }]
}
```

### 删除 style key

```ts
{
  style: [{ op: 'unset', path: 'fontSize' }]
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
  data: [
    { op: 'set', path: 'text', value: nextText }
  ]
})
```

### 样式写入

```ts
write.update({
  style: [
    { op: 'set', path: 'fill', value: nextFill }
  ]
})
```

### 删除样式

```ts
write.update({
  style: [
    { op: 'unset', path: 'fontSize' }
  ]
})
```

### 文本写入并同步尺寸

```ts
write.update({
  fields: nextSize ? { size: nextSize } : undefined,
  data: [
    { op: 'set', path: 'text', value: nextText }
  ]
})
```

### 更新脑图节点文本

```ts
commands.node.update(rootId, {
  data: [
    {
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
  data: [
    {
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
- “`patch.data = nextWholeData` 表示 merge”的隐式语义
- “`patch.style = nextWholeStyle` 表示只改一个 key”的隐式语义
- 任何独立的 `mindmap.set / mindmap.delete` operation

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
- path mutation 负责开放记录
- mindmap 只是 node.data

三者职责清晰，不再混杂。

### 13.3 reducer 更纯

reducer 不再依赖“对象快照 patch”来猜意图，而是直接执行意图型 mutation。

### 13.4 schema / UI / command 形状统一

现有 schema 已经是 `scope + path`，这个设计让写入模型终于和 schema 对齐。

### 13.5 更适合协同

不管最后接：

- Yjs
- Automerge
- 自定义同步层

这种 mutation 形状都明显优于整块 `data/style` replace。

它至少保留了这些信息：

- 改的是哪条路径
- 是 set 还是 unset
- 是 merge 还是 replace
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

## 14. 最终定稿

长期最优里，`node.update` 的最终角色应该是：

- **公开层：唯一单 node 通用写入口**
- **输入层：typed fields + path mutations**
- **kernel 层：直接消费 mutation 并生成 inverse mutation**
- **模型层：`mindmap` 只是 `node.data.mindmap`**

因此最终方案应定为：

1. 删除 `commands.node.updateData`
2. 删除 `NodeWrite.data`
3. 删除旧 `NodePatch` 作为公开输入
4. 新增 `NodeUpdateInput`
5. reducer 直接支持 `fields/data/style` mutation
6. `commands.mindmap.*` 只作为领域命令编译器存在
7. `mindmap` 不再拥有独立 operation 线

这条方案不是“迁移成本最低”的方案。

但它是：

**概念最统一、语义最清楚、长期可维护性最强的方案。**
