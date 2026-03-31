# Whiteboard Editor Bounds 长期最优方案

## 1. 问题定义

当前 whiteboard 的 bounds 相关能力分散在三处：

- `packages/whiteboard-core/src/node/selection.ts`
  - `getTargetBounds(...)`
  - `TargetBoundsInput`
- `packages/whiteboard-engine/src/read/store/index.ts`
  - `engine.read.bounds.canvas()`
  - `engine.read.bounds.targets()`
- `packages/whiteboard-editor/src/runtime/read/bounds.ts`
  - `editor.read.bounds.canvas()`
  - `editor.read.bounds.targets()`

表面上这三处看起来是一个连续分层：

- core 提供纯算法
- engine 提供 committed/projection 查询
- editor 提供 runtime/transient 查询

但实际不是。

当前设计有 4 个根本问题：

- `TargetBoundsInput.groups` 把“目标数据”和“解释策略”混在了一起。
- engine 和 editor 各有一份 `bounds`，名字一致、职责不同，边界不清。
- `bounds.targets(...)` 看似可复用，实际在 selection 的 derived store 场景里不能直接复用。
- `canvas()` 这个命名不准确，它返回的是内容整体包围盒，不是 DOM canvas 尺寸。

这导致现在的系统虽然“能用”，但中轴不清晰，长期会不断产生重复实现、参数越来越奇怪、以及 selection/interaction 对 bounds 语义的隐式绑死。

本文目标不是在现状上做小修，而是明确 bounds 相关能力的长期最优终局。

## 2. 现状分析

### 2.1 `TargetBoundsInput.groups` 为什么别扭

当前 core 的 `TargetBoundsInput` 形态是：

```ts
type TargetBoundsInput = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
  groups?: 'node' | 'content'
}
```

这里的 `nodeIds` / `edgeIds` 是“目标数据”。

而 `groups` 表示：

- 如果目标里有 group，是拿 group 自己的壳
- 还是拿 group 内容的包围盒

这不是目标数据，而是“如何解释目标”的策略。

这会带来几个问题：

- 同一个 target 不再有唯一语义。
- 一个通用 bounds helper 开始承载 selection/group 特定规则。
- 以后 frame/container/stack 如果也有类似规则，这个参数会继续膨胀。
- API 看起来通用，实际带着明显 domain 偏见。

所以 `groups` 不是“命名还不够好”，而是边界就放错了。

### 2.2 engine/editor 各一份 bounds 为什么别扭

当前 engine 和 editor 各有一份 `bounds`：

- engine:
  - committed/projection 几何
- editor:
  - transient-aware 运行时几何

但 editor 这一份并不是一个真正新的“bounds 域”，而只是 runtime 数据源对 engine 逻辑的适配层。

也就是说 editor 的 `bounds` 并不是一个稳定的公共 read 领域，而更像：

- runtime target bounds adapter

这种 adapter 继续以 `read.bounds` 的形式公开，会产生两个误导：

- 看起来 engine/editor 有两套等价 bounds API。
- 看起来 `editor.read.bounds.targets(...)` 是稳定通用能力。

但实际上不是。

selection 的 derived store 如果直接依赖 `editor.read.bounds.targets(...)`，会绕开 `readStore(...)` 的依赖追踪机制，因为 `targets(...)` 内部是普通 `.get()` 读取。

这意味着：

- API 形态上可复用
- 机制上并不可直接复用

所以它不是真正的中轴。

### 2.3 `canvas()` 命名为什么不对

当前 engine 的 `bounds.canvas()` 返回的是内容整体包围盒，计算对象包括：

- nodes
- edges
- mindmap

这不是 DOM canvas 的尺寸，也不是 viewport 可视区范围。

所以 `canvas` 这个命名会误导调用方。

长期更准确的命名应该是：

- `scene.bounds()`
- 或 `document.contentBounds()`

总之它描述的是内容整体几何，而不是画布容器尺寸。

## 3. 长期最优原则

设计 bounds 相关能力时，应遵守 4 条原则。

### 3.1 目标数据和解释策略分离

一个 target 应该只表示：

- 哪些 node
- 哪些 edge

而不应该把“如何解释 group/frame/container”放在同一个对象里。

