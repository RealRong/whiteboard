# Whiteboard UI 接管 Interaction 的设计与实现方案

## 1. 背景与问题

当前 `node transform` 交互链路过长，典型路径为：

1. React DOM 事件
2. `DomEventMapper`
3. `InputPort`
4. `PointerSessionEngine`
5. `input/sessions/NodeTransform`
6. `domains/node/interaction/Gateway`
7. `domains/node/interaction/nodeTransform/Planner`
8. `domains/node/interaction/RuntimeWriter`

这条链路的主要问题：

1. 跳转点过多，定位行为成本高。
2. `Planner/SessionStore/RuntimeWriter` 的会话编排与状态写入耦合，改动一处影响多处。
3. UI 输入语义（handle 命中、pointer 生命周期）和 Engine 领域规则混在一起，放大认知负担。

---

## 2. 目标

将架构收敛为：

1. React UI 负责 interaction 编排（pointer 生命周期、会话状态、调用时机）。
2. Engine 负责纯领域能力（规则计算、只读查询、最终 mutation 编译）。
3. 写入仍坚持单通道：`commands -> mutate`。
4. 高频预览优先在 UI 侧处理，Engine 不承载不必要的交互状态机。

---

## 3. 结论与原则

结论：可以把 interaction 复杂度上移到 `whiteboard-react`，但不建议把几何规则与提交逻辑也搬出 Engine。

原则：

1. Engine 保留“可复用、可验证、宿主无关”的规则内核。
2. UI 保留“输入设备/DOM/生命周期相关”的编排复杂度。
3. 不引入第二写入口，不恢复 `instance.api`。
4. 保持 `move 预览、end 提交` 语义。

---

## 4. 目标分层（建议）

## 4.1 UI 层（`packages/whiteboard-react`）

职责：

1. pointer down/move/up/cancel 会话管理。
2. 命中目标解析（已有 `DomEventMapper`）。
3. 交互阶段调用 Engine kernel：`begin/update/commit/cancel`。
4. 预览渲染数据维护（优先 UI 层本地语义状态）。

非职责：

1. 不实现几何规则（resize/rotate/snap）。
2. 不直接拼装 `node.update` mutation。

## 4.2 Engine 层（`packages/whiteboard-engine`）

职责：

1. 纯规则计算（resize/rotate/snap）。
2. 基于 draft/session 计算 preview patch。
3. commit 阶段输出标准 operation 列表。
4. 暴露稳定、无 DOM 依赖的 kernel API。

非职责：

1. 不再维护 pointer session 引擎内的 nodeTransform 业务会话状态。
2. 不处理 DOM target/data-attribute 细节。

---

## 5. nodeTransform 新设计（核心）

## 5.1 当前问题点

核心复杂度集中在：

1. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/Planner.ts`
2. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/SessionStore.ts`
3. `packages/whiteboard-engine/src/domains/node/interaction/RuntimeWriter.ts`
4. `packages/whiteboard-engine/src/input/sessions/NodeTransform.ts`

其中大量代码属于“会话编排与路由”，不是领域规则本身。

## 5.2 目标 API（Engine Kernel）

建议新增无状态或弱状态 API（示例）：

```ts
type TransformDraft =
  | { mode: 'resize'; nodeId: NodeId; drag: ResizeDragState }
  | { mode: 'rotate'; nodeId: NodeId; drag: RotateDragState }

type TransformPreview = {
  updates: Array<{ id: NodeId; position?: Point; size?: Size; rotation?: number }>
  guides: Guide[]
  draft: TransformDraft
}

nodeTransformKernel.beginResize(input): TransformDraft
nodeTransformKernel.beginRotate(input): TransformDraft
nodeTransformKernel.update(draft, pointer, options): TransformPreview
nodeTransformKernel.commit(draft): Operation[]
nodeTransformKernel.cancel(): void // 可选，无状态时可省略
```

输入必须是语义化参数：

1. `nodeId`
2. `rect/rotation`
3. `pointer(client/world/modifiers)`
4. `minSize`（可选）

禁止传入 DOM event 或 element。

## 5.3 UI 侧编排（示例）

UI hook 负责 lifecycle：

```ts
// useNodeTransformInteraction.ts (react)
// 1) down: 调用 begin*
// 2) move: 调用 update，写入 preview state
// 3) up: 调用 commit -> instance.commands.node.update(...)
// 4) cancel: 清理 preview state
```

建议放置：

1. `packages/whiteboard-react/src/node/hooks/useNodeTransformInteraction.ts`
2. `packages/whiteboard-react/src/common/instance/lifecycle/*`（如需统一监听绑定）

## 5.4 预览状态存放策略

两个可选方案：

方案 A（推荐，渐进式）：

1. UI 维护本地 preview atom/state。
2. Node 渲染层将 preview 覆盖到 view node 上。
3. Engine 不再写 `render.nodeTransform/nodePreview/dragGuides`。

方案 B（兼容过渡）：

1. UI 编排 interaction，但仍通过轻量 command 写 engine render transient。
2. 待 UI 渲染链稳定后再去掉 engine render transient 依赖。

