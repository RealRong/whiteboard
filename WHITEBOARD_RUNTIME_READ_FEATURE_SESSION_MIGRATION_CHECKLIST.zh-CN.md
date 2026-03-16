# Whiteboard Runtime Read / Feature Session Migration Checklist

## 1. 目标

这份清单只服务一个目标：

- 把当前 `runtime/draft + feature hook 自己拼 committed + draft` 的模型
- 迁移到
- `engine.committed read + core runtime.read + feature-owned session`

对应的最终原则已经在：

- `WHITEBOARD_RUNTIME_READ_SESSION_BOUNDARY_DESIGN.zh-CN.md`

这份清单不再重复讨论原则本身，只回答：

- 现状有哪些对象
- 它们最终应该归到哪里
- 迁移分几阶段做
- 每阶段具体改哪些文件
- 每阶段完成后的验收标准是什么

---

## 2. 最终目标状态

### 2.1 Public Instance

最终公开实例继续固定为：

```ts
type WhiteboardInstance = {
  config: Readonly<BoardConfig>
  read: WhiteboardRead
  state: WhiteboardState
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
  configure: (options: WhiteboardRuntimeOptions) => void
  dispose: () => void
}
```

保持不变：

- `read`
- `state`
- `commands`
- `viewport`

明确不新增：

- `session`
- `draft`
- `view`

### 2.2 Engine

`engine` 最终只保留：

- committed document
- committed read
- committed index
- committed commands

也就是说：

- `engine.read` 仍然只表达 committed truth

### 2.3 Whiteboard React Runtime

`whiteboard-react/runtime` 最终只负责：

- 公开 `runtime.read`
- 公开 `runtime.state`
- 组装 `commands`
- 组装 `viewport`

其中：

- `runtime.read` 只放领域对象最终展示态
- `runtime.state` 只放公开语义状态

### 2.4 Feature-Owned Session

所有交互期临时态最终归属 feature 自己：

- `features/node/session/*`
- `features/edge/session/*`
- `features/edge/connect/session/*`
- `features/mindmap/session/*`
- `ui/canvas/selection/session/*` 或等价 feature 路径

这些 session：

- 可以被核心 `runtime.read` 内部依赖
- 但不通过 `instance` 公开成顶层 contract

---

## 3. 当前对象到最终归位的映射

### 3.1 当前 `runtime/draft/*` 的最终归位

| 当前文件 | 当前语义 | 最终归位 | 是否进入核心 `runtime.read` | 处理动作 |
| --- | --- | --- | --- | --- |
| `runtime/draft/node.ts` | node drag / resize / rotate patch | `features/node/session/node.ts` | 作为 `read.node.item` / `read.edge.item` 的内部输入 | 移动并改名 |
| `runtime/draft/guides.ts` | node drag / transform guides | `features/node/session/guides.ts` | 否 | 移动并私有化 |
| `runtime/draft/edge.ts` | edge routing draft | `features/edge/session/routing.ts` | 部分作为 `read.edge.item` 输入，selected handle 不进入核心 read | 移动并拆分职责 |
| `runtime/draft/connection.ts` | edge connect preview source | `features/edge/connect/session.ts` | 否 | 移动并私有化 |
| `runtime/draft/selection.ts` | selection box raw rect | `ui/canvas/selection/session.ts` 或等价 feature 路径 | 否 | 移动并私有化 |
| `runtime/draft/mindmap.ts` | mindmap drag preview source | `features/mindmap/session/drag.ts` | 作为 `read.mindmap.item` 的内部输入 | 移动并改名 |
| `runtime/draft/runtime.ts` | draft 总装配器 | 删除 | 否 | 删除并改成 feature runtime 独立装配 |

### 3.2 当前 hook / helper 的最终归位

