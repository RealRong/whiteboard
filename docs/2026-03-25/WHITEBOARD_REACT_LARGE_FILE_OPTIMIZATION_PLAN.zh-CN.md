# Whiteboard React 大文件优化落地方案

## 1. 目标

这份文档只回答一个问题：

`packages/whiteboard-react/src` 里当前仍然偏大的文件，哪些只是体量大，哪些是真正暴露了底层模型缺口，以及应该如何一步到位收敛。

本方案明确采用以下原则：

- 不考虑兼容成本，优先长期最优。
- 不靠继续拆很多小 helper 降复杂度。
- 优先补底层模型，让上层自然变薄。
- `whiteboard-react` 只保留 UI 组合、DOM 边界、pointer session。
- 纯规则、纯几何、preview/commit 对应关系，尽量下沉到 `core` / `engine` / `react runtime 底层`。

## 2. 结论总览

当前 `whiteboard-react` 里真正还复杂、而且值得继续通过底层模型优化的重点文件，按优先级排序如下：

1. `packages/whiteboard-react/src/features/node/hooks/transform/session.ts`
2. `packages/whiteboard-react/src/features/edge/hooks/useEdgeConnectInput.ts`
3. `packages/whiteboard-react/src/runtime/selection/policy.ts`
4. `packages/whiteboard-react/src/runtime/input/pointer.ts`
5. `packages/whiteboard-react/src/runtime/read/node.ts`

这 5 个文件的问题，不是 JSX 多，也不是临时实现粗糙，而是 React 层仍然在自己维护：

- preview 和 commit 的双轨规则
- group/frame/path 的命中与归属规则
- create / reconnect / resize / scale 的参与者展开
- 交互 target 的归一逻辑

换句话说，复杂度的根源不是“大文件”，而是“缺少足够明确的底层模型”。

相反，下面这些文件虽然大，但不属于优先下沉对象：

- `packages/whiteboard-react/src/features/node/text.ts`
- `packages/whiteboard-react/src/features/node/shape.tsx`
- `packages/whiteboard-react/src/features/selection/chrome/NodeToolbar.tsx`
- `packages/whiteboard-react/src/features/selection/chrome/ContextMenu.tsx`
- `packages/whiteboard-react/src/features/toolbox/ToolPalette.tsx`
- `packages/whiteboard-react/src/features/node/actions.ts`
- `packages/whiteboard-react/src/runtime/instance/createInstance.ts`

它们更像：

- DOM 测量边界复杂度
- 配置体量大
- menu/action schema 还不够数据化
- composition 文件偏长

这些问题应该通过 schema/preset/composition 收口，而不是继续往 `core` / `engine` 搬算法。

## 3. 分类标准

后续判断某个大文件该不该继续下沉，统一使用下面这套标准。

### 3.1 应该下沉

如果 React 文件里在做下面这些事，说明模型位置不对：

- React 自己维护 preview 和 commit 的同一套业务规则
- React 自己递归 group / frame / descendants / edge route follow
- React 自己决定哪些对象参与一次 transform / reconnect / marquee
- React 自己做命中归一，把多个 hit 语义重新翻译成交互 owner
- React 为多个交互模块重复计算同一类纯几何结果

### 3.2 不应该下沉

如果文件主要在做下面这些事，它就应该留在 `whiteboard-react`：

- DOM 测量、字体测量、内容编辑
- pointer capture、document selection lock、浏览器事件绑定
- 视觉组件组合、toolbar/menu 渲染
- CSS class / style / icon / popover 结构

## 4. 重点文件与根因

## 4.1 `features/node/hooks/transform/session.ts`

### 当前复杂度根因

这个文件当前同时承担了：

- 单节点 resize
- 单节点 rotate
- 多选 scale
- group descendants 展开
- preview patch 生成
- commit 目标过滤
- snap 接入

它虽然已经复用了部分底层几何函数，但 React 层仍然保留了自己的参与者选择逻辑，例如：

- 哪些节点要参与 scale
- 哪些 group descendant 只用于 preview
- 哪些节点最终允许 commit

这说明目前缺的不是更多 helper，而是一个更高阶的 transform solver。

### 长期最优设计

应补一个统一的纯求解模型，例如：

- 输入：当前选择、handle、起始 frame、pointer delta、snap 结果
- 输出：
  - `participants`
  - `patches`
  - `commitIds`
  - `hoveredContainerId`

这样 `transform/session.ts` 只需要做：

- 建会话
- 读取 pointer
- 调用 solver
- 把返回结果写入 preview
- pointerup 时把 `commitIds + patches` 提交

React 不再自己做 group descendants 展开，也不再自己决定 preview/commit 边界。

### 推荐放置层级

- 纯几何与参与者求解：`@whiteboard/core/node`
- 如果依赖完整读模型才能展开 descendants，可在 `@whiteboard/engine` 提供 read-backed solver
- React 侧只保留 session 与 preview write

## 4.2 `features/edge/hooks/useEdgeConnectInput.ts`

