# Whiteboard React 全面检查与全局收敛方案

## 1. 结论

这轮检查下来，`packages/whiteboard-react` 最重的异味已经不在输入绑定层，而集中在下面四类问题：

1. `selection/context` 相关能力在 `whiteboard-react` 和 `whiteboard-editor` 之间仍然双份建模。
2. text 节点的编辑、预览、测量、提交逻辑仍然大量停留在 React renderer。
3. toolbar / context menu / tool palette 这类 chrome 组件仍然混合了 view model、全局关闭行为、命令分发和布局几何。
4. `Whiteboard.tsx` 继续承担 engine/editor 创建、document 同步、collab 生命周期、runtime configure、canvas composition 等过多职责。

整体判断：

- `whiteboard-react` 当前已经比之前干净不少，尤其 `pointer/keyboard` 主链已经基本回到“React 只做 DOM 绑定，editor 做输入决策”的方向。
- 但 `selection -> toolbar/context menu -> text editing` 这一条链上，仍然存在明显的重复建模、边界污染和隐藏耦合。
- 如果继续在现状上增量加功能，复杂度会优先堆积在 React 层，而不是收敛到 editor/runtime 单一真相源。

## 2. 主要异味

### 2.1 selection/context 双份建模

当前 toolbar 相关路径仍然在 React 侧自己组装 selection summary / selection can / actions / sections：

- `packages/whiteboard-react/src/features/node/selection.ts`
- `packages/whiteboard-react/src/features/node/summary.ts`
- `packages/whiteboard-react/src/features/selection/chrome/selectionMenuActions.ts`
- `packages/whiteboard-react/src/features/selection/chrome/selectionFilter.ts`
- `packages/whiteboard-react/src/features/selection/chrome/selectionSections.ts`

而 context menu 已经直接消费 editor 侧 view model：

- `packages/whiteboard-react/src/features/selection/chrome/ContextMenu.tsx`
- `packages/whiteboard-editor/src/runtime/context/summary.ts`
- `packages/whiteboard-editor/src/runtime/context/view.ts`

这说明当前系统已经形成：

- React toolbar 一套 selection 菜单建模
- editor context menu 一套 selection 菜单建模

而且这两套建模高度同构：

- `summary`
- `can`
- `filter`
- `order/align/distribute/group/ungroup/lock/copy/cut/duplicate/delete`
- `layout/layer/structure/state/edit/danger` 分组规则

这类重复不是 UI 呈现差异，而是完整业务规则重复。后果是：

- 新增一个 selection action，要改两边。
- 修改一个 capability 判定，要改两边。
- React toolbar 和 context menu 很容易出现行为漂移。
- 后续如果继续简化 selection 模型，会被两套调用面拖住。

### 2.2 text 节点行为仍然粘在 React renderer

`packages/whiteboard-react/src/features/node/registry/default/text.tsx` 目前承载了过多职责：

- 节点 definition / schema / style
- contentEditable 编辑生命周期
- draft 状态
- preview patch 写入
- session flush
- commit / cancel / delete 分支
- sticky / text 两种变体共用一个大 renderer

再加上：

- `packages/whiteboard-react/src/features/node/textMeasure.ts`
- `packages/whiteboard-react/src/features/node/textAutoFont.ts`
- `packages/whiteboard-react/src/features/node/hooks/useAutoFontSize.ts`
- `packages/whiteboard-react/src/features/selection/chrome/nodeToolbarText.ts`

目前 text 这条链不是“UI 读取 editor 能力”，而是 React 自己掌握了很多本应属于 runtime 的行为细节：

- 如何写 preview patch
- 何时 flush session
- 空文本是否删节点
- 如何根据 DOM 测量尺寸
- toolbar 改字时如何测量并提交

这会导致 text 节点成为一个“例外系统”：

- 交互逻辑不在 editor 单点
- toolbar 改文本和 inline edit 改文本走不同路径
- 后续如果做非 React host 或 editor 内部统一文本策略，迁移成本很高

### 2.3 toolbar 改文本存在隐藏 DOM 耦合

`packages/whiteboard-react/src/features/selection/chrome/nodeToolbarText.ts` 通过 DOM 查询寻找文本源元素：

- 用 `[data-node-id] [data-node-editable-field]` 反查节点 DOM
- 再基于查到的元素做尺寸测量
- 再把测量结果带回 command

这个设计的问题不是“实现丑不丑”，而是边界本身不稳：

- toolbar 依赖 scene 结构
- toolbar 依赖 renderer 一定已经挂载
- toolbar 依赖 data attribute 不变
- toolbar 依赖可测量 DOM 节点恰好在当前容器中

一旦以后做这些变化，这条链就会变脆：

- Node renderer 重构
- Portal / overlay 分层变化
- 局部虚拟化
- 节点文本从纯 DOM 改为更抽象的 renderer

更合理的边界应该是：

