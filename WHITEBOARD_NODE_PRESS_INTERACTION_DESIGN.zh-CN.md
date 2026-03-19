# Whiteboard Node Press 交互设计

## 结论

`text/sticky` 这类可编辑节点在非编辑态不应该被当成“文字表面”，而应该被当成“对象表面”。

长期最优设计不是：

1. `pointerdown` 立刻决定“这是编辑还是拖拽”
2. 或者在 display 态允许原生文字选区

而是：

1. `pointerdown` 先进入一个极短暂的 `press`
2. 再根据“时间阈值 + 位移阈值”分流为：
   - `click`
   - `node-drag`
   - `node-origin marquee`
3. `edit` 只由 `click finalize` 进入，不由 `pointerdown` 直接进入

这套模型更接近 Miro，也更符合白板心智：

1. display 态是 object-first
2. edit 态才是 text-first
3. `press` 期间不显示 toolbar / handles
4. 蓝色 outline 只在真实 `drag` 成立后出现
5. 从 node 表面按住后触发的是特殊框选，不是文字选择

## 当前落地状态

以下内容以当前代码为准。

下文仍然保留了一部分设计演进过程里的历史分析；如果出现与旧实现相关的 `SelectionBox`、旧阈值或旧字段描述，以本节和“术语 / 状态模型”章节为准。

当前已经落地的收敛点：

1. `SelectionBox` 已经收敛为共享的 `Marquee`
2. background marquee 和 node-origin marquee 共用同一个 runtime
3. 两类 marquee 的差异只通过 policy 表达：
   - `touch`
   - `contain + exclude`
4. engine/core 侧只保留纯查询：
   - `idsInRect(rect, { match, exclude })`
5. `press` 只向 UI 暴露一个最小 phase：

```ts
type NodePress = 'repeat' | 'retarget' | 'hold' | null
```

6. `press` 的 pending 细节不再暴露给 UI
7. `hold delay` 和 `drag distance` 已经从 engine/core config 收回到 React runtime
8. 当前统一放在：
   - `packages/whiteboard-react/src/runtime/interaction/index.ts`
9. group 的 double click 入口已经并回 node press runtime，不再分散在 scene layer

## 目标行为

### 1. 快速点击

行为：

1. `pointerdown`
2. 没有超过 hold delay
3. 没有超过 drag distance
4. `pointerup`

结果：

1. 普通 click finalize
2. 显示 `node toolbar + transform handles`

### 2. 时间阈值内移动

行为：

1. `pointerdown`
2. 在 hold delay 内先移动超过 drag distance

结果：

1. 启动 `node-drag`
2. 只显示淡蓝 outline
3. 不显示 toolbar / handles

### 3. 按住超过时间阈值后再移动

行为：

1. `pointerdown`
2. 在小范围内保持到超过 hold delay
3. 然后开始移动

结果：

1. 启动一种从 node 表面发起的特殊 marquee
2. 这个 marquee 不是普通背景框选
3. 它必须把 node 整块包进去才算命中
4. 起始 node 不参与这个 marquee 的命中集合

### 4. 蓝色 outline 的显示时机

规则：

1. `pointerdown` 时不显示
2. `press` 期间不显示
3. 只有真正进入 `node-drag` 后才显示

这点必须和 `press` 明确拆开。

## 为什么当前实现手感不对

当前代码的核心问题，不是参数，而是 display 态的语义本身不对。

### 当前实现的实际语义

1. display 态文本节点自己拦了 `pointerdown`
2. node drag session 显式跳过 editable display target
3. display 态文本仍然是 `cursor: text`
4. 背景框选只能从 background 发起

这会导致：

1. 点在 `text/sticky` 内容区，优先落到“文字表面”
2. 而不是“对象表面”
3. 拖拽和按住后框选都无法自然从 node body 发起

### 当前实现位置

相关文件：

