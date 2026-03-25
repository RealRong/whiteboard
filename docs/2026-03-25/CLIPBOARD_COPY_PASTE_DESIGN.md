# Whiteboard Copy / Paste 最优设计

## 1. 目标

这份文档定义 whiteboard 的 `copy / paste / cut / duplicate` 长期最优设计。

目标不是在现有 `duplicate` 上继续打补丁，而是一次性把整条链路收敛成稳定模型。

设计前提：

- 不考虑兼容成本
- engine 保持纯同步
- UI 概念尽量少
- API 尽量短、清晰
- 不把浏览器 clipboard 概念污染到 engine

## 2. 当前现状

当前系统只有：

- `duplicate`
- `delete`
- `group / ungroup`
- selection

没有真正的：

- `copy`
- `cut`
- `paste`
- clipboard payload
- 系统剪贴板接入

现有链路本质是：

- React shortcut / menu 触发 `duplicate`
- `duplicate` 调用 `instance.commands.node.duplicate(...)`
- engine 规划 duplicated nodes / edges
- React 再选中新副本

这条链路可以工作，但它不是 clipboard 模型。

问题在于：

- `duplicate` 和未来 `paste` 会出现两套高度相似的拓扑复制逻辑
- 浏览器 clipboard 是 host 概念，当前没有边界
- edge-only copy、container copy、selection remap 都还没有统一协议

## 3. 总体结论

长期最优方案不是新增一个 `clipboard` 大域，而是拆成两层：

### 3.1 engine / core 只处理 Slice

engine 不处理浏览器剪贴板，不依赖 `navigator.clipboard`，不处理 DOM 事件。

engine 只处理：

- 从当前文档导出一个 `Slice`
- 把一个 `Slice` 插回当前文档

### 3.2 React / host 处理真正的 clipboard

React 侧负责：

- 监听 `copy / cut / paste`
- 调用系统剪贴板
- 内存 fallback
- 选择 paste 的落点
- 根据当前编辑态决定是否让浏览器原生行为接管

一句话：

- engine 处理文档切片
- host 处理剪贴板

这是边界最干净、长期成本最低的设计。

## 4. 核心模型

## 4.1 不叫 ClipboardPayload，叫 Slice

不建议把模型命名成：

- `ClipboardPayload`
- `ClipboardState`
- `ClipboardData`

这些名字都把浏览器宿主概念带进了底层。

最合适的名字就是：

- `Slice`

因为它表达的是“文档中的一块可搬运内容”，而不是“系统剪贴板里的内容”。

## 4.2 Slice 结构

建议模型：

```ts
type Slice = {
  version: 1
  nodes: Node[]
  edges: Edge[]
}
```

各字段职责：

- `version`
  - 用于未来升级协议
- `nodes`
  - 被复制的 node 实体
- `edges`
  - 被复制的 edge 实体

`Slice` 只表达内容与拓扑，不表达 UI 状态，也不表达插入意图。

所以它不应该承载：

- `selection`
- `box`
- `anchor`

这些都属于导出结果、插入策略或 host packet，而不是 Slice 本体。

## 4.3 导出结果与插入结果

建议导出结果：

```ts
type SliceRoots = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

type SliceExportResult = {
  slice: Slice
  roots: SliceRoots
  bounds: Rect
}
```

建议插入结果：

```ts
type InsertResult = {
  roots: SliceRoots
  allNodeIds: readonly NodeId[]
  allEdgeIds: readonly EdgeId[]
}
```

职责拆分：

- `Slice`
  - 纯内容
- `SliceExportResult.roots`
  - 原始交互目标
- `SliceExportResult.bounds`
  - 导出内容的几何范围
- `InsertResult.roots`
  - remap 后应恢复的选择目标
- `InsertResult.allNodeIds / allEdgeIds`
  - 所有新建对象

## 4.4 为什么导出结果仍需返回 roots

虽然 `selection` 不该放进 `Slice`，但导出结果仍然必须返回 `roots`。

否则会出现一个问题：

- 复制 group 时，导出的 descendants 会被自动带上
- paste 后如果直接“全选 slice 里所有节点”，用户得到的 selection 会膨胀

正确行为应该是：

