# Engine Document I/O 行为矩阵

## 目的

本文定义 `packages/whiteboard-engine` 关于 document 输入、document 输出、history、宿主同步的目标行为矩阵。

这里描述的是目标 contract，不是当前临时实现细节。

## 核心结论

### 1. 单向职责

- `commands.document.replace(doc)` 是外部输入通道
- `onDocumentChange(doc)` 是 engine 内部提交后的输出通道

两者必须单向分离，不能再通过 `notifyChange` 这类开关混在一个 API 里。

### 2. `commands.document.replace(doc)` 的目标语义

- 纯 `replace`
- 不做 normalize
- 不触发 `onDocumentChange`
- 清空 history
- 触发 read 全量 reset
- 要求传入不可变 document
- 传入相同引用时直接报错

### 3. `onDocumentChange(doc)` 的目标语义

- 只在 engine 内部写入成功后触发
- 只传 `doc`
- 不传 source
- 不传 trace
- 不传 impact
- 不传 options

### 4. 语义收敛

以下语义全部收敛到 `commands.document.replace(doc)`：

- load
- replace
- import
- reset to external snapshot

engine 不再提供多套 document 替换语义。

## 不变量

### Document 输入不变量

- engine 只接受不可变 document 输入
- 调用方不得原地修改已提交给 engine 的 document
- `commands.document.replace(doc)` 必须传入新的 document 引用

### Write 输出不变量

- `node / edge / viewport / mindmap / undo / redo` 成功提交后，都会得到新的 committed document
- 新的 committed document 由 engine 通过 `onDocumentChange(doc)` 向外发送

### 宿主边界不变量

- engine 不负责宿主层的状态镜像策略
- engine 不负责 controlled loop 去重策略
- engine 不负责 UI transient state reset
- 上述策略由 React wrapper 或 bench harness 自己处理

## Engine 行为矩阵

| 动作 | 输入来源 | 是否修改 engine document | read 行为 | history 行为 | normalize | 是否触发 `onDocumentChange(doc)` | 说明 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `engine({ document })` 初始化 | 外部初始 document | 是，作为初始 committed document | 初始化 read model / projection / index | 初始空 history | 否 | 否 | 初始化不是一次“向外提交” |
| `commands.document.replace(doc)` | 外部 document 输入 | 是，整份 replace | 全量 reset | 清空 history | 否 | 否 | 这是输入通道，不是输出通道 |
| `commands.node.*` | engine 内部写命令 | 是 | 按 impact 增量失效 | 成功时 capture inverse | 是，作为 write pipeline 一部分 | 是 | 成功 commit 后向外同步 committed doc |
| `commands.edge.*` | engine 内部写命令 | 是 | 按 impact 增量失效 | 成功时 capture inverse | 是，作为 write pipeline 一部分 | 是 | 同上 |
| `commands.viewport.*` | engine 内部写命令 | 是 | 按 impact 增量失效 | 成功时 capture inverse | 是，若 pipeline 需要 | 是 | viewport 写入也是 committed document 的一部分 |
| `commands.mindmap.*` | engine 内部写命令 | 是 | 按 impact 增量失效 | 成功时 capture inverse | 是，作为 write pipeline 一部分 | 是 | 同上 |
| `commands.history.undo()` | history 重放 | 是 | 按 impact 增量失效 | 消耗 undo 栈，进入 redo 栈 | 是，重放后仍走同一 write pipeline | 是 | 本质上仍然是 engine 内部提交 |
| `commands.history.redo()` | history 重放 | 是 | 按 impact 增量失效 | 消耗 redo 栈，进入 undo 栈 | 是，重放后仍走同一 write pipeline | 是 | 同上 |
| `commands.history.clear()` | 宿主或业务调用 | 否 | 无 | 清空 history | 否 | 否 | 纯 runtime 操作，不是 document 变更 |
| `configure({ history })` | runtime 配置 | 否 | 无 | 仅更新 history 策略 | 否 | 否 | 不是 document 变更 |
| `configure({ mindmapLayout })` | runtime 配置 | 否 | 触发 mindmap read 重新投影 | 无 | 否 | 否 | 这是 read/runtime concern，不写 document |
| `dispose()` | 生命周期结束 | 否 | 停止 runtime 行为 | 无 | 否 | 否 | 不应产生对外 document 输出 |

## 失败路径矩阵

