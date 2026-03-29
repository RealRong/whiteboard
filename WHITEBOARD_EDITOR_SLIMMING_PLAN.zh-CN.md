# Whiteboard Editor 内部瘦身与整理方案

## 1. 文档目标

这份文档只回答一个问题：

**在不主动改变 `whiteboard-editor` 功能语义的前提下，怎样系统性地整理内部结构，让它更薄、更统一、更容易读，也更容易继续演进。**

这里说的“瘦身”不是简单删代码，也不是把大文件粗暴拆成很多碎文件，而是同时解决下面几类问题：

1. 架构边界不够清楚。
2. 命名体系漂移，读文件名时无法稳定判断职责。
3. 少数热点文件承担了过多职责，成为后续修改的高噪音落点。
4. 一些样板逻辑在多个 feature 中重复出现。
5. editor 内部导出面和类型聚合方式仍然偏重，阅读成本较高。

这份方案默认当前方向不变：

1. `whiteboard-react` 继续做 DOM 绑定和 UI 组合。
2. `whiteboard-editor` 继续做输入决策、交互 session、业务行为和 preview。
3. 当前已落地的 `input router + passive processor + interaction driver registry` 方向继续保留。

---

## 2. 核心结论

当前 `whiteboard-editor` 的主要问题，不是“文件数太多”，也不是“总行数太大”，而是：

**内部职责虽然已经开始成型，但文件组织方式还没有完全跟上新的架构。**

更具体地说，现在的问题主要集中在四个层面：

1. `runtime` 和 `features` 的边界还不够干净。
2. 命名系统没有统一，`input / gesture / runtime / session / driver / processor` 混用。
3. 几个热点文件明显过厚，且把多层职责压在一起。
4. 一些通用样板已经重复出现，适合抽成轻量基础设施。

所以长期最优方向不是继续堆抽象，而是：

**先统一边界和命名，再把热点文件拆成单职责模块，最后再做轻量复用收口。**

一句话说：

**现在最值得做的不是“重写”，而是“整理”。**

---

## 3. 当前结构快照

按当前代码分布，`packages/whiteboard-editor/src` 的热点大致如下：

### 3.1 文件密度最高的区域

- `runtime/commands`
- `runtime/read`
- `runtime/interaction`
- `runtime/input`
- `runtime/editor`
- `features/node`
- `features/edge`

这说明系统的复杂度确实主要集中在：

1. editor kernel 级装配与输入流转。
2. node / edge / selection 这几个核心 feature。

### 3.2 当前最厚的文件

按当前统计，行数最高的一批文件包括：

- `runtime/context/selection.ts` 约 670 行
- `features/edge/input.ts` 约 553 行
- `features/node/session/transform.ts` 约 537 行
- `runtime/selection/press.ts` 约 456 行
- `runtime/commands/node.ts` 约 450 行
- `features/draw/input.ts` 约 450 行
- `runtime/editor/createEditor.ts` 约 402 行
- `runtime/input/pointer.ts` 约 373 行

这些文件并不是都“有问题”，但它们几乎都具备同一个特征：

**不只是长，而是把 2 到 4 层职责叠在了一起。**

### 3.3 当前命名漂移的典型例子

- `features/draw/input.ts`
  实际更像 draw driver，而不是原始输入层。
- `features/edge/input.ts`
  实际更像 edge edit driver + patch session 装配，而不是通用 input。
- `features/selection/gesture.ts`
  实际是 selection press driver，不是通用 gesture engine。
- `features/mindmap/dragSession.ts`
  对外暴露的是 `start/cancel`，职责更像 driver；真正的 store 在 `features/mindmap/session/drag.ts`。
- `runtime/input/interactionStart.ts`
  当前不再是旧意义上的 “interactionStart”，而是在创建 interaction drivers。
- `runtime/input/runtime.ts`
  当前实际职责更接近 input router / input dispatcher。

这类命名问题本身不会导致 bug，但会持续拉高阅读和维护成本。

---

## 4. 当前结构的主要问题

## 4.1 `runtime` 与 `features` 边界还不够清楚

理论上，`runtime` 应该只承载 editor kernel 级基础设施：

- input
- interaction
- viewport
- pick
- frame
- commands
- editor composition

而 `features` 应该承载业务语义：

- draw
- edge
- node
- selection
- mindmap
- context menu

但当前仍有几类业务逻辑被放进了 `runtime`：

- `runtime/context/selection.ts`
  本质是 selection context menu 视图组装。
- `runtime/selection/press.ts`
  本质是 selection press planner。

这些模块虽然“服务于 runtime”，但并不属于通用 runtime kernel。它们属于 selection 这个 feature 的业务规则。

