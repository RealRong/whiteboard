# Whiteboard Collab / Yjs 完整实施方案

## 1. 文档目标

这份文档回答四个问题：

1. 现在要不要在 `packages` 下新增 `whiteboard-collab`。
2. 如果要做协同，当前 `core / engine / react` 的最佳接入点在哪里。
3. Yjs 应该怎么接，哪些能力借用，哪些能力不要耦死。
4. 下一步应该按什么顺序落地，避免把旧边界和 UI sugar 一起固化进同步层。

前提保持不变：

- 优先长期最优，不考虑兼容成本。
- 不要求保留旧公开接口。
- `mindmap` 已经按长期方向回到 `node.data.mindmap`。
- `node.update` 的 canonical mutation 已经切到 `fields + records(set/unset/splice)`。

---

## 2. 结论

## 2.1 是否需要新增 `packages/whiteboard-collab`

需要。

但不是现在立刻把 Yjs 代码塞进去，而是：

1. 先补 `@whiteboard/engine` 的协同接入边界。
2. 再新增 `@whiteboard/collab` 作为可选适配层。

原因很简单：

- 协同不是 `engine` 的核心领域能力。
- 协同也不是 `react` 组件层应该直接拥有的能力。
- Yjs 是第一实现，不应该变成 `engine` 的硬依赖。
- 后面如果要切 Hocuspocus、y-websocket、WebRTC、甚至别的 CRDT，不应该重写 `engine`。

因此长期最优的分层应该是：

- `@whiteboard/core`：唯一 canonical operation / reducer / inverse 模型
- `@whiteboard/engine`：命令、写入、投影、history、raw operation apply 边界
- `@whiteboard/collab`：协同会话、Yjs codec、provider 接入、awareness、bootstrap、重连、去重
- `@whiteboard/react`：UI 与交互，不直接承载协同协议

## 2.2 Yjs 是否可用

可用，而且是当前最合适的第一实现。

原因：

- 它已经把最难的复制、离线缓存、冲突合并、provider 生态、awareness 解决掉了。
- 当前 `node.update.records` 的 canonical 形状非常适合映射到 `Y.Map / Y.Array`。
- 我们可以大量借用 Yjs 的基础设施，但仍然把业务语义保留在 `core/engine` 这边。

所以推荐的定位是：

- **Yjs 负责复制和收敛**
- **engine 负责业务命令与本地语义**
- **collab adapter 负责两边翻译与会话编排**

## 2.3 最推荐的总体架构

推荐采用：

**`Yjs materialized document mirror + engine canonical operation bridge`**

不要采用：

- 把 Yjs 直接塞进 `engine`
- 让 `@whiteboard/react` 继续通过整份 `document` 受控同步
- 用 `Y.Array` 直接做纯 operation log 作为长期主方案

---

## 3. 当前代码现状

## 3.1 已经适合协同的部分

当前最重要的基础已经具备：

1. `@whiteboard/core` 已经有稳定的 `Operation` 模型。
2. `node.update` 已经有 `fields + records` 的 canonical 载荷。
3. `records` 只保留 `set / unset / splice`，非常适合对接 CRDT。
4. `Origin` 在 `core` 层已经包含 `remote`。
5. reducer 已经能产出 `inverse` 和 `read impact`。
6. `mindmap` 已经基本回到了普通 `node.data.mindmap` 语义。

这意味着：

- 协同层不需要再猜“这是 merge 还是 replace”
- 协同层面对的是稳定的 mutation，而不是 UI 命令糖

## 3.2 当前还不适合直接接协同的部分

`engine` 还缺少三个关键公共边界：

1. **缺少公开的 raw `Document` 快照读取**
2. **缺少公开的 raw `Operation[]` apply 入口**
3. **`engine` 自己的 `WriteOrigin` 还没有 `remote`**

这三个不补，`whiteboard-collab` 即使建出来，也只能：

- 偷用内部 writer
- 依赖 React 受控 `document` replace
- 或者被迫绕过公开边界

这会直接把协同层变成“靠内部细节站着”的代码。

## 3.3 为什么不能继续走 React 的 `document/onDocumentChange`

`@whiteboard/react` 当前公开面仍然偏受控组件模型：

