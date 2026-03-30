# WHITEBOARD_EDITOR CORE 边界下沉方案

## 1. 文档目标

这份文档只回答一个问题：

- `packages/whiteboard-editor` 里还有哪些内容不应该留在 editor。
- 其中哪些应该下沉到 `packages/whiteboard-core`，作为交互纯算法、投影纯函数、领域规则。
- 哪些虽然看起来“也挺纯”，但本质仍然是 editor host/runtime 层，不应该搬。

这里不讨论兼容、过渡、双轨。
目标是长期最优边界。

---

## 2. 最终边界原则

### 2.1 `whiteboard-core` 应该拥有的内容

`whiteboard-core` 只负责领域层输入输出，不依赖：

- DOM
- `PointerEvent`
- `EditorRuntime`
- `PointerPick`
- `StagedStore` / `rafStore`
- engine item/store 的宿主包装

`whiteboard-core` 应该拥有：

- 交互 plan 纯解析
- 交互 draft/session 的纯状态机
- patch -> projected model 的纯投影函数
- frame scope / selection / edge connect / transform 等领域规则
- 纯比较函数、纯归一化函数、纯转换函数

### 2.2 `whiteboard-editor` 应该拥有的内容

`whiteboard-editor` 只保留 host/runtime 责任：

- DOM 输入采集
- pick 绑定与命中来源适配
- viewport 坐标转换
- tool / frame / edit 等运行时上下文拼装
- projection store / overlay store / raf store
- 将 core 输出连接到 editor commands

### 2.3 最优分层

最终应收敛为三层：

1. editor input adapter
   - 把 DOM/pick/tool/frame/edit 信息收敛成语义输入。
2. core policy / draft / projection
   - 根据语义输入返回 interaction plan、draft state、patch、hint、commit。
3. editor runtime bridge
   - 把 core 输出写入 projection store，或者提交到 commands。

换句话说：

- core 不应该知道 `PointerDown`。
- core 不应该知道 `PointerPick`。
- core 不应该知道 `projection.writePatch()`。
- editor 不应该继续持有 selection press plan、edge connect draft、patch apply 这类纯规则。

---

## 3. 本轮审计结论总览

本轮审计后，候选分成三档：

### 3.1 P0: 必须下沉到 core

- `packages/whiteboard-editor/src/features/edge/connect.ts`
- `packages/whiteboard-editor/src/runtime/selection/pressRules.ts`
- `packages/whiteboard-editor/src/runtime/selection/pressTarget.ts`
- `packages/whiteboard-editor/src/runtime/selection/pressPlan.ts`
- `packages/whiteboard-editor/src/types/internal/selection.ts` 中的 interaction plan/action 类型

### 3.2 P1: 先抽语义协议，再下沉

- `packages/whiteboard-editor/src/runtime/input/pointer/gate.ts`
- `packages/whiteboard-editor/src/runtime/read/node.ts` 中的 node role/transform/connect/enter 解析
- `packages/whiteboard-editor/src/features/node/text.ts` 中的文本语义部分

### 3.3 P2: 只抽纯函数层，store/runtime 包装留在 editor

- `packages/whiteboard-editor/src/features/node/projection/store.ts`
- `packages/whiteboard-editor/src/features/edge/projection.ts`
- `packages/whiteboard-editor/src/features/node/patch.ts`
- `packages/whiteboard-editor/src/features/node/transform/interaction.ts` 中的 patch 提交转换逻辑

### 3.4 明确留在 editor

- `packages/whiteboard-editor/src/runtime/interaction/snap.ts`
- `packages/whiteboard-editor/src/features/edge/hoverProcessor.ts`
- `packages/whiteboard-editor/src/features/mindmap/drag/projection.ts`
- `packages/whiteboard-editor/src/runtime/read/frame.ts`

---

## 4. 必须下沉的模块

## 4.1 edge connect draft 应整体下沉

目标文件：

- `packages/whiteboard-editor/src/features/edge/connect.ts`

当前文件内容本质上全是领域模型：

