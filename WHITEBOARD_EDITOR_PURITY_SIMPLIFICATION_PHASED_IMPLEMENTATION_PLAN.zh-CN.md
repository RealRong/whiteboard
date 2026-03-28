# Whiteboard Editor 纯化简化分阶段实施方案

## 1. 文档目标

这份文档只回答一个问题：

**如果接下来要把 `packages/whiteboard-editor` 纯化成最小职责的 editor runtime，具体应该分几阶段做、每阶段做什么、哪些东西该留、该移、该砍。**

本文是实施文档，不再重复讨论“目标设计是否正确”，而是直接回答：

- `editor` 的最小职责到底是什么
- 哪些东西不应该继续留在 `editor`
- 哪些东西留在 `react` 侧反而更简单
- 哪些当前抽象应该直接删掉
- 分阶段改造的正确顺序是什么

本文默认并延续以下文档的结论：

- [WHITEBOARD_EDITOR_PUBLIC_API_AND_SEMANTIC_COMMAND_LONG_TERM_DESIGN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_EDITOR_PUBLIC_API_AND_SEMANTIC_COMMAND_LONG_TERM_DESIGN.zh-CN.md)
- [WHITEBOARD_REACT_BOUNDARY_LONG_TERM_OPTIMAL_DESIGN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_REACT_BOUNDARY_LONG_TERM_OPTIMAL_DESIGN.zh-CN.md)
- [WHITEBOARD_EDITOR_RUNTIME_ACTION_CHROME_BOUNDARY_OPTIMAL_DESIGN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_EDITOR_RUNTIME_ACTION_CHROME_BOUNDARY_OPTIMAL_DESIGN.zh-CN.md)

本文额外强调一个执行原则：

**这轮重构优先“变简单”，不是优先“再造一套更抽象的中间层”。**

也就是说：

- 不为了形式优雅提前引入通用 action engine
- 不为了目录对称保留 public subpath
- 不为了“未来可能复用”把 React-only 的 chrome/model 硬塞回 `editor`

---

## 2. 一句话结论

长期最优里，`@whiteboard/editor` 应该被纯化成：

**一个负责交互运行时、feature session、interactive projected read、语义化 command 与最小 host bridge 的 editor runtime。**

更具体地说，`editor` 的核心只应该保留五类东西：

1. 交互运行时基础设施  
   例如 input / gesture / interaction / pick / snap / viewport / finalize。

2. feature-owned transient session  
   例如 node drag、node transform、edge connect、selection marquee、mindmap drag、preview store。

3. interactive projected read  
   即 committed 状态与 transient/session 状态合并后的最终交互态 read。

4. 语义化 command 面  
   `editor.commands` 仍然是唯一写入口。

5. 最小 browser/host bridge  
   例如 clipboard port、document selection lock、pointer capture 之类的宿主桥接，但必须以 service/port 形态存在。

不属于这五类的东西，原则上都不应该继续留在 `editor`。

这里额外把最容易混淆的一点固定下来：

**长期最优里，最小宿主桥接留在 `editor`，不留在 `react`。**

但这句话要严格限缩。

`react` 仍然保留：

- host binding
- UI binding
- DOM measurement
- 文本测量
- toolbar/context menu/palette 的视觉层与生命周期

也就是说：

- `editor` 保留的是 **runtime-critical host bridge**
- `react` 保留的是 **host binding + UI binding**

两者不是一个概念。

---

## 3. `editor` 的最小职责

## 3.1 必须留在 `editor` 的

### A. 交互运行时

这部分决定“交互对不对”，必须留在 `editor`：

- `runtime/interaction/*`
- `runtime/input/*`
- `runtime/pick/*`
- `runtime/viewport/*`
- `runtime/finalize.ts`
- `runtime/selection/policy.ts`

这些能力共同负责：

- pointer / keyboard 输入翻译
- press / drag / hold / cancel 生命周期
- pointer capture 与 interaction busy 状态
- auto-pan
- snap / hit-test / pick
- interaction 结束后的 editor state 收束

这层如果挪去 React，`react` 就会再次长成 editor runtime。

### B. feature session

这部分负责“交互过程中暂时发生了什么”，必须留在 `editor`：

