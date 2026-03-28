# Whiteboard Editor Runtime / Action / Chrome 边界长期最优设计

## 1. 文档目标

这份文档只回答一个问题：

**`packages/whiteboard-editor/src` 当前这批 `runtime / session / action / chrome / host helper` 文件，长期最优架构到底应该怎么收敛。**

本文基于这次对 `packages/whiteboard-editor/src` 的结构审查，重点覆盖：

- `features/selection/chrome/layout.ts` 这类“纯函数文件”是否有问题
- `features/node/actions.ts`、`features/selection/chrome/contextMenuModel.ts` 这类“看起来是 model，实际上直接调 command” 的模块是否应该保留
- `runtime/instance/createInstance.ts` 是否已经承担过多业务装配
- `features/selection/actions/clipboard.ts` 这种模块级全局状态是否允许长期存在
- `types/node/registry.ts` 把 React 类型放进 `@whiteboard/editor` 是否合理

本文明确：

- 不考虑兼容成本
- 不保留迁移期双轨目录
- 不为现有 import 习惯设计长期 facade
- 优先角色纯度与边界一致性，而不是优先少改几行代码
- 这轮只给目标架构，不讨论具体改码细节

本文与以下已有文档保持一致，但关注点更窄：

- `WHITEBOARD_EDITOR_PUBLIC_API_AND_SEMANTIC_COMMAND_LONG_TERM_DESIGN.zh-CN.md`
- `WHITEBOARD_REACT_BOUNDARY_LONG_TERM_OPTIMAL_DESIGN.zh-CN.md`
- `docs/2026-03-15/WHITEBOARD_RUNTIME_READ_SESSION_BOUNDARY_DESIGN.zh-CN.md`

---

## 2. 结论

结论先说：

**`layout.ts` 不是因为“纯函数”才有问题。**

真正的问题是：

1. `whiteboard-editor` 里混了太多不同形态的模块，但目录和命名没有把它们区分开。
2. 纯 view-model、语义 action、交互 session、浏览器副作用、React 类型、DOM 测量，被混在同一层甚至同一个文件里。
3. `InternalEditor` 已经变成 feature 可随意越界使用的 God object。
4. 包名叫 `editor`，长期目标也被定义为“框架无关的 editor runtime”，但包内仍然直接依赖 React 类型。

长期最优里，`@whiteboard/editor` 应收敛成下面这套职责：

- `editor` 负责编辑器 runtime 与语义层
- `editor.commands` 仍然是唯一公开写入口
- `feature session` 负责交互期临时态
- `feature projection / model` 负责纯推导
- `feature action spec` 负责描述“可执行什么”，而不是直接闭包 `onClick`
- 浏览器级全局副作用通过 instance-owned service 或 shared service 管理
- React 渲染与 `CSSProperties / ReactNode` 一律离开 `@whiteboard/editor`

一句话概括：

**长期最优不是“把所有东西都 runtime 化”，而是“让每种模块只保留一种形态、一种边界、一种生命周期”。**

---

## 3. 当前结构的真实问题

## 3.1 不是“纯函数太多”，而是“文件形态混杂”

以 `features/selection/chrome/layout.ts` 为例，它现在同时承载了四类完全不同的职责：

- schema/data 读取：
  - `hasSchemaField`
  - `readTextFieldKey`
  - `readTextValue`
- toolbar 语义：
  - `resolveToolbarItemKeys`
  - `buildToolbarItem`
- 布局与定位几何：
  - `resolveToolbarPlacement`
  - `buildToolbarStyle`
  - `buildToolbarMenuStyle`
  - `readContextMenuPlacement`
- DOM 测量：
  - `readMenuAnchor`

这里真正的异味不是“它是函数”，而是：

- schema capability 不该和 toolbar 布局放一起
- 纯 placement 几何不该和 React `CSSProperties` 绑定
- DOM measurement 不该和语义判断放一起

也就是说：

- **纯函数形态是对的**
- **职责混装是错的**

---

## 3.2 model / action / command 边界塌了

当前几个典型模块都存在同一个问题：

- `features/node/actions.ts`
- `features/selection/chrome/contextMenuModel.ts`
- `features/selection/chrome/menuModel.ts`

它们名义上像：

- action builder
- menu model
- context menu model

但实际上直接做了：

- `instance.commands.*` 调用
- selection 替换
- history/clipboard/insert 调度
- close after async 这类 UI 生命周期控制

