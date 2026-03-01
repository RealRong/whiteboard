# Whiteboard Edge Cache Data-Driven 优化方案（重写版）

## 1. 目标与结论

本文档替代此前“显式版本表”主方案，采用更低复杂度、纯 data-driven 的优化路径。

最终结论：

1. 不把“显式版本表（指令驱动）”作为主路径。
2. 保留当前 read 架构与对外 API，不改 `EdgeReadCache` 形状。
3. 通过“引用门控 + 结构比较 + 按需重算”替代字符串 signature 主判据。

适用场景：

1. 你希望降低 `edge/cache.ts` hot-path 成本。
2. 你希望避免版本递增协议带来的心智负担和正确性风险。
3. 你希望逐步落地，而不是一次性重构 write/read 全链路。

---

## 2. 为什么不选“显式版本表主导”

你提出的顾虑是正确的：

1. signature 是数据驱动；显式版本表很容易退化成指令驱动。
2. 指令驱动需要维护“何时 bump”协议，漏 bump 会出现错误复用，过 bump 会损失性能。
3. 在当前架构下（read/write 分离、change plan 语义聚合），指令驱动版本表复杂度偏高。

因此本方案改为：

1. 继续 data-driven。
2. 优先使用现有稳定引用与结构字段比较。
3. 不引入全局版本表作为前置条件。

---

## 3. 当前基础（可直接复用）

当前代码已经具备关键前提：

1. `NodeRectIndex` 本身是 data-driven，且几何不变时会复用 entry 引用。
2. `edge/cache.ts` 已经是增量 reconcile 流程，适合插入更轻量判定门控。

这意味着可以在不改写上层 API 的情况下，直接把“复用判定”从字符串签名迁移到更轻量机制。

---

## 4. 目标算法（低复杂度）

## 4.1 总流程

每条 edge 的 entry 更新按以下顺序判定：

1. Gate A（引用门控）：
   - source `CanvasNodeRect` 引用是否变化
   - target `CanvasNodeRect` 引用是否变化
   - edge 结构引用/轻量 token 是否变化

2. Gate B（结构数值比较，非字符串）：
   - 比较 node 几何 tuple（`x/y/w/h/rotation`）
   - 比较 edge 结构关键字段（`type/anchor/routing`）

3. 仅当 Gate A/B 不能命中复用时，才重算 path/endpoints。

---

## 4.2 Entry 结构建议

`EdgeCacheEntry` 从“单一 geometrySignature”转成“数据快照 + 引用”：

```ts
type EdgeGeometryTuple = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

type EdgeStructureTuple = {
  type: string
  sourceNodeId: string
  targetNodeId: string
  sourceAnchorSide: string
  sourceAnchorOffset?: number
  targetAnchorSide: string
  targetAnchorOffset?: number
  routingMode?: string
  routingOrthoOffset?: number
  routingOrthoRadius?: number
  routingPointsRef?: readonly { x: number; y: number }[]
}

type EdgeCacheEntry = {
  sourceRectRef: CanvasNodeRect | undefined
  targetRectRef: CanvasNodeRect | undefined
  sourceGeometry: EdgeGeometryTuple | undefined
  targetGeometry: EdgeGeometryTuple | undefined
  structure: EdgeStructureTuple
  endpoints: EdgeEndpoints
  entry: EdgePathEntry
}
```

说明：

1. `routingPointsRef` 先比较引用，必要时再做点坐标比较。
2. 不强制保存字符串 signature，避免字符串分配。
3. `routing points` 判定策略固定为：
   - 第一步：引用比较（`===`）；
   - 第二步：若引用变化，比较数组长度；
   - 第三步：长度一致时逐点比较 `x/y` 数值。
   - 只有三步都不能命中时，才视为结构变化。

---

## 4.3 比较策略

优先级顺序：

1. 引用相等（最快，零分配）
2. 数值 tuple 相等（低成本）
3. 路径重算（最高成本）

具体规则：

1. source/target rect 引用相同且 edge 结构引用相同，直接复用。
2. 若引用不相同，比较 geometry tuple 和 structure tuple。
3. tuple 全相等则复用；否则重算。
4. 对 `routing points` 必须采用“引用优先 + 长度 + 逐点”三段式比较，避免“每次新数组导致永远 miss”。

---

## 5. 文件改造点（按最小改动）

## 5.1 `packages/whiteboard-engine/src/runtime/read/edge/cache.ts`

核心改动：

1. 删除 `geometrySignature` 主路径。
2. 增加 tuple 提取与比较函数：
   - `toNodeGeometryTuple(rectEntry)`
   - `toEdgeStructureTuple(edge)`
   - `isSameGeometryTuple(a, b)`
   - `isSameStructureTuple(a, b)`
3. 重写 `reuseCacheEntry`：
   - 先走引用门控。
   - 再走 tuple 比较。
4. `buildCacheEntry` 继续保留，作为 miss 时唯一重算入口。

## 5.2 `packages/whiteboard-engine/src/runtime/read/index/NodeRectIndex.ts`

无需结构改造，只需确认并保持：

1. 几何不变不替换 entry 引用。
2. 这点是 Gate A 的核心前提。

## 5.3 `packages/whiteboard-engine/src/runtime/read/changePlan.ts`

不需要扩展显式版本字段，保持现状。

---

## 6. 可选增强（建议优先做）

在一次 `ensureEntries()` 周期内加入临时 memo：

1. `nodeRectMemo: Map<NodeId, CanvasNodeRect | undefined>`
2. `nodeGeometryTupleMemo: Map<NodeId, EdgeGeometryTuple | undefined>`

收益：

1. 一次增量对账里，同一 node 被多条 edge 访问时只算一次 tuple。
2. 不改变语义，不引入跨周期状态复杂度。

---

## 7. 是否需要 Immer / WeakMap

## 7.1 Immer

结论：当前不需要。

原因：

1. 这是热路径优化问题，不是状态建模范式改造问题。
2. 引入 Immer 会把问题升级成全链路迁移，成本高于收益。

## 7.2 WeakMap

结论：不作为主状态存储；可用于“单周期临时缓存”。

建议：

1. 主数据仍使用显式字段/Map（可调试、可追踪）。
2. WeakMap 仅用于一次 `ensureEntries()` 的对象级 memo（可选）。

---

## 8. 迁移步骤（低风险）

## Phase 1：不改行为，先降局部开销

1. 在 `ensureEntries()` 加 node tuple memo。
2. 保留 signature 逻辑不变，先做性能基线对比。

## Phase 2：双轨判定

1. 新增“引用+tuple”判定。
2. signature 退为 fallback（仅 debug 或断言模式使用）。
3. 观测命中率和 path 重算次数。

## Phase 3：收敛主路径

1. 若双轨稳定，移除 signature 主路径。
2. 保留 feature flag 回滚开关。

---

## 9. 风险与控制

风险：

1. tuple 提取遗漏字段导致错误复用。
2. routing points 比较策略不当导致误判。

控制：

1. 迁移期保留 signature fallback + mismatch 计数。
2. 加调试计数器：
   - `refHit`
   - `tupleHit`
   - `pathRebuild`
   - `signatureFallbackHit`（迁移期）
3. 保留开关：`edgeCacheDataDrivenComparator`。

---

## 10. 最终建议

推荐执行顺序：

1. 先做 `ensureEntries()` 周期 memo（最小成本）。
2. 再做“引用+tuple”双轨判定。
3. 最后再决定是否彻底移除 signature 主路径。

一句话：

- 不走高复杂度“指令驱动版本表”。
- 走低复杂度“数据驱动比较链”。
- 让性能优化与架构可读性同时提升。
