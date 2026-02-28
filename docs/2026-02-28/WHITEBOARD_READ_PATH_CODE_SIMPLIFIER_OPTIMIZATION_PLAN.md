# Whiteboard Read 路径简化与命名优化方案（直白命名版）

更新时间：2026-02-28

适用范围：
- `packages/whiteboard-engine/src/instance/create.ts`
- `packages/whiteboard-engine/src/runtime/read/**`

策略：
1. 先统一命名，再做拆分。
2. 一步到位，不保留兼容别名或双路径。
3. 保持行为不变（只做可读性和结构优化）。

已落地（本轮）：
1. `QueryIndexRuntime.ts` -> `createIndex.ts`
2. `QueryIndexes.ts` -> `createIndexStore.ts`
3. `MaterializedModel.ts` -> `createCache.ts`（后续已并入 `createReadStore.ts`）
4. `MutationMetaBus.ts` -> `ChangeBus.ts`
5. 写管线总线类型已统一为 `ChangeBus/Change`
6. 读写桥接已统一为 `changeBus.subscribe -> readRuntime.applyChange`
7. 目录迁移：`runtime/read/api/**` -> `runtime/read/query/**`
8. 目录迁移：`runtime/read/indexes/**` -> `runtime/read/index/**`
9. 目录迁移：`runtime/read/materialized/**` -> `runtime/read/cache/**`
10. `runtime/read/runtime/createReadRuntime.ts` 已上提为 `runtime/read/createReadRuntime.ts`
11. 以上改动均已通过 `@whiteboard/engine` 与 `@whiteboard/react` 的 lint + build
12. 索引拆分：`createIndexStore.ts` 已拆为 `NodeRectIndex.ts` + `SnapIndex.ts` + `createIndexStore.ts`（工厂）
13. atoms 拆分：`readModel.ts` 已拆为 `shared.ts` + `nodes.ts` + `edges.ts` + `indexes.ts` + `snapshot.ts` + `createReadAtoms.ts`
14. 命名收敛：`createReadModelAtoms` -> `createReadAtoms`，`ReadModelAtoms` -> `ReadAtoms`
15. 读 store 命名收敛：`Runtime.ts` -> `createReadStore.ts`，`createReadModelRuntime` -> `createReadStore`
16. query 文件命名统一：`Runtime/Canvas/...` -> `query/canvas/...`（小写语义名）
17. read store 拆分：`createReadStore.ts` 已拆出 `store/nodeView.ts`、`store/edgeView.ts`、`store/mindmapView.ts`
18. cache 文件命名统一：`cache/mindmap/Derivations.ts` -> `cache/mindmapTrees.ts`
19. `resolveEndpoints` 算法已下沉到 `@whiteboard/core/edge/resolveEdgeEndpoints`
20. `cache/edgePath` 已去中间层：删除 `Cache/Index/Invalidation/types`，收敛为单文件 `createEdgePathStore.ts`
21. 纯计算下沉：新增 `@whiteboard/core/edge/resolveEdgePathFromRects`，统一端点+路径计算
22. `edgePath` 关系索引纯函数下沉到 `@whiteboard/core/edge/relations.ts`（`createEdgeRelations`、`collectRelatedEdgeIds`）
23. 删除 `cache/edgeEndpoints.ts` 转发层，`store/edgeView.ts` 直接用 core `resolveEdgeEndpoints` + `getNodeRect`
24. 删除 `query/createQueryRuntime.ts` 聚合层：`createReadRuntime.ts` 直接装配 `index + query`
25. 删除 `cache/createCache.ts` 聚合层：`createReadStore.ts` 直接持有 `edgePath/mindmap/nodeIds` 读侧缓存
26. `createEdgeView` 依赖收敛：不再传 `getNodeRect` / 多个 edge getter，改为 `selectionAtom + edgeRevisionAtom + edgeModel`
27. `edgePath` 缓存升级：一次计算同时缓存 `path + endpoints`，`edgeSelectedEndpoints` 直接读 `edgeModel.getEndpoints`
28. Edge 领域组件化（阶段 1）：新增 `edge/createEdgeModel.ts`、`edge/createEdgeView.ts`、`edge/createEdgeReadDomain.ts`
29. `createReadStore.ts` 已切换为 `edgeDomain` 组合，不再内联 edge revision 与 edge applyChange 细节
30. 删除旧 edge 文件：`store/edgeView.ts`、`cache/edgePath/createEdgePathStore.ts`
31. Node 领域组件化（阶段 2）：新增 `node/createNodeModel.ts`、`node/createNodeView.ts`、`node/createNodeReadDomain.ts`
32. `createReadStore.ts` 已切换为 `nodeDomain` 组合，不再内联 nodeIds 缓存与 node view 细节
33. 删除旧 node 文件：`store/nodeView.ts`
34. Mindmap 领域组件化（阶段 3）：新增 `mindmap/createMindmapModel.ts`、`mindmap/createMindmapView.ts`、`mindmap/createMindmapReadDomain.ts`
35. `createReadStore.ts` 已切换为 `mindmapDomain` 组合，不再内联 mindmapDerivations 与 mindmap view cache
36. 删除旧 mindmap 文件：`store/mindmapView.ts`，并清理空目录 `runtime/read/store`
37. 阶段 4 清理收口：`cache/mindmapTrees.ts` 已迁移为 `mindmap/createMindmapDerivations.ts`，并删除空目录 `runtime/read/cache`

