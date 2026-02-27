# 使用 Jotai 改造白板引擎：构建纯粹的数据驱动架构

Jotai 作为一个极其轻量（无 Context）且支持在 Vanilla JS 中使用（原生 Store 和 Atom）的状态管理库，**非常适合**作为非 React 层复杂应用的“响应式基建（Reactivity Infrastructure）”。

基于 `jotai/vanilla` 的 API，我们可以系统性收敛历史遗留的命令式调度层（旧 query store / 手写 watch / 事件桥），将白板引擎真正进化为**数据驱动（Data-Driven）**的架构。  
本文内容已对齐 `WHITEBOARD_OPERATION_MM_QUERY_INDEX_OPTIMAL_ARCHITECTURE.md` 里的 Materialized Model / Query Index 管线与当前实现代码路径。

---

## 最新落地快照（2026-02-27）

当前代码已完成以下关键切换（优先级高于文内早期示例）：

1. 已删除 `ProjectionStore` 与 `projection.commit -> applyCommit` 管线。
2. 写入边界统一为：
   - `MutationExecutor` 直接写 `documentAtom` 与 `projectionRevisionAtom`
   - 同步发布 `mutationMetaBus`
3. 读侧统一为：
   - `projection derived atoms`（由 `documentAtom` 派生 `visible/canvas/edges/indexes/snapshot`）
   - `QueryIndexRuntime.applyMutation(meta)`
   - `ReadRuntime.applyMutation(meta)`（驱动 materialized 失效与 revision）
4. `instance.projection` 已从类型与实现中移除，`instance.runtime.store` 是唯一 store 锚点。

说明：

1. 文内凡是出现 `projection.subscribe/applyCommit` 的旧示例，均以本节描述为准。
2. `ReadModelSnapshot` 现在是读侧结构类型（type shape），不是独立存储管线。

---

## 1. 为什么选择 Jotai？

Jotai 的核心思想是**原子化（Atomic）**和**派生（Derived）**：
- **`atom()`**：定义了独立的、细粒度的状态源。
- **Derived Atom**：可以读取其他 Atom，并自动建立依赖图谱（Dependency Graph）。当源 Atom 发生变更，基于它的 Derived Atom 自动失效并重算。
- **`createStore` / `store.get` / `store.sub`**：允许我们在纯 TypeScript（非 React）环境中管理整个响应式的生命周期，这对于引擎层（Engine Layer）来说完美契合。

---

## 2. 现状（Imperative） vs 未来（Jotai Reactive）

### 病症回顾（历史命令式层）
1. `commit.impact` 需要全量打标签。
2. `applyCommit` 内部是一串 `if-else`。
3. Registry 手动 `edge.syncState('selection')` 去触发更新。
4. 提供一个巨无霸的 `subscribe` 让 React 层重渲染所有东西（哪怕只动了 Viewport）。

### 对症下药（引入 Jotai）
1. 我们将**所有的视图衍生状态（Derived View）**全部变成 Jotai 的 Atom。
2. 当 `ProjectionCommit` 到来时，只更新那些“真正的 Root Data Atom”。
3. 任何依赖这些 Root Data 的 Derived Atom **自动静默重算**。无需再写任何一行胶水调度代码。

---

## 3. 架构改造蓝图：Jotai 化引擎读侧（结合当前实现）

### 3.1 Store 创建后直接挂载到 instance
在 `createEngine` 内只创建一次 Jotai store，并直接挂到 instance。  
推荐挂载位：`instance.runtime.store`（符合 `state/runtime/query/commands` 命名分域）。

```typescript
import { createStore } from 'jotai/vanilla'

const runtimeStore = createStore()
instance.runtime = {
  ...instance.runtime,
  store: runtimeStore
}
```

说明：

1. `instance.runtime.store` 是引擎与 React 的统一订阅源。
2. `instance.read.store` 建议最终与 `instance.runtime.store` 统一为同一个引用。
3. 不再接受模块级 singleton store 承载实例相关状态。

### 3.2 Root Atoms（按当前代码分层）
在当前实现中，Root Atoms 已具备雏形：

1. `readModelSnapshotAtom`：读模型快照根（由 `documentAtom + readModelRevisionAtom` 派生）。
2. `stateAtoms.*`：交互状态根（`selection/tool/viewport/mindmapLayout/...`）。
3. `materializedRevisionAtom`：可变 materialized cache 的可观察桥。

其中 `viewport` 采用单真值策略：

1. `stateAtoms.viewport` 是唯一可写源（engine/runtime/react 共用同一 atom）。
2. `ViewportRuntime` 通过 `store.get/set(stateAtoms.viewport)` 作为几何 getter/转换入口，不再维护第二份内存副本。
3. `document.viewport` 仅作为持久化快照，在 mutation 提交后同步写回 runtime（例如 reset/import/history/remote 回放）。

当 mutation meta 到来时，遵循“先更新可变读模型，再发布可观察 revision”的顺序：

```typescript
mutationMetaBus.subscribe((meta) => {
  queryIndex.applyMutation(meta)
  materialized.applyMutation(meta)
  if (shouldBumpMaterializedRevision(meta)) {
    store.set(materializedRevisionAtom, (x) => x + 1)
  }
})
```