这会带来三个后果：

1. “model” 不是纯数据，不能稳定复用。
2. UI/chrome 层拿到的不是“描述”，而是一堆闭包行为。
3. 后续如果要换宿主、做 command logging、做 action permission、做插件拦截，会非常难接。

长期最优里应该是：

- `action spec` 描述语义动作
- `command` 执行真实写入
- `menu / toolbar model` 只消费 action spec 并投影成视图数据
- UI close/open 这种宿主生命周期，不进入 action 语义层

---

## 3.3 `createInstance.ts` 已经过厚，不再是纯 composition

`runtime/instance/createInstance.ts` 当前同时负责：

- store 初始化
- runtime read 组装
- interaction / pick / snap 初始化
- `selection/frame/edit` 行为联动
- node appearance/text 语义命令
- insert preset 路由
- clipboard 接线
- finalize 之后的 UI session 收缩
- feature session 实例挂载

这说明它已经不是“最终装配层”，而是“运行时总调度层”。

长期最优里：

- `createEditor.ts` 只能保留 composition
- 具体 command 语义必须拆到独立模块
- instance 文件不应该继续新增 feature 业务规则

换句话说：

**`createEditor` 应该像接线板，不应该像总控室。**

---

## 3.4 `InternalEditor` 是过宽依赖面

当前大量 feature 直接依赖：

- `InternalEditor`
- `instance.commands`
- `instance.read`
- `instance.config`
- `instance.registry`
- `instance.internals.*`

这意味着：

- feature 可以直接碰到底层任何角落
- 没有稳定的最小依赖面
- session/model/action 很难形成严格边界

长期最优里，不同模块只该拿到它们真正需要的最小依赖：

- session 拿 `interaction + viewport + read + session-owned write ports`
- action executor 拿 `commands`
- pure projection 只拿 plain input
- browser service 拿 `document/window` 适配端口

**不能默认把整包 `InternalEditor` 注入给任何 feature。**

---

## 3.5 模块级可变状态不应继续存在

`features/selection/actions/clipboard.ts` 当前把这些东西放成模块级全局：

- `memoryPacket`
- `lastPasteKey`
- `lastPasteCount`

这在长期最优里是错误的，因为它会产生：

- 多 editor 实例相互污染
- 测试顺序依赖
- 隐藏的宿主级状态

长期最优里，clipboard 至少要满足下面两条之一：

1. 明确是 **app-shared service**，并且通过 `createSharedClipboardService()` 注入 editor
2. 明确是 **instance-owned clipboard state**，完全归属于单个 editor

但无论哪种，都不应该是“模块 import 后天然存在的一份状态”。

---

## 3.6 `@whiteboard/editor` 仍然泄漏 React，是明显边界错误

当前 React 依赖不仅来自 `layout.ts` 的 `CSSProperties`，还来自 `types/node/registry.ts`：

- `NodeDefinition.render: (props) => ReactNode`
- `NodeDefinition.style: (props) => CSSProperties`

这直接说明：

- `@whiteboard/editor` 不是纯 editor runtime
- 它的 node registry 已经和 React render registry 混在一起

长期最优里：

- `@whiteboard/editor` 不应 import `react`
- `@whiteboard/editor/package.json` 不应因为 registry/type helper 而声明 React peer
- render registry 必须去 `@whiteboard/react`

这是边界问题，不是“类型小问题”。

---

## 4. 长期最优的总分层

长期最优里，体系应明确分成下面四层：

### 4.1 `@whiteboard/core`

只放：

- 纯类型
- 纯几何
- 纯 selection / snap / edge / node 算法
- schema 相关纯 helper

不放：

- runtime session
- DOM
- React
- editor command orchestration

### 4.2 `@whiteboard/engine`

只放：

- committed document
- committed read
- committed commands
- index/query/projection
- history

不放：

- preview
- transient session
- toolbar/menu
- selection hold/drag policy

### 4.3 `@whiteboard/editor`

只放：

- editor runtime infra
- editor state/read/commands/viewport
- feature session
- feature projection
- feature action spec
- browser host interaction ports 或 browser service

不放：

- ReactNode
- CSSProperties
- JSX render
- 具体组件

### 4.4 `@whiteboard/react`

只放：

- React node render registry
- toolbar/context menu 组件
- DOM refs / CSS style 对接
- React hooks 与组件组合

