# WHITEBOARD_EDITOR_FEATURES_BOUNDARY_AUDIT_PLAN.zh-CN

## 目标

这份文档只回答一个问题：

- `packages/whiteboard-editor/src/features` 里，哪些内容符合 editor 职责
- 哪些内容已经越过 editor 边界
- 哪些内容虽然还能工作，但目录语义和底层模型已经开始变形
- 长期最优下，`features` 应该只留下什么

本文不考虑兼容、过渡、渐进迁移。
结论以长期最优为准。

---

## 核心结论

`whiteboard-editor/src/features` 现在混了四类东西：

1. 交互行为本体
2. 瞬态 projection / preview store
3. 命令编排 helper
4. 产品 preset / 文案 / 默认颜色

其中只有第一类天然属于 `features`。

第二类不一定要离开 editor，但不应该继续挂在 `features` 目录下。
第三类属于 editor runtime application service，应该进入 `runtime/commands` 或更明确的 runtime application 层。
第四类不属于 editor runtime，应该移出 editor 包，至少也要移出 `features`。

换句话说，当前 `features` 目录的主要异味不是“算法错了”，而是目录语义已经失真。

长期最优下：

- `features` 只保留交互行为和与该行为强绑定的局部 state machine
- projection store 收到 `runtime/projection`
- 命令编排收到 `runtime/commands`
- 产品 preset / 默认 palette / 模板文本移出 editor
- editor 内部不直接碰 `window`

---

## 评估标准

如果一个文件满足以下任一条件，就不应该继续视为 `feature`：

- 直接依赖宿主 API，例如 `window`、`document`、DOM、Clipboard、浏览器事件对象
- 主要职责是“封装 store / preview / projection”，而不是 feature 行为本身
- 主要职责是“基于 commands + read 做应用编排”
- 承载产品层默认值、文案、颜色、模板、工具菜单内容
- 为 React 渲染输出专门组织结构，而不是 editor runtime 的最小领域输出

如果一个文件主要做的是下面这些，则仍然属于 editor feature：

- 解释输入状态
- 调用 core 纯算法
- 维护交互 session / active state
- 触发 editor commands
- 写入 editor 内部瞬态领域输出

---

## 审计结果

### A. 明确不符合 editor 职责

#### 1. `features/selection/interaction.ts`

文件：

- `packages/whiteboard-editor/src/features/selection/interaction.ts`

问题：

- 直接使用 `window.clearTimeout` 和 `window.setTimeout`
- 这意味着 feature 自己绑定浏览器时间机制，而不是依赖 engine/runtime 提供的调度抽象

证据：

- `packages/whiteboard-editor/src/features/selection/interaction.ts:88`
- `packages/whiteboard-editor/src/features/selection/interaction.ts:95`
- `packages/whiteboard-editor/src/features/selection/interaction.ts:316`
- `packages/whiteboard-editor/src/features/selection/interaction.ts:324`

为什么不对：

- editor 应该是宿主无关 runtime
- 即使允许 editor 内部有时序语义，也应该走 engine 层 scheduler 抽象，而不是自己碰 `window`
- 这里不是“代码风格问题”，而是边界被打破了

长期最优：

- hold 逻辑依赖 `engine` 提供的 timer / scheduler 原语
- selection press feature 只表达“开始 hold”“取消 hold”“hold 触发替换成 marquee”
- 具体调度原语不能再直接来自浏览器全局对象

判定：

- `必须修改`

---

#### 2. `features/toolbox/presets.ts`

文件：

- `packages/whiteboard-editor/src/features/toolbox/presets.ts`

问题：

- 混入大量产品层 preset catalog
- 包含颜色 token、label、description、mindmap 模板文本、默认 preset 选择
- 这不是 editor runtime 行为，而是产品配置与内容资源

证据：

- `packages/whiteboard-editor/src/features/toolbox/presets.ts:70`
- `packages/whiteboard-editor/src/features/toolbox/presets.ts:115`
- `packages/whiteboard-editor/src/features/toolbox/presets.ts:211`
- `packages/whiteboard-editor/src/features/toolbox/presets.ts:272`
- `packages/whiteboard-editor/src/features/toolbox/presets.ts:294`

为什么不对：

- editor 不应该内置产品文案和配色选择
- `InsertPreset` 这种“插入语义模型”可以存在于 editor
- 但具体有哪些 sticky tone、哪些 mindmap 模板、默认名字和描述是什么，不属于 editor runtime
- 这些内容未来很容易因产品策略变化而变化，继续放在 editor 会持续拉高耦合

长期最优：

- editor 只保留 `InsertPreset` 的数据模型与插入协议
- 默认 preset catalog 放到 React/app/plugin 层
- 如果必须共享，则单独放到独立 preset package，而不是 editor `features`