## 4.2 命名词汇没有稳定收敛

当前交互相关文件同时使用了：

- `input`
- `gesture`
- `runtime`
- `session`
- `driver`
- `processor`

问题不在于这些词不能共存，而在于：

**同一层职责没有稳定使用同一套词。**

当文件名无法反映职责时，就会出现两个问题：

1. 读代码前必须先打开文件确认它到底干什么。
2. 后续新增模块时，命名会继续漂移。

## 4.3 少数大文件承担了过多职责

典型例子：

### A. `runtime/context/selection.ts`

它同时承担了：

1. menu item 常量定义
2. action bind helper
3. selection operations
4. groups 组装
5. more sections 组装
6. 最终 read store 产物

这不是一个“selection read 文件”，而是四五种职责被压在一起的拼装文件。

### B. `features/edge/input.ts`

它同时承担了：

1. edge patch session 抽象
2. body drag
3. route edit
4. preview patch 写入
5. active session lifecycle

从结构上看，它已经不是一个单纯的 feature 入口文件，而是一个把子模块全部内联进去的实现文件。

### C. `features/node/session/transform.ts`

它同时承担了：

1. transform drag state 定义
2. resize / rotate preview 计算
3. commit patch 编译
4. active interaction 启动
5. node / selection-box 两种入口分支

### D. `runtime/input/pointer.ts`

它同时承担了：

1. pointer 相关类型定义
2. pointer down / move / up resolver
3. frame exit 规则
4. context open 解析

这些职责之间有关系，但不适合永久堆在一个文件里。

## 4.4 复用点已经出现，但还没收成基础设施

当前明显重复的一类模式是：

1. `createStagedValueStore` 或 `createStagedKeyedStore`
2. `createRafTask`
3. `flush / clear / cancel` 封装

这套模式反复出现在：

- draw preview
- edge preview
- node session store
- mindmap drag store
- snap guides

说明这里已经形成了一种成熟模式，适合抽一层很薄的工具，而不是继续在每个 feature 里手写样板。

## 4.5 `createEditor.ts` 仍然偏厚

`runtime/editor/createEditor.ts` 当前虽然已经回到“最终装配层”的位置，但它仍然同时做了：

1. platform 创建
2. stores / read / commands 创建
3. feature session 创建
4. input policy / interaction registry / passive runtime 装配
5. editor session views 组装
6. lifecycle 组装
7. editor 本体总装

它现在不是逻辑脏，而是职责太集中，像一个全系统的汇编入口。

这类文件一旦继续增长，会产生两个问题：

1. 任何领域增加依赖都会先把它变胖。
2. 很难在 review 中快速看出“这次只是调整输入装配”还是“这次改了 editor 基础结构”。

---

## 5. 这轮整理的总体原则

## 5.1 目标是“少噪音”，不是“多抽象”

这轮整理不应该引入新的 mega framework，也不应该为了统一而统一。

判断标准只有一个：

**整理后，是否能让阅读路径更短、修改影响面更小、diff 更容易审。**

## 5.2 先拆职责，再搬目录

很多人会先移动文件再拆逻辑，这样会让 diff 噪音非常大。

更合理的顺序是：

1. 先在原文件中拆出纯 helper / 子模块。
2. 等职责边界稳定后，再做目录归位和命名收敛。

这样：

1. 每一步都可审。
2. 每一步都容易回归验证。
3. 不会把“逻辑重构”和“路径重构”混成一坨。

## 5.3 不主动改变 public API

这次内部瘦身的目标不是对外 API 改版。

所以默认约束是：

1. `@whiteboard/editor` 对外导出面尽量保持不变。
2. `whiteboard-react` 调 editor 的外部形状尽量不变。
3. 变化优先收敛在 editor 内部 import 和内部模块结构。

## 5.4 单文件只保留一个主要原因被修改

这轮整理的最终标准不是“每个文件不超过多少行”，而是：

**一个文件应该只有一个主要理由被修改。**

比如：

- `selection press plan` 变了，不应该波及 `context menu groups` 文件。
- `edge route edit` 变了，不应该波及 `edge body drag` 文件。
- `input pointer resolver` 变了，不应该波及 `context open` 解析文件。

## 5.5 公共工具只抽“稳定样板”，不抽“伪统一逻辑”

适合抽的：

- staged store + raf flush
- onSelect / close bind helper
- 小型 item builder

不适合现在抽的：

- 所有交互共用的万能 session 工厂
- 所有 feature 共用的万能 driver 框架
- 所有 preview 共用的万能 reducer

