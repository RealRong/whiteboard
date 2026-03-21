# Whiteboard React 异味收敛方案

更新时间：2026-03-22

## 目标

这份文档只回答一件事：

`packages/whiteboard-react/src` 现在有哪些会继续放大复杂度的结构性异味，以及接下来应该怎么一步到位收敛。

前提：

- 不考虑兼容成本
- 目标是长期最优，不是最小改动
- 优先减少概念、减少重复、减少跨层依赖
- 不把“大文件”本身当问题，只处理真正会持续膨胀的职责问题

---

## 1. 当前主要异味

## 1.1 `selection` runtime 掺入了 UI projection

当前 `selection` 不只是在回答“选中了什么”，还在回答：

- 这些节点该显示什么名字和图标
- 当前 toolbar/context menu 能不能显示某些入口
- 当前 shortcut 能不能执行某些动作

这导致 `runtime/selection` 反向依赖 `features/node/summary`，运行时共享状态和 UI 解释层混在一起。

问题不只是耦合，而是边界开始失真：

- runtime 不再纯粹
- selection 每次变化都会夹带 UI 语义
- 后面无论 toolbar、context menu、filter 怎么变，都会反推回 selection 层

这会让 `selection` 越来越像“全局选择中心 + UI 装配中心”，不是好方向。

---

## 1.2 `NodeToolbar` 和 `ContextMenu` 在重复翻译同一套动作语义

当前已经有一套 `NodeSelectionActions`，但还不够收敛：

- `NodeToolbar` 自己再包装一遍
- `ContextMenu` 再包装一遍
- 两边各自维护 section、group、label、visible、close-after-action 逻辑
- style/group 特殊规则还各自塞在自己的文件里

这类重复的风险非常明确：

- 新增一个 action，要改两处甚至三处
- 可见性规则容易漂
- 菜单分组容易漂
- 视觉壳和动作语义纠缠在一起

长期看，问题不是文件太长，而是“一个动作模型，多个壳各自解释”。

---

## 1.3 node press 交互本质上是状态机，但当前是字段拼装

`createNodePressSession` 现在承担：

- click
- repeat click
- retarget
- hold
- drag
- marquee
- edit start
- container body 特殊分流

它本质上已经是一个交互状态机，但实现方式是：

- 一大块 `pending`
- 多个布尔位和枚举组合
- 全局 pointermove/up/cancel 监听
- 多个入口共享一套可变对象

这类实现最大的问题不是“难看”，而是：

- 不变量分散
- 分支组合难验证
- 很容易出现某个新交互只修了一半
- click / hold / drag / marquee 的边界越来越难维护

长期最优不是机械拆文件，而是把状态模型显式化。

---

## 1.4 `useEdgeInput` 已经变成边交互总控器

当前一个 hook 里同时处理：

- create edge
- reconnect endpoint
- drag path point
- drag edge body
- hover snap preview
- container 级 DOM 监听
- edge/path/endpoint 的对外 handlers

这说明“边输入”已经不是一个 hook 能自然承载的东西了。

继续往里加能力，比如：

- 更细的 routing 规则
- 更多 edge subtype
- 不同 edge 的不同控制点策略
- 更复杂的 reconnect policy

复杂度会继续指数增长。

问题根因是：

- session 概念有多个
- DOM 入口判断和 session 执行揉在一起
- preview 写入和 commit 逻辑揉在一起

---

## 1.5 文本尺寸与编辑链路有多套测量和决策入口

现在文本/sticky 相关逻辑分散在几处：

- `features/node/text.ts`
- `features/node/hooks/useAutoFontSize.ts`
- `features/node/registry/default/text.tsx`
- `canvas/NodeToolbar.tsx`

它们都在不同阶段参与：

- 测量文本宽高
- 自动字号
- 编辑预览尺寸
- 提交后的最终尺寸
- toolbar 改文案/字号后的尺寸回写

这意味着文本尺寸不是单一模型，而是“多入口协作”。

风险是：

- 编辑态和非编辑态表现不一致
- toolbar 修改和直接输入修改不一致
- sticky 与 text 的策略边界不清晰
- 后续很难判断“尺寸到底由谁说了算”

---

## 2. 收敛原则

## 2.1 保留最少概念

`whiteboard-react` 这层长期只保留下面几类稳定概念：

1. `selection`
2. `actions`
3. `session`
4. `overlay`
5. `text fit`