- `EdgeDraftEnd`
- `EdgeConnectState`
- `EdgeConnectHint`
- `EdgeConnectCommit`
- `toPointDraftEnd`
- `toEdgeDraftEnd`
- `toEdgeEnd`
- `startEdgeCreate`
- `startEdgeReconnect`
- `resolveReconnectDraftEnd`
- `setEdgeConnectTarget`
- `toEdgeConnectHint`
- `toEdgeConnectPatch`
- `toEdgeConnectCommit`

这整文件只依赖：

- `@whiteboard/core/types`
- `@whiteboard/core/edge`

它不依赖：

- editor runtime
- engine
- DOM
- projection store

所以它不是 editor feature，而是 edge 领域模型。

### 最终目标

应并入或迁移到：

- `packages/whiteboard-core/src/edge/connect.ts`

如果文件过大，可以拆成：

- `packages/whiteboard-core/src/edge/connect.ts`
- `packages/whiteboard-core/src/edge/draft.ts`

但语义上必须属于 core。

### 同时要解决的问题

当前存在重复概念：

- `EdgeConnectHint`
- `EdgeProjectionHint`

这两个其实表达的是同一件事：

- 连线草稿的线段预览
- 吸附点提示

最终应该统一成 core 侧单一类型，editor 只消费，不再自己重复定义。

---

## 4.2 selection press 规则链应整体下沉

目标文件：

- `packages/whiteboard-editor/src/runtime/selection/pressRules.ts`
- `packages/whiteboard-editor/src/runtime/selection/pressTarget.ts`
- `packages/whiteboard-editor/src/runtime/selection/pressPlan.ts`

这三份文件合起来实际上不是 runtime，而是 selection 领域的 plan resolver。

它们做的事情是：

- 根据 modifier 解析 selection mode
- 根据当前 selection 和命中目标解析 press target
- 根据 target 和 selection 生成 tap/drag/hold 计划

这和 `mindmap.drag` 目前的结构应该一致：

- core 持有 plan/session 规则
- editor 只负责输入适配与命令桥接

### 当前的问题

这条链现在仍留在 editor，导致 editor 还在拥有本不该拥有的领域决策：

- 何时清空选择
- 何时进入 marquee
- 何时进入 move
- 何时进入 edit
- group shell/body/background 的 press 分流

这会导致：

- interaction 层太厚
- runtime 和业务规则耦合
- selection 行为难以复用和统一测试

### 最终目标

应新增 core 模块，例如：

- `packages/whiteboard-core/src/selection/press.ts`

或拆成：

- `packages/whiteboard-core/src/selection/pressRules.ts`
- `packages/whiteboard-core/src/selection/pressTarget.ts`
- `packages/whiteboard-core/src/selection/pressPlan.ts`

但从长期维护角度看，更推荐收成单个入口模块，外部只暴露：

- `resolveSelectionPressMode`
- `resolveSelectionPressTarget`
- `resolveSelectionPressPlan`

### editor 侧只保留什么

editor 不再直接把 `PointerDown` 交给这条链。
editor 只负责把输入适配成一个更窄的语义对象，例如：

- `SelectionPressSubject`
- `SelectionPressInput`

里面只保留 core 真正关心的字段：

- modifier mode
- hit subject
- field
- selection summary
- 当前节点/群组/壳层语义

---

## 4.3 selection interaction plan 类型不应继续留在 editor internal

目标文件：

- `packages/whiteboard-editor/src/types/internal/selection.ts`

当前不该留在 editor 的类型：

- `SelectionTapAction`
- `SelectionDragAction`
- `SelectionPressPlan`

这些类型不是 host 细节，而是 selection 领域协议。

如果它们继续留在 editor，会形成错误分层：

- core 负责 summary
- editor 负责 policy

这会让 selection 领域在两个包之间横切。

### 最终目标

应迁移到：

- `packages/whiteboard-core/src/selection/press.ts`

或者：

- `packages/whiteboard-core/src/types/selection.ts`

最优做法是与 plan resolver 放在一起导出，避免 plan 和 plan type 分家。

---

## 5. 需要先收敛协议，再下沉的模块

