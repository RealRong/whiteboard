# Engine Read 链路打通方案（业务属性语义 + 内核 key 协议）

## 1. 最终结论

采用双层统一方案：

1. 业务层 API 用属性语义：`read.state.xxx`、`read.projection.xxx`、`query.xxx(...)`。
2. 内核执行层用 key 协议：`ReadKey -> resolver`。
3. 参数化几何查询留在 `query`，不进入 `projection`。
4. `selected` 语义由 UI 组合，不做 projection 特化 key。

这比纯 key 风格（`read('state.xxx')`）更可读，也比纯属性硬编码更可扩展。

---

## 2. 对外 API（业务层）

## 2.1 `read.state`

1. `read.state.interaction`
2. `read.state.tool`
3. `read.state.selection`
4. `read.state.viewport`
5. `read.state.mindmapLayout`

## 2.2 `read.projection`

1. `read.projection.viewportTransform`
2. `read.projection.node`（`NodesView`，包含 `ids + byId`）
3. `read.projection.edge`（`EdgesView`，包含 `ids + byId`）
4. `read.projection.mindmap`（`MindmapView`，包含 `ids + byId`）

## 2.3 `query`

1. `query.edgeEndpointsById(edgeId)`

说明：

1. `projection` 只放稳定视图。
2. `query` 放参数化查询。
3. `edgeSelectedEndpoints` 不做 engine API，由 UI 组合。

---

## 3. edgeSelectedEndpoints 归属

不保留 `read.projection.edgeSelectedEndpoints`。

原因：

1. 它是 `selection + geometry` 的组合语义，不是稳定投影。
2. 放在 engine 会把 UI 策略固化成协议。
3. 通用原语应是 `query.edgeEndpointsById(edgeId)`。

UI 组合方式：

1. 读 `read.state.selection.selectedEdgeId`。
2. 若有 `edgeId`，调用 `query.edgeEndpointsById(edgeId)`。

---

## 4. 内核协议（仅内部）

虽然对外是属性语义，但内核仍保留 key 协议用于状态读取与订阅映射。

## 4.1 内部 key（状态与订阅）

```ts
type ReadSubscriptionKey =
  | 'interaction'
  | 'tool'
  | 'selection'
  | 'viewport'
  | 'mindmapLayout'
  | 'snapshot'
```

说明：

1. 业务层不直接接触这些 key 字符串。
2. `read.state.*` 通过这些 key 读取 atom 状态。
3. `read.projection.*` 由各 stage 聚合返回，不暴露 key 字符串。

---

## 5. 为什么这是“最简且最优”

1. 对业务最简：调用是属性语义，直观可读。
2. 对架构最优：内部仍是单一 key 协议，不丢扩展能力。
3. 去重复：不再拆 `nodeIds/nodeById`、`edgeIds/edgeById`、`mindmapIds/mindmapById`。
4. 分层清晰：`state` 稳定状态、`projection` 稳定视图、`query` 参数化查询。

---

## 6. 实现要点

1. 删除 `Object.assign(function, methods)`。
2. `read` 暴露为对象结构：`{ state, projection, subscribe }`。
3. `query` 继续独立暴露参数化查询方法。
4. read stage 内部只保留聚合视图 getter：`node()`、`edge()`、`mindmap()`。

---

## 7. 落地状态

1. 已完成 `read.state`、`read.projection` 属性 API 落地。
2. 已完成调用方迁移，代码中不再使用 `read.get`。
3. 已完成 `edgeSelectedEndpoints` 下沉，统一为 `state.selection + query.edgeEndpointsById`。
4. 已完成 projection 收口与文档同步。

---

## 8. 验收标准

1. 业务代码不再使用 `read('state.xxx')` 或 `read.get(key)` 字符串读法。
2. 业务代码统一为 `read.state.xxx`、`read.projection.xxx`、`query.xxx(...)`。
3. projection 中不存在 `edgeSelectedEndpoints`。
4. UI selected endpoint 通过 `state.selection + query.edgeEndpointsById` 组合。
5. `pnpm -r lint` 通过。
6. `pnpm -r build` 通过。

---

## 9. 一句话

**对外属性语义、对内 key 协议**：业务调用最直观，内核实现最统一，read 链路最稳且可持续扩展。