1. `packages/whiteboard-react/src/features/node/registry/defaultNodes.tsx`
2. `packages/whiteboard-react/src/features/node/hooks/drag/session.ts`
3. `packages/whiteboard-react/src/canvas/Marquee.tsx`
4. `packages/whiteboard-react/src/runtime/interaction/index.ts`
5. `packages/whiteboard-core/src/node/hitTest.ts`

当前关键收敛点包括：

1. node body 的 `press / drag / hold -> marquee` 已经统一收敛到 `createNodePressSession`
2. `Marquee` 同时承接 background 入口和 node-origin 入口
3. rect hit 已经支持 `touch` 与 `contain`
4. `press` 对 UI 只暴露最小 phase，而不是一整坨 pending 状态
5. gesture 阈值不再挂在 engine/core config 上

## 设计原则

### 1. display 态必须 object-first

display 态的 `text/sticky` 是白板对象，不是文档段落。

因此：

1. display 态不允许原生文字选区
2. display 态不应该显示 `cursor: text`
3. display 态的 body 本身就应该能发起 drag / hold-marquee

### 2. edit 态才允许 text-first

只有真正进入 `edit` 以后，才应该允许：

1. caret
2. 文本选区
3. 文本输入

### 3. 不在 `pointerdown` 当场决定最终意图

白板对象表面上的 `pointerdown` 不应该立刻拍板：

1. 不是立刻编辑
2. 不是立刻拖拽
3. 不是立刻框选

而是先进 `press`，再根据后续的时间和位移解释意图。

### 4. global interaction 只表示真实 session

`interaction` 应该只描述真实已经成立的全局交互：

1. `viewport-pan`
2. `marquee`
3. `node-drag`
4. `mindmap-drag`
5. `node-transform`
6. `edge-connect`
7. `edge-routing`

不要把 `press` 塞进去。

`press` 只是一次本地手势解释器，不应该成为全局交互模式。

### 5. marquee 必须区分 policy，而不是只有一种 selection box

背景框选和从 node 发起的 hold-marquee 不是一回事：

1. 触发来源不同
2. 命中语义不同
3. origin 处理不同

因此长期最优不是一个固定的 `SelectionBox`，而是一个通用 `marquee`，按 policy 工作。

## 实施前提

这条链路的实现前提不是“先把行为做出来”，而是“先把入口和职责收拢”。

如果继续把逻辑拆散到：

1. renderer
2. `target.ts`
3. drag session
4. selection box
5. 各种零碎 policy / finalize / guard 函数

最后一定会再次膨胀。

因此实现时必须遵守下面这几个前提。

### 1. 单入口优先

node body 的对象表面交互必须尽量收口到一个入口。

推荐入口：

1. `packages/whiteboard-react/src/features/node/components/NodeSceneLayer.tsx`

也就是：

1. `press`
2. `drag`
3. `node-origin marquee`

这三条链路都从 node scene 层统一进入。

不要让：

1. `defaultNodes.tsx`
2. `NodeItem.tsx`
3. 各类 node renderer

分别各自决定是 drag、edit 还是 marquee。

### 2. 单运行时优先

`press` 必须是唯一的一层手势解释 runtime。

不应该出现：

1. `textPress`
2. `stickyPress`
3. `editablePress`
4. `nodeClickIntent`
5. `nodeTextIntent`

这类平行概念。

长期最优只保留一个：

1. `press`

它负责解释 node body 的按下手势。

### 3. 单 marquee 抽象优先

不要保留：

1. 一个普通 `SelectionBox`
2. 再新增一个 `NodeSelectionBox`
3. 再新增一个 `ContainSelectionBox`

长期最优必须是：

1. 一个 `marquee`
2. 多个 policy

也就是：

1. 渲染层只有一个 marquee rect
2. 命中语义由 policy 控制

### 4. 少 API 优先

如果一个能力能通过已有 API 扩展参数表达，就不要新增平行 API。

例如节点 rect 命中读取：

1. 推荐扩展 `idsInRect(rect, options)`
2. 不推荐新增 `idsContainedByRect`
3. 不推荐新增 `idsTouchedByRect`
4. 不推荐新增 `idsInRectContain`

### 5. 少文件优先

