# Whiteboard Engine 领域化分层设计与实现方案

日期：2026-02-25
适用范围：`packages/whiteboard-engine`（覆盖 node / edge / mindmap / selection / viewport 等）

---

## 1. 背景与核心问题

当前结构历史上按技术层横向组织（`input/domain`、`runtime/actors`、`runtime/query`、`runtime/view`、`runtime/render`）。

结果是：

1. 同一领域（例如 node）分散在多个顶层目录，阅读和定位成本高。
2. 新人要理解一个行为链路（如拖拽）必须跨多个目录跳转。
3. 容易出现“分层存在，但领域边界弱化”的问题。

目标不是取消分层，而是改为：

1. 先按领域纵向聚合。
2. 在领域内部再做清晰分层。
3. 统一每个领域的对外 API 入口，避免外部深层 import。

---

## 2. 设计目标

1. `node/edge/mindmap/selection/viewport` 都有单一领域根目录。
2. 每个领域都有固定子层：`api / commands / interaction / query / view / model`。
3. 持久化写入仍只走 mutation 主链，不新增第二写路径。
4. 高频交互临时态仍写 `render`，语义状态写 `state`，文档真值写 `document`。
5. React/上层业务只依赖领域 API，不依赖底层实现目录。

---

## 3. 分层原则（领域内）

每个领域遵循同一套层次：

1. `api`：唯一对外门面（Facade）。
2. `commands`：持久化业务动作（落库）。
3. `interaction`：高频交互会话与瞬态输出（不直接改 document）。
4. `query`：只读计算与命中测试。
5. `view`：面向 UI 的派生结构。
6. `model`：该领域共享类型、规则、常量。

实现约定（简化复杂度）：

1. `commands` 默认使用函数工厂（如 `createXxxCommands`），不强制使用 Actor class。
2. 仅在确实需要 `start/stop` 的运行时订阅能力时才保留 service 类。

写入规则：

1. `commands` -> `mutate` -> `WriteCoordinator` -> `MutationExecutor` -> `document/projection`。
2. `interaction` -> `InteractionWriter` -> `render/state/mutate(interaction)`。
3. `query/view` 只读，禁止写状态。

---

## 4. 目标目录（建议）

```text
packages/whiteboard-engine/src/
  app/
    engine.ts                 # createEngine 组装层（composition only）
  infra/
    mutation/                 # WriteCoordinator / MutationExecutor / Impact
    history/                  # HistoryDomain
    lifecycle/                # Lifecycle
    scheduler/                # Scheduler / TaskQueue
    events/                   # EventCenter / publishers
  stores/
    document/                 # DocumentStore
    state/                    # StateStore
    render/                   # RenderStore / RenderCoordinator
    projection/               # ProjectionStore + cache/projectors
  domains/
    node/
      api.ts
      commands/
      interaction/
      query/
      view/
      model/
    edge/
      api.ts
      commands/
      interaction/
      query/
      view/
      model/
    mindmap/
      api.ts
      commands/
      interaction/
      query/
      view/
      model/
    selection/
      api.ts
      commands/
      interaction/
      query/
      view/
      model/
    viewport/
      api.ts
      commands/
      interaction/
      query/
      view/
      model/
    shared/
      interaction/            # InteractionWriter / interactionSession
  input/
    core/                     # InputPort / SessionEngine（只做路由）
    sessions/                 # pointer session 壳
    shortcut/
  shared/
    selection.ts
    interactionSession.ts
```

说明：

1. 这不是“减少层数”，而是“把层放进每个领域内部”。
2. `stores/*` 与 `infra/*` 是跨领域基础设施，保持横向共享。

---

## 5. 领域 API 统一约定

每个领域必须导出一个 `createXxxDomainApi`，并在 `api.ts` 里暴露：

1. `commands`：持久化语义。
2. `interaction`：高频交互语义。
3. `query`：只读查询。
4. `view`：UI 派生读取与订阅。

