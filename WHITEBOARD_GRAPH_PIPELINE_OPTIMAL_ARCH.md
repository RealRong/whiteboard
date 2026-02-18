# Whiteboard Graph 链路最优架构方案（无兼容层）

## 1. 目标

本方案只做一件事：把 `doc -> graph -> query/view -> react` 整条链路拉直，去掉重复中间层和跨层转发。

目标标准：

1. 单一图数据源（Single Source of Truth）。
2. 状态职责分离：UI 状态归 `state`，文档投影归 `graph`。
3. 增量事件统一：只走一种 dirty/fullSync 流。
4. `createEngine` 装配清晰，减少“先创建再到处传”。
5. React 只做薄适配：容器绑定 + 渲染 + 向 engine 注入新文档。

---

## 2. 当前问题（为什么“别扭”）

当前存在四层交错：

1. `kernel/state/graph.ts` 做图投影缓存。
2. `kernel/projector/canvas.ts` 又包了一层 watch + dirty 聚合。
3. `state/factory/index.ts` 再把 `visibleNodes/canvasNodes/visibleEdges` 伪装成 state 派生字段。
4. `instance/create.ts` 把 `canvas` 再传给 query/view/commands/lifecycle。

直接问题：

1. `state` 同时承载 UI 状态和图投影，边界混乱。
2. 读时计算和事件推送混用，触发点分散。
3. `canvas` 成为隐式中枢，但命名上像“视图层对象”，语义不清晰。
4. 文档更新路径不单一（`docRef + state.setDoc + core changes` 混在一起）。

---

## 3. 最终架构（One Graph Pipeline）

### 3.1 核心原则

1. `graph` 是唯一文档投影引擎，输出 `GraphSnapshot`。
2. `state` 只保留 UI 可写状态，不再包含 `visibleNodes/canvasNodes/visibleEdges`。
3. query/view 统一订阅 `graph.onChange`，不再读 `state.read('canvasNodes')`。
4. 外部文档输入统一通过 `commands.doc.replace(doc)`。
5. Core 变更监听只负责产出 `GraphHint` 并喂给 `graph`。

### 3.2 最终链路

`commands.doc.replace` / `core.changes` / `commands.transient.nodeOverrides`  
-> `graph`（投影 + dirty 计算 + revision）  
-> `query indexes`（增量更新）  
-> `view registries`（增量更新）  
-> React hooks（只订阅 view/query）

---

## 4. 最终目录结构（简化版）

```txt
packages/whiteboard-engine/src/
  infra/
    cache/
    derive/
    events/
    geometry/
    store/

  graph/
    Graph.ts                 # 单一图投影引擎
    derive.ts                # visible/canvas/edges 推导
    hint.ts                  # operation -> GraphHint
    types.ts
    index.ts

  state/
    store/
      create.ts              # 仅 UI writable state
      keys.ts
      writable.ts
    index.ts

  query/
    indexes.ts
    canvas.ts
    snap.ts
    geometry.ts
    registry.ts              # createQuery

  view/
    derivations.ts
    node.ts
    edge.ts
    mindmap.ts
    bindings.ts
    registry.ts              # createView

  commands/
    doc.ts                   # replace/sync 文档入口
    transient.ts
    node.ts
    edge.ts
    ...

  lifecycle/
    Lifecycle.ts
    watchers/
      doc.ts                 # core.changes -> graph.applyHint
      state.ts
      selection.ts

  instance/
    create.ts
```

说明：

1. 删除 `kernel/projector/canvas.ts`。
2. 删除 `kernel/state/graph.ts`（逻辑迁入 `graph/`）。
3. 删除 `state` 里 derived graph key（`visibleNodes/canvasNodes/visibleEdges`）。

---

## 5. API 设计（最终形态）

## 5.1 Graph（内部）

```ts
type GraphChange = {
  fullSync?: true
  dirtyNodeIds?: string[]
  orderChanged?: true
  revision: number
}

type Graph = {
  read(): GraphSnapshot
  readNode(id: string): Node | undefined
  onChange(listener: (change: GraphChange) => void): () => void
  replaceDoc(doc: Document | null): void
  patchOverrides(updates: NodeViewUpdate[]): void
  clearOverrides(ids?: string[]): void
  applyHint(hint: GraphHint): void
  flush(): void
}
```

