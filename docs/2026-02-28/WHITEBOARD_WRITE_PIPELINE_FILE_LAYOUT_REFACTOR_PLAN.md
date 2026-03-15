tool# Whiteboard Write 管线文件排布重构方案（One-Shot / No-Compatibility）

更新时间：2026-02-28

实施进度（2026-02-27）：

1. 已完成阶段 A：`mutation/history/pipeline` 已迁移到 `runtime/write/**`。
2. 已完成阶段 B：`domains/*/commands.ts` 已迁移到 `runtime/write/commands/*`。
3. 已完成阶段 C（第一步）：新增 `runtime/write/runtime/createWriteRuntime.ts`，`instance/create.ts` 已改为通过该工厂装配 write 子系统。
4. 已完成阶段 D：清理 legacy actors 与 `instance.events`，`tool/viewport` 事件桥接删除，`interaction/shortcut/viewport` 写入能力已迁移到 `runtime/write/commands/*`。
5. 已完成阶段 E：`groupAutoFit` 已迁移到 `runtime/write/postMutation/GroupAutoFitRuntime.ts`，`runtime/actors` 目录已退出主流程。
6. 验证通过：`@whiteboard/engine` 与 `@whiteboard/react` 的 `lint/build` 均通过。

## 1. 结论

结论：**应该把 write 相关管线放在一块**，并且以“写入流程阶段”组织目录。历史分散目录（`runtime/mutation`、`runtime/history`、`domains/*/commands.ts`）已完成清理。

当前代码虽然功能上已经单管线（`commands -> mutate -> mutationMeta -> read/query`），但文件排布仍然分散，导致：

1. `instance/create.ts` 同时 import 多个目录，装配噪音大。
2. 新人阅读时很难一眼看出 write 全链路边界。
3. 语义规则（mutation analyzer）与执行器（executor）不在同一垂直目录，维护成本高。

---

## 2. 现状排布（已调研）

当前 write 主链路已收敛到 `runtime/write/**`：

1. 写入执行：`packages/whiteboard-engine/src/runtime/write/pipeline/*`
2. mutation 语义：`packages/whiteboard-engine/src/runtime/write/mutation/*`
3. 历史栈：`packages/whiteboard-engine/src/runtime/write/history/*`
4. 写入入口（commands）：`packages/whiteboard-engine/src/runtime/write/commands/*`
5. 提交后运行时：`packages/whiteboard-engine/src/runtime/write/postMutation/*`

当前剩余问题主要是文档与术语需要持续跟随代码更新，避免把已删除目录继续作为“现状”描述。

---

## 3. 目标排布（建议）

目标：把 write 相关实现统一收拢到 `runtime/write/` 下，按“入口/语义/执行/历史”四层组织。

```text
packages/whiteboard-engine/src/runtime/write/
  index.ts

  runtime/
    createWriteRuntime.ts

  commands/
    node.ts
    edge.ts
    mindmap.ts
    selection.ts
    interaction.ts
    shortcut.ts
    viewport.ts
    index.ts

  pipeline/
    MutationExecutor.ts
    WriteCoordinator.ts
    MutationMetaBus.ts

  postMutation/
    GroupAutoFitRuntime.ts

  mutation/
    Analyzer.ts
    Impact.ts
    PatchClassifier.ts
    index.ts

  history/
    HistoryDomain.ts
```

说明：

1. `commands/*` 仍保留“按领域分文件”的语义分组，但物理上归入 write 目录，明确其写入入口角色。
2. `mutation/*` 明确归为 write 语义层，避免被误解为独立 runtime 子系统。
3. `history/*` 和 `pipeline/*` 同属 write 流程，应该邻近。

---

## 4. 文件迁移映射

### 4.1 目录迁移

1. `src/runtime/mutation/*` -> `src/runtime/write/mutation/*`
2. `src/runtime/history/HistoryDomain.ts` -> `src/runtime/write/history/HistoryDomain.ts`
3. `src/runtime/write/MutationExecutor.ts` -> `src/runtime/write/pipeline/MutationExecutor.ts`
4. `src/runtime/write/WriteCoordinator.ts` -> `src/runtime/write/pipeline/WriteCoordinator.ts`
5. `src/runtime/write/MutationMetaBus.ts` -> `src/runtime/write/pipeline/MutationMetaBus.ts`
6. `src/domains/node/commands.ts` -> `src/runtime/write/commands/node.ts`
7. `src/domains/edge/commands.ts` -> `src/runtime/write/commands/edge.ts`
8. `src/domains/mindmap/commands.ts` -> `src/runtime/write/commands/mindmap.ts`
9. `src/domains/selection/commands.ts` -> `src/runtime/write/commands/selection.ts`
10. `src/runtime/actors/interaction/Actor.ts` -> `src/runtime/write/commands/interaction.ts`（语义迁移）
11. `src/runtime/actors/viewport/Domain.ts` -> `src/runtime/write/commands/viewport.ts`（语义迁移）
12. `src/runtime/actors/shortcut/Actor.ts` -> `src/runtime/write/commands/shortcut.ts`（语义迁移）
13. `src/runtime/actors/groupAutoFit/Actor.ts` -> `src/runtime/write/postMutation/GroupAutoFitRuntime.ts`

