# Whiteboard Atom Signal Subscriber 增量索引设计与实现方案

## 1. 背景与问题

当前 engine 已经完成 Jotai 读模型迁移，并且 `state` 与 `read` 已共享同一个 Jotai vanilla store。

但在索引与缓存层，仍存在以下问题：

1. `ProjectionStore.commit` 既承载快照数据，又隐式承担“触发增量刷新”的职责，职责边界不够清晰。
2. 部分增量能力依赖 `snapshot + impact` 在多个模块间传播，触发链路可读性一般。
3. 对索引这种“命令式可变缓存”来说，完全放入 derived atom 不自然，副作用边界不够明确。

目标是明确区分两类链路：

1. 语义数据链路：`data atom -> derived atom`（纯函数派生，服务 UI）。
2. 索引维护链路：`signal atom -> subscriber`（事件触发，服务增量缓存）。

---

## 2. 核心决策

1. 保留 `ProjectionStore` 作为写入后投影与 commit 总线（不在本阶段移除）。
2. 新增“信号原子（signal atoms）”作为增量索引触发器，承载最小事件载荷。
3. 索引更新不放入 derived atom；统一放在 runtime subscriber（副作用层）里执行。
4. `instance.read` 继续作为 UI 读取入口；UI 组件不直接感知 signal/subscriber。
5. 不引入兼容层，不做双轨开关，一次性切换。

---

## 3. 目标架构

```text
写入链路
commands -> mutate -> MutationExecutor -> ProjectionStore(commit)

信号链路（新增主轴）
ProjectionStore.commit
 -> write commitSignalAtom
 -> subscribers(增量索引/缓存维护)
 -> write indexRevisionAtom/cacheRevisionAtom

读取链路（保持）
UI useAtomValue(derived atoms)
 -> derived atoms 依赖 indexRevisionAtom / 业务数据 atoms
 -> 读取最新索引/缓存结果
```

说明：

1. `commitSignalAtom` 不承载大体量 snapshot，只承载 revision 与 impact 元信息。
2. snapshot 数据仍由 projection/read 维护，signal 只负责“触发”。

---

## 4. 数据模型

## 4.1 Signal Atom

建议新增：

```ts
type CommitSignal = {
  revision: number
  kind: 'apply' | 'replace'
  impact: {
    tags: ReadonlySet<string>
    dirtyNodeIds?: string[]
    dirtyEdgeIds?: string[]
  }
}
```

```ts
const commitSignalAtom = atom<CommitSignal | undefined>(undefined)
```

约束：

1. 单调递增：`revision` 必须递增。
2. 小载荷：不放 `snapshot`，避免高频对象复制。
3. 幂等可判定：subscriber 需记录 `lastHandledRevision`。

## 4.2 Revision Atoms

建议至少保留两类 revision：

1. `indexRevisionAtom`：驱动 query indexes 相关读依赖。
2. `edgePathRevisionAtom`（已存在）：驱动 edge path cache 相关读依赖。

可选扩展：

1. `mindmapLayoutRevisionAtom`
2. `geometryRevisionAtom`

---

## 5. Subscriber 机制

## 5.1 设计原则

1. subscriber 只做副作用，不返回 UI 语义值。
2. subscriber 内部允许操作可变缓存（Map/Index），但外部只暴露 getter。
3. subscriber 触发后，必须通过 revision atom 通知派生层刷新。
4. 禁止在 subscriber 内回写同一个 `commitSignalAtom`，避免递归。

## 5.2 运行方式

使用 Jotai store 原生订阅：

```ts
const unsub = store.sub(commitSignalAtom, () => {
  const signal = store.get(commitSignalAtom)
  if (!signal) return
  if (signal.revision <= lastHandledRevision) return

  runIncrementalIndexUpdate(signal)
  store.set(indexRevisionAtom, (v) => v + 1)
  lastHandledRevision = signal.revision
})
```

生命周期：

1. 在 engine runtime 初始化时注册。
2. 在 instance lifecycle stop/dispose 时注销。