| 当前文件 | 当前问题 | 最终状态 | 处理动作 |
| --- | --- | --- | --- |
| `features/node/hooks/useNodeView.ts` | 仍在自己拼 committed node + node draft | 基础领域展示态上提到 `runtime/read/node.ts`；hook 退化为薄订阅或删除 | 重构 |
| `features/edge/hooks/useEdgeView.ts` | 自己拼 committed edge + node draft + edge draft | 基础领域展示态上提到 `runtime/read/edge.ts`；hook 退化为薄订阅或删除 | 重构 |
| `features/mindmap/hooks/useMindmapTreeView.ts` | 当前同时承担读取与局部展示组织 | 最终只保留 feature-local 组织；基础 item 从 `runtime/read/mindmap.ts` 获取 | 重构 |
| `ui/node-toolbar/model.ts` | UI model | 留在 feature / UI helper | 保留 |
| `ui/context-menu/model.ts` | UI model | 留在 feature / UI helper | 保留 |
| `ui/canvas/input/useSelectionBox.ts` | 输入器 + session source | 保留输入职责，但改为使用 feature-owned selection session | 重构 |
| `features/edge/hooks/connect/useEdgeConnect.ts` | 输入器 + session source + preview | 保留输入职责，但改为使用 `features/edge/connect/session` | 重构 |

### 3.3 当前组件层的最终读取面

| 当前组件 | 当前读取方式 | 最终读取方式 |
| --- | --- | --- |
| `features/node/components/NodeItem.tsx` | `useNodeView(nodeId, { selected })` | 直接读 `runtime.read.node.item`，局部 UI 逻辑留组件侧 |
| `features/edge/components/EdgeLayer.tsx` | `useEdgeView(edgeId)` | 直接读 `runtime.read.edge.item` |
| `features/mindmap/components/MindmapSceneLayer.tsx` | `useMindmapDraft + useMindmapTreeView` | 直接读 `runtime.read.mindmap.item`，局部 drag 相关仍在 feature |
| `features/node/components/NodeOverlayLayer.tsx` | `useGuidesDraft + useNodeView` | guides 改读 feature session；node item 改读 `runtime.read.node.item` |
| `features/edge/components/EdgePreview.tsx` | `useConnectionDraft` | 改读 edge connect feature session 或 feature helper |
| `ui/canvas/overlay/SelectionBoxOverlay.tsx` | `useSelectionDraft` | 改读 selection feature session 或 feature helper |

---

## 4. 最终目录设计

### 4.1 核心 runtime

建议最终保留：

- `packages/whiteboard-react/src/runtime/read/node.ts`
- `packages/whiteboard-react/src/runtime/read/edge.ts`
- `packages/whiteboard-react/src/runtime/read/mindmap.ts`
- `packages/whiteboard-react/src/runtime/read/index.ts`
- `packages/whiteboard-react/src/runtime/state/*`
- `packages/whiteboard-react/src/runtime/instance/*`
- `packages/whiteboard-react/src/runtime/viewport/*`
- `packages/whiteboard-react/src/runtime/hooks/*`

这里不再保留：

- `packages/whiteboard-react/src/runtime/draft/*`

### 4.2 Feature-Owned Session

建议新增：

- `packages/whiteboard-react/src/features/node/session/node.ts`
- `packages/whiteboard-react/src/features/node/session/guides.ts`
- `packages/whiteboard-react/src/features/edge/session/routing.ts`
- `packages/whiteboard-react/src/features/edge/connect/session.ts`
- `packages/whiteboard-react/src/features/mindmap/session/drag.ts`
- `packages/whiteboard-react/src/ui/canvas/selection/session.ts`

如需总装配，可以有：

- `features/node/session/runtime.ts`
- `features/edge/session/runtime.ts`
- `features/mindmap/session/runtime.ts`

但不再有全局 `runtime/draft/runtime.ts`。

### 4.3 Feature UI Helper

建议保留：

- `features/edge/hooks/*`
- `features/node/hooks/*`
- `features/mindmap/hooks/*`
- `ui/context-menu/*`
- `ui/node-toolbar/*`

但它们的职责改成：

- 只做局部 UI 推导
- 不再承担基础领域展示态拼装

---

## 5. 迁移阶段

建议按五个阶段完成，不做兼容双轨。

### 阶段 0：冻结目标 contract

目标：

- 先把最终 contract 固定，避免边改边摇摆

动作：

- 固定 `WhiteboardInstance` 公开面仍然只有 `read / state / commands / viewport`
- 固定 `engine.read` 继续只表示 committed
- 固定“不公开顶层 `runtime.session`”
- 固定“只有领域对象最终展示态才进核心 `runtime.read`”

涉及文件：