不放：

- editor 核心交互 session
- command 语义编排主逻辑

---

## 5. `@whiteboard/editor` 包内的最终模块形态

这一节是核心。

长期最优里，`packages/whiteboard-editor/src` 内只应存在下面六种模块形态。

## 5.1 Runtime Infra

职责：

- interaction coordinator
- viewport runtime
- input dispatch
- pick / snap
- finalize
- browser service adapter

特点：

- 跨 feature 复用
- 不表达 node/edge/mindmap 的具体业务语义
- 只负责通用 runtime 设施

命名：

- `createXxxRuntime`
- `createXxxCoordinator`
- `readXxxInput`
- `dispatchXxx`

## 5.2 Feature Session

职责：

- feature-owned transient source
- imperative pointer session
- preview patch source
- hover/hidden/drag temporary state

特点：

- 有状态
- 有生命周期
- 不应被命名成 hook
- 不应直接承担 React/render 逻辑

命名：

- `createXxxSession`
- `createXxxStore`

例如：

- `node drag`
- `node transform`
- `edge connect`
- `selection marquee`
- `mindmap drag`

## 5.3 Feature Projection / Read Model

职责：

- 从 `read/state/session` 推导出最终领域展示态或局部 view data

特点：

- 纯函数
- 无副作用
- 不直接调用 command
- 输入输出应可测试

命名：

- `readXxxView`
- `resolveXxxPresentation`
- `summarizeXxx`

例如：

- `resolveNodeSelectionView`
- `readNodeSummaryView`
- `readToolPaletteView`

## 5.4 Feature Action Spec

职责：

- 描述“当前有哪些动作可以做”
- 提供 label、disabled、tone、grouping、intent

特点：

- 纯描述，不直接写文档
- 不返回闭包 `onClick`
- 不处理 UI close/open

推荐形态示意：

```ts
type EditorActionSpec = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  intent:
    | { kind: 'command'; path: 'node.align'; input: { ids: string[]; mode: 'top' } }
    | { kind: 'command'; path: 'selection.replace'; input: { nodeIds: string[] } }
}
```

谁来执行：

- editor 内部的 `action executor`
- 或 React host 的 `runAction(spec)`

但 action spec 本身不带闭包。

## 5.5 Chrome Spec

职责：

- toolbar/context menu/more menu/filter menu 的纯语义结构
- 只表达“显示什么”
- 不表达“怎么测 DOM”
- 不表达“怎么写 CSSProperties”

特点：

- 可跨 host
- 可序列化/可记录
- 可单测

举例：

- `readNodeToolbarSpec`
- `readContextMenuSpec`
- `readMoreMenuSpec`

## 5.6 Host Adapter / Browser Service

职责：

- DOM measurement
- clipboard bridge
- document selection lock
- pointer capture/document listener

特点：

- 明确是浏览器副作用
- 要么 instance-owned
- 要么 shared service + ref count
- 不伪装成纯 model/helper

命名：

- `createClipboardService`
- `createDocumentSelectionLock`
- `measureMenuAnchor`

---

## 6. 当前几个关键文件，长期最优里应该怎么归位

## 6.1 `features/selection/chrome/layout.ts`

长期最优里不应继续保留成单文件混装。

应至少拆成四块：

1. `node capability / text field read`
2. `toolbar spec`
3. `placement geometry`
4. `host measurement`

建议归位：

- `hasSchemaField` / `readTextFieldKey` / `readTextValue`
  - 进 `features/node/capability.ts` 或 `features/node/read/text.ts`
- `resolveToolbarItemKeys` / `buildToolbarItem`
  - 进 `features/selection/chrome/toolbarSpec.ts`
- `resolveToolbarPlacement` / `readContextMenuPlacement`
  - 进 `features/selection/chrome/placement.ts`
- `buildToolbarStyle` / `buildToolbarMenuStyle`
  - 不留在 `editor`
  - React host 自己把 placement 转成 style
- `readMenuAnchor`
  - 进 `whiteboard-react` 或 `editor/runtime/browser/measure.ts`

结论：

- 纯函数应保留
- 但 `layout.ts` 这个文件不应保留现状

## 6.2 `features/node/actions.ts`

长期最优里，这个文件不应再返回带 `onClick` 的 action item。

应拆成两层：

1. `readNodeSelectionActionSpecs`
   - 纯描述