- `features/node/session/node.ts`
- `features/node/drag/session.ts`
- `features/node/hooks/transform/session.ts`  
  但要改路径名，不能继续叫 `hooks`
- `features/edge/connectSession.ts`
- `features/edge/preview.ts`
- `features/selection/marquee.ts`
- `features/selection/gesture.ts`
- `features/mindmap/dragSession.ts`
- `features/mindmap/session/drag.ts`

它们属于典型的 feature-owned transient source：

- 有状态
- 有 session 生命周期
- 驱动 preview
- 直接参与交互正确性

### C. interactive projected read

这是 `editor` 最关键、也是最容易被做薄或做歪的一层。

`editor.read` 长期最优里不应只是：

- engine committed read

也不应变成：

- toolbar/menu/palette/chrome 的 UI read

它应该是：

**committed document + transient session 合并后的最终领域交互态 read。**

也就是说，`editor.read` 应负责：

- node 在 preview patch 下的最终几何
- edge 在 reconnect/preview 下的最终 endpoints/route
- bounds / pick / snap 所消费的最终交互态对象
- selection / frame / edit 对最终交互态的统一读取

但 `editor.read` 不应该负责：

- toolbar item
- context menu section
- palette 展开状态
- 文案与图标选择

### D. 语义化 commands

`editor.commands` 继续是唯一写入口。

这部分可以保留：

- `selection`
- `frame`
- `tool`
- `edit`
- `viewport`
- `node`
- `edge`
- `insert`
- `clipboard`
- `mindmap`

但它们必须收敛成：

- 语义动作
- 文档或 runtime 写入口

而不是：

- UI item builder
- menu action model
- toolbar 事件胶水层

### E. 最小宿主桥接

下面这些东西不是 React 组件逻辑，但也不是纯算法，因此仍可留在 `editor`，前提是改成显式 service/port：

- clipboard port / bridge
- document selection lock
- pointer session continuation
- browser-level input target semantics

这类能力的原则是：

- 可以 browser-specific
- 不能模块级隐式共享
- 必须被创建、注入、dispose

这里进一步明确：

#### 必须留在 `editor` 的宿主桥接

1. `clipboard`
   - 因为 `clipboard` 是正式 command 域的一部分。
   - `copy/cut/paste` 的语义与 runtime 写入口必须留在 `editor`。
   - 真正的浏览器 clipboard IO 通过 port/service 注入 `editor`。

2. `document selection lock`
   - 这属于交互正确性问题，不是 UI 偏好。
   - 应作为 `editor` 的 browser service 存在，而不是 React 组件 helper。

3. `pointer session continuation`
   - 包括 pointer capture、window 级 `pointermove/up/cancel`、blur/cancel 协调。
   - 这属于 active session 生命周期的一部分。
   - 如果搬去 `react`，`react` 就会重新掌握 interaction session 引擎。

4. `browser-level input target semantics`
   - 例如 editable target / ignored target / keyboard ignored target 这类输入语义判断。
   - 它们服务的是 input translation，不是视觉层。

#### 不属于最小宿主桥接、应留在 `react` 的

- React 事件绑定与 effect 生命周期
- DOM ref measurement
- 文本测量
- toolbar/menu/palette 的布局与 portal
- `CSSProperties` style helper
- focus/open/close 等 UI 生命周期
- renderer registry

一句话：

**凡是为了交互正确性存在的宿主能力，留在 `editor`；凡是为了 UI 呈现与组件生命周期存在的宿主能力，留在 `react`。**

---

## 4. 不应该继续留在 `editor` 的

## 4.1 React 渲染 registry

当前 [registry.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/types/node/registry.ts) 把下面这些都塞进 `NodeDefinition`：

- `render: ReactNode`
- `style: CSSProperties`

这会导致：

- `@whiteboard/editor` 永远依赖 React
- registry 同时承担语义定义与渲染职责

长期最优里必须拆成两套：

1. `editor` 侧 semantic registry  
   只保留 `meta / role / hit / connect / schema / canResize / canRotate / enter / autoMeasure / defaultData`

2. `react` 侧 renderer registry  
   负责 `render / style / visual mapping`