## 5.1 pointer frame gate 的逻辑应下沉，但不能直接搬 `PointerPick`

目标文件：

- `packages/whiteboard-editor/src/runtime/input/pointer/gate.ts`

这份文件的实质不是 DOM 输入处理，而是：

- 在给定 frame scope 下
- 根据命中对象与位置
- 判断是否仍在 frame 内
- 是否应退出到 root frame

它本质是 document/frame interaction policy。

### 为什么现在还不能直接搬

它当前依赖：

- `PointerPick`
- editor read bridge

这两个都不是 core 应该知道的协议。

### 最终目标

把这层逻辑改造成 core 纯函数，例如：

- `resolveFrameGateDecision(input): { frame, exit }`

输入不再使用 `PointerPick`，而改成更窄的语义对象，例如：

- `subject.kind = background | selection-box | node | edge | mindmap`
- `subject.nodeId`
- `subject.edge`
- `subject.pointWorld`

然后迁入：

- `packages/whiteboard-core/src/document/frameScope.ts`

或者新建：

- `packages/whiteboard-core/src/document/frameGate.ts`

### editor 最终职责

editor 只负责把 pick 适配为 frame gate 所需的语义输入。

---

## 5.2 node definition resolver 目前还停留在 editor

目标位置：

- `packages/whiteboard-editor/src/runtime/read/node.ts`

当前这些解析函数虽然是纯函数，但暂时不能直接移动：

- `resolveNodeRole`
- `resolveNodeTransform`
- `resolveNodeConnect`
- `resolveNodeEnter`

原因不是它们不纯，而是它们依赖 editor 的 `NodeDefinition` / `NodeRegistry` 模型。

### 根本问题

目前 node type 的一部分领域元数据还在 editor：

- `role`
- `connect`
- `enter`
- `canResize`
- `canRotate`

如果长期看这些元数据本来就是节点领域定义，那么它们应该进 core。

### 最终目标

有两种长期最优路径，只能选一种，不要长期混用：

1. `NodeDefinition` 的领域元数据整体进入 core
   - 那么这些 resolver 一起下沉到 core。
2. editor 永久持有 registry 元数据
   - 那么 core 不应该再直接依赖这些 resolver。
   - editor 应把 role/transform/connect capability 作为适配结果传给 core。

从长期最优看，更推荐方案 1。

---

## 5.3 node text 文件应拆成“语义”和“DOM 测量”两层

目标文件：

- `packages/whiteboard-editor/src/features/node/text.ts`

这里当前混了两类内容：

### 应该下沉到 core 的内容

- `isTextNode`
- `readTextWidthMode`
- `setTextWidthMode`
- `isTextContentEmpty`
- 与 text width mode 有关的纯语义常量

### 必须留在 editor 的内容

- `ensureTextMeasureElements`
- `measureTextSizeFromSource`
- 基于 DOM/computed style 的文本测量

### 最终目标

拆成：

- core: `node/textModel.ts` 或并入 `packages/whiteboard-core/src/node/text.ts`
- editor: `features/node/textMeasure.ts`

不能继续把“文本节点语义”和“DOM 测量宿主逻辑”混在一个文件里。

---

## 6. 只抽纯函数层，不整文件搬的模块

## 6.1 node projection 的纯 patch 投影应进 core

目标文件：

- `packages/whiteboard-editor/src/features/node/projection/store.ts`

这个文件现在混着两层职责：

### editor 应保留

- `createNodeProjectionStore`
- `createNodeProjectionRuntime`
- preview/hidden 的 store 写入
- `rafStore` / staged store 封装

### 应抽到 core 的纯层

- `applyRectPatch`
- `applyNodePatch`
- `projectNodeItem`

必要时还可进一步抽出：

- projection patch 的比较与归一化

### 为什么不能整文件搬

因为这个文件强依赖：

- `@whiteboard/engine`
- `createRafKeyedStore`

它整体仍是 editor projection host。
但“patch 如何作用到 node/rect”不该继续留在 editor。

### 最终目标

新增 core 模块，例如：

