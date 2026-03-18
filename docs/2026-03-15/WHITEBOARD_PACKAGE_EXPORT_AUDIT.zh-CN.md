# Whiteboard Package Export Audit

## 1. 结论

当前 `@whiteboard/core` / `@whiteboard/engine` / `@whiteboard/react` 的主要边界问题，不是“react 依赖 engine”这件事本身，而是：

- `engine` 根导出同时承载了三类完全不同职责的类型
  - engine runtime/service contract
  - engine read projection contract
  - 纯 UI draft/view 类型
- `react` 中一批只需要“读模型投影类型”或“本地草稿类型”的文件，被迫从 `@whiteboard/engine` 根包拿类型
- `engine/src/types/instance.ts` 角色混合过重，导致后续任何类型迁移都会牵一大片

这轮审计后的明确判断是：

- `Instance` / `Commands` / `engine()` / `CreateEngineOptions` 这类 runtime contract，继续留在 `engine`
- `NodeViewItem` / `EdgeEntry` / `MindmapViewTree` / `CanvasNodeRect` 这类共享读模型投影，不应继续挂在 `engine` 根导出，应该下沉为 `core` 的共享 read contract
- `MindmapDragView` / `MindmapDragPreview` 这类纯 UI drag draft，不应放在 `engine`，也不应优先下沉到 `core`，更合理的是回收到 `react` 本地
- `InstanceConfig` / `DEFAULT_INSTANCE_CONFIG` 属于“还需要单独评估”的 config contract，不建议和 projection 迁移混成一步

也就是说，问题不只是一句“`MindmapDragView` 不该从 engine 导出”，而是整个导出层现在把三种边界混在了一起。

## 2. 审计范围

本次只审：

- 包导出面
- 包间直接导入关系
- 哪些类型更适合迁移
- 迁移目标应该放在哪一层

本次不做：

- 直接代码迁移
- 包 API 兼容方案设计
- 构建产物或发布策略调整

## 3. 当前导出面

### 3.1 `@whiteboard/core`

`core` 当前已经是细粒度子导出：

- `@whiteboard/core/types`
- `@whiteboard/core/utils`
- `@whiteboard/core/geometry`
- `@whiteboard/core/node`
- `@whiteboard/core/mindmap`
- `@whiteboard/core/edge`
- `@whiteboard/core/schema`
- `@whiteboard/core/kernel`
- `@whiteboard/core/runtime`
- `@whiteboard/core/perf`

这一层整体方向是对的。问题不在 `core` 导出过宽，而在于 `core` 还缺一个专门承载“共享读模型投影”的子域。

### 3.2 `@whiteboard/engine`

`engine` 当前只有根导出 `"."`，而且根导出里混在一起的东西太多：

- runtime 入口
  - `engine`
- config 默认值
  - `DEFAULT_INSTANCE_CONFIG`
- runtime/service contract
  - `Commands`
  - `CommandSource`
  - `CreateEngineOptions`
  - `Instance`
  - `RuntimeConfig`
  - `EngineRead`
  - `EngineReadIndex`
  - `TreeRead`
  - `MindmapRead`
- read projection / view model
  - `EdgeEntry`
  - `MindmapViewTree`
  - `NodeViewItem`
- 纯 UI draft
  - `MindmapDragView`

这就是当前最大的问题源。

### 3.3 `@whiteboard/react`

`react` 当前也只有根导出，但公开面相对收敛：

- `Whiteboard`
- 若干 runtime hooks
- `Config` / `HistoryConfig` / `WhiteboardProps`
- `WhiteboardInstance`
- `NodeDefinition` / `NodeRegistry` / `NodeRenderProps`

`react` 的问题不在“导出太多”，而在它的公开类型内部仍然直接依赖 `engine` 类型。

## 4. 直接跨包依赖现状

### 4.1 `react -> engine` 的直接导入点

当前 `packages/whiteboard-react/src` 中，直接从 `@whiteboard/engine` 导入的文件包括：

- `Whiteboard.tsx`
- `config/index.ts`
- `types/node/registry.ts`
- `runtime/instance/types.ts`
- `runtime/instance/createWhiteboardInstance.ts`
- `runtime/container/read.ts`
- `runtime/view/selection.ts`
- `runtime/draft/node.ts`
- `runtime/draft/edge.ts`
- `runtime/draft/mindmap.ts`
- `features/node/hooks/useNodeView.ts`
- `features/node/components/NodeConnectHandles.tsx`
- `features/node/components/NodeTransformHandles.tsx`
- `features/node/components/styles.ts`
- `features/edge/hooks/useEdgeView.ts`
- `features/mindmap/hooks/useMindmapTreeView.ts`
- `features/mindmap/hooks/drag/math.ts`
- `features/node/hooks/drag/math.ts`
- `features/node/hooks/transform/math.ts`

