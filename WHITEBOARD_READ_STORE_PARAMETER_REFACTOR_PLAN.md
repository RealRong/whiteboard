# Whiteboard Engine Read Keyed API 重构方案

更新时间：2026-03-01

## 1. 结论先行

本方案采用统一的类型化 key 访问模型，并把“读取 key”与“订阅 key”分离：

1. 内部（read runtime/store/feature）统一通过 `get(key)`、`subscribe(keys)` 读取与订阅。
2. `setSignal(key)` 仅保留在内部，且只能写入内部信号 key，不对业务层开放。
3. `getNodeRect`、`config` 这类 query/常量能力不进入 key 体系，直接走 `context.query.xxx` / `context.config`。
4. 对外不暴露 atom；atom 仅作为内部实现细节，由 key -> source 映射层承载。

核心目标：

1. API 更少：状态读取统一 `get('selection')`，失效监听统一 `subscribe([...])`。
2. 检索更快：可直接全局搜索 key 使用点。
3. 语义清晰：状态走 key，查询走 query，配置走 config。

## 2. 现状问题

当前 read 链路存在以下可维护性问题：

1. 参数转发过多：`runtimeStore`、`readSnapshotAtom`、`selectionAtom`、`viewportAtom`、`mindmapLayoutAtom`、`getNodeRect` 在多个层次重复传递。
2. 依赖形态混杂：atom、函数、config 混在一个 options 对象里，难以快速判断用途。
3. API 边界泄漏：公共 `EngineRead` 暴露 `atoms`，外部代码直接绑定 Jotai 实现细节。
4. 原方案中把 `getNodeRect` 放进 key，语义错位（query 能力被伪装成状态）。

## 3. 设计原则

1. key 必须强类型，禁止自由字符串。
2. key 只承载可读状态，不承载 query 函数和常量配置。
3. 公共读 API 只读：仅 `get/subscribe`，不提供 `setSignal`。
4. 写入口单一：业务写操作仍只能走 `instance.commands`。
5. 内部保持高性能：key 层底下仍可使用 atom/store 做增量与引用稳定。

## 4. Key 模型

### 4.1 key 分层

```ts
type ReadPublicKey =
  | 'interaction'
  | 'tool'
  | 'selection'
  | 'viewport'
  | 'mindmapLayout'

type ReadSubscribeKey = ReadPublicKey | 'snapshot'

type ReadInternalSignalKey =
  | 'signal.edgeRevision'

type ReadInternalKey = ReadSubscribeKey | ReadInternalSignalKey
```

说明：

1. `ReadPublicKey` 用于 `read.get`（仅状态值）。
2. `ReadSubscribeKey` 用于 `read.subscribe`（包含 `snapshot` 失效信号）。
3. `ReadInternalSignalKey` 仅内部使用，承载 read 层失效/触发信号。

### 4.2 key 到值类型映射

```ts
type ReadPublicValueMap = {
  interaction: InteractionState
  tool: 'select' | 'edge'
  selection: SelectionState
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
}

type ReadInternalValueMap = ReadPublicValueMap & {
  snapshot: ReadModelSnapshot
  'signal.edgeRevision': number
}
```

说明：

1. `getNodeRect` 不在映射里，使用 `context.query.nodeRect`。
2. `config` 不在映射里，使用 `context.config`。

### 4.3 订阅 key 约束

```ts
type ReadSubscribablePublicKey = ReadSubscribeKey

type ReadSubscribableInternalKey =
  | ReadSubscribeKey
  | ReadInternalSignalKey
```

说明：

1. `subscribe` 只接受可变 key。
2. query/config 不可订阅。

## 5. API 设计

### 5.1 公共 API（无 atom、无 set）

```ts
type EngineReadPublic = {
  get: EngineReadGet
  subscribe: (
    keys: readonly ReadSubscribablePublicKey[],
    listener: () => void
  ) => () => void
}
```

`EngineReadGet` 的语义：

1. 可调用 key 读取：`get('selection')`。
2. 兼容参数化 getter：`get.edgeById(edgeId)`、`get.nodeById(nodeId)`。

约束：

1. 不包含 `atoms`。
2. 不包含 `store`。
3. 不包含 `setSignal`。

### 5.2 内部 API（仅 read 内部/框架适配层）

```ts
type ReadRuntimeContext = {
  get: <K extends ReadInternalKey>(key: K) => ReadKeyValueMap[K]
  subscribe: (
    keys: readonly ReadSubscribableInternalKey[],
    listener: () => void
  ) => () => void
  setSignal: <K extends ReadInternalSignalKey>(
    key: K,
    updater: ReadKeyValueMap[K] | ((prev: ReadKeyValueMap[K]) => ReadKeyValueMap[K])
  ) => void
  query: {
    nodeRect: QueryCanvas['nodeRect']
  }
  config: InstanceConfig
}
```

约束：

1. `setSignal` 只能写 `ReadInternalSignalKey`。
2. 业务层和插件层拿不到 `ReadRuntimeContext`。
3. query/config 从 key 系统中剥离，语义更清晰。

## 6. key -> source 映射实现

`runtime/read/context.ts` 负责建立映射：

1. `key -> atom`（如 `selection/viewport/mindmapLayout/snapshot/signal.edgeRevision`）。
2. query/config 由 `context.query/context.config` 直接提供，不进入 key registry。

建议结构：

```ts
type ReadKeyRegistry = {
  atomByKey: Record<ReadInternalKey, Atom<unknown>>
}
```