- 外部传 `document`
- 内部变更后用 `onDocumentChange` 回传整份 `document`
- 外部再把整份 `document` 喂回来

这条线适合单机受控状态，不适合协同主链路。

原因：

1. 它是整份快照，不是增量 mutation。
2. 它天然会放大 replace 面。
3. 它没有 `origin` 概念。
4. 它没有 remote replay 的稳定边界。
5. 它会把 React 组件生命周期和协同会话生命周期耦合在一起。

因此协同的首选接入点必须是 `EngineInstance`，不是 `Whiteboard` 组件 props。

---

## 4. 为什么不建议把 Yjs 直接塞进 engine

把 Yjs 直接塞进 `engine` 看起来省一层，长期反而更差。

主要问题：

1. `engine` 会被迫知道 Yjs 类型系统和 provider 生命周期。
2. `engine` 会失去“纯本地业务 runtime”定位。
3. `engine` 测试会变重，边界会混乱。
4. 将来如果不想继续用 Yjs，成本会被锁死。
5. `react`、provider、awareness、重连策略等外围问题会反渗透进 `engine`。

长期更优的做法是：

- `engine` 只暴露稳定的本地 mutation 边界
- `collab` 包依赖 `engine`
- Yjs 只是 `collab` 包中的第一实现

---

## 5. 为什么不推荐“纯 Yjs operation log”作为长期主方案

表面上看，把 `Operation[]` 序列 append 到一个共享 `Y.Array` 很干净。

但它不适合作为长期主方案，原因在于：

1. 多客户端并发 append 时，Yjs 会给出确定顺序，但本地客户端已经先执行了自己的 operation。
2. 这意味着各端实际执行顺序可能不同。
3. 如果 operation 不天然可交换，单靠“最终线性化的 log 顺序”不能保证本地即时执行和远端回放一致。
4. 最后仍然需要二次重排、重放、回滚，复杂度会重新回到 OT/事务排序问题。

换句话说：

- Yjs 很擅长做共享状态 CRDT
- 但不应该把它误用成“无需全局排序问题的操作日志系统”

所以长期主方案不应该是：

- `engine` 先本地 apply
- 再把 operation append 到共享 log
- 再希望别的端按同一顺序回放就自然收敛

这条线在并发下并不稳。

---

## 6. 推荐的长期架构

## 6.1 总体原则

长期最优里，协同链路应当遵守下面四条原则：

1. **业务语义仍然由 `core/engine` 定义**
2. **复制和冲突收敛交给 Yjs**
3. **协同桥只负责 codec 与会话编排**
4. **steady-state 不走 whole-document replace**

## 6.2 分层图

```txt
UI / React
  -> instance.commands.*
  -> engine commit/read

@whiteboard/engine
  -> command translate
  -> reduce/apply operations
  -> history / impact / projections
  -> public raw operation apply boundary

@whiteboard/collab
  -> session lifecycle
  -> local commit -> Yjs mirror
  -> remote Yjs changes -> engine operations
  -> bootstrap / reconnect / awareness

Yjs + Provider
  -> shared state replication
  -> offline / reconnect / transport / presence
```

## 6.3 角色划分

`core`

- 只定义 `Operation`
- 只定义 reducer / inverse / result
- 不感知 Yjs

`engine`

- 提供 `commands.*`
- 提供 `applyOperations(...)`
- 提供当前 `Document` snapshot
- 提供 `commit` 事件/存储
- 提供 history 配置
- 不感知 provider / awareness

`collab`

- 绑定 `EngineInstance`
- 绑定 `Y.Doc`
- 监听本地 commit，镜像到 Yjs
- 监听远端 Yjs transaction，编译回 engine operations
- 处理 echo suppression
- 处理 bootstrap / reconnect / resync

`react`

- 仍然只做 UI
- 初期不作为协同主入口
- 后续如有必要，再加 react 侧便捷接法

---

## 7. 接入 Yjs 的最终形态

## 7.1 Yjs 作为共享状态镜像

推荐把白板文档在 Yjs 里 materialize 成一份共享状态镜像，而不是只存 operation log。

大致结构：