这些导入点可以分成三类。

### 4.2 第一类：合理依赖 engine 的 runtime contract

这类依赖本身没有问题：

- `Whiteboard.tsx`
- `runtime/instance/createWhiteboardInstance.ts`
- `runtime/instance/types.ts`
- `config/index.ts`
- `types/node/registry.ts`

它们依赖的是：

- `engine()`
- `Instance`
- `Commands`
- `EngineRead`
- `InstanceConfig`
- `DEFAULT_INSTANCE_CONFIG`

这里的问题不是“不能依赖 engine”，而是其中一部分 config/render contract 是否还可以继续下沉或收窄。

### 4.3 第二类：实际上只依赖共享读模型投影

这类文件本质上不关心 engine runtime，只关心某种 read item：

- `runtime/view/selection.ts`
- `runtime/draft/node.ts`
- `features/node/hooks/useNodeView.ts`
- `features/node/components/NodeConnectHandles.tsx`
- `features/node/components/NodeTransformHandles.tsx`
- `features/node/components/styles.ts`
- `runtime/draft/edge.ts`
- `features/edge/hooks/useEdgeView.ts`
- `runtime/container/read.ts`
- `features/mindmap/hooks/drag/math.ts`
- `features/mindmap/hooks/useMindmapTreeView.ts`

它们实际依赖的只是：

- `NodeViewItem`
- `EdgeEntry`
- `MindmapViewTree`

这些类型继续从 `engine` 根导出拿，是边界不清晰的直接表现。

### 4.4 第三类：实际上只依赖 react 自己的 UI draft

最典型的是：

- `runtime/draft/mindmap.ts`
- `features/mindmap/hooks/useMindmapTreeView.ts`
- `features/mindmap/hooks/drag/math.ts`

它们使用的是 `MindmapDragView`。

但从实际代码看，`MindmapDragView` 当前只在 `react` 侧被使用，没有 engine read store 的消费者，也不是 engine runtime contract 的一部分。

这类类型继续由 `engine` 导出，方向明显不对。

## 5. 最大混合点：`engine/src/types/instance.ts`

当前 [packages/whiteboard-engine/src/types/instance.ts](/Users/realrong/whiteboard/packages/whiteboard-engine/src/types/instance.ts) 同时定义了：

- config contract
  - `InstanceConfig`
  - `RuntimeConfig`
  - `CreateEngineOptions`
- runtime contract
  - `Instance`
  - `EngineRead`
  - `EngineReadIndex`
  - `NodeRead`
  - `EdgeRead`
  - `MindmapRead`
  - `TreeRead`
- read projection / geometry projection
  - `CanvasNodeRect`
  - `EdgeEndpoint`
  - `EdgeEndpoints`
  - `EdgeEntry`
  - `MindmapViewTreeLine`
  - `MindmapViewTree`
  - `NodeViewItem`
- 纯 UI draft
  - `MindmapDragPreview`
  - `MindmapDragView`

这个文件现在既不是纯 runtime contract，也不是纯 read contract，更不是纯 config contract。

后续如果不先拆清职责，任何一项迁移都会反复穿透整个文件。

## 6. 典型问题案例

### 6.1 `MindmapDragView`

用户提的例子是准确的：

```ts
import type { MindmapDragView } from '@whiteboard/engine'
```

这个方向有问题。

原因不是“名字里有 View”，而是它的真实职责是：

- `react` 侧的 mindmap drag draft
- 被 `runtime/draft/mindmap.ts` 和 feature hook 使用
- 不属于 engine read store contract
- 不属于 engine runtime lifecycle contract

从代码使用面看，`MindmapDragView` 目前只在 `react` 被消费。

因此它更像：

- `MindmapDragDraft`
- 或 `MindmapDragState`

而不是 engine 需要对外承诺的类型。

### 6.2 `NodeViewItem`

`NodeViewItem` 目前既被 engine read store 使用，也被 react 多处 UI 逻辑使用：

- engine 内部 `read/store/node.ts`
- react 的 node view / draft / selection / handle style

这说明它不是纯 engine 私有类型，也不是纯 react UI 类型，而是共享读模型投影。

这类类型最合理的归宿不是 `engine` 根包，而是共享层。

### 6.3 `EdgeEntry`

`EdgeEntry` 的问题和 `NodeViewItem` 类似，但还有一个额外信号：

- `EdgeEntry['endpoints']` 和 `core/edge/endpoints.ts` 里的 `ResolvedEdgeEndpoints` 在语义上高度重合

