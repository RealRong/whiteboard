# WHITEBOARD Jotai 历史遗留清理：设计与实施文档（当前事实版）

更新时间：2026-02-28

基准文档：
- `JOTAI_REACTIVE_ARCHITECTURE.md`
- `WHITEBOARD_OPERATION_MM_QUERY_INDEX_OPTIMAL_ARCHITECTURE.md`
- `WHITEBOARD_WRITE_PIPELINE_FILE_LAYOUT_REFACTOR_PLAN.md`

策略：一步到位，不保兼容（One-Shot / No-Compatibility）。

---

## 1. 目标与边界

### 1.1 目标

将 whiteboard-engine 从“历史双通道（命令式桥接 + 局部响应式）”彻底收敛为单一主线：

- 写入主线：`commands -> operations -> mutate -> mutation meta`
- 读取主线：`document/state atoms -> derived atoms/read runtime`
- 订阅主线：`store.sub(atom)` 与 React `useAtomValue`

并且保证：

1. 不保留 `instance.events` 事件总线。
2. 不保留 `runtime/actors` 与 `runtime/lifecycle` 目录。
3. 不保留 `instance.domains` / `instance.node(id)` / `instance.edge(id)` / `instance.mindmap(id)`。
4. 不保留 `instance.projection` 与 `ProjectionStore`。

### 1.2 不在本文范围

1. 算法正确性本体（edge routing、mindmap layout 规则细节）。
2. 业务功能扩展（新节点类型、新快捷键语义）。
3. 视觉层样式设计。

---

## 2. 当前架构（As-Is）

## 2.1 实例 API 四象限

当前实例对外只保留：

1. `instance.state`：语义状态读写。
2. `instance.runtime`：运行时入口（`store/applyConfig/dispose`）。
3. `instance.query`：高频只读查询。
4. `instance.commands`：唯一写入入口。

其中 `instance.runtime` 已收敛为：

```ts
export type RuntimeApi = {
  store: ReturnType<typeof createStore>
  applyConfig: (config: RuntimeConfig) => void
  dispose: () => void
}
```

## 2.2 Store 单锚点

`createEngine` 内创建唯一 store，并直接挂载到 `instance.runtime.store`。

约束：

1. 引擎实例相关状态禁止模块级 singleton store。
2. React/UI 必须消费同一个 store 引用，不再存在第二套订阅源。

## 2.3 写入主线

写侧统一到 `runtime/write/**`：

1. `runtime/write/commands/*`：领域命令入口。
2. `runtime/write/pipeline/*`：`MutationExecutor` / `WriteCoordinator` / `MutationMetaBus`。
3. `runtime/write/mutation/*`：Operation/Impact 语义分析。
4. `runtime/write/history/*`：undo/redo。
5. `runtime/write/postMutation/*`：提交后副作用（如 `GroupAutoFitRuntime`）。

主装配位于：

- `packages/whiteboard-engine/src/runtime/write/runtime/createWriteRuntime.ts`

## 2.4 读侧主线

读侧统一到 `runtime/read/**`，两条并行但同源的 read 能力：

1. Derived atom 图：面向 React 与语义读模型。
2. Materialized model + Query index：面向高频查询热点。

核心约束：

1. mutation 后按固定顺序同步：`queryIndex.applyMutation(meta) -> readRuntime.applyMutation(meta)`。
2. 读热点使用可变缓存（Map/Index）时，通过 revision atom 桥接可观察性。

## 2.5 运行时配置与释放

历史 `instance.lifecycle` 已退出。

现在统一通过：

1. `instance.runtime.applyConfig(config)`：注入 tool/viewport/history/shortcut/mindmapLayout 等运行参数。
2. `instance.runtime.dispose()`：释放快捷键、任务队列、post-mutation runtime 等资源。

---

## 3. 已删除的历史层（One-Shot）

以下能力已经退出主链路，不保兼容：

1. `instance.events` 与 `EventCenter`。
2. `runtime/actors/**`。
3. `runtime/lifecycle/**`。
4. `types/instance/lifecycle.ts`。
5. `domains/api.ts` 与 `types/domains.ts`。
6. `instance.domains` 与实体绑定 API（`instance.node/edge/mindmap`）。
7. `ProjectionStore`、`instance.projection`、`projection.commit` 事件桥。

说明：

1. 历史文档中若出现上述对象，均仅作为迁移审计背景，不代表现状。
2. 当前内部编排禁止重新引入第二条事件总线。

---

## 4. 设计原则（对齐 Jotai Reactive Architecture）

1. 单一事实源：文档与状态根都由 atom/store 承载。
2. 写入集中：所有可变更行为仅经 `instance.commands`。
3. 读取分发：query/read 只读，禁止隐藏写入。
4. 事件收敛：内部流程优先数据驱动，不做字符串事件路由。
5. 目录语义化：按流程阶段组织目录，不按历史技术分层散落。
6. 零兼容迁移：删除旧层而不是“保留壳 + 转发”。

