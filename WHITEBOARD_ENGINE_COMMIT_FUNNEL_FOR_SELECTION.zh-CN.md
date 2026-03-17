# Whiteboard Engine Commit Funnel For Selection

## 1. 结论

如果 `engine` 可以改，而且没有兼容成本，那么 selection 最值得改的一刀不是：

- 给 `engine.commands.node` 增加 selection 逻辑
- 给 engine 再加一个 `selection` 命令域
- 让每个 action 继续靠返回值自己修修补补

而是：

**把 engine 的 commit 边界公开成一等能力。**

最终最优模型应当是：

```txt
write / replace / undo / redo
-> engine commit
-> engine.commit
-> react finalize
-> selection/state
```

这里的关键点是：

1. engine 继续只负责 document write，不负责 selection policy。
2. engine 公开统一的 `commit` 窄口。
3. 所有成功提交都通过同一个 `commit` 出口流出。
4. react runtime 只订阅这一处，再统一做 `selection/finalize`。
5. 本地 UX policy 仍然留在 react，不下沉进 engine。

一句话结论：

**engine 最该改的是“提交出口”，不是“命令内容”。**

---

## 2. 命名原则

你提的命名约束我认同，而且我建议直接作为设计原则固定下来。

### 2.1 目录优先于长前缀

优先：

- `selection/state.ts`
- `selection/view.ts`
- `selection/policy.ts`
- `selection/finalize.ts`
- `engine/commit.ts`

不要：

- `selectionState.ts`
- `selectionView.ts`
- `selectionPolicy.ts`
- `selectionFinalize.ts`
- `engineCommitStore.ts`

原因很简单：

- 域信息已经在目录里
- 文件名只需要表达该文件在域内的角色
- 这样 API 与模块名都更短

### 2.2 namespace 内不重复域名

如果已经在 `selection` 域下，就不要继续写：

- `selection.selectionState`
- `selection.selectNodes`
- `selection.selectEdge`

更短更干净的形式是：

```ts
selection.state
selection.nodes(...)
selection.edge(...)
selection.clear()
```

同理，engine 里如果已经在 `commit` 域下，就不要写：

- `commit.commitKind`
- `commit.commitChanges`

直接：

```ts
commit.kind
commit.changes
```

### 2.3 类型名尽量短，但边界要清晰

在文件内部或明确域路径下，可以直接用短名：

- `Commit`
- `Source`
- `View`
- `Policy`
- `Store`
- `Kind`

不需要：

- `SelectionSourceState`
- `EngineCommitEnvelope`
- `SelectionFinalizeContext`

但在跨包公共边界上，短名必须和路径一起工作。

例如：

```ts
import type { Commit } from '@whiteboard/engine'
import type { Source, View } from './selection/state'
```

这是可接受的。因为“域”由 import path 提供，不需要名字重复表达。

### 2.4 动词尽量少

selection primitive API 建议只保留：

```ts
selection.nodes(ids, mode?)
selection.edge(id)
selection.clear()
```

而不是：

```ts
selection.selectNodes(...)
selection.selectEdge(...)
selection.clearSelection(...)
```

因为在 `selection` 域里，`nodes / edge / clear` 已经足够明确。

---

## 3. 当前问题

当前 engine 对外暴露的写入边界，最大的问题不是“能力不够”，而是：

**提交信息在 public boundary 被压扁了。**

### 3.1 `WriteCommit` 在内部已经存在，但 public boundary 没吃满

当前内部已经有 `WriteCommit`：

- `kind`
- `changes`
- `impact`
- `doc`
- `inverse`

这本来已经很接近 selection finalize 最需要的输入。

但到了 engine public boundary 之后：

- mutating command 返回 `DispatchResult`
- `undo/redo` 返回 `boolean`
- `publish()` 只更新 read，并没有公开 commit stream

结果是：

- react 拿不到统一的 commit 出口
- history 和 normal write 的边界不一致
- selection finalize 只能继续散落在 action 层

### 3.2 `undo/redo` 的返回值最不适合 selection

现在 `undo/redo` 返回 `boolean`，这对 selection 最不友好，因为 runtime 根本不知道：

- 这次到底改了什么
- 改动来自 undo 还是 redo
- 这次有没有 change set
- 应该如何统一 finalize

### 3.3 `DispatchResult` 对 selection 来说信息不够稳定

