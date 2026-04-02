# Whiteboard Editor 删除与三层架构最终方案

## 目标

这份文档明确回答两个问题：

1. 在 React 作为唯一宿主的前提下，`@whiteboard/editor` 还是否有必要继续存在。
2. 如果最终删除 `@whiteboard/editor`，当前能力应该分别下沉到 `@whiteboard/core`、`@whiteboard/engine`、`@whiteboard/react` 的哪里。

约束：

- 不考虑兼容
- 不考虑过渡
- 不保留“先这样以后再说”的中间形态
- 直接按长期最优设计

一句话结论：

**如果 React 是唯一宿主，长期最优结构应当只保留三层：`core` / `engine` / `react`。`@whiteboard/editor` 这个中间包应整体消失。**

---

## 结论

最终推荐架构：

```txt
@whiteboard/core
  纯类型
  纯算法
  纯投影
  纯选择/拖拽/变换/路由规则

@whiteboard/engine
  文档内核
  文档读模型
  文档命令
  undo/redo/commit
  host 无关的几何索引和查询

@whiteboard/react
  board instance
  runtime state
  interactions
  projection / overlay
  DOM / clipboard / keyboard / wheel / focus
  scene / chrome / toolbox / context menu
```

也就是说：

- `core` 负责怎么算
- `engine` 负责文档是什么
- `react` 负责用户怎么操作、怎么显示、怎么与宿主交互

中间不再保留一个 `editor` 包来“重新包装一层 runtime”。

---

## 为什么 `@whiteboard/editor` 最终应该删除

## 1. 它现在夹在 `engine` 和 `react` 中间，但边界越来越尴尬

当前 `editor` 剩下来的内容大致是：

- 一些 host runtime state
- 一些文档命令的包装
- 一些与 tool / viewport / selection / edit 相关的运行时能力
- 一些交互输入和 overlay 类型

这类能力天然会分裂成两边：

- 一边明显属于 `engine`
- 一边明显属于 `react`

于是 `editor` 会变成：

- 文档内核不够底，所以得包一层
- React host 又不够近，所以再绕一层

这就是典型的中间层退化。

---

## 2. 在 React-only 前提下，`editor` 不是跨宿主抽象，而是重复封装

如果未来有：

- 非 React host
- 插件运行时直接复用 board runtime
- 纯 imperative embed API

那保留一个 `editor` 层可能有价值。

但在你现在的前提里：

- interactions 已经明确迁到 React
- platform / input / clipboard / shortcut 也都在 React
- projection / overlay 也正在往 React 收
- 不优先考虑非 React host

这时 `editor` 就不再是“宿主无关 runtime”，而只是：

- `engine` 的再包装
- `react` 的前置包装

这种层是应该删除的。

---

## 3. 当前 React 已经大量依赖 `@whiteboard/editor` 表面能力，说明边界不干净

按当前代码扫描，`whiteboard-react` 里大约有：

- 41 处直接 `from '@whiteboard/editor'`
- 8 处直接 `from '@whiteboard/editor/draw'`

这说明：

- React 内部大量逻辑仍然借道 editor types / tool model / input model / draw preferences
- `editor` 已经不只是 runtime，而是 React 宿主的公共依赖仓库

这不是好事。

长期最优不是让 React 继续依赖 editor，

而是：

- 属于文档内核的，落到 `engine`
- 属于宿主工具和交互语义的，落到 `react`

---

## 最终判断线

判断某项能力该去哪，使用这一条统一标准：

### 放到 `core`

满足：

- 纯函数
- 不依赖 React
- 不依赖 DOM
- 不依赖 engine 实例
- 不依赖当前宿主 runtime state

### 放到 `engine`

满足：

- 与文档读写直接相关
- 与宿主无关
- 不是某次交互 session 的局部状态
- 放到 engine 后，未来不管 React/非 React 都成立

### 放到 `react`

满足任一条：

- 它是宿主 runtime state
- 它是 tool / selection / edit / viewport 这类宿主态
- 它是 interaction session / preview / overlay
- 它是 DOM / keyboard / clipboard / focus / wheel / pointer 语义
- 它是 UI 工具体系的一部分

按这条线，`editor` 里的很多能力会自然拆开。

---

## `editor` 当前能力的最终去向

下面按现在 `packages/whiteboard-editor/src` 的结构逐项给出最终去向。

## 1. `runtime/editor/createEditor.ts`

### 当前职责

- 组装 runtime state
- 组装 overlay
- 组装 read
- 组装 commands
- 组装 clipboard
- 暴露 `editor`

### 最终去向

拆掉。