如果一个能力仍然只有单一消费者，就不要为了“结构看起来干净”把它拆成多个文件。

例如：

1. `press` 逻辑在第一版只有 node scene 一个入口时，可以先收敛在一个 runtime 文件内
2. 不要一开始就拆出 `policy.ts`、`guards.ts`、`finalize.ts`、`constants.ts`

拆分条件应该是：

1. 有第二个真实消费者
2. 或者逻辑边界已经非常稳定

在那之前，宁可把相关私有小函数留在同一个文件里。

### 6. renderer 只做标注和编辑，不做对象表面决策

renderer 长期只应该负责：

1. 标注 `field`
2. 渲染 display
3. 渲染 editor

renderer 不应该再负责：

1. display 态拦截 node body 的 `pointerdown`
2. 决定这次是不是 drag
3. 决定这次是不是 node-origin marquee

## 命名与 API 规则

这条链路如果命名开始变长，后面一定会迅速失控。

原则很简单：

1. 名词短
2. 动词短
3. 少层级
4. 少平行词

### 1. 推荐命名

推荐使用这些短词：

1. `press`
2. `drag`
3. `marquee`
4. `match`
5. `exclude`
6. `field`
7. `start`
8. `move`
9. `up`
10. `cancel`

### 2. 不推荐命名

不推荐这类越来越长的名字：

1. `nodePressInteractionSession`
2. `selectionBoxPolicy`
3. `editableDisplayDragGuard`
4. `nodeSelectionFinalizeResolver`
5. `textEditablePointerIntent`

这些名字的问题不是长，而是职责已经开始散掉了。

### 3. 推荐的 interaction 命名

长期建议：

1. `selection-box` -> `marquee`
2. `viewport-pan` -> `pan`
3. `node-transform` -> `transform`

理由：

1. 语义更稳
2. 更短
3. 不会把实现细节写死在 mode 名称里

### 4. 推荐的 read API 形态

推荐：

```ts
idsInRect(rect, {
  match: 'touch' | 'contain',
  exclude?: readonly NodeId[]
})
```

不推荐：

```ts
idsInRect(rect)
idsContainedByRect(rect)
idsTouchedByRect(rect)
```

前者更收敛，后者会一直新增平行方法。

### 5. 推荐的写入 API 边界

这条链路不应该引入新的顶层 commands 命名空间。

长期最优仍然应该复用：

1. `instance.commands.selection.*`
2. `instance.commands.edit.*`
3. `instance.commands.node.*`

不建议新增：

1. `instance.commands.press.*`
2. `instance.commands.marquee.*`
3. `instance.commands.intent.*`

`press` 和 `marquee` 是 runtime/session 概念，不是 document command 域。

### 6. instance API 收敛规则

如果一个能力只有当前 React 画布消费，不要急着挂到 `instance`。

例如：

1. `press` runtime 第一版只服务于 `NodeSceneLayer`
2. 这时它应该是 feature local runtime，而不是 `instance.press`

只有在出现多个真实消费者时，才考虑提升。

这能避免把 instance 顶层继续做大。

## 术语

### `press`

一次 `pointerdown -> up/cancel` 期间的短暂解释状态。

它不是业务状态，不写进 document。

UI 只允许读取一个最小 phase，不应该读取 pending 细节。

### `click finalize`

在没有进入 drag、也没有进入 marquee 的前提下，对这次 `press` 的最终解释。

### `hold delay`

从 `pointerdown` 到允许进入 `node-origin marquee` 的时间阈值。

建议默认值：

1. `700ms`

当前实现：

1. React runtime 本地常量
2. 不进入 engine/core config

### `drag distance`

从 `pointerdown` 到判定为 drag 的位移阈值。

建议默认值：

1. `3px`

当前实现：

1. React runtime 本地常量
2. 不进入 engine/core config

### `background marquee`

从画布空白处发起的普通框选。

语义：

1. `touch`

### `node-origin marquee`

从 node 表面按住后发起的特殊框选。

语义：

1. `contain`
2. `exclude origin`

