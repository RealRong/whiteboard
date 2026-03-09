# Engine State Boundary

## 目标

整理 whiteboard-engine 的状态边界，明确哪些状态应该由 engine 持有，哪些只应该是派生读模型，哪些必须留在 UI / React 侧。

这份文档明确采用以下路线：

1. `document` 是 committed source of truth
2. `history` 是 write 语义状态，保留在 engine
3. `mindmapLayout` 是内部 runtime option，保留独立状态
4. `viewport` 不再作为 engine 的独立状态源
5. 不引入 `viewportSignal`
6. `read.state.viewport` 改为从 `document` 直接派生
7. `mindmapLayout` 不再作为 public read state 暴露
8. 外部通过 `projection.mindmap` 消费布局结果，而不是订阅 layout 本身

## Engine 真正保存的状态

### 1. Document

`document` 是唯一的 committed 领域状态，包含：

- nodes
- edges
- background
- viewport
- meta

所有 committed viewport 都属于 `document.viewport`，不再保留第二份 engine 内部镜像状态。

### 2. History

undo / redo / clear 属于 write 语义的一部分，不属于 UI 状态，因此保留在 engine。

### 3. Runtime Options

只有少量不属于 document、但会影响 engine 语义且支持运行期更新的状态保留为独立 runtime state。

当前保留：

- `mindmapLayout`

但它只作为 engine 内部 runtime option 使用，不再作为外部公共状态订阅项。

## Engine 内部可缓存的派生状态

以下状态允许存在，但只能视为缓存或读模型，不是 source of truth：

- read model
- projection caches
- indexes
- read subscription atoms / revision signals

这些状态都必须能够从 `document + runtime options` 重建。

## 不应保留在 Engine 的状态

以下状态不应进入 engine：

- selection
- hover
- tool
- gesture preview
- pointer session
- DOM / platform state
- CSS transform / css vars
- document 字段的镜像状态

特别是：

- 删除 `stateAtoms.viewport`
- 删除 `documentState.viewport`
- 删除 `instance.viewport` 这类额外 source state 通道
- 删除 `read.state.mindmapLayout`
- 删除 `READ_STATE_KEYS.mindmapLayout`

## Viewport 优化方案

### 现状问题

当前 committed viewport 同时存在于两处：

1. `document.viewport`
2. `stateAtoms.viewport`

这会带来：

- 双 source of truth
- document -> viewport 的手工同步逻辑
- `instance/document.ts` 职责变重
- write plan 读取镜像 viewport，而不是 document

### 目标设计

采用如下单路：

`documentAtom -> derived viewport -> read.state.viewport`

具体原则：

1. `document` 是唯一真源
2. `viewport` 不再独立存值
3. `viewport` 不额外引入 signal
4. `viewport` 通过 document 派生 atom 提供读值和订阅语义

### 订阅语义

保留：

- `READ_STATE_KEYS.viewport`
- `read.subscribe(['viewport'])`
- `read.state.viewport`

但其实现改为订阅 derived viewport atom，而不是单独的 primitive viewport atom。

### Write 路线

`write/plan/viewport` 直接读取：

- `instance.document.get().viewport ?? DEFAULT_DOCUMENT_VIEWPORT`

不再通过 `instance.viewport.get()` 读取镜像状态。

## Mindmap Layout 优化方案

### 现状问题

原实现中，外部组件需要同时订阅：

- `READ_SUBSCRIPTION_KEYS.mindmap`
- `READ_STATE_KEYS.mindmapLayout`

这说明 layout 变化没有被收敛为 mindmap projection 的失效，而是泄漏成了 public read state。

### 目标设计

采用如下单路：

`runtime option mindmapLayout -> invalidate mindmap projection -> read.projection.mindmap`

具体原则：

1. `mindmapLayout` 保留在 engine 内部，作为 runtime option
2. 外部不再通过 `read.state.mindmapLayout` 读取或订阅它
3. layout 变化时，engine 直接触发 `mindmap` projection 失效
4. 外部只订阅 `READ_SUBSCRIPTION_KEYS.mindmap`
5. 外部通过 `MindmapViewTree.layout` 获取当前 tree 对应布局

## 重构后的边界

### Source

- document
- history
- runtime options: `mindmapLayout`

### Derived

- read.state.viewport
- read.projection.mindmap
- read projections
- read indexes
- read caches

### API

- commands
- read
- runtime.configure

## 结果

完成后 engine 的状态边界为：

1. `document` 是 committed source of truth
2. `viewport` 是 document 派生读状态
3. `mindmapLayout` 是内部 runtime option，不再作为 public read state 暴露
4. `mindmap` layout 变化会直接失效对应 projection
5. `instance/document.ts` 收缩为纯 document commit boundary
6. 不再维护 viewport 镜像状态或 viewportSignal