原因很简单：

这些高层语义虽然相似，但行为差异仍然很大，过早统一只会产生第二层噪音。

---

## 6. 建议统一的命名词汇

我建议内部统一使用下面这套词。

## 6.1 `runtime`

只留给 editor kernel 级模块：

- input kernel
- interaction kernel
- viewport kernel
- pick kernel
- editor composition
- command composition

如果一个模块属于某个具体 feature 的业务规则，就不应该再叫 `runtime`。

## 6.2 `driver`

用于：

1. 决定某个 feature 是否启动。
2. 提供 `start / cancel` 一类 feature 交互入口。

适合命名：

- `drawDriver`
- `selectionPressDriver`
- `mindmapDragDriver`
- `edgeEditDriver`

## 6.3 `session`

用于：

1. 一次 active interaction 的生命周期。
2. 持有本次交互状态。
3. 接收 move / up / cancel。

适合命名：

- `marqueeSession`
- `edgeConnectSession`
- `nodeTransformSession`

## 6.4 `plan`

用于纯规划、纯判定、不直接写状态的逻辑。

适合命名：

- `selectionPressPlan`
- `contextOpenPlan`

## 6.5 `resolver`

用于原始输入或低层输入事实解析。

适合命名：

- `pointerResolver`
- `contextTargetResolver`

## 6.6 `processor`

用于 passive / idle 输入处理器。

适合命名：

- `edgeHoverProcessor`

## 6.7 `store`

用于 staged store、preview store、session store。

适合命名：

- `mindmapDragStore`
- `edgePreviewStore`
- `nodeSessionStore`

## 6.8 `preview`

用于临时投影数据或 preview 写入逻辑。

适合命名：

- `edgePreview`
- `drawPreviewStore`

## 6.9 应该避免的命名

以下命名在当前项目里最容易制造歧义：

1. feature 级文件叫 `input.ts`
2. feature 级文件叫 `runtime.ts`
3. 泛称 `gesture.ts`

因为这些词在当前工程里已经被更底层的系统使用了。

---

## 7. 推荐的最终目录边界

下面不是要求一次性搬完，而是建议的长期目标结构。

```ts
src/
  runtime/
    editor/
    input/
      pointerTypes.ts
      pointerResolver.ts
      contextResolver.ts
      router.ts
      passive.ts
    interaction/
    viewport/
    pick/
    commands/
    frame/
    utils/

  features/
    draw/
      driver.ts
      state.ts
      previewStore.ts

    edge/
      connectSession.ts
      hoverProcessor.ts
      previewStore.ts
      edit/
        driver.ts
        patchSession.ts
        bodyEdit.ts
        routeEdit.ts

    node/
      session/
        store.ts
      transform/
        session.ts
        commit.ts
        preview.ts
        types.ts

    selection/
      marqueeSession.ts
      press/
        driver.ts
        plan.ts
        target.ts
      contextMenu/
        schema.ts
        operations.ts
        read.ts

    mindmap/
      drag/
        driver.ts
        store.ts
      commands.ts
```

这个结构的意义不是“看起来整齐”，而是：

1. runtime 只放 kernel。
2. feature 的业务逻辑回到 feature 自己目录下。
3. 文件名能直接表达职责。

---

## 8. 逐文件整理建议

## 8.1 `runtime/editor/createEditor.ts`

### 当前问题

这个文件已经是最终装配层，但仍然太厚。

### 最佳方向

保留它作为最终 composition layer，但把内部装配分解为几个 helper：

- `createEditorCoreServices`
- `createEditorFeatureDrivers`
- `createEditorSessionViews`
- `createEditorInputInternals`

### 结果目标

`createEditor.ts` 自己只保留：

1. 初始化顺序
2. 依赖流向
3. 最终 `editor` 对象组装

也就是说，它应该像 wiring file，而不是半个 runtime 实现文件。

## 8.2 `runtime/input/pointer.ts`

### 当前问题

它同时放了：

1. pointer types
2. pointer down / move / up resolver
3. frame resolution
4. context open resolution

### 最佳方向

拆成三块：

- `pointerTypes.ts`
- `pointerResolver.ts`
- `contextResolver.ts`

### 结果目标

以后如果改：

- pointer 标准化字段
- frame exit 规则
- context open 规则

三类修改不会再落到同一个文件上。

## 8.3 `runtime/context/selection.ts`

### 当前问题

文件过厚，而且本质上是 selection context menu 业务视图层，不属于 runtime kernel。

### 最佳方向

移动到 selection feature 下，并拆成：

- `schema.ts`
  静态 item 定义、文案和排序常量
