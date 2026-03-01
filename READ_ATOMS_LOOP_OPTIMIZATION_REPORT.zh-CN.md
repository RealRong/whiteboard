# Read Atoms 循环优化研究与结论

## 背景
你关心的问题是：`runtime/read/atoms/nodes.ts` 与 `runtime/read/atoms/indexes.ts` 在同一条数据链路上可能存在重复循环（尤其是 `nodes -> canvas -> map`），是否能通过“统一 sub atom”实现单次计算、下游复用。

本次目标：
1. 优化 `nodes.ts`、`indexes.ts`，减少重复循环。
2. 研究其他 atoms 是否存在类似问题。
3. 给出后续优化优先级建议。

---

## 已落地优化

### 1) 引入统一子 atom：`nodeSlices`
文件：`packages/whiteboard-engine/src/runtime/read/atoms/nodes.ts`

新增 `nodeSlices(documentAtom)`，统一产出：
- `ordered`
- `visible`
- `canvas`
- `canvasNodeById`

并在同一个缓存上下文内维护引用稳定。

### 2) `indexes` 改为消费 `nodeSlices`
文件：`packages/whiteboard-engine/src/runtime/read/atoms/indexes.ts`

`indexes(...)` 不再从 `canvasNodes` 二次构建 `Map`，直接复用 `nodeSlices.canvasNodeById`，并在 `canvasNodeById` 引用不变时复用 `indexesCache`。

### 3) 入口组合改造
文件：`packages/whiteboard-engine/src/runtime/read/atoms/index.ts`

由原来的链式：
- `orderedNodes(documentAtom)`
- `visibleNodes(orderedNodesAtom)`
- `canvasNodes(visibleNodesAtom)`
- `indexes(canvasNodesAtom)`

改为：
- `nodeSlices(documentAtom)`
- `orderedNodes(nodeSlicesAtom)`
- `visibleNodes(nodeSlicesAtom)`
- `canvasNodes(nodeSlicesAtom)`
- `indexes(nodeSlicesAtom)`

即：上游集中算一次，下游选择性读取切片。

---

## 本次优化带来的效果

1. `canvas -> canvasNodeById` 不再重复扫描。
- 之前：`canvasNodes` 在 `nodes.ts` 生成后，`indexes.ts` 再次 `canvasNodes.map(...)` 构建 `Map`。
- 现在：`canvasNodeById` 在 `nodeSlices` 内部一次生成，`indexes` 仅复用。

2. 切片读取路径更清晰。
- 下游不再依赖“层层 atom 管道”，而是依赖“统一模型切片”。

3. 引用稳定性更强。
- `nodeSlices` 与 `indexes` 都有缓存对象复用逻辑，减少无意义对象分配。

---

## 其他 atoms 的同类问题研究

### A. `runtime/read/node/atoms.ts`
文件：`packages/whiteboard-engine/src/runtime/read/node/atoms.ts`

现状：
- `nodeIds` 每次 `snapshot.nodes.canvas` 变化时会执行 `toLayerOrderedCanvasNodes(...).map(...)`。

问题类型：
- 与本次同类：对同一源数组进行“再次全量映射”。

建议：
- 可考虑把 `layerOrderedNodeIds` 下沉到 read 基础层（如 `nodeSlices` 或 snapshot 扩展字段）统一产出。

优先级：中。

### B. `runtime/read/atoms/edges.ts`
文件：`packages/whiteboard-engine/src/runtime/read/atoms/edges.ts`

现状：
- 当 `edgeOrderRef` 缺失时，会执行 `doc.edges.map((edge) => edge.id)` 作为兜底顺序。

问题类型：
- 额外一次 `edges` 扫描（通常可接受，但在大数据量会放大）。

建议：
- 可在上游维护稳定 `edgeOrderIds` 视图，避免 fallback map。

优先级：中低。

### C. `runtime/read/mindmap/projection.ts`
文件：`packages/whiteboard-engine/src/runtime/read/mindmap/projection.ts`

现状：
- `trees` 转 `view` 时做两次遍历：一次 `ids`，一次 `byId`。

问题类型：
- 同一输入集合两次循环。

建议：
- 一次循环同时填充 `ids` + `byId`。

优先级：中。

### D. `runtime/read/mindmap/cache.ts`
文件：`packages/whiteboard-engine/src/runtime/read/mindmap/cache.ts`

现状：
- `Object.entries(tree.nodes).map(...)` 每个 root 会构造 labels。
- 计算路径本身较重（layout + lines + labels）。

问题类型：
- 计算重心在布局算法，循环本身不是主要瓶颈。

建议：
- 更应优先优化签名命中率与 layout 缓存策略，而非微观循环。

优先级：中低（偏策略优化）。

### E. `runtime/read/edge/atoms.ts`
文件：`packages/whiteboard-engine/src/runtime/read/edge/atoms.ts`

现状：
- `edgeIds/edgeById/edgeSelectedEndpoints` 各自读取 `cache.getSnapshot()`。

问题类型：
- 看起来是重复读，但 `edge cache` 已用 `ensureEntries` + 引用稳定保障，重复代价较小。

建议：
- 保持现状，除非 profiling 证明此处热点明显。

优先级：低。

---

## 结论

1. 你的判断是对的：通过统一 sub atom 可以把“同一源数据的重复遍历”收敛掉。
2. 本次 `nodeSlices` + `indexes` 改造已经落地并实现该目标。
3. 同类问题还存在于 `node/atoms.ts`（`nodeIds`）与 `mindmap/projection.ts`（双遍历），可作为下一批优化目标。
4. `mindmap/cache.ts` 与 `edge/atoms.ts` 更建议基于 profiling 决定，避免过早微优化。

---

## 验证

已通过：
- `pnpm -C packages/whiteboard-engine lint`
- `pnpm -C packages/whiteboard-react lint`

