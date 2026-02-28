# Whiteboard Read Domain 组件化重构方案（不改行为）

更新时间：2026-02-28

适用范围：
- `packages/whiteboard-engine/src/runtime/read/**`

目标：
1. 解决 read 装配层“参数碎片化”的可读性问题。
2. 把 read 能力按领域聚合（node/edge/mindmap），而不是按函数散传依赖。
3. 不改变现有行为和数据语义，只做结构重排与接口收敛。

当前进度：
1. 阶段 1（Edge 先行）已落地。
2. 阶段 2（Node 迁移）已落地。
3. 阶段 3（Mindmap 迁移）已落地。
4. 阶段 4（清理收口）已落地。
5. 已新增 `edge/createEdgeModel.ts`、`edge/createEdgeView.ts`、`edge/createEdgeReadDomain.ts`。
6. 已新增 `node/createNodeModel.ts`、`node/createNodeView.ts`、`node/createNodeReadDomain.ts`。
7. 已新增 `mindmap/createMindmapModel.ts`、`mindmap/createMindmapDerivations.ts`、`mindmap/createMindmapView.ts`、`mindmap/createMindmapReadDomain.ts`。
8. `createReadStore.ts` 已切换为 `edgeDomain + nodeDomain + mindmapDomain` 组合；旧 `store/edgeView.ts`、`store/nodeView.ts`、`store/mindmapView.ts`、`cache/edgePath/createEdgePathStore.ts` 与空目录 `runtime/read/cache` 已删除。

---

## 1. 现状问题（简述）

1. `createReadStore.ts` 同时承载了 node/edge/mindmap 三个领域的 model + view 逻辑，文件职责过宽。
2. `createEdgeView` 之前出现过多 getter 注入，虽然已收敛，但整体链路仍然是“装配层拼细节”。
3. `read` 侧目前是“按文件类型分层（store/cache）”而非“按领域分层（node/edge/mindmap）”，导致阅读跳转频繁。

关键文件：
- [createReadStore.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/createReadStore.ts)
- [createEdgeReadDomain.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/edge/createEdgeReadDomain.ts)
- [createEdgeModel.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/edge/createEdgeModel.ts)
- [createNodeReadDomain.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/node/createNodeReadDomain.ts)
- [createMindmapReadDomain.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/mindmap/createMindmapReadDomain.ts)
- [createMindmapDerivations.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/runtime/read/mindmap/createMindmapDerivations.ts)

---

## 2. 目标模式（推荐）

采用“领域读组件（Read Domain）”模式：

1. 每个领域一个入口工厂：`createXxxReadDomain`。
2. 每个 domain 内部自包含：
- model（缓存/失效/索引）
- view（atoms）
- revision（本域变更触发）
3. `createReadStore` 只做组合，不承载领域细节。

推荐命名（比 `EdgeManager` 更语义化）：
1. `createEdgeReadDomain`
2. `createNodeReadDomain`
3. `createMindmapReadDomain`

---

## 3. 目录重排（目标结构）

```text
packages/whiteboard-engine/src/runtime/read/
  createReadRuntime.ts
  createReadStore.ts

  edge/
    createEdgeModel.ts
    createEdgeView.ts
    createEdgeReadDomain.ts

  node/
    createNodeModel.ts
    createNodeView.ts
    createNodeReadDomain.ts

  mindmap/
    createMindmapModel.ts
    createMindmapView.ts
    createMindmapReadDomain.ts

  index/
    createIndex.ts
    createIndexStore.ts
    NodeRectIndex.ts
    SnapIndex.ts

  query/
    canvas.ts
    config.ts
    document.ts
    geometry.ts
    snap.ts
    viewport.ts

  atoms/
    createReadAtoms.ts
    nodes.ts
    edges.ts
    indexes.ts
    snapshot.ts
    shared.ts
```

说明：
1. 旧 `store/*` 与 `cache/*` 的领域文件已迁移到对应 domain 目录。
2. `query/index/atoms` 维持不动（它们是共享基础层，不是具体 domain）。

---

## 4. Domain 接口草案

统一约定：

```ts
export type ReadDomainApply = {
  applyChange: (change: Change) => void
}
```

### Edge Domain

