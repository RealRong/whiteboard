# Selection / Marquee 交互架构设计

## 1. 目标

这份文档只讨论一件事：

- 多选后的 `selection box`
- 普通框选 `marquee`
- 长按进入 `contain marquee`
- 它们与 `selection` 的职责边界

目标很明确：

- 长期最优
- 概念最少
- API 最少
- 不保留双套状态
- 交互语义符合白板产品习惯

核心结论先写在前面：

1. `selection` 只表示“当前已提交的选中结果”。
2. `marquee` 只表示“一次临时框选会话”。
3. `gesture` 只负责把 `pointerdown` 分流成 `tap / drag / hold -> marquee`。
4. 多选后的 `selection box` 应该支持拖拽整个 selection。
5. 多选后的 `selection box` 长按后，应该先清空当前 selection，再进入 `contain marquee`。
6. `touch marquee` 和 `contain marquee` 不应该是两套系统，而应该是同一个 `marquee`，只是 `match` 不同。

## 2. 最终模型

### 2.1 `selection`

`selection` 是稳定结果，不是交互过程。

它只回答：

- 当前选中了哪些 node
- 当前选中了哪个 edge
- 当前 selection 的派生 box
- 当前 selection 的派生 summary / can / transform

它不回答：

- 当前是不是在框选
- 当前是不是长按中
- 框选边框是虚线还是实线
- 这次 pointerdown 将来应该变成 drag 还是 marquee

换句话说：

- `selection` 是 committed result
- 不是 transient interaction state

### 2.2 `marquee`

`marquee` 是一次独立的临时交互 session。

它只回答：

- 起点在哪里
- 当前 rect 是什么
- 用什么命中策略
- 当前匹配到哪些 ids

建议最终只保留这一套最小输入：

```ts
type MarqueeMatch = 'touch' | 'contain'

type MarqueeStart = {
  pointerId: number
  capture: Element
  start: ViewportPointer
  scope?: ReadonlySet<NodeId>
  match: MarqueeMatch
}
```

这里最关键的是：

- `touch` 表示只要碰到就算命中
- `contain` 表示必须被完整包裹才算命中
- `scope` 表示这次框选只在某个给定集合内查找

这里有一个边界要明确：

- `marquee` 只负责算 matched ids
- 怎么把 matched ids 写回 `selection`，由外层 gesture/profile 决定

也就是说这些东西不应该进 `marquee.start(...)`：

- `mode`
- `base`
- `clearOnTap`
- `exclude`

这已经足够表达背景框选、长按精准框选、容器内框选。

### 2.3 `gesture`

`gesture` 不是状态中心，也不是业务中心。

它只是输入漏斗，只做三件事：

1. 识别这次 `pointerdown` 落在哪类 target
2. 决定这次输入后续走 `tap / drag / marquee`
3. 把结果委托给对应 executor

`gesture` 不应该直接承担：

- selection 视图拼装
- chrome 显示策略中心
- 多个交互目标的业务细节混写

## 3. 为什么 `selection box` 应该支持拖拽

多选稳定后，用户操作的对象已经不是某个 node，而是“当前 selection 整体”。

所以：

- 在 `selection box` 内 `pointerdown + move`，应直接拖拽整个 selection
- 不应该要求用户再去点 selection 内部某个具体 node 才能拖

这是更稳定的产品语义，因为：

1. 主操作对象和视觉主对象一致
   - 视觉上已经显示的是一个整体 selection box
   - 交互上也应把它当成一个整体
2. 可以避免命中歧义
   - selection box 内可能有多个 node、edge、container
   - 如果还要求重新命中单个 node，语义会退化
3. 更符合行业常见行为
   - 稳态多选时，整体 bounds 就是主 transform / move affordance

## 4. 为什么 `selection box` 长按后要清空并进入 `contain marquee`

这套行为是合理的，而且比“继续在当前 selection 上做复杂 refine”更干净。

推荐规则：

- 多选稳定时，`selection box` 上快速拖动：拖 selection
- 多选稳定时，`selection box` 上长按：先清空 selection，再开始 `contain marquee`

原因是：

1. 长按表达的不是“继续拖当前 selection”
   - 而是“我要重新精确选”
2. `contain marquee` 本身就是一种更严格的重新选取方式
   - 不是在当前 selection 上叠补一层复杂状态
3. 先 clear，再 marquee，结果最单义
   - 不会出现“当前 selection + 新框中的候选 + 排除规则”三套集合并存

所以这个流程是：

```ts
hold(selection-box)
-> clear selection
-> start marquee(match: 'contain')
-> replace selection with matched ids
```

这是长期最优的漏斗形态，因为整个过程里始终只有一份 committed selection。