```txt
Y.Map root
  version
  document
    id
    name
    background
    meta
    nodes
      entities
        nodeId -> node map
      order -> Y.Array<NodeId>
    edges
      entities
        edgeId -> edge map
      order -> Y.Array<EdgeId>
```

其中：

- 对象用 `Y.Map`
- 数组用 `Y.Array`
- 字符串暂时直接用普通 string
- 未来如果某些字段真的进入富文本，再局部升级为 `Y.Text`

## 7.2 Node / Edge / Mindmap 在 Yjs 中的形态

`node`

- typed fields 直接落成标量或小对象
- `children` 落为 `Y.Array<NodeId>`
- `data` 落为递归 `Y.Map / Y.Array`
- `style` 落为递归 `Y.Map`

`edge`

- 结构字段直接落普通 map
- `route.points` 落 `Y.Array<Point>`
- `label` / `style` / `data` 落 nested map

`mindmap`

- 仍然只是某个 `type === 'mindmap'` node 的 `data.mindmap`
- 不额外建第二套顶层共享实体集合
- `mindmap.children.xxx` 这种数组路径在 Yjs 中就是嵌套 `Y.Array`

这条线和当前长期设计是一致的：

- `mindmap` 是 node data
- 协同层不需要理解第二套实体模型

---

## 8. Canonical operation 到 Yjs 的映射

## 8.1 `node.update.records`

`{ scope: 'data', op: 'set', path?, value }`

- `path` 为空：替换 `node.data` 根对象
- `path` 非空：确保祖先 map 存在，设置 leaf

`{ scope: 'style', op: 'set', path?, value }`

- 规则同上

`{ scope: ..., op: 'unset', path }`

- 删除 leaf key

`{ scope: 'data', op: 'splice', path, index, deleteCount, values }`

- 对应目标 `Y.Array` 的 delete/insert

## 8.2 typed fields

`fields.position / size / rotation / layer / zIndex / children / locked`

- 直接写到 node map 对应字段
- `children` 如果是整数组替换，可以直接重建该 `Y.Array`

## 8.3 create / delete / order

`node.create`

- 创建实体 map
- 插入 `nodes.entities`
- 按需要写入 `nodes.order`

`node.delete`

- 删除实体 map
- 从 `nodes.order` 去掉 id

`node.order.set`

- 直接重写 order array

edge 同理。

---

## 9. remote 回放如何做

## 9.1 不直接把 Yjs 事件当最终业务语义

Yjs transaction event 只是底层共享结构变化，不是业务 operation。

因此 remote 回放不应该做成：

- “直接把某个 `Y.MapEvent` 当成一个业务命令”

正确方式应该是：

1. 观察一整个 remote transaction
2. 提取受影响的 node / edge / order / path 范围
3. 读取当前 engine document 快照
4. 读取 transaction 后的 Yjs materialized snapshot
5. 在受影响范围内做定向 diff
6. 编译成 canonical `Operation[]`
7. `engine.applyOperations(..., { origin: 'remote' })`

## 9.2 为什么建议“受影响范围 diff”而不是纯事件直译

纯事件直译的问题：

1. Yjs event 语义比较底层
2. 嵌套结构变化时，很容易把业务含义拆碎
3. 同一 transaction 里多处变化需要重新聚合

受影响范围 diff 的优点：

1. 编译逻辑更接近当前 engine 的 canonical mutation
2. 可以直接按 node/edge 为单位聚合
3. 当细粒度无法稳定表达时，可以退化到根级 `set`

换句话说，remote decoder 的策略应该是：

- 优先编译成精确 mutation
- 编译不稳时允许退化到更粗的 canonical mutation
- 尽量不要退化到整份 document replace

## 9.3 合法的 fallback

当远端 Yjs transaction 太复杂，或者某段嵌套 diff 很难稳定还原成最小 `set/unset/splice` 时，允许：

- 退化成单个 node 的 `data` 根级 `set`
- 或某个 path 根级 `set`
- 或 `node.order.set`
- 或 `edge.order.set`

不建议：

- steady-state 退化成 `document.replace`

`document.replace` 只应该用于：

- 首次 bootstrap
- 全量 resync
- 明确的恢复流程

---

## 10. 本地写入链路

长期推荐的本地链路如下：

