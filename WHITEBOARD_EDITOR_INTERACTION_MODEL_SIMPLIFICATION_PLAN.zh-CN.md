# WHITEBOARD_EDITOR_INTERACTION_MODEL_SIMPLIFICATION_PLAN.zh-CN

## 目标

这份文档只回答一件事：

- `whiteboard-editor` 当前 interaction / session / feature runtime 模型为什么仍然显得复杂
- 复杂度的真正来源在哪里
- 如果完全不在乎重构成本，长期最优应该删掉什么、保留什么、收敛成什么

本文以长期最优为准。
不考虑兼容，不保留过渡层，不为现有抽象兜底。

---

## 核心结论

当前 `whiteboard-editor` 的复杂度，主要不是来自：

- 文件数量
- helper 数量
- 命名不够好

而是来自一套 **过度通用的 interaction 协议**。

现在 editor interaction 基础模型是：

- `InteractionRegistration<State, Start>`
- `can / prepare / start / move / up / cancel / cleanup`
- `RuntimeSession.finish / cancel / pan / replace`
- coordinator 负责维护统一 active session
- feature 之间通过 `session.replace(...)` 进行 baton handoff

这套模型的初衷是“统一所有手势”。
但在实践里，它把 feature 代码变成了：

- 一半在写产品逻辑
- 一半在写框架适配逻辑

所以你现在看到的：

- `packages/whiteboard-editor/src/interactions/selectionRuntime.ts`
- `packages/whiteboard-editor/src/interactions/mindmapRuntime.ts`
- `packages/whiteboard-editor/src/interactions/marqueeRuntime.ts`

虽然已经拆文件了，但仍然会让人觉得复杂。

原因不是它们拆得不够，而是它们仍然在适配同一套复杂协议。

一句话结论：

- **真正该砍的是 interaction 协议本身，而不是继续把 feature 拆成更多 runtime/helper 文件**

---

## 现状诊断

## 1. `session.replace` 是复杂度最大的放大器

相关文件：

- `packages/whiteboard-editor/src/types/runtime/interaction.ts`
- `packages/whiteboard-editor/src/runtime/interaction/coordinator.ts`
- `packages/whiteboard-editor/src/interactions/selectionRuntime.ts`

现在最典型的复杂链路是 selection：

- `selection.press`
- 触发后根据移动/hold 决定
- 再 `replace` 成 `selection.marquee`
- 或 `replace` 成 `node.drag`

这意味着一个用户手势被拆成多个 interaction session：

- 第一个 session 负责 press 判定
- 第二个 session 负责 marquee 拖拽
- 第三个 session 负责 node drag

这样做的问题不是“代码多写一点”，而是模型被切碎了。

feature 作者必须同时理解：

- 当前 interaction 的 `State`
- 下一个 interaction 的 `Start`
- `session.replace` 什么时候安全
- `cleanup` 和下一个 interaction 的 `start` 之间的时序
- autopan 在 handoff 前后怎么续上

这会直接产生一类纯框架噪音代码：

- `replaceWithMarquee(...)`
- `replaceWithMove(...)`
- `buildMarqueeInput(...)`
- `createState(...)`
- `prepare(...)`

这些都不是产品行为本身，而是“为了让协议工作起来”不得不写的胶水。

长期最优必须删除这类 handoff 模型。

---

## 2. interaction 被切得过细，owner 不明确

当前 interaction 粒度大致是：

- `selection.press`
- `selection.marquee`
- `node.drag`
- `node.transform`
- `mindmap.drag`
- `edge.connect`
- `edge.edit`
- `draw.stroke`
- `draw.erase`
- `viewport.pan`

表面上这是模块化。
实际上这里混了两种完全不同的东西：

- 真正应该作为“顶层交互 owner”的 feature
- 某个顶层 feature 内部的 phase 或 helper

例如：

- `selection.press`
- `selection.marquee`
- `node.drag`
- `mindmap.drag`

从产品视角看，它们并不是四个独立 feature。
它们都是 **select tool 下的不同阶段/分支**。

如果底层把它们建模成平级 interaction，再让它们彼此 handoff，复杂度一定会上升。

长期最优应该只有少量真正的 interaction owner：

- `viewport`
- `draw`
- `select`
- `edge`
- `insert`

其余都不应该继续占一个顶层 interaction 席位。

---

## 3. `InteractionRegistration<State, Start>` 泛型协议太重

相关文件：

- `packages/whiteboard-editor/src/types/runtime/interaction.ts`

当前协议的问题不在于泛型本身，而在于：

