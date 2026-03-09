# Core / Kernel / Engine 边界重整方案

更新日期：2026-03-06  
范围：`packages/whiteboard-core`、`packages/whiteboard-engine`

## 1. 结论

当前仓库中，`core` 这个词被同时用于两种不同语义：

1. 纯领域与算法基础层。
2. 带状态、带事件、带 history、带 transaction 的 headless runtime。

这会直接导致两个问题：

1. 命名误导：`@whiteboard/core` 看起来像纯 core，实际上内部混有 runtime。
2. 实现重复：`engine` 已经有自己的 runtime，但 `whiteboard-core/src/core` 里也有一套 runtime，于是 `history` 等 orchestration 能力出现双实现。

**最优方向不是让 `engine` 反过来建立在 `createCore()` 之上，而是反过来把 `core runtime` 从 `core` 中剥离掉。**

推荐最终形态：

1. `@whiteboard/core` 只保留纯基础能力：`types`、`kernel`、`geometry`、`node`、`edge`、`mindmap`、`schema`、`utils`。
2. `engine` 成为应用侧唯一正式 runtime。
3. 如果确实需要一个非 React 的 standalone runtime，则把当前 `whiteboard-core/src/core` 外迁并改名，例如 `@whiteboard/headless` 或 `@whiteboard/document-runtime`，但它不能继续叫 `core`。
4. `history` 不再有两套完整实现，而是提一套共享 collector，`engine` 和可选 headless runtime 各自做薄适配。

## 2. 当前真实结构

### 2.1 `@whiteboard/core` 不是纯算法包

从 package exports 看，`@whiteboard/core` 同时导出：

1. `./types`
2. `./kernel`
3. `./core`
4. `./geometry`
5. `./node`
6. `./edge`
7. `./mindmap`
8. `./schema`
9. `./utils`
10. `./perf`

这意味着它不是单一层，而是一个“领域基础大包”。

### 2.2 三个实际层级

当前 `packages/whiteboard-core/src` 里实际上有三层：

1. `types`
   - 领域对象与协议定义。
2. `kernel`
   - 看起来像纯文档内核，对外暴露 `reduceOperations`、`invertOperations`、`normalizeOperations`、`snapshotRegistries` 等。
3. `core`
   - 实际上是一套 headless runtime，提供 `createCore()`、`history`、`tx`、`events`、`changes`、`model`、`plugins` 等。

### 2.3 `engine` 不是建立在 `createCore()` 上的

`engine` 当前主链已经收敛为：

`commands -> write -> plan -> commit -> read -> reactions`

`engine` 的写链直接依赖的是：

1. `@whiteboard/core/kernel` 的 reduce / invert 能力。
2. `@whiteboard/core/types` 的领域对象。
3. `@whiteboard/core/utils` 的基础工具。

`engine` 并没有把 `createCore()` 当成自己的底座 runtime。

## 3. 当前问题的根因

## 3.1 `core runtime` 和 `engine runtime` 是并列关系，不是上下分层

当前不是：

```text
engine
  -> core runtime
    -> kernel
```

而更像：

```text
headless core runtime
  -> kernel / types

engine runtime
  -> kernel / types
```

所以一旦某个能力属于 runtime orchestration，而不是纯 kernel，就容易出现双实现。

## 3.2 `kernel` 实现本身还反向依赖 `core runtime`

这是目前最别扭、也最需要修正的一点。

当前 `kernel.reduceOperations(...)` 内部并不是纯执行器，而是通过 `createCore()` 跑出来的：

1. `kernel/internal.ts` 里 `createKernelCore()` 直接调用 `createCore()`。
2. `kernel/internal.ts` 里 `getReusableKernelCore()` 也直接创建和复用 `createCore()`。
3. `kernel/reduce.ts` 里 `reduceOperations()` 调 `core.apply.operations(...)`。

也就是说：

**当前对外看起来是“kernel”，实现上却借用了 `core runtime`。**

这会导致：

1. `kernel` 不再是真正自治的内核。
2. `core runtime` 无法自然删除，因为 `kernel` 还依赖它。
3. `core` 与 `kernel` 的边界方向是反的。

## 3.3 `history` 双实现只是表面现象，根因是双 runtime

现在有两套 history：

1. `packages/whiteboard-core/src/core/history.ts`
2. `packages/whiteboard-engine/src/runtime/write/stages/commit/history.ts`

它们重复的不是业务语义，而是 runtime orchestration。

原因很直接：

1. `core runtime` 需要自己的 undo/redo。
2. `engine runtime` 也需要自己的 undo/redo。
3. 两边都没有共用同一个 runtime substrate。

所以真正的问题不是“history 为什么有两套”，而是：

**为什么仓库里同时保留了两套 runtime，而且都挂在主路径上。**

## 4. 边界原则

后续重整建议遵守以下原则。

### 4.1 `core` 只能表示纯基础，不表示 runtime

`core` 这个名字只能用于：