### `origin node`

发起 `node-origin marquee` 的那个 node。

它不参与这个 marquee 的动态命中集合。

更准确地说：

1. origin node 永远不会被 `node-origin marquee` 新命中
2. 它不是这次 marquee 的候选项

## 状态模型

### 持久状态

#### `selection`

只负责：

1. 当前选中了谁

不负责：

1. 这次点击是不是“第二次点击”
2. 这次手势是不是要编辑

#### `edit`

只负责：

1. 当前是不是在编辑哪个节点、哪个字段

推荐保持当前模型：

```ts
type EditTarget =
  | { nodeId: NodeId; field: 'text' | 'title' }
  | null
```

#### `interaction`

只负责已经成立的真实 session。

长期最优命名建议：

```ts
type InteractionMode =
  | 'idle'
  | 'pan'
  | 'marquee'
  | 'node-drag'
  | 'mindmap-drag'
  | 'transform'
  | 'edge-connect'
  | 'edge-routing'
```

说明：

1. 当前代码里的 `selection-box` 长期更适合重命名为 `marquee`
2. 当前代码里的 `viewport-pan` / `node-transform` 长期也可以进一步变短
3. 如果短期不改名，语义上也应该先把它当作 `marquee`

### 局部运行时状态

#### `press`

`press` 只存在于 node body 的一次按下期间。

对 UI 暴露的最小模型：

```ts
type NodePress = 'repeat' | 'retarget' | 'hold' | null
```

私有 pending 模型才需要更完整的字段：

```ts
type PendingPress = {
  pointerId: number
  nodeId: NodeId
  field?: 'text' | 'title'
  selectionMode: 'replace' | 'add' | 'subtract' | 'toggle'
  startClient: { x: number; y: number }
  startWorld: { x: number; y: number }
  clickSelectedNodeIds: readonly NodeId[]
  dragSelectedNodeIds: readonly NodeId[]
  holdElapsed: boolean
}
```

职责：

1. public `NodePress` 只服务于 UI chrome 显隐
2. private `PendingPress` 才负责记录 `pointerdown` 快照
3. 在 move / up 时解释为 click / drag / marquee

不负责：

1. 真正的 drag preview
2. 真正的 marquee preview

这些都属于真实 interaction session。

## 判定时序

### 总览

```text
idle
  -> pointerdown on node body
  -> press

press
  -> move > dragDistance before holdDelay
     -> node-drag
  -> holdDelay elapsed
     -> marquee-armed
  -> pointerup before drag/marquee
     -> click finalize

marquee-armed
  -> move
     -> node-origin marquee
  -> pointerup without move
     -> click finalize
```

这里最重要的一点：

1. hold delay 到了，不等于已经进入 marquee
2. 只是代表“可以进入 node-origin marquee”
3. 真正进入 marquee 仍然要等后续 move

这样可以避免长按不动就进入怪异状态。

### 1. `pointerdown`

发生在非编辑态 node body 上时：

1. 创建 `press`
2. 记录 `selectedBeforeDown`
3. 记录 `field`
4. 记录 `selectionMode`
5. 启动 hold timer
6. 隐藏 toolbar / handles
7. 不显示 outline
8. 不修改 selection
9. 不进入 edit
10. 不进入 drag

### 2. 在 hold delay 内先移动超过 drag distance

结果：

1. 直接启动 `node-drag`
2. 结束 `press`

进入 drag 时：

1. 如果当前 node 还不是这次 drag 的 anchor selection，则在 drag 启动时做 selection 更新
2. 显示淡蓝 outline
3. 不显示 toolbar / handles

### 3. hold delay 到期

结果：

1. `press.holdElapsed = true`
2. 仍然不显示 outline
3. 仍然不显示 toolbar / handles
4. 仍然不修改 selection

此时只是进入 `marquee-armed`，还不是实际 marquee。

### 4. hold 之后发生 move

结果：

1. 启动 `node-origin marquee`
2. 结束 `press`

其 policy 必须是：

1. `match = contain`
2. `exclude = originNodeId`

