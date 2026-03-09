# ENGINE_TS_REFACTOR_PLAN

## 目的

这份文档聚焦 `packages/whiteboard-engine/src/instance/engine.ts`。

目标不是做局部代码清理，而是回答三个问题：

1. 这份文件当前每一段职责是否顺。
2. 哪些点虽然能工作，但结构上别扭，未来会继续长歪。
3. 如果按长期最优路线重构，`engine.ts` 应该收敛成什么样。

本文默认前提：

- 接受 breaking change。
- 不追求兼容旧结构。
- 优先追求主链清晰、职责稳定、漏斗原则明确。

## 当前 engine.ts 在做什么

当前 `engine.ts` 实际同时承担了这些职责：

1. 创建底层容器：`store`、`scheduler`、`registries`、`viewport`。
2. 初始化状态系统：`setupState()`、`readDocument()`、初始 tool 写入。
3. 管理 document 提交：`commitDocument()`。
4. 管理提交后的 fan-out：`afterCommit()`。
5. 装配核心子系统：`read`、`write`、`reactions`、`commands`。
6. 处理 runtime 级配置应用：`runtime.applyConfig()`。
7. 处理生命周期：`runtime.dispose()`。

也就是说，这个文件不是单纯的 composition root，而是“组装 + 策略 + 同步 + 生命周期”四合一。

这正是阅读时觉得“有点怪”的根源。

## 逐点问题清单

### 1. document 与 viewport 的关系没有被正式建模，只是在 engine.ts 里手工同步

当前链路：

- `document.viewport` 是持久化快照。
- `state.viewport` / `ViewportHost` 是 engine 已提交运行态。
- React 侧还有 `viewportGestureState.preview` 作为手势预览态。

这意味着现在实际上存在三层 viewport：

1. `persisted viewport`：`document.viewport`
2. `committed viewport`：engine `state.viewport`
3. `preview viewport`：React `viewportGestureState.preview`

这个分层本身不是问题，问题在于它没有成为正式架构，而是靠 `engine.ts` 手工同步：

- `commitDocument()` 里：先写 `document`，再写 `viewport`
- `runtime.applyConfig()` 里：再写一次 `viewport`

当前的坏处是：

- `document` 和 `committed viewport` 不是一个显式建模的聚合。
- 更新顺序和同步规则藏在 `engine.ts` 的局部函数里。
- 其他人阅读代码时，很难一眼知道哪一层是持久化、哪一层是运行态、哪一层是预览态。

### 2. `state.batch()` 不是真 batch，导致 engine.ts 中的多状态写入只是“看起来像批量”

当前 `state.batch()` 只是直接执行回调，没有真正的批量提交语义。

这会让 `engine.ts` 里以下代码显得不可靠：

- `resetTransientState()` 中同时写 `selection` 和 `interaction`
- `commitDocument()` 中先写 `document` 再写 `viewport`
- `runtime.applyConfig()` 中依次写 `history/tool/viewport/mindmapLayout`

也就是说，`engine.ts` 里面其实有多个“应该被视作一组”的更新，但底层没有真正的组更新机制。

### 3. `afterCommit()` 仍然依赖晚绑定的 `reactions`

当前：

- 先声明 `let reactions`
- 先创建 `write`
- `write` 里注入 `afterCommit`
- `afterCommit` 再通过闭包调用 `reactions?.ingest`
- 最后再创建 `reactions`

这说明构造顺序存在真实循环依赖：

- `write` 提交后要把 impact 给 `reactions`
- `reactions` 内部又要用 `write.apply`

这并不是 bug，但结构上明显别扭：

- 正确性依赖构造顺序。
- `engine.ts` 不得不持有一个可变的“尚未完成初始化”的下游引用。
- 读代码时会自然怀疑：为什么一个核心对象的依赖要晚绑定？

### 4. `engine.ts` 里仍然内联了太多“应下沉的局部策略”

目前内联的局部策略包括：

- `assertImmutableDocumentInput()`
- `resetTransientState()`
- `commitDocument()`
- `notifyDocumentChange()`
- `afterCommit()`
- `runtime.applyConfig()`

这些函数都不只是简单一行转发，而是承载真实语义规则。

这意味着 `engine.ts` 并不是单纯在“装配模块”，而是在装配时顺手承担了多个 feature 的细节实现。

### 5. `state.write('tool', 'select')` 是冗余且危险的第二初始化路径

`tool` 默认值已经来自 `createInitialState()`。

