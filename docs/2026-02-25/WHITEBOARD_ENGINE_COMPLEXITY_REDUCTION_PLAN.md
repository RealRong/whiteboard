# Whiteboard Engine 降复杂度方案

## 1. 目标与结论

本方案聚焦 `packages/whiteboard-engine/src/domains/node/interaction`（`node` / `nodeTransform`）的复杂度收敛，并回答是否要拆 `whiteboard-ui`。

核心结论：

1. 当前复杂度里有大量“必要复杂度”（几何计算、吸附、组关系、交互会话），不能简单删减。
2. 现阶段优先做“边界收敛 + 模块拆解”，不建议立即新增 `packages/whiteboard-ui`。
3. 在完成边界收敛后，再根据多宿主需求决定是否拆包，避免先拆包后返工。

---

## 2. 当前复杂度来源（按必要/可优化分类）

## 2.1 必要复杂度（应保留）

1. 几何与坐标转换：`client/screen/world`、`zoom`、`alt/shift`、旋转与最小尺寸共同参与计算。
2. 交互流程完整性：`start -> move -> end/cancel` 需要保持预览与最终提交一致。
3. 组与父子关系维护：拖拽进入/移出 group 时要同步 `parentId` 与 group 包围盒。
4. 性能约束：`move` 阶段只写预览，`end` 才提交 mutation。

对应文件：

1. `packages/whiteboard-engine/src/domains/node/interaction/node/Rules.ts`
2. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/Rules.ts`
3. `packages/whiteboard-engine/src/domains/node/interaction/node/CommitCompiler.ts`
4. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/CommitCompiler.ts`

## 2.2 可优化复杂度（本方案重点）

1. 重复逻辑：`node/Rules.ts` 与 `nodeTransform/Rules.ts` 重复了 `zoom/snap threshold/rect expand`。
2. 会话校验重复：两个 `Planner` 都在做相似的 `interactionSession + pointerId` guard。
3. `CommitCompiler` 体积偏大：拖拽 patch 合并、group drop 规则、最终 operation 归一化混在一个文件。
4. 网关职责混合：`Gateway` 同时承担 planner 编排与 transient reset。

对应文件：

1. `packages/whiteboard-engine/src/domains/node/interaction/node/Planner.ts`
2. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/Planner.ts`
3. `packages/whiteboard-engine/src/domains/node/interaction/Gateway.ts`
4. `packages/whiteboard-engine/src/domains/node/interaction/RuntimeWriter.ts`

---

## 3. 关于是否拆 `whiteboard-ui`

结论：暂不立即拆新包，先收敛边界。

原因：

1. 当前已有 `packages/whiteboard-react` 承担 UI 职责，且 `DomEventMapper` 已在 React 层完成 DOM -> 语义输入映射。
2. 现在主要问题是 Engine 内部模块边界与重复逻辑，而不是缺少 UI 包。
3. 过早拆包会放大迁移面（类型导出、构建、依赖图）并增加回归风险。

对应现状文件：

1. `packages/whiteboard-react/src/common/input/DomEventMapper.ts`
2. `packages/whiteboard-engine/src/input/sessions/NodeDrag.ts`
3. `packages/whiteboard-engine/src/input/sessions/NodeTransform.ts`

只有在满足以下条件时再拆 `whiteboard-ui`：

1. 需要支持第二宿主（非 React）并复用同一输入适配层。
2. UI 输入映射、样式系统、组件注册已形成稳定公共 API。
3. Engine 与 UI 之间接口冻结（至少 2 个迭代周期无破坏性变更）。

---

## 4. 目标边界（收敛后）

Engine 只保留：

1. 领域规则（Rules）
2. 会话编排（Planner）
3. mutation 编译（CommitCompiler）
4. 只读查询（Query）
5. 单写入口（`commands -> mutate`）

UI（当前 `whiteboard-react`）负责：

1. DOM 事件与数据属性解析
2. 命中目标语义化映射
3. 可视化渲染与样式
4. lifecycle 绑定（监听器、observer）

约束：

1. 不新增 `instance.api` 写入口，所有写操作仍走 `instance.commands`。
2. 高频交互保持“`move` 预览、`end` 提交”。
3. Query 只读，不反向写状态。

---

## 5. 分阶段执行计划

## Phase 0：基线与防回退（P0）

目标：先锁定性能与行为基线，防止“重构后更慢/行为漂移”。

动作：

1. 以现有 bench 为基线：
   - `pnpm -w @whiteboard/engine run bench:drag-frame`
   - `pnpm -w @whiteboard/engine run bench:node-transform-frame`
   - `pnpm -w @whiteboard/engine run bench:edge-routing-frame`
2. 记录关键行为 checklist：
   - node drag（含 group 内外拖拽）
   - resize（含吸附、minSize）
   - rotate（含 shift 吸附角）
   - cancel 清理（guides / preview / interactionSession）

涉及文件：

1. `packages/whiteboard-engine/package.json`
2. `packages/whiteboard-engine/src/perf/dragFrame.bench.ts`
3. `packages/whiteboard-engine/src/perf/nodeTransformFrame.bench.ts`

完成标准：

1. 有可复跑基线数据。
2. 行为 checklist 固化为评审必过项。

## Phase 1：提取交互共享几何（P0）

目标：消除 `node` 与 `nodeTransform` 的重复基础计算。

动作：

1. 新增共享模块：
   - `packages/whiteboard-engine/src/domains/node/interaction/shared/geometry.ts`
2. 迁移并复用函数：
   - `resolveInteractionZoom`
   - `resolveSnapThresholdWorld`
   - `expandRectByThreshold`
3. `node/Rules.ts` 与 `nodeTransform/Rules.ts` 仅保留各自领域逻辑。

涉及文件：

1. `packages/whiteboard-engine/src/domains/node/interaction/node/Rules.ts`
2. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/Rules.ts`

