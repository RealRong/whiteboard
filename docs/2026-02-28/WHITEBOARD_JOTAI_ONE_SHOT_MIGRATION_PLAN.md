# Whiteboard Jotai 读模型一步到位重构方案（零兼容）

## 1. 决策与边界

本方案用于下一阶段重构，核心决策如下：

1. 不保留兼容层。
2. 不提供双轨运行（旧 `instance.view` 与新 Jotai 并存）能力。
3. 采用一次性切换（One-shot）方式完成迁移。
4. 允许对 `@whiteboard/engine` 与 `@whiteboard/react` 的公开类型做破坏性调整。
5. 写入链路（`commands -> mutate -> history -> projection`）保留，读取链路重做。

适用前提：

1. 当前无外部用户依赖旧 API。
2. 可接受一次性大改引发的短期开发分支不稳定。
3. 以仓库内基准与手工回归作为唯一验收标准。

---

## 2. 目标问题

当前读链路存在以下结构性问题：

1. `runtime/view/Registry.ts` 通过 `switch + syncState + applyCommit` 手工路由状态与投影更新。
2. `EdgeDomain/NodeDomain/MindmapDomain` 维护命令式缓存与同步触发，复杂度高，维护成本高。
3. React 层通过 `useViewSelector` 订阅 `instance.view.subscribe`，语义上仍是“大 store + selector”。
4. `domains/api.ts`、部分 commands 直接依赖 `view.getState()`，导致读取来源分散。

目标是将读取逻辑统一到 Jotai 原子图，形成：

1. 单一读根（Root Atoms）。
2. 按依赖自动派生（Derived Atoms）。
3. React 组件直接按原子订阅，不再走 `view.subscribe` 聚合分发。

---

## 3. 迁移后目标架构

## 3.1 总体图

```text
写入链路（保持）
UI/协作事件
 -> commands
 -> mutate
 -> WriteCoordinator
 -> MutationExecutor
 -> ProjectionStore 产出 snapshot/commit

读取链路（重建）
ProjectionStore.commit + State变化
 -> engineReadStore.set(rootAtoms)
 -> derived atoms 自动重算
 -> React useAtomValue(atom, { store: engineReadStore })
```

## 3.2 分层职责

1. `@whiteboard/engine`：
   - 保留：`commands`、`query`、`state`、`projection`、`lifecycle`。
   - 新增：`read`（Jotai store + atoms 导出）。
   - 删除：`view` 运行时及所有旧 view domain。

2. `@whiteboard/react`：
   - 保留：交互态 Jotai store（已存在）。
   - 改造：画布业务读取全部切换到 `instance.read` 原子。
   - 删除：`useViewSelector` 与围绕 `instance.view` 的绑定层。

3. `@whiteboard/core`：
   - 保持纯算法与结构转换，不承载运行时订阅逻辑。

---

## 4. 一步到位迁移清单（必须迁移）

以下模块属于“一次性替换”范围。

## 4.1 Engine 实例与类型层

1. 修改 `packages/whiteboard-engine/src/types/instance/instance.ts`：
   - 删除 `Instance.view` 字段。
   - 新增 `Instance.read` 字段。
2. 新增读模型类型文件：
   - `packages/whiteboard-engine/src/types/instance/read.ts`
   - 定义 `EngineReadStore`、`EngineReadAtoms`、`EngineReadApi`。
3. 修改 `packages/whiteboard-engine/src/index.ts` 导出新的 read 类型。

## 4.2 Engine 运行时读模型层

1. 删除目录：
   - `packages/whiteboard-engine/src/runtime/view/*`
2. 新增目录：
   - `packages/whiteboard-engine/src/runtime/read/*`
3. 新增内容：
   - `store.ts`：创建 `createStore()`。
   - `roots.ts`：定义 `projectionSnapshotAtom`，并复用 state factory 提供的共享原子（`selection`/`mindmapLayout`/`viewport`）。
   - `derived/*.ts`：定义节点、边、脑图、viewport transform 的派生 atoms。
   - `edgePath/*`：边路径缓存 + revision atom（处理可变缓存失效）。
4. 在 `instance/create.ts` 中接入：
   - 监听 `projection.subscribe` 写入 snapshot root atom。
   - 将 state 与 read 绑定到同一个 Jotai store，消除 `state -> read` 镜像同步。
   - 构造并挂载 `instance.read`。

## 4.3 Engine API 适配层

1. 修改 `packages/whiteboard-engine/src/domains/api.ts`：
   - 删除对 `view` 的依赖注入。
   - 所有 `view.get/getById/subscribe` 改为 `read` 原子读取接口或直接移除。
2. 修改依赖 `view.getState()` 的命令实现：
   - 例如 `domains/edge/commands.ts` 中 `insertRoutingPointAt/removeRoutingPointAt` 改为从 `read` 获取边路径条目。
