# Whiteboard Signature 体系优化方案（无兼容约束版）

## 1. 目标与前提

本方案用于优化当前 whiteboard 的 signature 体系，目标是：

1. 降低热路径字符串分配与 GC 压力。
2. 降低读链路心智负担，统一到 data-driven 比较模型。
3. 删除不再需要的签名函数与导出，减少维护面。

前提（重要）：

1. 本项目当前没有外部用户依赖兼容诉求。
2. 可以直接做 breaking change，不需要兼容层、别名、re-export。
3. 优先级：**性能与简洁 > 向后兼容**。

---

## 2. 当前体系盘点

签名定义文件：

- `packages/whiteboard-core/src/cache/signature.ts`

导出文件：

- `packages/whiteboard-core/src/cache/index.ts`

当前定义的签名函数：

1. `toPointSignature`
2. `toRectSignature`
3. `toAnchorSignature`
4. `toNodeGeometrySignature`
5. `toNodeStateSignature`
6. `toNodeCollectionSignature`
7. `toEdgeRoutingSignature`
8. `toEdgePathSignature`
9. `toMindmapLayoutSignature`

当前仓内实际调用（engine/core/react）仅剩：

1. `toNodeStateSignature`（`NodeRectIndex`）
2. `toRectSignature`（`SnapIndex`）
3. `toMindmapLayoutSignature`（`mindmap/cache`）

其余签名函数在仓内已无业务调用。

---

## 3. 核心判断

## 3.1 签名的主要成本

1. 字符串拼接（`join/template string`）
2. 中间字符串对象分配
3. GC 回收成本

在高频路径（drag / geometry / reconcile）中，签名经常不是算法瓶颈，但会放大分配与 GC 抖动。

## 3.2 更优方向

统一采用 data-driven 判定链：

1. 引用门控（最快）
2. tuple 数值比较（低成本）
3. 必要时重算（最重）

这比“字符串签名主判据”更稳定，也更容易定位问题。

---

## 4. 优化分层（按收益与风险）

## Layer A：立即删除（低风险高收益）

直接删除仓内无调用项：

1. `toPointSignature`
2. `toAnchorSignature`
3. `toNodeGeometrySignature`
4. `toEdgeRoutingSignature`
5. `toEdgePathSignature`
6. `toNodeCollectionSignature`

对应变更：

1. 删 `signature.ts` 中上述函数。
2. 删 `cache/index.ts` 的对应导出。
3. 跑全仓 lint/build 保障无残留引用。

预期收益：

1. 降低 API 面积。
2. 降低认知负担。
3. 为后续彻底去签名化铺路。

---

## Layer B：索引层去签名化（中风险，高价值）

### B1. NodeRectIndex 去 `toNodeStateSignature`

目标文件：

- `packages/whiteboard-engine/src/runtime/read/index/NodeRectIndex.ts`

改造点：

1. `NodeRectCacheEntry.signature` 改为 `stateTuple`。
2. `stateTuple` 字段建议：
   - `position.x/y`
   - `size.width/height`（含 fallback）
   - `rotation`
   - 可选：`parentId`（若影响 query 语义）
3. 更新逻辑从字符串相等改为 tuple 比较函数。

收益：

1. 高频节点几何更新不再产生签名字符串。
2. 与 edge/data comparator 思路统一。

### B2. SnapIndex 去 `toRectSignature`

目标文件：

- `packages/whiteboard-engine/src/runtime/read/index/SnapIndex.ts`

改造点：

1. `SnapCacheEntry.signature` 改为 `aabbTuple`。
2. tuple 字段：`x/y/width/height`。
3. 使用 `isSameRectTuple` 比较替代字符串比较。

收益：

1. Snap 网格更新路径减少字符串分配。
2. 局部可维护性提升。

---

## Layer C：Mindmap 缓存去签名化（中高风险，高收益）

目标文件：

- `packages/whiteboard-engine/src/runtime/read/mindmap/cache.ts`
- `packages/whiteboard-core/src/mindmap/query.ts`
- `packages/whiteboard-core/src/cache/signature.ts`

当前问题：

1. `toMindmapStructureSignature(tree)` 会遍历节点并序列化 data。
2. `toMindmapLayoutSignature(...)` 再进行二次组合。
3. 两层签名都依赖字符串构建。

改造建议：

