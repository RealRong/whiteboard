# Node Press 漏斗设计

## 结论

`packages/whiteboard-react/src/features/node/press.ts` 的长期最优设计，不是保留一整套 `PressContext / PressSubject / PressAction / PressPlan` 四层正式概念，也不是做成重型 `planner / executor` 框架。

长期最优应该是：

- 思想上采用 `planner / executor`
- 代码上落成更轻的 `ctx -> target -> plan -> run`
- 正式稳定概念只保留两个：
  - `PressTarget`
  - `PressPlan`
- `ctx` 只是文件内部局部快照，不提升成正式领域概念
- `PressAction / PressStep` 直接取消，不再单独命名

一句话说：

`press.ts` 应该是一个“pointerdown 行为翻译器”，而不是“命中判断、selection 特判、group/container 规则、session 启动、preview 控制”全部揉在一起的大函数集合。

## 前提

本文明确采用下面这些前提：

- 不在乎重构成本
- 不需要兼容旧实现
- 不保留双路径
- 优先长期最优
- 优先概念最少
- 优先 API 最短且语义稳定
- 优先减少重复快照读取与中间状态变量
- 优先减少小文件数量，而不是为了“拆职责”继续切碎

也就是说，目标不是“在现有结构上小修小补”，而是把 node press 这条链重新收敛成一个长期稳定、可继续扩展的漏斗。

## 现状问题

当前 `press.ts` 的复杂度，主要不是“算法难”，而是多个层次混在一起。

### 1. 命中解析和行为决策耦合

当前同一个分支里同时做了：

- 命中了什么
- 当前 selection 是什么
- 当前 frame scope 是什么
- 当前 node 是否属于 group
- 当前 container 是否应该 drag 还是 marquee
- tap / drag / hold 各做什么

这会导致：

- 同一个事实被多次读取
- 同一个规则被多个分支重复组合
- 代码读起来像“半命中系统 + 半状态机 + 半行为执行器”

### 2. 中间状态变量膨胀

当前文件里存在大量局部中间量，例如：

- `selectedAncestorGroupId`
- `dragCurrentSelection`
- `repeat`
- `dragSelectionIds`
- `dragSelection`
- `dragSelectionEdgeIds`
- `dragFrame`
- `keepChrome`

这些变量本身不一定错，但它们都堆在同一层逻辑里，意味着：

- 事实整理
- 规则判断
- 最终执行

没有明确分段。

### 3. 命中对象没有被压成统一 target

当前 `node / container / selection-box / background` 四类对象，分别维护自己的局部上下文，导致：

- 每一类 target 都重新读一次 selection/frame/scope
- `hold / tap / drag` 的规则只能分散写在各个局部函数里
- group/container 的规则自然会越长越绕

### 4. `hold` 已经被产品规则收敛，但代码没有同步收敛

当前产品方向其实已经很清晰：

- `hold` 的核心行为就是：
  - 清空当前 selection
  - 启动 `contain marquee`

这意味着 `hold` 已经不是一个复杂策略树，而是非常稳定的一条规则。

如果代码里还继续让 `hold` 与旧 selection、多种 repeat 规则、起始 node 排除等逻辑纠缠，就会继续制造不必要复杂度。

### 5. `interaction` 不是问题来源

当前 `runtime/interaction/coordinator.ts` 的职责其实已经比较干净：

- 全局互斥
- pointer capture
- auto pan
- `busy / chrome / mode / space`

这层不需要继续背 node/group/container 规则。

所以 `press.ts` 的复杂度不应该继续往 `interaction` 下沉，而应该在 feature 层内部分段整理。

## 设计目标

目标只有六个：

1. 一次 pointerdown 只读一轮共享快照
2. 命中对象统一收敛成少量 target
3. tap / drag / hold 的规则只在一个地方翻译
4. 执行层不再做二次业务判断
5. 保持外部 API 不变
6. 不引入新的重型抽象和大量小文件

## 为什么是 planner / executor 思想，但不是重型框架

### 正确的部分

`planner / executor` 思想的核心价值在于：

- 先判断应该做什么
- 再执行具体动作

这正是 `press.ts` 目前最需要的收敛方式。

### 不正确的部分

如果把它正式做成：

- `press/planner.ts`
- `press/executor.ts`
- `press/context.ts`
- `press/types.ts`
- `press/helpers.ts`

就会重新回到另一种复杂：

- 小文件太多
- 跳转太多
- 名字太多
- 结构上“看起来架构更强”，但实际理解成本更高

### 最终建议