3. 删除不再需要的 `types/instance/view.ts` 与相关引用。

## 4.4 React 读取层

1. 删除文件：
   - `packages/whiteboard-react/src/common/hooks/useWhiteboardView.ts`
2. 新增文件：
   - `packages/whiteboard-react/src/common/hooks/useReadAtom.ts`
   - 统一从 `instance.read.store` + atom 读取。
3. 批量替换组件读取入口：
   - `NodeLayer.tsx`：`nodes.ids`、`nodes.byId` 改为原子读取。
   - `EdgeLayer.tsx`：`edges.ids`、`edges.byId` 改为原子读取。
   - `MindmapLayerStack.tsx`：`mindmap.ids` 改为原子读取。
   - `EdgeEndpointHandles.tsx`：`edgeSelectedEndpointsAtom` 直接读取。
   - `EdgeControlPointHandles.tsx`：选中边与路径条目从原子读取。
   - `Whiteboard.tsx`：viewport transform 由 `viewportTransformAtom` 读取，移除 `instance.view.subscribe`。
4. `common/hooks/index.ts` 删除 `useViewSelector` 导出。

## 4.5 依赖与构建

1. 在 `packages/whiteboard-engine/package.json` 增加依赖：
   - `jotai`
2. 运行并修正所有 TypeScript 引用错误。

---

## 5. 迁移后标准读模型（原子设计）

## 5.1 Root Atoms

1. `projectionSnapshotAtom`：
   - 来源：`projection.subscribe(commit.snapshot)`。
2. `selectionAtom`：
   - 来源：state factory 提供的共享 `selection` atom。
3. `mindmapLayoutAtom`：
   - 来源：state factory 提供的共享 `mindmapLayout` atom。
4. `viewportAtom`：
   - 来源：state factory 提供的共享 `viewport` atom（由 `syncViewport` 维护）。

## 5.2 Derived Atoms（最小必需集）

1. `viewportTransformAtom`：
   - 输入：`viewportAtom`。
   - 输出：transform 字符串与 `--wb-zoom`。
2. `nodeIdsAtom`：
   - 输入：`projectionSnapshotAtom`。
   - 输出：layer 排序后的节点 id 列表。
3. `nodeByIdAtomFamily(id)`：
   - 输入：`projectionSnapshotAtom`。
   - 输出：`NodeViewItem | undefined`。
4. `edgeIdsAtom`：
   - 输入：`projectionSnapshotAtom`。
   - 输出：可见边 id 列表。
5. `edgeByIdAtomFamily(id)`：
   - 输入：`projectionSnapshotAtom + edgePathCacheRevisionAtom`。
   - 输出：`EdgePathEntry | undefined`。
6. `selectedEdgeIdAtom`：
   - 输入：`selectionAtom`。
7. `edgeSelectedEndpointsAtom`：
   - 输入：`selectedEdgeIdAtom + edgeByIdAtomFamily + projectionSnapshotAtom`。
8. `mindmapTreeIdsAtom`、`mindmapTreeByIdAtomFamily(id)`：
   - 输入：`projectionSnapshotAtom + mindmapLayoutAtom`。

## 5.3 可变缓存策略

1. `EdgePath` 保留内部 Map 缓存以维持性能。
2. 通过 `edgePathCacheRevisionAtom` 驱动派生重算，不依赖可变对象引用变化。
3. cache invalidation 触发点只来自 projection commit，不接受组件层手动触发。

---

## 6. 一步到位执行顺序（单分支、单次切换）

以下顺序用于实现阶段，目标是减少中间态反复返工。虽然是一步到位切换，但仍按实现顺序推进，最终一次合并。

1. 先改 engine 类型：
   - 定义 `read`，删除 `view` 类型。
2. 实现 `runtime/read`：
   - 先 root atoms，再 node/edge/mindmap/viewport 派生。
3. 修改 `instance/create.ts`：
   - 注入 root atom 数据源。
   - 挂载 `instance.read`。
4. 改 `domains/api.ts` 与 commands：
   - 去除 view 依赖。
5. 切 React 所有 `useViewSelector` 消费点到 `useReadAtom`。
6. 删除 `runtime/view`、`useWhiteboardView.ts` 及相关死代码。
7. 最后统一 lint + build + bench + 手工回归。

---

## 7. 删除清单（明确不保留）

以下内容在迁移完成后必须删除，不允许“先留着”：

1. `packages/whiteboard-engine/src/runtime/view/*`
2. `packages/whiteboard-engine/src/types/instance/view.ts`
3. `packages/whiteboard-react/src/common/hooks/useWhiteboardView.ts`
4. `instance.view` 全部类型与实现出口
5. `domains/api.ts` 中所有 `view.*` 暴露
6. 依赖 `instance.view.subscribe/getState` 的逻辑

---

## 8. 迁移后公开 API 形态（目标）