### 5. `pointerup`

#### 情况 A：已经进入 `node-drag`

1. 按 drag commit 逻辑结束

#### 情况 B：已经进入 `node-origin marquee`

1. 按 marquee finalize 逻辑结束

#### 情况 C：始终停留在 `press`

1. 做 `click finalize`

## Click Finalize 规则

这是最关键的规则。

### 为什么不能只看当前 `selection`

因为 edit 的判定需要的是：

1. `pointerdown` 之前它是否已经单选

而不是：

1. `click` 发生时当前 selection 是什么

当前 selection 在 `pointerdown -> click` 过程中可能已经被改过。

所以 edit 的判定必须依赖：

1. `selectedBeforeDown`

而不是直接读当前 `selection`。

### 推荐规则

#### 如果 `selectionMode !== 'replace'`

这次 click 只做 selection 操作，不进入 edit。

原因：

1. 带 modifier 的 click 本质上是选择操作
2. 不应该和编辑复用同一条路径

#### 如果 `selectionMode === 'replace'`

规则如下：

1. `selectedBeforeDown === false`
   - `selection.replace([nodeId])`
2. `selectedBeforeDown === true && field !== undefined`
   - `edit.start(nodeId, field)`
3. `selectedBeforeDown === true && field === undefined`
   - 保持现有 selection，不进入 edit

也就是说：

1. 第一次 click 负责选中
2. 已经单选后的下一次 click 才进入编辑

这条规则不需要引入任何额外的 document 状态。

## 两种 Marquee Policy

### 1. Background Marquee

来源：

1. 画布空白区

命中语义：

1. `touch`

origin：

1. 无

这是当前 `SelectionBox` 的语义。

### 2. Node-Origin Marquee

来源：

1. node body 长按后移动

命中语义：

1. `contain`

origin：

1. `exclude origin`

### 为什么必须把这两种 policy 拆开

因为它们在产品语义上不同：

1. background marquee 是“我在空白处扫一片”
2. node-origin marquee 是“我从一个对象表面发起次级选择动作”

它们不应该共享同一个固定命中策略。

## Read API 设计

当前只有：

```ts
instance.read.index.node.idsInRect(rect)
```

这不足以支持长期最优设计，因为它只有一种命中语义。

### 不推荐

不推荐继续加一堆平行 API：

1. `idsInRect`
2. `idsContainedByRect`
3. `idsTouchedByRect`

这会让 API 越来越散。

### 推荐

长期最优建议是让 `idsInRect` 支持 policy 参数：

```ts
idsInRect(rect, {
  match: 'touch' | 'contain',
  exclude?: readonly NodeId[]
})
```

这样有几个好处：

1. API 更短
2. 语义更集中
3. 背景 marquee 和 node-origin marquee 共用同一个 read 入口
4. 后续如果还要加其他命中策略，也不需要新增一排方法

### 推荐默认值

```ts
idsInRect(rect, { match: 'touch' })
```

node-origin marquee 则是：

```ts
idsInRect(rect, {
  match: 'contain',
  exclude: [originNodeId]
})
```

## 视觉规则

### `idle + selected`

显示：

1. toolbar
2. handles

### `press`

显示：

1. 不显示 toolbar
2. 不显示 handles
3. 不显示 outline

### `node-drag`

显示：

1. 只显示淡蓝 outline
2. 不显示 toolbar
3. 不显示 handles

### `background marquee`

显示：

1. marquee rect
2. 命中节点的预览高亮
3. 不显示 toolbar
4. 不显示 handles

### `node-origin marquee`

显示：

1. marquee rect
2. 命中节点的预览高亮
3. origin node 不参与命中高亮
4. 不显示 toolbar
5. 不显示 handles

### `edit`

显示：

1. editor
2. 不显示 toolbar
3. 不显示 handles

## display 态的输入规则

### 不允许的行为

display 态不允许：

1. 原生文字选区
2. 原生 caret
3. `cursor: text`

### 允许的行为

display 态只允许：