---

## 1. 命名总规则（本次强制）

命名目标：最常见、最短、最容易理解。

1. `materialized` 一律改为 `cache`。
2. `mutationMetaBus` 一律改为 `changeBus`。
3. `MutationMeta` 一律改为 `Change`。
4. `applyMutation` 一律改为 `applyChange`。
5. `ReadModel*` 一律简化为 `Read*`。
6. `QueryIndexes` 一律简化为 `IndexStore`。
7. `QueryIndexRuntime` 一律简化为 `IndexRuntime`。
8. 目录已提供语义时，工厂函数用最短常见名（如 `createIndex`、`createCache`）。

---

## 2. 旧名 -> 新名对照表（全局统一）

1. `ReadModelSnapshot` -> `ReadSnapshot`
2. `ReadModelAtoms` -> `ReadAtoms`
3. `createReadModelAtoms` -> `createReadAtoms`
4. `createReadModelRuntime` -> `createReadStore`
5. `MaterializedModel` -> `ReadCache`
6. `createMaterializedReadModel` -> `createCache`
7. `materializedRevisionAtom` -> `cacheRevisionAtom`
8. `MutationMeta` -> `Change`
9. `MutationMetaBus` -> `ChangeBus`
10. `mutationMetaBus` -> `changeBus`
11. `applyMutation` -> `applyChange`
12. `QueryIndexes` -> `IndexStore`
13. `createQueryIndexes` -> `createIndexStore`
14. `QueryIndexRuntime` -> `IndexRuntime`
15. `createQueryIndexRuntime` -> `createIndex`

说明：
1. 本表用于代码、文件、类型、变量、文档统一替换。
2. 若存在缩写冲突，优先保证语义直白（例如保留 `ReadCache` 而不是 `RC`）。

---

## 3. 从 create.ts 看当前读链路

当前读链路（语义上）是：

1. `createState + createReadAtoms`
2. `createReadRuntime`
3. `createReadRuntime` 内部：
   - query 分支（查询 API + 索引）
   - domain 分支（node/edge/mindmap 读组件）
4. write 提交后：`changeBus.subscribe -> readRuntime.applyChange`

问题：
1. 命名不统一，理解门槛高（尤其是 `materialized`、`mutationMetaBus`）。
2. `Runtime.ts` 同名文件过多，搜索困难。
3. 多处单文件目录影响浏览效率。

---

## 4. 目标目录（按直白命名）

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
    createMindmapDerivations.ts
    createMindmapView.ts
    createMindmapReadDomain.ts

  atoms/
    createReadAtoms.ts
    nodes.ts
    edges.ts
    indexes.ts
    snapshot.ts
    shared.ts

  query/
    canvas.ts
    config.ts
    document.ts
    geometry.ts
    snap.ts
    viewport.ts

  index/
    createIndex.ts
    createIndexStore.ts
    NodeRectIndex.ts
    SnapIndex.ts