### 当前复杂度根因

这个文件现在同时处理：

- edge create
- edge reconnect
- draft end 形态
- anchor 解析
- preview patch 写入
- preview hint 写入
- 最终 commit 路由

虽然 preview/hint 状态已经统一到了 `instance.internals.edge.preview`，但“草稿如何演进”这件事仍然散在 hook 里。

### 长期最优设计

应补一个统一的 edge connect draft/projector 模型。

建议职责如下：

- 给定 session 起点，生成初始 draft
- 给定当前 pointer / snap 命中，推导下一步 draft
- 从 draft 投影出：
  - `patch`
  - `hint`
  - `commit input`

也就是说，create/reconnect 不是在 hook 里分两套流程，而是映射到同一套 draft 模型的两种起始状态。

### 推荐放置层级

- draft 结构与纯投影规则：`@whiteboard/core/edge`
- 如果需要依赖 engine read 才能解析 node anchor，可由 `@whiteboard/engine` 或 `react runtime read` 提供注入式 resolver
- React hook 只保留 pointer session、preview 写入、提交命令

## 4.3 `runtime/selection/policy.ts`

### 当前复杂度根因

这个文件一部分复杂度是合理的，因为 tap / drag / hold / repeat-click / edit 本来就是 UI policy。

不合理的部分在于，它还在自己做：

- nearest group 追溯
- press node 归一
- 当前点击是不是应该拖动当前 selection
- group owner 的解释

这类逻辑本质不是 selection policy，而是 press target normalization。

### 长期最优设计

policy 层不应该关心 group 链怎么爬、谁是 owner、frame body 和 shell 的命中差异。

它应该只接收一个已经归一化的 press target，例如：

- `background`
- `node`
- `group-shell`
- `frame-shell`
- `edge`
- `selection-box`

然后只回答一件事：

- tap 做什么
- drag 做什么
- hold 做什么
- repeat click 做什么

### 推荐放置层级

- press target 归一：`react runtime` 底层
- selection policy：继续留在 `runtime/selection`
- 不建议把这部分放进 engine，因为这是交互命中语义，不是文档写规则

## 4.4 `runtime/input/pointer.ts`

### 当前复杂度根因

这个文件主要在做：

- pick 读取
- frame normalize
- tool gating
- down route 分类
- context target 解析

它的问题不是事件代码本身多，而是它也在参与“目标语义的二次解释”。

`pointer.ts` 和 `selection/policy.ts` 现在都在试图重新解释 hit target，只是角度不同。

### 长期最优设计

最优方案不是再加更多 route helper，而是统一一层 target normalization：

1. 原始 pick
2. 结合当前 frame / selection / tool / editable 状态
3. 产出规范化 target
4. route 和 policy 都只消费规范化结果

这样 `pointer.ts` 会明显变薄，它只负责：

- 读 event
- 调用 normalize
- 按 route 分发

### 推荐放置层级

- 目标归一模型：`react runtime/input` 或 `react runtime/pick`
- route 分发：保留在 `pointer.ts`

## 4.5 `runtime/read/node.ts`

### 当前复杂度根因

这个文件目前在 React 侧维护了不少纯读侧规则：

- `bounds`
- `frame`
- `frameAt`
- `idsInRect`
- group descendants 的矩形匹配
- draw/path 节点的 rect 命中策略
- shape outline 与 rect 的差异

这些其实已经不是 UI 层语义，而是 read-side query。

### 长期最优设计

应进一步把节点查询能力往下沉，让 React 不再自己维护 `idsInRect` 的 group/path/frame 规则。

理想状态下，React 侧读取的是：

- `node.bounds(id)`
- `node.frame(id)`
- `node.idsInRect(rect, options)`
- `node.at(point, options)`

但内部规则由底层统一维护，而不是在 React 里写递归和 hit 判定。

### 推荐放置层级

- 纯几何和 node shape hit：`@whiteboard/core/node`
- 基于文档树与索引的 query：`@whiteboard/engine/read`
- React 只做 façade

## 5. 不应优先处理的大文件

## 5.1 `features/node/text.ts`

这个文件大，但主要是：

- DOM 文本测量
- auto font size
- editable 行为
- RAF 队列

这些都属于浏览器边界。即使进一步整理，也应该是 React 内部收敛，而不是下沉到 core/engine。

优化方向：

- 内部减少分支
- 抽薄测量 service
- 统一 text/sticky 的 typography pipeline

不建议把它作为当前第一阶段重点。

## 5.2 `features/node/shape.tsx`

这里的大部分体量来自 shape spec 数据本身。

它的问题更像是 descriptor schema 还可以更明确，例如：

- label inset
- connect outline
- default size
- text layout

但这属于配置模型，而不是 urgent 的底层规则缺口。

## 5.3 `selection/chrome/*` 与 `toolbox/*`

`NodeToolbar.tsx`、`ContextMenu.tsx`、`ToolPalette.tsx`、`node/actions.ts` 的问题，本质是 menu schema / action schema 还不够统一。