- 自动扩展出来的 descendants 只是复制内容
- 选中状态仍然只对应用户原本选中的 roots

所以正确做法不是把 `selection` 塞进 `Slice`，而是：

- `Slice` 只保留内容
- `roots` 由 `SliceExportResult` 与 `InsertResult` 传递

## 5. 边界设计

## 5.1 engine 不直接暴露 copy / paste

不建议新增：

- `instance.commands.clipboard.copy()`
- `instance.commands.clipboard.paste()`

原因：

- `copy` 是读，不是写，不该进 `commands`
- `paste` 不是单 node / edge 写，而是跨实体文档写
- clipboard 是宿主概念，不是 engine 概念

## 5.2 最优 API

建议 API 收敛成：

```ts
instance.read.slice.fromSelection(...)
instance.read.slice.fromNodes(...)
instance.read.slice.fromEdge(...)

instance.commands.document.insert(slice, options)
```

建议职责：

- `read.slice.*`
  - 返回 `SliceExportResult`
- `commands.document.insert(...)`
  - 接收 `Slice`
  - 返回 `InsertResult`

这样读写边界非常自然：

- 导出是 read
- 插入是 commands.document

## 5.3 为什么 paste 不放到 node / edge

`paste` 同时可能创建：

- nodes
- edges
- container 内部层级关系

它不是纯 `node` 域，也不是纯 `edge` 域。

所以应落在：

- `instance.commands.document.insert(...)`

而不是：

- `instance.commands.node.paste(...)`
- `instance.commands.edge.paste(...)`

## 6. duplicate 与 paste 的统一

## 6.1 duplicate 不应继续是一套独立模型

长期最优不该保留两套复制规划：

- 一套 `duplicate`
- 一套 `paste`

正确方向应该是：

```ts
duplicate = export result + insert(result.slice, { offset })
paste = read clipboard packet + insert(packet.slice, { at / offset })
```

也就是最终只保留一套：

- `Slice -> insert`

这样可以统一：

- id remap
- parent remap
- internal edge remap
- selection remap
- container 目标挂接

## 6.2 duplicate 的定位

`duplicate` 仍然可以保留成 public action，因为它是高频 UX 动作。

但其底层实现应退化为：

- 从当前 selection 导出 `SliceExportResult`
- 用默认 offset 插入 `result.slice`

而不是继续单独维护一条 planner。

## 7. Slice 导出规则

## 7.1 node selection

当 selection 是 nodes：

- 导出用户选中的 root nodes
- 若 root 是 group / container，则自动带上 descendants
- `SliceExportResult.roots.nodeIds` 只记录用户原始选中的 roots
- 内部边一并导出

这里“内部边”定义为：

- source / target 都落在 slice 的 node 集合内

## 7.2 container / group 语义

若一个 node 的 `parentId` 不在 slice 内：

- 导出时保留原始 `parentId` 也可以
- 但在 insert 阶段必须重新决定它是否挂入目标容器

长期最优更推荐：

- slice 内只保留内部 parent 关系
- 对 slice 外部 parent，不把它当成稳定引用

也就是说：

- parent 在 slice 内，插入后 remap
- parent 不在 slice 内，插入后按目标上下文重新挂接

## 7.3 edge-only selection

当前 selection 模型是：

- nodes
- 或 edge
- 或 none

不支持 mixed selection。

第一阶段不建议为 clipboard 重做 selection。

但 edge-only copy 仍然要支持。

此时规则应为：

- 复制单条 edge
- 若 edge 两端没有跟着 node 一起复制，则 source / target 必须在导出时落为 point end

原因：

- pasted edge 不能继续引用原文档中的 nodeId
- 否则 slice 不是自洽数据

所以 edge-only copy 的本质是：

- 生成一条 detached edge slice

## 7.4 未来 mixed selection

虽然当前第一阶段不做 mixed selection，但导出/插入结果必须提前支持：

```ts
type SliceRoots = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}
```

原因：

- 以后 selection 若支持 mixed，不必重做结果协议
- 当前即使 `edgeIds` 为空，也能保持接口稳定

## 8. Slice 插入规则

## 8.1 insert 的输入

建议：