1. UI 调 `instance.commands.*`
2. `engine` 正常产出本地 commit
3. `collab session` 订阅 `engine.commit`
4. 如果 commit 来源不是 remote，就把 `changes.operations` 镜像写入对应的 Yjs document mirror
5. 该 Yjs transaction 带一个本地 origin token，用于 suppress 本地 echo

关键点：

- `collab` 不需要重新翻译业务命令
- `collab` 只消费已经 canonical 化的 `Operation[]`
- `undo/redo` 在同步层里也只是普通前向变更

---

## 11. bootstrap / reconnect / resync

## 11.1 bootstrap 必须单向选择真相源

首次建立 session 时，不能做“双向神奇合并”。

必须明确只选一个源：

- `engine-first`
- `yjs-first`

推荐规则：

1. 如果远端 `Y.Doc` 已经有版本和实体，默认 `yjs-first`
2. 如果远端是空文档，默认 `engine-first`

## 11.2 engine-first

流程：

1. 读取 `engine.document.get()`
2. 把整份 `Document` materialize 到 `Y.Doc`
3. 标记版本信息
4. 从这一刻开始进入 steady-state 增量同步

## 11.3 yjs-first

流程：

1. materialize 当前 `Y.Doc` 为 `Document`
2. 调一次 `engine.document.replace(...)`
3. 清空本地 history
4. 从这一刻开始进入 steady-state 增量同步

## 11.4 reconnect

重连时：

- 不应该重新 bootstrap
- 只需要恢复 provider 连接
- 本地离线期间已写入的 Yjs update 会自动同步

## 11.5 resync

只有在检测到本地 engine snapshot 与 Yjs snapshot 不一致且无法用增量修复时，才进入 resync。

resync 允许：

- materialize 整份 `Y.Doc`
- `engine.document.replace(...)`
- 清理会话内部去重缓存

这应当是异常恢复路径，不应是日常主链路。

---

## 12. history、undo/redo、presence 的边界

## 12.1 history

history 继续只存在于本地 engine。

规则：

1. remote apply 使用 `origin: 'remote'`
2. 默认 `captureRemote = false`
3. 所以远端回放不会污染本地 undo 栈

## 12.2 undo / redo

本地 `undo/redo` 的结果会形成新的前向变更，再镜像到 Yjs。

也就是说：

- 协同层不同步“撤销栈”
- 协同层只同步“这次实际改了什么”

## 12.3 awareness / cursor / selection / presence

这些都不应该进入 `Document`。

建议：

- 直接使用 provider awareness
- 放在 `@whiteboard/collab` 会话里管理
- 不进入 history
- 不进入 engine document

这和白板 transient state 的长期方向是一致的。

---

## 13. 新包设计

## 13.1 包名

推荐直接新增：

`packages/whiteboard-collab`

对应包名：

`@whiteboard/collab`

不建议现在就拆成：

- `@whiteboard/collab-core`
- `@whiteboard/collab-yjs`
- `@whiteboard/react-collab`

因为现在真正落地的只有一条主线，过早拆会制造抽象负担。

## 13.2 依赖建议

`dependencies`

- `@whiteboard/core`
- `@whiteboard/engine`
- `yjs`

provider 建议不要直接硬编码成主依赖。

更推荐：

- `yjs` 是主依赖
- `y-websocket` / `@hocuspocus/provider` / `y-webrtc` 由业务侧注入

这样 `@whiteboard/collab` 只绑定 Yjs 协议面，不绑定单一传输实现。

## 13.3 建议目录

```txt
packages/whiteboard-collab/
  src/
    index.ts
    types.ts
    session/
      createCollabSession.ts
      sessionState.ts
    yjs/
      createYjsSession.ts
      schema.ts
      materialize.ts
      mirror/
        applyOperationsToYDoc.ts
      diff/
        collectAffectedRanges.ts
        compileRemoteOperations.ts
      awareness/
        presence.ts
```

## 13.4 建议公开 API