### 3.2 read 和 query 分离

以下两种能力不是一类东西：

- 稳定状态读取
- 带输入参数的几何查询

`target -> rect` 更像 query，不像 read。

### 3.3 engine 负责 committed scene，editor 负责 runtime overlay

engine 负责：

- committed/projection 层的稳定几何

editor 负责：

- transient/runtime 层对 committed 几何的覆盖

两边不应该各自维护一整套看似对等的公共 API。

### 3.4 selection 的特殊规则必须显式化

“选中 group 时框 group 内容而不是 group shell”是 selection 规则，不是 generic bounds 规则。

这条规则必须显式存在，而不能靠 `groups: 'content'` 这样的隐含参数偷偷表达。

## 4. 最终模型

### 4.1 去掉 `groups`

长期最优下，target bounds 的输入应收敛为：

```ts
type BoundsTarget = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
}
```

不再允许：

```ts
groups?: 'node' | 'content'
```

如果 selection 需要特殊展开，应走单独 helper。

### 4.2 把 group 内容展开做成显式 helper

建议新增显式 helper，例如：

```ts
type BoundsTarget = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
}

type ExpandedBoundsTarget = BoundsTarget

function expandGroupContentTarget(
  target: BoundsTarget,
  nodes: readonly Node[]
): ExpandedBoundsTarget
```

或者更直接一点：

```ts
function resolveSelectionBoxTarget(
  target: BoundsTarget,
  nodes: readonly Node[]
): BoundsTarget
```

关键不在具体名字，而在于：

- selection/group 特殊语义必须显式
- generic target bounds 算法只做纯 union

### 4.3 core 只保留纯算法

core 层应拆成两部分：

- generic target bounds 算法
- selection/group 特殊 target 展开算法

建议长期目录如下：

```ts
packages/whiteboard-core/src/selection/targetBounds.ts
packages/whiteboard-core/src/selection/expandSelectionBoxTarget.ts
```

或者：

```ts
packages/whiteboard-core/src/geometry/targetBounds.ts
packages/whiteboard-core/src/selection/selectionBoxTarget.ts
```

不建议继续把 `getTargetBounds(...)` 放在 `node/selection.ts` 下，这会继续混淆：

- node 领域
- selection 领域
- bounds 几何算法

### 4.4 engine 只保留 scene/document 级整体 bounds

engine 层应该保留“整体内容包围盒”，因为这是 committed/projection 层稳定且合理的读取能力。

但命名需要调整。

长期最优有两个候选：

方案 A：

```ts
engine.read.scene.bounds()
```

方案 B：

```ts
engine.read.document.contentBounds()
```

两者都比 `engine.read.bounds.canvas()` 更准确。

建议优先采用方案 A，因为语义最清楚：

- `scene` 表示内容几何场景
- `bounds()` 表示该场景的整体包围盒

### 4.5 editor 不再公开一整套 `bounds` 域

editor 长期不应该保留：

```ts
editor.read.bounds.targets(...)
```

原因如下：

- 它不是稳定状态读取，而是参数化查询。
- 它真正的价值是 runtime-aware adapter。
- 它不能被 selection 的 derived store 直接复用。
- 它几乎没有成为一个高质量公共 API。

editor 最优终局是：

- 如果需要整体内容 bounds，直接代理 engine 的 scene/document bounds
- runtime target bounds 变成内部 query/helper

## 5. editor 侧最终结构

长期最优下，editor 建议改成：

```ts
editor.read.scene.bounds()
```

以及内部：

```ts
targetBoundsQuery.get(target)
targetBoundsQuery.track(read, target)
```

其中：

- `get(...)`
  - 给命令式查询使用
- `track(...)`
  - 给 derived store 使用
  - 必须通过 `readStore(...)`/`ReadFn` 完整追踪依赖

这样 selection summary 可以安全复用。

### 5.1 内部 helper 形态

建议在 editor 内部新增一个专门 query 模块，而不是继续把逻辑塞在 `runtime/read/bounds.ts`。

例如：

```ts
packages/whiteboard-editor/src/runtime/query/targetBounds.ts
```

定义大致为：

```ts
type TargetBoundsQuery = {
  get: (target: BoundsTarget) => Rect | undefined
  track: (read: ReadFn, target: BoundsTarget) => Rect | undefined
}
```