```ts
type InsertOptions = {
  at?: Point
  offset?: Point
  parentId?: NodeId
  roots?: SliceRoots
}
```

说明：

- `at`
  - 把 insert 端计算出的 `slice bounds.center` 对齐到该点
- `offset`
  - 按平移量整体搬运 slice
- `parentId`
  - 明确指定插入目标容器
- `roots`
  - 指定这次 insert 应恢复哪些 primary targets

通常 `at` 与 `offset` 二选一即可。

其中 `roots` 不属于 `Slice`，但可以作为 insert 的附加输入传入。

这里不再保留 `anchor` 字段。

原因：

- `anchor` 与 `bounds` 语义重叠
- `anchor` 如果不严格定义，会让插入语义模糊
- 统一使用 `bounds.center` 作为 `at` 的对齐基准，概念最少

## 8.2 insert 的职责

`document.insert(slice, options)` 应负责：

- 生成新的 node ids / edge ids
- remap 内部 parentId
- remap 内部 edge source / target
- 处理 detached edge
- 处理目标容器挂接
- 返回 remap 后的新 roots ids

建议返回值：

```ts
type InsertResult = {
  roots: {
    nodeIds: readonly NodeId[]
    edgeIds: readonly EdgeId[]
  }
  allNodeIds: readonly NodeId[]
  allEdgeIds: readonly EdgeId[]
}
```

不要只返回“所有新建 node ids”，否则 React 无法无歧义恢复原始 primary targets 语义。

## 8.3 paste 后选中什么

paste 后正确行为不是：

- 选中 slice 中所有新建对象

而应该是：

- 按 `InsertResult.roots` 选中新 roots / edges

这样：

- group copy 不会错误选中所有 descendants
- edge-only paste 也能重新选中该 edge

## 9. Host Clipboard 设计

## 9.1 这是 React / host 侧能力

host 负责：

- DOM `copy`
- DOM `cut`
- DOM `paste`
- `navigator.clipboard`
- 内存 fallback

不建议把这些能力放到 engine。

## 9.2 双通道策略

最优实现不是只依赖 `navigator.clipboard`，而是双通道：

### 主通道

- `copy / cut / paste` DOM 事件里的 `clipboardData`

这是键盘快捷键场景最稳定的来源。

### fallback

- 内存 clipboard cache
- 必要时再尝试 `navigator.clipboard.readText / writeText`

原因：

- `navigator.clipboard` 是异步
- 可能有权限限制
- 菜单触发时没有 `ClipboardEvent`

所以推荐策略是：

- 键盘优先走原生事件
- 菜单触发再走 async clipboard API
- 若失败，退回内存 cache

## 9.3 不复用 whole-document serializer

core 已经有 `Serializer`，但那是 whole-document 导入导出能力。

clipboard 不是整个文档，不建议强行复用：

- `Serializer.serialize(document)`
- `Serializer.deserialize(input)`

原因：

- 语义太重
- 会混淆 whole-document IO 与 clipboard slice
- 会逼着 clipboard 适配整文档格式

正确做法是：

- clipboard 单独用 `Slice` 协议

## 9.4 clipboard packet 属于 host，不属于 Slice

如果 host 需要把更多信息一并写入系统剪贴板，例如：

- `roots`
- `bounds`
- schema version
- app 标识

这些都应该属于 host 自己的 packet，而不是 `Slice` 本体。

例如：

```ts
type ClipboardPacket = {
  type: 'whiteboard/slice'
  version: 1
  slice: Slice
  roots?: SliceRoots
  bounds?: Rect
}
```

这里：

- `slice` 是底层内容协议
- packet 是宿主传输协议

两者不应混为一谈。

## 10. UI 行为设计

## 10.1 快捷键

建议增加：

- `Mod+C`
- `Mod+X`
- `Mod+V`

保留：

- `Mod+D`

其中：

- `Mod+D` = duplicate
- `Mod+C` = copy slice to clipboard
- `Mod+X` = copy 成功后 delete
- `Mod+V` = 从 clipboard 读 slice 并 insert

## 10.2 菜单入口

建议：

- Node / Nodes / Edge context menu:
  - `Copy`
  - `Cut`
- Canvas context menu:
  - `Paste`