- `runtime/instance/types.ts`
- `WHITEBOARD_RUNTIME_READ_SESSION_BOUNDARY_DESIGN.zh-CN.md`

验收标准：

- 团队对最终 contract 无分歧
- 后续阶段不再引入新的顶层 namespace

### 阶段 1：引入核心 `runtime.read` 三条主链

目标：

- 建立 `node / edge / mindmap` 的最终领域展示态 read

动作：

- 新增 `runtime/read/node.ts`
- 新增 `runtime/read/edge.ts`
- 新增 `runtime/read/mindmap.ts`
- 新增 `runtime/read/index.ts`
- 在 `createWhiteboardInstance` 中把 `instance.read` 从“直出 engine.read”改成“runtime.read 组装结果”
- `index.*` 仍透传 committed engine query helper

涉及文件：

- `runtime/instance/createWhiteboardInstance.ts`
- `runtime/instance/types.ts`
- `runtime/read/*`

设计要求：

- `runtime.read.node.item` 必须输出 final node item
- `runtime.read.edge.item` 必须输出 final edge item
- `runtime.read.mindmap.item` 必须输出 final mindmap item
- `runtime.read.index.*` 不做 draft-aware

验收标准：

- UI 层已经可以只读 `instance.read.node.item`
- UI 层已经可以只读 `instance.read.edge.item`
- UI 层已经可以只读 `instance.read.mindmap.item`

### 阶段 2：把全局 `runtime/draft` 拆成 feature-owned session

目标：

- 删除全局 draft 总线

动作：

- `runtime/draft/node.ts` 搬到 `features/node/session/node.ts`
- `runtime/draft/guides.ts` 搬到 `features/node/session/guides.ts`
- `runtime/draft/edge.ts` 搬到 `features/edge/session/routing.ts`
- `runtime/draft/connection.ts` 搬到 `features/edge/connect/session.ts`
- `runtime/draft/mindmap.ts` 搬到 `features/mindmap/session/drag.ts`
- `runtime/draft/selection.ts` 搬到 `ui/canvas/selection/session.ts`
- 删除 `runtime/draft/runtime.ts`
- 删除 `runtime/draft/index.ts`

涉及文件：

- `runtime/draft/*`
- `features/node/hooks/drag/session.ts`
- `features/node/hooks/transform/session.ts`
- `features/edge/hooks/connect/useEdgeConnect.ts`
- `features/edge/hooks/routing/useEdgeRouting.ts`
- `features/mindmap/hooks/drag/useMindmapDrag.ts`
- `ui/canvas/input/useSelectionBox.ts`

设计要求：

- feature session store 只被 feature 自己消费
- 不通过 `instance` 公开为顶层公共 API
- 如核心 `runtime.read` 需要使用 feature session，应通过内部 runtime 组装注入，不外露

验收标准：

- `runtime/draft` 目录被删除
- `InternalWhiteboardInstance` 不再含有 `draft`
- 代码中不再出现 `instance.draft.*`

### 阶段 3：收基础领域 view hook

目标：

- 删除“自己拼 committed + session”的基础 view hook

动作：

- 重构 `features/node/hooks/useNodeView.ts`
- 重构 `features/edge/hooks/useEdgeView.ts`
- 让它们退化成薄订阅，或直接删除

建议方向：

- `useNodeView` 最终只剩：
  - 薄订阅 `runtime.read.node.item`
  - 或完全删除，组件直接 `useKeyedStoreValue(instance.read.node.item, nodeId)`
- `useEdgeView` 最终只剩：
  - 薄订阅 `runtime.read.edge.item`
  - 或完全删除，组件直接 `useKeyedStoreValue(instance.read.edge.item, edgeId)`

涉及文件：

- `features/node/hooks/useNodeView.ts`
- `features/edge/hooks/useEdgeView.ts`
- `features/node/components/NodeItem.tsx`
- `features/edge/components/EdgeLayer.tsx`
- `features/edge/components/EdgeItem.tsx`

验收标准：

- 基础领域展示态不再由 feature hook 自己拼装
- `applyCanvasDraft(...)` 不再出现在 `useEdgeView`
- node / edge item 组件直接面向核心 `runtime.read`

### 阶段 4：保留并收紧 feature UI hook