```ts
export type EdgeReadDomain = ReadDomainApply & {
  atoms: {
    edgeIds: Atom<EdgeId[]>
    edgeById: (id: EdgeId) => Atom<EdgePathEntry | undefined>
    selectedEdgeId: Atom<EdgeId | undefined>
    edgeSelectedEndpoints: Atom<EdgeEndpoints | undefined>
  }
  get: {
    edgeIds: () => EdgeId[]
    edgeById: (id: EdgeId) => EdgePathEntry | undefined
    edgeSelectedEndpoints: () => EdgeEndpoints | undefined
  }
}
```

### Node Domain

```ts
export type NodeReadDomain = ReadDomainApply & {
  atoms: {
    viewportTransform: Atom<ViewportTransformView>
    nodeIds: Atom<NodeId[]>
    nodeById: (id: NodeId) => Atom<NodeViewItem | undefined>
  }
  get: {
    nodeIds: () => NodeId[]
    nodeById: (id: NodeId) => NodeViewItem | undefined
  }
}
```

### Mindmap Domain

```ts
export type MindmapReadDomain = ReadDomainApply & {
  atoms: {
    mindmapIds: Atom<NodeId[]>
    mindmapById: (id: NodeId) => Atom<MindmapViewTree | undefined>
  }
  get: {
    mindmapIds: () => NodeId[]
    mindmapById: (id: NodeId) => MindmapViewTree | undefined
  }
}
```

设计约束：
1. domain 之间不直接互调。
2. domain 不依赖 `Query` 全对象，只注入最小必需能力（如 `getNodeRect`）。
3. 每个 domain 内部维护自己的 revision atom，不外泄实现细节。

---

## 5. createReadStore 简化目标

`createReadStore` 最终只做三件事：

1. 创建 domain：
- `const edge = createEdgeReadDomain(...)`
- `const node = createNodeReadDomain(...)`
- `const mindmap = createMindmapReadDomain(...)`

2. 组合 atoms/get：
- `atoms = { ...stateAtomsSemantics, ...node.atoms, ...edge.atoms, ...mindmap.atoms }`
- `read.get` 直接代理 domain get。

3. 分发 change：
- `edge.applyChange(change)`
- `node.applyChange(change)`（若无需求可 no-op）
- `mindmap.applyChange(change)`（仅需时实现）

这样 `createReadStore.ts` 会从“实现文件”降级为“编排文件”。

---

## 6. 实施步骤（最小风险）

阶段 1：Edge 先行（推荐）
1. 新增 `edge/createEdgeModel.ts`（由现 `cache/edgePath/createEdgePathStore.ts` 迁移）。
2. 新增 `edge/createEdgeView.ts`（由现 `store/edgeView.ts` 迁移）。
3. 新增 `edge/createEdgeReadDomain.ts`（封装 model+view+revision+applyChange）。
4. `createReadStore.ts` 仅切换 edge 到新 domain，node/mindmap 暂保持原样。

阶段 2：Node 迁移（已完成）
1. 从 `createReadStore.ts` 抽出 nodeIds 缓存与 nodeView 为 `node domain`。
2. `createReadStore.ts` 删除 node 细节。

阶段 3：Mindmap 迁移（已完成）
1. 从 `createReadStore.ts` 抽出 `mindmapDerivations + view cache + mindmapView`。
2. `createReadStore.ts` 删除 mindmap 细节。

阶段 4：清理（已完成）
1. 删除 `runtime/read/store/*` 与 `runtime/read/cache/*` 中已迁移的旧文件。
2. 修正 import/export，保持外部 API 不变。

---

## 7. 验收标准

1. `createReadStore.ts` 仅包含装配逻辑，不包含领域算法实现。
2. `edge/node/mindmap` 各域都能在各自目录内自解释。
3. `createEdgeView` 仅依赖 `edge domain`（不再依赖几何查询函数或散 getter）。
4. 行为不变：
- edge path 与 endpoint 展示一致
- node/mindmap 读视图一致
- write -> read applyChange 时序一致
5. 构建验证：
- `pnpm --filter @whiteboard/engine lint && pnpm --filter @whiteboard/engine build`
- `pnpm --filter @whiteboard/react lint && pnpm --filter @whiteboard/react build`

---

## 8. 命名建议（最终统一）

1. 统一使用 `Domain`，不使用 `Manager`。
2. 统一使用 `Model` 表示缓存与失效逻辑。
3. 统一使用 `View` 表示 atom 组合层。
4. 统一使用 `createXxxReadDomain` 作为领域入口。

建议命名：
1. `createEdgeReadDomain`
2. `createNodeReadDomain`
3. `createMindmapReadDomain`