示例（Node）：

```ts
export type NodeDomainApi = {
  commands: {
    create: ...
    update: ...
    delete: ...
    setOrder: ...
  }
  interaction: {
    drag: { start: ..., update: ..., end: ..., cancel: ... }
    transform: { startResize: ..., startRotate: ..., update: ..., end: ..., cancel: ... }
  }
  query: {
    byId: ...
    rect: ...
    hitTest: ...
  }
  view: {
    subscribeNode: (id, listener) => () => void
    getNodeView: (id) => NodeViewItem | undefined
  }
}
```

组合层对外可继续提供：

1. `instance.commands.node.*`（兼容旧调用）。
2. `instance.node(id).commands.* / interaction.* / query.*`（新 Facade 体验层）。

---

## 6. 各领域落地模板

### 6.1 Node

职责：节点 CRUD、排序、分组、拖拽、变换、吸附、预览。

建议拆分：

1. `domains/node/commands/`：从 `runtime/actors/node/Actor.ts` 抽出持久化命令。
2. `domains/node/interaction/`：承接 `input/domain/node/*` 与 writer 输出。
3. `domains/node/query/`：承接 `runtime/actors/node/query/*` + `runtime/query` 中 node 相关读取。
4. `domains/node/view/`：承接 `runtime/view/NodeDomain.ts`、`NodeRegistry.ts`、`NodeProjectionCache.ts`。
5. `domains/node/model/`：放 node 规则和中间类型。

### 6.2 Edge

职责：边 CRUD、连接创建/重连、路由点编辑、路径预览。

建议拆分：

1. `domains/edge/commands/`：来自 `runtime/actors/edge/Actor.ts`。
2. `domains/edge/interaction/`：整合 `input/domain/edge/*`（connect/routing）。
3. `domains/edge/query/`：整合 `runtime/actors/edge/query/*` 与 edgePath query。
4. `domains/edge/view/`：整合 `runtime/actors/edge/view/*` + `runtime/view/EdgeDomain.ts`。
5. `domains/edge/model/`：连接状态、路由状态、校验规则。

### 6.3 Mindmap

职责：树结构命令、布局、插入规则、拖拽重排。

建议拆分：

1. `domains/mindmap/commands/`：从 `runtime/actors/mindmap/Actor.ts` 拆出命令组（文件过大）。
2. `domains/mindmap/interaction/`：承接 `input/domain/mindmap/*`。
3. `domains/mindmap/query/`：承接 `runtime/actors/mindmap/query/*`。
4. `domains/mindmap/view/`：承接 `runtime/actors/mindmap/view/*` + `runtime/view/MindmapDomain.ts`。
5. `domains/mindmap/model/`：布局 hint、插入策略、drop 模型。

### 6.4 Selection

职责：节点/边选择语义、框选、全选、清空、复制/删除流程协作。

建议拆分：

1. `domains/selection/commands/`：从 `runtime/actors/selection/Actor.ts` 拆出语义命令。
2. `domains/selection/interaction/`：承接 `input/domain/selection/*`。
3. `domains/selection/query/`：可选，放选择快照读取与辅助判定。
4. `domains/selection/model/`：统一 `applySelection` 规则（单源）。

### 6.5 Viewport

职责：视口命令、预览手势、坐标换算、容器尺寸。

建议拆分：

1. `domains/viewport/commands/`：承接 `runtime/actors/viewport/Domain.ts` 的命令语义。
2. `domains/viewport/interaction/`：`runtime/render/viewport/*` + input wheel/pan 路径。
3. `domains/viewport/query/`：基于 `ViewportRuntime` 暴露只读 getter。
4. `domains/viewport/model/`：锚点缩放参数、阈值、约束模型。

---

## 7. 旧结构到新结构映射（第一批）

