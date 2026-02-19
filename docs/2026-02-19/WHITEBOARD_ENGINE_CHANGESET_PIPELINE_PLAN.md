# WHITEBOARD_ENGINE_CHANGESET_PIPELINE_PLAN

## 1. 背景与核心判断

当前复杂度的主要来源不是“功能多”，而是“写入路径分叉”：

1. 路径 A：命令/交互直接触发增量更新（dispatch/commands）。
2. 路径 B：外部 doc 变化后，内部再解析/投影/修复。

两条写路径并存会带来：

1. 状态一致性难题（同一语义在两处实现）。
2. 失效粒度放大（更容易 full sync）。
3. 生命周期和 watcher 复杂（大量兜底逻辑）。
4. 性能波动（不可控重算与重复解析）。

结论：应改为**单写入口**，仅接受统一变更指令（下文称 `Change` / `ChangeSet`），所有状态更新都走同一 `apply` 管线。

---

## 2. 目标与非目标

### 2.1 目标

1. `instance.apply` 成为唯一写入口。
2. 所有 commands/interaction 仅产出 `ChangeSet`，不直接写 doc。
3. 任何全量替换也必须走管线（如 `doc.reset` 变更类型）。
4. 变更影响域可追踪（按 domain/key 增量失效）。
5. 统一事件、历史、调试指标产出。

### 2.2 非目标

1. 不保留旧兼容层（项目当前可一步到位）。
2. 不在此阶段引入新的业务功能。
3. 不把 UI/React 逻辑放入 engine 核心。

---

## 3. 术语规范

建议统一术语，避免 `op/patch/action` 混用：

1. `Change`：单条变更。
2. `ChangeSet`：一组有顺序的 `Change`（原子提交单元）。
3. `Apply`：执行 `ChangeSet` 的统一流程。
4. `Snapshot`：某一时刻完整只读快照（输出/导出用途）。
5. `DocReset`：通过变更管线执行的“全量重置”类型。

---

## 4. 目标架构（最终形态）

```text
External Input (UI / Collaboration / Import)
  -> Intent Layer (commands, interaction) [produce ChangeSet only]
  -> instance.apply(changeSet, meta)
      -> validate
      -> normalize
      -> reduce(state)
      -> collect affected keys/domains
      -> invalidate derive/cache
      -> emit events
      -> record history
  -> query/view consume derived state
```

关键原则：

1. 写路径唯一：只允许 `apply`。
2. 读写分离：query/view 永不写状态。
3. 增量优先：所有失效与重算都按 key/domain 精确触发。

---

## 5. API 设计（行业规范 + 项目规范）

### 5.1 顶层 API

1. `instance.apply(changeSet, options?)`：唯一公开写入口。
2. `instance.tx(run, options?)`：事务辅助（内部仍转为一个 `ChangeSet`）。
3. `instance.events.on/off`：统一事件订阅。

### 5.2 Commands / Interaction 角色

1. `commands.*`：领域语义 API（如 `commands.node.move`），内部只构造 `ChangeSet` 并调用 `apply`。
2. `runtime.interaction.*`：手势状态机与事件处理，结束时同样提交 `ChangeSet`。
3. 禁止直接调用 `core.dispatch` 或直接写 doc/state（仅 `apply` 可写）。

### 5.3 Snapshot 与导入

1. 外部不允许直接替换 doc。
2. 导入/远端全量同步统一为：
   - `apply([{ type: 'doc.reset', snapshot }])`
3. 保证历史、事件、失效逻辑仍走同一管线。

---

## 6. Change Schema 设计

### 6.1 包装结构

每个 `ChangeSet` 包含统一元信息：

1. `id`（唯一）
2. `docId`
3. `source`（ui | shortcut | remote | import | system）
4. `actor`（可选，用于协作）
5. `timestamp`
6. `changes: Change[]`

### 6.2 Change 分类（建议）

1. `doc.*`：`doc.reset`
2. `node.*`：create/update/delete/move/resize/rotate/reparent/order
3. `edge.*`：create/update/delete/connect/reconnect/routing
4. `group.*`：group/ungroup/autofit
5. `mindmap.*`：insert/move/reorder/layout
6. `viewport.*`：set/pan/zoom
7. `selection.*`：set/toggle/clear/box
8. `transient.*`：仅运行态可视状态（必要时单独通道）

### 6.3 规范约束

1. 每个 Change 必须是幂等可验证结构。
2. 变更执行顺序不可重排（同一 ChangeSet 内有序）。
3. 同类字段命名统一（如都用 `nodeId`，不用 `id/nodeID` 混搭）。

---

## 7. Apply 管线细化

`instance.apply` 的标准步骤：

1. **Validate**：schema、字段、业务前置条件检查。
2. **Normalize**：补齐默认值、坐标/单位归一、去别名。
3. **Reduce**：写入 canonical state（唯一写点）。
4. **Collect Affected**：收集受影响 domain/key/id。
5. **Invalidate**：驱动 derive/cache 精确失效。
6. **Emit Events**：输出变更事件和聚合事件。
7. **History**：记录 undo/redo entry（可按 meta 跳过）。
8. **Metrics**：记录耗时、命中率、重算计数。