`DispatchResult` 只表达：

- 是否成功
- changes

但 selection finalize 真正需要的还包括：

- 这次是 `apply / undo / redo / replace` 的哪一种
- read 是否已经同步到最新
- 本次提交是否应该被 engine commit stream 广播

也就是说，`DispatchResult` 更适合“命令调用结果”，不适合作为 runtime 统一漏斗事件。

---

## 4. 最终目标

如果从 selection 漏斗角度看 engine，长期最优目标很简单：

### 4.1 engine 只负责三件事

1. 执行 write
2. 产出 commit
3. 广播 commit

它不负责：

- selection
- container
- overlay session
- 本地 UX policy

### 4.2 react runtime 只负责两件事

1. 订阅 `engine.commit`
2. 对每次 commit 跑 `finalize`

本地 create / duplicate / group / ungroup 这种 UX policy，仍然由 react intent 层决定。

### 4.3 command 返回值与 commit 广播统一

长期最优是：

- 所有 mutating command 都返回 `Commit | DispatchFailure`
- `history.undo/redo` 也返回 `Commit | DispatchFailure`
- engine 同时通过 `engine.commit` 广播成功 commit

这样就有两条明确职责的通路：

1. 调用方拿返回值，做本地 flow control
2. runtime 订阅 commit，做统一 finalize

---

## 5. 最小公开模型

### 5.1 `Commit`

我建议把 engine 成功提交的公开模型直接收敛成一个很短的类型：

```ts
type Commit = {
  kind: 'apply' | 'undo' | 'redo' | 'replace'
  doc: Document
  changes: ChangeSet
  impact?: KernelReadImpact
}
```

这里故意不再引入：

- `phase`
- `envelope`
- `event`
- `meta`

第一版先把最核心的 commit 边界做对。

为什么 `kind` 就够：

- `apply`
  - 普通命令写入
- `undo`
  - 历史回退
- `redo`
  - 历史重做
- `replace`
  - document replace / load

这比：

- `kind + phase`
- `result + type + mode`

都更短，也更够用。

### 5.2 `commit`

`EngineInstance` 上建议直接暴露：

```ts
commit: ReadStore<Commit | null>
```

这是我最推荐的公开形态。

原因：

1. 与当前 engine/read/runtime store 模型一致。
2. 名字足够短。
3. 不需要额外的 event emitter 概念。
4. react 直接用 `get / subscribe` 即可。

不建议优先引入：

- `events.commit`
- `eventBus`
- `subscribeCommit(listener)`

这些都不是不能做，而是相对更长、更重，也不如 store 统一。

### 5.3 mutating command 返回值

建议把所有 mutating command 的返回统一成：

```ts
Promise<Commit | DispatchFailure>
```

而不是 `DispatchResult`。

具体包括：

- `commands.node.*`
- `commands.edge.*`
- `commands.mindmap.*`
- `commands.document.replace`

### 5.4 history 返回值

建议把：

```ts
undo: () => boolean
redo: () => boolean
```

改成：

```ts
undo: () => Commit | DispatchFailure
redo: () => Commit | DispatchFailure
```

如果没有可撤销项，就直接返回：

```ts
{
  ok: false,
  reason: 'cancelled',
  message: 'Nothing to undo.'
}
```

这样 API 更统一，也更利于上层收敛。

---

## 6. 为什么 `commit` 用 store 最好

### 6.1 它是天然的 runtime 订阅点

selection finalize 不关心“某个 command 函数是谁调的”，它只关心：

- engine 什么时候完成了一次成功提交
- 当前 read 是否已经同步到这次提交

`commit` store 正好表达这个语义。

### 6.2 它与现有 read/store 心智一致

当前仓库已经有稳定的：

- `ValueStore`
- `ReadStore`
- `KeyedReadStore`
- `DerivedStore`

如果 commit 单独走 event emitter，会引入第二套模型。

如果 commit 也是 store，就能保持统一：

```ts
engine.read.node.list
engine.read.edge.list
engine.commit
```

都是：

- `get()`
- `subscribe()`

### 6.3 它天然适合“最后一次提交”语义

selection finalize 不需要完整历史事件总线，它只需要：

- 最新一次成功提交

这和 `ReadStore<Commit | null>` 完全契合。

---

## 7. 推荐的 engine API

### 7.1 `EngineInstance`

推荐最终公开形态：