其职责只有两件：

- 把 runtime 的 `node read` / `edge read` 接到 core 的纯算法上
- 区分命令式查询和 store 追踪式查询

### 5.2 selection 如何使用

selection summary 不再自己重复拼 target bounds 逻辑，也不再依赖 public `read.bounds.targets(...)`。

它应该：

- 如需要 group content 语义，先显式展开 target
- 再走 `targetBoundsQuery.track(...)`

这样 selection 的 box 计算链是清晰的：

```ts
selection target
-> selection-specific target expansion
-> targetBoundsQuery.track(...)
-> summary.box
```

这比“在一个通用 `getTargetBounds(...)` 里塞 `groups: 'content'`”清楚得多。

## 6. 为什么这是长期最优

### 6.1 消除双份 bounds 的伪对称

现在 engine/editor 各一份 `bounds`，看起来对称，实际上不是。

长期最优要承认：

- engine 的整体 content bounds 是稳定 read
- editor 的 runtime target bounds 是 query

它们不是一个层级的东西，不应该长得一样。

### 6.2 让 selection 的特殊规则显式存在

当前 `groups: 'content'` 的问题，不是规则存在，而是规则藏在通用 API 里。

长期最优应该让 selection box 的特殊性明确体现在 helper 名称和调用链上。

### 6.3 让复用真正成立

真正的复用不是“把一个 public getter 到处调用”。

真正的复用是：

- 命令式查询与追踪式查询共享同一算法
- 不同上层模块共享同一个 target resolution 逻辑
- core/editor 的分工明确且不重复

### 6.4 降低命名噪音

长期最优下，可以顺便收掉几个误导性名字：

- `TargetBoundsInput` -> `BoundsTarget`
- `groups` -> 删除
- `bounds.canvas()` -> `scene.bounds()` 或 `document.contentBounds()`

这样后续调用点会明显更直观。

## 7. 最终建议

这是本文的最终建议，不考虑兼容与过渡。

### 7.1 必做

- 删除 `TargetBoundsInput.groups`
- 把 group content 的展开移到显式 helper
- `getTargetBounds(...)` 只保留纯粹的 target union rect 语义
- editor 内部新增 runtime-aware `targetBoundsQuery`
- selection 通过 `targetBoundsQuery.track(...)` 计算 summary.box

### 7.2 强烈建议

- engine 把 `bounds.canvas()` 重命名为 `scene.bounds()` 或 `document.contentBounds()`
- editor 不再公开 `read.bounds.targets(...)`
- editor 不再维护一整套公开 `bounds` 域，只保留真正稳定的整体内容 bounds 读取

### 7.3 不建议继续保留的设计

- 不建议继续保留 `groups: 'node' | 'content'`
- 不建议继续让 editor 和 engine 各公开一套完整 `bounds`
- 不建议继续把 target bounds 伪装成普通 read 领域

## 8. 推荐终局 API

这是推荐的长期终局 API，不含兼容层。

### 8.1 core

```ts
type BoundsTarget = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
}

function getTargetBounds(args: {
  target: BoundsTarget
  readNodeBounds: (nodeId: NodeId) => Rect | undefined
  readEdgeBounds: (edgeId: EdgeId) => Rect | undefined
}): Rect | undefined

function resolveSelectionBoxTarget(
  target: BoundsTarget,
  nodes: readonly Node[]
): BoundsTarget
```

### 8.2 engine

```ts
engine.read.scene.bounds()
```

或者：

```ts
engine.read.document.contentBounds()
```

### 8.3 editor public

```ts
editor.read.scene.bounds()
```

### 8.4 editor internal

```ts
targetBoundsQuery.get(target)
targetBoundsQuery.track(read, target)
```

## 9. 一句话总结

长期最优不是继续维护两份 `bounds`，也不是给 `TargetBoundsInput` 再加更多参数。

长期最优是：

- 砍掉 `groups`
- 把 target 数据和解释策略分离
- engine 只保留整体 scene/document bounds
- editor 内部保留 runtime-aware target bounds query
- selection 与其他几何消费者共用 query，而不是共用一个伪通用 `bounds read`