| 旧路径 | 新路径（建议） | 备注 |
| --- | --- | --- |
| `runtime/actors/node/*` | `domains/node/commands|query|model/*` | 先拆 commands 与 query |
| `input/domain/node/*` | `domains/node/interaction/*` | 交互层并入 node 领域 |
| `runtime/view/Node*` | `domains/node/view/*` | 领域内 view 派生 |
| `runtime/actors/edge/*` | `domains/edge/commands|query|view/*` | 去除横切引用 |
| `input/domain/edge/*` | `domains/edge/interaction/*` | connect/routing 聚合 |
| `runtime/actors/mindmap/*` | `domains/mindmap/commands|query|view/*` | 先拆 631 行大文件 |
| `input/domain/mindmap/*` | `domains/mindmap/interaction/*` | 拖拽交互归域 |
| `runtime/actors/selection/*` | `domains/selection/commands/*` | 语义命令层 |
| `input/domain/selection/*` | `domains/selection/interaction/*` | 框选会话层 |
| `runtime/viewport.ts` | `domains/viewport/query|model/*` + `stores` | 视口能力域化 |

---

## 8. 实施路线（不考虑重构成本）

### Phase A：骨架与兼容层

1. 新建 `domains/*/api.ts` 骨架（node/edge/mindmap/selection/viewport）。
2. 在 `instance/create.ts` 注入领域 API，同时保留旧 `instance.commands` 代理。
3. 新增禁止深层 import 规则（外部只能从 `domains/*/api` 进入）。

### Phase B：Node 纵切收敛

1. 迁移 node commands/query/view/interaction 到 `domains/node/*`。
2. 直接切换调用路径，不保留兼容 re-export。
3. 删除 node 领域横切引用与旧实现文件。

### Phase C：Edge 纵切收敛

1. 迁移 edge commands/query/view/interaction 到 `domains/edge/*`。
2. 统一 routing/connect 的输出写入策略。
3. 删除 `input/domain/edge` 对 `runtime/actors/edge/*` 深依赖。

### Phase D：Mindmap 纵切收敛

1. 将 `runtime/actors/mindmap/Actor.ts` 拆成 `commands/*` 子模块。
2. layout hint / insert / drop 规则落入 `model/*`。
3. interaction 与 commands 的共享规则统一通过 `model/*` 暴露。

### Phase E：Selection 与 Viewport 收敛

1. selection 的 box 交互与语义命令统一到 `domains/selection/*`。
2. viewport 命令/交互/query 统一到 `domains/viewport/*`。

### Phase F：清理与收口

1. 删除旧目录下空壳实现，仅保留必要 re-export（`input/domain` 已在首轮中删除）。
2. 最终移除兼容 re-export（当前已在 node/edge/mindmap/selection 首轮迁移中执行）。
3. 更新所有文档与架构检查脚本。

---

## 9. 约束与防回退

必须新增并长期启用的约束：

1. `domains/*/query` 禁止 `state.write` / `render.write` / `mutate`。
2. `domains/*/view` 禁止 mutation 写入。
3. `domains/*/interaction` 禁止直接写 `document`。
4. `app/engine.ts` 只允许组装，不写业务逻辑。
5. 领域外代码禁止 import `domains/*` 深层实现。

---

## 10. 验收标准（Definition of Done）

1. 每个核心领域仅一个对外入口：`domains/<name>/api.ts`。
2. 旧横切目录中不再存在 node/edge/mindmap 的核心实现逻辑。
3. 持久化、语义态、临时态三条写入规则不被破坏。
4. `lint/build/bench/test` 通过。
5. 手工交互回归通过（拖拽、缩放、连线、重连、框选、undo/redo、stop/start）。

---

## 11. 对当前团队开发体验的直接收益

1. 理解一个领域只需进一个目录，不再跨 4~6 个顶层目录跳转。
2. 新功能开发按领域做增量，减少“改一处牵多层”的心理负担。
3. 对外 API 更接近 React 组件心智（按实体/领域调用），但保持引擎写路径一致性。
4. 代码评审可以按领域边界审查，问题定位更快。