判定：

- `必须移出 editor`

---

#### 3. `features/draw/state.ts` 中的默认 palette

文件：

- `packages/whiteboard-editor/src/features/draw/state.ts`

问题：

- draw 偏好状态本身属于 editor
- 但默认笔刷颜色和产品 palette token 不属于 editor

证据：

- `packages/whiteboard-editor/src/features/draw/state.ts:17`
- `packages/whiteboard-editor/src/features/draw/state.ts:22`
- `packages/whiteboard-editor/src/features/draw/state.ts:39`

为什么不对：

- `DrawPreferences` 是领域状态
- `DEFAULT_DRAW_PREFERENCES` 里具体的品牌配色不是领域状态
- 当前是把“模型”与“默认产品配置”绑死在一个文件里

长期最优：

- editor 只定义：
  - draw slot 结构
  - style normalize 规则
  - opacity 规则
  - patch / slot 命令
- 默认 brush palette 从外部注入
- editor 可以有最小 fallback，但不能再带产品 token 命名和产品 palette 语义

判定：

- `必须收口`

---

### B. 仍在 editor 边界内，但不该继续放在 `features`

#### 1. `features/mindmap/commands.ts`

文件：

- `packages/whiteboard-editor/src/features/mindmap/commands.ts`

问题：

- 这不是交互 feature
- 它本质是命令编排 helper：把 core plan 和 editor commands 连接起来

证据：

- `packages/whiteboard-editor/src/features/mindmap/commands.ts:43`
- `packages/whiteboard-editor/src/features/mindmap/commands.ts:114`
- `packages/whiteboard-editor/src/features/mindmap/commands.ts:155`

为什么不对：

- 这些函数没有 feature session，也没有 interaction registration
- 目录名叫 `features/mindmap`，但内容实际上是 command application service
- 当前 `runtime/commands/mindmap.ts` 只是在薄转发它，导致 runtime/commands 变成空壳，真正逻辑却藏在 features

长期最优：

- 纯 planning 下沉到 `whiteboard-core`
- editor 特有的 read/commands 编排收到 `runtime/commands/mindmap`
- `features/mindmap` 只保留交互本体，例如 drag interaction

判定：

- `应该迁出 features`

---

#### 2. `features/toolbox/insert.ts`

文件：

- `packages/whiteboard-editor/src/features/toolbox/insert.ts`

问题：

- 同时承担：
  - preset 插入编排
  - selection 后处理
  - edit 启动
  - tool 切换
  - insert interaction 注册

证据：

- `packages/whiteboard-editor/src/features/toolbox/insert.ts:50`
- `packages/whiteboard-editor/src/features/toolbox/insert.ts:77`
- `packages/whiteboard-editor/src/features/toolbox/insert.ts:119`
- `packages/whiteboard-editor/src/features/toolbox/insert.ts:153`

为什么不对：

- `insertPreset(...)` 是 application service，不是 feature 行为本体
- `createInsertPresetInteraction(...)` 才像一个 feature
- 两者放在一起会继续模糊“feature”和“runtime command”边界

长期最优：

- `insertPreset(...)` 进入 `runtime/commands/insert`
- `createInsertPresetInteraction(...)` 进入真正的 insert feature
- 如果 insert 只是工具行为，也可以直接并到 `features/insert/interaction`

判定：

- `应该拆分并迁出一部分`

---

#### 3. `features/node/projection/store.ts`

文件：

- `packages/whiteboard-editor/src/features/node/projection/store.ts`

问题：

- 这是 runtime projection infrastructure
- 不是 node feature 行为本身
- 而且把 `patch / hovered / hidden` 三类状态揉进一个 store，模型不够清晰

证据：

- `packages/whiteboard-editor/src/features/node/projection/store.ts:16`
- `packages/whiteboard-editor/src/features/node/projection/store.ts:21`
- `packages/whiteboard-editor/src/features/node/projection/store.ts:53`
- `packages/whiteboard-editor/src/features/node/projection/store.ts:157`

为什么不对：

- `preview patch`
- `hovered container`
- `hidden ids`

这三类状态来源不同、生命周期不同、消费者也不完全相同，但当前被压成一个 `NodeProjectionRuntime`。

这会导致两个问题：

- 读模型越来越像“为了 React 渲染方便拼出来的结构”
- feature 逻辑会被迫围绕 projection store 结构编程，而不是围绕领域动作编程

长期最优：

- 收到 `runtime/projection/node`
- 拆成更明确的瞬态输出模型，例如：
  - `nodePreviewPatch`
  - `nodeHoveredContainer`
  - `nodeHiddenIds`