- 文档命令/读模型能力下沉到 `engine`
- runtime state / viewport / tool / selection / edit / preferences 上提到 `react`
- `react` 内部组装 `WhiteboardInstance`

也就是说：

- 不再存在 `createEditor`
- 改为 `whiteboard-react` 内部的 `createBoardInstance` 或 `createBoardController`

---

## 2. `types/editor.ts`

### 当前职责

定义：

- `Editor`
- `EditorState`
- `EditorCommands`
- `EditorRead`
- `EditorInput`
- `EditorTransient`
- `EditorInteractionState`

### 最终去向

拆成三类：

#### 2.1 文档内核相关

放到 `engine`：

- host 无关的 commands/read 结果类型
- `CommandResult` 类似返回值

#### 2.2 宿主实例相关

放到 `react`：

- `WhiteboardInstance`
- board state
- tool / selection / edit / viewport state 类型
- clipboard target / options

#### 2.3 删除

直接删除：

- `EditorInput`
- `EditorTransient`
- `EditorInteractionState`

这些都不该再存在于一个独立 editor 包里。

---

## 3. `runtime/viewport.ts`

### 当前职责

- 维护 viewport state
- 维护 container rect
- world/screen/client 转换
- pan / wheel / zoom / fit / reset

### 最终去向

整体进 `react`。

原因：

- viewport 是宿主视图状态，不是文档状态
- container rect 明显是 DOM host 语义
- wheel / clientToScreen 也都依赖宿主

最优位置：

- `packages/whiteboard-react/src/board/viewport/*`
  或
- `packages/whiteboard-react/src/surface/viewport/*`

不建议进 `engine`。

`engine` 最多保留：

- host 无关的 viewport 纯几何函数

这些已经基本在 `core` 里。

---

## 4. `runtime/clipboard.ts`

### 当前职责

- 从 editor read/commands 导出 clipboard packet
- 插入 clipboard packet

### 最终去向

进 `react`。

原因：

- clipboard 是典型宿主能力
- export/insert 虽然要读写文档，但它依赖 selection、origin、host pointer、用户 paste 语义
- 如果后面 clipboard 方案继续收简，React host 更适合拥有这条线

最优位置：

- `packages/whiteboard-react/src/board/clipboard.ts`
  或
- `packages/whiteboard-react/src/surface/clipboard/actions.ts`

不是 `engine`。

`engine` 只需要继续提供：

- 基础文档 create/update/delete/move/group 等命令

---

## 5. `runtime/overlay.ts` 与 `runtime/overlay/*`

### 当前职责

- draw preview
- selection preview
- edge patch / guide
- mindmap drag feedback
- node patch entry

### 最终去向

整体进 `react`。

并且在 React 内部再拆成两类：

#### 5.1 interaction projection

例如：

- node patches
- edge patches
- hidden nodes/edges

#### 5.2 interaction overlay

例如：

- guides
- marquee
- draw preview
- edge guide
- mindmap drag ghost

这条线绝不应继续留在 editor 或 engine。

---

## 6. `tool/model.ts` 与 `types/tool.ts`

### 当前职责

- `Tool` 类型
- `selectTool / drawTool / insertTool / edgeTool / handTool`
- `DrawKind / InsertPresetKey / EdgePresetKey`
- `isDrawKind / isSameTool`

### 最终去向

整体进 `react`。

原因：

- tool 是宿主交互语义，不是文档模型
- tool 只在 UI / interactions / config / toolbox 中有意义
- `engine` 和 `core` 都不应理解 “当前工具”

最优位置：

- `packages/whiteboard-react/src/tool/*`

对外也由 `@whiteboard/react` 直接导出。

---

## 7. `draw.ts`、`draw/model.ts`、`types/draw.ts`

### 当前职责

- draw preferences
- brush style / slot / resolved style
- draw tool 相关 helper

### 最终去向

分两类：

#### 7.1 纯绘制几何/采样算法

进 `core`

#### 7.2 draw preferences / brush style / slot / UI brush model

进 `react`

原因：

- drawPreferences 是宿主工具偏好
- 不是文档模型
- 不是 engine 内核

最优位置：

- `packages/whiteboard-react/src/tool/draw/*`

---

## 8. `edge/preset.ts`

### 当前职责

- edge preset key -> edge type 的读取

### 最终去向

进 `react`。

原因：

- preset 属于宿主工具体系，不是文档内核
- 文档里存的是最终 edge data/type，不是 preset 选择器

最优位置：

- `packages/whiteboard-react/src/tool/edge/*`

---

## 9. `insert.ts`、`types/insert.ts`

### 当前职责

- insert preset catalog 相关输入/类型

### 最终去向

主要进 `react`。

原因：