但 `engine.ts` 里又额外手动写了一次：

- `state.write('tool', 'select')`

这会制造两个问题：

1. 初始 tool 的单一真源被破坏。
2. 将来若默认值从 `select` 改成别的，这里很容易忘改。

这是典型的“能跑，但未来一定埋雷”的初始化重复。

### 6. `resetTransientState()` 依赖 `createInitialState()` 的整包返回，语义不聚焦

当前重置的是 transient 状态，但实现方式是：

- 创建整份初始 state
- 只取其中的 `selection` 和 `interaction`

这会造成几个问题：

- transient reset 和 full initial state 耦合在一起。
- `createInitialState()` 未来字段增加时，这个函数被动受影响。
- 语义上不够明确：这里到底在重置“全部状态”，还是仅重置“会话态/交互态”？

### 7. `read.read` 这种命名说明 read kernel 的返回形状还不够拉直

`createReadKernel()` 现在返回：

- `read`
- `ingest`

所以在 `engine.ts` 里自然出现：

- `read.ingest`
- `read.read`

这个命名不会造成功能问题，但会持续污染阅读体验，也说明 read kernel 的返回对象还没有完全按职责收口。

### 8. `baseInstance` 和 `internalInstance` 的二段式拼装不够直观

当前先造：

- `baseInstance: WriteInstance`

再扩展成：

- `internalInstance = { state, ...baseInstance, read: read.read }`

这会产生两个别扭点：

- 读者很难立即判断“哪个 instance 才是系统真正的核心实例形态”。
- 各子系统依赖的 instance 片段是通过对象展开临时拼出来的，而不是由明确的工厂分层产出。

### 9. `runtime.applyConfig()` 混合了“配置应用”和“运行态同步”两种职责

当前 `runtime.applyConfig()` 同时处理：

- `history.configure()`
- `tool`
- `viewport`
- `mindmapLayout`

其中真正像“配置”的只有一部分：

- `history`

而 `viewport`、`tool`、`mindmapLayout` 更像 runtime state / host sync / session snapshot。

也就是说，`applyConfig` 这个命名和它实际做的事情并不完全一致。

### 10. `runtime.dispose()` 不是一个真正完整的生命周期关闭点

当前只做：

- `reactions.dispose()`
- `scheduler.cancelAll()`

但没有：

- 全局 `disposed` guard
- 禁止后续 commands 继续执行
- 阻止 afterCommit 在 dispose 后继续 fan-out

这使得 `dispose()` 更像“关掉部分副作用”，不是“实例进入不可继续使用状态”。

### 11. `notifyDocumentChange()` 只是单层包装，存在感过低但又打断阅读

它本质只是：

- `onDocumentChange?.(nextDocument)`

单独拿出来并没有形成一个稳定的抽象层，反而增加了阅读跳转。

如果只是临时包装，不值得留在 `engine.ts`。如果想保留，应该和 `afterCommit` 放进同一个提交后 effect 模块里。

### 12. `commitDocument()` 对 `viewport` 的引用顺序不自然

`commitDocument()` 中使用了后面才声明的 `viewport` 变量。

这不是错误，但在这种已经很密集的入口文件中，会进一步加重“靠 JS 闭包顺序碰巧成立”的感觉。

## 对 viewport 三层设计的判断

## 当前方案到底是不是错的

不是。

准确说，当前 viewport 设计思路本身是合理的，但没有被正式表达清楚。

正确的理解应该是：

1. `document.viewport`
   - 持久化快照
   - 用于导出、保存、外部同步

2. engine committed viewport
   - 当前 engine 已确认的运行态 viewport
   - 供 hit-test、坐标换算、commands 等热路径读取

3. UI preview viewport
   - 仅用于交互过程中的预览
   - 例如 wheel 缩放过程、空格拖拽平移过程

这三层分离本身很合理，尤其在你的场景里：

- viewport 高频变更
- 预览态不应每帧都写回 document
- 需要在手势结束时再持久化到 `document.viewport`

所以“存在多层 viewport”不是问题。

## 当前方案的问题不在于有三层，而在于三层边界没有被正式命名和封装

当前最怪的不是三层本身，而是：

- 三层都存在，但只有 React preview 是显式命名的。
- engine committed viewport 和 persisted viewport 的同步规则散落在 `engine.ts`。
- `runtime.applyConfig()` 又参与了一次 viewport 写入，使链路显得更混。

## 长期最优的 viewport 设计