- toolbar 只发“改文本”或“改字号”的 command
- editor/runtime 自己决定是否需要测量、如何测量、如何提交 preview/final size

### 2.4 Whiteboard 根组件职责过重

`packages/whiteboard-react/src/Whiteboard.tsx` 当前同时承担：

- engine 创建
- editor 创建
- document 同步回环处理
- collab session 创建与销毁
- collab callback 追平
- runtime configure
- ref 暴露
- canvas composition

这类文件的问题不是行数，而是“宿主能力全部往这里进”：

- 新增一个 host 级生命周期，第一反应只能继续往这里堆
- document/collab/runtime 三类关注点天然耦合
- 不利于后续把 `Whiteboard` 本身变成薄壳

### 2.5 chrome 组件重复承载 overlay 生命周期

下面几个组件都各自做了窗口级关闭逻辑：

- `packages/whiteboard-react/src/features/toolbox/ToolPalette.tsx`
- `packages/whiteboard-react/src/features/selection/chrome/NodeToolbar.tsx`
- `packages/whiteboard-react/src/features/selection/chrome/ContextMenu.tsx`

共同模式基本都是：

- `window.pointerdown` 关闭
- `Escape` 关闭
- 根元素内点击忽略

这说明系统还缺少统一的 overlay/menu controller。短期看只是重复代码，长期问题是：

- dismiss 语义不统一
- ignore target 规则可能漂移
- 嵌套菜单、submenu、portal 规则会越来越难统一

### 2.6 ToolPalette 是 mega component

`packages/whiteboard-react/src/features/toolbox/ToolPalette.tsx` 当前同时做：

- 工具状态派生
- “上一次 draw kind / edge preset” 记忆
- 浮层几何估算
- 全局关闭行为
- 具体工具命令分发
- 实际按钮与菜单渲染

这说明它还不是一个“palette 宿主 + 配置模型”的结构，而是一个继续堆逻辑的总装点。后续每加一个工具、preset、浮层规则，都只会继续膨胀这里。

## 3. 当前哪些地方已经相对健康

这轮检查里，有几块不算当前最高优先级：

### 3.1 输入主链已经基本回到 editor

- `packages/whiteboard-react/src/canvas/usePointer.ts`
- `packages/whiteboard-react/src/canvas/useKeyboard.ts`

现在 React 主要负责：

- 绑定 DOM 事件
- 转给 `editor.commands.input.*`
- 处理少量容器 focus / ignore target 规则

这条方向是对的。除非后面要继续统一 clipboard / wheel / focus policy，否则这里不是当前最重的异味。

### 3.2 public export 面已经比之前干净

`packages/whiteboard-react/src/index.ts` 现在公开面已经比较收敛：

- `Whiteboard`
- `useEditor`
- node registry 相关能力
- `WhiteboardInstance`

相对之前那种多层纯转发和过多内部导出，现在已经好很多。

## 4. 收敛原则

后续优化建议统一遵守下面四条：

### 4.1 editor 负责行为与业务 view model

凡是带下面特征的，都优先下沉到 editor：

- capability 判定
- selection/context action 组装
- 交互状态机
- preview / commit 策略
- 需要多个 UI 消费的 menu model

React 只保留：

- DOM 绑定
- 几何读取
- 视觉呈现
- 很薄的事件转发

### 4.2 React 不要再维护第二套 summary/can/action 语义

如果 context menu 和 node toolbar 面向的是同一份 selection 事实，那么：

- summary 只应有一份
- can 只应有一份
- action 只应有一份
- filter / sections / groups 只应有一份

差异只应该存在于“如何显示”，不应该存在于“动作怎么定义”。

### 4.3 文本编辑能力要变成 editor/runtime 能力，而不是 renderer 私有协议

最需要避免的是：

- React renderer 直接写 patch
- toolbar 直接查 DOM 再帮 editor 做测量
- inline edit 和 toolbar edit 两套文本提交路径

应该统一成：

- React 只提供输入值和必要的 DOM 测量上下文
- editor 负责 text preview / measure / commit 的流程收口

### 4.4 overlay 的关闭语义应该统一

所有浮层都应尽量共享一套基础语义：

- outside press close
- escape close
- ignore attrs
- dismiss reason

否则看起来是三四个小组件，实际上是在系统里隐性维护三四套交互协议。

## 5. 推荐落地顺序

### 阶段 1：先统一 selection/context 为 editor 单一真相源

目标：

- toolbar 和 context menu 共享 editor 侧 selection view model
- 删除 React 侧重复的 `summary/can/actions/sections/filter`

建议方向：

1. 在 `whiteboard-editor` 提供 selection menu / toolbar 可复用的最小 view model。
2. React toolbar 改为直接消费 editor 侧 view model，而不是自己重建一份。
3. React 侧删除这些重复模块或将其压缩为纯 UI type：
   - `features/node/summary.ts`
   - `features/selection/chrome/selectionMenuActions.ts`
   - `features/selection/chrome/selectionFilter.ts`
   - `features/selection/chrome/selectionSections.ts`

