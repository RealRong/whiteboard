# 使用 Jotai 改造白板引擎：构建纯粹的数据驱动架构

Jotai 作为一个极其轻量（无 Context）且支持在 Vanilla JS 中使用（原生 Store 和 Atom）的状态管理库，**非常适合**作为非 React 层复杂应用的“响应式基建（Reactivity Infrastructure）”。

基于 `jotai/vanilla` 的 API，我们可以彻底砸碎当前 `Registry.ts` 中写死的 `switch-case` 和 `hasImpactTag` 流水线，将白板引擎真正进化为**数据驱动（Data-Driven）**的架构。

---

## 1. 为什么选择 Jotai？

Jotai 的核心思想是**原子化（Atomic）**和**派生（Derived）**：
- **`atom()`**：定义了独立的、细粒度的状态源。
- **Derived Atom**：可以读取其他 Atom，并自动建立依赖图谱（Dependency Graph）。当源 Atom 发生变更，基于它的 Derived Atom 自动失效并重算。
- **`createStore` / `store.get` / `store.sub`**：允许我们在纯 TypeScript（非 React）环境中管理整个响应式的生命周期，这对于引擎层（Engine Layer）来说完美契合。

---

## 2. 现状（Imperative） vs 未来（Jotai Reactive）

### 病症回顾（目前的 `Registry.ts`）
1. `commit.impact` 需要全量打标签。
2. `applyCommit` 内部是一串 `if-else`。
3. Registry 手动 `edge.syncState('selection')` 去触发更新。
4. 提供一个巨无霸的 `subscribe` 让 React 层重渲染所有东西（哪怕只动了 Viewport）。

### 对症下药（引入 Jotai）
1. 我们将**所有的视图衍生状态（Derived View）**全部变成 Jotai 的 Atom。
2. 当 `ProjectionCommit` 到来时，只更新那些“真正的 Root Data Atom”。
3. 任何依赖这些 Root Data 的 Derived Atom **自动静默重算**。无需再写任何一行胶水调度代码。

---

## 3. 架构改造蓝图：Jotai 化引擎试图 (Engine View via Jotai)

### 3.1 定义引擎隔离的独立 Store
为了防止污染全局，在 `instance/create.ts` 创建引擎实例时，我们创建一个专用的 Engine Store：
```typescript
import { createStore } from 'jotai/vanilla'

export const engineViewStore = createStore()
```

### 3.2 基础原子数据 (Root Atoms)
首先拦截最底层变化的数据，比如在 `Registry.ts` 中维护的：
```typescript
import { atom } from 'jotai/vanilla'
// 用来存放不可变的 ProjectionSnapshot
export const projectionSnapshotAtom = atom<ProjectionSnapshot>(defaultSnapshot)

// 用来存放引擎的交互 State（比如选中态）
export const engineStateAtom = atom<StateSnapshot>(defaultState)
```
当 `applyCommit` 发生时，我们**只做这一件事**：
```typescript
const applyCommit = (commit: ProjectionCommit) => {
   // 一旦写入，所有派生的 Atom 自动进入脏检查
   engineViewStore.set(projectionSnapshotAtom, commit.snapshot)
}
```

### 3.3 领域视角的派生视图 (Derived Atoms) : 以 EdgeDomain 为例
原本 `EdgeDomain` 里的 `recomputeEdgeSelectedEndpoints` 是典型的命令式，有了 Jotai 后：

```typescript
import { atom } from 'jotai/vanilla'
import { selectAtom } from 'jotai/utils'

// 1. 利用 selectAtom （如果只是提取浅数据）或者纯 getter 派生
const selectedEdgeIdAtom = selectAtom(
  engineStateAtom, 
  (state) => state.selection.selectedEdgeId,
  Object.is // 避免引用变化带来的误渲染
)

// 2. 核心派生视图（这替代了原来的整个 EdgeDomain.ts 相关逻辑！）
export const edgeSelectedEndpointsAtom = atom((get) => {
   const selectedEdgeId = get(selectedEdgeIdAtom)
   if (!selectedEdgeId) return undefined

   // 获取整个快照，读取对应的边
   const snapshot = get(projectionSnapshotAtom)
   const edge = snapshot.edges.byId.get(selectedEdgeId)
   if (!edge) return undefined

   // 返回重新计算的端点。注意：
   // 只有 selectedEdgeId 或 snapshot 变了，这个函数才会执行
   return createEdgeEndpointsResolver(snapshot.nodes.byId)(edge)
})

// 3. 构建 EdgesView，给外部消费
export const edgesViewAtom = atom((get) => {
   const snapshot = get(projectionSnapshotAtom) // 注意：这里可以细化成 pathStoreAtom
   return {
      ids: snapshot.edges.ids, // (假设已经由 cache 完成计算，也可以由 Jotai 管理)
      byId: snapshot.edges.byId,
      selection: {
         endpoints: get(edgeSelectedEndpointsAtom) // 自动关联！
      }
   }
})
```