## 8.1 Instance（简化）

```ts
type Instance = {
  state: State
  projection: ProjectionStore
  query: Query
  read: EngineReadApi
  domains: DomainApis
  node: DomainEntityApis['node']
  edge: DomainEntityApis['edge']
  mindmap: DomainEntityApis['mindmap']
  events: InstanceEvents
  lifecycle: Lifecycle
  commands: Commands
}
```

## 8.2 EngineReadApi（建议）

```ts
type EngineReadApi = {
  store: Store
  atoms: {
    viewportTransform: Atom<ViewportTransformView>
    nodeIds: Atom<NodeId[]>
    nodeById: (id: NodeId) => Atom<NodeViewItem | undefined>
    edgeIds: Atom<EdgeId[]>
    edgeById: (id: EdgeId) => Atom<EdgePathEntry | undefined>
    selectedEdgeId: Atom<EdgeId | undefined>
    edgeSelectedEndpoints: Atom<EdgeEndpoints | undefined>
    mindmapIds: Atom<NodeId[]>
    mindmapById: (id: NodeId) => Atom<MindmapViewTree | undefined>
  }
}
```

---

## 9. 验收标准

## 9.1 编译与静态检查

1. `pnpm --filter @whiteboard/engine lint`
2. `pnpm --filter @whiteboard/react lint`
3. `pnpm -r build`

## 9.2 性能基线

1. `pnpm --filter @whiteboard/engine run bench:check` 全通过。
2. 与迁移前基线对比，三项 frame bench 不允许显著回退（阈值按现有脚本约束）。

## 9.3 行为回归

1. node drag / transform（含 snap、guide、group）。
2. edge connect / routing / 插点 / 端点重连。
3. selection box 与单选/多选。
4. mindmap 插入、移动、折叠、重排。
5. viewport pan / wheel / space 手势。

---

## 10. 风险与控制

1. 风险：一次性删除 `instance.view` 影响面大。
   - 控制：先全局 grep 清零 `view.getState/view.subscribe/useViewSelector` 再删文件。
2. 风险：边路径缓存与原子失效不同步。
   - 控制：使用 revision atom，禁止可变引用直接做变更判断。
3. 风险：React 层重渲染异常增加。
   - 控制：关键列表使用 `atomFamily + selectAtom + equality`，并以 bench 和交互录屏对比验证。

---

## 11. 非目标

本次迁移不处理以下事项：

1. 不重写写入协议与 mutation 语义。
2. 不改 core 业务算法语义。
3. 不引入第二套状态管理库。
4. 不保留迁移开关、fallback 或 feature flag。

---

## 12. 最终状态定义（Done）

当且仅当满足以下条件，视为迁移完成：

1. 仓库中不存在 `instance.view`、`runtime/view`、`useViewSelector` 相关代码。
2. 所有画布业务渲染读取均来自 `instance.read` 原子。
3. 交互、性能、编译、lint 全部通过。
4. 无兼容层、无双轨、无切换开关。

---

## 13. 落地状态（2026-02-27）

## 13.1 已完成

1. `instance.view` 已从类型和实例出口移除，统一切换为 `instance.read`。
2. `runtime/view/*` 已删除，`runtime/read/*` 已落地并接入 `instance/create.ts`。
3. React 侧读取入口已切换到 `useReadAtom` + `instance.read.atoms/*`。
4. `domains/api.ts` 与依赖 `view.getState()` 的命令逻辑已改为 `read` 读取。
5. 旧 `useWhiteboardView`、`types/instance/view.ts` 已删除。
6. benchmark 入口与 kernel 已恢复到 `packages/whiteboard-engine/src/perf/*`，并完成现有类型体系对齐。
7. `instance.render` 与 `runtime/render/*` 已移除，shortcut 上下文改为仅依赖 `state.interaction.pointer.isDragging`。
8. `state` 底层已切换为 Jotai vanilla store，`read` 与 `state` 共享同一 store/atoms，不再维护 `selection/mindmapLayout/viewport` 镜像 root atom。

## 13.2 已验证命令

1. `pnpm --filter @whiteboard/engine lint` 通过。
2. `pnpm --filter @whiteboard/react lint` 通过。
3. `pnpm -r build` 通过。
4. `pnpm --filter @whiteboard/engine run bench:check` 通过（drag-frame / node-transform-frame / edge-routing-frame 全 PASS）。

## 13.3 待完成（人工回归）

1. node drag / transform（snap、guide、group）交互手工回归。
2. edge connect / routing / 插点 / endpoint reconnect 手工回归。
3. selection box 与单选/多选手工回归。
4. mindmap 插入、移动、折叠、重排手工回归。
5. viewport pan / wheel / space 手势手工回归。

说明：当前阻塞已从“编译与基准不可执行”清零，剩余项仅为 UI 行为手工验证与签收。