---

## 8. 状态与性能设计

### 8.1 Canonical State

推荐采用 normalized 结构：

1. `nodesById`, `nodeOrder`
2. `edgesById`, `edgeOrder`
3. `mindmapsById`
4. `viewport`, `selection`
5. 必要 transient 分区（拖拽、连接、框选等）

### 8.2 Revision/Dirty 机制

至少三层 revision：

1. 全局 revision（调试与快照一致性）
2. 领域 revision（node/edge/mindmap/viewport）
3. key/id revision（如 `node:123`, `edge:abc`）

derive/cache 只响应最小必要 revision 变化。

### 8.3 事件驱动增量优先

对高频交互（drag/resize/connect）：

1. 优先基于 `Change` 直接标记受影响 key。
2. 禁止“先全量 doc 替换，再二次解析出 dirty”。

---

## 9. 目录组织建议（简洁且可扩展）

```text
packages/whiteboard-engine/src
  api/
    apply.ts                # instance.apply 对外适配
    tx.ts                   # 事务包装
  change/
    schema.ts               # Change / ChangeSet 类型与校验入口
    validate.ts
    normalize.ts
    reducer/
      node.ts
      edge.ts
      mindmap.ts
      viewport.ts
      selection.ts
      doc.ts
    pipeline.ts             # validate -> normalize -> reduce -> emit
  kernel/
    state/
      store.ts              # canonical state
      revision.ts           # revision/dirty 基础设施
    derive/
    cache/
    event/
  runtime/
    interaction/            # 仅交互状态机与手势逻辑
    lifecycle/              # DOM 绑定与生命周期（薄层）
  query/
  view/
```

设计要点：

1. `change/` 只负责“写模型”。
2. `query/view` 只负责“读模型”。
3. `runtime/lifecycle` 不做业务写逻辑，只转发事件与配置。

---

## 10. 命名规范（项目落地规则）

### 10.1 通用规则

1. 文件/目录：语义优先，避免重复前后缀。
2. 类名：PascalCase。
3. 函数/变量：camelCase。
4. 类型：PascalCase，必要时以 `Options`/`State`/`Result` 结尾。
5. 事件名：`domain.action`（如 `node.updated`）。

### 10.2 避免冗余

1. 目录已表达语义时，文件名不要重复域词：
   - `runtime/interaction/NodeDrag.ts`（而非 `NodeDragInteraction.ts`）
2. 禁止多重“包装转发”命名：
   - 不使用 `createXxx().createYyy()` 链式壳层。

### 10.3 单一写入口命名

1. 推荐：`apply`、`tx`。
2. 不建议混用多个顶层写词（如 `dispatch/commit/mutate/apply` 并存）。

---

## 11. 分阶段迁移计划（无兼容层版本）

### Phase 1：建立 change 内核

1. 创建 `change/schema + validate + normalize + reducer + pipeline`。
2. 实现 `instance.apply`。
3. 先把现有一条命令链接入 `apply` 验证闭环。

### Phase 2：命令全面迁移

1. `commands.*` 全部改为“生成 ChangeSet -> apply”。
2. 删除命令侧直接写 state/doc 的路径。

### Phase 3：交互全面迁移

1. `runtime/interaction/*` 完成统一提交。
2. 拖拽/变形/连线等高频路径按 key 级失效优化。

### Phase 4：移除 doc 直写入口

1. 删除外部 doc replace API。
2. 导入/同步改为 `doc.reset` change。
3. 删除与 doc 直写相关 watcher/兜底逻辑。

### Phase 5：性能与可观测性

1. 接入重算计数、命中率、耗时采样。
2. 建立回归 benchmark 与性能门槛。

### 11.1 当前落地状态（2026-02-19）

1. Phase 1：已完成。
2. Phase 2：已完成（命令写入统一走 `apply`，保留 `history` 读写直连 core）。
3. Phase 3：已完成（核心交互写入统一走 `apply`）。
4. Phase 4：已完成（外部 `commands.doc.replace` 入口已移除；`doc.reset` 已统一走 apply；doc 直写兜底 watcher 已移除）。
5. Phase 5：已完成（已接入 `change.applied` 事件、view/query 的重算命中率与耗时采样；已建立 `bench:drag-frame:check`（`P95<4ms`）与 `bench:node-hint:check`（按场景 `p95<budget`）双门槛，提供 `bench:check` 一键回归入口，并通过 CI workflow 固化阈值守护）。
6. Phase 6：已完成（`core.dispatch` 与 `core.commands` 对外入口已删除，统一收敛到 `core.apply.build/apply.operations/apply.changeSet`；`engine` 的 `change/reduce.ts` 已移除 `core.commands.*` 依赖，并将节点/边更新删除、顺序、分组、viewport 等主路径迁移到 `core.apply.operations`，创建类与 mindmap 通过 `core.apply.build + core.apply.operations` 提交；同时已打通 `change.source -> core origin` 传递。`core` 的 `history/transaction` 已收敛为顶层 `core.history` 与 `core.tx`，history 内核已从 snapshot 方案切换为 operation 逆操作方案；最终触发策略定稿为“engine 触发、core 执行”——engine 通过 `instance.commands.history` 发起，core 负责逆操作与原子应用）。