---

## 6. 各模块改造方案

## 6.1 `runtime/read/Store.ts`

目标：

1. 继续维护 `projectionSnapshotAtom`（作为快照读根）。
2. 新增 `commitSignalAtom` 写入逻辑。
3. 注册 subscriber：
   - query index subscriber
   - edge path subscriber（可与现有逻辑合并）

建议改造点：

1. `projection.subscribe(commit)` 中：
   - 写 `projectionSnapshotAtom`。
   - 写 `commitSignalAtom`。
2. 去掉“在 commit handler 中直接散落缓存刷新”的逻辑，统一迁到 subscriber。

## 6.2 `runtime/query/Store.ts`

目标：

1. 将 `ensureIndexes` 的触发条件改为以 `indexRevisionAtom` 为准。
2. 索引同步策略仍基于 `impact.tags/dirtyNodeIds`，保持现有增量规则。

建议：

1. 保留 `sync` / `syncByNodeIds` 算法。
2. 将“何时触发 sync”从 commit 直连改为 signal-subscriber 驱动。

## 6.3 Edge Path 缓存

目标：

1. 将 edge path 缓存失效触发也放入 subscriber（同样基于 signal）。
2. 保留 `edgePathRevisionAtom` 作为 read 派生依赖。

---

## 7. 触发规则（建议）

`commitSignal.impact.tags` 到 subscriber 行为映射：

1. `full` / `replace`：
   - 全量重建索引与相关缓存。
2. `nodes` + `dirtyNodeIds`：
   - `syncByNodeIds`。
3. `order`：
   - 触发索引重排（全量 sync 或专用 order sync）。
4. `mindmap`：
   - 至少触发 mindmap 相关缓存 revision。
5. `edges` + `dirtyEdgeIds`：
   - 触发 edgePath 局部失效。

---

## 8. 实现步骤（一步到位）

1. 在 `runtime/read` 增加 signal atoms 与 subscriber 注册模块。
2. 改 `projection.subscribe`：由“直接做多项刷新”改成“写 signal + 写 snapshot”。
3. 将 query 索引刷新移动到 subscriber 并接入 `indexRevisionAtom`。
4. 将 edge path 失效刷新统一到 subscriber 并维护 `edgePathRevisionAtom`。
5. 清理旧的分散触发路径，确保只有 signal 一条触发主线。
6. 跑 lint/build/bench，最后手工回归。

---

## 9. 验收标准

## 9.1 正确性

1. `replace/full` 后索引与路径缓存一致。
2. 局部更新时仅对应 dirty 范围被增量刷新。
3. UI 读取结果与迁移前保持行为一致。

## 9.2 性能

1. `bench:check` 全通过。
2. drag/transform/routing 三项 p95 不劣于当前基线阈值。

## 9.3 架构约束

1. derived atom 不含副作用。
2. 增量索引副作用只存在于 subscriber。
3. 不新增第二条写路径（所有业务写仍走 commands/mutate）。

---

## 10. 风险与控制

1. 风险：subscriber 顺序错误导致索引读取短暂不一致。
   - 控制：统一单点注册，按 revision 顺序处理，必要时串行队列。
2. 风险：signal 高频触发造成无效刷新。
   - 控制：按 impact 精准分流；revision 去重；batch 内只发一次最终 signal。
3. 风险：subscriber 循环触发。
   - 控制：禁止回写 signal atom；仅写 revision atom。

---

## 11. 非目标

1. 本阶段不移除 `ProjectionStore`。
2. 本阶段不重写 core projector 算法。
3. 本阶段不改 commands/mutate/history 协议。

---

## 12. 最终状态定义（Done）

满足以下条件即视为完成：

1. engine 中增量索引触发主线统一为 `commitSignalAtom -> subscriber`。
2. `query/edgePath` 不再通过分散的 commit 直连逻辑触发刷新。
3. lint/build/bench 全通过。
4. 手工回归通过（node/edge/mindmap/viewport 交互）。