## 4.2 chrome / menu / toolbar / palette model

下面这些能力留在 `react` 侧更简单，不值得继续保留在 `editor`：

- `features/selection/chrome/*`
- `features/toolbox/paletteModel.ts`
- `node toolbar`
- `context menu`
- `more menu`
- `tool palette`

原因很直接：

- 当前实际宿主只有 React
- 这些能力本质是“显示什么 UI”
- 它们高度依赖 label / icon / close policy / ref measurement / portal placement

这些都不是 editor runtime truth。

## 4.3 DOM measurement 与 CSS helper

下面这些能力不该继续留在 `editor`：

- `readMenuAnchor`
- `buildToolbarStyle`
- `buildToolbarMenuStyle`
- 一切返回 `CSSProperties` 的 helper

`editor` 最多可以输出：

- placement 数值
- screen/world 坐标
- interaction mode

但不该直接生成 DOM style object。

## 4.4 UI 文案与选项表

下面这些属于 UI 产品配置，不属于 editor runtime：

- color options
- stroke width options
- opacity options
- font size options
- summary title/detail 文案
- shape menu sections

这类东西可以留在 `react`，或放到更贴近 UI 的静态模块中。

## 4.5 菜单关闭与异步 close 生命周期

例如：

- `closeAfter`

这类 helper 是当前 menu model 形态不对的副产品，不应保留为长期概念。

菜单点完是否关闭、异步完成何时关闭，属于宿主 UI 生命周期，不属于 editor 语义层。

## 4.6 React 侧的 host binding / UI binding

下面这些能力虽然也“与宿主有关”，但不属于最小宿主桥接，而是宿主绑定或 UI 绑定，因此长期最优里留在 `react` 更合理：

- `onPointerDown / onWheel / onKeyDown / onContextMenu` 这类组件事件绑定
- refs 与 effect 注册/清理
- DOM `getBoundingClientRect()` 测量
- 文本输入后的尺寸测量
- toolbar / context menu / palette 的 open/close/focus
- placement 到 style 的最后一跳
- React renderer registry

这些能力的共同点是：

- 它们不决定 session 是否成立
- 不决定 interactive preview 是否正确
- 不决定 command 域是否完整

所以它们不应算作 `editor` 的宿主桥接。

---

## 5. 应该直接砍掉或合并掉的概念

这部分不是“搬家”，而是“不要继续存在”。

## 5.1 当前形态的 `NodeActionItem / NodeSelectionActions`

当前 [actions.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/features/node/actions.ts) 返回的是：

- 带 `label`
- 带 `disabled`
- 带 `tone`
- 带 `onClick`

这是一种混合概念：

- 一半是语义动作
- 一半是 UI item
- 一半是 command executor

长期最优里这层不值得保留。

更简单的方向是：

- React 直接基于 `summarizeNodes`、`resolveNodeSelectionCan`、`editor.commands` 组装本地 UI

只有未来出现明确的多宿主共享需求时，才再考虑抽象成纯 `action spec`。

## 5.2 `editor` 内部的 `hooks/` 目录

`editor` 包不是 React 包。

像 [transform/session.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/features/node/hooks/transform/session.ts) 这种路径名本身就该消失。

应直接改成：

- `session/transform.ts`
- 或 `runtime/transformSession.ts`

## 5.3 `@whiteboard/editor/chrome` 这条 public subpath

当前这条导出面会诱导外部消费大量 UI-oriented helper。

长期最优里建议：

- 要么彻底删除 `./chrome`
- 要么只保留极少数与 React 无关的纯语义 spec

如果没有跨宿主价值，直接删是更简单的方案。

## 5.4 模块级共享可变状态

例如 clipboard 里的：

- `memoryPacket`
- `lastPasteKey`
- `lastPasteCount`

这类状态不应继续存在。

---

## 6. 应该留在 `react` 侧，且留在那边更简单的

这一节很重要，因为它直接决定我们不该在 `editor` 里过度抽象。

## 6.1 toolbar / context menu / palette 全部 UI 组合层

这些能力如果只有 React 在用，就直接留在 React：