### 11.2 core 最小化保留方案（与 engine 的最终边界）

目标：保留 `core` 作为“纯文档内核”，让 `engine` 负责运行时编排与渲染适配。

1. `core` 保留：
   - 文档模型与类型（node/edge/mindmap/order/viewport）。
   - 领域约束与校验（结构合法性、引用完整性、顺序一致性）。
   - 纯函数 reducer（`applyChange` / `applyChangeSet`，输入 doc+change，输出 next doc + affected）。
   - 可选纯历史算法（基于 changeSet 的 undo/redo，不依赖 DOM/框架）。
2. `core` 移除：
   - 运行时交互语义（drag/resize/connect 手势状态）。
   - 生命周期与事件绑定（container/window/document 监听）。
   - 视图投影与渲染缓存（graph/view/query 层）。
   - 任何 React/DOM 相关概念。
3. `engine` 保留：
   - `instance.apply/tx` 管线编排（validate/normalize/reduce/invalidate/emit/metrics）。
   - runtime interaction、services、lifecycle。
   - graph/query/view 和增量缓存。
   - 对 UI 框架的薄适配（React 仅绑定容器与渲染）。

### 11.3 与现有 Phase 1-5 的联合落地方式

在不打断当前计划的前提下，追加“core 收敛”子任务：

1. Phase 1（已完成）对齐：
   - 保持 `Change/ChangeSet` 为跨层唯一写语义。
   - 在 `core` 新增纯 reducer 入口定义（先允许内部适配旧 commands）。
2. Phase 2（已完成）对齐：
   - `commands.* -> apply` 保持不变。
   - 开始把 `change/reduce.ts` 中 `core.commands.*` 调用逐步替换为 `core.apply.operations(...)`。
3. Phase 3（已完成）对齐：
   - 交互层继续只产出 `ChangeSet`。
   - 禁止交互直接依赖 `core.commands`，只依赖 `instance.apply`。
4. Phase 4（已完成）联动：
   - 删除 `commands.doc.replace` 暴露口，统一 `doc.reset`。
   - 去除“doc 直写兜底 watcher”，只保留 change 驱动的同步链路。
5. Phase 5（已完成）联动：
   - 可观测统一以 `apply` 为主：`change.applied`、重算计数、命中率、耗时。
   - `core` 仅提供可选 affected 信息，不做运行时指标聚合。
6. Phase 6（新增，core 收敛完成阶段）：
   - 已完成：删除 `core.commands` 对外入口。
   - 已完成：engine 的 reduce 不再依赖 `core.commands.*`，统一走 `core.apply.build + core.apply.operations`。
   - 已完成：history 统一基于 operation 逆操作；触发边界收敛为“engine 发起，core 原子执行”，避免双写与重复编排。
   - 完成后形成稳定边界：
     - `core`: pure model kernel
     - `engine`: runtime + projection + host adapters

### 11.4 执行顺序（最小风险）

1. Phase 4 与 Phase 6 已完成，写入口与 history 边界已收敛。
2. Phase 5 已完成，后续按需扩展关键路径 benchmark 覆盖。
3. 当前可进入目录/命名最终清理阶段，避免重复重构。

---

## 12. 验收标准（Done Definition）

满足以下条件才算完成：

1. 引擎只有一个写入口：`instance.apply`。
2. 全部 commands/interaction 已迁移到 `ChangeSet` 管线。
3. 不存在外部可直接替换 doc 的入口。
4. derive/cache 失效具备 key/domain 粒度。
5. 事件、历史、调试指标全部由 apply 管线统一产出。
6. 关键交互路径性能不低于当前基线，并具备 benchmark 证明。

---

## 13. 风险与治理

1. 风险：迁移期行为漂移。  
   治理：分域迁移 + 每域回归样例（node/edge/mindmap）。

2. 风险：Change schema 膨胀。  
   治理：按 domain 拆文件，禁止巨型 union 单文件。

3. 风险：历史记录粒度不合理。  
   治理：`tx` 定义事务边界，支持合并策略。

4. 风险：临时状态污染持久状态。  
   治理：`transient.*` 与持久 domain 明确分层。

---

## 14. 本文档约束结论

从当前阶段开始，建议将“外部可直接改 doc”的能力视为架构反模式。  
最终模型应为：

1. 外部输入 -> `ChangeSet`
2. 引擎统一 `apply`
3. 内部统一失效/事件/历史
4. UI 仅做薄适配与渲染

这条路线最符合当前项目目标：**性能优先、结构简洁、可长期演进**。