建议保留三层，但正式命名并明确职责：

### A. persisted viewport

来源：`document.viewport`

语义：

- 文档级快照
- 可序列化
- 可同步到外部

### B. committed viewport

来源：engine 内部 viewport runtime

语义：

- 已提交的运行态 viewport
- 供引擎坐标计算和命令读路径使用
- 不等同于“预览中正在变化的 viewport”

### C. preview viewport

来源：React 侧或 host 侧 gesture state

语义：

- 仅交互预览
- 不进 document
- 不成为 engine 公共持久事实

## 设计建议

### 方案 A：保留三层，但把 committed viewport 提升为正式 runtime 概念

这是推荐路线。

建议把 engine 内部这层明确命名为：

- `committedViewport`
- 或 `viewportRuntime`

然后把同步规则集中到单一模块，例如：

- `instance/document/documentRuntime.ts`
- 或 `instance/viewport/committedViewport.ts`

统一处理：

- 从 document 初始化 committed viewport
- 文档提交后同步 committed viewport
- host runtime 配置更新时同步 committed viewport

这样 `engine.ts` 不再自己写：

- `store.set(document)`
- `viewport.setViewport(...)`

而只调用一个更高层的动作，例如：

- `documentRuntime.commit(doc)`
- `documentRuntime.replace(doc)`

### 方案 B：取消 engine committed viewport，只保留 document + preview

不推荐。

因为这样会导致：

- 每次 committed viewport 读取都必须回到 `document.viewport`
- 交互热路径和文档存储层耦合过紧
- 你现在已有的 runtime viewport getter 价值下降

更重要的是，这会把“快速交互中的稳定已提交态”这个概念抹掉。

### 方案 C：把 preview viewport 也放进 engine

不推荐。

preview 本质是 UI 手势态：

- 高频
- 容易撤销
- 不需要进入文档
- 与 DOM 交互生命周期高度相关

把它拉进 engine 会污染 engine 的公共事实层。

## 结论

viewport 最优设计不是“单状态”，而是：

- persisted viewport
- committed viewport
- preview viewport

三层并存，但：

- 必须正式命名
- 必须集中同步
- 必须从 `engine.ts` 的局部函数里抽出去

## 长期最优重构目标

目标是让 `engine.ts` 退化成真正的装配层，只做以下事情：

1. 创建基础依赖：store、scheduler、registries
2. 创建 document runtime
3. 创建 viewport runtime
4. 创建 read
5. 创建 write
6. 创建 reactions
7. 创建 commit effects
8. 组装 commands 和 runtime
9. 返回 public instance

也就是让这份文件变成：

- `createX`
- `wireX`
- `return instance`

而不是再夹带具体行为规则。

## 建议的模块拆分

### 1. `instance/document/createDocumentRuntime.ts`

负责：

- 持有 `readDocument`
- `assertImmutableDocumentInput`
- `commitDocument`
- 从 document 同步 committed viewport
- 对外暴露 `document.get` / `document.commit`

这一步完成后，`engine.ts` 不再内联 `commitDocument()`。

### 2. `instance/state/resetTransientState.ts`

负责：

- 只重置 transient state
- 只依赖需要的 state keys
- 不依赖 `createInitialState()` 全量结果

例如只暴露：

- `resetSelectionAndInteraction(state)`

### 3. `instance/commit/createCommitEffects.ts`

负责：

- `afterCommit({ doc, impact, notify })`
- `read.ingest(impact)`
- `notifyDocumentChange(doc)`
- `reactions.ingest(impact)`

如果后续还要接 telemetry / plugin hook / devtools，这里就是唯一 fan-out 点。

### 4. `instance/runtime/applyRuntimeConfig.ts`

负责：

- `history.configure`
- `tool` state 更新
- committed viewport 更新
- `mindmapLayout` state 更新

这样 `runtime.applyConfig()` 只变成一个薄调用，而不在 `engine.ts` 内联多段逻辑。

### 5. `instance/runtime/createRuntimeApi.ts`

负责：

- 组装 `store`
- `applyConfig`
- `dispose`

这样 runtime 也不再直接写在 `engine.ts` 里。

## 关于 `reactions` 与 `write` 的循环依赖

这是目前最别扭的结构点之一。

当前循环：

- `write` 提交后要把 impact 交给 `reactions`
- `reactions` 内部又需要 `write.apply`

长期最优建议不是继续保留 `let reactions`，而是把 reaction 设计收敛成“产出任务/写输入”，而不是直接持有 write。