- preset catalog 是 UI / product 语义
- 不是 engine 必须理解的基础文档模型

但其中如果有：

- 纯 node factory
- 纯 preset -> node payload 生成纯函数

应优先进 `core`。

最终拆分建议：

- `core`：纯模板工厂
- `react`：preset catalog / tool preset / UI preset 选择

---

## 10. `types/input.ts`、`types/pick.ts`

### 当前职责

- pointer / wheel / keyboard input
- `EditorPick`

### 最终去向

整体进 `react`。

原因：

- 这些都是 host input 语义
- `pick` 也是 React surface 命中语义
- `engine` 与 `core` 不应知道 DOM pointer event 的 shape

最优位置：

- `packages/whiteboard-react/src/surface/types.ts`
  或
- `packages/whiteboard-react/src/interactions/types.ts`

---

## 11. `runtime/read/*`

虽然当前文件树浅层没展开这些目录，但从 editor 现状可以判断，`read` 这条线最终要拆成三类。

### 11.1 纯文档读模型

进 `engine`：

- node/edge/mindmap/document/index 读取
- 空间索引查询
- host 无关的几何 query

### 11.2 依赖宿主 state 的组合读

进 `react`：

- selection summary
- overlay / projection 合成
- context menu summary
- toolbox 视图模型

### 11.3 纯函数读 helper

进 `core`：

- target bounds
- summary resolver
- patch merge / projection merge

核心原则：

**凡是可以把宿主 state 显式作为参数传入的，就不要再留在 editor read 中层。**

---

## 12. `runtime/commands/*`

最终也要拆。

### 12.1 文档基础命令

进 `engine`：

- document replace
- node create/update/delete/move/duplicate/group/order/lock
- edge create/update/delete/route
- mindmap insert/move

只要它最终写的是文档，而且与宿主无关，就应进 engine。

### 12.2 宿主 runtime 命令

进 `react`：

- tool.set
- selection.replace/add/remove/toggle/clear
- edit.start/clear
- viewport.pan/zoom/fit/reset
- draw preferences patch
- clipboard copy/cut/paste

### 12.3 product 语义 helper

按性质分流：

- 纯函数工厂 -> core
- 宿主流程命令 -> react

例如 insert preset 这一类，通常不该进 engine。

---

## 删除 `editor` 后，对外实例应该长什么样

这里是最关键的问题。

删除 `editor` 包，不等于没有对外 instance。

最终应该由 `@whiteboard/react` 自己暴露一个干净的 instance：

```ts
type WhiteboardInstance = {
  read: {
    document: ...
    node: ...
    edge: ...
    selection: ...
    viewport: ...
  }
  state: {
    tool: ...
    selection: ...
    edit: ...
    viewport: ...
    preferences: ...
  }
  commands: {
    document: ...
    node: ...
    edge: ...
    mindmap: ...
    tool: ...
    selection: ...
    edit: ...
    viewport: ...
    clipboard: ...
    preferences: ...
  }
}
```

注意：

- 这不是 `@whiteboard/editor` 提供的实例
- 这是 `@whiteboard/react` 自己内部组装后暴露给宿主的 instance

也就是说：

**保留 instance，删除 editor 包。**

---

## 删除 `editor` 后，包依赖关系应该怎么变

当前：

```txt
core <- engine <- editor <- react
```

最终：

```txt
core <- engine <- react
core <- collab
engine <- collab
```

`react` 直接依赖：

- `@whiteboard/core`
- `@whiteboard/engine`
- `@whiteboard/collab`

不再依赖：

- `@whiteboard/editor`

---

## `whiteboard-react` 里当前对 `editor` 的依赖，最终如何消失

当前 React 大量从 `@whiteboard/editor` 获取：

- `Tool`
- draw types/preferences
- `selectTool`
- pointer/keyboard/wheel input types
- `EditorPick`
- overlay entry types
- clipboard target

最终迁移原则如下：

### 1. tool 相关

改从 `@whiteboard/react/tool` 内部或根导出获取。

### 2. input / pick 相关

改从 `@whiteboard/react/surface` 或 `@whiteboard/react/interactions` 内部类型获取。

### 3. draw preferences / brush model

改从 `@whiteboard/react/tool/draw` 获取。

### 4. overlay / projection 相关

改从 `@whiteboard/react/interactions/state` 获取。

### 5. 纯文档类型

如果属于文档模型，改从 `@whiteboard/core` 或 `@whiteboard/engine` 获取。

---

## 删除 `editor` 后，哪些东西绝不能错误地下沉

这里要明确几个常见误区。

## 1. 不能把 tool / selection / viewport 直接塞进 engine

因为它们不是文档模型。

尤其：