完成标准：

1. 重复函数在两个文件中清零。
2. 交互行为与基线一致，bench 不回退。

## Phase 2：会话判定单点化（P0）

目标：减少 `Planner` 重复 guard 和状态分叉。

动作：

1. 新增 `active session` 读取/校验共享模块（例如 `shared/sessionGuard.ts`）。
2. `node/Planner.ts` 与 `nodeTransform/Planner.ts` 统一使用该模块校验：
   - pointerId 匹配
   - interaction kind 匹配
   - 失效时统一清理策略
3. 保持 `SessionStore` 仅做局部拖拽中间态，不再承载会话有效性规则。

涉及文件：

1. `packages/whiteboard-engine/src/domains/node/interaction/node/Planner.ts`
2. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/Planner.ts`
3. `packages/whiteboard-engine/src/domains/node/interaction/node/SessionStore.ts`
4. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/SessionStore.ts`

完成标准：

1. `Planner` 中会话 guard 逻辑收敛到单点调用。
2. cancel/end 后 transient 状态清理一致。

## Phase 3：拆分 CommitCompiler（P1）

目标：降低单文件认知负担，明确“规则计算”和“operation 归一化”边界。

动作：

1. 将 `node/CommitCompiler.ts` 拆为三类职责：
   - patch 聚合
   - group drop 规则
   - patch 归一化与 operation 编译
2. `nodeTransform/CommitCompiler.ts` 与 drag compiler 共享 patch 归一化工具。
3. 优先引入纯函数模块，避免引入新状态容器。

涉及文件：

1. `packages/whiteboard-engine/src/domains/node/interaction/node/CommitCompiler.ts`
2. `packages/whiteboard-engine/src/domains/node/interaction/nodeTransform/CommitCompiler.ts`

完成标准：

1. `CommitCompiler` 单文件圈复杂度明显下降。
2. `node.update` patch 结果与原实现一致。

## Phase 4：收敛 Gateway/Lifecycle 职责（P1）

目标：让 `Gateway` 只保留“输入编排”，将 reset/cancel 等生命周期动作外提。

动作：

1. 新增 node interaction lifecycle 协调模块（例如 `NodeInteractionLifecycle`）。
2. `Gateway.ts` 保留 `start/update/end/cancel` 语义输入入口。
3. `resetTransientState`、`cancelInteractions` 从 Gateway 抽离，统一在生命周期组合层调用。

涉及文件：

1. `packages/whiteboard-engine/src/domains/node/interaction/Gateway.ts`
2. `packages/whiteboard-engine/src/instance/create.ts`

完成标准：

1. `Gateway` 不再承担跨域清理编排。
2. 生命周期动作入口清晰且单点。

## Phase 5：评估是否拆 `whiteboard-ui`（P2）

目标：在边界稳定后，再判断拆包收益是否成立。

评估清单（全满足才拆）：

1. 输入语义接口稳定（至少 2 个迭代无破坏性变更）。
2. 至少存在 2 个 UI 宿主复用同一输入适配能力。
3. 拆包后能减少跨包循环依赖，而非仅换目录。

若满足，建议拆分目标：

1. `packages/whiteboard-react` 保留 React 组件与 hooks。
2. 新 `packages/whiteboard-ui` 承载输入映射、通用样式 token、可复用 UI schema。
3. Engine 继续只暴露语义输入与 query/commands。

---

## 6. 风险与控制

1. 风险：重构后吸附/旋转手感漂移。  
   控制：Phase 0 基线 + 每阶段回放 checklist。

2. 风险：会话清理遗漏导致“卡住交互”。  
   控制：统一 cancel/end 清理路径，并强制经过 lifecycle 入口。

3. 风险：拆分过细导致跨文件跳转成本上升。  
   控制：只按职责切块，不按“函数数量”机械切分。

---

## 7. 验收指标

1. 可维护性：
   - `node`/`nodeTransform` Rules 重复基础函数清零。
   - Planner 会话 guard 单点化。
   - `node/CommitCompiler.ts` 逻辑分层完成。

2. 行为一致性：
   - drag/resize/rotate/cancel 行为与基线一致。
   - group drop 逻辑与历史记录语义不变。

3. 性能：
   - `drag-frame`、`node-transform-frame`、`edge-routing-frame` 基线不回退。

---

## 8. 建议实施顺序（最小风险）

1. Phase 0 -> Phase 1（先减重复、低风险高收益）
2. Phase 2 -> Phase 3（再减认知负担）
3. Phase 4（最后改组合层入口）
4. Phase 5（条件满足再拆 `whiteboard-ui`）

一句话原则：先收敛边界，再决定拆包；先消除重复，再触碰流程主干。
