# Whiteboard Editor Public API 与语义化 Command 长期最优设计

## 1. 文档目标

这份文档只回答两个问题：

1. `@whiteboard/editor` 的包级公开 API 到底应该怎么设计
2. editor 层的语义化 `action / command` 应该怎么分层、怎么命名

本文明确：

- 不考虑兼容成本
- 不保留迁移期双轨 API
- 不为历史调用面设计过渡 facade
- 优先长期稳定的职责边界，而不是优先少改代码
- 目标不是“导出更少”，而是“公开面与职责面一致”

本文默认以下前提已经成立：

- `@whiteboard/editor` 是框架无关的 editor runtime
- `@whiteboard/react` 只是 React host binding + render
- `@whiteboard/engine` 仍然负责 committed document runtime
- `node.update` 的 canonical mutation 方向，遵循 [NODE_UPDATE_LONG_TERM_OPTIMAL_DESIGN.zh-CN.md](/Users/realrong/whiteboard/NODE_UPDATE_LONG_TERM_OPTIMAL_DESIGN.zh-CN.md)

---

## 2. 结论

结论先说：

**长期最优里，主公开 API 应该是有状态的 `editor` 实例。**

也就是说，对外应收敛成：

```ts
import { createEditor } from '@whiteboard/editor'

const editor = createEditor(...)

editor.commands...
editor.read...
editor.state...
editor.viewport...
```

而不是让外部主要依赖一堆散落的 helper import。

但这里要严格区分两件事：

- **运行时实例对象**
- **包级模块导出**

长期最优里：

- **实例级 API：`editor.commands / editor.read / editor.state / editor.viewport`**
- **包级 API：`createEditor` + 少量稳定类型**
- **可选 subpath：只承载无状态、纯函数、跨 host 可复用的静态能力**

也就是：

- 运行时对象层保留：
  - `editor.commands.node`
  - `editor.commands.selection`
  - `editor.commands.clipboard`
  - `editor.read.selection`
  - `editor.state.tool`
- 包入口层只负责：
  - `createEditor`
  - `type Editor`
  - 少量稳定类型
- 只有满足“无状态 + 非 runtime 生命周期 + 可跨 host 复用”的能力，才考虑放到 subpath：
  - `@whiteboard/editor/node`
  - `@whiteboard/editor/toolbox`
  - `@whiteboard/editor/chrome`
  - `@whiteboard/editor/input`
  - `@whiteboard/editor/tool`
  - `@whiteboard/editor/types`

也就是说：

- 凡是有状态 runtime 能力，一律进 `editor.*`
- 凡是纯静态 helper / type / builder，才考虑包级导出
- 不是每个领域都必须有一个对应的 subpath

明确反对的是：

- `import { editor } from '@whiteboard/editor'`
- 把包本身做成一个全局有状态单例

也不应该继续保持现在这种“所有能力都从 `@whiteboard/editor` 根入口扁平导出”的形态。

同时，长期最优里：

- **`editor.commands` 仍然是唯一公开写入口**
- **`action` 不是第二写入口**
- **`action` 是 editor 层给 UI/chrome 提供的语义化动作描述与绑定**
- **真正修改文档/runtime 的动作，只能落在 `editor.commands.*`**

一句话总结：

**主 API 是 `editor` 实例，包只负责创建它；凡是有状态 runtime 能力，一律进 `editor.*`，只有无状态静态能力，才考虑 subpath。**

---

## 3. 当前问题

当前 [packages/whiteboard-editor/src/index.ts](/Users/realrong/whiteboard/packages/whiteboard-editor/src/index.ts) 已经明显是迁移期总出口，不是长期稳定 public API。

粗略看：

- 根入口接近 500 行
- export block 接近 80 个
- `whiteboard-react` 内已有几十个文件直接从 `@whiteboard/editor` 根入口取东西

这会带来四个问题。

### 3.1 根入口失去层级

现在根入口同时暴露：

- instance/runtime 入口
- interaction runtime
- feature session
- patch compiler
- chrome menu/layout helper
- toolbox view-model
- types