- 分组
- label
- icon
- submenu
- open/close
- hover/highlight
- layout/portal
- ref measurement

没必要先在 `editor` 里抽一层 model，再由 React 渲染。

## 6.2 基于 `editor.read + editor.state + editor.commands` 的本地 UI helper

例如：

- 当前 selection 能不能 fill/stroke/text
- 当前 summary 标题怎么写
- 当前 context menu 显示哪些 section

这些都可以在 React 本地组合：

- `summarizeNodes`
- `resolveNodeSelectionCan`
- `editor.read.selection.get()`
- `editor.commands.*`

而不是必须保留一个 `editor` 内部 action builder。

## 6.3 placement 到 style 的最后一跳

哪怕 `editor` 输出了 placement 数值，下面这一步也应留在 React：

- 转成 `left/top/transform`
- 和容器尺寸、portal、动画一起组合

原因是这一步天然和 DOM/CSS 绑定。

## 6.4 host binding 与 UI binding

React 长期最优里应明确保留：

- DOM 事件到 `editor` 输入协议的接线
- refs 与 layout/effect 生命周期
- DOM measurement
- 文本测量
- menu / toolbar / palette 的视觉层逻辑

但 React 不应重新接管：

- active session 生命周期
- pointer continuation
- global selection lock
- clipboard command 语义

也就是说：

- `react` 负责把 DOM/React 生命周期翻译给 `editor`
- `editor` 负责消费这些输入并维持唯一交互事实源

---

## 7. 分阶段实施

下面给出推荐顺序。

原则是：

- 先消真实风险
- 再收边界
- 再做提纯
- 最后收 public surface

## 阶段 0：冻结目标与建立护栏

### 目标

把“最终什么留在 editor、什么不留”先固定下来，避免边改边漂。

### 要做的事

1. 以本文和长期设计文档为基线，给 `editor` 内每个 public export 打标签：
   - keep in editor
   - move to react
   - delete
   - split
2. 明确三条硬约束：
   - `@whiteboard/editor` 禁止 import `react`
   - `editor` 包内禁止新建 `hooks/` 目录
   - 禁止新增模块级共享可变状态
3. 明确宿主边界：
   - runtime-critical host bridge 留在 `editor`
   - host binding / UI binding 留在 `react`
4. 给当前目录列一份实际迁移清单。

### 交付物

- 迁移台账
- 架构约束说明

### 退出标准

- 每个关键文件都被归类
- 后续阶段不再反复讨论“这东西到底该放哪”

## 阶段 1：先消掉跨实例与全局副作用风险

### 目标

先处理最容易出真实 bug 的部分。

### 要做的事

1. 把 clipboard 从模块级状态改成显式 service/port。
2. 把 document selection lock 改成 shared service 或 ref-counted service。
3. 把 pointer continuation 从 coordinator 里的散落实现收敛为 browser service 或明确的 host bridge 模块。
4. 统一 browser-global 能力的创建与 dispose 入口。

### 本阶段不做

- 不做 chrome 提纯
- 不做大规模 public API 清理
- 不做 action model 重写

### 交付物

- instance-owned 或 shared clipboard service
- document selection lock service
- pointer continuation/browser bridge service

### 退出标准

- 多 editor 实例不再互相污染 copy/paste 状态
- 两个 editor 并发交互不会把页面 `userSelect` 留在错误状态

## 阶段 2：把 `editor.read` 收敛成真正的 interactive projected read

### 目标

把 `editor` 的核心身份先站稳。

### 要做的事

1. 审视 `runtime/read/*` 与各 feature session 的关系。
2. 确保 node / edge / bounds / hit-test / snap 所依赖的是最终交互态，而不是部分 committed、部分 UI 自己拼 preview。
3. 禁止把 toolbar/menu/palette 这类 chrome read 塞进 `editor.read`。
4. 让 React 消费 `editor.read` 时，不再自己重复拼 committed + transient。

### 本阶段不做

- 不把 UI chrome 搬进 read
- 不新建“统一 runtime.session 顶层公开面”

### 交付物

- 清晰的 projected read 责任边界
- 统一的 node/edge preview 投影路径

### 退出标准