---

## 5. 实施方案（当前已完成）

## 5.1 API 面收敛

1. 删除 `instance.events`、`instance.lifecycle`、`instance.domains`。
2. 对外 API 固定为 `state/runtime/query/commands` 四组。
3. 将原 lifecycle 配置转换函数重命名为 `toRuntimeConfig`。

涉及文件：

1. `packages/whiteboard-engine/src/types/instance/runtime.ts`
2. `packages/whiteboard-engine/src/types/instance/instance.ts`
3. `packages/whiteboard-engine/src/config/index.ts`
4. `packages/whiteboard-engine/src/index.ts`

## 5.2 引擎装配收敛

在 `packages/whiteboard-engine/src/instance/create.ts`：

1. 创建唯一 `runtimeStore`。
2. 注入 `createState` / `createReadRuntime` / `createWriteRuntime`。
3. 构造 `instance.runtime.applyConfig/dispose`。
4. 订阅 `mutationMetaBus`，固定调度 `queryRuntime + readRuntime`。

## 5.3 写侧目录收敛

将历史散落的命令与执行链集中到 `runtime/write/**`，并明确层次：

1. `commands`：领域写入口。
2. `pipeline`：执行与提交。
3. `mutation`：稳定语义分析。
4. `history`：历史域。
5. `postMutation`：提交后运行时。

## 5.4 读侧与热点查询

1. 使用 derived atoms 暴露语义读取。
2. 对 pointermove/hit-test/snap 等高频路径使用 Query Index（命令式索引，getter 查询）。
3. 对 edgePath、mindmap 派生等热点使用 materialized model（命令式缓存 + atom revision 桥）。

## 5.5 React 接入

当前 `packages/whiteboard-react/src/Whiteboard.tsx`：

1. 根层使用 Jotai Provider 绑定 `instance.runtime.store`。
2. 参数变化通过 `instance.runtime.applyConfig(...)` 注入。
3. 卸载时统一 `instance.runtime.dispose()`。

---

## 6. 建议目录蓝图（目标稳定态）

```text
packages/whiteboard-engine/src/
  instance/
    create.ts

  runtime/
    read/
      atoms/
      api/
      indexes/
      materialized/
      Runtime.ts

    write/
      runtime/
      commands/
      pipeline/
      mutation/
      history/
      postMutation/

  state/
    atoms/
    factory/

  config/
  document/
  types/
```

约束：

1. 禁止新增 `runtime/actors`、`runtime/lifecycle` 目录回流。
2. 禁止新增 `instance.events`/`instance.domains` 同类 facade。
3. 禁止在 `query/read` 中写 document 或触发 mutation。

---

## 7. 迁移执行清单（给历史分支回放）

如果从老分支回放到当前形态，推荐顺序：

1. 删除 `instance.events` 与事件桥；改为 mutation/meta 数据驱动。
2. 删除 `runtime/actors`，迁移写入口到 `runtime/write/commands/*`。
3. 删除 `runtime/lifecycle`，引入 `runtime.applyConfig/dispose`。
4. 删除 `instance.domains` 与实体绑定 facade。
5. 删除 `ProjectionStore` 与 `instance.projection`。
6. 统一 store 锚点到 `instance.runtime.store`。
7. React 根层注入同一 store，切换 `useAtomValue` 主读链。

---

## 8. 验收标准

1. 代码中不存在 `instance.events`、`instance.lifecycle`、`instance.domains`。
2. 代码中不存在 `runtime/actors/**`、`runtime/lifecycle/**` 引用。
3. 写路径文件仅位于 `runtime/write/**`。
4. `createEngine` 只组装四象限 API（`state/runtime/query/commands`）。
5. `@whiteboard/engine` lint/build 通过。
6. `@whiteboard/react` lint/build 通过。

---

## 9. 风险与控制

1. 风险：热点缓存“纯 atom 化”导致大图分配与拷贝压力高。
   控制：保留 materialized/query index 的命令式缓存内核，通过 revision atom 暴露可观察性。

2. 风险：再次引入事件总线导致双通道回潮。
   控制：明确内部只允许 mutation meta + atom 订阅两类触发。

3. 风险：目录继续漂移，心智重新分裂。
   控制：新功能先判断归属 `commands/pipeline/mutation/history/postMutation`，禁止跨层放置。

---

## 10. 结论

whiteboard 当前已完成从历史遗留架构到 Jotai 驱动架构的主干切换，且遵循“无兼容层、一步到位”的目标：

1. API 面收敛到四象限。
2. 写入链路集中到 `runtime/write/**`。
3. 读取链路统一到 atom + materialized/query index 混合模型。
4. 生命周期语义下沉为 `runtime.applyConfig/dispose`，不再保留独立 lifecycle 子系统。

后续新增功能应在该主线上演进，不再扩展第二套管线。