### 3.4 消费方 (React) 的极简绑定
因为 React 端本来就深度集成了 Jotai，我们可以直接在组件侧通过 `useAtomValue` 读取具体部位的值，**彻底废除 `useWhiteboardView.ts` 中缓慢的全量订阅。**

```tsx
import { useAtomValue } from 'jotai'

// 原来：从一个庞大的状态包里去挑选，引擎一动，全量触发组件 diff
// const endpoints = useEdgeSelectedEndpointsView()

// 现在：直接订阅引擎 Store 里这根极细维度的“毛细血管”
export const EdgeEndpointHandles = () => {
   // 只有 edgeSelectedEndpointsAtom 的返回值变了，当前组件才会 Render!
   const endpoints = useAtomValue(edgeSelectedEndpointsAtom, { store: engineViewStore })
   
   if (!endpoints) return null
   // ...
}
```

---

## 4. 彻底解决性能瓶颈：细粒度的粒度控制

如果您觉得 `projectionSnapshotAtom` 这个基础 Atom 粒度太大（一有改动所有的派生都可能去跑一边函数），Jotai 强大的地方在于可以结合 `selectAtom` 做深度的**引用对比（Equality Check）**：

```typescript
export const canvasNodesRectsAtom = selectAtom(
   projectionSnapshotAtom,
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
- **因此：** `WriteCoordinator`、`HistoryDomain` 等保留，它们构成了绝对安全的**命令路 (Command)**，确保状态的合法性。这条路的终点，是产出一个全新的、只读的 `ProjectionSnapshot`。

### 第二条路：查询与派生（View / Query via Jotai）—— 彻底数据驱动分发
- 写入管线追求**安全可溯**，而读取管线追求**极速按需**。
- **因此：** 原本 `Registry.ts` 中难看的路由和 `syncState` 调度全部废弃。
- **终极形态：** 将 `ProjectionSnapshot` 作为 Jotai 的 **Root Atom**。当快照推新时，Jotai 内部的依赖图谱自动使所有的下游派生原子（如 `EdgePathAtom`、`SelectedEndpointsAtom`）脏化并极速重算。

### 真正的引擎骨架蓝图：

```text
================【 命令/写入路 (Write / Command) 】================
 用户操作 (React) / 远程协作 (Socket)
     ↓
 派发 Commands
     ↓ 
 [Mutation 管线 (拦截/冲突处理/History 记录)] 
     ↓
 生成全新只读快照 (ProjectionSnapshot)
       │
      ====（职责割裂的黄金分割线）====
       │
       ▼
================【 查询/响应路 (Read / Query via Jotai) 】=========
 [ Root Atom: projectionSnapshotAtom ] <- 每产生新快照，更新它的值
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
    projectionSnapshotAtom,
    (snap) => snap.nodes.byId.get(id), // 抽取 O(1)
    (prev, next) => prev === next      // Referencial Equality Check
  )
)
```
利用 `atomFamily` 加上 `selectAtom`，我们可以做到：**即使产生了一万个节点的全新树快照，React 端也只有真正被修改（引用改变）的那一两个节点组件会发生重新渲染**，其余9999个组件在 `prev === next` 处就被瞬间拦截！

---

## 7. 下一步重构行动指引

1. **确立边界**：不动目前的 `WriteCoordinator` 和指令系统，保持 `Projection` 产出机制不变。
2. **初始化 Store**：在引擎启动时创建局部的 `engineViewStore`。
3. **建立 Root Atoms**：监听 `projection.subscribe`，接收到新 snapshot 就 `store.set(snapshotAtom)`。
4. **验证原子模型**：拿最简单的 `ViewportDomain` 练手，把它改为 `viewportTransformAtom`。
5. **处理高频计算**：将 `EdgeDomain` 和刚改好的 `Cache.ts` 结合上面提到的 `RevisionAtom` 进行迁移。
6. **拆除脚手架**：当所有 Domain 都是 Atom 后，删掉 `Registry.ts` 中所有的 `applyCommit` 和事件分发代码。
