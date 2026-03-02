# Read Atoms 循环优化研究与结论

## 背景
你关心的问题是：`runtime/read/atoms/nodes.ts` 与 `runtime/read/atoms/indexes.ts` 在同一条数据链路上可能存在重复循环（尤其是 `nodes -> canvas -> map`），是否能通过“统一 sub atom”实现单次计算、下游复用。

本次目标：
1. 优化 `nodes.ts`、`indexes.ts`，减少重复循环。
2. 研究其他 atoms 是否存在类似问题。
3. 给出后续优化优先级建议。

---

## 状态更新（第二轮已落地）

在第一轮 `nodeSlices + indexes` 收敛后，本轮又继续落地了三项优化：

1. `runtime/read/node/atoms.ts`
- 去掉 `nodeIdsAtom` 里对 snapshot 的二次读取（原来 `get(readSnapshotAtom)` 后又 `context.get(snapshot)`）。
- 新增并使用 core 的 `toLayerOrderedCanvasNodeIds`，避免 `toLayerOrderedCanvasNodes(...).map(...)` 的额外映射遍历。

2. `runtime/read/mindmap/projection.ts`
- `trees -> view` 从“两次遍历（ids + byId）”改为“一次遍历同时填充 ids 与 byId”。

3. `runtime/read/atoms/edges.ts` + `@whiteboard/core/node/readModel.ts`
- `deriveVisibleEdges` 支持不传 `edgeOrder`，不再在调用侧做 `doc.edges.map(edge => edge.id)` 的兜底构建。
- `orderByIds` 支持可选 `ids`，在无 order 时直接返回原数组，避免无意义处理。

---

## 状态更新（第三轮已落地）

本轮继续把 `nodes -> visible -> canvas -> indexes` 的派生链路向“单次派生”收敛，核心变化如下：

1. `@whiteboard/core/node/readModel.ts`
- 新增 `deriveNodeReadSlices(nodes, nodeOrder?)`，一次返回：
  - `ordered`
  - `visible`
  - `canvas`
  - `canvasNodeById`
- 逻辑上将“可见性判定 + canvas 筛选 + byId 索引构建”合并在同一派生流程中，减少中间态重复循环。

2. `runtime/read/atoms/nodes.ts`
- 从原先 `orderByIds -> deriveVisibleNodes -> deriveCanvasNodes -> Map 构建` 的分段链路，改为直接消费 `deriveNodeReadSlices`。
- 保留引用稳定策略：对 `ordered/visible/canvas/canvasNodeById` 做等价复用判断，仅在语义变化时替换缓存引用。

3. `runtime/read/atoms/shared.ts`
- 新增 `isSameNodeMap`，用于 `canvasNodeById` 的等价判断，避免在 `canvas` 变化但映射不变时无意义替换 `Map` 引用。

4. `@whiteboard/core/node/index.ts`
- 导出 `deriveNodeReadSlices` 与 `NodeReadSlices`，统一下沉到 core 作为可复用算法能力。

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

4. `nodes` 主链路派生环节进一步收敛。
- 之前是“多个分段派生 + 多次中间数组处理”。
- 现在是“单次 core 派生 + engine 侧引用复用”，结构更集中，可读性更高。

---

## 其他 atoms 的同类问题研究

### A. `runtime/read/node/atoms.ts`（已落地）
文件：`packages/whiteboard-engine/src/runtime/read/node/atoms.ts`

现状：
- `nodeIds` 每次 `snapshot.nodes.canvas` 变化时会执行 `toLayerOrderedCanvasNodes(...).map(...)`。

问题类型：
- 与本次同类：对同一源数组进行“再次全量映射”。

结论：
- 已落地：通过 core 新增 `toLayerOrderedCanvasNodeIds`，避免额外 `map`。
- 已落地：去掉 snapshot 的二次读取。

优先级：已完成。

### B. `runtime/read/atoms/edges.ts`（已落地）
文件：`packages/whiteboard-engine/src/runtime/read/atoms/edges.ts`

现状：
- 当 `edgeOrderRef` 缺失时，会执行 `doc.edges.map((edge) => edge.id)` 作为兜底顺序。

问题类型：
- 额外一次 `edges` 扫描（通常可接受，但在大数据量会放大）。

结论：
- 已落地：调用侧去除 fallback `doc.edges.map(...)`。
- 已落地：core `deriveVisibleEdges/orderByIds` 支持无 order 快路径。

优先级：已完成。

### C. `runtime/read/mindmap/projection.ts`（已落地）
文件：`packages/whiteboard-engine/src/runtime/read/mindmap/projection.ts`

现状：
- `trees` 转 `view` 时做两次遍历：一次 `ids`，一次 `byId`。

问题类型：
- 同一输入集合两次循环。

结论：
- 已落地：改为单次循环填充 `ids + byId`。

优先级：已完成。

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
3. 第二轮已继续完成 `node/atoms.ts`、`mindmap/projection.ts`、`atoms/edges.ts + core/readModel` 的循环收敛。
4. 第三轮继续把 `nodes` 主链路改为“core 单次派生”，并在 engine 侧保持强引用稳定缓存。
5. 当前剩余更值得关注的是 `mindmap/cache.ts` 的签名命中与布局缓存策略，而不是小粒度循环优化。

---

## 验证

已通过：
- `pnpm -C packages/whiteboard-core lint`
- `pnpm -C packages/whiteboard-engine lint`
- `pnpm -C packages/whiteboard-react lint`