长期最优不是把 `planner / executor` 做成框架，而是把它收敛成一条轻量流水线：

```ts
ctx -> target -> plan -> run
```

这里真正稳定、值得命名的概念只有：

- `PressTarget`
- `PressPlan`

`ctx` 只是内部局部快照，不是正式公共模型。

## 最终漏斗

长期最优建议把 `press.ts` 收成下面这条主干：

```ts
down(input)
  -> ctx = readPressCtx(instance, input)
  -> target = resolvePressTarget(instance, ctx, input)
  -> plan = resolvePressPlan(ctx, target)
  -> runPressPlan(instance, marquee, drag, ctx, target, plan)
```

这里有两个非常重要的原则：

- `target` 只描述“按下的是谁”，并带上执行时真正需要的 payload
- `plan` 只描述“tap / drag / hold 到底走哪条路”

也就是说：

- payload 放在 `target`
- 路由选择放在 `plan`

不要再造第三层 `action` 或 `step`。

## 最终数据模型

## 1. `PressCtx`

`ctx` 只是文件内部共享快照，不建议提升成正式领域概念。

建议最小形态：

```ts
type PressCtx = {
  event: PointerEvent
  capture: Element
  start: Point
  mode: SelectionMode
  frame: FrameScope
  selected: {
    nodeIds: readonly NodeId[]
    edgeIds: readonly EdgeId[]
    box?: Rect
  }
}
```

说明：

- `event.pointerId` 足够使用，不需要单独平铺 `pointerId`
- `selectionMode` 缩成 `mode`
- `startWorld` 缩成 `start`
- `selectedNodeIds / selectedEdgeIds / selectionBox` 不要平铺，统一收进 `selected`

`ctx` 里不要放：

- `scope`
- `edgeFilter`
- `repeat`
- `selected`
- `canEdit`
- `keepChrome`
- `tapSelection`
- `dragSelectionIds`
- `dragSelectionEdgeIds`
- `dragFrame`

这些都不是共享快照，而是 target 派生结果。

## 2. `PressTarget`

`PressTarget` 是整条链真正稳定的核心概念。

建议先定义两个最小辅助块：

```ts
type PressMarquee = {
  scope?: ReadonlySet<NodeId>
  edgeFilter?: (edgeId: EdgeId) => boolean
}

type PressDrag = {
  frame: Rect
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}
```

再收成下面四类 target：

```ts
type PressTarget =
  | {
      kind: 'background'
      marquee: PressMarquee
    }
  | {
      kind: 'selection'
      chrome: true
      drag: PressDrag
      marquee: PressMarquee
    }
  | {
      kind: 'node'
      nodeId: NodeId
      hitNodeId: NodeId
      chrome: boolean
      select: SelectionInput
      drag: PressDrag
      marquee: PressMarquee
      editField?: EditField
    }
  | {
      kind: 'container'
      nodeId: NodeId
      chrome: boolean
      select: SelectionInput
      drag?: PressDrag
      marquee: PressMarquee
    }
```

### 为什么这版更收敛

它把原来 `PressSubject` 里很多中间字段收掉了。

#### 已删除的字段

- `selected`
- `repeat`
- `canEdit`
- `keepChrome`
- `rect`
- `dragNodeIds`
- `dragEdgeIds`
- `dragFrame`
- `scope`
- `edgeFilter`

#### 删除方式

- `selected / repeat / canEdit / keepChrome`
  - 都只保留为 `resolvePressTarget` 内部局部变量
  - 最终只留下真正执行所需的结果
- `dragNodeIds / dragEdgeIds / dragFrame`
  - 收成一个 `drag`
- `scope / edgeFilter`
  - 收成一个 `marquee`
- `canEdit`
  - 直接压缩成 `editField?`
  - 能编辑时才带字段，不能编辑时不出现

### 为什么 `nodeId` 仍然保留

`nodeId` 看起来与 `drag.nodeIds[0]` 有重复，但它表达的是：

- 当前这个 target 的主语是谁

它服务于：

- edit
- drag anchor
- container 语义

保留 `nodeId` 比让执行层隐式依赖 `drag.nodeIds[0]` 更清晰。

### 为什么 `selection` target 不再保留 `box`

selection box 的几何形状只用于命中判定，不再用于执行。

执行层只真正需要：

- 当前多选拖拽 payload
- 当前 frame scope 下的 marquee payload

所以 `box` 不需要继续留在正式 target 上。

## 3. `PressPlan`

`PressPlan` 只描述 `tap / drag / hold` 三个时机走哪条路。

建议最小形态：