目标：

- 让 feature hook 只做局部 UI 推导

动作：

- 保留 `useSelectedEdgeView`
- 保留 `useNodeToolbar`
- 保留 `useContextMenu`
- 让它们只依赖：
  - `runtime.read`
  - feature 自己的 session
  - `runtime.state`

涉及文件：

- `features/edge/components/EdgeOverlayLayer.tsx`
- `ui/node-toolbar/model.ts`
- `ui/context-menu/model.ts`
- `features/node/components/NodeOverlayLayer.tsx`
- `features/edge/components/EdgePreview.tsx`
- `ui/canvas/overlay/SelectionBoxOverlay.tsx`

设计要求：

- 这些 hook 不进入核心 `runtime.read`
- 但也不再自己重复补基础领域展示态

验收标准：

- `toolbar / contextMenu / selected handles / preview / guides / selectionBox`
  都留在 feature 自己
- 核心 `runtime.read` 没有膨胀出 `overlay.*` / `selected.*` / `preview.*`

### 阶段 5：收 internal instance

目标：

- 把内部实例从 `engine + draft + interaction + registry` 收成更清晰的内部装配对象

动作：

- 删除 `InternalWhiteboardInstance['draft']`
- 如确有必要，新增 internal-only feature runtime 聚合：
  - `internals.node`
  - `internals.edge`
  - `internals.mindmap`
- 这些 internal feature runtime 只用于装配，不作为 public API

涉及文件：

- `runtime/instance/types.ts`
- `runtime/instance/createWhiteboardInstance.ts`
- 所有 `useInternalInstance()` 的剩余调用点

验收标准：

- internal instance 不再包含“全局 draft 仓库”
- internal 面只保留真正需要 internal-only 的对象

---

## 6. 关键设计细节

### 6.1 核心 `runtime.read` 如何依赖 feature session

这里有一个关键实现问题：

- feature session 不公开
- 但核心 `runtime.read` 仍然要读取它

建议设计方式：

- 在 `createWhiteboardInstance` 内部构建 feature runtimes
- feature runtime 返回：
  - `session`
  - `readInputs`
  - `dispose/reset`
- `runtime.read` 在实例装配阶段内部依赖这些 `readInputs`

也就是说：

- feature session 对外不可见
- 但对内部 runtime 组装是可见的

示意：

```ts
const nodeFeature = createNodeFeatureRuntime(...)
const edgeFeature = createEdgeFeatureRuntime(...)
const mindmapFeature = createMindmapFeatureRuntime(...)

const read = createRuntimeRead({
  engineRead: engine.read,
  nodeSession: nodeFeature.session,
  edgeSession: edgeFeature.session,
  mindmapSession: mindmapFeature.session
})
```

最终：

- `instance.read = read`
- `instance` 不暴露 `nodeSession / edgeSession / mindmapSession`

### 6.2 `index` 继续保持 committed query helper

长期禁止：

- 把 `instance.read.index.node.get(...)` 改成 session-aware
- 把 draft overlay 逻辑污染到 `index`

`index` 继续只回答：

- committed spatial query
- committed geometry query
- committed idsInRect / snap candidate query

overlay 逻辑只进入最终领域展示态 `read.item`。

### 6.3 `selected / overlay / preview` 为什么不该进核心 `read`

因为这类对象回答的不是：

- 这个领域对象当前最终是什么

而是：

- 当前 UI 应该展示哪种局部 chrome

所以这类对象默认只在 feature 内存在。

---

## 7. 现状文件级迁移清单

下面这部分按文件列出建议动作。

### 7.1 需要新增

- `packages/whiteboard-react/src/runtime/read/node.ts`
- `packages/whiteboard-react/src/runtime/read/edge.ts`
- `packages/whiteboard-react/src/runtime/read/mindmap.ts`
- `packages/whiteboard-react/src/runtime/read/index.ts`
- `packages/whiteboard-react/src/features/node/session/node.ts`
- `packages/whiteboard-react/src/features/node/session/guides.ts`
- `packages/whiteboard-react/src/features/edge/session/routing.ts`
- `packages/whiteboard-react/src/features/edge/connect/session.ts`
- `packages/whiteboard-react/src/features/mindmap/session/drag.ts`
- `packages/whiteboard-react/src/ui/canvas/selection/session.ts`