1. 领域模型。
2. 纯算法。
3. 无副作用的工具。
4. 稳定协议和共享 primitive。

不能再表示：

1. event bus
2. transaction host
3. history host
4. plugin host
5. runtime facade

### 4.2 `kernel` 必须实现自治

`kernel` 必须能独立完成：

1. operation normalize
2. operation apply / reduce
3. inverse build
4. registry snapshot consume
5. 文档执行期索引或工作态维护

不能再反向依赖 `createCore()` 这种上层 runtime facade。

### 4.3 应用侧 runtime 只能有一个 canonical 主路径

对当前白板产品来说，canonical runtime 应该是 `engine`，不是 `createCore()`。

原因：

1. `engine` 已经拥有更清晰的 `write/read/reactions` 边界。
2. `engine` 已经是当前产品主链。
3. 让 `engine` 退回去依附旧 `createCore()`，会重新引入多层 event / change / history adapter，不符合漏斗原则。

### 4.4 如果保留 headless runtime，就必须改名并外迁

如果未来确实还需要：

1. 非 React 宿主。
2. CLI / 脚本环境。
3. 测试中的 standalone 文档运行时。

那么应该把现在的 `whiteboard-core/src/core` 外迁成单独语义，例如：

1. `@whiteboard/headless`
2. `@whiteboard/document-runtime`

但不能继续作为 `@whiteboard/core/core` 暴露。

## 5. 推荐的目标架构

推荐最终分成三层。

### 5.1 `@whiteboard/core`

只保留纯共享基础：

1. `types`
2. `kernel`
3. `geometry`
4. `node`
5. `edge`
6. `mindmap`
7. `schema`
8. `utils`
9. `perf`

其中：

- `kernel` 负责 deterministic document execution。
- `kernel` 可以内部维护“执行期工作态”，但这个工作态属于 kernel executor，不属于 runtime facade。

### 5.2 `@whiteboard/engine`

保留应用主 runtime：

1. `commands`
2. `write`
3. `read`
4. `reactions`
5. `state`
6. `viewport`
7. `instance`

这是产品正式 runtime，也是唯一 canonical runtime。

### 5.3 可选：`@whiteboard/headless`

仅当存在真实需求时保留。

职责：

1. 为非 UI 环境提供轻量 runtime facade。
2. 基于 `@whiteboard/core/kernel` 和共享 primitives 组装事务、history、事件、插件等能力。
3. 它是可选宿主层，不是产品主链。

## 6. 如何优化掉“不纯的 core runtime”

这件事不能直接“删目录”，因为当前 `kernel` 还依赖 `createCore()`。

最优做法是分两步。

### 6.1 先把 `kernel` 从 `createCore()` 脱开

这是第一优先级，也是整个重构能不能成功的前提。

当前应把以下能力从 `whiteboard-core/src/core` 下沉到 `whiteboard-core/src/kernel`：

1. 文档执行态和 maps 维护。
2. operation apply 执行器。
3. 供 reduce 使用的最小 query 读取。
4. 内部 document load / reset 机制。

更具体地说，当前这些文件里的“执行器能力”应迁入 `kernel`：

1. `packages/whiteboard-core/src/core/apply.ts`
2. `packages/whiteboard-core/src/core/state.ts`
3. `packages/whiteboard-core/src/core/query.ts` 中 reduce 需要的最小部分

目标是形成一个新的 `kernel executor`，例如：

1. `packages/whiteboard-core/src/kernel/executor/state.ts`
2. `packages/whiteboard-core/src/kernel/executor/apply.ts`
3. `packages/whiteboard-core/src/kernel/executor/query.ts`
4. `packages/whiteboard-core/src/kernel/executor/index.ts`

然后：

1. `kernel/reduce.ts` 直接调用 `kernel executor`。
2. `kernel/internal.ts` 不再 `createCore()`。
3. `createCore()` 如果还存在，反而应基于 `kernel executor` 组装，而不是 `kernel` 基于它。

这样边界方向才会正确：

```text
types / kernel primitives
  -> kernel executor
    -> optional headless runtime adapter
    -> engine runtime
```

而不是现在这种反向依赖。

### 6.2 再决定 `createCore()` 的去留

等 `kernel` 脱开后，再做第二个判断。

#### 路线 A：直接删除 `createCore()`

适用条件：

1. 仓库内没有真实产品路径依赖它。
2. 只有 `kernel` 内部在借用它。
3. 没有对外 API 兼容压力。

当前静态代码看，仓库内真正使用 `createCore()` 的主路径主要在 `kernel/internal.ts`，没有看到应用层直接依赖它。

如果确认没有外部消费者，这是最干净的路线：

1. 删除 `packages/whiteboard-core/src/core/*`
2. 删除 `@whiteboard/core` 的 `./core` export
3. 让 `@whiteboard/core` 回到真正纯基础包

#### 路线 B：外迁并改名

适用条件：

1. 未来仍想保留 standalone runtime。
2. 需要脚本环境、服务端、测试 harness、插件宿主等无 UI runtime。

