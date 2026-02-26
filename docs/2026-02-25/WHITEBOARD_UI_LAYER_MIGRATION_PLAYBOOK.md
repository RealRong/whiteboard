# Whiteboard UI 层职责迁移清单与落地手册

## 1. 目标

把交互期复杂度从 Engine 下沉到 React UI 层，Engine 只保留必要的真值与规则，降低跳转和职责分散。

目标边界：

1. UI 负责：pointer 生命周期、draft、snap 命中、guide 视觉反馈。
2. Engine 负责：document 真值、commands 提交、query 只读几何、历史与一致性。

---

## 2. 判断标准：哪些适合迁到 UI

满足以下任一项，优先迁到 UI：

1. 该状态只在拖拽/悬停期间存在，结束即失效（transient）。
2. 该逻辑强依赖 DOM 事件时序（down/move/up/cancel/blur/escape）。
3. 该数据只用于视觉反馈，不参与最终文档真值。
4. 该逻辑需要频繁刷新（每帧/高频 move），但不应污染全局业务状态。

不满足时通常留在 Engine：

1. 会写入文档（create/update/delete）。
2. 是跨宿主一致性的业务规则。
3. 是历史、撤销重做、mutation 合并等写链路语义。

---

## 3. 迁移范围清单

### 3.1 适合迁移到 UI（建议迁移）

1. `edgeConnect` 的会话编排：active pointer、move/up/cancel、reconnect 生命周期。
2. `snap` 命中判定（交互期）：最近锚点候选、阈值命中、优先级。
3. `guide` 计算与渲染：对齐线、吸附提示线、高亮点。
4. `nodeDrag`/`nodeTransform` 的交互期 preview 与 guide 可视状态。
5. `edgeRouting` 的交互期 preview、hover 高亮与临时路由点可视反馈。
6. DOM target 解析、pointer capture、preventDefault/stopPropagation 策略。

### 3.2 建议保留在 Engine（不迁移）

1. `commands.*` 写入口与 mutation 语义。
2. 历史系统（undo/redo）与批处理提交。
3. 只读 query 能力（`nodeRect`、`anchorFromPoint`、`nearestSegment` 等）。
4. 文档完整性与业务约束（例如非法 patch 过滤、边创建合法性校验）。

---

## 4. 推荐实现方式

## 4.1 UI 统一交互编排层

在 `packages/whiteboard-react` 建立统一编排约定：

1. 每个能力一个语义 hook（例如 `useEdgeConnectInteraction`）。
2. hook 内维护 active session（`pointerId + draft`）。
3. `window` 级监听统一处理 `pointermove/up/cancel + blur + Escape`。
4. 只在 commit 时调用 Engine command 或 domain commit。

推荐目录：

1. `packages/whiteboard-react/src/common/interaction/`（共享编排工具）
2. `packages/whiteboard-react/src/common/interaction/snap/`（纯几何 snap 计算）
3. `packages/whiteboard-react/src/common/interaction/guide/`（guide 计算与模型）

## 4.2 UI transient 状态模型

建议使用 Jotai（或 hook 局部 state）维护以下状态：

1. `activeSession`：当前交互类型 + pointerId。
2. `draft`：当前 feature 的临时模型（连接端点、拖拽位移、旋转角度等）。
3. `snapState`：当前命中候选与命中点。
4. `guideState`：当前可视 guide 列表。

原则：这些状态不进入 Engine 文档真值。

## 4.3 Engine 接口收敛

Engine 仅暴露：

1. `instance.query.*`：交互计算需要的只读数据。
2. `instance.commands.*`：交互结束后的写入。
3. （可选）极薄 `interactionKernel`：纯规则函数，不保留 session。

---

## 5. 分阶段落地步骤

## Phase A：UI 接管编排（保持 Engine API 兼容）

1. UI 新增交互 hook，接管 pointer 生命周期。
2. Engine 原 session 只保留兼容通道，不再新增能力。
3. 验证行为与回归。

验收：

1. 交互链路能在 UI 层完整跑通。
2. Engine 不再新增 pointer session 类型。

## Phase B：迁移 snap/guide 到 UI

1. 把 snap/guide 从 engine render transient 移到 UI transient 状态。
2. 引入纯函数模块：输入 query snapshot + pointer，输出 snap/guide 模型。
3. 组件直接渲染 UI transient。

验收：

1. `edgeConnect`/`nodeDrag`/`nodeTransform` 交互视觉结果与迁移前一致。
2. Engine 侧对应 transient 状态不再被写入。

## Phase C：删除 Engine 交互状态机残留

1. 删除对应 `input/sessions/*` 与 `domains/*/interaction` 的会话编排代码。
2. 保留 command/query 和必要纯规则。
3. 清理类型与导出，收敛 public API。

验收：

1. Engine 交互层无 DOM/事件生命周期逻辑。
2. UI 是唯一 pointer 生命周期入口。

---

## 6. 文件级改造建议（优先顺序）

1. `packages/whiteboard-react/src/common/interaction/`：新增统一会话编排基建。
2. `packages/whiteboard-react/src/*/hooks/*Interaction.ts`：统一接入基建。
3. `packages/whiteboard-react/src/edge/components/` 与 `node/components/`：只组合 hook 与视图。
4. `packages/whiteboard-engine/src/input/sessions/`：逐步下线会话。
5. `packages/whiteboard-engine/src/domains/*/interaction/`：收敛为纯规则/提交。

---

## 7. 风险与防护

风险：

1. UI 各 feature 各自绑定 window 事件，导致重复和竞态。
2. snap/guide 算法在多个 hook 复制。
3. preview 与 commit 结果不一致。

防护：

1. 统一 `activeSession` 锁，任何时刻仅允许一个高优先级交互。
2. snap/guide 必须走共享纯函数，不允许 feature 私有复制。
3. 每次 `pointerup` 前先执行一次最终 `updateDraft`，再 `commit`。

---

## 8. 迁移完成判定

满足以下条件即可认为“UI 接管交互”完成：

1. `edgeConnect/snap/guide` 全部在 UI 层编排与渲染。
2. Engine 不再维护这些交互的会话状态机。
3. Engine 保持 query + commands 的稳定边界。
4. `lint + bench + 回归清单` 全部通过。

---

## 9. 一句话结论

`edgeConnect + snap + guide` 迁到 UI 层是合理且更简单的方向；Engine 应收敛为“只读几何 + 写入命令 + 一致性规则”的最小核心。