## 5. `touch marquee` 与 `contain marquee` 的关系

应该是一个系统，不是两个系统。

不要做：

- 普通 selection box 一套实现
- 精准框选另一套实现

应该做：

- 同一个 `marquee.start(...)`
- 只通过 `match: 'touch' | 'contain'` 切换命中策略

视觉也应该直接从这个字段派生：

- `touch` -> 实线边框
- `contain` -> 虚线边框

这样有三个好处：

1. 视觉语义和命中语义同源
2. 不需要额外的 `dashed`、`precise`、`strict` 之类状态
3. 容器 body、selection box、背景都能复用同一套 `marquee`

## 6. 最小交互目标模型

长期最优不是继续在 `node gesture` 里堆条件，而是先把输入目标收敛清楚。

建议最终只保留四类 primary target：

```ts
type GestureTarget =
  | { kind: 'background' }
  | { kind: 'node'; nodeId: NodeId; zone: 'node' | 'body'; field?: EditField }
  | { kind: 'selection-box' }
  | { kind: 'transform-handle'; handle: TransformHandle; nodeId?: NodeId }
```

其中：

- `background` 负责普通 `touch marquee`
- `node` 负责单节点 click / drag / hold-marquee 分流
- `selection-box` 负责多选整体 drag / hold-marquee
- `transform-handle` 负责 resize / rotate

这样以后不会再在 `node gesture` 里硬塞 `selection box` 逻辑。

## 7. 每类 target 的固定语义

### 7.1 `background`

```ts
tap:
  clear selection

move:
  start marquee(match: 'touch')

hold:
  none
```

### 7.2 `node`

推荐保留现在已经接近稳定的语义：

```ts
tap:
  select / edit

move:
  drag current node or drag current selection

hold:
  clear selection
  start marquee(match: 'contain')
```

这里不需要 `exclude: [pressedNodeId]`。

原因是：

- `hold -> contain marquee` 之前已经明确清空当前 selection
- contain marquee 的结果完全由这次新框决定
- 起始点落在 pressed node 内部时，这个 node 几何上本来就不可能被完整包裹

所以：

- 不需要再把 pressed node 上下文传进 marquee
- `marquee` 保持纯几何命中就够了

### 7.3 `selection-box`

这是这次最重要的新增固定语义：

```ts
tap:
  noop

move:
  drag current selection

hold:
  clear selection
  start marquee(match: 'contain')
```

注意：

- `selection-box` 不应该自己再做选择切换
- 它只是在“操作当前 selection”与“重新精确框选”之间分流

### 7.4 `transform-handle`

```ts
tap:
  noop

move:
  resize / rotate

hold:
  none
```

## 8. 架构上如何保持简单

### 8.1 不新增第二份 selection 状态

不要做：

- `selection`
- `marqueeSelection`
- `preciseSelection`

只保留一份 committed `selection`。

所有交互最终都只调用：

- `selection.replace(...)`
- `selection.add(...)`
- `selection.remove(...)`
- `selection.toggle(...)`
- `selection.clear()`

### 8.2 只把 `marquee` 当作 producer

`marquee` 不应该拥有自己的“最终选择状态”。

它只是 producer：

- 输入 pointer session
- 计算 matched ids
- 在合适时机把结果写回 `selection`

更准确地说：

- `marquee` 负责“框到了谁”
- `gesture profile` 负责“框到的人怎么写回 selection”

### 8.3 不把视觉态再做成另一套行为系统

虚线和实线只是 `marquee.match` 的渲染结果。

不要再新增：

- `marquee.style = 'dashed'`
- `marquee.variant = 'precise'`
- `selection.precise = true`

## 9. 推荐 API

### 9.1 `selection`

保持窄接口：

```ts
selection.nodes(ids, mode?)
selection.edge(id)
selection.clear()
```

如果当前仓库还在用：

- `replace`
- `add`
- `remove`
- `toggle`

也可以先不动，但长期最优的公开命名更适合收成 `nodes / edge / clear`。

### 9.2 `marquee`

只暴露 session API：

```ts
marquee.start({
  pointerId,
  capture,
  start,
  scope,
  match
})

marquee.cancel()
marquee.rect
```

重点是：

- `match` 明确
- `scope` 明确
- 不混入 selection 领域词

### 9.3 `gesture`

不要让 `gesture` 直接暴露大量行为函数。

更合理的是内部结构收成：

```ts
readTarget(event)
readContext(target, event)
resolveIntent(context)
runIntent(intent)
```

也就是：

- 读目标
- 读上下文
- 决策
- 执行

这样 `gesture.ts` 的职责可以一句话说清。

