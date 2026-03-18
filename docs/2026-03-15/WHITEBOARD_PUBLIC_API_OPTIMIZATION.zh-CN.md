# Whiteboard Public API Optimization

## 1. 结论

当前 `core / engine / react` 三层的大方向已经明显变好：

- `core` 负责纯类型、算法、读模型与基础 contract
- `engine` 负责 document write funnel、history、read invalidation、typed command result
- `react` 负责 UI state、interaction、selection/container finalize、组件渲染

但如果目标是**长期最优**，下一阶段最值得做的已经不是继续抠某个局部实现，而是整体打磨 **public API surface**。

现在最影响 API 质感的，不是功能缺失，而是下面四类问题：

- public instance 和 internal instance 的边界还不够清楚
- 同一概念在不同层使用了多套名字
- 扩展能力存在，但 public story 还没有闭环
- 写命令链路已经 typed 化，但外层 public API 还残留旧风格阴影

一句话总结：

**下一阶段应从“实现重构”切换到“public surface 收口”，目标是让宿主只看到少量、稳定、命名一致、风格统一的 API。**

---

## 2. 优化目标

本轮 API 优化建议遵守以下目标。

### 2.1 一个概念只用一种说法

例如：

- 宿主传入的文档统一叫 `document`
- 组件公开类型统一以 `Whiteboard*` 命名
- 写动作统一走 `commands`
- 写结果统一返回 `CommandResult<T>`

不要同时出现：

- `Whiteboard` 和 `Board`
- `doc` 和 `document`
- `config` 和 `options`
- `BoardInstance` 和 `WhiteboardInstance` 混用

### 2.2 public API 只暴露宿主真正应该操作的能力

宿主应拿到：

- 可读状态
- 可调用命令
- 必要的 viewport 能力
- 明确的扩展入口

宿主不应拿到：

- 组件内部生命周期方法
- 只服务于 runtime 组装的内部对象
- 只有仓库内部才知道语义的中间层 helper

### 2.3 根导出最小但完整

根导出不应该过宽，也不应该缺关键入口。

最差的状态不是“导出太多”，而是：

- 明明支持扩展，却缺主入口
- 明明是内部实现，却意外进入根导出

长期最优形态应该是：

- public 能力一眼能看懂
- 宿主完成常见接入不需要深入内部目录
- 内部目录结构不等于对外承诺

### 2.4 engine 侧写入口保持纯同步、统一手感

统一手感主要体现在三件事：

- 都挂在 `commands.*`
- engine 侧都返回 `CommandResult<T>`
- 都以 typed domain result 表达领域产出

如果某一层只是对 engine command 做薄转发，也应尽量保持同步返回，而不是额外包一层 `Promise`。

engine 的定位应保持为：

- 纯内存 document mutation engine
- 同步 plan / reduce / commit / publish
- 不内建 persistence / network / plugin IO

因此 async 不应成为 engine public API 的默认形态。真正的异步职责应放在 host / effect / bridge 层，而不是放进 engine command surface。

不应再混用：

- `Promise<...>`
- `CommandResult`
- `void`
- 从 `commit.changes` 手工反推结果
- 为了转发同步 command 而保留 `await`

---

## 3. 当前最主要的问题

## 3.1 `@whiteboard/react` 的 public instance 泄露了内部生命周期

当前 `Whiteboard` 暴露给宿主的 ref 类型本质上是 runtime instance 本身，但命名和边界还没有收敛成明确的 public instance。

这会带来两个问题：

- public surface 暴露了 `configure` 和 `dispose`
- 组件内部使用的组合对象，被直接冻结成了外部契约

这不是实现是否正确的问题，而是边界语义不对：

- `dispose` 属于组件生命周期
- `configure` 属于 props 驱动的内部同步

它们不是宿主最自然的 public API。

### 最优方向

`react` 应区分两层对象：

- `InternalInstance`
- `WhiteboardInstance`

其中：

- `InternalInstance` 继续服务于 runtime 组装
- `WhiteboardInstance` 只暴露宿主应操作的最小稳定面

建议 `WhiteboardInstance` 只保留：

- `read`
- `state`
- `commands`
- `viewport`

`configure` 和 `dispose` 收回内部，不再作为 public instance 的一部分。

---

## 3.2 `Whiteboard / Board / doc / document / registries / nodeRegistry` 命名体系不统一

当前宿主入口附近混用了多套词汇：

- 组件叫 `Whiteboard`
- props 叫 `BoardProps`
- options 叫 `BoardOptions`
- ref 类型叫 `BoardInstance`
- 宿主文档入参叫 `doc`
- engine 入参叫 `document`
- core registry 集合叫 `registries`
- react 节点注册表叫 `nodeRegistry`

这类问题单点看不严重，但会持续降低 API 质感。

因为宿主会自然问出这些问题：

- `Whiteboard` 和 `Board` 是不是两个层级
- `doc` 和 `document` 有没有语义差异
- `registries` 指的是 core registries 还是 react registries

### 最优方向

宿主 public API 统一成一套词汇：