1. click 选中
2. click finalize 进入 edit
3. 快速 move 拖拽
4. hold 后发起 node-origin marquee

### editor 态

只有 editor 态才允许：

1. 文字选中
2. caret
3. 输入法
4. 内容编辑

## 模块职责拆分

### 1. `features/node/press`

建议新增一个很薄的 press runtime。

职责：

1. 持有 `press`
2. 处理 hold timer
3. 决定 click / drag / marquee 分流

不负责：

1. drag 数学
2. marquee 命中算法

### 2. `features/node/drag`

保留为真实 drag session。

职责：

1. drag start
2. drag preview
3. drag commit

### 3. `canvas/marquee`

长期建议把当前 `SelectionBox` 抽象成 `Marquee`。

职责：

1. 承载背景 marquee
2. 承载 node-origin marquee
3. 使用统一的 rect 渲染层
4. 通过 policy 区分命中语义

### 4. `canvas/target.ts`

职责应该收敛为：

1. 读 field target
2. 判断 editor target
3. 判断 input-ignore target

不应该再用：

1. “editable display target == 一律阻止 drag”

display target 只是说明“这里将来可以进入 edit”，不说明“这里不能发起 object press”。

### 5. 推荐的最少文件落点

如果按“功能先收敛、文件尽量少”的原则，第一版建议尽量只落在这几处：

1. `packages/whiteboard-react/src/features/node/components/NodeSceneLayer.tsx`
2. `packages/whiteboard-react/src/features/node/hooks/drag/session.ts`
3. `packages/whiteboard-react/src/canvas/SelectionBox.tsx` 或直接升级为 `Marquee.tsx`
4. `packages/whiteboard-react/src/canvas/target.ts`
5. `packages/whiteboard-react/src/features/node/registry/defaultNodes.tsx`

如果需要新增 runtime，优先接受一个单文件：

1. `packages/whiteboard-react/src/features/node/press.ts`

而不是一开始就新增：

1. `press/policy.ts`
2. `press/finalize.ts`
3. `press/guards.ts`
4. `press/constants.ts`

第一版先把链路收进一个地方，后面确认稳定了再考虑拆。

## 推荐实现落点

### 事件入口

仍然建议放在 node scene 层统一处理，而不是分散在每个 node renderer 里：

1. `packages/whiteboard-react/src/features/node/components/NodeSceneLayer.tsx`

原因：

1. `press`、`drag`、`marquee` 都属于对象表面交互
2. 不应该让每个 renderer 自己决定全局交互走向

### renderer 侧

renderer 只负责：

1. 标注 editable field
2. 渲染 editor
3. 渲染 display

renderer 不应该负责：

1. 在 display 态截断 node body 的 `pointerdown`
2. 决定这次是 drag 还是 marquee

### marquee

长期建议：

1. 当前 `SelectionBox.tsx` 语义重命名为 `Marquee.tsx`
2. background 和 node-origin 共用一套可配置 marquee runtime

## 参数建议

### `holdDelay`

建议：

1. `180ms`

理由：

1. 足够和 click 拉开
2. 不会拖得太慢

### `dragDistance`

建议：

1. `4px`

如果高 DPI 或触控板下误触偏多，可以到：

1. `5px`
2. `6px`

### `contain` 判定

建议：

1. 使用 world-space rect 全包含
2. 不使用 touch/intersect 近似

如果后续要抗像素抖动，可加很小的 epsilon，但不建议第一版就加复杂补偿。

## 分阶段实施方案

下面这套实施方案的目标不是“最快做出结果”，而是“每一阶段都让结构更收敛”。

判断标准只有两个：

1. 交互是否更接近目标行为
2. 入口和 API 是否变少、变集中

### 阶段 0：先收口，再改行为

目标：

1. 明确 node surface 的唯一入口
2. 移除 display 态上分散的对象交互决策

本阶段只做结构准备，不追求一次把所有行为做完。

具体动作：