不要继续上升新的抽象名词，比如：

- `profile`
- `presenter`
- `manager`
- `controller`
- `coordinator`
- `resolver`

除非一个新概念真的能减少整体心智负担，否则不引入。

---

## 2.2 runtime 只保留基础事实，不保留 UI 解释

运行时共享读模型应该只回答：

- 当前选中了什么
- 当前 box 是什么
- 当前是否可 move / resize / rotate
- 当前 edge / node / overlay 的基础状态是什么

不应该直接回答：

- 当前 selection 的名字是什么
- 当前该显示哪个 icon
- 当前哪些菜单项要不要出现

这些都属于 UI projection。

---

## 2.3 壳层不拥有动作语义

`toolbar`、`context menu`、`shortcut` 都只是壳。

它们不应该：

- 各自计算 capability
- 各自生成 action 列表
- 各自决定 group 结构
- 各自维护 label 规则

正确方向是：

- `selection` 提供最小基础事实
- `actions` 提供统一动作语义
- `toolbar` / `context menu` / `shortcut` 只消费动作

也就是：

- 动作模型只有一份
- 壳只决定怎么摆，不决定动作本身是什么

---

## 2.4 交互用显式 phase，不用布尔位堆叠

像 node press、edge input 这种交互链路，长期最优模型应该是：

- 明确有哪些 phase
- 明确 phase 之间如何迁移
- 明确每个 phase 拥有哪些字段

而不是：

- 一个 `pending`
- 再挂很多 `holdElapsed`、`locked`、`zone`、`field`
- 再靠 if/else 推断“当前其实在哪个状态”

最优实现不是“抽很多工具函数”，而是把状态本身建对。

---

## 2.5 文本尺寸必须只有一个真来源

最终应收敛成：

- 文本宽高测量：一套基础测量
- 自动字号：在这套基础测量之上做 fit
- 编辑预览：仍然走同一套测量逻辑
- toolbar 改文案/字号：仍然走同一套测量逻辑

不能再出现：

- renderer 一套
- hook 一套
- toolbar 再补一套

否则后续每次修一个文本 bug，都会变成“到底是哪条链路的问题”。

---

## 3. 最终目标结构

## 3.1 selection

最终目标：

- `selection runtime` 只保留基础视图
- `selection ui` 再从 runtime 派生 summary/types/can

建议最终拆成两层：

### `runtime/selection`

只保留：

```ts
type SelectionView = {
  kind: 'none' | 'node' | 'nodes' | 'edge'
  target: {
    nodeIds: readonly NodeId[]
    nodeSet: ReadonlySet<NodeId>
    edgeId?: EdgeId
  }
  items: {
    nodes: readonly Node[]
    primary?: Node
    count: number
  }
  transform: {
    move: boolean
    resize: 'none' | 'resize' | 'scale'
    rotate: boolean
  }
  box?: Rect
}
```

### `features/node/selection`

只负责派生：

- `summary`
- `types`
- `can`

这样后续如果要改 filter strip、toolbar summary、context menu rule，不需要改 runtime。

---

## 3.2 actions

最终目标：

- `actions` 是唯一动作语义来源
- toolbar/context menu/shortcut 都消费同一份 actions

建议把动作模型继续收紧成两层：

### `node actions`

回答：

- 当前有哪些 action
- 每个 action 的 key / label / icon / enabled / run
- 哪些 action 属于哪个稳定 section

### `menu shells`

只回答：

- toolbar 怎么摆
- context menu 怎么摆
- shortcut 怎么绑定

不要让 shell 再自己推导动作。

建议最终只保留稳定 section：

- `style`
- `layout`
- `structure`
- `arrange`
- `state`
- `edit`
- `danger`

其中：

- `arrange` 用于 layer/order
- `layout` 用于 align/distribute
- `style` 用于 fill/stroke/text/group style

---

## 3.3 node press

最终目标：

- `node press` 是一个显式 session
- `container body` 和普通 node 只是不同入口参数，不是另一套逻辑

建议 phase 明确化：

```ts
type PressPhase =
  | { kind: 'armed'; ... }
  | { kind: 'hold'; ... }
  | { kind: 'drag'; ... }
  | { kind: 'marquee'; ... }
```

关键点：

- `armed` 保存 click/drag 的分流前上下文
- 超过 hold 阈值进入 `hold`
- move 超过阈值后从 `armed` 或 `hold` 分流到 `drag` / `marquee`
- `pointerup` 只处理当前 phase 的收尾