- `Whiteboard`
- `WhiteboardProps`
- `WhiteboardOptions`
- `WhiteboardInstance`
- `document`
- `onDocumentChange`
- `coreRegistries`
- `nodeRegistry`
- `options`

这里的关键不是长度，而是稳定、一致、无歧义。

我更倾向于 public API 宁可稍长，也不要短但混乱。

---

## 3.3 节点 registry 扩展能力存在，但 public story 没闭环

当前 `Whiteboard` 内部已经依赖默认节点注册表工厂，但根导出没有把这条扩展路径完整表达出来。

这会导致宿主虽然“理论上可以扩展”，但接入手感不顺。

目前更像是：

- 内部知道怎么构造默认 registry
- 外部知道可以传 `nodeRegistry`
- 但外部不容易以“默认 registry 为基底”继续扩展

### 最优方向

根导出应明确提供两类入口：

- `createNodeRegistry`
- `createDefaultNodeRegistry`

这样宿主扩展路径会自然很多：

```ts
const registry = createDefaultNodeRegistry()
registry.register(MyNodeDefinition)
```

同时，一些只服务内部的 registry context 能力，不应优先进入 public root surface。

如果某个能力：

- 仓内没有真实 public 用例
- 只是内部传递 registry 的实现细节

那它更适合作为内部实现存在，而不是作为长期承诺的公共导出。

---

## 3.4 自定义节点 renderer 的写入 API 把结果吞掉了

这是目前我认为最容易被低估、但实际很影响扩展体验的一点。

当前自定义节点 renderer 能拿到：

- `update`
- `updateData`

但它们只返回 `Promise<void>`。

这相当于把底层已经整理出来的 typed command result 又吞掉了。

结果就是自定义 renderer：

- 无法拿到失败原因
- 无法判断命令是否成功
- 无法复用统一的 `CommandResult` 处理模式

### 最优方向

renderer 扩展 API 应直接返回真实 command result：

```ts
update: (patch) => CommandResult
updateData: (patch) => CommandResult
```

这样有几个直接收益：

- 自定义节点扩展能和 feature command 使用同一套结果模型
- 错误处理不再被迫通过外层状态侧推
- public API 手感与底层 command 链路一致
- 不再为了转发 engine command 引入无意义的 `await`

这类问题属于“最后一层 public adapter 破坏了前面链路的一致性”，优先级应高于内部文件组织优化。

---

## 3.5 `engine` 的 `Commit` 模型仍有旧 result 模型残影

当前 `Commit` 已经是独立对象，但字段设计还残留旧风格阴影，例如：

- `ok: true`
- `doc`

这里的语义不够干净：

- `Commit` 不是 result，不需要 `ok`
- `doc` 与其他层的 `document` 命名不一致

### 最优方向

`Commit` 应是纯 commit 语义对象：

```ts
type Commit = {
  kind: 'apply' | 'undo' | 'redo' | 'replace'
  document: Document
  changes: ChangeSet
  impact?: KernelReadImpact
}
```

然后 `CommandResult<T>` 再持有：

- `data`
- `commit`

这样两者关系会更清楚：

- `CommandResult` 是命令执行结果
- `Commit` 是一次 document 提交事实

---

## 3.6 engine 写命令表面仍是 Promise，但内部没有真实异步需求

当前 public surface 中，大多数 mutating command 仍然返回 `Promise<CommandResult<T>>`。

但从当前 engine 实现形态看：

- planner 是同步的
- reduce / normalize / commit 是同步的
- `document.replace` 是同步的
- `history.undo / redo` 也是同步的

这说明现在的 `Promise` 更像是接口层遗留，而不是底层模型的真实需求。

问题不只是“类型有点啰嗦”，而是它会继续向外扩散：

- react feature 被迫写 `await`
- renderer 扩展 API 被迫写成 `Promise`
- command surface 看起来像支持异步管线，但 engine 实际并不是这个职责定位

### 最优方向

长期最优建议统一成：

- `engine.commands.*` 全部同步返回 `CommandResult<T>`
- `document.replace` 同步返回 `CommandResult`
- `history.undo / redo` 同步返回 `CommandResult`
- react feature 与 renderer 扩展层尽量去掉无意义的 `await`

如果未来确实需要：

- middleware
- trace
- remote bridge
- plugin interception

应把这些异步能力放在 engine 外层，而不是让 engine 为未来假想场景长期背着 async public surface。

---

## 3.7 `core` subpath barrel 仍然过宽

`@whiteboard/core` 的子域导出方向总体是对的，但一些 subpath barrel 还在大面积 `export *`。

这种方式短期方便，长期问题在于：

- 内部 helper 容易被顺手暴露
- public surface 实际边界不清楚
- 以后想收口时会受历史用法牵制

### 最优方向

`core` 应逐步改成 curated exports：

- 明确哪些是 public domain API
- 明确哪些只是内部实现细节
- 子域导出不再等同于目录下全部文件

这件事优先级不如前面的宿主 API 问题高，但它是长期边界治理中迟早要做的一步。

---

## 3.8 `engine` 类型文件的 public / internal 责任还没有完全拆开

当前 `engine` 某些类型文件既承载 public contract，也混有更偏内部执行细节的类型。

