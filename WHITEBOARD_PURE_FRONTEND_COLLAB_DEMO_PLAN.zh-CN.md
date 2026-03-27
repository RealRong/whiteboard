# Whiteboard 纯前端协作 Demo 方案

## 1. 文档目标

这份文档是对 `WHITEBOARD_COLLAB_YJS_IMPLEMENTATION_PLAN.zh-CN.md` 的补充，聚焦一个更具体的问题：

1. 现在的仓库能不能做一个纯前端协作 demo。
2. 这个 demo 能不能包含远端指针位置。
3. 除了文档同步外，还需要补哪些协作能力，才会像一个完整的协作演示。
4. 最合理的落地顺序是什么，避免为了 demo 把长期边界做坏。

本文默认前提：

- 优先长期最优，不考虑兼容成本。
- demo 可以先服务于验证，不要求一开始就做成最终 public API。
- 协同文档态与协同临时态必须分层。

---

## 2. 结论

## 2.1 能不能做纯前端协作 demo

能做。

但要区分三种“纯前端”：

1. **同页面双白板共享一个 `Y.Doc`**
   - 这是最简单的本地演示。
   - 适合验证 engine 与 Yjs 的同步链路。

2. **同浏览器多标签页协作**
   - 这是最推荐的第一阶段 demo 形态。
   - 可以用 `BroadcastChannel` 或 Yjs 本地同步能力做 transport。
   - 不需要自建后端。

3. **跨设备多人协作**
   - 如果走 `y-webrtc`，文档与大部分同步逻辑仍然可以在前端完成。
   - 但通常仍然需要信令服务器，因此不算严格意义上的“零后端”。

因此，这里建议把“纯前端协作 demo”的第一目标定义为：

**同浏览器多标签页共享一个白板文档，并同步远端 cursor / selection / 用户状态。**

## 2.2 能不能包含指针位置

能做，而且应该做。

但“远端指针位置”不属于文档同步的一部分，而属于 **presence / awareness**。

也就是说：

- 文档结构、节点内容、边关系，走 `Document <-> engine <-> Y.Doc`
- 指针、远端选区、用户在线状态、工具态，走 `awareness`

不能把 pointer 信息塞进 `Document`，也不能进入 history。

## 2.3 当前主要缺口是什么

当前最大的缺口不是 Yjs，也不是 engine。

当前最大的缺口是：

**`@whiteboard/react` 到 `@whiteboard/collab` 还没有一条公开、干净的绑定面。**

现在已有能力已经足够支撑协同底座：

- `engine.document.get()`
- `engine.applyOperations(...)`
- `WriteOrigin = 'remote'`
- `@whiteboard/collab` 的 `createYjsSession(...)`

但 demo 当前拿到的是 `WhiteboardInstance`，而 `createYjsSession(...)` 要求的是 `EngineInstance`。

这意味着：

- 协同基础设施已经有了
- demo 还没有合法接上协同的桥

## 2.4 demo 除了 pointer 还应补哪些协作能力

如果目标只是“能看见协作”，至少还应补下面这些：

- 房间或频道概念
- 用户身份与颜色
- 连接状态
- 远端 cursor
- 远端 selection 高亮

如果目标是“像样的协作 demo”，建议继续补：

- 远端当前工具态
- 远端正在编辑哪个节点
- 用户加入/离开反馈
- stale presence 清理
- 断线重连与 resync 提示

---

## 3. 当前代码现状

## 3.1 已有的协同底座

当前仓库已经具备文档协同的核心能力：

- `@whiteboard/collab` 已有 `createYjsSession(...)`
- 本地 commit 已可镜像到 `Y.Doc`
- 远端 `Y.Doc` 变更已可编译为 engine operations 并回放
- remote operation 默认不进入 undo

这说明：

- 文档同步链路已经基本成立
- 不是从零开始设计协作
- demo 不需要重新造协同内核

## 3.2 现有 demo 仍然是受控 document 模式

`apps/demo/src/App.tsx` 当前是标准受控组件模型：

- 外部持有 `doc`
- `<Whiteboard document={doc} onDocumentChange={...} />`
- 白板内部修改后整份回传 `document`

这条线适合单机演示，不适合作为协同主链路。

原因：

- 它是整份文档回传，不是增量同步
- 它没有明确的 `origin`
- 它会把 React 受控状态与协同会话生命周期混在一起

## 3.3 `react -> collab` 绑定面还没打开

当前 `@whiteboard/react` 的公开 ref 类型是 `WhiteboardInstance`，不暴露 `engine`。

但 `@whiteboard/collab` 的 `createYjsSession(...)` 需要 `EngineInstance`。

内部其实已经有 `InternalInstance.engine`，只是没有对外暴露。

这说明当前问题是：