## 10. 与当前实现的关系

当前仓库里已有两个正确方向：

1. `selection` 是单独状态
2. `Marquee.tsx` 已经是独立 session，并且已经支持：
   - `match: 'touch'`
   - `match: 'contain'`

当前主要问题不在 `selection` 或 `marquee` 本身，而在：

- `features/node/gesture.ts`

它现在同时承担：

- node press 语义
- body press 语义
- drag 启动
- hold 处理
- marquee 启动
- selection 切换
- chrome 显隐

这会导致：

- 条件越来越多
- `zone / repeat / hold / selectionMode / field` 交叉组合
- `selection-box` 语义无处安放，只能继续往里塞

所以最该改的不是 selection store，而是 interaction target 分层。

## 11. `gesture` 如何最大程度简化

### 11.1 根本判断

长期最优不是继续在 `features/node/gesture.ts` 里做局部瘦身，而是先改它的全局定位。

`gesture` 最终不应该是：

- node 交互巨石
- selection 语义中心
- marquee 启动中心
- drag preview 执行中心
- chrome 显隐维护中心

它最终应该只是：

- select tool 的输入路由器

也就是只做四件事：

```ts
readTarget(event)
readContext(target, event)
resolveIntent(target, context)
runIntent(intent)
```

换句话说：

- `gesture` 只负责“识别输入目标并分流”
- 不负责“亲自把所有事情做完”

### 11.2 当前哪些复杂度是没必要的

当前 `gesture` 的复杂度里，有一部分是真实业务复杂度，但有一部分只是边界没切开造成的。

最没必要的复杂度有这些：

1. 用 `zone: 'node' | 'body'` 承载过多语义
   - 实际交互目标已经不止两类
   - 至少还有 `background / container-body / selection-box / transform-handle`
   - 把这些语义压成 `zone`，只会把复杂度拖进条件分支

2. `PressIntent` 里提前塞入太多执行细节
   - `tapSelectionIds`
   - `dragSelectionIds`
   - `moveMarqueePolicy`
   - `holdMarqueePolicy`
   - `clearSelectionOnHold`
   - 这些都不是“意图”本身，而是执行层细节

3. `gesture` 自己持有 drag active state
   - 当前 node drag 的 preview / snap / edge follow / commit 都挂在 `gesture` 里
   - 这些复杂度不该算在 gesture 头上
   - 它们应该属于独立的 `node-drag session`

4. `Marquee` 自己处理背景 pointerdown 与 selection 合并
   - 这会导致背景输入和 node 输入由两套拥有者分别处理
   - 如果再加 `selection-box`，就会继续裂成第三套

5. `gesture` 手动维护 chrome 隐藏
   - `chromeHidden` 不是完全错误
   - 但它不该成为 press intent 的一部分到处传递
   - chrome 应尽量从 `interaction + selection + edit` 派生

### 11.3 哪些复杂度是必要的

这些复杂度本身不是问题，不能为了“看起来简单”硬砍：

1. `tap / drag / hold` 分流是必要的
   - 这是 Miro 风格交互的基础

2. container scope 是必要的
   - 容器内框选与全画布框选不是同一件事

3. drag preview / snap / edge follow 是必要的
   - 但它们属于 drag session
   - 不属于 gesture

所以正确的做法不是消灭这些复杂度，而是把它们移回正确层级。

### 11.4 最优的全局结构

建议最终把 select tool 的交互链路收成这四层：

1. `selection`
   - committed result

2. `marquee`
   - 纯框选 session

3. `node-drag`
   - 纯拖拽 session

4. `gesture`
   - 输入路由器

它们的职责分别是：

- `selection` 负责“当前选中了谁”
- `marquee` 负责“框到了谁”
- `node-drag` 负责“当前拖到了哪里、preview 是什么、怎么 commit”
- `gesture` 负责“这次 pointerdown 应该走哪条路”

### 11.5 最小 target 模型

`gesture` 之所以会膨胀，一个根本原因是 target 模型太含糊。

建议最终只保留这些显式 target：

```ts
type GestureTarget =
  | { kind: 'background' }
  | { kind: 'node'; nodeId: NodeId; field?: EditField }
  | { kind: 'container-body'; nodeId: NodeId }
  | { kind: 'selection-box' }
  | { kind: 'transform-handle'; handle: TransformHandle; nodeId?: NodeId }
```

这样：

- `background` 不再藏在 `Marquee.tsx`
- `container body` 不再藏在 `zone === 'body'`
- `selection-box` 不再被硬塞进 node 逻辑
- `transform-handle` 也不需要和 node press 混写

### 11.6 每类 target 的固定规则

#### `background`