这意味着外部调用者看不出：

- 哪些是稳定 API
- 哪些只是 editor 内部搬运出来的 helper
- 哪些适合 host 直接依赖
- 哪些只是当前 React 重构的临时暴露面

### 3.2 低层 helper 被误当成公共协议

例如：

- `toNodeFieldUpdate`
- `toNodeStylePatch`
- `toNodeStyleUpdates`
- `buildToolbarStyle`
- `buildToolbarMenuStyle`
- `readToolPaletteMenuPlacement`

这些能力不是没有价值，但它们不应该和：

- `createEditor`
- `Editor`
- `createSelectionGesture`
- `insertPreset`

处在同一层级的 public API 面上。

### 3.3 UI 仍然过多理解写语义

现在 React 层最明显的残留问题不是 runtime 本身，而是仍有不少 UI/chrome/registry 代码直接做下面这些事：

- 组装 `NodeUpdateInput`
- 直接调用 patch compiler
- 直接知道 `data/style` path
- 直接拼 `updateMany`

这说明 editor 层虽然已经成立，但**语义化 command 还没有真正收口**。

### 3.4 `command` 与 `action` 还没有被正式区分

当前很多“action”其实只是：

- 读取一些状态
- 然后在 `onClick` 里直接调用低层 `commands.node.update(...)`

这会导致：

- chrome model 和写语义仍然耦合
- UI 层知道太多 node mutation 细节
- command 面很难稳定

---

## 4. 长期最优原则

## 4.1 实例优先，包导出后置

长期最优里，外部最主要应该拿到的是：

- 一个有状态的 `editor`

而不是：

- 从包根入口或各个 helper 模块里到处拿能力自己拼 runtime

也就是说：

- 包级 API 的首要职责是创建 editor
- 运行时实例才是 host 的主交互对象

## 4.2 为什么不是包级单例 `editor`

长期最优里，明确不做：

```ts
import { editor } from '@whiteboard/editor'
```

这种包级全局单例。

原因很简单：

- editor 不是天然单例场景
- 一个页面可能同时存在多个 board/editor
- 不同 editor 需要不同 `engine / registry / config / clipboard port / host port`
- 测试、协同、多文档、多容器场景都要求实例隔离

所以正确形态只能是：

```ts
const editor = createEditor(options)
```

由创建动作绑定：

- 生命周期
- 依赖注入
- 配置
- runtime store

## 4.3 有状态 runtime 能力直接挂在 `editor` 上

用户这里问到的关键点其实是对的：

- 既然 editor 是 runtime
- 那 runtime state、runtime lifecycle、runtime command/read 面
- 就应该直接挂在 `editor` 实例上

模块导出解决的是：

- 编译期命名空间
- 包结构组织
- 静态 helper 分发

它不能替代：

- 每个 editor 实例自己的状态
- 每个 editor 实例自己的依赖注入
- 每个 editor 实例自己的生命周期与读写能力

所以判断标准很简单：

- 如果一个能力需要读写 selection / tool / edit / frame / viewport runtime
- 如果一个能力需要绑定 editor 配置、store、依赖端口
- 如果一个能力天然属于“每个 editor 各自一份”

那它就应该挂在：

- `editor.commands.*`
- `editor.read.*`
- `editor.state.*`
- `editor.viewport.*`

只有下面这类能力，才值得留在包导出或 subpath：

- 纯类型
- 纯函数
- 纯 builder / view-model helper
- 不持有 runtime state 的 host adapter

## 4.4 `editor.commands` 是唯一写入口

长期最优里，不新增：

- `editor.actions`
- `editor.api`
- `editor.write`
- `editor.mutations`

所有会写文档、写 editor runtime、写 selection/tool/edit/frame 的能力，都只能走：

- `editor.commands.*`

`action` 只是：

- editor 层为 UI 生成的语义动作描述
- 可以包含 `run()` / `onSelect()` / `onCommit()` 之类回调
- 但这些回调最终必须只调用 `editor.commands`