长期方向是：

- node type -> name/icon/actions
- selection summary -> chrome preset
- context menu / node toolbar / shortcut 共享同一 action descriptor

这部分应走 UI schema/preset 收口，不应优先拉进 core/engine。

## 5.4 `runtime/instance/createInstance.ts`

这个文件偏长，但主要是 composition-only wiring：

- store/init
- read/commands/runtime 拼装
- feature runtime 接线

它不是规则复杂，只是装配点长。可以后续再按装配域收口，但不是首要问题。

## 6. 落地原则

所有后续改造，统一遵守下面几条。

### 6.1 不新增第二套语义

不能为了简化 UI，再新造一套“plan model / helper wrapper / mirrored state”。

如果某个 React 文件还复杂，优先判断是不是缺：

- 单一输入模型
- 单一预览模型
- 单一命中归一模型

而不是继续加中间层。

### 6.2 统一 preview -> commit 映射

所有需要实时交互预览的能力，都应该尽量遵守同一思路：

- session 只负责收集输入
- solver/projector 负责算纯结果
- preview store 只存结果
- commit 只提交 solver 产出的最终输入

不要在 hook 里再维护第二套“提交时重算”的规则。

### 6.3 React 只保留边界职责

React 侧的职责应尽量收敛为：

- DOM 事件
- 浏览器测量
- pointer session
- preview 展示
- 菜单与组件组合

其余纯规则尽量下沉。

### 6.4 读规则优先做 query 化

凡是 React 侧反复在做的：

- idsInRect
- at(point)
- bounds/frame
- group descendants 递归过滤

都优先考虑抽成底层 read query，而不是在多个 feature hook 里各自重写。

## 7. 分阶段实施顺序

## 阶段 1：Transform Solver

目标：

- 收薄 `features/node/hooks/transform/session.ts`

实施：

- 抽出统一 transform solver
- 输入为 selection/frame/handle/pointer/snap
- 输出 participants/patches/commitIds/hoveredContainerId
- React session 只做 pointer 驱动与提交

完成标志：

- `transform/session.ts` 不再自己展开 group descendants
- `commitTargetIds` 之类的中间概念消失或被 solver 内部吸收

## 阶段 2：Edge Connect Draft

目标：

- 收薄 `features/edge/hooks/useEdgeConnectInput.ts`

实施：

- 定义统一 edge connect draft
- create/reconnect 共用一套 projector
- `patch` / `hint` / `commit input` 来自同一个 draft

完成标志：

- hook 内 create/reconnect 的重复分支明显减少
- preview 与 commit 不再在两个地方分别维护

## 阶段 3：Press Target Normalization

目标：

- 同时收薄 `runtime/selection/policy.ts` 与 `runtime/input/pointer.ts`

实施：

- 增加统一 press target normalize
- 先把原始 pick 结合 frame/selection/tool/editable 归一
- policy 只做交互决策
- pointer 只做 route 分发

完成标志：

- `policy.ts` 不再做 nearest group / owner 追溯
- `pointer.ts` 不再重复解释同一类目标语义

## 阶段 4：Node Read Query 下沉

目标：

- 收薄 `runtime/read/node.ts`

实施：

- 把 `idsInRect`、`frameAt`、group descendants match、path hit 规则下沉到底层 query
- React 保留 façade，隐藏底层实现细节

完成标志：

- React 不再显式写 group/path 命中递归
- hit / rect query 的规则只有一份

## 阶段 5：UI Schema 收口

目标：

- 收薄 `NodeToolbar.tsx`、`ContextMenu.tsx`、`ToolPalette.tsx`、`node/actions.ts`

实施：

- 建统一 action descriptor
- 建统一 menu preset
- 共享 node type -> name/icon/actions

完成标志：

- toolbar / context menu / shortcut 共用 action schema
- 大文件主要剩渲染组合，不再堆很多条件分支

## 8. 最终目标状态

完成以上阶段后，`whiteboard-react` 应该接近下面这种边界：

### React 侧负责

- DOM
- pointer session
- preview 渲染
- 文本测量
- toolbar / menu / overlay 组合

### Core / Engine / Runtime 底层负责

- transform 参与者与 preview/commit 求解
- edge connect draft 演进与投影
- press target 归一
- rect / point / path / group 的读查询

### 结果

- 大文件数量下降
- 就算文件还不小，内部也更线性
- 交互规则只有一份，不再 React 自己补一套
- 新功能接入时先接到底层模型，而不是继续堆 hook 分支

## 9. 一句话结论

这轮优化不应继续从“拆文件”出发，而应从三个底层模型缺口出发：

- `transform solver`
- `edge connect draft`
- `press target normalization`

再补一个读侧查询收口：

- `node read query`

这四块收完以后，当前 `whiteboard-react` 里最刺眼的大文件会自然变薄，剩下的 UI 大文件再用 schema/preset 收口即可。