- `MoreMenu` 可补：
  - `Copy`
  - `Cut`

不建议：

- 在 node toolbar 主区放 `Copy / Paste`

这些是命令，不是高频图形化属性。

## 10.3 编辑态优先级

当用户正在编辑 text / sticky 文本时：

- `Mod+C / Mod+X / Mod+V` 应优先交给浏览器原生文本编辑行为

不要拦截成白板级 clipboard。

只有在 board selection 生效、且不在输入编辑态时，才进入白板 clipboard。

## 11. Paste 定位策略

## 11.1 键盘 paste

键盘 `Mod+V` 的落点建议优先级：

1. 最近 pointer world
2. viewport center
3. 若存在连续 paste，则在上一次 paste 基础上继续 screen-space 偏移

## 11.2 右键 paste

若从 canvas context menu 触发 paste：

- 直接 paste 到菜单打开时的 world point

这是最符合白板工具直觉的行为。

## 11.3 连续 paste 偏移

偏移应按 screen-space 计算，例如 24px。

不要直接写死 world delta。

原因：

- 不同 zoom 下 world delta 的视觉效果不一致
- screen-space 才符合用户感知

## 12. Cut 语义

`cut` 的定义应为：

1. 导出 `SliceExportResult`
2. 写入 clipboard
3. clipboard 成功后删除当前 selection

删除规则：

- node selection:
  - `deleteCascade`
- edge selection:
  - `edge.delete`

如果 copy/clipboard 写入失败：

- 不执行 delete

这样才能保证 cut 语义正确。

## 13. 建议文件边界

## 13.1 core / engine

建议新增或收敛到：

- `packages/whiteboard-core/src/document/slice.ts`
  - `Slice` 类型
  - `SliceRoots`
  - `SliceExportResult`
  - export / insert 纯 helper
- `packages/whiteboard-engine/src/read/slice.ts`
  - `read.slice.*`
- `packages/whiteboard-engine/src/commands/document.ts`
  - `document.insert(slice, options)`

是否叫 `document/slice.ts` 可以再微调，但核心原则不变：

- slice 属于 document domain

## 13.2 react / host

建议新增：

- `packages/whiteboard-react/src/canvas/actions/clipboard.ts`
  - `copyCurrent`
  - `cutCurrent`
  - `pasteCurrent`
- `packages/whiteboard-react/src/runtime/clipboard/*`
  - host clipboard runtime

这里是否单独建 `runtime/clipboard`，取决于后续是否会被多个入口复用。

如果复用很少，也可以先只放在：

- `canvas/actions/clipboard.ts`

原则是：

- 不提前做大系统
- 但把 host clipboard 与 engine slice 边界留清楚

## 14. 分阶段实施方案

## 第 1 阶段

先做底层统一模型：

- `Slice` 协议
- slice export
- `document.insert(slice, options)`

目标：

- duplicate 与 paste 以后能走同一条底层链路

## 第 2 阶段

让 `duplicate` 收敛到 slice insert：

- duplicate = export current result + insert result.slice with offset

目标：

- 删除 duplicate / paste 双实现

## 第 3 阶段

做 React clipboard host：

- DOM copy/cut/paste
- memory fallback
- async clipboard API fallback

目标：

- 键盘和菜单都能正常工作

## 第 4 阶段

接入 UI：

- shortcut
- context menu
- more menu

目标：

- 用户可完整使用 copy / cut / paste

## 第 5 阶段

做细节增强：

- edge-only copy
- paste 到 container
- shortcut 文案展示
- mixed selection 未来兼容

## 15. 非目标

本方案当前不做：

- 先重做 mixed selection
- 在 engine 内直接调用浏览器 clipboard API
- 复用 whole-document serializer 做 clipboard
- 保留 duplicate / paste 两套并行规划器
- 在 toolbar 主区新增 `Copy / Paste`

## 16. 一句话结论

最终最优方案是：

- 用 `Slice` 表达可搬运的文档切片
- engine 负责导出结果与插入 `Slice`
- host 负责真正的系统剪贴板
- `duplicate` 与 `paste` 收敛成同一条 `Slice -> insert` 链路

这样概念最少，边界最清晰，长期不会继续膨胀。