当前实现已在 `createEngine` 中收敛为单一 dispatcher：同一个 mutation meta 按固定顺序执行
`queryIndex.applyMutation -> materialized.applyMutation -> revision atoms`。

### 3.3 领域派生 Atom（以 edge 读侧为例）
当前读侧正确做法不是“事件中转 atom”，而是直接从 Root Atoms 派生：

```typescript
const selectedEdgeIdAtom = atom((get) => get(selectionAtom).selectedEdgeId)

const edgeSelectedEndpointsAtom = atom((get) => {
  get(materializedRevisionAtom)
  const selectedEdgeId = get(selectedEdgeIdAtom)
  const edge = selectedEdgeId ? materialized.getEdge(selectedEdgeId) : undefined
  return edge ? resolveEndpoints(edge) : undefined
})
```

### 3.4 React 消费方式
在 `Whiteboard` 根层统一注入一次 `JotaiProvider`，子树直接 `useAtomValue(atom)`：

```tsx
<JotaiProvider store={instance.runtime.store}>
  <WhiteboardCanvas />
</JotaiProvider>
```

```tsx
const endpoints = useAtomValue(instance.read.atoms.edgeSelectedEndpoints)
```

### 3.5 Materialized Model 管线（对应现有实现）
当前 Materialized Model 的职责与实现对应如下：

1. 主入口：`runtime/read/materialized/MaterializedModel.ts`
2. edgePath：`runtime/read/materialized/edgePath/*`
3. 触发方式：`applyMutation(meta)` 记录失效，读取时按需 `ensureEntries()`
4. 输出能力：
   - `getNodeIds()`
   - `getEdgeIds()/getEdgeById()/getEdge()`
   - `getMindmapIds()/getMindmapById()`

关键点：

1. edgePath 使用可变缓存（Map/Index），因此需要 revision atom 做桥接。
2. 节点排序与脑图视图使用引用稳定/值相等判断，减少无效分配。

### 3.6 Query Index 管线（对应现有实现）
当前 Query Index 已是“mutation meta 同步更新 + 查询纯 getter”模型：

1. 主入口：`runtime/read/indexes/QueryIndexRuntime.ts`
2. 索引实现：`runtime/read/indexes/QueryIndexes.ts`
3. API 绑定：`runtime/read/api/Runtime.ts` -> `createCanvas/createSnap`

`applyMutation` 策略（现行）：

1. `replace/full`：`indexes.sync(full nodes)`
2. `order && !edges`：全量 `sync`（保障有序输出）
3. `dirtyNodeIds`：`syncByNodeIds`
4. `geometry/mindmap`（且无 dirtyNodeIds 分支提前返回）：全量 `sync`

结果：

1. `query.canvas/*`、`query.snap/*` 不再做“惰性补账”。
2. `pointermove` 热路径只读索引，无写操作。

---

## 4. 彻底解决性能瓶颈：细粒度的粒度控制

如果您觉得 `readModelSnapshotAtom` 这个基础 Atom 粒度太大（一有改动所有的派生都可能去跑一边函数），Jotai 强大的地方在于可以结合 `selectAtom` 做深度的**引用对比（Equality Check）**：

```typescript
export const canvasNodesRectsAtom = selectAtom(
   readModelSnapshotAtom,
   (snap) => snap.nodes.computedRects, // 只关心节点矩阵信息
   (prev, next) => prev === next // 浅对比，如果没变，依赖它的 derived Atom 绝对不执行！
)
```
利用这一机制，我们真正实现了 O(1) 的更新：**不写任何一行判断逻辑，依然在架构层面上杜绝了无效重算。**

---

## 5. 核心架构指导思想：CQRS 的完美分离

（CQRS：Command Query Responsibility Segregation，命令查询职责分离）

在未来的重构中，我们要坚定地走“两条路”并行的架构：**写入保集权，读取做分发。**

### 第一条路：写入管线（Mutation Pipeline）—— 必须保留且高度集权
白板是一个严肃的文档生产工具。
- **协作与冲突合并**：需要定义严密的 Mutation（Insert, Update, Delete）配合 CRDT，才能在多人协作时完美融合状态。
- **历史记录 (Undo / Redo)**：必须通过精准拦截 Command/Mutation 才能打包可靠的撤销记录。
- **因此：** `WriteCoordinator`、`HistoryDomain` 等保留，它们构成了绝对安全的**命令路 (Command)**，确保状态的合法性。这条路的终点，是产出一个全新的、只读的 `ReadModelSnapshot`。

### 第二条路：查询与派生（View / Query via Jotai）—— 彻底数据驱动分发
- 写入管线追求**安全可溯**，而读取管线追求**极速按需**。
- **因此：** 历史命令式读侧调度（手写路由、惰性补账、二次事件桥）全部收敛。
- **终极形态：** 将 `ReadModelSnapshot` 作为 Jotai 的 **Root Atom**。当快照推新时，Jotai 内部的依赖图谱自动使所有的下游派生原子（如 `EdgePathAtom`、`SelectedEndpointsAtom`）脏化并极速重算。