## 4.5 UI 不再直接理解低层 mutation/compiler

长期最优里，React 组件和 node registry 不应该再直接使用：

- `NodeUpdateInput`
- `NodeRecordMutation`
- `toNodeFieldUpdate`
- `toNodeStylePatch`
- `toNodeStyleRemovalPatch`
- `toNodeStyleUpdates`
- schema path 到 mutation 的直接编译

这些能力可以存在，但它们属于：

- editor 内部 adapter
- command compiler
- raw command 层

不属于 chrome render 层。

## 4.6 语义命令优先，raw 命令后置

长期最优里，editor 应优先暴露：

- `setText`
- `setFill`
- `setStroke`
- `setFontSize`
- `copy`
- `paste`
- `insertPreset`
- `filterSelectionByType`

而不是让 UI 直接优先调用：

- `update`
- `updateMany`
- `document.insert(slice, ...)`

低层 generic write 仍然要保留，但只能作为：

- editor 内部编译目标
- 插件/高级宿主的 escape hatch
- 不推荐给 chrome/UI 的 raw command

---

## 5. 长期最优的包级 Public API

## 5.1 Root 入口只保留 editor 创建入口与少量稳定类型

`@whiteboard/editor` 根入口应只保留：

- `createEditor`
- `type Editor`
- 极少量稳定类型

如果确实需要，可以保留少量全局顶层类型，但原则上不要继续扩。

也就是说：

```ts
import {
  createEditor,
  type Editor
} from '@whiteboard/editor'
```

这是合理的。

但下面这种就不应该继续发生：

```ts
import {
  toNodeStylePatch,
  buildToolbarStyle,
  readToolPaletteView,
  createSelectionState
} from '@whiteboard/editor'
```

## 5.2 subpath 只承载静态能力，而且不是必须存在

长期最优里，subpath 的职责不是替代 editor 实例，而是：

- 避免 root barrel 继续膨胀
- 给少量静态能力一个明确归属
- 在确有复用价值时提供更稳定的编译期入口

也就是说：

- **主交互方式 = `editor` 实例**
- **subpath = 少量静态导出**
- **没有真实外部消费价值的领域，不需要为了目录对称硬做 subpath**

一个能力只有同时满足下面条件，才值得放进 subpath：

- 不持有 runtime state
- 不依赖 editor 生命周期
- 可以以纯函数 / 纯 builder / 类型形式存在
- 在 React host 之外也可能被复用

不满足这些条件时，应该：

- 直接收回 `editor.*`
- 或保留在 editor 内部模块

## 5.3 只有少量静态领域值得保留 subpath

长期最优里，建议只给少量静态能力保留子入口。

### `@whiteboard/editor/tool`

职责：

- tool 类型
- tool factory
- tool normalize / match helper

例如：

- `createDrawTool`
- `createEdgeTool`
- `normalizeTool`
- `type Tool`

### `@whiteboard/editor/input`

职责：

- DOM host 绑定需要的输入翻译 helper
- pointer/keyboard target helper

例如：

- `readCanvasDown`
- `dispatchCanvasDown`
- `readContextOpen`
- `resolveContextTarget`
- `readShortcut`
- `isEditableTarget`

### `@whiteboard/editor/node`

职责：

- node 相关纯 view-model
- node 相关 action builder
- node semantic command 所需类型
- 节点模板与展示规格中属于 editor 领域的纯部分

例如：

- `readNodeSummaryView`
- `createNodeSelectionActions`
- `readShapeSpec`
- `createTextNodeInput`
- `createFrameNodeInput`

### `@whiteboard/editor/toolbox`

职责：

- insert preset
- toolbox/palette 纯 view-model
- insert 语义命令 adapter

例如：

- `getInsertPreset`
- `readToolPaletteView`
- `insertPreset`

### `@whiteboard/editor/chrome`

职责：

- toolbar/context menu 的纯 model
- chrome action binding helper

例如：

- `readContextMenuView`
- `readNodeMenuFilter`
- `readNodeMoreMenuSections`