1. 引入 `MindmapCacheKey`（结构化对象）而非字符串。
2. Key 由以下部分组成：
   - `treeRef`（优先）
   - `root placement tuple`（`position/size`）
   - `layout tuple`（`mode/hGap/vGap/side`）
   - `nodeSize tuple`
3. 当 `treeRef` 不稳定时，再走低成本结构比较（避免 JSON stringify）。
4. 移除 `toMindmapLayoutSignature` 与 `toMindmapStructureSignature`。

收益：

1. 减少 mindmap 读链路重复序列化。
2. 布局缓存命中机制更可解释、更可调试。

---

## Layer D：Autofit 本地签名去除（可选）

目标文件：

- `packages/whiteboard-engine/src/instance/reactions/Autofit.ts`

当前问题：

1. `createNodeSignature` 在 diff 时对每个节点构建字符串。

改造建议：

1. 替换为 `isSameAutofitRelevantState(prev, next)` 字段比较。
2. 仅比较 Autofit 真正关心的字段。

收益：

1. 自动适配路径减少分配。
2. 行为语义更清晰。

---

## 5. 建议实施顺序（一步到位但可控）

1. Phase 1：Layer A（删 6 个无调用签名）
2. Phase 2：Layer B（NodeRectIndex + SnapIndex）
3. Phase 3：Layer C（mindmap cache 核心）
4. Phase 4：Layer D（Autofit 可选）

每个 Phase 后固定执行：

1. `pnpm -C packages/whiteboard-core lint`
2. `pnpm -C packages/whiteboard-engine lint`
3. `pnpm -C packages/whiteboard-react lint`
4. 若涉及性能路径，执行相关 bench（至少 edge-routing-frame / node-transform-frame）

---

## 6. 代码级落地清单

## 6.1 core/cache

文件：

- `packages/whiteboard-core/src/cache/signature.ts`
- `packages/whiteboard-core/src/cache/index.ts`

动作：

1. 删除无调用签名函数。
2. 保留暂时还在用的函数（`toNodeStateSignature` / `toRectSignature` / `toMindmapLayoutSignature`），待后续阶段删除。

## 6.2 engine/read/index

文件：

- `packages/whiteboard-engine/src/runtime/read/index/NodeRectIndex.ts`
- `packages/whiteboard-engine/src/runtime/read/index/SnapIndex.ts`

动作：

1. entry 改为 tuple 存储。
2. 添加 `isSameXXXTuple`。
3. 删除对 `@whiteboard/core/cache` 的相应签名依赖。

## 6.3 engine/read/mindmap

文件：

- `packages/whiteboard-engine/src/runtime/read/mindmap/cache.ts`

动作：

1. 改树缓存 key 模型。
2. 删除对 `toMindmapLayoutSignature` 的依赖。
3. 与 `projection` 层保持稳定引用复用。

## 6.4 core/mindmap

文件：

- `packages/whiteboard-core/src/mindmap/query.ts`

动作：

1. 删除 `toMindmapStructureSignature`（在 cache 去签名化后）。
2. 清理相关导出和调用。

---

## 7. 风险与应对

风险 1：字段遗漏导致误命中/误失配

1. 应对：每个 comparator 明确字段清单；初期加 debug 断言。

风险 2：引用不稳定导致命中率下降

1. 应对：引用门控失败后必须有 tuple 比较兜底，不依赖纯引用。

风险 3：Mindmap cache 行为回归

1. 应对：先双轨验证（旧签名 vs 新 comparator），一致后再删旧逻辑。

---

## 8. 验证策略

## 8.1 正确性

1. 对比前后输出引用与渲染结果是否一致。
2. 对关键路径加统计：
   - `comparatorHit`
   - `rebuildCount`
   - `cacheMissReason`

## 8.2 性能

1. 关注内存分配与 GC 时间（尤其 drag/reconcile 场景）。
2. 关注每帧边路由/索引更新时间。

---

## 9. 最终收敛目标

完成全部阶段后，目标是：

1. `@whiteboard/core/cache/signature.ts` 仅保留仍有明确价值的最小函数集，或完全移除该模块。
2. engine 读路径（node/snap/edge/mindmap）统一采用 data-driven comparator。
3. 不再依赖字符串签名作为主判据。

---

## 10. 结论（执行口径）

执行口径明确如下：

1. **不做兼容。**
2. **允许 breaking change。**
3. **以性能和代码简洁为最高优先级。**

按本文档顺序实施即可，建议先从 Layer A + Layer B 开始，收益最快且风险最低。