```ts
type PressPlan = {
  chrome: boolean
  tap?: 'clear' | 'select' | 'edit'
  drag?: 'drag' | 'marquee-touch'
  hold?: 'marquee-contain'
}
```

### 为什么不再需要 `PressAction / PressStep`

因为 payload 已经在 `target` 上。

例如：

- `tap: 'select'`
  - payload 用 `target.select`
- `tap: 'edit'`
  - payload 用 `target.nodeId + target.editField`
- `drag: 'drag'`
  - payload 用 `target.drag`
- `drag: 'marquee-touch'`
  - payload 用 `target.marquee + ctx.selected + ctx.mode`
- `hold: 'marquee-contain'`
  - payload 用 `target.marquee`

也就是说：

- `plan` 只负责选路
- `target` 负责带执行所需数据

这样就不再需要第三层 `PressAction`。

### 为什么 `holdDelay` 不再属于 `PressPlan`

目前产品规则已经稳定：

- 所有 hold 都使用同一个 `GestureTuning.holdDelay`

这意味着：

- `holdDelay` 不是业务 plan 的一部分
- 它只是 runtime 的固定调优值

所以应当直接在 `runPressPlan` 中使用固定值，不再进 `PressPlan`。

## 各阶段职责

### 1. `readPressCtx`

职责：

- 从 `GestureDown` 读取本次 down 需要复用的共享快照

建议只做下面几件事：

- 解析 `mode`
- 读取当前 `frame`
- 读取 `start`
- 读取 frame 过滤后的 `selected.nodeIds`
- 读取 frame 过滤后的 `selected.edgeIds`
- 读取当前 `selected.box`

不要在这一步做：

- group 提升
- editable field 逻辑
- container/node 区分
- repeat 判断
- drag payload 计算
- marquee payload 计算

也就是说，这一步是纯快照，不是策略。

### 2. `resolvePressTarget`

职责：

- 只回答“本次按下的是谁”
- 同时整理这个对象执行时真正需要的 payload

建议内部只保留四个分支：

- `background`
- `selection`
- `node`
- `container`

#### 2.1 `background`

当 pick 是背景时，直接返回：

```ts
{
  kind: 'background',
  marquee
}
```

这里的 `marquee` 只表示当前 frame scope 对应的触框选择范围。

#### 2.2 `selection`

当 pick 是 selection box body，且当前 selection box 可交互时，返回：

```ts
{
  kind: 'selection',
  chrome: true,
  drag,
  marquee
}
```

selection target 不需要保留几何 box，只需要保留执行用 payload。

#### 2.3 `node`

当 pick 是 node body 时，执行下面这些归一化：

- group 提升规则
- editable field 解析
- 当前 node 是否 selected
- 当前 node 是否 repeat
- 当前 node 对应的 `select`
- 当前 node 对应的 `drag`
- 当前 node 对应的 `marquee`
- 当前 node 在 press 期间是否应保留 chrome
- 当前 node 是否允许进入编辑

但最终只留下：

- `nodeId`
- `hitNodeId`
- `chrome`
- `select`
- `drag`
- `marquee`
- `editField?`

这里最重要的一条是：

- `repeat` 只是局部判断变量
- 不能成为正式字段

它的结果要么体现在：

- `editField?`
- `drag`
- `chrome`

要么在 target 上消失。

#### 2.4 `container`

当 pick 是 container body 时：

- 当前 active frame 的 body 直接视为 `background`
- frame node 自身如果需要按 node 处理，应在 target 层直接转成 `node`
- 非 frame container body，统一视为 `container`

container 最重要的收敛点是：

- 如果这次 drag 应该直接拖动，就带上 `drag`
- 如果这次 drag 不该拖动，就让 `drag` 缺失

这样 `repeat` 就不需要作为正式字段继续存在。

## 3. `resolvePressPlan`

职责：

- 只做规则翻译
- 不再重新读 instance
- 不再重新组装 selection/group/frame 事实

这一步应当非常短。

### 3.1 `background`

```ts
{
  chrome: false,
  tap: ctx.mode === 'replace' ? 'clear' : undefined,
  drag: 'marquee-touch'
}
```

### 3.2 `selection`

```ts
{
  chrome: true,
  drag: 'drag',
  hold: 'marquee-contain'
}
```

### 3.3 `node`

建议硬编码成稳定产品规则：

```ts
{
  chrome: target.chrome,
  tap: target.editField ? 'edit' : 'select',
  drag: 'drag',
  hold: 'marquee-contain'
}
```

### 3.4 `container`

container 与普通 node 的交互规则不同，应明确保留差异：

