# Whiteboard Cache & Projection Refactor Plan

## 1. 目标

- 在不改变对外 API 的前提下，降低 `runtime/query`、`runtime/projection`、`runtime/view` 的内部复杂度。
- 优先消除“增量路径里隐藏全量计算”的问题，避免性能意外回退。
- 保持功能行为稳定：交互、渲染结果、选择态、连线预览一致。

## 2. 非目标

- 不做大规模架构切换（例如整体改状态机或事件总线）。
- 不重写所有缓存模块，只处理高复杂度热点链路。
- 不引入兼容层或双实现长期并存。

## 3. 复杂度热点（当前）

1. `projection.readNode` 在 dirty 循环中可能重复触发全量缓存读取。  
文件：`packages/whiteboard-engine/src/runtime/projection/Store.ts`

2. `EdgePath` 同时持有多份状态并在一个模块内混合“失效标记 + 索引维护 + 路径重建 + preview 计算”。  
文件：`packages/whiteboard-engine/src/runtime/query/EdgePath.ts`

3. `dirtyNodeIds` 来源分散（上游 impact 与 projection cache 双轨），语义可追踪性差。  
文件：`packages/whiteboard-engine/src/runtime/projection/Store.ts`、`packages/whiteboard-engine/src/runtime/projection/cache/ViewNodesState.ts`

4. query 索引同步入口分散，`ensureIndexesSynced` 在多子模块重复触发。  
文件：`packages/whiteboard-engine/src/runtime/query/Store.ts`

## 4. 设计原则（低风险版）

- 单一事实源：同一类变化只保留一个主来源（优先缓存层输出真实 changed set）。
- 单向链路：`mutation -> projection -> query/view`，禁止 query 层反向驱动 projection。
- API 不变：对外保持 `instance.query` / `instance.view` 现有签名。
- 小步重构：每一步都可独立构建与回归验证。

## 5. 目标结构

### 5.1 Projection 层

- `ProjectionStore` 负责：
- 持有当前快照引用。
- 输出标准化 `ProjectionChange`。
- 暴露 O(1) `readNodeFromSnapshot`（不触发全量读）。

- `ProjectionCache` 负责：
- 根据 doc 构建快照。
- 输出真实 changed sets（例如 `changedNodeIds`）。

### 5.2 Query 层（EdgePath）

- 拆成 4 个内部职责（对外仍由 `EdgePathQuery` 暴露）：
- `EdgePathInvalidation`：记录 full/dirty 失效标记。
- `EdgePathIndex`：维护 `edgeById` / `nodeToEdgeIds`。
- `EdgePathCache`：维护路径条目缓存。
- `EdgePathPreview`：reconnect/preview 临时计算，不污染主缓存。

### 5.3 View 层

- 保持当前 `NodeGraphIndex + NodeProjectionCache` 结构。
- 不再新增 state 同步职责回流到 NodeRegistry。
- 只消费 projection 结果，不重复推导 dirty 语义。

## 6. 分阶段实施

## Phase A：基线与护栏（先做）

- 基线采样：
- 大图操作（拖拽、框选、连线拖拽、缩放）帧耗时。
- 关键路径调用次数（`ProjectionCache.read`、`projection.readNode`、`EdgePath.ensureEntries`）。

- 护栏：
- 保持现有 `pnpm -r -F @whiteboard/core -F @whiteboard/engine -F @whiteboard/react build` 通过。
- 复用 `packages/whiteboard-engine/src/perf/dragFrame.bench.ts` 做回归对比。

交付：一份基线记录（可写入 PR 描述或文档附录）。

## Phase B：收敛 Projection 读路径（低风险高收益）

- 改造点：
- `ProjectionStore.readNode` 改为读取当前快照 map，不再触发全量 `cache.read`。
- `ProjectionStore.sync` 后更新快照引用，dirty 循环只读快照。

- 预期收益：
- 消除 dirty 循环里的隐式全量计算。
- 降低复杂度与性能波动风险。

- 风险控制：
- 仅内部实现变更，不改 `ProjectionStore` 对外方法签名。

## Phase C：统一 dirty 来源（语义收敛）

- 改造点：
- `ProjectionCache/ViewNodesState` 输出真实 `changedNodeIds` 给 `ProjectionStore`。
- 上游 analyzer 的 `dirtyNodeIds` 作为 hint，不再作为唯一真相。

- 预期收益：
- `full/partial/dirty/order` 语义更稳定，调试更可追踪。
- 降低“分析器漏标 vs 缓存实际变化”不一致风险。

- 风险控制：
- 优先采用“merge 策略”：`realChanged ∪ hintDirty`，稳定后再收敛到单源。

## Phase D：拆分 EdgePath 内部职责（中风险，显著降复杂）

- 改造点：
- 拆分 `EdgePath.ts` 为内部子模块：
- `edgePath/Invalidation.ts`
- `edgePath/Index.ts`
- `edgePath/Cache.ts`
- `edgePath/Preview.ts`
- `edgePath/Query.ts`（对外门面）

- 行为约束：
- `syncProjection` 只做失效与索引更新。
- `ensureEntries` 只做缓存重建。
- reconnect preview 不写入主缓存。

- 预期收益：
- 缓存生命周期清晰，降低心智负担。
- 单元可测性显著提升。

## Phase E：query 同步入口收口（可选）

- 改造点：
- 在 `createQueryRuntime` 层集中一次 `syncIfStale`。
- `canvas/snap` 子查询仅做读，不再各自触发同步判断。

- 预期收益：
- 减少重复同步与重复读。
- query 层职责更清晰。

## 7. 验收标准

- 功能一致：
- 节点增删改、顺序变化、框选、拖拽、缩放、边连接与重连预览行为无变化。

- 性能不回退（目标）：
- `dragFrame` 基准在可接受浮动内（建议阈值：`±3%`）。
- 大图场景下 `ProjectionCache.read` 次数显著下降（尤其 dirty 批次）。

- 复杂度下降（可量化）：
- `EdgePath.ts` 单文件职责拆分，核心文件行数明显下降。
- `ProjectionStore` 读路径可在 1-2 步内追踪。

## 8. 文件级实施清单

- Projection：
- `packages/whiteboard-engine/src/runtime/projection/Store.ts`
- `packages/whiteboard-engine/src/runtime/projection/cache/ProjectionCache.ts`
- `packages/whiteboard-engine/src/runtime/projection/cache/ViewNodesState.ts`

- Query：
- `packages/whiteboard-engine/src/runtime/query/EdgePath.ts`（拆分）
- `packages/whiteboard-engine/src/runtime/query/Store.ts`

- View（少量联动验证）：
- `packages/whiteboard-engine/src/runtime/view/NodeRegistry.ts`
- `packages/whiteboard-engine/src/runtime/view/Registry.ts`

## 9. 推荐落地顺序（最小风险）

1. Phase B（Projection 读路径）  
2. Phase C（dirty 来源统一）  
3. Phase D（EdgePath 拆分）  
4. Phase E（query 同步入口收口，可选）

这个顺序可以先拿到性能稳定收益，再做结构性降复杂，避免一次改太多导致定位困难。