### 4.2 保留不迁移

1. `src/domains/*/view.ts` 保持原位（读侧语义，不属于 write 入口）。
2. `src/domains/api.ts` 已移除（对外 domain facade 已退出）。
3. `instance.events` / `EventCenter` / `types/instance/events.ts` 已移除（无用户场景下彻底删除对外事件总线）。

---

## 5. 关键装配重构

在 `instance/create.ts` 中，write 相关装配应进一步收敛成一个 runtime 工厂，减少主装配文件耦合。

新增：`runtime/write/runtime/createWriteRuntime.ts`

建议输出：

```ts
type WriteRuntime = {
  mutate: InternalInstance['mutate']
  history: Commands['history']
  resetDoc: Commands['doc']['reset']
  mutationMetaBus: MutationMetaBus
  commands: {
    edge: ReturnType<typeof createEdgeCommands>
    interaction: ReturnType<typeof createInteractionCommands>
    viewport: ReturnType<typeof createViewportCommands>
    node: ReturnType<typeof createNodeCommands>
    mindmap: ReturnType<typeof createMindmapController>
    selection: ReturnType<typeof createSelectionController>
    shortcut: ReturnType<typeof createShortcutActionDispatcher>
  }
}
```

`createEngine` 只做：

1. 创建基础 instance
2. 调用 `createWriteRuntime(...)`
3. 组装 `commands`
4. 订阅 `mutationMetaBus` 驱动 read/query

目标是让 `createEngine` 不再直接关心 write 内部子组件的文件位置。

---

## 6. 目录约束规则（重构后）

### 6.1 依赖方向

1. `runtime/write/commands/*` 可以依赖：
   - `@whiteboard/core/*`
   - `instance` 的 `mutate/document/read/query/state`
2. `runtime/write/pipeline/*` 不能依赖 `runtime/read/*` 实现细节。
3. `runtime/write/mutation/*` 必须保持纯语义模块（无副作用、无 store 读写）。
4. `runtime/write/history/*` 只负责 undo/redo 捕获与回放，不承担 mutation 分析。

### 6.2 命名规范

1. 写入入口统一命名为 `commands/*`，禁止继续在 `domains/*` 下新增 `commands.ts`。
2. mutation 语义统一在 `runtime/write/mutation/*`，禁止新增平行语义目录。
3. 所有写入流程新能力先判断归属：`commands` / `pipeline` / `mutation` / `history`。

---

## 7. 一步到位实施顺序

### 阶段 A：先搬核心子系统

1. 迁移 `runtime/mutation/*` 到 `runtime/write/mutation/*`
2. 迁移 `runtime/history/HistoryDomain.ts` 到 `runtime/write/history/HistoryDomain.ts`
3. 迁移 `runtime/write/*` 到 `runtime/write/pipeline/*`
4. 更新 imports 与 type exports

### 阶段 B：迁移 commands 入口

1. 搬迁 `domains/*/commands.ts` 到 `runtime/write/commands/*`
2. 在 `domains/*` 只保留读侧/view 相关模块
3. 更新 `createEngine` 装配引用

### 阶段 C：收敛装配

1. 新增 `createWriteRuntime.ts`，把 write 内部装配从 `instance/create.ts` 抽离
2. `createEngine` 仅依赖一个 write runtime 工厂
3. 校验 `commands` API 对外不变（文件路径变化但行为不变）

---

## 8. 验收标准

1. write 全链路文件只出现在 `runtime/write/**`。
2. `domains/*` 不再包含 `commands.ts`。
3. `instance/create.ts` 不再直接 import `HistoryDomain` / `MutationExecutor` / `WriteCoordinator` / 各 domain command 工厂。
4. `runtime/actors/**` 与 `instance.events` 主链路彻底清理。
5. `pnpm --filter @whiteboard/engine lint` 通过。
6. `pnpm --filter @whiteboard/engine build` 通过。
7. `pnpm --filter @whiteboard/react lint`、`build` 通过。

---

## 9. 风险与控制

1. 风险：大量路径迁移导致 import 断裂。
   - 控制：分阶段迁移，每阶段都跑 lint/build。
2. 风险：`runtime/read` 与 `runtime/write` 边界被后续提交破坏。
   - 控制：在评审中强制校验“读侧不写入、写侧不做查询编排”的单向约束。
3. 风险：`createEngine` 改动过大。
   - 控制：先引入 `createWriteRuntime`，再逐步替换装配，不一次性重写实例装配。