```ts
{
  chrome: target.chrome,
  tap: 'select',
  drag: target.drag ? 'drag' : 'marquee-touch',
  hold: 'marquee-contain'
}
```

也就是说：

- 未进入 drag 分流的 container body 拖动，是 `touch marquee`
- 进入 drag 分流的 container body，才是 `drag`

这与当前产品方向一致，而且规则比保留 `repeat` 更收敛。

## 4. `runPressPlan`

职责：

- 把 `PressPlan` 接到 `createPressRuntime`
- 在 `tap / drag / hold` 三个触发点执行对应行为

建议形态：

```ts
runPressPlan(instance, marquee, drag, ctx, target, plan) {
  return press.start({
    pointerId: ctx.event.pointerId,
    capture: ctx.capture,
    chrome: plan.chrome,
    holdDelay: GestureTuning.holdDelay,
    onTap: (event) => runTap(ctx, target, plan.tap, event),
    onHold: () => runHold(ctx, target, plan.hold),
    onDragStart: (event) => runDrag(ctx, target, plan.drag, event)
  })
}
```

注意：

- `runTap / runDrag / runHold` 可以保留为三个很小的 helper
- 但不要再抽象成 `PressAction` 或 `runAction`

### 4.1 `runTap`

- `clear`
  - `instance.commands.selection.clear()`
- `select`
  - `instance.commands.selection.replace(target.select)`
- `edit`
  - `instance.commands.edit.start(target.nodeId, target.editField!)`

### 4.2 `runDrag`

- `drag`
  - `createNodeDragSession.start(...)`
- `marquee-touch`
  - 启动 `touch marquee`
  - `base` 来自 `ctx.selected`
  - `mode` 来自 `ctx.mode`
  - `scope / edgeFilter` 来自 `target.marquee`

### 4.3 `runHold`

- `marquee-contain`
  - 清空 selection
  - 启动 `contain marquee`
  - `base` 为空
  - `scope / edgeFilter` 来自 `target.marquee`

执行层的关键约束：

- 不再回头读 selection/frame/group 规则
- 只消费 `ctx + target + plan`
- 所有二次业务判断都视为设计失败

## 为什么这版概念最少

这版真正做了三层收敛。

### 1. `PressContext` 降级成内部 `ctx`

它只是局部快照，不值得成为长期正式领域概念。

### 2. `PressSubject` 改成 `PressTarget`

`Target` 比 `Subject` 更直白，也更符合这一层真正的职责：

- 归一化后的命中对象

### 3. `PressAction / PressStep` 被取消

执行 payload 归到 `target`，行为选择归到 `plan`，不再需要第三层 action。

这是整条线概念最少的关键。

## 与其他模块的边界

### 1. `Marquee`

`packages/whiteboard-react/src/features/selection/Marquee.tsx` 继续只承担：

- marquee session
- marquee rect 输出
- marquee 可视渲染

不要把 node/container/group 规则塞进 marquee。

marquee 是执行器，不是行为翻译器。

### 2. `node drag`

`packages/whiteboard-react/src/features/node/drag/session.ts` 继续只承担：

- drag session 生命周期
- drag preview
- drag commit

`press` 决定：

- 何时 drag
- 拖谁
- 使用什么 drag payload

`drag` 决定：

- 怎么拖

### 3. `interaction`

`packages/whiteboard-react/src/runtime/interaction/coordinator.ts` 不应继续背 node 规则。

它的职责继续保持：

- 全局互斥
- capture
- auto pan
- chrome/busy/mode/space

这层已经够薄，不是本次问题来源。

### 4. `selection`

`selection` 不负责解释 press 规则。

它只负责：

- source
- derived view

不要把：

- repeat
- nextTapSelection
- hold contain marquee

这些行为语义塞回 selection。

## 文件组织建议

长期最优建议是：

- 保持 `packages/whiteboard-react/src/features/node/press.ts` 仍然是一个主文件
- 不新增 `press/` 子目录
- 不新增一堆 `context.ts / planner.ts / executor.ts / types.ts`

建议只在文件内部收成下面这些 section：

1. `types`
2. `ctx`
3. `target`
4. `plan`
5. `run`
6. `createNodeGesture`

这是“概念最少、跳转最少、可读性最高”的平衡点。

## 当前实现到目标实现的映射

### 1. 建议保留的函数

这些函数可以保留，只需要调整位置与输入输出：

- `readNearestGroupId`
- `readNearestSelectedGroupId`
- `matchesEdgeScope`
- `resolvePressNodeId`
- `readSelectionBoxTarget`
- `stopPointerDown`

