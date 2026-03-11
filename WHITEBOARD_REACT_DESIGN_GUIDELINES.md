# WHITEBOARD_REACT_DESIGN_GUIDELINES

## 1. 目的

这份文档用于约束 `packages/whiteboard-react` 的 React 侧设计，目标不是“抽象更多”，而是：

1. 让 feature 的代码一眼看懂。
2. 让交互状态机尽量局部化，减少无意义共享状态。
3. 避免空包装 hook、空壳组件、无消费者的全局状态。
4. 为后续优化 `edge connect`、`edge routing`、`node drag` 等交互提供统一准则。

本文直接参考本轮 `selection` 优化过程形成，不追求兼容旧设计。

---

## 2. 总原则

### 2.1 Feature 优先，不要抽象优先

React 侧优先按 feature 组织，而不是先按“状态层 / hook 层 / layer 层 / stack 层”机械拆开。

判断标准：

1. 如果某段逻辑只有一个 feature 使用，优先留在该 feature 内。
2. 如果抽象之后需要跨 2-3 个文件来回跳转才能看明白，通常就是抽过头了。
3. 如果一个函数只是 1-2 行转发，且没有稳定复用价值，应直接 inline。

### 2.2 共享状态必须有真实消费者

不要因为“以后可能会用”就把状态提升到 atom / instance / 全局 domain。

只有满足以下条件，才值得做共享状态：

1. 有两个及以上真实消费者。
2. 这些消费者属于不同组件/feature，局部 state 不好协调。
3. 状态本身是稳定语义，不是一次 pointer session 的临时中间值。

反例：

1. 只被一个 hook 写、没有稳定读取方的 `interaction.pointer.isDragging`。
2. 没有真实写入链路、只存在读取判断的 `interaction.focus.*`。
3. 只有一处写入、没人消费的 `interaction.hover.*`。

### 2.3 React 负责 UI 编排，runtime 负责领域能力

React 侧负责：

1. DOM 事件监听与解绑。
2. pointer session 生命周期。
3. 局部 UI 状态和临时预览状态。
4. 调用 `instance.read` / `instance.commands` 完成读取和提交。

runtime / engine 负责：

1. 纯规则计算。
2. 文档/节点/边的最终 mutation。
3. 宿主无关的领域逻辑。

不要让 React 层重新实现 engine 规则，也不要让 engine / instance 承载不必要的 UI session 状态机。

---

## 3. 从 selection 优化得出的边界

`selection` 最终收敛出的边界是推荐模板。

### 3.1 Feature 组件的职责

Feature 组件负责：

1. 容器级 DOM 事件绑定。
2. 外部 signal / reset 订阅。
3. feature 视图渲染。
4. 卸载时兜底清理。

参考：

1. `packages/whiteboard-react/src/selection/SelectionFeature.tsx`

这意味着：

1. `Whiteboard.tsx` 不应该知道 selection box 的 pointerdown 细节。
2. 顶层 canvas 不应该帮某个单一 feature 转发事件。
3. 单 feature 的监听应该尽量回收到 feature 组件内部。

### 3.2 Interaction hook 的职责

Interaction hook 负责：

1. 局部 session 状态机。
2. pointer move / up / cancel / blur / escape 的处理逻辑。
3. 局部渲染输入，如 `rect`、`draft`、`preview`。
4. 最终调 `instance.commands.*` 提交结果。

Interaction hook 不负责：

1. 组件挂载/卸载生命周期编排。
2. 外部 reset 订阅。
3. 纯转发型 DOM 绑定。

参考：

1. `packages/whiteboard-react/src/selection/useSelectionBoxInteraction.ts`

### 3.3 临时 UI 状态优先本地化

`selectionBox` 已证明：

1. 框选框 `rect` 用本地 `useState` 更清楚。
2. 整个框选 session 用 hook 内 `ref + state` 更清楚。
3. 没必要为了“统一”做成 atom -> hook -> layer 的长链路。

保留共享的，只应该是稳定语义：

1. 当前选中的 node ids / edge id。
2. 工具态。
3. 真正跨组件复用的 preview 状态。

---

## 4. 状态放置规则

### 4.1 放在本地 hook / 组件里的状态

优先本地化：

1. 当前 pointer session。
2. 当前拖拽/框选/连线的 draft。
3. 局部渲染框、临时高亮、临时几何值。
4. 只服务一个 feature 的预览态。