这说明 engine 里已经在重复承载 core 级别的边界语义。

### 6.4 `MindmapViewTree`

`MindmapViewTree` 既用于 engine 的 `read/store/mindmap.ts`，也用于 react 的 tree render / drag math。

因此它不是纯 UI 类型。

但它也不是 engine instance contract。

它本质上是一个 mindmap read projection。

## 7. 类型迁移分类

### 7.1 明确应该留在 `engine` 的

这一类属于 engine 作为 runtime/service 的主合同：

- `engine`
- `Instance`
- `Commands`
- `CommandSource`
- `CreateEngineOptions`
- `RuntimeConfig`
- `EngineRead`
- `EngineReadIndex`
- `TreeRead`
- `MindmapRead`

说明：

- `EngineRead` 可以继续由 `engine` 导出
- 但它内部引用的 item 类型，不应该再定义在 `engine/src/types/instance.ts`
- 更合理的方式是：`EngineRead` 作为 engine contract 保留，但 item 类型改为引用 `core` 的共享 read contract

### 7.2 明确应该迁移为共享 read contract 的

这类类型当前同时被 engine 和 react 使用：

- `CanvasNodeRect`
- `NodeViewItem`
- `EdgeEntry`
- `MindmapViewTree`
- `MindmapViewTreeLine`

其中还建议一并处理：

- `EdgeEndpoint`
- `EdgeEndpoints`

更准确地说，这一组不是“view”而是“read projection item”。

建议方向：

- 在 `@whiteboard/core` 新增一个专门的子导出
- 建议名优先考虑 `@whiteboard/core/read`
- 不建议继续堆到 `@whiteboard/core/runtime`
- 也不建议叫 `view`，因为这里不是 React view

建议命名方向尽量短一点：

- `CanvasNodeRect` -> `CanvasNode`
- `NodeViewItem` -> `NodeItem`
- `EdgeEntry` -> `EdgeItem`
- `MindmapViewTree` -> `MindmapTreeView`
- `MindmapViewTreeLine` -> `MindmapLine`

这里不必把“View / Entry / Item”三套命名继续混用，应该尽量统一。

### 7.3 明确应该回收到 `react` 本地的

这类类型当前没有共享给 engine read pipeline 的必要：

- `MindmapDragPreview`
- `MindmapDragView`

推荐方向：

- 放到 `packages/whiteboard-react/src/features/mindmap/` 或 `packages/whiteboard-react/src/runtime/draft/`
- 它们是 UI drag draft，不是 engine read projection

如果后续命名一起优化，更建议改成：

- `MindmapDragPreview`
- `MindmapDragDraft`

或者：

- `MindmapDragGhost`
- `MindmapDragState`

总之不建议继续以 engine 导出类型的形式存在。

### 7.4 需要单独评估的

这一类问题真实存在，但不建议和 projection 迁移绑成一步：

- `InstanceConfig`
- `DEFAULT_INSTANCE_CONFIG`

原因：

- `react/config/index.ts` 依赖 `DEFAULT_INSTANCE_CONFIG`
- `features/node/hooks/drag/math.ts` 与 `features/node/hooks/transform/math.ts` 依赖 `InstanceConfig`
- `runtime/instance/types.ts` 里 `WhiteboardInstance.config` 也直接引用 `EngineInstanceConfig`

这说明 config contract 目前还是 engine 主导。

长期看，这里有两个方向：

- 方向 A：保持 config 仍由 engine 持有，react 只做 normalize 和适配
- 方向 B：把共享结构类型下沉到 core，engine/react 都依赖同一个 config contract

但这是第二阶段问题，不建议和本轮导出清理一起做。

## 8. `react` 公开类型里的次级问题

除了 projection 类型外，`react` 的公开导出还存在两处次级耦合。

### 8.1 `NodeDefinition` / `NodeRenderProps`

[packages/whiteboard-react/src/types/node/registry.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/types/node/registry.ts) 当前直接依赖：

- `Commands`
- `EngineRead`

而 `@whiteboard/react` 根导出又公开了：

- `NodeDefinition`
- `NodeRegistry`
- `NodeRenderProps`

这意味着：

- `react` 的公共 render contract 其实在直接引用 `engine` 类型

短期这不一定是错，因为 `react` 本来就依赖 `engine`。

但从包边界上看，更整齐的方向是：

- `react` 公共类型优先引用 `WhiteboardRead` / `WhiteboardCommands`
- 或者进一步收敛成更小的 `NodeRenderContext`

这一项优先级低于 projection contract 迁移。

### 8.2 `WhiteboardInstance`