```ts
type EngineInstance = {
  config: Readonly<BoardConfig>
  read: EngineRead
  commit: ReadStore<Commit | null>
  commands: EngineCommands
  configure: (config: EngineRuntimeOptions) => void
  dispose: () => void
}
```

这里最关键的新增点只有一个：

```ts
commit: ReadStore<Commit | null>
```

### 7.2 `EngineCommands`

建议把所有 mutating 方法返回统一成：

```ts
Promise<Commit | DispatchFailure>
```

例如：

```ts
type EngineCommands = {
  document: {
    replace: (doc: Document) => Promise<Commit | DispatchFailure>
  }
  history: {
    get: () => HistoryState
    undo: () => Commit | DispatchFailure
    redo: () => Commit | DispatchFailure
    clear: () => void
  }
  node: {
    create: (payload: NodeInput) => Promise<Commit | DispatchFailure>
    update: (id: NodeId, patch: NodePatch) => Promise<Commit | DispatchFailure>
    ...
  }
  edge: {
    create: (payload: EdgeInput) => Promise<Commit | DispatchFailure>
    ...
  }
  mindmap: {
    ...
  }
}
```

### 7.3 public 命名不建议再扩域

不要新增：

- `engine.selection`
- `engine.runtime`
- `engine.ui`

因为 selection 并不是 engine 的职责。

engine 只加：

- `commit`

就够了。

---

## 8. engine 内部推荐改法

### 8.1 新增 `types/commit.ts`

建议把 commit 相关类型单独提出来：

```txt
packages/whiteboard-engine/src/types/commit.ts
```

这里放：

- `Commit`

不建议命名成：

- `commitTypes.ts`
- `engineCommit.ts`
- `writeCommitPublic.ts`

目录已经说明它是 engine 类型，文件只需要叫 `commit.ts`。

### 8.2 `types/write.ts`

这里的改法建议是：

- 内部 `WriteCommit` 可以继续存在
- 但对外命令返回的 success 类型改成公开 `Commit`

也就是说：

- `WriteCommit`
  - 内部写管线类型
- `Commit`
  - public runtime commit 类型

两者可以相同，也可以由前者投影到后者。

### 8.3 `types/command.ts`

把 mutating command 的返回统一改成：

```ts
Commit | DispatchFailure
```

不再让：

- command 返回 `DispatchResult`
- history 返回 `boolean`

这种不一致继续存在。

### 8.4 `instance/engine.ts`

这里是最应该动的地方。

建议新增一个很轻的 source store：

```ts
const commit = createValueStore<Commit | null>(null)
```

然后在 `publish()` / `replace()` / `undo()` / `redo()` 的成功路径里统一写入。

顺序建议固定为：

1. 写 document
2. invalidate read
3. `commit.set(nextCommit)`
4. `onDocumentChange?.(doc)`

这里顺序非常关键。

### 8.5 为什么 `commit.set` 要放在 read.invalidate 之后

因为 react runtime 订阅 `engine.commit` 之后，通常会立刻读取：

- `engine.read`
- `container`
- `selection`

如果 commit 先发、read 后同步，那么 finalize 读到的还是旧 projection。

所以必须保证：

```txt
read already updated
then commit store emits
```

这也是为什么 `commit` 应该建在 engine publish 边界，而不是 command 层。

---

## 9. `history` 最该怎么改

### 9.1 直接去掉 `boolean`

如果没有兼容成本，我建议直接把 `undo/redo` 的 `boolean` 返回砍掉。

改成：

```ts
undo(): Commit | DispatchFailure
redo(): Commit | DispatchFailure
```

理由：

1. API 统一。
2. 上层不用为 history 单独写一套边界。
3. selection finalize 可以完全复用 commit 漏斗。

### 9.2 `false` 没有信息量

`false` 最糟糕的地方不是类型不好看，而是它无法回答：

- 为什么失败
- 是没有历史，还是冲突，还是取消
- runtime 是否应该 reset 某些 session

统一成 `DispatchFailure` 后，这些问题就都回到已有失败模型里了。

### 9.3 `undo/redo` 的 `kind`

成功时：

- undo -> `kind: 'undo'`
- redo -> `kind: 'redo'`

这样 react finalize 甚至可以在必要时做很轻的策略区分，而不用猜来源。

---

## 10. 为什么不建议在 engine 里加 selection 域