- 组件层不再到处手工合并 draft/session
- `editor.read` 只表达领域交互态，不表达 chrome UI

## 阶段 3：拆 React 泄漏，先拆 registry

### 目标

让 `editor` 不再因为 registry/type helper 依赖 React。

### 要做的事

1. 拆 [registry.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/types/node/registry.ts)：
   - semantic registry 留在 `editor`
   - renderer registry 去 `react`
2. 从 `editor` 类型面移除：
   - `ReactNode`
   - `CSSProperties`
3. 清理 `package.json` 里由此产生的 React peer 依赖。

### 本阶段不做

- 不同时重构全部 chrome 文件

### 交付物

- editor semantic registry
- react renderer registry

### 退出标准

- `packages/whiteboard-editor/src` 不再 import `react`
- `@whiteboard/editor` 的概念上成为真正的框架无关 editor runtime

## 阶段 4：把 React-only 的 chrome / presentation / layout 全部挪出去

### 目标

把真正只属于 React host 的内容移出 `editor`。

### 要做的事

1. 移出 `features/selection/chrome/*`
2. 移出 `features/toolbox/paletteModel.ts`
3. 移出 `summary title/detail` 这类 UI 文案 helper
4. 移出 `options.ts` 这类 UI 选项表
5. 移出 DOM measurement 与 `CSSProperties` helper
6. 明确把 host binding / UI binding 放回 `react`

### 特别原则

这一步优先“直接搬到 React 并变简单”，而不是先在 `editor` 内引入一层更通用的 spec/model。

### 本阶段不做

- 不引入通用 action spec engine
- 不为了复用先造抽象

### 交付物

- React host 自己持有 toolbar/context menu/palette 相关 helper
- `editor` 侧不再包含 UI-oriented chrome 文件

### 退出标准

- `editor` 中不再出现返回 `CSSProperties` 的 helper
- `editor` 中不再出现 DOM ref measurement helper
- `chrome.ts` 可以开始收缩或准备删除

## 阶段 5：收紧 `editor` 内部边界，消灭 God object 依赖

### 目标

让 feature 不再默认吃整包 `InternalEditor`。

### 要做的事

1. 把 `createInstance.ts` 中的 command 语义拆出独立模块：
   - selection
   - frame
   - draw
   - node appearance
   - node text
   - insert
   - clipboard
   - mindmap
2. 让 `createEditor.ts` 回归 composition-only。
3. 为 session/read helper 定义最小依赖 port，而不是整包 `InternalEditor`。
4. 重命名 `hooks/` 为 `session/` 或 `runtime/`。

### 本阶段不做

- 不同时改 UI 组件
- 不为了类型漂亮再造第二套 runtime namespace

### 交付物

- 拆分后的 command 模块
- 更窄的 feature 依赖面

### 退出标准

- `createEditor.ts` 不再承载具体业务规则
- 大部分 feature 模块不再直接依赖完整 `InternalEditor`

## 阶段 6：删除当前 action/model 中间层，React 直接消费语义 read + commands

### 目标

把“看起来像 action，其实只是 UI item + onClick”的层删掉。

### 要做的事

1. 删除当前形态的 `NodeActionItem / NodeActionSection / NodeSelectionActions`。
2. React toolbar/menu 直接使用：
   - `summarizeNodes`
   - `resolveNodeSelectionCan`
   - `editor.read`
   - `editor.commands`
3. 如果存在局部重复，优先在 React 内部补本地 helper，而不是回流到 `editor`。

### 明确延后

只有在未来出现真实的多宿主共享需求时，才考虑引入纯 `action spec`。

当前阶段不做这件事。

### 交付物

- 更直接的 React UI 组合方式
- 更少的中间抽象

### 退出标准

- `editor` 中不再有“菜单 item + onClick + command 闭包”这类混合模型
- React UI 通过 editor 语义能力直接完成组合

## 阶段 7：收 public API，删除不值得公开的 subpath

### 目标

让对外公开面与实际职责一致。

### 要做的事

1. 删除或显著收窄 `./chrome`
2. 收窄 `./node`
3. 收窄 `./toolbox`
4. 不再为内部目录对称保留 subpath
5. 只保留有跨 host 真实价值的纯静态能力