- 不是 `engine` 不支持协同
- 不是 Yjs 不适配当前 mutation 模型
- 而是 `react` 公共边界没有把协同桥接出来

## 3.4 pointer 相关能力其实已经足够

虽然 pointer presence 还没实现，但现有 runtime 已经具备关键几何能力：

- `instance.viewport.pointer({ clientX, clientY })`
- `instance.viewport.worldToScreen(point)`
- `instance.read.node.bounds(nodeId)`

这已经足够支持：

- 本地 pointer 坐标采集
- 远端 cursor 屏幕坐标渲染
- 远端 selection 的世界坐标到屏幕坐标转换

所以 pointer 这条线并不需要额外改 engine。

---

## 4. 纯前端协作 demo 的推荐目标

推荐把第一版 demo 的目标明确收成下面这组能力：

1. 两个及以上标签页打开同一个 demo 页面。
2. 所有白板文档修改实时同步。
3. 每个用户有独立名字和颜色。
4. 能看到远端 cursor。
5. 能看到远端 selection 高亮。
6. 能看到连接状态。

这组能力已经足够说明两件事：

1. 文档 CRDT 同步链路成立。
2. presence 临时态同步链路成立。

不建议第一版就追求：

- 跨公网多人房间
- 权限与鉴权
- 历史持久化
- 服务端文档存储
- 文本级意图提示

---

## 5. 推荐架构

## 5.1 文档同步链路

文档态采用下面的链路：

`Whiteboard UI -> instance.commands.* -> engine commit -> @whiteboard/collab -> Y.Doc -> 远端 @whiteboard/collab -> engine.applyOperations(...) -> React 视图更新`

关键原则：

- 文档协同的单一业务语义仍然由 `core/engine` 决定
- `Y.Doc` 负责状态复制与并发收敛
- `@whiteboard/collab` 只负责桥接与会话编排
- steady-state 不走整份 `document.replace`

## 5.2 presence 链路

presence 应采用独立链路：

`UI pointer / selection / tool state -> awareness.publish -> 远端 awareness.subscribe -> React overlay`

presence 数据不进入：

- `Document`
- reducer
- history
- undo / redo

## 5.3 推荐的 demo transport

第一阶段最推荐：

- `Y.Doc`
- `BroadcastChannel`
- provider awareness

原因：

- 不需要后端
- 能真实验证多 tab 协作
- 能同时演示文档同步和 presence
- 对 demo 成本最低

同页双白板共享 `Y.Doc` 可以作为更小的预演，但不建议把它当成最终 demo 形态，因为它太“实验室”，说服力不如多标签页。

---

## 6. 需要补的边界与设计

## 6.1 最关键的缺口：React 绑定面

要让 demo 真正接入协同，必须补一层 `react -> collab` 绑定。

这里有两个方案。

### 方案 A：先做 demo 内部桥接

做一个只服务 demo 的桥接层，在 `Whiteboard` 内部树中拿到内部 instance，再创建 `YjsSession`。

优点：

- 最快
- 不需要立即定死 public API
- 适合先验证协同体验

缺点：

- 不是最终形态
- 接法不够正式

### 方案 B：补正式公开接缝

给 `@whiteboard/react` 增加一条正式协同入口。

长期更优的方向有两种：

1. `Whiteboard` 增加 `collab` 配置入口
2. 新增一个薄层 `@whiteboard/react-collab` 或等价 helper

长期不建议的方向：

- 直接把 `engine` 粗暴暴露到 `WhiteboardInstance` 公共 ref

原因：

- 这会把 `react` 的内部运行时边界直接泄漏出去
- 未来 public surface 会过宽

因此第一阶段可以允许 demo 内部桥接，长期则应收敛成窄的正式协同入口。

## 6.2 pointer / presence schema

推荐最小 presence schema：

```ts
type PresenceState = {
  user: {
    id: string
    name: string
    color: string
  }
  pointer?: {
    world: { x: number; y: number }
    screen?: { x: number; y: number }
    timestamp: number
  }
  selection?: {
    nodeIds: string[]
    edgeIds: string[]
  }
  tool?: {
    type: string
    value?: string
  }
  activity?: 'idle' | 'pointing' | 'dragging' | 'editing'
}
```

设计原则：

- canonical 坐标优先使用 `world`
- `screen` 只作为可选调试或本地优化字段
- `selection` 只同步轻量标识，不同步几何结果
- presence 必须可过期

## 6.3 远端 selection 的实现方式

远端 selection 不应该作为文档状态同步。

推荐实现：

1. awareness 里只传 `nodeIds / edgeIds`
2. 远端用本地 `instance.read.node.bounds(...)`
3. 再用 `instance.viewport.worldToScreen(...)` 或现有视口变换渲染 overlay

这样做的好处：

- 不需要把临时几何状态塞进共享文档
- 不会污染 history
- 几何仍由本地引擎读模型计算