完成后收益：

- selection 语义只剩一份
- toolbar/context menu 不再漂移
- 后续继续简化 selection 模型时，修改面会明显缩小

### 阶段 2：把 text preview / measure / commit 主链下沉到 editor

目标：

- React renderer 不再直接操作 `host.node.patch/session`
- toolbar 不再 DOM 查询节点文本源元素来完成提交

建议方向：

1. editor 提供统一的 text 编辑命令或 session：
   - 开始编辑
   - 写入 preview
   - 提交文本
   - 取消编辑
   - 带测量信息提交
2. React renderer 只保留：
   - contentEditable DOM
   - 输入事件
   - 焦点行为
3. toolbar 文本修改走同一条 editor text command，不再自己判断 text node 特例。
4. `textMeasure` / `textAutoFont` 要么进入 editor，要么变成 editor 主导、React 提供 DOM host 的明确能力。

完成后收益：

- text 节点不再是一个 React 私有行为系统
- inline edit 与 toolbar edit 会统一
- 未来如果替换 renderer 或支持非 React host，不需要再抄一套文本逻辑

### 阶段 3：拆薄 Whiteboard 根组件

目标：

- `Whiteboard.tsx` 只剩“组合”

建议拆分：

1. `useEngineRuntime` 或等价 host runtime 组装层
2. `useDocumentSync`
3. `useCollabSessionLifecycle`
4. `useEditorRuntimeConfig`
5. `WhiteboardCanvas`

注意：

- 不要把业务逻辑塞回 hook 里变成新的 mega hook。
- 每个 hook 只处理单一生命周期问题。

完成后收益：

- host 级能力可以分别演进
- `Whiteboard` 组件本身回到薄壳

### 阶段 4：统一 overlay/menu controller

目标：

- `ToolPalette` / `NodeToolbar` / `ContextMenu` 不再各自维护一套 outside-press / escape 关闭逻辑

建议方向：

1. 抽一个非常薄的 overlay lifecycle 工具层。
2. 统一：
   - root contains 判定
   - outside press close
   - escape close
   - ignore attr 语义
   - dismiss reason
3. submenu state 是否保留在组件内，可以视情况决定；但基础关闭行为应统一。

### 阶段 5：重构 ToolPalette 为“宿主 + 工具描述”

目标：

- `ToolPalette.tsx` 不再继续长大

建议方向：

1. 把工具定义、preset 视图、菜单几何、点击命令分发拆开。
2. `ToolPalette` 只负责：
   - 当前打开哪个面板
   - 布局容器
   - 渲染按钮和面板
3. 每种工具各自提供：
   - 按钮图标
   - 激活态
   - 面板内容
   - 选择 preset 后的命令

完成后收益：

- 新增工具不再必须改一个 600+ 行组件
- 逻辑结构会更接近“配置式 palette”

## 6. 建议删除或收缩的 React 侧重复层

### 第一优先级

- `packages/whiteboard-react/src/features/node/summary.ts`
- `packages/whiteboard-react/src/features/selection/chrome/selectionMenuActions.ts`
- `packages/whiteboard-react/src/features/selection/chrome/selectionFilter.ts`
- `packages/whiteboard-react/src/features/selection/chrome/selectionSections.ts`

前提是 editor 侧先补齐统一 view model。

### 第二优先级

- `packages/whiteboard-react/src/features/selection/chrome/selectionMenu.ts`

这个文件目前更像聚合转发层。等上面几块收口后，它大概率也会自然消失或大幅缩小。

### 第三优先级

- `packages/whiteboard-react/src/features/node/text.ts`

这个文件现在是 text 相关能力的导出集合，本身问题不大，但里面混合了：

- core 的常量
- editor 的 node helper
- react 本地的 textContent / textMeasure / textAutoFont

如果 text 链条下沉到 editor，这里也应该一起重新收口。

## 7. 建议保留在 React 的部分

不是所有东西都要往 editor 里搬。下面这些仍然适合留在 React：

- `canvas/usePointer.ts` 这类 DOM 事件绑定
- `canvas/useKeyboard.ts` 中容器 focus 行为
- overlay 的视觉布局和渲染
- node renderer 本身的 JSX 呈现
- 与 DOM 强相关、且只服务视觉的布局几何计算

判断标准很简单：

- 如果是“系统行为规则”，放 editor。
- 如果是“如何画出来”，放 React。

## 8. 最终建议

如果只能选一个方向先动，优先做：

1. `selection/context` 单一真相源收口到 editor
2. text 编辑主链收口到 editor

这两项解决之后，`whiteboard-react` 的大部分“重异味”都会自然下降。因为当前最重的问题不是单个大文件，而是：

- React 还在保存一份业务规则
- React 还在承担一部分 runtime 行为

把这两件事收回来之后，再拆 `Whiteboard.tsx` 和 `ToolPalette.tsx`，复杂度下降会更明显，也更稳。