- `packages/whiteboard-core/src/node/projection.ts`

只负责：

- `projectNode`
- `projectNodeRect`
- `projectNodeView`

editor 再调用这些纯函数，把结果包进自己的 projection store。

---

## 6.2 edge projection 的纯 patch 投影应进 core

目标文件：

- `packages/whiteboard-editor/src/features/edge/projection.ts`

当前同样混了两层：

### editor 应保留

- `createEdgeProjection`
- hint/patch store
- `writePatch`
- `writeRoute`
- `clearPatch`
- `clearHint`

### 应抽到 core 的纯层

- `isHintEqual`
- `isEdgeEndPatchEqual`
- `applyPatch`
- `projectEdgeItem`
- `toEdgeProjectionEntry` 对应的 patch entry 归一化逻辑

### 特别注意

这里还和 edge connect 存在模型分裂：

- connect 模块有自己的 hint
- projection 模块又定义了一份 hint

这两者最终必须统一为 core 的单一 edge draft/projection 语义。

### 最终目标

新增：

- `packages/whiteboard-core/src/edge/projection.ts`

只处理：

- `Edge + EdgePatch -> Edge`
- hint equality / patch equality / patch normalize

editor 继续负责 projection store 的宿主实现。

---

## 6.3 node patch 编译 helper 应进入 core

目标文件：

- `packages/whiteboard-editor/src/features/node/patch.ts`

这份文件的职责是：

- 把字段修改编译成 `NodeUpdateInput`
- 把样式 patch / data patch 编译成 schema update

它本质属于：

- schema 更新编译
- node update helper

这不应该长期留在 editor feature 目录里。

### 最终目标

迁到：

- `packages/whiteboard-core/src/schema`

或：

- `packages/whiteboard-core/src/node/updateHelpers.ts`

原则是：

- 只要逻辑不依赖 editor registry、runtime、DOM，就不该继续放在 editor。

---

## 6.4 transform preview -> commit patch 转换应进入 core

目标位置：

- `packages/whiteboard-editor/src/features/node/transform/interaction.ts`

当前 `toPatch` 做的是：

- `TransformPreviewPatch -> NodeFieldPatch`

这实际上不是 interaction host 逻辑，而是 transform 领域提交转换。

### 最终目标

并入：

- `packages/whiteboard-core/src/node/transform.ts`

例如暴露：

- `toTransformCommitPatch(node, preview)`

这样 editor interaction 只负责：

- 收集 pointer 输入
- 调用 core 生成 preview
- 调用 core 转换 commit patch
- 提交 commands

---

## 7. 明确不应下沉的模块

## 7.1 `runtime/interaction/snap.ts` 应留在 editor

目标文件：

- `packages/whiteboard-editor/src/runtime/interaction/snap.ts`

虽然它内部大量调用 core 算法，但它本身的职责非常清晰：

- 读取 editor zoom
- 通过 editor query 提供候选
- 管理 guides 的 runtime store

core 算法已经下沉完成：

- node snap 算法在 core
- edge connect target 算法在 core

因此这里不是遗漏，而是合理的 runtime bridge。

---

## 7.2 `features/edge/hoverProcessor.ts` 应留在 editor

目标文件：

- `packages/whiteboard-editor/src/features/edge/hoverProcessor.ts`

原因：

- 包含 hover host 行为
- 包含 projection 写入
- 包含 mode gating
- 包含 runtime 调度

它不是领域层。

---

## 7.3 `features/mindmap/drag/projection.ts` 应留在 editor

目标文件：

- `packages/whiteboard-editor/src/features/mindmap/drag/projection.ts`

原因：

- mindmap drag 的纯 session/projection 规则已经在 core
- 这里仅是 overlay store

这个边界已经基本正确，不应该再把 overlay store 下沉。

---

## 7.4 `runtime/read/frame.ts` 应留在 editor

目标文件：

- `packages/whiteboard-editor/src/runtime/read/frame.ts`

它只是 core/document 的很薄一层 read adapter：

- `scope`
- `hasNode`
- `hasEdge`