2. `executeEditorAction` 或 `bindEditorActionSpecs`
   - 执行层

`selection.replace`、`node.align`、`node.group.create`、`history.undo` 这些都应落回 `commands.*`。

## 6.3 `features/selection/chrome/contextMenuModel.ts`

长期最优里应拆成三层：

1. `readContextMenuTargetState`
2. `readContextMenuActionSpecs`
3. `readContextMenuSpec`

不应继续直接承担：

- style command 闭包
- clipboard/insert/history 闭包
- `closeAfter` 绑定

宿主关闭菜单的时机，应由 React UI 自己处理，或者由 action runner 处理，不进入 spec 生成层。

## 6.4 `runtime/instance/createInstance.ts`

长期最优里应退回纯装配层。

建议拆出：

- `runtime/commands/selection.ts`
- `runtime/commands/frame.ts`
- `runtime/commands/draw.ts`
- `runtime/commands/node/appearance.ts`
- `runtime/commands/node/text.ts`
- `runtime/commands/insert.ts`
- `runtime/commands/clipboard.ts`
- `runtime/commands/mindmap.ts`

`createEditor.ts` 只做：

- 初始化 engine adapter
- 初始化 infra
- 初始化 read/state
- 初始化 commands
- 初始化 feature sessions
- 返回 editor 实例

## 6.5 `features/selection/actions/clipboard.ts`

长期最优里必须改成 service/port 形态。

推荐方向：

```ts
type ClipboardService = {
  read(): Promise<ClipboardPacket | undefined>
  write(packet: ClipboardPacket, event?: ClipboardEvent): Promise<boolean>
  nextPastePoint(base: Point, zoom: number): Point
}
```

然后：

- app 级共享，就显式注入 shared service
- editor 级隔离，就每个 editor 一个 service

绝不允许继续靠模块级 `let` 保存跨实例状态。

## 6.6 `types/node/registry.ts`

这是当前最需要明确收边界的点之一。

长期最优里必须拆成两套 registry：

### A. Editor Node Definition

只放：

- `meta`
- `role`
- `hit`
- `connect`
- `schema`
- `defaultData`
- `canRotate`
- `canResize`
- `autoMeasure`
- `enter`

### B. React Node Renderer Registry

只放：

- `render`
- `style`
- React 专属 visual helper

也就是说：

- editor registry = 语义与能力
- react registry = 视图与渲染

两者不能继续放在一个类型里。

## 6.7 `features/node/hooks/transform/session.ts`

长期最优里，这个路径名本身就是错的。

它不是 hook，而是 runtime session。

正确方向：

- 改到 `features/node/session/transform.ts`
- 或 `features/node/runtime/transformSession.ts`

`editor` 包内不应继续出现误导性的 `hooks/` 目录。

---

## 7. 最优目录蓝图

下面给出一个推荐蓝图。

```text
packages/whiteboard-editor/src/
  index.ts
  runtime/
    instance/
      createEditor.ts
      types.ts
    infra/
      interaction/
      input/
      viewport/
      pick/
      snap/
      browser/
        clipboard/
        selectionLock/
    read/
    state/
    commands/
      selection.ts
      frame.ts
      draw.ts
      node/
        appearance.ts
        text.ts
      insert.ts
      clipboard.ts
      mindmap.ts
    finalize/
  features/
    node/
      capability.ts
      summary.ts
      summaryView.ts
      selectionView.ts
      actionSpec.ts
      session/
        node.ts
        drag.ts
        transform.ts
    edge/
      actionSpec.ts
      session/
        connect.ts
        preview.ts
    selection/
      policy/
      session/
        gesture.ts
        marquee.ts
      chrome/
        toolbarSpec.ts
        contextMenuSpec.ts
        placement.ts
    mindmap/
      actionSpec.ts
      session/
        drag.ts
    toolbox/
      presets.ts
      paletteView.ts
  types/
    node/
      editorRegistry.ts
```

而 React 侧承接：

```text
packages/whiteboard-react/src/
  editor/
    chrome/
      toolbar/
      contextMenu/
      placement/
    registry/
      nodeRendererRegistry.ts
```

这个蓝图的关键点不是“目录更细”，而是：

- 每个目录名直接表达形态
- `session`、`spec`、`view`、`commands` 不再混名

---

## 8. Public API 的最终收口建议

结合已有 public API 文档，这一轮额外补充两个收口原则。