```

说明：
1. `edge/node/mindmap` 表示按领域聚合的 read 组件（model + view + applyChange）。
2. `query` 表示外部读取 API 侧。
3. `index` 表示查询索引侧。
4. 原 `cache` 语义已内收进各领域目录（不再保留独立 `runtime/read/cache` 目录）。

---

## 5. 文件迁移清单（建议）

1. `runtime/read/runtime/createReadRuntime.ts` -> `runtime/read/createReadRuntime.ts`
2. `runtime/read/Runtime.ts` -> `runtime/read/createReadStore.ts`
3. `runtime/read/atoms/readModel.ts` -> `runtime/read/atoms/createReadAtoms.ts`（并拆分为多文件）
4. `runtime/read/api/Runtime.ts` -> `runtime/read/createReadRuntime.ts`（并入 read 总装配）
5. `runtime/read/api/Canvas.ts` -> `runtime/read/query/canvas.ts`
6. `runtime/read/api/Config.ts` -> `runtime/read/query/config.ts`
7. `runtime/read/api/Document.ts` -> `runtime/read/query/document.ts`
8. `runtime/read/api/Geometry.ts` -> `runtime/read/query/geometry.ts`
9. `runtime/read/api/Snap.ts` -> `runtime/read/query/snap.ts`
10. `runtime/read/api/Viewport.ts` -> `runtime/read/query/viewport.ts`
11. `runtime/read/indexes/QueryIndexRuntime.ts` -> `runtime/read/index/createIndex.ts`
12. `runtime/read/indexes/QueryIndexes.ts` -> `runtime/read/index/createIndexStore.ts`
13. `runtime/read/materialized/MaterializedModel.ts` -> `runtime/read/createReadStore.ts`（并入 read store）
14. `runtime/read/materialized/mindmap/Derivations.ts` -> `runtime/read/mindmap/createMindmapDerivations.ts`

---

## 6. 分项优化建议（问题 -> 修改 -> 收益 -> 风险 -> 验证）

## 建议 A：先统一命名，再拆文件

- 问题：同一语义在不同文件使用不同词（model/materialized/meta）。
- 修改：先执行“旧名 -> 新名对照表”全量替换，再做代码拆分。
- 收益：后续拆分不会重复改名，review 成本更低。
- 风险：一次改名量大，容易漏路径。
- 验证：`rg "MutationMetaBus|MutationMeta\\b|QueryIndexes|createQueryIndexes|QueryIndexRuntime|MaterializedModel"` 结果为 0。

## 建议 B：消除 Runtime 同名冲突

- 问题：`Runtime.ts` 多层重名，阅读与检索成本高。
- 修改：统一改为 `createXxxRuntime.ts` 或 `createXxxStore.ts`。
- 收益：文件名即职责。
- 风险：import 大范围改动。
- 验证：`rg "/Runtime\.ts" runtime/read` 仅保留明确单点。

## 建议 C：拆分超长索引文件

- 问题：`createIndexStore.ts`（400+ 行）同时包含 `NodeRectIndex`、`SnapIndex` 和工厂。
- 修改：拆为 `NodeRectIndex.ts`、`SnapIndex.ts`、`createIndexStore.ts`。
- 收益：索引调优路径更短。
- 风险：拆分时序错误导致索引不一致。
- 验证：`sync/syncByNodeIds` 回归 + 拖拽吸附回归。

## 建议 D：拆分超长 atoms 文件

- 问题：旧版 `readModel.ts`（396 行）承担了多阶段派生。
- 修改：拆为：
  1. `nodes.ts`
  2. `edges.ts`
  3. `indexes.ts`
  4. `snapshot.ts`
  5. `createReadAtoms.ts`（装配）
- 收益：派生链路可视化，定位更快。
- 风险：可能引入循环依赖。
- 验证：`createReadAtoms` 输出结构与旧版完全一致。

## 建议 E：`create.ts` 桥接命名统一

- 问题：历史命名 `mutationMetaBus.subscribe` 语义晦涩。
- 修改：统一为 `changeBus.subscribe`，回调统一命名 `applyReadChange`。
- 收益：读写桥接语义直观。
- 风险：遗漏解绑。
- 验证：dispose 后 listener 清零（单测或内存检查）。

---

## 7. 实施顺序（建议）

阶段 1（低风险，纯命名）：
1. 按“旧名 -> 新名”做类型/变量/函数替换。
2. 全量修复 import。
状态：已完成。

阶段 2（中风险，目录迁移）：
1. 迁移 `api -> query`、`indexes -> index`、`materialized -> cache`。
2. 清理单文件目录。
状态：目录迁移已完成；文件细粒度改名与目录精简继续在阶段 3 处理。

阶段 3（中风险，文件拆分）：
1. 拆 `createIndexStore.ts`。
2. 拆 `createReadAtoms.ts`。
3. 拆 `createReadStore.ts`。
状态：已完成第一轮拆分（index/atoms/store 主体已拆，query 命名已统一为小写语义名），后续只剩按需进一步下钻。

阶段 4（回归）：
1. `pnpm --filter @whiteboard/engine lint && build`
2. `pnpm --filter @whiteboard/react lint && build`
3. 关键交互回归：node drag、snap、edge routing、mindmap drag。

---

## 8. 验收标准

1. 代码中不再出现 `materialized`、`mutationMetaBus` 术语。
2. `runtime/read` 不再出现多层 `Runtime.ts` 重名冲突。
3. `runtime/read` 下单文件目录清理完成（`edgePath` 可保留）。
4. 读链路行为不变：
   - query 返回一致
   - atoms 输出一致
   - `change -> read.applyChange` 时序一致
5. engine/react lint+build 全通过。

---

## 9. 与 engine/react 分层一致性

本方案仅做“可读性 + 命名 + 目录”优化，不改变分层：

1. engine 继续负责：读计算、索引、缓存、提交后同步。
2. react 继续负责：UI 组合与交互会话。
3. 不新增第二写入路径，不新增兼容层。