### `@whiteboard/editor/types`

职责：

- editor 对外稳定类型

例如：

- `NodeRegistry`
- `NodeDefinition`
- `MindmapLayoutConfig`

不建议长期保留这类 subpath：

- `@whiteboard/editor/selection`
- 其他直接映射 editor 内部 runtime 分层的入口

因为 selection/edit/frame/viewport 这类能力本质上都是有状态 runtime，更合理的公开面是：

- `editor.commands.selection.*`
- `editor.read.selection.*`
- `editor.state.selection.*`
- `editor.viewport.*`

## 5.4 不公开 `/runtime/*` 目录形态

长期最优里，不建议让包外直接依赖：

- `@whiteboard/editor/runtime/selection`
- `@whiteboard/editor/runtime/frame`
- `@whiteboard/editor/runtime/edit`
- `@whiteboard/editor/runtime/interaction`

原因不是这些能力不重要，而是：

- 这些是 `createEditor` 内部装配细节
- 它们是 editor 内部 runtime 的组织方式
- 不应该直接泄漏为 host 的稳定 API

如果 host 确实要消费其中一部分能力，应该通过：

- 更高层 subpath
- 或直接通过 `editor.*`

而不是让外部跟着 editor 内部目录结构走。

## 5.5 目标 `package.json` exports 形态