同时把这些策略显式化为稳定输入：

- `zone: 'node' | 'body'`
- `selectionMode`
- `isSelected`
- `isLocked`
- `editField`

phase 是状态，以上这些是输入，不要混成一坨。

---

## 3.4 edge input

最终目标：

- 一个薄入口层
- 多个独立 session

推荐结构：

- `useEdgeCreateInput`
- `useEdgeReconnectInput`
- `useEdgePathInput`
- `useEdgeDragInput`
- `useEdgeInput` 只负责组合和事件分发

这不是为了拆文件而拆文件，而是为了把四种不同交互的：

- active state
- preview
- commit
- cleanup

分开维护。

最终 `useEdgeInput` 只做三件事：

1. 读 DOM target
2. 选择转发给哪个 input session
3. 返回给组件要绑的 handlers

---

## 3.5 text fit

最终目标：

- 一个基础测量模块
- 一个 fit 模块
- renderer / toolbar / edit 都只调用它们

推荐结构：

- `text/measure`
  - 负责 DOM 测量 host
  - 负责基础宽高测量
- `text/fit`
  - 负责 auto font size
  - 只在基础测量上做范围搜索
- `text/model`
  - 负责 `widthMode`、默认尺寸、空文本判断、editable text helper

这样：

- `TextNodeRenderer` 不再自己拥有太多尺寸规则
- `NodeToolbar` 不再直接参与复杂的文本尺寸决策
- sticky/text 的差异只体现在 fit policy，不体现在整条链路各处 if/else

---

## 4. 分阶段实施顺序

## 阶段 1：瘦身 `selection`

目标：

- 把 `summary/can` 从 `runtime/selection` 中拿出去
- runtime 只保留基础 selection view

修改范围：

- `packages/whiteboard-react/src/runtime/selection/state.ts`
- `packages/whiteboard-react/src/features/node/summary.ts`
- `packages/whiteboard-react/src/runtime/hooks` 或 selection 相关 hook
- 使用 `selection.summary` / `selection.can` 的 UI 组件

收敛后收益：

- runtime 边界变纯
- selection 不再持有 UI 解释
- 后续 menu/filter/summary 规则变动不会污染 runtime

验证重点：

- 单选/多选/选 edge
- selection box 更新
- toolbar / context menu / shortcut 能力不回归

---

## 阶段 2：统一 actions 与 menu shells

目标：

- 动作语义只保留一份
- toolbar/context menu/shortcut 全部读同一份 action source

修改范围：

- `packages/whiteboard-react/src/features/node/actions.ts`
- `packages/whiteboard-react/src/canvas/NodeToolbar.tsx`
- `packages/whiteboard-react/src/canvas/ContextMenu.tsx`
- shortcut 相关 action 入口

实施方式：

1. 先把 action model 补齐稳定字段：
   - `key`
   - `label`
   - `icon`
   - `enabled`
   - `section`
   - `run`
2. 把 shell 私有的 section/group 逻辑往 actions 收
3. `NodeToolbar` 只负责图形布局和 menu 渲染
4. `ContextMenu` 只负责菜单布局和 open/close 生命周期

收敛后收益：

- 动作语义不会双改
- menu 系统更容易继续产品化
- shortcut 也能直接复用同一份动作定义

验证重点：

- fill/stroke/text/group/layout/order/filter
- copy/cut/duplicate/delete
- group 特殊项
- 多选 filter strip

---

## 阶段 3：重做 node press session

目标：

- 把隐式状态机改成显式 phase
- 合并 node / container body 两套分流逻辑

修改范围：

- `packages/whiteboard-react/src/features/node/hooks/drag/session.ts`
- 依赖 `node press` 内部状态的 chrome/overlay 读取方

实施方式：

1. 先把当前行为矩阵写清：
   - 未选中 node
   - 已选中 node
   - container body
   - hold
   - move before hold
   - move after hold
   - click to edit
2. 建立明确 phase 类型
3. 把 `pointermove/up/cancel` 的逻辑改为 phase dispatch
4. 去掉依赖布尔组合推断当前状态的实现

收敛后收益：

- 长按、拖拽、框选、编辑入口更稳定
- chrome 消失/保留策略更容易维护
- container 行为不再是特例堆积

验证重点：