### 退出标准

- `@whiteboard/editor` 的 public API 不再暴露 React-only helper
- 包级 subpath 不再镜像内部目录结构

---

## 8. 文件级落点清单

下面给出本轮最关键文件的建议去向。

### 留在 `editor`

- `runtime/interaction/*`
- `runtime/input/*`
- `runtime/pick/*`
- `runtime/viewport/*`
- `runtime/read/*`
- `runtime/selection/*`
- `runtime/finalize.ts`
- `features/node/session/node.ts`
- `features/node/drag/session.ts`
- `features/node/hooks/transform/session.ts`  
  但要重命名目录
- `features/edge/connect.ts`
- `features/edge/connectSession.ts`
- `features/edge/preview.ts`
- `features/selection/marquee.ts`
- `features/selection/gesture.ts`
- `features/mindmap/session/drag.ts`
- `features/mindmap/dragSession.ts`
- `features/mindmap/commands.ts`
- `features/toolbox/insert.ts`
- `features/toolbox/presets.ts`  
  若其仍然承担 editor 语义 preset
- `features/node/summary.ts` 中的纯语义部分
- `runtime/browser/*` 或等价的 host bridge/service 模块  
  其中包括 clipboard port、selection lock、pointer continuation

### 移到 `react`

- `features/selection/chrome/*`
- `features/toolbox/paletteModel.ts`
- `types/node/registry.ts` 里的 render/style 部分
- `summary.ts` 中的 title/detail 文案部分
- `summaryView.ts`  
  如果只是 UI summary view
- `node/selection.ts` 中的 presentation/chrome 部分
- `options.ts`
- `shape.ts` 中纯 UI menu/palette 部分
- DOM measurement / text measurement / placement-to-style helper
- host binding hooks 与 DOM event wiring

### 直接删除或合并

- `chrome.ts`  
  在 chrome 完成迁移后删除或极限收缩
- `closeAfter`
- 当前形态的 `NodeActionItem / NodeActionSection / NodeSelectionActions`
- `hooks/` 目录
- 所有 DOM + `CSSProperties` style builder

### 改造成 service / port

- `features/selection/actions/clipboard.ts`
- `runtime/interaction/coordinator.ts` 中 document selection lock 相关逻辑
- `runtime/interaction/coordinator.ts` 中 pointer capture / window listener / blur 协调相关逻辑

---

## 9. 执行时的反模式

后续实施时，明确避免下面这些错误做法。

### 9.1 不要把 React-only 的东西先抽成 editor 中间层再搬

如果一个东西本来就只在 React 用，最简单的做法通常就是：

- 直接搬去 React

不要先在 `editor` 里抽成 `spec/model/builder` 再绕一圈。

### 9.2 不要为了“未来多宿主”提前上 action framework

当前最优是简化，而不是再造一层：

- `action registry`
- `action dispatcher`
- `command metadata engine`

除非后面真有明确需求，否则不做。

### 9.3 不要把 chrome read 塞进 `editor.read`

`editor.read` 只做 interactive domain read，不做：

- toolbar read
- context menu read
- palette read

### 9.4 不要把所有 session 再提升成统一顶层 namespace

feature session 继续 feature-owned。

不要再造一个膨胀的：

- `editor.session.node`
- `editor.session.edge`
- `editor.session.selection`

公开大命名空间。

---

## 10. 最终完成标准

当这份方案全部完成后，`@whiteboard/editor` 应满足下面这些标准：

1. `editor` 包内不再 import `react`
2. `editor.read` 是 interactive projected read，而不是 chrome read
3. `editor.commands` 是唯一写入口
4. 所有 feature session 都是 feature-owned，不再伪装成 hook
5. browser-global 能力都以 service/port 形式管理，不再有模块级共享可变状态
6. toolbar/context menu/palette 等 UI 组合全部回到 `react`
7. runtime-critical host bridge 留在 `editor`，host binding / UI binding 留在 `react`
8. public API 不再公开 React-only helper 或内部目录镜像层

一句话总结：

**最终的 `editor` 应该只关心“交互正确性”和“语义写入”，不再关心“UI 看起来像什么”。**