建议先走 A（最终形态更清晰），若迁移风险高则先 B 再 A。

---

## 6. 实施路线（分阶段）

## Phase 0：冻结行为与基线

1. 固化 `node transform` 行为回归清单（resize/rotate/snap/cancel）。
2. 保留现有 benchmark 作为性能基线：
   - `bench:node-transform-frame`
   - `bench:drag-frame`
   - `bench:edge-routing-frame`

## Phase 1：提取 Engine Kernel（不改 UI 行为）

1. 从 `Planner` 提取纯规则与 commit API。
2. `Rules + CommitCompiler` 组合成 `nodeTransformKernel`。
3. 旧 `Planner` 暂时调用 kernel，保持行为不变。

完成后收益：

1. 先把“可复用核心”从会话框架中解耦。
2. 为 UI 接管编排建立稳定入口。

## Phase 2：React 接管 nodeTransform 编排

1. 新增 `useNodeTransformInteraction`。
2. 在 NodeItem/Canvas lifecycle 中接管 pointer 会话。
3. `InputSession` 中 `NodeTransform` 逻辑降级为兼容层或直接移除。

完成后收益：

1. `startResize` 不再穿越多层 session/gateway/planner。
2. 调试路径集中在 React hook + kernel。

## Phase 3：删除 Engine 侧 nodeTransform 会话基础设施

1. 删除或归档：
   - `domains/node/interaction/nodeTransform/Planner.ts`
   - `domains/node/interaction/nodeTransform/SessionStore.ts`
   - `input/sessions/NodeTransform.ts`
2. 清理 `Gateway` 与 `RuntimeWriter` 中 nodeTransform 专用 transient 写入。

## Phase 4：推广到其他交互（可选）

按风险从低到高推进：

1. `nodeDrag`（与 nodeTransform 模式一致，收益高）
2. `edgeRouting`
3. `selectionBox`
4. `mindmapDrag`

---

## 7. 需要改动的主要文件（nodeTransform 首批）

Engine：

1. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/Rules.ts`
2. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/CommitCompiler.ts`
3. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/Planner.ts`（提取后可删）
4. `packages/whiteboard-engine/src/input/sessions/NodeTransform.ts`（迁移后可删）
5. `packages/whiteboard-engine/src/instance/create.ts`（移除 nodeTransform session 绑定）

React：

1. `packages/whiteboard-react/src/node/components/NodeItem.tsx`
2. `packages/whiteboard-react/src/common/input/DomInputAdapter.ts`
3. `packages/whiteboard-react/src/common/input/DomEventMapper.ts`（保留语义映射）
4. 新增 `packages/whiteboard-react/src/node/hooks/useNodeTransformInteraction.ts`

---

## 8. 风险与应对

1. 风险：UI 本地 preview 与最终 commit 不一致。  
应对：`commit` 复用同一 draft，不重新推导起点参数。

2. 风险：多交互冲突（transform 与 drag、edge connect 抢占）。  
应对：在 UI 层建立统一 interaction lock（单 active interaction）。

3. 风险：undo/redo 语义变化。  
应对：只在 `up/end` 调 `commands.node.update`，确保一次手势一条历史。

4. 风险：插件或外部调用依赖旧 `domains.node.interaction.transform`。  
应对：保留一段兼容适配层，标注 deprecated，分两个版本移除。

---

## 9. 验收标准

功能一致性：

1. resize/rotate/snap/cancel 表现与当前版本一致。
2. group/selection 行为无回退。
3. 历史记录仍是一次手势一条记录。

复杂度收益：

1. `nodeTransform` 主流程跳转层级显著减少。
2. `Planner/SessionStore/RuntimeWriter` 中 nodeTransform 特化逻辑移除或最小化。
3. 调试时可在 React hook 内单点定位一次交互。

性能：

1. `bench:node-transform-frame` 不回退。
2. 大图场景下 pointer move 帧稳定性不下降。

---

## 10. “其他可以做的”一并建议

在完成 nodeTransform 后，建议同步推进以下四类工作：

1. 统一 UI Interaction Orchestrator  
将 node/edge/mindmap/selection 的 pointer 生命周期统一到一个 UI orchestration 层，减少每域重复事件管线。

2. Engine Kernel 化模板  
为 drag/routing/selection 抽出统一 kernel 约定：`begin/update/commit/cancel`，避免各域 API 风格不一致。

3. Query 单一读入口收敛  
跨模块几何读取统一走 `instance.query`，删除编排层临时 map/重复查找逻辑。

4. 回归与基准自动化  
把交互行为回放（录制 pointer 序列）纳入 CI，和 bench 一起作为架构重构护栏。

---

## 11. 迁移决策建议

推荐采用“先内核、后编排、再删除旧链路”的三段式：

1. 先提取 kernel（低风险，可随时回退）。
2. 再让 React 接管 `nodeTransform` 编排（中风险，高收益）。
3. 最后移除旧 session/gateway/planner 写法（清债阶段）。

一句话：interaction 可以上移到 UI，但规则与提交不要上移；否则只是把复杂度从 Engine 复制到 UI。