1. 确认 `NodeSceneLayer` 是 node body 的唯一对象表面入口
2. 清理 `defaultNodes.tsx` 里 display 态对 object press 的拦截
3. 清理 `target.ts` 中“editable display target 一律禁止 drag”的旧语义
4. 保留 editor 内部的输入隔离逻辑

产出：

1. display renderer 只保留 field 标注和 editor 渲染
2. object surface 交互准备收口到 scene 层

本阶段不新增新的 commands API。

### 阶段 1：落地 `press`，只解决 click / drag

目标：

1. 建立唯一的手势解释器
2. 先把 click / drag 收到同一条链路

推荐落点：

1. `NodeSceneLayer.tsx`
2. 一个很薄的 `press` runtime 文件

本阶段不要同时做 hold-marquee。

具体动作：

1. 在 node body `pointerdown` 时创建 `press`
2. 记录 `selectedBeforeDown`
3. 记录 `field`
4. 记录 `selectionMode`
5. 在短距离移动内保持 `press`
6. 在时间阈值前先过位移阈值时启动 `node-drag`
7. 没进入 drag 的 `pointerup` 统一走 click finalize

click finalize 只做：

1. 首次 click 选中
2. 已单选后二次 click 进入 edit
3. modifier click 只做 selection

本阶段结束时应满足：

1. display 态 body 可直接拖拽
2. display 态不再出现“像文档一样先选字”
3. edit 仍然只由 click finalize 进入

本阶段不做的事情：

1. 不做 hold-marquee
2. 不做 `SelectionBox -> Marquee` 重命名
3. 不改 node index API

原因：

1. 先把最核心的 click / drag 二分问题收口
2. 避免第一阶段同时引入太多变量

### 阶段 2：引入 `node-origin marquee`

目标：

1. 把 hold 语义接到 `press` 上
2. 从 node surface 发起特殊框选

本阶段依赖：

1. 阶段 1 的 `press` 已经稳定

具体动作：

1. 给 `press` 增加 hold timer
2. hold 到时只设置 `holdElapsed = true`
3. 不在 hold 到时直接进入 marquee
4. 只有 hold 后再发生 move，才启动 `node-origin marquee`
5. `pointerup` 若仍未 move，仍按 click finalize 处理

视觉规则同步落地：

1. `press` 不显示 outline
2. `node-drag` 才显示 outline
3. `node-origin marquee` 显示 marquee rect，不显示 toolbar / handles

本阶段结束时应满足：

1. 快速 move 仍然优先 drag
2. 长按后再 move 才进入特殊 marquee
3. 这两条路径都不需要 renderer 自己做额外判断

### 阶段 3：统一 marquee 抽象和命中语义

目标：

1. 不再保留“背景框选一套、node-origin 再来一套”的分叉实现
2. 用一个 marquee runtime + policy 统一两条链路

具体动作：

1. 把当前 `SelectionBox` 升级为 `Marquee`
2. marquee runtime 接收 policy
3. 背景 marquee 使用 `{ match: 'touch' }`
4. node-origin marquee 使用 `{ match: 'contain', exclude: [originNodeId] }`
5. 所有 rect 预览、flush、finalize 走同一条链路

这一阶段才推荐扩展 read API：

```ts
idsInRect(rect, {
  match: 'touch' | 'contain',
  exclude?: readonly NodeId[]
})
```

本阶段结束时应满足：

1. 只有一个 marquee 渲染层
2. 只有一个 marquee runtime
3. 差异只存在于 policy

### 阶段 4：收尾清理与命名收敛

目标：

1. 删掉旧的实现痕迹
2. 收敛命名
3. 让最终 API 和目录形态长期可维护

具体动作：

1. 删除 display 态对旧 target 判定的特殊分支
2. 删除已经废弃的小 guard / helper
3. 统一 `selection-box` 到 `marquee` 的语义命名
4. 评估 `viewport-pan -> pan`、`node-transform -> transform` 是否一起收敛
5. 把只被一个模块使用的私有函数尽量内联回主文件

这一阶段的核心不是“再做新功能”，而是：

1. 把第一到第三阶段留下的临时兼容形态清理掉