[packages/whiteboard-react/src/runtime/instance/types.ts](/Users/realrong/whiteboard/packages/whiteboard-react/src/runtime/instance/types.ts) 当前的 `WhiteboardInstance` 仍然直接建立在：

- `EngineRead`
- `EngineInstanceConfig`
- `EngineCommands`

之上。

这在实现层是合理的，但在 public type surface 上，意味着 `react` 还没有形成完全自洽的对外合同。

这一项也建议放到 projection 迁移之后再看，不要现在一起拆。

## 9. 推荐的包边界

### 9.1 `core`

负责：

- 核心数据类型
- 几何
- 算法
- kernel
- 通用 store/runtime
- 共享 read projection contract

新增建议：

- `@whiteboard/core/read`

建议承载：

- `CanvasNode`
- `NodeItem`
- `EdgeItem`
- `MindmapTreeView`
- `MindmapLine`

如果不想新增太多子域，也可以按现有语义分别挂到：

- node 相关投影进 `@whiteboard/core/node`
- edge 相关投影进 `@whiteboard/core/edge`
- mindmap 相关投影进 `@whiteboard/core/mindmap`

但从调用体验看，专门有一个 `read` 子域会更稳定，也更符合这批类型的职责。

### 9.2 `engine`

负责：

- runtime 实例
- command 执行
- read pipeline
- 对共享 read projection 的生产与分发

不再负责：

- 共享 projection 类型定义本身
- 纯 UI draft 类型定义

### 9.3 `react`

负责：

- UI 组件
- semantic hooks
- runtime draft
- interaction
- feature-level render contract

因此：

- 纯 UI drag draft 留在 `react`
- 共享 read item 依赖 `core`
- 运行时实例能力依赖 `engine`

这三层关系会清楚很多。

## 10. 分阶段迁移建议

### 阶段一：拆出共享 read contract

目标：

- 从 `engine/src/types/instance.ts` 把共享投影类型拆出去

建议动作：

- 在 `core` 新增 `read` 子导出
- 迁移 `CanvasNodeRect` / `NodeViewItem` / `EdgeEntry` / `MindmapViewTree` / `MindmapViewTreeLine`
- `EngineRead` 改为引用新的 core read types
- `engine` 根导出停止直接导出这些 projection item

这是最值得优先做的一步。

### 阶段二：把纯 UI draft 收回 `react`

目标：

- 清掉 `MindmapDragView` / `MindmapDragPreview` 对 `engine` 的错误归属

建议动作：

- 在 `react` 的 mindmap feature 或 draft runtime 内定义本地类型
- `runtime/draft/mindmap.ts` 与相关 hooks 改为引用本地类型
- `engine` 根导出移除 `MindmapDragView`

这一步完成后，用户提到的典型问题会被彻底消除。

### 阶段三：评估 config contract

目标：

- 判断 `InstanceConfig` / `DEFAULT_INSTANCE_CONFIG` 是否仍应以 engine 为中心

建议动作：

- 梳理 config 的真实消费者
- 明确 engine-only config 与 shared config 的边界
- 再决定是否下沉到 `core`

不建议在阶段一就把它一起搬。

### 阶段四：收敛 `react` 公共类型

目标：

- 降低 `@whiteboard/react` 公开类型对 `@whiteboard/engine` 的直接暴露

建议动作：

- 评估 `NodeRenderProps`
- 评估 `WhiteboardInstance`
- 需要时用 `react` 自己的合同类型包一层

这一步优先级低于前三步。

## 11. 额外建议

### 11.1 命名统一

当前命名混杂：

- `Entry`
- `Item`
- `ViewTree`
- `DragView`

建议统一一套简单规则：

- read projection item 用 `Item` 或更短的领域名
- UI draft 用 `Draft` 或 `State`
- 不把 React UI 语义的 `View` 混入 engine/core 的共享 contract

### 11.2 补一条架构检查

`engine/scripts/check-architecture.mjs` 当前只检查：

- 写路径边界
- read 不得依赖 commands/mutate

后续建议再加一类检查：

- `react` 不得从 `@whiteboard/engine` 导入 read projection item
- `engine` 不得对外导出纯 UI draft 类型

这能防止后面边界再次漂回去。

## 12. 最终建议

如果只保留一句最核心的落地判断，就是：

- `engine` 只保留 runtime/service contract
- 共享 read projection 下沉到 `core`
- 纯 UI drag/view draft 收回 `react`

其中优先级从高到低是：

1. 先拆共享 read projection
2. 再移除 `MindmapDragView` 这类错误导出
3. 最后再处理 `InstanceConfig` 和 `react` 公共类型的耦合

按这个顺序做，边界会明显清楚，而且不会把迁移范围一次拉得过大。
