# Whiteboard Engine 收敛上限研究（UI 接管 Interaction 后）

## 1. 问题定义

你现在的问题不是“某个函数太长”，而是：

1. 交互编排职责（pointer 生命周期、命中、会话状态）放在 Engine 里导致跳转过深。
2. UI 与 Engine 在 interaction 路径上同时有状态，边界不够清晰。
3. 在把职责迁到 UI 后，Engine 还能继续缩到什么程度没有明确上限。

本文件给出：**Engine 的可收敛上限、不可再缩的硬边界、推荐目标态与迁移路线**。

---

## 2. 当前事实（作为基线）

当前仓库已经具备以下结构：

1. UI 侧已有 DOM 事件归一化和目标映射（`packages/whiteboard-react/src/common/input/DomEventMapper.ts`）。
2. Engine 侧仍保留输入框架（`packages/whiteboard-engine/src/input/*`）和领域交互编排（`packages/whiteboard-engine/src/domains/*/interaction/*`）。
3. `nodeTransform` 已开始 UI 编排迁移：UI 侧接管 pointer 生命周期，Engine 侧保留规则与提交逻辑。
4. 主写入链路仍是正确单入口：`commands -> mutate -> reducer/projection/history`。

这说明当前已经进入“可继续收敛 Engine”的窗口期。

---

## 3. Engine 收敛的四个层级

## L0（现状增强版）

特征：

1. Engine 继续保留 `input/sessions`。
2. UI 仅做 DOM 归一化，不接管业务交互编排。

优点：

1. 多宿主（非 React）复用最容易。

缺点：

1. 复杂度最高，跳转最深。

不推荐作为长期目标。

## L1（当前方向）

特征：

1. UI 接管交互编排（至少 nodeTransform）。
2. Engine 保留 interaction domain 的 kernel + commit。
3. Engine 输入框架仍存在，但逐步降级。

优点：

1. 可渐进迁移，风险可控。
2. 对历史行为冲击小。

缺点：

1. Engine 中仍有“半保留”编排残留。

## L2（推荐长期目标）

特征：

1. Engine 不再承担 pointer session 编排（删除/冻结 `input/sessions` 业务职责）。
2. Engine 对外主要暴露：
   - `commands`（写）
   - `query`（读）
   - `interaction kernels`（纯规则：begin/update/commit/cancel）
3. UI 拥有完整 interaction orchestrator（锁、生命周期、事件策略）。

优点：

1. Engine 复杂度明显下降，但仍保持跨宿主可复用规则核心。
2. 规则一致性、历史一致性仍在 Engine 控制。

缺点：

1. UI 层编排复杂度上升，需要统一 orchestrator。

**这是最平衡、最现实的收敛终点。**

## L3（极限收敛）

特征：

1. Engine 只保留 document/state/mutate/query，连 interaction kernel 都迁出。
2. UI 自己持有 resize/rotate/snap 等规则。

优点：

1. Engine 极小。

缺点：

1. 规则漂移风险高（多个宿主/版本不一致）。
2. 历史行为一致性难保障。
3. 复用价值下降，实际上把复杂度复制到 UI。

**不建议。**

---

## 4. Engine 不可再缩的硬边界（建议永久保留）

以下能力建议“永久留在 Engine”，不应迁到 UI：

1. 文档真值与 mutation pipeline（含 history 语义）。
2. 几何规则的权威实现（resize/rotate/snap/group 规则）。
3. 跨域只读查询索引（query/projection）。
4. 命令语义与约束（commands 的业务 invariants）。

原因：这些是“跨宿主一致性”的核心，迁到 UI 会造成规则分叉。

---

## 5. 可以继续迁到 UI 的职责（建议继续做）

以下职责可以继续从 Engine 迁出：

1. Pointer 生命周期与会话状态机（down/move/up/cancel/escape/blur）。
2. 交互冲突仲裁（drag/transform/connect/routing 的 active lock）。
3. DOM target 解析与 UI 事件策略（capture/bubble、focus、preventDefault）。
4. 预览态组合与渲染策略（仅视觉临时态）。