典型特征：

1. 生命周期短。
2. 与 pointer session 强绑定。
3. 只有一个 feature 需要。
4. 丢了可以重算。

### 4.2 放在 atom / domain 里的状态

只放真正共享语义：

1. selection。
2. tool。
3. 多个渲染组件共同消费、且不适合 props 透传的稳定 preview。

不允许把这些内容习惯性塞进 atom：

1. 原始 pointer 事件镜像。
2. 单 feature 临时中间态。
3. “为了 reset 方便”硬提升的局部状态。

### 4.3 reset 不等于共享状态

如果局部 state 只是因为“需要 reset”才被提升为 atom，这是错误信号。

正确做法优先级：

1. 先保留本地 state。
2. 再看是否需要一个窄的 signal。
3. 不要先上 atom，再用 atom 驱动 reset。

---

## 5. Signal 规则

### 5.1 可以用窄 signal，不要上万能事件总线

当某个 feature 需要响应 instance 级的同步清场，可以使用窄 signal。

要求：

1. 信号语义单一。
2. 只暴露必要订阅点。
3. 同步触发，不引入额外状态存储。

当前可接受形态：

1. `uiSignals.transientReset`

### 5.2 不要把 signal 当第二套状态系统

signal 只用来通知，不用来承载数据，不用来替代 domain。

不允许：

1. 做成万能 UI 事件中心。
2. 一个 feature 内部的小状态变更也广播出去。
3. 把 signal 和 atom 双写，形成两套事实来源。

---

## 6. Pointer Session 设计规则

### 6.1 一个 feature，一条可读的 session 主线

推荐结构：

1. `activeRef`
2. `activePointerId`
3. `useWindowPointerSession`
4. `cancelXxxSession`

目标是让代码读起来像：

1. `pointerdown` 建 session。
2. `pointermove` 更新 draft / preview。
3. `pointerup` 提交。
4. `cancel/blur/escape` 收尾。

### 6.2 session 数据尽量收成一个对象

如果一组数据只服务同一次交互，就应该放进同一个 session 对象里。

例如：

1. `lockToken`
2. `pointerId`
3. `start`
4. `draft`
5. `selectedKey`

不要拆成一堆并列 `ref`，除非生命周期明显不同。

### 6.3 基础设施只抽壳，不抽 feature 语义

可以复用的 common interaction 只应该包括：

1. `interactionLock`
2. `useWindowPointerSession`
3. 极轻的 session cleanup 壳

不要抽这些：

1. 命中策略。
2. preview 更新规则。
3. feature draft 结构。
4. commit / cancel 语义。

---

## 7. 坐标系规则

### 7.1 视觉和命中可以保留双坐标

像 `selection` 这种场景：

1. 渲染框走 `screen`
2. 命中节点走 `world`

这是合理的，不必强行统一成单坐标。

### 7.2 允许保留双坐标，但不要反复互转

正确方式：

1. `pointerdown` 固定 `start.screen` 和 `start.world`
2. `pointermove` 读取 `current.screen` 和 `current.world`
3. screen 只给视觉
4. world 只给命中

不推荐：

1. 只存一种坐标，再在后续 session 中反推另一种。
2. 在多个函数里来回 `screen -> world -> screen`。

### 7.3 结构收拢优先于删坐标

如果代码不清晰，先把：

1. `startScreen + startWorld`

收成：

1. `start: { screen, world }`

而不是盲目减少坐标系数量。

---

## 8. 文件与组件设计规则

### 8.1 组件层级要克制

以下类型的文件优先删掉或内联：

1. 只有一层 DOM 包装的 `LayerStack`
2. 只渲染一个 `<div>` / `<svg>` 的转发组件
3. 只做一层 prop 透传的壳组件

保留标准：

1. 组件本身有清晰视觉边界。
2. 组件内部有独立渲染语义。
3. 组件复用是稳定的，而不是“先拆着再说”。

### 8.2 Hook 也要克制

以下 hook 优先删掉或内联：

1. 只有一行 `atom -> value` 的转发 hook
2. 只包一层已有 hook 的别名 hook
3. 没有独立语义、只是为了“分文件”存在的 hook

保留标准：

1. hook 名称能准确表达一个语义责任。
2. hook 内部有完整且稳定的逻辑块。
3. hook 抽出来比内联更容易读，而不是更难追。

### 8.3 单文件变大一点没问题

