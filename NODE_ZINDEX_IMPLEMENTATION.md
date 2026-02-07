# Node/Edge/Group 分层与 zIndex 实施方案（偏实现细节）

> 目标：在 core 保持“逻辑顺序”，在 react 实现清晰的渲染层级与交互置顶行为，支持置顶/置底/上移/下移、点击置顶、固定顶层节点、拖拽临时置顶。

---

## 1. 设计原则（落地约束）

1) **顺序即层级**  
   不依赖 CSS z-index 作为主逻辑；统一用“数组顺序”决定渲染前后。

2) **逻辑顺序在 core**  
   `order` 存在 Document 层，任何排序变更走 core dispatch，保证可回放与协作一致。

3) **渲染层级在 react**  
   Layer Stack 固定：Background → Edge → Node → Overlays。  
   交互态只在 Overlay 中“临时置顶”，不改 Document order。

4) **组只是节点（扁平）**  
   Group 仍是 Node；默认放到 background layer，保证视觉在下层。  
   不做嵌套 z-order，避免复杂度爆炸。

---

## 2. Core 数据模型（强制要求）

### 2.1 Document 新增 order

```ts
type Document = {
  nodes: Record<NodeId, Node>
  edges: Record<EdgeId, Edge>
  order: {
    nodes: NodeId[]
    edges: EdgeId[]
  }
}
```

**规则：**
- `order.nodes` 必须包含所有 node id，且顺序即 zIndex。
- `order.edges` 必须包含所有 edge id。
- create/delete 要同步维护 order。
- 不考虑兼容旧数据（无 order 视为无效）。

### 2.2 Node 的 layer 策略（推荐）

```ts
type Node = {
  ...
  layer?: 'background' | 'default' | 'overlay'
}
```

**用途：**
- `background`：如 group 背景、容器类节点
- `default`：普通节点
- `overlay`：必须始终在顶层的节点（比如浮层节点、临时节点）

**排序策略：**
1. 先按 layer 分桶
2. 每个桶内按 `order.nodes` 顺序渲染

> 这能解决“group 在下层”与“固定顶层节点”的需求，不需要复杂嵌套结构。

---

## 3. Core 命令设计（dispatch 级别）

### 3.1 建议新增命令

```ts
type ZOrderCommands = {
  node: {
    bringToFront(ids: NodeId[]): Promise<DispatchResult>
    sendToBack(ids: NodeId[]): Promise<DispatchResult>
    bringForward(ids: NodeId[]): Promise<DispatchResult>
    sendBackward(ids: NodeId[]): Promise<DispatchResult>
    setOrder(ids: NodeId[]): Promise<DispatchResult>
  }
  edge: {
    bringToFront(ids: EdgeId[]): Promise<DispatchResult>
    sendToBack(ids: EdgeId[]): Promise<DispatchResult>
    bringForward(ids: EdgeId[]): Promise<DispatchResult>
    sendBackward(ids: EdgeId[]): Promise<DispatchResult>
    setOrder(ids: EdgeId[]): Promise<DispatchResult>
  }
}
```

### 3.2 Core event/action 建议

新增 `node.order.*` 与 `edge.order.*` 事件即可：

```
node.order.set
node.order.bringToFront
node.order.sendToBack
node.order.bringForward
node.order.sendBackward

edge.order.set
edge.order.bringToFront
edge.order.sendToBack
edge.order.bringForward
edge.order.sendBackward
```

内部策略统一转为“数组移动”，最终只改 `doc.order.nodes` / `doc.order.edges`。

### 3.3 数组移动算法（伪代码）

```ts
function moveToFront(order, ids) {
  const set = new Set(ids)
  const kept = order.filter(id => !set.has(id))
  const moved = order.filter(id => set.has(id))
  return [...kept, ...moved]
}

function moveToBack(order, ids) {
  const set = new Set(ids)
  const kept = order.filter(id => !set.has(id))
  const moved = order.filter(id => set.has(id))
  return [...moved, ...kept]
}

function moveForward(order, ids) {
  // 每个 id 交换到后一位（保持 ids 的相对顺序）
}

function moveBackward(order, ids) {
  // 每个 id 交换到前一位（保持 ids 的相对顺序）
}
```

**约束：**
- 多选时保持相对顺序不变
- 不允许跨 layer（overlay/background 仍通过 layer 策略控制）

---

## 4. Instance 上挂载 API（重点）

### 4.1 WhiteboardCommands 扩展

建议在 `WhiteboardCommands` 新增 `order`：

```ts
export type WhiteboardCommands = {
  ...
  order: ZOrderCommands
}
```

### 4.2 Instance 命令挂载