简单说：**输入设备相关、DOM 相关、生命周期相关**都应留在 UI。

---

## 6. 收敛后的目标形态（L2）

## 6.1 Engine API 目标

Engine 只提供三类入口：

1. `commands.*`：唯一写入口。
2. `query.*`：唯一读入口。
3. `domains.*.interactionKernel.*`：纯规则入口（无 DOM，无全局 session 依赖）。

推荐 kernel 风格：

```ts
begin(input) -> draft
update(draft, intent) -> preview
commit(draft) -> operations
cancel(draft?) -> void
```

其中 `intent` 不暴露键盘实现细节（不要 `altKey/shiftKey`），改为语义约束：

```ts
{
  keepAspect: boolean
  fromCenter: boolean
  snapEnabled: boolean
}
```

## 6.2 UI 目标

UI 统一通过 orchestrator 处理：

1. 事件到语义意图映射。
2. active interaction lock。
3. 调用 kernel 并管理 preview。
4. `end` 时调用 `commands` 提交。

---

## 7. nodeTransform 的激进收敛路径（参考）

## Phase A（已在进行）

1. UI 接管 nodeTransform pointer 编排。
2. Engine 内抽出 `nodeTransform kernel`。

## Phase B（下一步）

1. `Rules.resolveResizeMove` 输入从 `pointer` 收敛为 `cursor + constraints`。
2. 删除 Engine 侧对键盘按键名（alt/shift）的直接耦合。

## Phase C（完成态）

1. `nodeTransform/Planner` 降级为兼容壳或删除。
2. Engine 只留 kernel + commit compiler。

---

## 8. 其他领域可按同模板推进

按收益/风险排序：

1. `nodeDrag`：收益最高，结构与 nodeTransform 最像。
2. `edgeRouting`：次高收益，注意路由点编辑与快捷键冲突。
3. `selectionBox`：迁移简单，注意与快捷键选择模式对齐。
4. `mindmapDrag`：规则较多，建议放后面。

每个领域都遵循同一模板：

1. 先抽 kernel（不改行为）。
2. 再迁 UI 编排。
3. 最后删旧 session/planner。

---

## 9. 可以收敛到什么程度（明确结论）

结论分三句话：

1. **能收敛到 L2**：Engine 不再做 pointer/session 编排，只做 command/query/kernel。  
2. **不建议收敛到 L3**：不要把几何规则和 commit 语义全部搬到 UI。  
3. **最佳终点是“薄运行时 + 厚规则内核”**，而不是“纯存储引擎”。

---

## 10. 迁移过程的判停条件（什么时候别再缩）

出现以下任一情况，建议停止继续向 UI 迁：

1. 同一规则开始在 UI 和 Engine 双份实现。
2. 历史记录语义出现手势级不一致。
3. 非 React 宿主需求变强而 UI 侧编排无法复用。
4. 性能收益已不明显，但维护成本显著上升。

---

## 11. 风险与防护

1. 风险：UI 编排分散，复杂度只是“位置平移”。  
防护：建立统一 `interaction orchestrator`，禁止 feature 各自绑 window 事件。

2. 风险：preview 与 commit 结果不一致。  
防护：`commit` 必须消费同一 `draft`，不重新推导初始参数。

3. 风险：快捷键语义漂移。  
防护：UI 只产出语义 intent，Engine 不再解析按键名。

4. 风险：回归难发现。  
防护：保留 `bench:check` + 增加 pointer 序列回放用例。

---

## 12. 建议执行策略（务实版）

1. 先把 `nodeTransform` 做到 L2 完成态（kernel 纯化 + planner 下线）。
2. 再复制模式到 `nodeDrag`，形成第二个成功样板。
3. 两个样板都稳定后，统一落一份 “interaction orchestrator 规范”。
4. 最后分批清理 Engine 输入框架中不再使用的 session/类型。

一句话：**Engine 还能继续缩，但应收敛到“规则内核 + 数据写链”，不要缩成“只存储不规则”的空壳。**