- text/sticky 的 click、double click、edit
- container body 的 click / drag / hold-marquee
- 多选后的继续拖拽

---

## 阶段 4：拆开 edge input

目标：

- `useEdgeInput` 从总控 hook 退化为薄组合层

修改范围：

- `packages/whiteboard-react/src/features/edge/hooks/useEdgeInput.ts`
- 相关 edge preview / connection preview / path preview 使用点

实施方式：

1. 先按交互类型切出 4 个 session：
   - create
   - reconnect
   - path
   - drag
2. 每个 session 自己管理：
   - active
   - start
   - preview
   - commit
   - cancel
3. `useEdgeInput` 只做 target dispatch

收敛后收益：

- edge 交互不会继续长成一个超级 hook
- routing/reconnect/control point 规则更容易继续演进
- preview bug 更容易局部定位

验证重点：

- create edge
- free endpoint reconnect
- attached endpoint reconnect
- insert control point
- drag control point
- drag free edge body

---

## 阶段 5：统一 text/sticky 尺寸链路

目标：

- 文本测量只保留一套基础设施
- 文本尺寸决策只有一个真来源

修改范围：

- `packages/whiteboard-react/src/features/node/text.ts`
- `packages/whiteboard-react/src/features/node/hooks/useAutoFontSize.ts`
- `packages/whiteboard-react/src/features/node/registry/default/text.tsx`
- `packages/whiteboard-react/src/canvas/NodeToolbar.tsx`

实施方式：

1. 合并测量 host
2. 抽出统一 `measure` 和 `fit`
3. renderer 只做：
   - read text
   - edit draft
   - 调测量/fit
   - commit/cancel
4. toolbar 改文案/字号时复用同一套测量接口

收敛后收益：

- 文本编辑体验更稳定
- sticky / text 差异更清晰
- 后续字号、宽度增长、blur 后尺寸回落这类问题更好修

验证重点：

- text 创建、输入、blur
- sticky 输入和自动字号
- toolbar 改文案
- toolbar 改字号
- 空文本删除

---

## 5. 文件与目录收敛建议

不是简单地“把大文件拆碎”，而是按稳定责任拆。

建议方向：

### 保留集中

- `runtime/selection/*`
- `features/node/actions*`
- `features/node/summary*`
- `features/node/text/*`
- `features/edge/input/*`

### 避免继续分裂

- 不要为每个小 helper 单独新建文件
- 不要引入只做一层转发的 hooks
- 不要出现只有一个文件的无意义目录
- 不要把壳层和语义层混在一个文件里继续长

判断标准：

- 如果一个模块回答的是同一个稳定问题，就尽量放一起
- 如果只是为了“把 900 行拆成 5 个文件”，但概念没有变清晰，那不算优化

---

## 6. 命名原则

后续重构统一遵循下面几条：

- 公开概念优先短名
- 同类能力用同一命名族
- 不重复领域词

例子：

- 用 `selection/view`，不要 `selection/selectionView`
- 用 `text/measure`，不要 `text/textMeasureRuntime`
- 用 `edge/input/create`，不要 `useEdgeCreateInteractionRuntime`
- 用 `actions`，不要 `selectionActionPresenter`

函数命名也一样：

- `read`
- `build`
- `start`
- `update`
- `commit`
- `cancel`

优先这些短而稳定的动词，不再堆叠修饰词。

---

## 7. 推荐执行顺序

如果按投入产出比排序，推荐顺序是：

1. `selection` 瘦身
2. `actions` 与 menu shells 统一
3. `node press` 状态机显式化
4. `edge input` 拆 session
5. `text fit` 链路统一

原因：

- 前两步先解决跨层职责和重复动作语义
- 第三步解决最容易继续长复杂度的 node 交互入口
- 第四步解决 edge 这条最重的输入链
- 第五步最后处理文本，因为它依赖前面的 selection/menu/interaction 结构稳定下来

---

## 8. 最终结论

这次 `whiteboard-react` 的问题，不是“代码量太多”，而是有几条主链已经开始承担过多职责。

长期最优不是继续打补丁，而是把下面四件事收住：

1. `selection` 只保留基础事实
2. `actions` 成为唯一动作语义来源
3. `node/edge` 输入改成显式 session
4. `text` 尺寸决策收敛成单一链路

只要这四件事收住，后面的 toolbar、context menu、shortcut、filter、overlay 都会自然变简单。