这类结构问题未必立刻伤害宿主，但会带来两个长期副作用：

- public type 文件越来越重
- 读类型时边界感不清楚

### 最优方向

`engine` 类型层可以继续分成两类：

- public contract
- internal write planning / command mapping / transform options

重点不是为了多建目录，而是为了让“给宿主看的类型”和“给 engine 自己编排流程用的类型”不再混在一起。

---

## 4. 长期最优的 public API 形态

下面是我认为比较稳、且符合当前架构方向的长期最优形态。

## 4.1 `@whiteboard/react`

根导出建议收敛为：

```ts
export { Whiteboard } from '@whiteboard/react'

export { useWhiteboard, useSelection } from '@whiteboard/react'

export { createNodeRegistry, createDefaultNodeRegistry } from '@whiteboard/react'

export type {
  WhiteboardProps,
  WhiteboardOptions,
  WhiteboardInstance,
  NodeDefinition,
  NodeRegistry,
  NodeRenderProps
} from '@whiteboard/react'
```

其中：

- `useWhiteboard` 是宿主语义 hook
- `useSelection` 可以保留，因为它是明确的宿主消费语义
- 其他更偏内部组合的 hook，不必急着作为根导出承诺

## 4.2 `WhiteboardProps`

建议统一成：

```ts
type WhiteboardProps = {
  document: Document
  onDocumentChange: (document: Document) => void
  coreRegistries?: CoreRegistries
  nodeRegistry?: NodeRegistry
  options?: WhiteboardOptions
}
```

这样宿主读起来会非常顺：

- `document / onDocumentChange`
- `coreRegistries / nodeRegistry`
- `options`

## 4.3 `WhiteboardInstance`

建议统一成：

```ts
type WhiteboardInstance = {
  read: WhiteboardRead
  state: WhiteboardState
  commands: WhiteboardCommands
  viewport: WhiteboardViewport
}
```

不再直接暴露：

- `dispose`
- `configure`
- 其他只服务内部组装的字段

## 4.4 `@whiteboard/engine`

根导出更强调：

- `createEngine`
- `EngineInstance`
- `EngineCommands`
- `CommandResult`
- `Commit`

其中类型层建议继续收口成两条线：

- public runtime contract
- internal write planning contract

## 4.5 写返回值风格

统一规则：

- engine 侧所有 mutating command 返回 `CommandResult<T>`
- react 侧若只是薄转发，同步透传 `CommandResult<T>`
- `T` 只表达稳定领域产出
- UI policy 留在 `react`
- `Commit` 不承载 result 语义
- 尽量移除仅用于转发同步 command 的 `await`

---

## 5. 这轮优化不应优先做什么

为了避免再次陷入“结构越拆越多”，我认为下面这些动作不应排在最前面：

- 为了“看起来整齐”继续大规模拆目录
- 先改内部类型文件布局，再回头改 public naming
- 先处理所有 barrel export，再回头处理宿主入口
- 给旧 public API 做兼容层

如果目标是长期最优，而且明确没有兼容成本，顺序应该反过来：

- 先改 public surface
- 再让内部实现跟着 public 目标收口

---

## 6. 推荐落地顺序

如果要真正开始改，我建议按照下面顺序推进。

### 第一阶段：宿主入口收口

目标：

- 重命名 `Board*` 为 `Whiteboard*`
- `doc` 改 `document`
- `registries` 改 `coreRegistries`
- `config` 改 `options`
- `BoardInstance` 改成 `WhiteboardInstance`
- public instance 去掉 `configure / dispose`

这是最值得先做的一步，因为它直接决定宿主感知到的整个系统气质。

### 第二阶段：扩展入口闭环

目标：

- 根导出 `createNodeRegistry`
- 根导出 `createDefaultNodeRegistry`
- 评估并收回没有真实 public 价值的内部 registry context API

这一步完成后，宿主的自定义节点扩展路径会顺很多。

### 第三阶段：统一写结果手感

目标：

- `engine.commands.*` 去 `Promise` 化，保持纯同步
- `NodeRenderProps.update / updateData` 同步返回真实 `CommandResult`
- react feature / renderer 尽量去掉无意义的 `await`
- `Commit` 去掉 result 残影字段，统一 `document` 命名

这一步完成后，命令链路会从 engine 一直保持到 renderer 扩展层。

### 第四阶段：收口包导出面

目标：

- `core` subpath barrel 改 curated exports
- `engine` 类型文件继续拆 public / internal
- `react` 根导出只保留明确承诺的宿主能力

这一步更偏治理，但会让后续演进成本明显下降。

---

## 7. 最终判断

如果从“长期最优”而不是“最少改动”来看，当前 whiteboard 最该优化的不是再去局部抠 selection、container 或 toolbar，而是把 public API 的三个基本问题一次收干净：

- 名字统一
- 边界收口
- 扩展入口闭环

只要这三件事做好，后面很多“质感问题”会自然消失：

- 宿主怎么接入会变得清楚
- 自定义扩展怎么写会变得顺手
- 内部 runtime 和外部 API 的边界会更稳

因此下一阶段最推荐的动作不是“继续研究”，而是直接按上面的顺序落一轮 public API 收口。