此时不要继续叫 `core`，而应该：

1. 新建 `packages/whiteboard-headless`
2. 把当前 `src/core/*` 中真正属于 runtime facade 的部分迁过去
3. 新包只依赖 `@whiteboard/core/kernel` 与共享 primitives
4. 从 `@whiteboard/core/package.json` 删除 `./core` export

从清晰度看，我更推荐这条路线的命名是 `@whiteboard/headless`，因为它能明确表达“这不是纯 core，而是一个无 UI 的 runtime”。

## 7. 如何优化掉“两套实现”

## 7.1 不建议围绕 `createCore()` 统一

不建议改成：

```text
engine -> createCore() -> kernel
```

原因：

1. `engine` 当前已经有更清晰的 `write/read/reactions` 主链。
2. `createCore()` 带有 `changes/events/history/tx/model/plugins` 混合语义。
3. 如果让 `engine` 建立在它上面，会重新增加 event 和 adapter 层。
4. 这与当前已经拉直的 write funnel 方向相反。

所以统一方向应该是：

**删薄或外迁 `createCore()`，不是让 `engine` 回退去依赖它。**

## 7.2 `history` 的最优收敛方式

当前：

1. `engine history` 是手动 capture 型。
2. `core history` 是 `changes.after` 自动 capture 型，并带 transaction 聚合。

最优做法不是互相调用，而是：

1. 在 `@whiteboard/core/kernel` 提供共享 `history collector` primitive。
2. collector 只负责：
   - undo / redo 栈
   - configure / clear / get / subscribe
   - capture
   - begin / end / discard transaction（可选）
3. `engine` 作为手动 capture adapter 使用它。
4. 可选 headless runtime 作为自动 capture adapter 使用它。

这样：

1. `engine` 不需要保留完整 history 实现。
2. `core runtime` 也不需要保留完整 history 实现。
3. 共享行为只有一套，适配层非常薄。

## 7.3 其他重复点的处理原则

除了 history，后续凡是发现以下能力双实现，都按同一原则处理：

1. 如果是纯执行能力，下沉到 `kernel`。
2. 如果是 runtime orchestration，不放回 `core`，而是只保留在 `engine` 或外迁到 `headless`。
3. 不再允许 `kernel` 借用 runtime facade。

## 8. 推荐实施顺序

### Phase 1：先纠正边界方向

目标：让 `kernel` 不再依赖 `createCore()`。

工作：

1. 抽 `kernel executor`。
2. `reduceOperations` 改为直接用 executor。
3. `kernel/internal.ts` 删除对 `createCore()` 的依赖。

这是最高优先级，因为它解决的是根结构问题。

### Phase 2：提共享 history collector

目标：把重复 orchestration 原语收敛掉。

工作：

1. 在 `kernel` 新增共享 `createHistory`。
2. `engine` 改用共享 collector。
3. `core/history.ts` 改成薄 adapter，或等外迁时一起改。

### Phase 3：处理 `createCore()`

根据真实需求二选一：

1. 没有消费者：直接删除 `src/core/*` 与 `./core` export。
2. 有消费者：外迁为 `@whiteboard/headless`，并从 `@whiteboard/core` 移除 `./core` export。

### Phase 4：补 architecture guard

用规则防止以后再长回去：

1. `engine` 禁止 import `@whiteboard/core/core`。
2. `kernel` 禁止 import `../core/*`。
3. `@whiteboard/core` 不再暴露 runtime subpath。
4. `headless` 只能依赖 `core`，不能反向被 `core` 依赖。

## 9. 最终边界定义

重构完成后，建议把三层职责定义成下面这样。

### `@whiteboard/core`

定义：白板领域基础与纯执行内核。

包含：

1. types
2. kernel
3. pure helpers

不包含：

1. runtime facade
2. history host
3. tx host
4. event bus
5. plugin host

### `@whiteboard/engine`

定义：白板应用 runtime。

包含：

1. commands
2. write
3. read
4. reactions
5. application orchestration

### `@whiteboard/headless`（可选）

定义：无 UI 的通用宿主 runtime。

包含：

1. 面向脚本或服务端的 runtime facade
2. 基于 kernel 的 history / tx / events adapter

不包含：

1. React 集成
2. engine 的 read projection / reaction 体系

## 10. 最终建议

从全局最优出发，我的建议很明确：

1. **不要把 `engine` 建在 `createCore()` 之上。**
2. **先把 `kernel` 从 `createCore()` 脱开。**
3. **再把 `core runtime` 从 `@whiteboard/core` 里删除或外迁。**
4. **`engine` 保留为唯一 canonical runtime。**
5. **history 用共享 collector 收敛，而不是继续保留两套完整实现。**

如果只做一件最关键的事，那就是：

**先把 `reduceOperations()` 从 `createCore()` 依赖里解放出来。**

这是后续所有边界澄清、runtime 收敛、history 去重的前提。