- 它把所有 feature 都拉到同一个“框架作者视角”下
- 每个 feature 都要显式处理 `State` / `Start` / `prepare` / `cleanup`
- 甚至 feature 需要知道 `setState` 和 `session.replace`

这会导致代码不是围绕“用户手势”来写，而是围绕“注册协议”来写。

例如一个最自然的想法应该是：

- pointer down 后决定是否进入某个手势
- 如果进入，后续 move/up/cancel 都由这个手势对象自己处理

但当前模型会要求你把这个自然过程拆成：

- `can`
- `prepare`
- `start`
- `move`
- `up`
- `cleanup`

这不是在简化 feature，而是在 forcing feature 适配框架。

---

## 4. `FeatureRuntime` 不是主因，但也是噪音源

相关文件：

- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`

当前 `FeatureRuntime` 形态大致是：

- `query.read`
- `query.config`
- `query.interaction`
- `command`
- `viewport`
- `output`

这套对象的问题不是“层级深一层”。
真正的问题是它暴露的是 **装配后的杂糅能力包**，而不是稳定的交互 host 边界。

现在 interaction 层需要同时面对：

- 文档读能力
- 配置读能力
- 选择态读能力
- interaction 状态读能力
- output preview 写能力
- command commit 写能力
- viewport 输入变换能力

它本质上仍然是“大上下文对象”。

而且更明显的边界问题是：

- `FeatureRuntime` 类型现在直接定义在 `runtime/editor/createEditor.ts`
- interaction runtime 反向 import editor 装配文件中的类型

这说明底层所有权没有理顺。

长期最优不应该保留这种从装配文件往下倒灌类型的结构。

---

## 5. runtime/helper 拆分改善了可读性，但没有减少协议复杂度

最近我们已经把：

- `draw`
- `selection`
- `mindmap`
- `marquee`
- `node.transform`

拆成了“薄装配 + runtime/helper”结构。

这一步有价值。
它改善了局部文件的可读性。

但它没有从根上减少复杂度，原因是：

- 每个 runtime 仍然在适配同一套 interaction 协议
- handoff 模型仍然存在
- active session 的真正 owner 仍然不明确
- feature 仍然必须理解 coordinator 的抽象

也就是说：

- **拆文件只能降阅读噪音，不能删除系统复杂度**

---

## 真正的复杂度来源

长期判断如下：

### 第一复杂度来源

- `session.replace`

### 第二复杂度来源

- 把同一手势链路拆成多个平级 interaction

### 第三复杂度来源

- `InteractionRegistration<State, Start>` 协议过重

### 第四复杂度来源

- feature 必须同时适配 read / output / command / session / autopan 多种职责

### 第五复杂度来源

- `FeatureRuntime` 作为“大上下文包”存在，但又不是稳定的 host contract

---

## 长期最优模型

## 1. interaction 协议改成最小模型

长期最优不应该继续保留：

- `prepare`
- `setState`
- `cleanup`
- `session.replace`

最小模型应该是：

```ts
type InteractionFeature = {
  key: string
  priority?: number
  start: (input: PointerDown, host: InteractionHost) => ActiveGesture | null
}