这类“面向 editor read API 的薄包装”本来就应该留在 editor。
如果觉得薄，可以进一步 inline，但不属于 core 漏洞。

---

## 8. 最终目标目录建议

建议在 `whiteboard-core` 增加或扩展如下模块：

- `packages/whiteboard-core/src/edge/connect.ts`
  - 吸收 editor 侧 edge connect draft/session/commit/hint 纯模型
- `packages/whiteboard-core/src/edge/projection.ts`
  - 纯 edge patch/projection/hint 比较逻辑
- `packages/whiteboard-core/src/selection/press.ts`
  - selection press input/target/plan/action
- `packages/whiteboard-core/src/node/projection.ts`
  - node patch -> projected node/rect/view
- `packages/whiteboard-core/src/document/frameGate.ts`
  - frame scope press/move gate 决策

必要时补充：

- `packages/whiteboard-core/src/node/textModel.ts`
- `packages/whiteboard-core/src/node/updateHelpers.ts`

---

## 9. editor 最终保留的职责

完成下沉后，editor 里的 interaction 应收敛为：

- 从 DOM 读取原始事件
- 从 viewport/pick/frame/tool/edit 读取宿主上下文
- 组装 core 所需的语义输入
- 调用 core resolver
- 把返回的 plan/draft/projection 写入：
  - projection store
  - selection state
  - commands

editor 不再直接持有：

- selection press rules
- selection press target resolver
- selection press plan builder
- edge connect draft state 模型
- edge connect hint/commit builder
- edge patch / node patch 的纯投影算法

---

## 10. 一步到位的实施顺序

如果严格按长期最优推进，不做兼容层，推荐顺序如下：

### 第一步

重构 edge connect 边界：

- 把 `features/edge/connect.ts` 迁入 core
- 合并 `EdgeConnectHint` 与 `EdgeProjectionHint`
- editor 的 `features/edge/connect/interaction.ts` 只保留输入适配、projection 写入、command commit

### 第二步

重构 selection press 边界：

- 把 `pressRules.ts`、`pressTarget.ts`、`pressPlan.ts` 和 plan/action 类型迁入 core
- editor 定义一个最小语义输入适配层
- `features/selection/interaction.ts` 只消费 core plan

### 第三步

抽离 node/edge projection 纯层：

- 在 core 增加 `node/projection.ts`
- 在 core 增加 `edge/projection.ts`
- editor projection 文件只保留 store/runtime 包装

### 第四步

补齐 frame gate 与文本语义拆分：

- frame gate 迁到 core/document
- text model 迁到 core/node
- DOM 测量留在 editor

### 第五步

最后再处理 node registry 元数据归属：

- 决定 `NodeDefinition` 的领域元数据是否整体进入 core
- 一旦进入 core，`resolveNodeRole / resolveNodeTransform / resolveNodeConnect / resolveNodeEnter` 一并下沉

---

## 11. 优先级结论

### P0

- `features/edge/connect.ts`
- `runtime/selection/pressRules.ts`
- `runtime/selection/pressTarget.ts`
- `runtime/selection/pressPlan.ts`
- `types/internal/selection.ts` 中的 interaction plan 类型

### P1

- `features/node/projection/store.ts` 的纯投影函数层
- `features/edge/projection.ts` 的纯投影函数层
- `runtime/input/pointer/gate.ts`

### P2

- `features/node/patch.ts`
- `features/node/text.ts` 的纯语义层
- `runtime/read/node.ts` 的 registry resolver 层

---

## 12. 最终判断

当前 `whiteboard-editor` 里最明显的 core 泄漏，不是某个单独 feature 的命名问题，而是这三条底层模型边界还没彻底对齐：

- edge connect draft/commit 模型还在 editor
- selection press plan 还在 editor
- node/edge projection 的纯 patch 应用还在 editor

只要这三块还没收回 core，editor 就仍然会显得“交互很重、session 很多、projection 和规则缠在一起”。

真正的长期最优，不是继续在 editor 里整理 interaction 文件，而是把这三块纯领域层先抽走。