- `tool`
- `space pressed`
- `selection target`
- `edit target`
- `viewport`

这些都明显是宿主 runtime state。

它们应在 `react`。

## 2. 不能把 interaction preview 塞进 engine

例如：

- draw preview
- marquee
- edge guide
- transform projection

这些都应在 `react`。

## 3. 不能把 preset catalog 塞进 engine

例如：

- sticky preset
- shape preset
- insert preset catalog

这些都是 product / UI 语义。

它们应在 `react`，最多把纯模板工厂提到 `core`。

---

## 最终目录建议

删除 `editor` 包后的最终目录，不要求一模一样，但职责应接近下面这种：

```txt
packages/
  whiteboard-core/
    src/
      config/
      document/
      edge/
      geometry/
      kernel/
      mindmap/
      node/
      selection/
      types/
      utils/

  whiteboard-engine/
    src/
      commands/
      document/
      instance/
      read/
      store/
      scheduler/
      types/
      write/

  whiteboard-react/
    src/
      board/
        createInstance.ts
        state/
        read/
        commands/
        viewport/
        clipboard/

      interactions/
        state.ts
        selection/
        draw/
        edge/
        transform/
        mindmap/
        insert/
        viewport/

      surface/
        bindings.ts
        input.ts
        pick.ts
        clipboard.ts
        shortcut.ts

      tool/
        model.ts
        draw/
        edge/
        insert/

      scene/
      chrome/
      features/
```

重点不是目录名本身，而是：

- `editor` 包不再存在
- runtime state、tool、interaction、surface 这些都明确归 React

---

## 一步到位实施方案

下面是严格按长期最优的顺序来做，不保留兼容层。

## 第 1 步：先在 `react` 内定义最终 `WhiteboardInstance`

目标：

- 不再以 `Editor` 作为上游 public contract

动作：

- 在 `whiteboard-react` 内部定义新的 instance 类型
- `Whiteboard` ref 和 `useEditor()` 都直接对齐这份 instance

这一步是删除 editor 包的前提。

## 第 2 步：把宿主 runtime state 从 editor 完整迁到 react

包括：

- tool
- selection
- edit
- viewport
- draw preferences
- interaction projection / overlay

做到：

- React 自己拥有 runtime state
- editor 不再承担任何宿主态

## 第 3 步：把 host 无关的 document commands/read 下沉到 engine

包括：

- node/edge/mindmap/document 基础命令
- host 无关 read/query/index

目标：

- 让 engine 足够承载文档内核能力
- 删除“必须先过 editor 才能操作文档”的中间层

## 第 4 步：把 tool / input / draw / pick / preset 表面类型迁到 react

包括：

- `types/tool.ts`
- `types/input.ts`
- `types/pick.ts`
- `types/draw.ts`
- `draw/model.ts`
- `tool/model.ts`
- `edge/preset.ts`
- `insert` preset types

目标：

- React 不再 import `@whiteboard/editor`

## 第 5 步：把 overlay / clipboard / viewport 彻底迁到 react

包括：

- `runtime/overlay*`
- `runtime/clipboard.ts`
- `runtime/viewport.ts`

目标：

- editor 不再持有宿主 projection / overlay / platform 能力

## 第 6 步：删掉 `createEditor`，改成 React 内部 `createBoardInstance`

这一步完成后：

- `whiteboard-react` 直接组装：
  - engine
  - runtime state
  - read
  - commands
  - interactions

不再经过 `@whiteboard/editor`。

## 第 7 步：删除 `@whiteboard/editor` 包

最后做：

- 删除 package
- 移除 workspace 依赖
- 修改 import
- 调整 build / tsconfig / exports

---

## 最终效果

如果严格按这份方案完成，结果会是：

### 1. 分层更干净

- `core` 只算
- `engine` 只管文档
- `react` 只管宿主和 UI

### 2. 中间层噪音更少

不会再有一个既不像 engine、也不像 react 的 editor 包。

### 3. React 心智更顺

React 不再需要先 import editor 再包装自己。

### 4. engine 更像真正的内核

所有 host 无关的文档命令和读取都会自然下沉进去。

### 5. 对外 API 更稳定

用户拿到的是 `WhiteboardInstance`，而不是一个历史原因形成的 `Editor`。

---

## 最后一句话

如果你已经接受：

- interactions 在 React
- projection / overlay 在 React
- tool / selection / viewport / edit 是宿主态
- React 是唯一宿主

那么长期最优就不该是“继续瘦身 `editor`”，而应该是：

**直接删除 `@whiteboard/editor`，把能力重新对齐到 `core / engine / react` 三层。**

这不是激进，而是顺着职责边界把多余中间层拿掉。