### 2. 建议合并进 `readPressCtx`

这些函数不值得继续独立漂在外面：

- `readSelectedNodeIds`
- `readSelectedEdgeIds`
- `readStartWorld`

它们都属于“一次性读取共享快照”。

### 3. 建议合并进 `resolvePressTarget`

这些函数属于 target 派生逻辑：

- `readScope`
- `readEdgeFilter`
- `readNodeFrame`
- `readNodePressState`
- `readNodeTarget`
- `resolvePressTarget`

这里的目标不是“继续拆 helper”，而是把它们收成更短的同层小段。

### 4. 建议删除或内联

这些函数本身不是错，但不需要继续保持现在的层级：

- `readNodeOnlySelection`
- `buildSelectionWriter`
- `applyNodeTapSelection`

原因是：

- 它们都服务于很局部的 target payload 生产
- 留成单独工具函数的收益不高

### 5. 建议重写的函数

当前两个大函数应被重写：

- `resolveNodeLikePressPlan`
- `resolveBackgroundPressPlan`

最终应该变成：

- `resolvePressPlan`
- `runTap`
- `runDrag`
- `runHold`

计划层做选择，执行层做很小的分发，不再需要 action 模型。

## 关键规则约束

为了避免后续再次膨胀，建议明确写下这些约束。

### 1. `hold` 规则固定

`hold` 一律解释为：

- 清空 selection
- 启动 `contain marquee`

不要再让它与旧 selection、多种 exclude 规则耦合。

### 2. 执行层不二次决策

执行层不重新判断：

- 当前是不是 repeat
- 当前是不是 group
- 当前 selection 是什么

这些都必须在 `resolvePressTarget / resolvePressPlan` 阶段完成。

### 3. 一个分支只整理一次 selection 相关事实

例如：

- `select`
- `drag`
- `marquee`
- `chrome`
- `editField`

都只在 target 层确定一次，不允许 plan 层或执行层再次拼装。

### 4. target 只保留执行 payload

不要让 `PressTarget` 背这些规划阶段临时变量：

- `selected`
- `repeat`
- `canEdit`
- `keepChrome`

它们都应当在 `resolvePressTarget` 内部消化，只留下最后结果。

### 5. `press.ts` 不负责 preview 数学

`press.ts` 只负责：

- 行为翻译
- session 启动

不要把：

- marquee 命中
- node drag 预览
- snap 数学

重新抬回这里。

## 实施顺序

建议按下面顺序落地。

### 阶段 1：建立新主干

先写出：

- `readPressCtx`
- `resolvePressTarget`
- `resolvePressPlan`
- `runPressPlan`

并引入新的：

- `PressTarget`
- `PressPlan`

### 阶段 2：把旧逻辑搬运进新漏斗

逐步把：

- background
- selection box
- node
- container

四类分支迁移到新模型里。

### 阶段 3：删除旧中间层

当新主干稳定后，删除：

- `resolveNodeLikePressPlan`
- `resolveBackgroundPressPlan`
- `readNodePressState`

以及一批只剩单点调用的 helper。

### 阶段 4：压平文件内部 section

最后再统一整理 section 顺序、命名、局部变量，确保：

- 上到下是漏斗顺序
- 不再前后跳
- 不再出现大量跨段 helper

## 对后续模块的启发

这套模式如果落地成功，后续可以直接复用到：

- `node transform`
- 一部分 `edge` 输入链

但仍然建议保持轻量命名：

- `ctx`
- `target`
- `plan`
- `run`

而不是把整个仓库都改造成：

- `Planner`
- `Executor`
- `ContextFactory`
- `RuleEngine`

那会重新制造概念膨胀。

## 非目标

本文明确不做下面这些事：

- 不把 `press` 做成全局事件总线
- 不把 `node / edge / selection / frame` 规则抬升到 `interaction`
- 不新增一套通用 command/action framework
- 不为了“职责纯”继续拆很多小文件
- 不把 `press` 的局部业务规则推广成全仓统一框架

## 最终判断

对于 `press.ts`，最好的优化方法，确实可以概括成：

- 先 planner
- 再 executor

但长期最优落地形态不是重型 `planner / executor` 框架，而是：

```ts
ctx -> target -> plan -> run
```

其中真正稳定的正式概念只有两个：

- `PressTarget`
- `PressPlan`

它满足了四件最重要的事：

- 漏斗原则清晰
- 职责边界稳定
- API 与命名简短
- 不会继续制造小文件和概念膨胀

这就是 `node press` 这条链的长期最优实现方向。