type ActiveGesture = {
  mode: InteractionMode
  chrome?: boolean
  move: (input: InteractionPointerInput) => void
  up: (input: InteractionPointerInput) => void
  cancel: () => void
  keydown?: (input: InteractionKeyboardInput) => void
  keyup?: (input: InteractionKeyboardInput) => void
  blur?: () => void
}
```

这里的核心变化是：

- `start` 直接返回 active gesture
- active gesture 自己闭包保存状态
- coordinator 不再管理 feature state 泛型
- coordinator 只负责“当前有没有 active gesture”

这样 coordinator 会从一个复杂的 session 框架，退化成简单的 active owner runtime。

---

## 2. 删除 `session.replace`

这是必须删除的，不是可选优化。

删除后意味着：

- 一个 pointer 手势只会启动一个 active gesture
- 后续 move/up/cancel 都由这个 active gesture 自己处理
- 不再在 feature 间做 baton handoff

这会直接让 selection 这种链路的复杂度下降一个量级。

因为 selection 不再需要：

- `replaceWithMarquee`
- `replaceWithMove`
- 把一个 feature 的 state 转换成另一个 feature 的 start input

同一个 gesture 内部如果要换阶段，只改自己的 phase 即可。

---

## 3. 只保留少量顶层 interaction owner

长期最优只保留：

- `viewport`
- `draw`
- `select`
- `edge`
- `insert`

不要继续保留这些平级 interaction：

- `selection.press`
- `selection.marquee`
- `node.drag`
- `mindmap.drag`
- `node.transform`

这些都应该变成：

- 某个顶层 interaction owner 的内部 phase
- 或者纯 helper
- 或者 core 纯算法

### `select` 应拥有的 phase

- `press`
- `marquee`
- `moveNodes`
- `moveMindmap`
- `transformNodes`

如果以后还有 container hover / frame hover / selection toolbar anchor 之类，也应该优先作为 `select` 的派生逻辑，而不是再长出新的平级 interaction。

### `draw` 应拥有的 phase

- `stroke`
- `erase`

### `edge` 应拥有的 phase

- `connect`
- `editRoute`
- `dragBody`
- `hover`

这样 interaction owner 才对应真实产品语义，而不是当前实现细节。

---

## 4. `marquee / node drag / mindmap drag / transform` 应降级为 helper 或 pure model

这些能力不应该继续作为顶层 interaction。

它们应该分成两类：

### A. editor 内部 helper

负责：

- 读取 editor host
- 写 preview/output
- 最终 commit command

例如：

- `projectNodeMove(...)`
- `commitNodeMove(...)`
- `projectSelectionMarquee(...)`
- `commitMindmapMove(...)`

### B. whiteboard-core 纯算法

负责：

- 输入纯数据
- 输出纯数据
- 不读 editor runtime
- 不写 preview/output

例如最适合继续下沉到 core 的，是：

- marquee 命中、匹配、变更判断
- selection press plan 解析
- node transform 预览 patch 计算
- mindmap drag 投影和 drop 解析

一句话：

- **core 只做算法**
- **editor 只做 host 适配和 commit**
- **interaction owner 只做手势推进**

---

## 5. coordinator 退化成简单 active owner runtime

相关文件：

- `packages/whiteboard-editor/src/runtime/interaction/coordinator.ts`

长期最优下，coordinator 只需要负责：

- 当前是否有 active gesture
- 当前 mode
- 当前 chrome
- pointer move/up/cancel 分发
- keyboard/blur 分发
- autopan 生命周期

它不应该继续负责：

- 泛型 `State / Start`
- `prepare`
- `session.replace`
- `setState`
- interaction cleanup context

当前 `coordinator` 的大部分复杂代码，都是为了维护那套通用 session 协议。
协议一旦删掉，`coordinator.ts` 会自然缩很多。

---

## 6. `FeatureRuntime` 改成真正稳定的 interaction host

当前问题不是名字叫不叫 `FeatureRuntime`。
问题是它现在还是一个“大上下文对象”，而且类型挂在 `createEditor.ts`。

长期最优应该改成独立的 host contract，例如：

```ts
type InteractionHost = {
  read: {
    document: ...
    selection: ...
    tool: ...
    interaction: ...
  }
  write: {
    preview: ...
    commit: ...
  }
  viewport: ...
}
```

关键不是字段名，而是原则：

- host 类型必须独立定义
- 不能定义在装配文件里
- 只暴露 interaction 真正需要的域
- 不再混杂 editor 装配语义

最重要的是：

- interaction host 是 interaction 层的稳定依赖
- 不是 editor 装配层顺手拼出来的临时对象

---

## 对当前几个复杂文件的最终结论

## 1. `mindmapRuntime.ts` 复杂度不高，但层次仍然不对

文件：

- `packages/whiteboard-editor/src/interactions/mindmapRuntime.ts`

它当前的复杂度主要来自协议噪音，而不是业务。

真实业务其实只有三件事：

- begin
- project
- commit

如果 interaction 协议改成最小模型，这个文件可以进一步缩成：

- `beginMindmapMove`
- `projectMindmapMove`
- `commitMindmapMove`

甚至如果 `select` 成为唯一 owner，它连独立 runtime 文件都不一定需要。

它完全可以只是 `select` 内部调用的一组 helper。

结论：

- `mindmapRuntime.ts` 不是主要病灶
- 但它也不应该继续作为一个独立顶层 interaction runtime 被保留

---

## 2. `selectionRuntime.ts` 的复杂度有一半是假复杂度

文件：

- `packages/whiteboard-editor/src/interactions/selectionRuntime.ts`

它的真实产品复杂度确实高于 mindmap，因为 selection 先天包含：

- press
- tap
- hold
- marquee
- move
- edit start

但它当前有大量复杂度不是业务本身，而是 handoff 逻辑：

- `replaceWithMarquee`
- `replaceWithMove`
- `buildMarqueeInput`
- 针对下一个 interaction 构造 `NodeDragStart`

这些都属于“框架适配复杂度”。

如果变成单 owner `select` 模型，这些代码绝大部分都可以删除。

`selectionRuntime.ts` 最终应该变成：

- 一个 `createSelectGesture(...)`
- 内部维护 `phase`
- `move` 时按 `phase` 推进
- `up` 时按 `phase` commit

而不是：

- 一个 `selection.press`
- 再 handoff 到别的 interaction

结论：

- `selectionRuntime.ts` 当前复杂度里，至少有一大块是可被协议删除的

---

## 最终推荐的目录与所有权

长期最优下，不建议继续把 interaction 实现切成大量平级文件。

推荐所有权如下：

### editor interaction owner

- `packages/whiteboard-editor/src/interactions/viewport.ts`
- `packages/whiteboard-editor/src/interactions/draw.ts`
- `packages/whiteboard-editor/src/interactions/select.ts`
- `packages/whiteboard-editor/src/interactions/edge.ts`
- `packages/whiteboard-editor/src/interactions/insert.ts`

### editor interaction helper

- `packages/whiteboard-editor/src/interactions/helpers/marquee.ts`
- `packages/whiteboard-editor/src/interactions/helpers/nodeMove.ts`
- `packages/whiteboard-editor/src/interactions/helpers/nodeTransform.ts`
- `packages/whiteboard-editor/src/interactions/helpers/mindmapMove.ts`
- `packages/whiteboard-editor/src/interactions/helpers/edgeEdit.ts`

### interaction 基础设施

- `packages/whiteboard-editor/src/runtime/interaction/coordinator.ts`
- `packages/whiteboard-editor/src/runtime/interaction/host.ts`
- `packages/whiteboard-editor/src/runtime/interaction/autoPan.ts`

这里不再需要：

- `selectionRuntime.ts`
- `mindmapRuntime.ts`
- `marqueeRuntime.ts`

因为这些不应该是 interaction owner 层。

---

## 与 `whiteboard-core` 的边界

长期最优边界非常简单：

### 放到 core

- 纯手势算法
- 纯几何投影
- 纯 selection 规划
- 纯 transform patch 计算
- 纯 mindmap drop 解析

### 留在 editor

- pointer / keyboard session 生命周期
- autopan 与 viewport host 集成
- preview/output 写入
- command commit
- read model 到 pure algorithm 输入的适配

如果某段代码同时：

- 读 editor runtime
- 写 output
- 调 command

那它不属于 core。

如果某段代码只：

- 吃 plain data
- 出 plain data

那它应优先下沉到 core。

---

## 一步到位的重构方案

如果完全不在乎成本，长期最优应该直接按下面做，而不是渐进修补：

### 1. 重写 interaction protocol

- 删除 `prepare`
- 删除 `setState`
- 删除 `cleanup context`
- 删除 `session.replace`
- `start` 直接返回 active gesture

### 2. 重写 coordinator

- 只维护单个 active gesture
- 只负责 dispatch
- autopan 仍保留，但与 active gesture 生命周期直接绑定

### 3. 合并 interaction owner

- 建立 `select` 单 owner
- 建立 `edge` 单 owner
- `draw` 保持单 owner

### 4. 降级现有子 interaction

- `selection.marquee` -> helper
- `node.drag` -> helper
- `mindmap.drag` -> helper
- `node.transform` -> helper

### 5. 抽独立 interaction host

- 不再让 interaction import `createEditor.ts` 中的类型
- interaction 只依赖 `interaction/host.ts`

### 6. 补 core 纯算法

- 补足 select / marquee / move / transform / mindmap 所需 pure helpers
- editor 只保留 host glue

---

## 最终判断

如果目标只是“让代码更容易读”，继续拆文件还有一点收益。

如果目标是“把系统复杂度真正砍掉”，继续拆文件已经不够了。

必须承认一个事实：

- 当前 interaction 体系的复杂度，主要是协议设计带来的，不是实现细节带来的。

所以长期最优不是：

- 再写更多 `xxxRuntime.ts`
- 再做更多 `ctx` 瘦身
- 再把 helper 名字改漂亮一点

长期最优是：

- **重写 interaction 协议**
- **删除 `session.replace`**
- **让少数顶层 owner 直接拥有完整手势**
- **把子 interaction 还原成 helper 或 core 纯算法**

这才是能把 `whiteboard-editor` interaction 层真正砍薄的方案。