---

## 7. 第一版 demo 的最小功能清单

建议第一版就明确做到下面这些，少一项都不够像完整协作 demo：

- 文档同步
- 多标签页同步
- 用户身份
- 用户颜色
- 连接状态
- 远端 cursor
- 远端 selection
- 标签页关闭或失焦后的 presence 清理

建议第二版再加：

- 远端当前工具态
- 远端编辑态
- 远端视口位置
- follow user
- reconnect / resync 控件

建议后面再考虑：

- 房间持久化
- 历史恢复
- 服务端同步
- 权限与成员管理

---

## 8. 分阶段实施方案

## 阶段 1：打通 demo 文档协同主链路

目标：

- demo 不再只依赖受控 `document/onDocumentChange`
- 白板实例真正挂上 `YjsSession`

工作：

- 在 demo 或 React 内部补一层 collab bridge
- 用共享 `Y.Doc` 把本地修改同步到另一份白板实例
- 确认 remote 不进入 undo

阶段完成标志：

- 多个白板实例对同一文档的结构修改可双向同步

## 阶段 2：接入纯前端 transport

目标：

- 让协作从“同页面共享对象”提升到“多标签页”

工作：

- 选定 `BroadcastChannel` 作为第一 transport
- 基于 Yjs provider 或自定义极薄 provider 连接多标签页
- 处理 connect / disconnect / synced 状态

阶段完成标志：

- 两个浏览器标签页打开 demo，可实时同步文档

## 阶段 3：接入 awareness / pointer presence

目标：

- 能看到远端 cursor 与在线用户

工作：

- 定义 presence schema
- 本地 pointermove 节流发布
- pointerleave / blur / disconnect 时清空 pointer
- 远端渲染 cursor + 用户名 + 颜色

阶段完成标志：

- 多标签页间能看到远端 cursor 实时移动

## 阶段 4：补远端 selection 与工具态

目标：

- 协作体验从“只看到 cursor”提升到“能理解对方在做什么”

工作：

- awareness 里同步 `selection`
- awareness 里同步 `tool`
- 根据 `nodeIds` 渲染远端 selection overlay

阶段完成标志：

- 能看到远端选中的节点和当前工具

## 阶段 5：补重连、过期和演示级 UX

目标：

- 让 demo 的协作状态完整可感知

工作：

- 连接状态 UI
- stale presence 过期清理
- resync 按钮
- 用户加入/离开提示

阶段完成标志：

- demo 在断开、恢复、切 tab、关闭 tab 的情况下行为可解释

---

## 9. 哪些能力不应该放进第一版

第一版 demo 不建议做这些：

- 文本级协同编辑意图提示
- 锁定节点
- 服务端房间管理
- 持久化历史
- 复杂冲突提示 UI
- 跨设备公网可用性

原因不是这些不重要，而是：

- 第一版的目标是证明边界合理
- 不是一次性把协同产品做完

---

## 10. 是否需要新增包

## 10.1 现在做 demo，是否需要新增 `packages` 下的新包

不需要。

原因：

- `@whiteboard/collab` 已经存在
- demo 当前缺的是“绑定面”和“presence UI”
- 这两件事先在 demo 或 `@whiteboard/react` 内收口更合理

## 10.2 后续是否可能新增 `@whiteboard/react-collab`

有可能，但不应现在就上。

只有在下面条件成立时，才值得新增：

- `@whiteboard/collab` 的 session / provider / awareness 接口稳定
- `react` 侧存在明确且重复的接入模式
- 不想把协同细节塞回 `Whiteboard` props

因此建议顺序是：

1. 先把 demo 做通
2. 再观察最合理的 React 接入形式
3. 最后再决定是否拆出 `react-collab`

---

## 11. 最推荐的最终方案

如果目标是用最小成本做出最有说服力的纯前端协作演示，推荐方案是：

1. 使用现有 `@whiteboard/collab` 作为文档协同底座。
2. 在 demo/React 内部补一个临时但边界清晰的 collab bridge。
3. 使用 `BroadcastChannel` 做多标签页纯前端同步。
4. 使用 awareness 做用户信息、cursor、selection、工具态。
5. 文档态与 presence 态严格分离。

这条路线的优点：

- 能最快产出真实可见的协作 demo
- 不会把 Yjs 反向耦死进 engine
- 不会把 pointer / selection 污染进文档模型
- 保留后续抽象为正式 React 协同入口的空间

---

## 12. 一句话判断

当前仓库已经具备“文档协同”的底座，缺的是一层 `react -> collab` 绑定和一套真正的 presence 实现。

所以答案不是“能不能做”，而是：

**可以做，而且可以做得很像样；第一步应先完成多标签页文档同步与远端 cursor，而不是继续扩大 engine 或 document 的职责。**