这是最需要明确拒绝的一点。

### 10.1 selection 不是 document write

engine 负责：

- document
- changeset
- read impact
- history

selection 属于：

- UI runtime session

把 selection 下沉进 engine，会直接带来边界污染。

### 10.2 本地 UX policy 不该进 engine

例如：

- duplicate 后选中新副本
- group 后选中新 group
- ungroup 后选中 children

这些都是 UI policy，不是文档不变量。

engine 不应该知道“写完以后界面应该把焦点放哪”。

### 10.3 remote / history / system 会被污染

一旦 engine 自己开始做 selection，后面一定会碰到：

- remote 创建对象，本地为什么要自动选中
- undo 后为什么跳到某个对象
- replace document 后 selection 应该保留还是清空

这些全是 runtime 级问题，不适合下沉。

---

## 11. react 侧怎么接 engine commit

### 11.1 selection 流程会变得很简单

最终 react 侧推荐固定成：

```txt
local intent
-> optional policy
-> command returns Commit | DispatchFailure
-> engine.commit emits Commit
-> finalize(commit)
```

这里：

- `policy`
  - 只在 create / duplicate / group / ungroup / paste 等少量动作中存在
- `finalize`
  - 对所有 commit 一视同仁地执行

### 11.2 推荐 react 目录

结合你的命名偏好，我建议直接用：

```txt
packages/whiteboard-react/src/selection/state.ts
packages/whiteboard-react/src/selection/policy.ts
packages/whiteboard-react/src/selection/finalize.ts
packages/whiteboard-react/src/selection/index.ts
```

或者如果想继续挂在 runtime 下：

```txt
packages/whiteboard-react/src/runtime/selection/state.ts
packages/whiteboard-react/src/runtime/selection/policy.ts
packages/whiteboard-react/src/runtime/selection/finalize.ts
```

不要用：

```txt
selectionState.ts
selectionPolicy.ts
selectionFinalize.ts
```

### 11.3 react selection primitive API

建议最终缩成：

```ts
selection.nodes(ids, mode?)
selection.edge(id)
selection.clear()
```

`selectAllInScope` 这种就不要塞进 primitive 里。

它应留在：

- `canvas/actions`
- 或未来的 `selection/policy`

---

## 12. 需要不要给 commit 增加 `tag`

### 12.1 我的判断

第一阶段不必急着加。

如果 engine 先把：

- `commit` store
- 命令统一返回 `Commit | DispatchFailure`
- `undo/redo` 去布尔化

这三件事做好，selection 架构就已经能明显变干净。

### 12.2 为什么可以先不加

因为本地 selection policy 其实仍然可以在 action 层决定：

- duplicate action 自己知道这是 duplicate
- group action 自己知道这是 group
- ungroup action 自己知道这是 ungroup

engine 负责统一 commit 漏斗，react 负责少量本地 policy。

这已经足够把绝大多数“每个 action 都要想 selection”的膨胀砍掉。

### 12.3 什么时候再加 `tag`

如果以后你想把 local policy 与 commit 完整关联，再考虑给 write input 增一个很短的字段：

```ts
tag?: string
```

注意我建议直接叫：

- `tag`

不要叫：

- `selectionPolicyHint`
- `selectionMeta`
- `runtimeAnnotation`

如果加，也应只作为可选增强，不该成为第一阶段前置依赖。

---

## 13. 推荐实施顺序

### 13.1 第一步：公开 `Commit`

先新增：

- `packages/whiteboard-engine/src/types/commit.ts`

定义公开 `Commit`。

### 13.2 第二步：统一返回值

把下面这些返回值统一改掉：

- `commands.node.*`
- `commands.edge.*`
- `commands.mindmap.*`
- `commands.document.replace`
- `commands.history.undo`
- `commands.history.redo`

全部收敛成：

- success -> `Commit`
- failure -> `DispatchFailure`

### 13.3 第三步：给 engine 加 `commit` store

在：

- `packages/whiteboard-engine/src/instance/engine.ts`

里新增 `commit` source，并在 publish 成功后统一写入。

### 13.4 第四步：react 订阅 `engine.commit`

在 react runtime 里新增：

- `selection/finalize.ts`

统一订阅 `engine.commit`，把：

- container reconcile
- selection reconcile

都收过去。

### 13.5 第五步：删除 action 内的无意义 reselect