优先保证“一眼能看懂完整流程”，不要为了维持小文件而拆出大量小函数和小文件。

允许：

1. 一个 feature 文件 100-200 行，但主线清晰。

不允许：

1. 文件很小，但真实逻辑散落 5 个文件。

---

## 9. 命名规则

### 9.1 优先语义名，不要包装名

推荐：

1. `SelectionFeature`
2. `useSelectionBoxInteraction`
3. `cancelSelectionSession`
4. `handleContainerPointerDown`

不推荐：

1. `SelectionLayerStack`
2. `useSelectionStateModel`
3. `useSelectionBoxRect`
4. `SelectionBridge`

### 9.2 名称要反映真实责任

如果函数真实责任是“取消这次 session”，就叫 `cancelSelectionSession`，不要叫：

1. `resetSelectionState`
2. `cleanupSelectionLayer`
3. `endInteractionLifecycle`

过泛名称会让代码更难读。

---

## 10. 反模式清单

以下都是应避免的设计：

1. 顶层 `Whiteboard` 帮单 feature 暴露事件处理器。
2. 一个 feature 的临时状态被提升成 atom，只因为“需要 reset”。
3. 用 atom 驱动一次性 reset 信号。
4. 无消费者的全局 `interaction` bag。
5. 一个 feature 拆成 `state -> hook -> layer -> stack -> feature` 五层转发。
6. 为了“统一交互”做万能 `useInteractionSession`，把 feature 语义藏进配置对象。
7. 为了“更短”把可读的交互主线拆成很多一行函数。
8. 在 render path 和 interaction path 中混用不稳定坐标语义。
9. 一个本地交互逻辑同时存在两套事实来源，例如 `local state + atom + signal`。

---

## 11. 新 feature / 重构时的决策顺序

每次设计一个 React feature，按下面顺序决策：

1. 先写出完整交互主线：down / move / up / cancel。
2. 判断哪些状态只服务这个 feature。
3. 只有在出现真实跨组件消费者时，才考虑提升状态。
4. 先做一个完整、直白的 feature 文件。
5. 只有当出现稳定复用时，才抽 common helper。
6. 抽 helper 时只抽基础设施壳，不抽 feature 语义。
7. 最后再压缩命名和组件层级，消掉包装层。

---

## 12. 用于 edge connect 的具体指导

后续优化 `edge connect` 时，直接套用以下规则。

### 12.1 目标边界

建议收敛为：

1. `EdgeConnectFeature` 或 edge 相关 feature 组件负责容器监听、外部 reset、必要渲染。
2. `useEdgeConnectInteraction` 负责整条连线 session 状态机。
3. connect draft 优先保持在 interaction hook 本地。
4. 只有真正跨多个 edge 视图消费的 preview，才考虑保留共享 preview state。

### 12.2 优先检查项

1. 是否有顶层组件帮 `edge connect` 转发单消费者事件。
2. 是否存在“只为把 draft 传出去”而存在的中间 hook。
3. preview 状态是否存在本地 state 和共享 state 双写。
4. `button / modifiers / pointer` 这类原始事件数据是否被不必要地提升。
5. 是否有可以合并到单一 session 对象的多个 `ref`。
6. 是否有一层 `LayerStack / MarkerDefs / PreviewLayer` 只是壳。

### 12.3 允许保留的复杂度

`edge connect` 可以保留这些复杂度，因为它们是业务复杂度，不是噪音：

1. 锚点命中。
2. snap target 解析。
3. reconnect / create 的分支。
4. preview 与最终 commit 的分离。

真正要砍的是：

1. 组件壳层。
2. 状态转发层。
3. 没人消费的全局交互状态。
4. 单次 session 中无意义的拆分函数。

---

## 13. 代码审查清单

每次审 React 交互代码，至少检查：

1. 这个状态是不是只有一个 feature 用？
2. 这个 hook / 组件是不是只是转发？
3. 这个抽象有没有两个以上真实消费者？
4. 这个全局状态有没有实际读写链路？
5. 这段 pointer session 能不能从上到下一次看懂？
6. 这段代码是否把 React 生命周期职责和交互状态机职责混在了一起？
7. 这段逻辑是否因为“统一”而变得更难读？

---

## 14. 一句话准则

React 侧架构的目标不是“更抽象”，而是“让每个 feature 的交互主线尽量局部、尽量直接、尽量一眼看懂”。