```ts
type CollabSession = {
  connect: () => void
  disconnect: () => void
  destroy: () => void
  status: ReadStore<'idle' | 'bootstrapping' | 'connected' | 'disconnected' | 'error'>
}

type CreateYjsSessionOptions = {
  engine: EngineInstance
  doc: Y.Doc
  provider?: {
    connect?: () => void
    disconnect?: () => void
    destroy?: () => void
    awareness?: unknown
  }
  bootstrap?: 'engine-first' | 'yjs-first' | 'auto'
}

declare function createYjsSession(
  options: CreateYjsSessionOptions
): CollabSession
```

重点：

- 绑定对象是 `EngineInstance`
- 不是 React component
- 不是 `Whiteboard` 的 `document/onDocumentChange`

---

## 14. 在新增 `whiteboard-collab` 之前，engine 必须先补的边界

这是当前真正的第一步。

## 14.1 `WriteOrigin` / public origin 扩成三态

`engine` 公开 origin 必须补齐：

```ts
type WriteOrigin = 'user' | 'system' | 'remote'
```

不能 `core` 有 `remote`、`engine` 没有。

## 14.2 公开 `applyOperations`

需要一个明确的 raw apply 入口：

```ts
engine.applyOperations(
  operations: readonly Operation[],
  options?: { origin?: WriteOrigin }
): CommandResult
```

作用：

- remote transaction 回放
- 测试
- 导入/回放
- 协同 adapter

这个入口必须是公开正式边界，不能让 `collab` 偷摸复用内部 writer。

## 14.3 公开当前 `Document` snapshot

需要：

```ts
engine.document.get(): Document
```

或等价能力。

没有这条线，协同层无法稳定完成：

- engine-first bootstrap
- remote diff 编译
- checkpoint/export
- 不一致诊断

## 14.4 保留并复用现有 `commit`

当前 `engine.commit` 已经足够接近需要的形态。

`collab` 本地出站可以直接订阅它，消费：

- `changes.operations`
- `changes.origin`
- `impact`
- `kind`

因此这里不需要重造一套事件系统，只要确保 `commit` 继续稳定即可。

---

## 15. `@whiteboard/react` 的策略

第一阶段不建议把协同直接挂在 `@whiteboard/react` 公共 props 上。

原因：

1. 当前 React 公共面偏受控快照同步。
2. 协同主链路需要的是 `EngineInstance` 级别增量边界。
3. 直接在 props 上塞 `doc/provider/onSync` 很容易把组件层搞成协议层。

推荐顺序：

1. 先让 `@whiteboard/collab` 绑定 `EngineInstance`
2. 等 engine 侧能力稳定以后，再决定是否给 `@whiteboard/react` 增加便捷接法

如果后续确实要支持 React 便捷接法，推荐两种选择之一：

1. `Whiteboard` 增加 `collab` 配置，由内部绑定 session
2. `Whiteboard` 暴露一个窄的 engine/collab binding hook

不建议：

- 继续靠受控 `document` props 驱动协同主链路

---

## 16. 分阶段实施顺序

## 阶段 0：补 engine 协同边界

目标：

- 让协同 adapter 可以只依赖公开 API 生存

要做的事：

1. `WriteOrigin` 补 `remote`
2. `EngineInstance` 公开 `applyOperations`
3. `EngineInstance` 公开当前 `Document` snapshot 读取
4. 确认 `commit` 对外语义稳定

完成标准：

- 不借助内部 writer，也能做 remote replay
- 不借助 React `document` props，也能做 bootstrap

## 阶段 1：新增 `packages/whiteboard-collab`

目标：

- 建立独立协同宿主

要做的事：

1. 新建包和基础导出
2. 定义 session 类型
3. 定义 Yjs schema
4. 实现 bootstrap 模式选择

完成标准：

- 能创建 session
- 能把 engine snapshot materialize 到 Y.Doc
- 能从 Y.Doc hydrate 一次 engine

## 阶段 2：本地出站镜像

目标：

- 本地 commit 能稳定写入 Yjs

要做的事：

1. 订阅 `engine.commit`
2. 忽略 remote origin
3. 把本地 `changes.operations` 应用到 Y.Doc
4. 做本地 transaction origin 标记，避免 echo

完成标准：

- 单客户端时，本地编辑能稳定更新 Y.Doc
- `undo/redo` 也能正确镜像

## 阶段 3：远端入站编译

目标：