## 5.2 Commands（公开）

```ts
commands.doc.replace(doc)
commands.transient.nodeOverrides.set/clear/commit(...)
```

约束：

1. 外部写文档只能走 `commands.doc.replace`。
2. `state.setDoc` 删除，避免双写入口。

## 5.3 State（公开）

只保留 UI 状态：

1. tool/selection/edgeConnect/routingDrag/mindmapDrag/nodeDrag/nodeTransform
2. interaction/spacePressed/dragGuides/groupHovered/history/mindmapLayout
3. `nodeOverrides` 从 state 移除（迁入 graph 内部 overlay）

---

## 6. 三条主流程（最终）

## 6.1 外部文档替换

1. React 收到新 `doc`。
2. 调用 `instance.commands.doc.replace(doc)`。
3. `graph.replaceDoc(doc)` 生成增量/全量变更。
4. query/view 自动增量更新并通知订阅者。

## 6.2 Core operation 变更

1. lifecycle doc watcher 订阅 `core.changes.onAfter`。
2. `hint = buildGraphHint(changes.operations)`。
3. `graph.applyHint(hint)` + `graph.flush()`。
4. query/view 只处理 `GraphChange`。

## 6.3 临时拖拽覆盖

1. `commands.transient.nodeOverrides.set(...)`。
2. 直接 `graph.patchOverrides(...)`。
3. `graph` 发 dirty ids。
4. query/view 增量刷新。

---

## 7. 命名与规范（按你的要求）

1. 目录名用“空间 + 职责”，不用重复后缀：`view/node.ts`，不写 `nodeViewRegistry.ts`。
2. Class 文件 PascalCase：`Graph.ts`、`Lifecycle.ts`。
3. 函数文件 camelCase：`buildHint.ts`、`createState.ts`。
4. 单文件目录直接上提，减少无意义层级。
5. 禁止同层大量同前后缀（`createXxx`、`xxxService` 连片堆积）。

---

## 8. 重构步骤（无兼容，直接到位）

## Phase 1：建立新 Graph 内核

1. 新建 `graph/Graph.ts`、`graph/derive.ts`、`graph/hint.ts`。
2. 迁移 `kernel/state/graph.ts` 的推导逻辑到 `graph/derive.ts`。
3. 迁移 `runtime/lifecycle/watchers/nodeHint.ts` 到 `graph/hint.ts`。

## Phase 2：切断 state 派生图数据

1. 从 `StateSnapshot` 删除 `visibleNodes/canvasNodes/visibleEdges`。
2. `state/store/create.ts` 删除 `setDoc` 和 derived 分支。
3. `state` 仅保留 writable UI 数据。

## Phase 3：query/view 改订阅 graph

1. `query/projector` 从 `graph.onChange` 驱动。
2. `view/bindings` 从 `graph.onChange` 驱动 node registry。
3. 代码中所有 `state.read('canvasNodes'|'visibleEdges'|'visibleNodes')` 改为 `graph.read()` 或 query 接口。

## Phase 4：统一文档写入口

1. 新增 `commands.doc.replace`。
2. React 从 `instance.state.setDoc(doc)` 改为 `instance.commands.doc.replace(doc)`。
3. lifecycle doc watcher 只做 `core.changes -> graph.applyHint`。

## Phase 5：删除旧层

1. 删除 `kernel/projector/canvas.ts`。
2. 删除旧 `kernel/state/graph.ts`。
3. 删除 `state/keys.ts` 中 derived graph keys。

---

## 9. 验收标准（必须同时满足）

1. 引擎内不存在 `state.read('canvasNodes'|'visibleNodes'|'visibleEdges')`。
2. 文档更新入口唯一：`commands.doc.replace`。
3. query/view 都通过 `graph.onChange` 驱动。
4. `createEngine` 不再创建并扩散 `canvas` 对象。
5. React 侧只保留：
   - 容器事件绑定
   - 渲染层
   - `commands.doc.replace(doc)` 注入文档

---

## 10. 预期收益

1. 链路直：文档投影只在一个模块发生。
2. 认知简单：state 不再混入图派生语义。
3. 性能稳定：增量触发路径单一，可做统一 profiling。
4. 可移植性更好：换 Vue/Canvas/WebGL 只重做 UI adapter，不动 graph/query/view 核心。