- `read.node` 再决定如何组合给外部读

判定：

- `应该迁出 features`

---

#### 4. `features/edge/projection.ts`

文件：

- `packages/whiteboard-editor/src/features/edge/projection.ts`

问题：

- 与 `node/projection/store.ts` 相同，本质是 runtime projection infrastructure
- 不属于 edge feature 行为本体

证据：

- `packages/whiteboard-editor/src/features/edge/projection.ts:36`
- `packages/whiteboard-editor/src/features/edge/projection.ts:82`
- `packages/whiteboard-editor/src/features/edge/projection.ts:177`

为什么不对：

- 文件做的是 staged store 封装与 preview patch / hint 管理
- interaction 只是它的消费者
- 当前继续挂在 `features/edge` 下，会让 `edge` feature 的语义变成“行为 + store + 读模型 + view adapter”的混合包

长期最优：

- 收到 `runtime/projection/edge`
- `EdgeProjectionHint` 和 `EdgeProjectionPatch` 作为 editor 内部瞬态输出协议存在
- 由 runtime 统一装配，不再假装它是 edge feature 的一部分

判定：

- `应该迁出 features`

---

#### 5. `features/mindmap/drag/projection.ts`

文件：

- `packages/whiteboard-editor/src/features/mindmap/drag/projection.ts`

问题：

- 它本质上也是 projection store，而不是 feature 行为本体

证据：

- `packages/whiteboard-editor/src/features/mindmap/drag/projection.ts:14`
- `packages/whiteboard-editor/src/features/mindmap/drag/projection.ts:30`

为什么不对：

- 这里只有数据结构和 staged store
- interaction 在另一个文件中消费它
- 这说明目录被拆成了“行为 + projection store”，而不是“feature”

长期最优：

- 收到 `runtime/projection/mindmapDrag`

判定：

- `应该迁出 features`

---

### C. 仍然属于 editor，但文件内部职责过多

#### 1. `features/selection/marquee.ts`

文件：

- `packages/whiteboard-editor/src/features/selection/marquee.ts`

问题：

- 同时承担：
  - interaction registration
  - world rect state
  - screen rect projection
  - 命中查询
  - RAF flush
  - end result 输出

证据：

- `packages/whiteboard-editor/src/features/selection/marquee.ts:49`
- `packages/whiteboard-editor/src/features/selection/marquee.ts:85`
- `packages/whiteboard-editor/src/features/selection/marquee.ts:110`
- `packages/whiteboard-editor/src/features/selection/marquee.ts:143`
- `packages/whiteboard-editor/src/features/selection/marquee.ts:206`

为什么别扭：

- 这不是越界，但它已经把“marquee behavior”和“marquee projection model”捏成一个复合 runtime
- 一旦 selection 模型继续演进，这个文件会继续膨胀

长期最优：

- marquee behavior 保留在 feature
- marquee transient state / projected rect 收到 `runtime/projection/marquee`
- selection feature 只依赖该投影协议

判定：

- `应该拆分`

---

#### 2. `features/selection/interaction.ts`

文件：

- `packages/whiteboard-editor/src/features/selection/interaction.ts`

问题：

- 除了直接碰 `window` 之外，它还同时承担 selection press、tap action、hold、marquee replace、move replace
- 这是一个过重的 orchestrator

证据：

- `packages/whiteboard-editor/src/features/selection/interaction.ts:140`
- `packages/whiteboard-editor/src/features/selection/interaction.ts:151`
- `packages/whiteboard-editor/src/features/selection/interaction.ts:214`
- `packages/whiteboard-editor/src/features/selection/interaction.ts:247`
- `packages/whiteboard-editor/src/features/selection/interaction.ts:272`

为什么别扭：

- 这里不是纯算法复杂，而是 feature 自己承担了过多“状态切换编排”
- `selection.press -> marquee`
- `selection.press -> node.drag`
- `selection.tap -> edit`

这些转换是合理的，但当前表达方式太扁平

长期最优：

- 至少拆成：
  - `selection/pressPlan`
  - `selection/pressInteraction`
  - `selection/marqueeSession`
- 如果 interaction registry 继续演进，selection press 更适合变成一个明确的 start driver

判定：

- `应该瘦身`

---

### D. 目前基本符合 editor 职责

以下文件整体上仍然属于 editor runtime 正常边界，主要做输入解释、调用 core 算法、触发 commands、写瞬态领域输出：