### 真正的引擎骨架蓝图：

```text
================【 命令/写入路 (Write / Command) 】================
 用户操作 (React) / 远程协作 (Socket)
     ↓
 派发 Commands
     ↓ 
 [Mutation 管线 (拦截/冲突处理/History 记录)] 
     ↓
 生成全新只读快照 (ReadModelSnapshot)
       │
      ====（职责割裂的黄金分割线）====
       │
       ▼
================【 查询/响应路 (Read / Query via Jotai) 】=========
 [ Root Atom: readModelSnapshotAtom ] <- 每产生新快照，更新它的值
       │
    (自动订阅推导关系)
       │───> [ Derived Atom: nodeRectsAtom ]
       │───> [ Derived Atom: mindmapLayoutAtom ]
       │───> [ Derived Atom: edgePathsStoreAtom ]
                 │
             (二次派生)
                 │───> [ Derived Atom: edgeSelectedEndpointsAtom ]
                           │
================【 消耗端 (React Layer) 】========================
           useAtomValue(edgeSelectedEndpointsAtom)
                 |
               Render!
```

---

## 6. 深入的技术细节补充 (Crucial Edge Cases)

如果您准备进行重构，有两点引擎侧的高级细节必须在设计时就想清楚，否则会导致严重的内存泄漏或无休止的重渲染。

### 6.1 高频缓存（Cache）的响应式隔离
在白板引擎里，像 `EdgePathStore (Cache.ts)` 这种计算量极大、依赖 Canvas 和 Geometry 库的部分，内部维护了原生的 `Map` 或 `Array` 进行极限性能的缓存复用。
**问题**：Jotai（或任何 Reactivity 系统）默认依赖**不可变数据（Immutable Data）**的引用对比来判断是否变更。如果你直接把一个会原地 `.set()` 的 Map 塞进 Atom，Jotai 会认为引用没变，从而拒绝更新。
**方案**：我们需要一个专门的 `MutableRefAtom` 范式，在读取时手动触发一个递增的 `version`：
```typescript
// 用一个原子的 Revision 充当 Cache 的触发器
const edgeCacheRevisionAtom = atom(0)

export const edgePathsAtom = atom((get) => {
   // 强行订阅版本号，无论底层 Map 怎么变，只要 version 变了，这里一定执行
   get(edgeCacheRevisionAtom) 
   // 返回内部可变的 Map 或 Array
   return pathStore.getById() 
})
```

### 6.2 庞大树状解构的极速断言 (`selectAtom` 魔法)
白板中的节点树（Tree结构）如果有一处变动，每次 snapshot 更新难道要导致所有的渲染组件都重算吗？
**方案**：配合 `jotai/utils` 中的 `selectAtom` 做深节点的 O(1) 短路（Short-circuiting）。
```typescript
export const nodeByIdAtomFamily = atomFamily((id: string) => 
  selectAtom(
    readModelSnapshotAtom,
    (snap) => snap.nodes.byId.get(id), // 抽取 O(1)
    (prev, next) => prev === next      // Referencial Equality Check
  )
)
```
利用 `atomFamily` 加上 `selectAtom`，我们可以做到：**即使产生了一万个节点的全新树快照，React 端也只有真正被修改（引用改变）的那一两个节点组件会发生重新渲染**，其余9999个组件在 `prev === next` 处就被瞬间拦截！

### 6.3 对齐 MM/QI 实现时的现实约束
结合当前 `MaterializedModel + QueryIndexRuntime` 实现，需要明确三条规则：

1. Query Index 走 mutation meta 同步更新，query getter 只读：
   - `runtime/read/api/Runtime.ts` 中 `mutationMetaBus.subscribe -> queryIndex.applyMutation`
   - `runtime/read/indexes/QueryIndexRuntime.ts` 负责增量/全量策略切换
2. Materialized（尤其 edgePath）允许“失效记录 + 读取时 ensure”：
   - `runtime/read/materialized/edgePath/Invalidation.ts` 仅记录 dirty
   - `runtime/read/materialized/edgePath/Query.ts` 在 getter 中 `ensureEntries()`
3. 只要底层缓存是可变结构，就必须保留 revision 桥（如 `materializedRevisionAtom`）：
   - 没有 revision，Jotai 只看引用，会漏掉 Map 原地更新。

---

## 7. 下一步重构行动指引

1. **确立边界**：不动目前的 `WriteCoordinator` 和指令系统，写入边界统一输出 `MutationMeta`。
2. **初始化并挂载 Store**：在引擎启动时创建唯一 store，并挂载到 `instance.runtime.store`（`instance.read.store` 与其同引用）。
3. **建立 Root Atoms**：以 `documentAtom + readModelRevisionAtom` 作为读模型根，派生 `readModelSnapshotAtom`。
4. **对齐 MM/QI 管线**：确保 `applyMutation` 顺序为“先更新 materialized/indexes，再发布可观察 revision”。
5. **处理高频计算**：将可变缓存统一通过 `RevisionAtom` 暴露，不做 event-only atom。
6. **拆除脚手架**：当所有读侧消费者均走 atom/store 后，删除手写 watch 与历史事件桥调度层。