- `operations.ts`
  对 selection 的业务操作封装
- `groups.ts`
  groups / moreSections 组装
- `read.ts`
  `readSelectionMenuView` 与 `createSelectionMenuRead`

### 额外收益

这里还能顺手抽掉一部分重复样板：

- `bindAction`
- `bindActionWithArgs`
- menu item builder

## 8.4 `runtime/selection/press.ts`

### 当前问题

它是 selection feature 的纯 planner，但目录上挂在 runtime 下。

### 最佳方向

直接归位到 selection feature，并拆成：

- `mode.ts`
- `target.ts`
- `plan.ts`

### 结果目标

selection press 的纯规划逻辑和 selection press 的 driver 形成明确分层：

- `plan`
  只做纯判定
- `driver`
  负责启动具体动作

## 8.5 `features/selection/gesture.ts`

### 当前问题

文件名已经落后于职责。

### 最佳方向

重命名为更明确的 `pressDriver.ts` 或 `selectionPressDriver.ts`。

它现在本质上做的是：

1. 消费 `resolveSelectionPressPlan`
2. 持有 `press runtime`
3. 决定启动 marquee / node drag / tap action

这已经不是泛义 `gesture`，而是 feature 自己的 interaction driver。

## 8.6 `features/draw/input.ts`

### 当前问题

从职责上讲，它现在是 draw feature 的交互 driver，不是底层 input。

### 最佳方向

最终命名应改成 `driver.ts`，并把 preview store 提出去：

- `driver.ts`
- `previewStore.ts`
- `stroke.ts`
- `erase.ts`

### 结果目标

主文件只保留：

1. driver 入口
2. active session 生命周期
3. 子能力装配

## 8.7 `features/edge/input.ts`

### 当前问题

它是当前 editor 内部最明显该拆的业务文件之一。

### 最佳方向

直接拆成：

- `edit/patchSession.ts`
- `edit/bodyEdit.ts`
- `edit/routeEdit.ts`
- `edit/driver.ts`

### 拆分原则

- `patchSession`
  只抽通用 active session 模板
- `bodyEdit`
  只关心 edge body drag
- `routeEdit`
  只关心 route point 编辑
- `driver`
  只负责 `startBody / startRoute / cancel`

### 结果目标

以后改 route edit 时，不需要打开 body drag 逻辑。

## 8.8 `features/node/session/transform.ts`

### 当前问题

它同时承载类型、preview 更新、commit 编译和 session 启动。

### 最佳方向

拆成：

- `types.ts`
- `preview.ts`
- `commit.ts`
- `session.ts`

### 结果目标

`session.ts` 只做 active interaction 入口与状态机；
preview 和 commit 逻辑各自独立。

## 8.9 `features/mindmap/dragSession.ts`

### 当前问题

命名不够稳定。

### 最佳方向

最终应改成：

- `drag/driver.ts`
- `drag/store.ts`

因为对外暴露的是 feature driver，而持久化临时状态的是 store。

## 8.10 `types/internal/editor.ts`

### 当前问题

这个文件已经成为 editor 内部类型总枢纽，容易继续膨胀。

### 最佳方向

拆成几个明确领域：

- `editorPlatformTypes.ts`
- `editorInputTypes.ts`
- `editorRuntimeTypes.ts`
- `editorCommandTypes.ts`

### 结果目标

把“平台桥接”“输入 internals”“runtime 本体”“command host 类型”分开，不再挤在一个文件里。

---

## 9. 推荐优先抽取的公共复用

## 9.1 Staged Store + RAF Flush

这是当前最成熟、也最适合低风险抽出的重复模式。

建议抽成很薄的工具：

- `createRafValueStore`
- `createRafKeyedStore`

适用范围：

- draw preview
- edge preview hint
- node session store
- mindmap drag store
- snap guides

这里的关键是“薄”：

只抽 store 调度样板，不抽业务比较逻辑和 build 逻辑。

## 9.2 Action Binder

`context menu` 里有大量：

- `bindAction`
- `bindActionWithArgs`
- `?? (() => undefined)`

这类样板可以抽成小工具，但只限 context menu 场景内部使用，不必提升到全局 runtime。

## 9.3 静态 Menu Schema

像 `ORDER_ITEMS / ALIGN_ITEMS / DISTRIBUTE_ITEMS` 这类纯 schema 常量，应独立成 schema 文件。

这样：

1. 文案修改不再碰业务逻辑。
2. UI 组合逻辑更短。

---

## 10. 这轮整理不建议做的事

## 10.1 不建议引入新的“超级统一框架”

例如：

- 万能 interaction session factory
- 万能 feature runtime 基类
- 万能 preview reducer