| 场景 | 返回结果 | 是否修改 document | 是否影响 history | 是否触发 `onDocumentChange(doc)` | 说明 |
| --- | --- | --- | --- | --- | --- |
| `commands.document.replace(doc)` 传入同一引用 | 抛错 | 否 | 否 | 否 | 明确拒绝可变输入模型 |
| `commands.document.replace(doc)` 传入非法 document | 抛错 | 否 | 否 | 否 | 由 document assert 保证输入合法 |
| 任意 write command 规划失败 | `DispatchFailure` | 否 | 否 | 否 | 不产生 commit |
| 任意 write command reduce 失败 | `DispatchFailure` | 否 | 否 | 否 | 不产生 commit |
| `history.undo()` 无可撤销项 | `false` | 否 | 否 | 否 | 不是错误，只是无动作 |
| `history.redo()` 无可重做项 | `false` | 否 | 否 | 否 | 同上 |

## 宿主模式矩阵

### A. engine 直接宿主

适用场景：

- 非 React 宿主
- headless runtime
- benchmark harness

行为约束：

- 宿主自己持有当前 document 引用
- 初始化时把 document 传给 `engine({ document })`
- engine 内部提交后，通过 `onDocumentChange(doc)` 更新宿主自己的 document 引用
- 宿主主动执行 `commands.document.replace(doc)` 时，必须自己同步自己的 document 引用，不能依赖 `onDocumentChange`

### B. React controlled 模式

适用场景：

- `Whiteboard` 由外部 `doc` prop 驱动
- 外部通过 `onDocChange` 接收 engine 产出的 committed document

行为矩阵：

| 触发点 | 责任方 | 动作 | 是否期望 `onDocumentChange(doc)` | 说明 |
| --- | --- | --- | --- | --- |
| 外部 `doc` prop 改变 | React host | 调用 `instance.commands.document.replace(doc)` | 否 | 这是把外部 source of truth 注入 engine |
| engine 内部命令成功提交 | engine | 调用 `onDocumentChange(doc)` | 是 | React host 用它把 committed doc 回流给外部 |
| 外部收到回流并再次渲染同一 committed doc | React host | 通过镜像去重避免再次回灌 | 否 | 这是 controlled loop 的宿主职责，不是 engine 职责 |

结论：

- React controlled 模式不需要 `notifyChange`
- React controlled 模式的回环控制应留在 React wrapper

### C. bench / harness 模式

适用场景：

- 性能基准
- 内核验证
- 本地驱动脚本

行为矩阵：

| 场景 | 推荐做法 | 不推荐做法 |
| --- | --- | --- |
| 需要给 kernel 读 raw document | 由 harness 自己维护本地 `doc` 变量 | 重新把 raw document 挂回 `instance.read` |
| harness 主动 reset 文档 | 先更新本地 `doc`，再调用 `commands.document.replace(doc)` | 依赖 `onDocumentChange` 回流本次 replace |
| engine 内部命令产生新 doc | 用 `onDocumentChange(doc)` 更新本地 `doc` | 从 engine 里偷读未公开 document 入口 |

## UI transient state 归属

以下状态不属于 engine document，也不应由 engine 的 `document.set` 负责：

- selection
- hover
- interaction session
- preview state
- viewport gesture preview
- session lock

这些都属于宿主 UI 层或 React wrapper。

因此：

- engine 的 `commands.document.replace(doc)` 只负责 replace engine document
- React wrapper 可以在 `document.replace(doc)` 成功后自行 reset UI transient state

## Normalize 边界

### `commands.document.replace(doc)`

- 不做 normalize
- 不偷偷改写外部传入 doc
- 不返回“被 engine 修正过的另一份 doc”

### 内部 write pipeline

以下路径允许 normalize：

- `commands.node.*`
- `commands.edge.*`
- `commands.viewport.*`
- `commands.mindmap.*`
- `history.undo()`
- `history.redo()`

原因：

- 这些都是 engine 内部 mutation pipeline
- normalize 是提交流程的一部分，不是外部输入协议的一部分

## 最终 API 约束

### 保留

- `engine({ document, config, registries, onDocumentChange })`
- `commands.document.replace(doc)`
- `onDocumentChange(doc)`

### 删除

- `commands.document.replace(doc)`
- `notifyChange`
- 任何“replace 但可选回调”的 public 语义

## 验收标准

满足以下条件，说明 contract 已经稳定：

- `document.replace` 是纯 replace
- `document.replace` 不做 normalize
- `document.replace` 不触发 `onDocumentChange`
- 内部 write commit 与 history undo/redo 会触发 `onDocumentChange`
- public API 中不存在 `notifyChange`
- 宿主同步策略全部留在 engine 外层