- remote Yjs transaction 能稳定变成 engine operations

要做的事：

1. 观察非本地 origin 的 Yjs transaction
2. 收集受影响实体和路径
3. 对 engine 当前快照和 YDoc 当前快照做范围 diff
4. 编译成 `Operation[]`
5. `engine.applyOperations(..., { origin: 'remote' })`

完成标准：

- 双客户端能收敛
- remote 不污染本地 history
- 不依赖 steady-state `document.replace`

## 阶段 4：精细化 diff 与 fallback 收敛

目标：

- 减少不必要的根级 `set`

要做的事：

1. 对 node data/style 做更精确的 path diff
2. 对数组变化优先产出 `splice`
3. 对 mindmap children 走稳定的 `splice`
4. 把不得不退化的场景限制在局部根级 `set`

完成标准：

- 大多数远端更新能落到最小必要 mutation
- read impact 不会因为粗暴 replace 被放大

## 阶段 5：provider / awareness / 重连治理

目标：

- 让 session 真正可用

要做的事：

1. 支持 provider 注入
2. awareness 映射 cursor / selection / presence
3. 重连和 resync 策略
4. 错误状态和会话状态输出

完成标准：

- 断线重连后能恢复
- awareness 不进入 document/history

## 阶段 6：React 便捷接法

目标：

- 在不污染 React 主边界的前提下提供便捷接法

要做的事：

1. 决定是 `collab` prop 还是实例绑定 hook
2. 对齐生命周期
3. 明确 collab 模式下不再鼓励外部持续推整份 `document`

完成标准：

- React 接入简单
- 但底层仍然是 engine/collab 边界，不是 props 快照同步

---

## 17. 测试与验收标准

至少要覆盖下面这些场景：

1. 单客户端本地编辑后，Y.Doc 与 engine snapshot 一致
2. 双客户端同时改同一 `data` key，最终收敛
3. 双客户端同时改不同 `data` key，最终都保留
4. 双客户端同时改 `style` 不同字段，最终都保留
5. `mindmap.children.xxx` 并发 `splice`
6. 本地 undo 后同步到远端
7. remote apply 默认不进入本地 undo 栈
8. 远端已有文档，`yjs-first` bootstrap 成功
9. 远端空文档，`engine-first` bootstrap 成功
10. 断线期间本地编辑，重连后最终收敛
11. provider awareness 不进入 document
12. steady-state 不依赖整份 `document.replace`

---

## 18. 风险与取舍

## 18.1 最大风险

真正最难的不是把 Yjs 接进来，而是：

- 把 remote Yjs transaction 稳定编译回 engine operations

这是整个方案里最需要谨慎设计和测试的部分。

## 18.2 但这个难点是值得承担的

因为一旦这层做好，收益非常大：

1. `engine` 仍然保持业务语义中心
2. `Yjs` 负责共享状态复制
3. `collab` 成为真正可替换的桥接层
4. `mindmap` 不需要第二套协同模型
5. 未来即使不想继续强依赖 Yjs，也不需要推翻 engine

## 18.3 明确不追求的事

第一阶段不追求：

1. provider 全家桶同时支持
2. React props 级一键协同
3. 富文本级 `Y.Text`
4. 零 fallback 的完美最小 diff

先把：

- engine 边界
- YDoc mirror
- remote compile
- bootstrap / reconnect

这四件事做稳，价值最大。

---

## 19. 最终建议

如果只保留一句话：

**下一步不是立刻写 Yjs 代码，而是先把 `engine` 补成一个正式的协同宿主，然后在 `packages` 下新增 `whiteboard-collab`，用 Yjs 做第一实现，并把 steady-state 同步建立在 `Yjs document mirror + engine canonical operation bridge` 之上。**

再具体一点，推荐按下面顺序执行：

1. 先补 `engine` 的 `remote origin`
2. 再补 `engine.applyOperations(...)`
3. 再补 `engine.document.get()`
4. 然后新增 `packages/whiteboard-collab`
5. 再实现 `Y.Doc` materialize + bootstrap
6. 再实现 local commit -> Yjs mirror
7. 最后实现 remote Yjs transaction -> engine operations

这条线最稳，也最符合当前代码已经形成的长期方向。