```ts
tap:
  clear selection

move:
  start marquee(match: 'touch')
```

#### `node`

```ts
tap:
  select / edit

move:
  start node-drag

hold:
  clear selection
  start marquee(match: 'contain')
```

#### `container-body`

```ts
tap:
  select container

move:
  start marquee(match: 'touch')

hold:
  clear selection
  start marquee(match: 'contain')
```

#### `selection-box`

```ts
tap:
  noop

move:
  start node-drag for current selection

hold:
  clear selection
  start marquee(match: 'contain')
```

#### `transform-handle`

```ts
move:
  start transform session
```

这套固定规则比“先读 zone / repeat / field / currentSelectedIds，再拼 intent”更稳定。

### 11.7 `gesture` 不该再做什么

最终 `gesture` 不该再直接做这些事：

- 不自己维护 drag active state
- 不自己写 preview patch
- 不自己决定 marquee 怎么合并 selection
- 不自己绑定背景 pointerdown
- 不自己拼 chrome 业务规则

这些应分别交给：

- `node-drag`
- `marquee`
- `selection`
- `surface router`
- `chrome read`

### 11.8 三刀最有效的重构

如果只做最有效的三刀，我建议顺序是：

#### 第一刀：把 `marquee` 纯化

把 `marquee.start(...)` 收成纯框选输入：

```ts
marquee.start({
  pointerId,
  capture,
  start,
  scope,
  match
})
```

不要再让它接：

- `mode`
- `base`
- `clearOnTap`

这样 `marquee` 才是纯 producer。

#### 第二刀：把 node drag 从 `gesture` 中抽出去

把这些都挪到独立 `node-drag` session：

- build drag state
- preview
- snap
- related edge follow
- commit

这样 `gesture` 只需要在 move 时调用：

```ts
nodeDrag.start(...)
```

#### 第三刀：把背景输入也并入统一 surface 路由

不要再让 `Marquee` 组件自己监听背景 `pointerdown`。

应该由统一的 select-surface 输入入口来识别：

- background
- node
- container-body
- selection-box

然后再决定是：

- `marquee.start(...)`
- `nodeDrag.start(...)`
- `transform.start(...)`

### 11.9 最终形态

最终最理想的结构不是一个更大的 runtime，而是一个更薄的交互漏斗：

```ts
select-surface/
  target.ts
  context.ts
  intent.ts
  router.ts

marquee/
  session.ts
  layer.tsx

node-drag/
  session.ts

transform/
  session.ts
```

其中：

- `select-surface/router` 只做输入分流
- `marquee/session` 只做框选
- `node-drag/session` 只做拖拽
- `transform/session` 只做缩放旋转

这比继续维护一个 600+ 行的 `node/gesture.ts` 明显更符合长期最优。

## 12. 推荐实施顺序

### 阶段 1：先把 `selection-box` 变成显式 target

目标：

- 多选后，selection box 自己接收 pointerdown
- `move -> drag selection`
- `hold -> clear + contain marquee`

结果：

- 多选的主操作对象终于和视觉主对象一致

### 阶段 2：把 `marquee` 明确成唯一框选系统

目标：

- 背景框选与精准框选共用同一个 `marquee`
- 只通过 `match` 区分
- 样式也从 `match` 派生

结果：

- 不再有两套框选实现

### 阶段 3：瘦 `gesture.ts`

目标：

- 先识别 target
- 再决策 intent
- 最后委托 executor

结果：

- `gesture.ts` 从“条件巨石”变回“输入漏斗”

### 阶段 4：把 chrome 策略从手势细节里继续剥离

目标：

- chrome 是否显示，尽量从 `interaction mode + selection + edit` 派生
- 不再在每个 gesture 分支里手动维护

结果：

- press / drag / hold 的逻辑继续变短

## 13. 最终结论

长期最优设计不是把 `selection` 变复杂，而是把职责切清：

- `selection` 是结果
- `marquee` 是临时框选生产器
- `gesture` 是输入漏斗
- `selection box` 是一个独立交互目标

最关键的行为结论有三条：

1. 多选后，在 `selection box` 内拖动，应该拖拽整个 selection。
2. 多选后，在 `selection box` 上长按，应该清空当前 selection，再进入 `contain marquee`。
3. `touch marquee` 与 `contain marquee` 应该是同一个系统，只是 `match` 不同，并分别映射为实线与虚线边框。

如果按这套方向收敛，整条链路会明显更简单：

- 不需要第二份 selection
- 不需要第二套框选系统
- 不需要把 selection box 硬塞回 node gesture
- 不需要为虚线边框再发明额外状态

这就是最符合漏斗原则、职责分离和长期维护性的方案。