`get(key)` 行为：

1. 从 `atomByKey` 找到 atom 并通过 `store.get(atom)` 返回。
2. key 未注册时抛出受控错误（开发期快速暴露）。

`subscribe(keys)` 行为：

1. 对 `keys` 对应 atom 建立订阅。
2. 返回统一 `unsubscribe` 聚合函数。

## 7. 模块落地方式

### 7.1 read/store.ts

改造后只做三件事：

1. 创建 `ReadRuntimeContext`。
2. 组装 feature：`edgeFeature(context)`、`nodeFeature(context)`、`mindmapFeature(context)`。
3. 组合 public read 输出与内部适配输出。

### 7.2 edge/node/mindmap feature

统一改造为：状态走 key，查询走 query。

1. `context.get('snapshot')` 代替 `readSnapshotAtom + runtime.get`。
2. `context.get('selection')`、`context.get('viewport')`、`context.get('mindmapLayout')` 代替对应 atom 参数。
3. `context.query.nodeRect(nodeId)` 代替单独函数透传。
4. `context.setSignal('signal.edgeRevision', ...)` 代替直接操作 revision atom。

### 7.3 React 适配层

迁移目标：

1. 组件/hooks 不再直接依赖 `instance.read.atoms.*`。
2. 统一走封装 hook（例如 `useReadValue(key)` / `useReadSelector(...)`）。
3. 如需高频渲染性能，在适配层内部继续使用 atom，但不向业务暴露。

## 8. 示例

### 8.1 feature 内部读取

```ts
const snapshot = context.get('snapshot')
const selection = context.get('selection')
const rect = context.query.nodeRect(nodeId)
const config = context.config
```

### 8.2 feature 内部订阅

```ts
const off = context.subscribe(['snapshot', 'mindmapLayout'], () => {
  // recompute mindmap view cache
})
```

### 8.3 内部信号写入

```ts
context.setSignal('signal.edgeRevision', (prev) => prev + 1)
```

### 8.4 公共层只读

```ts
const selection = instance.read.get('selection')
const off = instance.read.subscribe(['snapshot'], onReadChanged)
const edge = instance.read.get.edgeById(edgeId)
```

## 9. 迁移计划

### Phase 0：加类型与文档（零行为改动）

1. 新增 `ReadPublicKey`、`ReadSubscribeKey`、`ReadInternalSignalKey`、`ReadInternalValueMap`。
2. 在文档中明确：query/config 不进入 key。

### Phase 1：引入 context 映射层

1. 新增 `runtime/read/context.ts`。
2. 在 `read/store.ts` 中用 context 替代原 options 扇出。

### Phase 2：feature 切到 key + query

1. edge/node/mindmap 改为 `context.get(...)` 读取状态。
2. 把 `getNodeRect` 调用统一改为 `context.query.nodeRect(...)`。
3. 把内部 revision 写入统一改为 `setSignal(...)`。

### Phase 3：公共 API 与内部 API 分离

1. 公共 `EngineRead` 切到 `get/subscribe`（`get` 同时承载参数化 getter）。
2. 内部保留 `ReadRuntimeContext` 与可选内部适配器。

### Phase 4：迁移 whiteboard-react 调用

1. 替换 `instance.read.atoms.*` 直接读取。
2. 统一到 `useReadValue/useReadSelector` 等语义 hook。

### Phase 5：移除遗留暴露

1. 公共类型去除 `atoms/store/setSignal`。
2. 加 lint 规则防止回归到 atom 公共依赖。

## 10. 风险与应对

1. 风险：字符串 key 退化为弱类型。
2. 应对：强制 `ReadKey` 联合类型 + `ReadKeyValueMap`，禁止 `string`。

3. 风险：`setSignal` 被滥用形成第二写入口。
4. 应对：`setSignal` 仅在内部 context，且 key 限制为 `ReadInternalSignalKey`。

5. 风险：迁移期 public/internal 混用导致调用混乱。
6. 应对：命名显式区分并限制导出面。

7. 风险：订阅语义变化引发渲染回归。
8. 应对：先在适配层封装 hook，逐组件迁移并做性能回归。

9. 风险：状态/query 边界再次被打破（把函数放回 key）。
10. 应对：在类型层和 code review 规范中明确“key 只承载状态值”。

## 11. 验收标准

静态标准：

1. `pnpm -C packages/whiteboard-engine lint` 通过。
2. 公共 `EngineRead` 类型中不出现 `Atom`、`store`、`setSignal`。
3. `whiteboard-react` 侧不再直接引用 `instance.read.atoms.*`。
4. `getNodeRect` 不出现在 `ReadPublicKey/ReadKeyValueMap`。

行为标准：

1. edge 路径、端点选中态、node transform、mindmap 布局行为与现状一致。
2. `replace/full` 变更后 read 输出一致。

性能标准：

1. `edgeById/nodeById/mindmapById` 的引用稳定性不退化。
2. 高频交互（drag/reconnect）无明显渲染放大。

## 12. 预期收益

1. 接口统一：调用端统一 `get('xxx')` / `subscribe([...])`。
2. 语义清晰：状态走 key，查询走 query，配置走 config。
3. 可检索性强：按 key 全局搜索可快速定位依赖链路。
4. 边界清晰：公共层不暴露 atom，内部实现可持续演进。
5. 迁移平滑：先兼容再收敛，不需要一次性重写 read 算法。