在 `useInstanceCommands` 中把 core 的 order 命令挂到 instance：

```ts
instance.setCommands({
  order: {
    node: {
      bringToFront: (ids) => core.commands.node.bringToFront(ids),
      sendToBack: (ids) => core.commands.node.sendToBack(ids),
      bringForward: (ids) => core.commands.node.bringForward(ids),
      sendBackward: (ids) => core.commands.node.sendBackward(ids),
      setOrder: (ids) => core.commands.node.setOrder(ids)
    },
    edge: {
      bringToFront: (ids) => core.commands.edge.bringToFront(ids),
      sendToBack: (ids) => core.commands.edge.sendToBack(ids),
      bringForward: (ids) => core.commands.edge.bringForward(ids),
      sendBackward: (ids) => core.commands.edge.sendBackward(ids),
      setOrder: (ids) => core.commands.edge.setOrder(ids)
    }
  }
})
```

> API 只挂在 instance 上，不进入 hooks 直接暴露，组件/生命周期调用 instance.commands.order 即可。

---

## 5. React 侧渲染层级实现

### 5.1 Layer Stack（固定层级）

1) BackgroundLayer（网格/背景）  
2) EdgeLayer（普通边）  
3) NodeLayer（普通节点）  
4) EdgeOverlayLayer（选中/编辑边）  
5) NodeOverlayLayer（拖拽/选中框/handles）  
6) UIOverlayLayer（菜单/提示）

### 5.2 NodeLayer 排序

```ts
const nodes = viewGraph.canvasNodes
const ordered = order.nodes.map(id => nodesById[id]).filter(Boolean)
const background = ordered.filter(n => n.layer === 'background')
const normal = ordered.filter(n => !n.layer || n.layer === 'default')
const overlay = ordered.filter(n => n.layer === 'overlay')
```

渲染顺序：`background -> normal -> overlay`。

### 5.3 EdgeLayer 排序

同理：`order.edges` 排序输出。

**建议：Edge 永远在 Node 之下**，只有在交互态提升到 OverlayLayer。

---

## 6. 交互行为（行业规范与实现）

### 6.1 点击置顶（可配置）

配置项：
```ts
interaction.raiseOnSelect?: boolean
```

实现：
- 在 selection 的入口（pointerDown/select 逻辑）里检查新选中节点
- 若 `raiseOnSelect === true`：调用 `instance.commands.order.node.bringToFront(ids)`
- 只对 node 生效，edge 走 overlay，不改 order

### 6.2 拖拽临时置顶（默认推荐）

做法：
- 拖拽开始：把节点加入 `nodeTransient.draggingIds`
- NodeLayer 渲染时：过滤掉 draggingNodes
- NodeOverlayLayer 渲染 draggingNodes（视觉上置顶）
- 拖拽结束：清理 draggingIds
- 是否真正写入 order 由 `raiseOnDragEnd` 配置决定

### 6.3 置顶/置底菜单

菜单或快捷键只调用 instance API：

```
instance.commands.order.node.bringToFront([id])
instance.commands.order.node.sendToBack([id])
```

---

## 7. Group 的处理策略

**推荐：**
- Group 默认 `layer='background'`
- Group 的边框/标题在组内渲染时处于“节点内容上方”
- 不强制 group 内部 children 的 z-order 约束，保持全局 order

---

## 8. Edge 特殊处理

**默认：**
- Edge 只按 `order.edges` 渲染
- 选中/hover/控制点 时进入 EdgeOverlayLayer
- Edge z-order 不影响 Node z-order

---

## 9. 最新节点的 zIndex

**规则：**
- 新建 node：追加到 `order.nodes` 尾部（自然置顶）
- 新建 edge：追加到 `order.edges` 尾部（自然置顶，但仍在 EdgeLayer）

---

## 10. 建议接入路径（最小改动顺序）

1) 在 core Document 增加 `order.nodes / order.edges`  
2) core commands 增加 order 相关命令  
3) instance.commands 挂载 order API  
4) NodeLayer / EdgeLayer 改为按 order 渲染  
5) 加入 overlay 层处理 hover/selection/drag  
6) 接入 `raiseOnSelect` / `raiseOnDragEnd` 配置

---

## 11. 与现有架构的对齐

- **core**：只存 order 与命令，不涉及 react 层。
- **instance**：提供 order 命令入口（所有 UI 行为最终统一调用）。
- **hooks**：不挂生命周期，不做 side-effect。调用 instance API 由组件或 lifecycle 负责。

---

如需我继续：可以按此方案进一步拆分成 `core/commands` 与 `react layer` 的具体接口与文件改造清单。