- `packages/whiteboard-editor/src/features/draw/interaction.ts`
- `packages/whiteboard-editor/src/features/node/drag/interaction.ts`
- `packages/whiteboard-editor/src/features/node/transform/interaction.ts`
- `packages/whiteboard-editor/src/features/edge/connect/interaction.ts`
- `packages/whiteboard-editor/src/features/edge/edit/interaction.ts`
- `packages/whiteboard-editor/src/features/mindmap/drag/interaction.ts`
- `packages/whiteboard-editor/src/features/viewport/interaction.ts`
- `packages/whiteboard-editor/src/features/edge/hoverProcessor.ts`

说明：

- `edge/hoverProcessor.ts` 虽然用了 RAF task，但它依赖的是 engine 的 scheduler 抽象，而不是直接碰浏览器宿主，所以不算明确越界
- 这些文件的问题主要不是“editor 不该有”，而是它们周围的 projection / command / preset 层次没收干净

---

## 最终目录目标

长期最优下，`whiteboard-editor/src` 应该收敛为下面这套职责分布。

### 1. `features`

只保留行为 feature：

- `features/draw/interaction.ts`
- `features/node/drag/interaction.ts`
- `features/node/transform/interaction.ts`
- `features/edge/connect/interaction.ts`
- `features/edge/edit/interaction.ts`
- `features/mindmap/drag/interaction.ts`
- `features/selection/press/interaction.ts`
- `features/selection/marquee/interaction.ts`
- `features/viewport/interaction.ts`

特点：

- 不直接碰 `window`
- 不直接持有产品 preset catalog
- 不承载 projection store 基础设施
- 不承载 runtime command 编排 helper

### 2. `runtime/projection`

收纳所有瞬态 projection store：

- `runtime/projection/node.ts`
- `runtime/projection/edge.ts`
- `runtime/projection/mindmapDrag.ts`
- `runtime/projection/marquee.ts`
- 如果 draw preview 继续独立，也可有 `runtime/projection/draw.ts`

### 3. `runtime/commands`

收纳 editor application service：

- `runtime/commands/insert.ts`
- `runtime/commands/mindmap.ts`
- 其他所有“基于 read + commands 做编排”的 helper

### 4. `types`

只保留协议与领域类型：

- `InsertPreset`
- `DrawPreferences`
- `MarqueeResult`
- projection DTO type

### 5. editor 外部层

收纳产品资源：

- sticky tone catalog
- default draw palette
- insert menu 文案
- mindmap 模板内容
- 任何跟产品视觉或文案绑定的默认值

---

## 一步到位的重构顺序

### 第一阶段：修正硬边界错误

1. 去掉 `selection/interaction.ts` 对 `window.setTimeout` / `window.clearTimeout` 的直接依赖
2. 把 timer 语义收敛到 engine scheduler 或 editor 自己的宿主无关调度抽象
3. 从 editor 移出 `toolbox/presets.ts` 的产品 catalog
4. 从 `draw/state.ts` 移出产品默认 palette

### 第二阶段：纠正目录语义

1. `features/mindmap/commands.ts` 移入 `runtime/commands/mindmap.ts`
2. `features/toolbox/insert.ts` 拆成：
   - `runtime/commands/insert.ts`
   - `features/insert/interaction.ts`
3. `toolbox.ts` 只作为 editor 对外 API 入口，不再把内部错误目录继续合法化

### 第三阶段：抽离 projection infrastructure

1. `features/node/projection/store.ts` -> `runtime/projection/node.ts`
2. `features/edge/projection.ts` -> `runtime/projection/edge.ts`
3. `features/mindmap/drag/projection.ts` -> `runtime/projection/mindmapDrag.ts`
4. `features/selection/marquee.ts` 拆出 `runtime/projection/marquee.ts`

### 第四阶段：压缩 feature 内部 orchestration

1. `selection/interaction.ts` 拆小
2. 明确：
   - press plan
   - press interaction
   - marquee interaction
   - move handoff
3. feature 间切换通过 interaction registry/session 协议完成，不再在大文件里手工堆叠

---

## 不应该再做的事

- 不要再往 `features` 里放 preset catalog
- 不要再往 `features` 里放 projection store
- 不要再让 `runtime/commands` 只是薄转发，而把真正逻辑丢在 `features`
- 不要在 editor 内直接碰 `window`
- 不要再把产品默认值和 editor 领域状态写在同一个文件里

---

## 最终判断

`whiteboard-editor/src/features` 现在不是“彻底错误”，但已经出现明显职责漂移。

最核心的三个问题是：

1. 宿主 API 直接渗入 editor
2. 产品配置和产品内容渗入 editor
3. runtime infrastructure 和 application service 假装成 feature

只要这三件事不收掉，后面继续做 editor/runtime/host/core 的边界收敛时，`features` 会持续变成一个大杂烩目录。

长期最优不是“继续给 `features` 补命名”，而是把 `features` 重新收窄成真正的行为层。
