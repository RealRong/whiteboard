# Engine API 收敛优化设计（已落地状态）

> 更新日期：2026-03-05
> 范围：`packages/whiteboard-engine` 与 `packages/whiteboard-react` 当前实现

---

## 1. 当前结论

写侧 API 已按漏斗原则收敛到如下形态：

1. 批量更新唯一原语：`node.updateMany` / `edge.updateMany`。
2. 单条更新只做语法糖：`update(id, patch)` 委托 `updateMany([{ id, patch }])`。
3. 分组和层级排序并入 domain：不再有顶层 `commands.group` / `commands.order`。
4. edge routing 对外参数语义化：统一 `edgeId + point/index`，不再让 UI 传 `Edge/pathPoints`。
5. host 只保留宿主输入：`host.containerResized`；节点测量改为 `node.updateMany(..., { source: 'system' })`。

---

## 2. 已落地 API 形态

```ts
export type Commands = {
  doc: {
    reset: (doc: Document) => Promise<DispatchResult>
  }

  tool: {
    set: (tool: 'select' | 'edge') => void
  }

  history: {
    configure: (config: Partial<ResolvedHistoryConfig>) => void
    get: () => HistoryState
    undo: () => boolean
    redo: () => boolean
    clear: () => void
  }

  interaction: {
    update: (patch: Partial<InteractionState>) => void
    clearHover: () => void
  }

  host: {
    containerResized: (rect: {
      left: number
      top: number
      width: number
      height: number
    }) => void
  }

  selection: {
    select: (ids: NodeId[], mode?: SelectionMode) => void
    toggle: (ids: NodeId[]) => void
    clear: () => void
    getSelectedNodeIds: () => NodeId[]
  }

  node: {
    create: (payload: NodeInput) => Promise<DispatchResult>
    update: (id: NodeId, patch: NodePatch) => Promise<DispatchResult>
    updateMany: (updates: readonly NodeBatchUpdate[], options?: NodeUpdateManyOptions) => void
    updateData: (id: NodeId, patch: Record<string, unknown>) => Promise<DispatchResult> | undefined
    delete: (ids: NodeId[]) => Promise<DispatchResult>

    group: {
      create: (ids: NodeId[]) => Promise<DispatchResult>
      ungroup: (id: NodeId) => Promise<DispatchResult>
    }

    order: {
      set: (ids: NodeId[]) => Promise<DispatchResult>
      bringToFront: (ids: NodeId[]) => Promise<DispatchResult>
      sendToBack: (ids: NodeId[]) => Promise<DispatchResult>
      bringForward: (ids: NodeId[]) => Promise<DispatchResult>
      sendBackward: (ids: NodeId[]) => Promise<DispatchResult>
    }
  }

  edge: {
    create: (payload: EdgeInput) => Promise<DispatchResult>
    update: (id: EdgeId, patch: EdgePatch) => Promise<DispatchResult>
    updateMany: (updates: readonly EdgeBatchUpdate[]) => void
    delete: (ids: EdgeId[]) => Promise<DispatchResult>
    select: (id?: EdgeId) => void

    routing: {
      insertAtPoint: (edgeId: EdgeId, pointWorld: Point) => void
      move: (edgeId: EdgeId, index: number, pointWorld: Point) => void
      remove: (edgeId: EdgeId, index: number) => void
      reset: (edgeId: EdgeId) => void
    }

    order: {
      set: (ids: EdgeId[]) => Promise<DispatchResult>
      bringToFront: (ids: EdgeId[]) => Promise<DispatchResult>
      sendToBack: (ids: EdgeId[]) => Promise<DispatchResult>
      bringForward: (ids: EdgeId[]) => Promise<DispatchResult>
      sendBackward: (ids: EdgeId[]) => Promise<DispatchResult>
    }
  }

  viewport: {
    set: (viewport: Viewport) => Promise<DispatchResult>
    panBy: (delta: { x: number; y: number }) => Promise<DispatchResult>
    zoomBy: (factor: number, anchor?: Point) => Promise<DispatchResult>
    zoomTo: (zoom: number, anchor?: Point) => Promise<DispatchResult>
    reset: () => Promise<DispatchResult>
  }

  mindmap: {
    apply: (command: MindmapApplyCommand) => Promise<DispatchResult>
  }
}
```

---

## 3. 已落地写协议（WriteCommandMap）

```ts
export type NodeWriteCommand =
  | { type: 'create'; payload: NodeInput }
  | { type: 'updateMany'; updates: readonly NodeBatchUpdate[] }
  | { type: 'delete'; ids: NodeId[] }
  | { type: 'group.create'; ids: NodeId[] }
  | { type: 'group.ungroup'; id: NodeId }
  | { type: 'order.set'; ids: NodeId[] }

export type EdgeWriteCommand =
  | { type: 'create'; payload: EdgeInput }
  | { type: 'updateMany'; updates: readonly EdgeBatchUpdate[] }
  | { type: 'delete'; ids: EdgeId[] }
  | { type: 'order.set'; ids: EdgeId[] }
  | { type: 'routing.insertAtPoint'; edgeId: EdgeId; pointWorld: Point }
  | { type: 'routing.move'; edgeId: EdgeId; index: number; pointWorld: Point }
  | { type: 'routing.remove'; edgeId: EdgeId; index: number }
  | { type: 'routing.reset'; edgeId: EdgeId }
```

说明：

1. `update` 是 API facade 语法糖，不占底层 command 类型。
2. `bringToFront/sendToBack/bringForward/sendBackward` 仍在 API 层折叠为 `order.set`。

---

## 4. 批量更新语义规范（现实现）

1. `updates` 为空：no-op。
2. 同批重复 id：后写覆盖前写（last write wins）。
3. 空 patch：忽略。
4. 不存在节点/边：由 core reduce 自然忽略，不导致整批失败。
5. `node.updateMany` 默认 `source: 'interaction'`，可传 `source: 'system'`（测量链路）。

---

## 5. 与旧接口的差异

1. 已删除：`commands.group.*`（改为 `commands.node.group.*`）。
2. 已删除：`commands.order.*`（改为 `commands.node.order.*` / `commands.edge.order.*`）。
3. 已删除：`commands.edge.insertRoutingPoint/moveRoutingPoint/removeRoutingPoint/resetRouting`。
4. 已删除：routing 相关 `Edge/pathPoints` 外露参数。
5. 已删除：`host.nodeMeasured`。

---

## 6. 仍可继续优化（可选）

1. `node.updateData` 可评估是否继续保留为 helper，或统一让调用方直接传 `patch.data`。
2. `edge.routing.*` 的返回值目前为 `void`，若 UI 需要失败感知，可升级为 `Promise<DispatchResult>`。
3. 可以补一份对外迁移说明文档（从旧 API 到当前 API 的映射表）。

---

## 7. 一句话

**当前 API 已实现“域内聚合 + 批量漏斗唯一 + routing 语义化”，写链路保持单一路径且对调用方更短更直。**