## 8.1 `./chrome` 不应继续公开 DOM/CSS helper

如果长期保留 `@whiteboard/editor/chrome`，它只能公开：

- 纯 spec
- 纯 placement 数值几何
- 纯菜单/toolbar 语义类型

不应公开：

- `CSSProperties`
- `ReactNode`
- `HTMLDivElement` / `HTMLButtonElement` 相关 helper
- 宿主 UI 的 close/open 绑定工具

更激进但更干净的方案是：

- 直接取消 `./chrome` public subpath
- 把 chrome 变成 `@whiteboard/react` 的宿主层能力
- editor 只留下 action spec / toolbar spec / menu spec

## 8.2 `./node` 和 `./toolbox` 只保留纯静态能力

这两个 subpath 可以保留，但前提是只承载：

- summary/view
- preset metadata
- shape meta
- capability read
- action spec

一旦某个导出直接依赖 runtime instance 或直接写 command，就不该留在这些静态 subpath。

---

## 9. Browser 全局资源的长期处理方式

长期最优里，下面这些东西都属于“全局资源”，不能继续散落在 feature 文件里：

- clipboard
- document selection lock
- pointer listener capture
- window/document 级事件绑定

正确处理方式只有两种：

### 9.1 Shared Service

适用于：

- 页面级 clipboard
- 页面级 selection lock

要求：

- 显式 create
- 显式注入
- 明确 ref count 或 owner count

### 9.2 Instance-owned Service

适用于：

- 每个 editor 自己的 session temp state
- editor 独占的浏览器桥接能力

要求：

- service 生命周期跟 editor.dispose 对齐
- 不允许模块级静态单例

一句话：

**全局资源可以存在，但必须是“被创建和管理的对象”，不能是“被 import 出来的可变变量”。**

---

## 10. 最终设计规则

后续重构时，建议直接把下面这些规则当成硬约束。

### 10.1 `@whiteboard/editor` 禁止 import `react`

包括：

- `ReactNode`
- `CSSProperties`
- React hooks

### 10.2 `features/*/session/*` 只做 session

禁止：

- 导出 view model
- 导出 React style helper
- 导出菜单 spec

### 10.3 `features/*/*Spec.ts` 只做纯描述

禁止：

- 直接调用 `instance.commands.*`
- 挂 UI close/open 闭包
- 访问 DOM

### 10.4 `runtime/instance/createEditor.ts` 只做 composition

禁止：

- 新增 feature 业务规则
- 新增 node/edge/mindmap 的具体语义分支

### 10.5 `editor.commands` 仍然是唯一写入口

禁止：

- 再造一套 `action` 写入口
- 让 chrome model 直接拼底层 write patch

### 10.6 `editor` 包内不使用 `hooks/` 目录

因为它会误导维护者把 imperative session 当成 React hook。

### 10.7 包级 public subpath 只公开无状态稳定能力

凡是：

- 依赖 instance
- 依赖 DOM
- 依赖宿主 UI 生命周期

都不应优先放 public subpath。

---

## 11. 推荐迁移顺序

如果后面真的按这套最优架构落地，建议按下面顺序做，而不是同时乱拆。

### 第一步：先处理真实风险

- 收掉 clipboard 模块级状态
- 把 document selection lock 改成 shared service / ref count

### 第二步：收 React 泄漏

- 拆 `types/node/registry.ts`
- 让 `@whiteboard/editor` 去掉 React 类型依赖

### 第三步：拆 `createInstance.ts`

- 把 command 语义拆出独立模块
- 保留 `createEditor.ts` 为 composition-only

### 第四步：重分 action / spec / model

- `node/actions.ts` 改成 pure action spec
- `contextMenuModel.ts` 改成 pure menu spec
- `menuModel.ts` 不再负责 close lifecycle

### 第五步：拆 `layout.ts`

- capability / spec / placement / host measurement 分离

### 第六步：收 public API

- 收窄 `./chrome`
- 确认哪些 subpath 值得保留

---

## 12. 一句话标准

当 `packages/whiteboard-editor` 最终收敛到位后，应满足下面这句判断：

**任何一个文件，只看文件名和目录名，就能知道它到底是 session、spec、view、command、browser service，还是 composition。**

如果仍然需要打开源码才能判断“它到底是在做纯推导、在做 command、还是在碰 DOM”，那说明边界还没收干净。