### 7.2 需要删除

- `packages/whiteboard-react/src/runtime/draft/connection.ts`
- `packages/whiteboard-react/src/runtime/draft/edge.ts`
- `packages/whiteboard-react/src/runtime/draft/guides.ts`
- `packages/whiteboard-react/src/runtime/draft/index.ts`
- `packages/whiteboard-react/src/runtime/draft/mindmap.ts`
- `packages/whiteboard-react/src/runtime/draft/node.ts`
- `packages/whiteboard-react/src/runtime/draft/runtime.ts`
- `packages/whiteboard-react/src/runtime/draft/selection.ts`

### 7.3 需要重构

- `packages/whiteboard-react/src/runtime/instance/createWhiteboardInstance.ts`
- `packages/whiteboard-react/src/runtime/instance/types.ts`
- `packages/whiteboard-react/src/features/node/hooks/useNodeView.ts`
- `packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts`
- `packages/whiteboard-react/src/features/mindmap/hooks/useMindmapTreeView.ts`
- `packages/whiteboard-react/src/features/node/hooks/drag/session.ts`
- `packages/whiteboard-react/src/features/node/hooks/transform/session.ts`
- `packages/whiteboard-react/src/features/edge/hooks/connect/useEdgeConnect.ts`
- `packages/whiteboard-react/src/features/edge/hooks/routing/useEdgeRouting.ts`
- `packages/whiteboard-react/src/features/mindmap/hooks/drag/useMindmapDrag.ts`
- `packages/whiteboard-react/src/ui/canvas/input/useSelectionBox.ts`
- `packages/whiteboard-react/src/features/node/components/NodeOverlayLayer.tsx`
- `packages/whiteboard-react/src/features/edge/components/EdgePreview.tsx`
- `packages/whiteboard-react/src/ui/canvas/overlay/SelectionBoxOverlay.tsx`

### 7.4 可以保留但职责要收窄

- `packages/whiteboard-react/src/ui/node-toolbar/model.ts`
- `packages/whiteboard-react/src/ui/context-menu/model.ts`
- `packages/whiteboard-react/src/features/edge/components/EdgeOverlayLayer.tsx`
- `packages/whiteboard-react/src/features/node/components/NodeOverlayLayer.tsx`

---

## 8. 每阶段的 lint / 验收清单

每完成一个阶段，至少执行：

- `pnpm --filter @whiteboard/react lint`

在跨包边界有变动时，再执行：

- `pnpm --filter @whiteboard/core lint`
- `pnpm --filter @whiteboard/engine lint`
- `pnpm -r lint`

每阶段都应人工确认三件事：

- public instance 没有新增顶层 namespace
- 核心 `runtime.read` 没有混入 `overlay / preview / selected` 之类对象
- feature hook 不再重复拼基础领域展示态

---

## 9. 最终完成态检查表

全部完成时，应满足下面这份最终检查表：

- [ ] `instance.read` 已不再直出 `engine.read`
- [ ] `instance.read.node.item` 是 final node item
- [ ] `instance.read.edge.item` 是 final edge item
- [ ] `instance.read.mindmap.item` 是 final mindmap item
- [ ] `instance.read.index.*` 仍然是 committed query helper
- [ ] `instance` 没有 `draft`
- [ ] `instance` 没有 `session`
- [ ] `runtime/draft` 目录已删除
- [ ] feature session 已迁入 `features/*/session`
- [ ] `useNodeView` 不再自己拼 committed + draft
- [ ] `useEdgeView` 不再自己拼 committed + draft
- [ ] `selected / overlay / preview / toolbar / contextMenu` 没有进入核心 `runtime.read`
- [ ] 这些对象仍能在 feature 层正常推导
- [ ] `pnpm -r lint` 通过

---

## 10. 一句话总结

这次迁移的核心不是“把 draft 换个名字”，而是完成三个真正的边界收敛：

- `engine` 保持 committed 纯度
- 核心 `runtime.read` 只统一领域对象最终展示态
- 所有交互期临时态回到 feature-owned session

只有这三件事同时完成，当前 `runtime/draft + useEdgeView/useNodeView 自己拼装` 的模型才算真正结束。