## 每阶段的目录与 API 约束

为避免重构过程中越改越散，每阶段都应遵守下面这些限制。

### 1. 不新增顶层 instance namespace

不新增：

1. `instance.press`
2. `instance.marquee`
3. `instance.intent`

继续复用：

1. `instance.commands.selection`
2. `instance.commands.edit`
3. `instance.commands.node`
4. `instance.read.index.node`
5. `instance.interaction`

### 2. 不新增同义平行 API

例如 rect 命中能力：

1. 允许扩展现有 `idsInRect`
2. 不允许再并列新增多个同义方法

### 3. 不把行为判断下沉到各 renderer

禁止：

1. `TextNodeRenderer` 有一套 click/drag 判定
2. `StickyNodeRenderer` 再有一套
3. `GroupNodeRenderer` 再有一套

对象表面行为必须在 scene/runtime 层统一解释。

### 4. 新增文件必须能解释“为什么不能内联”

如果新增一个文件，必须满足至少一个条件：

1. 有第二个真实消费者
2. 主文件已经因为两个不同职责而明显失真
3. 该文件会成为稳定公共边界

否则优先内联。

## 推荐的最终形态

如果全部收敛完成，长期最优的形态应该接近下面这样：

### 目录层面

核心只保留几条主线：

1. `features/node/press.ts`
2. `features/node/hooks/drag/session.ts`
3. `canvas/Marquee.tsx`
4. `canvas/target.ts`
5. `features/node/components/NodeSceneLayer.tsx`

而不是：

1. `press/policy.ts`
2. `press/finalize.ts`
3. `press/guards.ts`
4. `marquee/policy.ts`
5. `marquee/finalize.ts`
6. `marquee/runtime.ts`

### API 层面

尽量只保留这些短接口：

```ts
instance.commands.selection.replace(nodeIds)
instance.commands.edit.start(nodeId, field)
instance.commands.edit.clear()
instance.read.index.node.idsInRect(rect, { match, exclude })
```

以及 runtime 内部的：

```ts
press.start(...)
press.move(...)
press.up(...)
press.cancel()
```

如果出现需要继续发明更多名字，通常说明职责又开始散了。

## 手工验证清单

### Click

1. 未选中的 `sticky` 单击 => 只选中，不编辑
2. 已单选的 `sticky` 再单击 => 进入编辑
3. `shift/cmd/ctrl/alt` click => 只做 selection，不进入编辑

### Drag

1. 在 `text/sticky` 内容区快速移动 => 进入 drag
2. drag 成立前不显示 outline
3. drag 成立后只显示 outline，不显示 toolbar / handles

### Node-Origin Marquee

1. 在 `text/sticky` 上按住超过 hold delay 再移动 => 进入 marquee
2. 命中语义必须是 contain
3. origin node 不参与命中
4. 普通背景 marquee 仍然保持 touch 语义

### Edit

1. editor 内部仍然允许正常文字选区和输入
2. editor 内部 `pointerdown` 不触发 drag
3. editor 外部 click 能正常退出编辑

### 容器 / group

1. container 内部行为和画布顶层行为一致
2. node-origin marquee 只在当前 container 范围内取候选集

## 非目标

当前这份设计明确不追求：

1. 在 display 态直接选中文字
2. 在同一块 display 表面同时支持“拖 node”和“选字”
3. 用当前 selection 的实时值直接判断是不是进入 edit

这些都会把 object-first 语义重新拉回 text-first，长期只会继续复杂化。

## 一句话版本

最符合 Miro 心智、也最符合职责分离的设计是：

1. 非编辑态 `text/sticky` 是 object surface
2. `pointerdown` 先进入 `press`
3. 时间阈值内 move => `node-drag`
4. 超过时间阈值后再 move => `node-origin marquee`
5. 没有进入 drag / marquee 的 `pointerup` 才做 click finalize
6. `edit` 只是 click finalize 的结果，不是 `pointerdown` 的结果

这套模型比“display 态允许文本选择”稳定得多，也更接近你观察到的真实产品行为。