完成前四步后，可以删掉大量当前没必要的 selection 副作用，例如：

- arrange 后 reselect
- lock/unlock 后 reselect
- update group data 后 reselect

只保留少数真正属于本地 UX policy 的动作。

---

## 14. 推荐文件布局

### 14.1 engine

推荐最小布局：

```txt
packages/whiteboard-engine/src/types/commit.ts
packages/whiteboard-engine/src/instance/engine.ts
packages/whiteboard-engine/src/types/command.ts
packages/whiteboard-engine/src/types/instance.ts
packages/whiteboard-engine/src/types/write.ts
```

不建议为了这件事再引入一堆目录：

- `events/`
- `event-bus/`
- `runtime/commit/`

第一阶段没有必要。

### 14.2 react

推荐最小布局：

```txt
packages/whiteboard-react/src/selection/state.ts
packages/whiteboard-react/src/selection/policy.ts
packages/whiteboard-react/src/selection/finalize.ts
```

这已经足够表达：

- state
- policy
- finalize

不会出现：

- `selectionState`
- `selectionPolicy`
- `selectionFinalize`

这种重复命名。

---

## 15. 最终推荐 API 草图

### 15.1 engine

```ts
// engine/commit
export type Commit = {
  kind: 'apply' | 'undo' | 'redo' | 'replace'
  doc: Document
  changes: ChangeSet
  impact?: KernelReadImpact
}

// engine instance
type EngineInstance = {
  config: Readonly<BoardConfig>
  read: EngineRead
  commit: ReadStore<Commit | null>
  commands: EngineCommands
  configure: (config: EngineRuntimeOptions) => void
  dispose: () => void
}

// engine commands
type EngineCommands = {
  document: {
    replace: (doc: Document) => Promise<Commit | DispatchFailure>
  }
  history: {
    get: () => HistoryState
    undo: () => Commit | DispatchFailure
    redo: () => Commit | DispatchFailure
    clear: () => void
  }
  node: {
    create: (payload: NodeInput) => Promise<Commit | DispatchFailure>
    update: (id: NodeId, patch: NodePatch) => Promise<Commit | DispatchFailure>
    updateMany: (...) => Promise<Commit | DispatchFailure>
    delete: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
    deleteCascade: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
    duplicate: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
    group: {
      create: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
      ungroup: (id: NodeId) => Promise<Commit | DispatchFailure>
      ungroupMany: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
    }
    order: {
      set: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
      bringToFront: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
      sendToBack: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
      bringForward: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
      sendBackward: (ids: NodeId[]) => Promise<Commit | DispatchFailure>
    }
  }
}
```

### 15.2 react selection

```ts
// selection/state
type Source =
  | { kind: 'none' }
  | { kind: 'nodes'; nodeIds: readonly NodeId[] }
  | { kind: 'edge'; edgeId: EdgeId }

type View = {
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
}

type Commands = {
  nodes: (ids: readonly NodeId[], mode?: SelectionMode) => void
  edge: (id: EdgeId) => void
  clear: () => void
}
```

### 15.3 finalize

```ts
// selection/finalize
finalize({
  instance,
  commit,
  policy?
})
```

这里 `finalize` 已经够短，不需要：

- `finalizeSelectionRuntimeState`
- `runSelectionFinalizePipeline`

---

## 16. 最终建议

如果只能选一个改动，我的排序是：

1. 在 engine 上增加 `commit: ReadStore<Commit | null>`
2. 把所有 mutating command 返回值统一成 `Commit | DispatchFailure`
3. 把 `history.undo/redo` 从 `boolean` 改成 `Commit | DispatchFailure`
4. react 侧引入 `selection/finalize`
5. 删掉 action 层的大部分 selection 副作用

这里最重要的是第 1 条。

因为一旦 `engine.commit` 存在，selection 就终于有了单一、稳定、跨 write/history/replace 的统一漏斗口。

而且命名可以非常短：

- engine: `commit`
- react: `selection/state`
- react: `selection/policy`
- react: `selection/finalize`

这套命名和职责边界都比较干净，不会再出现：

- `selection.selectionState`
- `selection.selectionPolicyManager`
- `engine.engineCommitEventBus`

这种越写越长、越写越虚的结构。

一句话收束：

**把 engine 改成公开 `commit`，把 react 改成订阅 `commit`；selection 继续留在 runtime，但不再四处散落。**