长期最优里，`package.json` 可以接近下面这样，但前提是这些子入口确实有独立静态消费面：

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./tool": {
      "types": "./dist/tool.d.ts",
      "import": "./dist/tool.js",
      "require": "./dist/tool.cjs"
    },
    "./input": {
      "types": "./dist/input.d.ts",
      "import": "./dist/input.js",
      "require": "./dist/input.cjs"
    },
    "./node": {
      "types": "./dist/node.d.ts",
      "import": "./dist/node.js",
      "require": "./dist/node.cjs"
    },
    "./toolbox": {
      "types": "./dist/toolbox.d.ts",
      "import": "./dist/toolbox.js",
      "require": "./dist/toolbox.cjs"
    },
    "./chrome": {
      "types": "./dist/chrome.d.ts",
      "import": "./dist/chrome.js",
      "require": "./dist/chrome.cjs"
    },
    "./types": {
      "types": "./dist/types.d.ts",
      "import": "./dist/types.js",
      "require": "./dist/types.cjs"
    }
  }
}
```

关键点不是路径名本身，而是：

- root 只保留极小稳定入口
- 只有确实需要外部静态消费的领域才暴露 subpath
- 不再继续扩一个超级 root barrel

---

## 6. 长期最优的 `command` 与 `action` 分层

## 6.1 术语定义

### `command`

`command` 是：

- 挂在 `editor.commands.*` 上的唯一写入口
- 可以修改 document / selection / tool / edit / frame / clipboard runtime
- 对 host / UI / plugin 可见
- 需要稳定命名

### `action`

`action` 是：

- editor 层提供给 UI/chrome 的语义动作描述
- 可以是菜单项、toolbar item、context action、shortcut action
- 可以带 `run()` / `onSelect()` / `onCommit()` 回调
- 但它本身不是第二写入口
- 它的回调最终必须只调用 `editor.commands`

### `raw command`

`raw command` 是：

- generic mutation/write primitive
- 直接接近 engine canonical command
- 用于 editor 内部 adapter 或高级场景
- 不鼓励 chrome/UI 直接消费

---

## 6.2 长期最优的写侧分层

长期最优里，写侧应该分成三层：

### 第一层：UI / host

负责：

- DOM 事件
- 文本测量
- pointer target
- menu render

它只调用：

- `editor.commands.*`
- 或 editor 提供的 `action.run()`

### 第二层：editor semantic command / action

负责：

- 把用户意图翻译成语义命令
- 把特殊节点规则收口
- 把多 node / 单 node 差异收口
- 把 sticky / frame / text / shape 的特殊写语义收口

它最终编译成：

- engine command
- 或 editor raw command

### 第三层：engine raw mutation

负责：

- `node.update`
- `document.insert`
- `history.undo`
- committed document change

这一层不应该再泄漏回 React chrome。

---

## 7. 长期最优的 `editor` 结构

## 7.1 editor 顶层能力

长期最优里，`editor` 应收敛为：

```ts
type Editor = {
  commands: EditorCommands
  read: EditorRead
  state: EditorState
  viewport: EditorViewport
  dispose: () => void
  configure: (input: EditorConfigInput) => void
}
```

也就是说：

- `editor.commands` = 唯一写入口
- `editor.read` = 纯只读查询入口
- `editor.state` = runtime store 入口
- `editor.viewport` = viewport 读写能力

## 7.2 长期最优的 `editor.commands` 结构

长期最优里，建议 `editor.commands` 收敛为：

```ts
type EditorCommands = {
  document: { ... }
  history: { ... }
  tool: { ... }
  viewport: { ... }
  edit: { ... }
  frame: { ... }
  selection: { ... }
  clipboard: { ... }
  insert: { ... }
  node: { ... }
  edge: { ... }
  mindmap: { ... }
}
```

说明：

- `document/history/tool/viewport/edit/frame/selection` 保留
- `clipboard/insert` 应升格为正式 command 域
- `node/edge/mindmap` 保留为 feature 语义域

## 7.3 `node` 命令域应按语义分组，不按存储分组

不要设计成：

```ts
node.data.set(...)
node.style.set(...)
node.patch(...)
```

因为这仍然把 UI 暴露在存储结构面前。

应改成：

```ts
node.create(...)
node.duplicate(...)
node.delete(...)
node.deleteCascade(...)
node.move(...)
node.order....
node.layout....
node.group....
node.lock....
node.text....
node.appearance....
node.raw....
```

也就是：

- 以用户意图分组
- `raw` 显式后置
- 不再让 `data/style` 成为 host-facing API

## 7.4 建议的 `node` 命令结构

```ts
type NodeCommands = {
  create: (...)
  duplicate: (nodeIds: readonly NodeId[]) => CommandResult
  delete: (nodeIds: readonly NodeId[]) => CommandResult
  deleteCascade: (nodeIds: readonly NodeId[]) => CommandResult

  move: (...)
  order: {
    bringToFront: (...)
    bringForward: (...)
    sendBackward: (...)
    sendToBack: (...)
  }
  layout: {
    align: (...)
    distribute: (...)
  }
  group: {
    create: (...)
    ungroupMany: (...)
  }
  lock: {
    set: (nodeIds: readonly NodeId[], locked: boolean) => CommandResult
    toggle: (nodeIds: readonly NodeId[]) => CommandResult
  }
  text: {
    commit: (input: {
      nodeId: NodeId
      field: 'text' | 'title'
      value: string
      measuredSize?: Size
    }) => CommandResult
    setColor: (nodeIds: readonly NodeId[], color: string) => CommandResult
    setFontSize: (input: {
      nodeIds: readonly NodeId[]
      value?: number
      measuredSizeById?: Readonly<Record<NodeId, Size>>
    }) => CommandResult
  }
  appearance: {
    setFill: (nodeIds: readonly NodeId[], fill: string) => CommandResult
    setStroke: (nodeIds: readonly NodeId[], stroke: string) => CommandResult
    setStrokeWidth: (nodeIds: readonly NodeId[], width: number) => CommandResult
    setOpacity: (nodeIds: readonly NodeId[], opacity: number) => CommandResult
    setTextColor: (nodeIds: readonly NodeId[], color: string) => CommandResult
  }
  frame: {
    setTitle: (nodeId: NodeId, title: string) => CommandResult
  }
  raw: {
    update: (nodeId: NodeId, update: NodeUpdateInput) => CommandResult
    updateMany: (
      updates: readonly { id: NodeId; update: NodeUpdateInput }[]
    ) => CommandResult
  }
}
```

关键点：

- `raw.update` 仍然存在，但不再占据 `node` 顶层默认入口
- UI/chrome 默认只用 `text / appearance / frame / lock / layout / group`
- 所有特殊节点兼容逻辑都收口在 semantic command 内部

## 7.5 `text.commit` 的设计原则

文本编辑是最典型的“语义命令 + host 测量”场景。

长期最优里，React 仍然负责：

- DOM editable
- 测量文本尺寸

但 React 不再自己编译 patch。

它只把结果交给：

```ts
editor.commands.node.text.commit({
  nodeId,
  field: 'text',
  value,
  measuredSize
})
```

由 command 内部决定：

- 是只改字段
- 还是同时改 `fields.size`
- `text` / `frame.title` / 其他节点 `title` 的特殊行为差异

## 7.6 `appearance` 命令应收口节点类型特例

例如 `sticky` 的 fill 目前往往需要同步：

- `style.fill`
- `data.background`

这类规则不应继续散落在 toolbar/context menu/UI component 里。

长期最优里：

```ts
editor.commands.node.appearance.setFill(nodeIds, fill)
```

内部自己决定：

- 普通节点只改 `style.fill`
- sticky 同步 `data.background`
- 未来其他特殊节点是否需要联动

UI 不再关心。

## 7.7 `clipboard` 应升格为正式 command 域

当前 clipboard 已经在 editor，但还不是 instance 正式命令域的一部分。

长期最优里应改成：

```ts
editor.commands.clipboard.copy(target?)
editor.commands.clipboard.cut(target?)
editor.commands.clipboard.paste(options?)
```

浏览器相关 IO 通过 host port 注入，例如：

```ts
type ClipboardPort = {
  readText: () => Promise<string | undefined>
  writeText: (text: string) => Promise<void>
}
```

这样：

- editor 负责 slice 语义、selection restore、paste offset
- host 负责真正的 clipboard IO

## 7.8 `insert` 应升格为正式 command 域

`toolbox/insert` 不应只是 helper。

长期最优里应改成：

```ts
editor.commands.insert.preset(presetKey, {
  at,
  ownerId?
})