这些抽象现在都太早，会把“局部清晰”重新换成“全局抽象但更难懂”。

## 10.2 不建议先大范围移动目录

如果先做：

1. 改路径
2. 改命名
3. 拆逻辑

那 diff 会非常吵，也很难 review。

正确顺序是：

1. 先拆逻辑
2. 再统一命名
3. 最后归位目录

## 10.3 不建议把所有内部模块都加 barrel

barrel 不是越多越好。

内部 barrel 太多会带来两个问题：

1. 跳转路径模糊
2. 依赖方向更难看清

只在下面两类边界使用 barrel：

1. package 对外入口
2. feature 边界入口

内部细粒度模块之间，优先显式路径。

---

## 11. 最优实施顺序

如果目标是“尽量不影响功能的前提下减少代码和噪音”，我建议按下面顺序推进。

## 第 1 阶段：拆热点文件，不改外部形状

优先处理：

1. `runtime/context/selection.ts`
2. `runtime/selection/press.ts`
3. `features/edge/input.ts`
4. `features/node/session/transform.ts`
5. `runtime/input/pointer.ts`

阶段目标：

1. 先切职责。
2. 不急着大改路径。
3. 不主动改 public export。

这是收益最高、风险最低的一步。

## 第 2 阶段：统一命名

把下面这类名字收敛：

1. feature 级 `input.ts` -> `driver.ts`
2. feature 级 `gesture.ts` -> `pressDriver.ts`
3. `interactionStart.ts` -> `drivers.ts` 或 `createDefaultDrivers.ts`
4. `runtime/input/runtime.ts` -> `router.ts`

阶段目标：

1. 文件名直接表达职责。
2. 新增模块时，团队有统一模板可遵守。

## 第 3 阶段：业务模块从 runtime 归位到 features

优先归位：

1. selection press planner
2. selection context menu read

阶段目标：

1. runtime 只留 kernel。
2. business logic 回到 feature 目录。

## 第 4 阶段：抽轻量公共工具

优先抽：

1. `createRafValueStore`
2. `createRafKeyedStore`
3. context menu action binder

阶段目标：

1. 去掉重复样板。
2. 不增加新的概念层。

## 第 5 阶段：压薄 `createEditor.ts`

当上面边界都稳定后，再拆：

1. core services assembly
2. feature drivers assembly
3. session views assembly
4. input internals assembly

阶段目标：

`createEditor.ts` 最终只保留 editor 启动顺序和总装配关系。

---

## 12. 建议的最终命名规则

为了让后续新增代码不再继续漂移，我建议明确写死下面几条规则。

### 12.1 Feature 目录命名规则

一个 feature 里只允许出现下面这些职责名：

- `driver`
- `session`
- `store`
- `preview`
- `plan`
- `resolver`
- `processor`
- `commands`
- `state`

### 12.2 Runtime 目录命名规则

`runtime/` 里只允许出现：

- kernel 级能力
- editor composition
- cross-feature shared infrastructure

如果一个文件明显依赖某个 feature 业务语义，就不应该继续放在 `runtime/`。

### 12.3 文件名规则

优先：

- `driver.ts`
- `session.ts`
- `plan.ts`
- `store.ts`
- `preview.ts`

尽量避免：

- `input.ts`
- `runtime.ts`
- `gesture.ts`

除非它真的属于输入内核或运行时内核。

---

## 13. 这轮整理完成后的理想状态

理想状态下，`whiteboard-editor` 应该具备下面几个特征：

1. 看目录就能看出 kernel 与 feature 的边界。
2. 看文件名就能猜到它是 driver、session、plan 还是 store。
3. 修改 selection press 不会再碰 context menu 读层。
4. 修改 edge route edit 不会再碰 edge body drag。
5. 修改 pointer resolver 不会再碰 context open 逻辑。
6. `createEditor.ts` 只负责总装，不再继续变成超级实现文件。
7. 各 feature 中重复的 store/preview 样板显著减少。

如果能做到这些，即使总行数没有大幅下降，代码的“噪音密度”也会明显下降。

这才是这轮瘦身最重要的结果。

---

## 14. 最终建议

如果只给一个最实际的建议，那就是：

**不要把这轮工作理解成“重构整个 editor”，而要理解成“把已成型的架构边界补上文件组织和命名”。**

因为现在真正缺的不是能力，而是：

1. 边界归位
2. 命名收敛
3. 热点文件拆分
4. 重复样板压薄

按这个顺序做，风险最低，收益最大，也最符合“尽量不影响功能的情况下减少代码和噪音”这个目标。