推荐目标：

1. `reactions` 只接收 impact
2. `reactions` 产出 `WriteInput | null` 或统一 `ReactionTask`
3. engine 侧有单独 task runner 负责调用 `write.apply`

这样就能把：

- `reactions -> write.apply`

改成：

- `reactions -> task`
- `taskRunner -> write.apply`

这样一来：

- `afterCommit` 不再依赖晚绑定的 `reactions`
- `reactions` 本身也不再依赖 `write`
- `engine.ts` 可以真正按顺序创建对象，而不是依赖闭包补洞

## 推荐的最终主链

长期最优主链建议是：

1. `commands`
2. `write.apply`
3. `plan`
4. `commit`
5. `afterCommit`
6. `read.applyImpact`
7. `reactionTasks.ingest`
8. `taskRunner -> write.apply`

与 viewport 结合后：

- 交互过程：更新 `preview viewport`
- 手势结束：提交 `commands.viewport.set`
- write commit：更新 document
- afterCommit：同步 committed viewport + read + reaction
- 外部持久化：通过 `onDocumentChange` 收到带 `document.viewport` 的文档快照

## 分阶段落地顺序

### 第一阶段：低风险清理

1. 删除 `state.write('tool', 'select')`
2. 把 `resetTransientState()` 拆成独立 helper
3. 把 `notifyDocumentChange()` 内联进 commit effects 模块
4. 将 `read.read` 命名问题在 read kernel 返回层拉平

### 第二阶段：抽离 engine.ts 内联策略

1. 抽 `createDocumentRuntime()`
2. 抽 `createCommitEffects()`
3. 抽 `applyRuntimeConfig()`
4. 抽 `createRuntimeApi()`

完成后 `engine.ts` 应只剩 wiring。

### 第三阶段：正式建模 viewport 三层

1. 在文档与代码里正式命名：persisted / committed / preview
2. 把 committed viewport 的同步规则移出 `engine.ts`
3. 明确 `runtime.applyConfig()` 只更新 committed viewport，不混淆为“文档提交”
4. 审核 React 侧 `viewportGestureState` 与 engine committed viewport 的接口边界

### 第四阶段：拆掉 reactions 与 write 的循环依赖

1. 让 reactions 不直接持有 `write`
2. 统一 reaction 输出为 task 或 `WriteInput`
3. engine 侧单独运行 reaction task
4. 删除 `let reactions` 晚绑定模式

## 重构后的理想 engine.ts 形态

理想状态下，这份文件应该接近下面这种密度：

```ts
export const engine = (options: CreateEngineOptions): Instance => {
  const store = createStore()
  const scheduler = new Scheduler()
  const config = resolveInstanceConfig(options.config)
  const registries = options.registries ?? createRegistries()

  const stateSystem = createEngineState({ store, document: options.document })
  const viewport = createViewportRuntime({ store, atom: stateSystem.stateAtoms.viewport })
  const documentRuntime = createDocumentRuntime({
    store,
    stateAtoms: stateSystem.stateAtoms,
    viewport,
    onDocumentChange: options.onDocumentChange
  })

  const read = createReadRuntime({ ... })
  const reactionTasks = createReactionTasks({ ... })
  const commitEffects = createCommitEffects({
    read,
    reactions: reactionTasks,
    notifyDocumentChange: options.onDocumentChange
  })
  const write = createWrite({
    instance: ...,
    afterCommit: commitEffects.afterCommit,
    resetTransientState: resetTransientState
  })

  const runtime = createRuntimeApi({ ... })
  const commands = createCommands({ ... })

  return { state, runtime, read: read.api, commands }
}
```

也就是：

- 没有局部策略函数挤在中间
- 没有晚绑定闭包
- 没有重复初始化
- 没有 document/viewport 同步规则散落在入口文件里

## 最终结论

`engine.ts` 当前最大的问题不是写法丑，而是：

- 它承载了太多原本应被模块化的系统规则
- viewport 三层设计是合理的，但没有被正式建模
- reactions 与 write 的循环依赖仍然让入口文件保留了明显时序耦合

长期最优路线不是继续在 `engine.ts` 里做局部清理，而是把以下三件事尽快模块化：

1. document + committed viewport 同步
2. afterCommit fan-out
3. reactions task 化，拆掉对 write 的直接依赖

只要这三件事落地，`engine.ts` 会自然收敛成真正的 composition root。