editor.commands.insert.text({ at, ownerId? })
editor.commands.insert.sticky({ toneKey?, at, ownerId? })
editor.commands.insert.shape({ kind, at, ownerId? })
editor.commands.insert.mindmap({ templateKey, at })
```

这样 `toolbox`、context menu、shortcut、plugin 都用同一套语义入口。

---

## 8. 长期最优的 `action` 设计

## 8.1 不新增 `editor.actions`

再次强调：

- `action` 不挂在 editor 上
- 不作为第二写入口存在

正确做法是：

- `@whiteboard/editor/chrome`
- `@whiteboard/editor/node`
- `@whiteboard/editor/toolbox`

这些域暴露纯 action/model builder。

例如：

```ts
readNodeToolbarModel(editor, context)
readContextMenuModel(editor, context)
readSelectionActions(editor, context)
```

## 8.2 `action` 返回的是描述，不是 patch

长期最优里，action builder 返回的应该是：

- 展示需要的 label/value/enabled/visible/tone
- UI 交互所需的 `run / onSelect / onCommit`

而不是：

- `NodeUpdateInput`
- `NodeStylePatch`
- schema path

例如：

```ts
type EditorAction = {
  id: string
  label: string
  enabled: boolean
  visible: boolean
  tone?: 'danger'
  run: () => CommandResult | Promise<CommandResult>
}
```

如果 action 需要参数，也应该是语义参数：

```ts
onFillChange(fill: string)
onTextCommit(value: string, measuredSize?: Size)
onFontSizeChange(value?: number, measuredSizeById?: Record<NodeId, Size>)
```

而不是：

```ts
onChange(update: NodeUpdateInput)
```

## 8.3 `action` 负责 UI 绑定，不负责 canonical mutation

例如 `NodeToolbar` 里的 fill 菜单动作，长期最优里应该是：

```ts
onFillChange: (fill) => {
  editor.commands.node.appearance.setFill(nodeIds, fill)
}
```

而不是：

```ts
onFillChange: (fill) => {
  editor.commands.node.raw.updateMany(
    toNodeStyleUpdates(nodes, { fill })
  )
}
```

---

## 9. 哪些东西应当从 public API 中退后

长期最优里，以下东西不应该继续成为 host/UI 首选公开 API：

- `toNodeFieldUpdate`
- `toNodeStylePatch`
- `toNodeStyleRemovalPatch`
- `toNodeStyleUpdates`
- `toNodeDataPatch`
- 各类 `buildToolbarXxxStyle`
- 各类 raw menu/layout helper
- `createSelectionState`
- `createFrameState`
- `createEditState`
- `createDrawState`
- `createViewport`

这些能力可以存在，但应属于：

- editor 内部模块
- subpath 下的低优先级 helper
- 或干脆只在 editor 内部使用

原则是：

**不再让 React host 默认直接面向这些低层拼装工具编程。**

---

## 10. 最终判断标准

当这套长期最优设计真正落地后，应满足以下标准。

## 10.1 `@whiteboard/editor` 根入口极薄

根入口只看得到：

- `createEditor`
- `Editor`

看不到一堆 patch/layout/helper。

## 10.2 React chrome 不再直接理解 patch 协议

例如：

- `NodeToolbar.tsx`
- `ContextMenu.tsx`
- 默认 node registry

这些模块都不再直接组装 `NodeUpdateInput`。

## 10.3 `editor.commands` 主要由语义命令组成

常用调用应是：

- `node.text.commit`
- `node.appearance.setFill`
- `clipboard.copy`
- `insert.preset`

而不是到处直接 `node.raw.update(...)`。

## 10.4 `action` builder 只返回 UI 可消费描述

UI 组件拿到的应是：

- 当前值
- 是否可用
- 标签
- 运行回调

而不是 mutation/compiler。

---

## 11. 下一步该做什么

在不考虑兼容的前提下，下一步优先级应是：

### 1. 先定义 `Editor` 实例的最终顶层 API

先把下面这些能力面定死：

- `createEditor`
- `Editor`
- `editor.commands`
- `editor.read`
- `editor.state`
- `editor.viewport`

而不是先讨论目录级 subpath 怎么切。

### 2. 把有状态 runtime 能力尽量收回 `editor.*`

目标不是只改名，而是明确：

- host 主要持有的是 `editor`
- editor 是有状态 runtime
- `commands/read/state/viewport` 是 editor 的主能力面
- selection/edit/frame/viewport 这类运行时能力不再额外设计独立公开 runtime helper 面

### 3. 给 `editor.commands` 增加正式语义命令域

优先补：

- `commands.clipboard.*`
- `commands.insert.*`
- `commands.node.text.*`
- `commands.node.appearance.*`
- `commands.node.lock.*`

### 4. 用语义命令重写 chrome 与 registry 写入口

优先改：

- `NodeToolbar`
- `ContextMenu`
- `features/node/registry/default/text.tsx`
- `features/node/registry/default/frame.tsx`
- `features/node/registry/default/shape.tsx`

目标是清除 UI 对 patch compiler 的直接依赖。

### 5. 最后再决定哪些静态能力值得做 subpath，并缩 root `index.ts`

当 React 调用面已经切到 `editor` 实例 + semantic commands 后，再判断：

- 哪些类型值得从 root 暴露
- 哪些纯 helper 值得独立 subpath
- 哪些应该彻底留在 editor 内部

这样代价最小，也最不容易反复。

---

## 12. 最终建议

如果只给一句话建议：

**长期最优里，主 API 应该是 `createEditor()` 返回的有状态 `editor` 实例；包级不做全局单例 `editor.xxx`，也不继续维持超级扁平 root barrel；正确方向是“runtime 全进 editor、静态能力才考虑 subpath”，并把真正给 UI 使用的写入口统一收敛为 `editor.commands` 下的语义化 command。**

再压缩成更短的一句：

**有状态能力进 `editor.xx`，静态能力再谈导出；UI 只调语义命令，不再拼 patch。**
