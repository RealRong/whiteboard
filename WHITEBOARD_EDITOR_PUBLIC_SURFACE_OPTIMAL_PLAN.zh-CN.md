# WHITEBOARD_EDITOR_PUBLIC_SURFACE_OPTIMAL_PLAN.zh-CN

## 目标

这份文档只回答一件事：

- `packages/whiteboard-editor/src` 顶层公开入口应该长什么样
- 哪些顶层导出文件仍然有异味
- `runtime/input/keyboard.ts` 应不应该留在 editor
- 最终 public surface 应该如何瘦身、命名、分层

本文以长期最优为准。
不考虑兼容、不考虑渐进迁移、不保留历史包袱。

---

## 核心结论

### 1. `runtime/input/keyboard.ts` 不应该留在 `whiteboard-editor`

原因不是“它不重要”，而是“它的层次错了”。

当前文件：

- `packages/whiteboard-editor/src/runtime/input/keyboard.ts`

它做的事情本质上是：

- shortcut chord 的归一化
- shortcut binding 的解析
- shortcut action 的匹配
- default bindings 与 overrides 的合并

它不是：

- editor input router
- keyboard session
- interaction runtime
- host keyboard listener

也就是说，它属于 **宿主快捷键绑定策略与纯函数工具**，不属于 **editor runtime**。

长期最优结论：

- 这部分逻辑应整体移出 `whiteboard-editor`
- 不只是不该放在 `runtime/input`
- 而是根本不该继续作为 editor public surface 的一部分

推荐位置：

- `packages/whiteboard-react/src/runtime/host/shortcut.ts`
- 或者 `packages/whiteboard-react/src/canvas/shortcut/`
- 如果未来确认存在跨宿主共享需求，再单独拆成独立包，例如 `whiteboard-shortcut`

并且它不应该依赖 `EditorKeyboardInput` 这种 runtime 输入类型。
它只需要自己的最小输入协议，例如：

- `ShortcutKeyInput = { key, ctrlKey, altKey, shiftKey, metaKey }`

这样 shortcut 模块才是纯粹的宿主层工具，而不是被错误放进 editor 的伪领域能力。

---

### 2. `whiteboard-editor/src` 顶层导出文件现在仍然有明显异味

当前顶层文件：

- `packages/whiteboard-editor/src/index.ts`
- `packages/whiteboard-editor/src/tool.ts`
- `packages/whiteboard-editor/src/toolbox.ts`
- `packages/whiteboard-editor/src/draw.ts`
- `packages/whiteboard-editor/src/types.ts`

其中只有一部分是长期合理的。

长期最优不是“顶层文件越多越好”，也不是“所有东西都从 root 暴露”。
长期最优是：

- root entry 只暴露最核心的 editor public API
- 次级领域通过少量明确的子入口暴露
- 每个子入口都必须对应真实、稳定、可解释的公共命名空间
- 不允许 `internal` / `runtime` / `types` 通过顶层壳文件被伪装成 public API

---

## 审计结论

### A. `index.ts` 仍然过载

文件：

- `packages/whiteboard-editor/src/index.ts`

当前问题：

1. root 导出内容过多，职责混在一起
2. public API 里混入来自 `types/internal/*` 和 `types/runtime/*` 的类型
3. root 同时导出 editor 核心 API、tool helpers、shortcut helpers、insert preset types，边界太宽

最典型的问题：

- `EditorRuntime` 来自 `types/internal/editor`
- `EditorPick` 来自 `types/runtime/pick`

这说明 public surface 仍在“借 internal/runtime 目录出货”。

这不是命名问题，而是模型问题：

- public 类型不应该定义在 internal/runtime 命名目录里
- 如果某个类型要公开，它就应该属于 public contract 本身

长期最优：

- `index.ts` 只导出 editor 主入口和主合同
- 所有被 root 暴露的类型，都来自 public contract 目录，而不是 internal/runtime 目录

---

### B. `tool.ts` 语义勉强成立，但没有必要单独作为子入口

文件：

- `packages/whiteboard-editor/src/tool.ts`

问题不在于内容错，而在于“是否值得单独暴露”。

当前文件只是把：

- `runtime/tool.ts`
- `types/tool.ts`

重新包一层导出。

这里有两层异味：

1. `tool` 作为 public 领域是合理的，但它的实现居然放在 `runtime/tool.ts`
2. 当前仓内没有真实消费者依赖 `@whiteboard/editor/tool`

因此它不是一个“被验证过的稳定子命名空间”，只是一个额外入口。

长期最优：

- `tool` 的纯模型和纯函数应从 `runtime/` 脱出
- 但 package 子入口 `./tool` 应直接删除
- tool 相关内容只从 root `@whiteboard/editor` 暴露

原因：

- tool 是 editor 的一等核心概念，不是次级附属领域
- 为 tool 单独开子入口，只会增加入口数量和 mental overhead

---

### C. `shortcut.ts` 应直接删除，不应继续作为 editor 子入口

文件：

- `packages/whiteboard-editor/src/shortcut.ts`

它当前的问题不是“底层实现路径不对”，而是这个入口本身就不该存在。

当前异味：

- public 入口是 `shortcut`
- 实际实现却来自 `runtime/input/keyboard`
- 实际消费者在 React 宿主侧，而不是 editor runtime 内部

这说明两件事：

- shortcut 不属于 editor 主合同
- `whiteboard-editor` 正在替宿主层保管不属于自己的能力

长期最优：

- 删除 `@whiteboard/editor/shortcut`
- 删除 `src/shortcut.ts`
- 删除 editor 内部 shortcut helper
- React 侧直接持有 shortcut 类型与 helper
- 如果未来出现多个宿主复用，再拆独立包，而不是回塞 editor

原因：

- shortcut 的 action 词表本质上是产品层命令绑定协议
- chord parse/match 本质上是宿主输入绑定工具
- 二者都不是 editor runtime 自身必须拥有的领域能力

---

### D. `toolbox.ts` 这个名字已经不成立，必须改名

文件：

- `packages/whiteboard-editor/src/toolbox.ts`

当前内容已经只剩：

- `InsertPresetCatalog`
- `InsertPreset`
- `InsertPlacement`
- `MindmapTemplate`
- `StickyTone`

它已经不是 toolbox。

现在它承载的是：

- insert preset contract
- preset catalog contract
- insert 模板类型

也就是说，名字与内容完全错位。

长期最优：

- `toolbox.ts` 必须删除
- 改成明确语义的 `insert.ts`

推荐子入口：

- `@whiteboard/editor/insert`

它代表的应是：

- insert preset domain contract

而不是：

- product toolbox
- UI palette
- menu layout

---

### E. `draw.ts` 这个顶层入口是合理的，但其底层承载仍然没完全对齐

文件：

- `packages/whiteboard-editor/src/draw.ts`

这个入口本身是成立的，因为 draw 是一个明确的次级领域。

但当前实现来自：

- `packages/whiteboard-editor/src/runtime/draw.ts`

而这个文件同时包含：

- public 纯函数，例如 `readDrawStyle`
- runtime state factory，例如 `createDrawState`

这意味着 public draw model 和 runtime draw state 还混在一个文件里。

长期最优：

- 保留 `@whiteboard/editor/draw`
- 但把底层拆成两类：
  - public draw model / pure helpers
  - internal runtime draw state

推荐结构：

- `src/draw/model.ts`
- `src/runtime/draw/state.ts`

然后：

- `src/draw.ts` 只对外导出 public draw domain

这样才不会出现“public entry 指向 runtime file”的弱对齐。

---

### F. `types.ts` 应直接删除

文件：

- `packages/whiteboard-editor/src/types.ts`

这个文件的问题很简单：

- 它没有形成独立领域语义
- 它只是一个泛化的“类型集合出口”
- 当前也没有真实消费者使用 `@whiteboard/editor/types`

这类入口通常只有副作用：

- 让 public surface 更宽
- 让类型来源更模糊
- 鼓励消费者绕开明确命名空间

长期最优：

- 直接删除 `src/types.ts`
- 删除 package `exports["./types"]`
- 删除 tsup entry `src/types.ts`

所有公开类型应从：

- `@whiteboard/editor`
- `@whiteboard/editor/draw`
- `@whiteboard/editor/insert`

这些有明确语义的入口中获取。

---

## `runtime/input/keyboard.ts` 的最终归属

## 应保留在 editor 的部分

应保留：

- `EditorKeyboardInput`
- `editor.input.keyDown(...)`
- `editor.input.keyUp(...)`
- `editor.input.blur()`

因为这些才是 editor runtime 对外暴露的真实键盘语义边界。

## 不应保留在 editor 的部分

不应进入 editor 的：

- `ShortcutAction`
- `ShortcutBinding`
- `ShortcutOverrides`
- `ShortcutPlatform`
- `createShortcutMap`
- `readShortcut`
- `resolveShortcutBindings`
- `navigator.platform` 判断
- DOM `KeyboardEvent`
- 事件绑定和解绑
- 焦点管理
- `window.blur` 监听

这些都属于 host / react。

## 最佳分层

### `whiteboard-editor`

- keyboard runtime input contract
- interaction-level key semantics
- editor input state transition

### `whiteboard-react`

- shortcut action contract
- shortcut binding table
- shortcut chord parse/match
- shortcut override merge
- platform detect
- DOM event -> keyboard input normalize
- keyboard listener lifecycle
- shortcut action -> editor.commands 执行

如果未来不止 React 一个宿主：

- 把上面这些 shortcut 能力拆到单独包
- 也不要重新塞回 `whiteboard-editor`

---

## 最终 public surface 设计

长期最优下，`@whiteboard/editor` 应只保留 3 个入口：

1. `@whiteboard/editor`
2. `@whiteboard/editor/draw`
3. `@whiteboard/editor/insert`

不再保留：

- `@whiteboard/editor/tool`
- `@whiteboard/editor/toolbox`
- `@whiteboard/editor/shortcut`
- `@whiteboard/editor/types`

---

## 各入口职责

### 1. `@whiteboard/editor`

只保留 editor 主合同：

- `createEditor`
- `Editor`
- `EditorRead`
- `EditorCommands`
- `EditorProjection`
- `EditorInput`
- `EditorPick`
- `EditorClipboardTarget`
- `EditorClipboardOptions`
- `Tool`
- `DrawKind`
- `EdgePresetKey`
- `NodeRegistry`
- `SelectionCapabilities`
- `SelectionReadModel`

以及最常用的 tool 纯函数：

- `normalizeTool`
- `isSameTool`
- `createDrawTool`
- `createEdgeTool`
- `SelectTool`
- `HandTool`

不再从 root 导出：

- shortcut helpers
- insert preset contracts
- draw subdomain helpers

root 应是“editor 主入口”，不是“大杂烩入口”。

---

### 2. `@whiteboard/editor/draw`

只保留 draw 领域：

- `DrawPreferences`
- `DrawBrush`
- `DrawPreview`
- `DrawSlot`
- `BrushStyle`
- `ResolvedDrawStyle`
- `DRAW_SLOTS`
- `readDrawSlot`
- `readDrawBrushStyle`
- `readDrawStyle`

不导出：

- `createDrawState`

因为它是 editor runtime 内部装配能力，不是宿主公共 API。

---

### 3. `@whiteboard/editor/insert`

只保留 insert preset contract：

- `InsertPresetCatalog`
- `InsertPreset`
- `InsertPlacement`
- `InsertPresetGroup`
- `MindmapTemplate`
- `MindmapInsertPreset`
- `NodeInsertPreset`
- `StickyTone`

不导出：

- UI preset 数据
- product default
- toolbox menu model

---

## 最终目录建议

### 顶层公开入口文件

最终只保留：

- `packages/whiteboard-editor/src/index.ts`
- `packages/whiteboard-editor/src/draw.ts`
- `packages/whiteboard-editor/src/insert.ts`

删除：

- `packages/whiteboard-editor/src/tool.ts`
- `packages/whiteboard-editor/src/shortcut.ts`
- `packages/whiteboard-editor/src/toolbox.ts`
- `packages/whiteboard-editor/src/types.ts`

---

### 内部实现目录

推荐结构：

```txt
packages/whiteboard-editor/src/
  index.ts
  draw.ts
  insert.ts

  draw/
    model.ts

  insert/
    contract.ts

  tool/
    model.ts

  types/
    editor.ts
    pick.ts
    selection.ts
    draw.ts
    insert.ts
    tool.ts

  runtime/
    editor/
    commands/
    projection/
    interaction/
    input/
```

关键原则：

- public domain 不再从 `runtime/` 借实现
- `runtime/` 只承载 editor 内部运行时能力
- `types/internal` 只保留真正 internal 的内容
- 任何被公开导出的类型，必须落在 public types 目录或明确领域目录

---

## 需要直接调整的文件

### 一. `keyboard.ts`

当前：

- `packages/whiteboard-editor/src/runtime/input/keyboard.ts`

目标：

- 从 `whiteboard-editor` 删除
- 迁到 `whiteboard-react`
- 或迁到未来的独立 `whiteboard-shortcut` 包

同时做两件事：

1. 去掉对 `EditorKeyboardInput` 的依赖
2. shortcut action/binding 类型不再从 editor 暴露

---

### 二. `tool.ts`

当前：

- `packages/whiteboard-editor/src/tool.ts`

目标：

- 彻底删除顶层 `tool.ts`
- `tool` 纯模型移到 `src/tool/model.ts`
- root `index.ts` 直接从 `tool/model.ts` 和 `types/tool.ts` 暴露

原因：

- tool 是 root 核心合同的一部分
- 不值得单独留一个 package 子入口

---

### 三. `toolbox.ts`

当前：

- `packages/whiteboard-editor/src/toolbox.ts`

目标：

- 改名为 `packages/whiteboard-editor/src/insert.ts`

并同步修改：

- `package.json` exports
- `tsup.config.ts` entry
- react 侧 import

---

### 四. `draw.ts`

当前：

- `packages/whiteboard-editor/src/draw.ts`

结论：

- 入口保留
- 但底层 public helper 不应继续来自 `runtime/draw.ts`

应改成：

- `src/draw/model.ts`
- `src/draw.ts` -> re-export `draw/model.ts`

而 `createDrawState` 留在 internal runtime，不进入 public draw entry。

---

### 五. `shortcut.ts`

当前：

- `packages/whiteboard-editor/src/shortcut.ts`

结论：

- 删除文件
- 删除 root re-export
- 删除 package `exports["./shortcut"]`
- 删除 tsup entry `src/shortcut.ts`

---

### 六. `types.ts`

当前：

- `packages/whiteboard-editor/src/types.ts`

结论：

- 删除文件
- 删除 export
- 删除 build entry

---

### 七. `index.ts`

需要收口：

1. 停止从 root 导出 shortcut helpers
2. 停止从 root 导出 insert preset contract
3. 停止从 `internal` / `runtime` 命名目录直接拉 public type
4. 如果 `EditorRuntime` 是 public 必需类型，就把它转正为 public contract
5. 否则直接删除 `EditorRuntime` 对外暴露

长期最优建议：

- `createEditor` 的返回类型就是公开的 `Editor`
- 不再维持一个额外的 `EditorRuntime` public alias

如果 React 需要更多宿主集成字段，就应把这些字段纳入正式 public `Editor` 合同，而不是继续通过 internal type 偷渡。

---

## package exports 的最终形态

推荐最终 `exports`：

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs"
  },
  "./draw": {
    "types": "./dist/draw.d.ts",
    "import": "./dist/draw.js",
    "require": "./dist/draw.cjs"
  },
  "./insert": {
    "types": "./dist/insert.d.ts",
    "import": "./dist/insert.js",
    "require": "./dist/insert.cjs"
  }
}
```

删除：

- `./tool`
- `./toolbox`
- `./shortcut`
- `./types`

对应的 `tsup` entry 也同步改成：

- `src/index.ts`
- `src/draw.ts`
- `src/insert.ts`

---

## public type 的收口原则

以后判断一个类型应不应该从 root 导出，使用下面标准：

### 可以从 root 导出

- `createEditor` 的直接入参与返回值
- host 在接 editor instance 时必然会碰到的类型
- tool / selection / pick / clipboard 这类 editor 核心合同

### 不应该从 root 导出

- 次级领域的纯函数 helper
- 只被某个 UI domain 使用的类型集合
- internal runtime 实现类型
- “为了方便一次性导出所有 type” 的聚合壳

这意味着：

- `DrawPreferences` 更适合从 `@whiteboard/editor/draw`
- `InsertPresetCatalog` 更适合从 `@whiteboard/editor/insert`
- `ShortcutAction` 不应再从 `@whiteboard/editor` 体系获取
- 它应留在 `whiteboard-react`，或进入未来独立的 `whiteboard-shortcut` 包

而不是全部堆在 root。

---

## 为什么这是长期最优

这套设计解决了当前 4 个根问题：

1. **目录语义对齐**
   - shortcut 不再伪装成 runtime input
   - insert contract 不再伪装成 toolbox
   - public helper 不再从 runtime 目录借道

2. **入口数量最小化**
   - 只保留真正有领域语义的子入口
   - 删除 `tool`、`types` 这类弱入口

3. **公共 API 更稳定**
   - root 只保留主合同
   - 次级领域从单独 namespace 读取
   - 内部重构不再轻易污染 root

4. **host/editor 边界更清晰**
   - shortcut 整体在宿主层
   - editor 只保留 keyboard input runtime 语义
   - DOM/platform 与命令绑定策略都不再污染 editor

---

## 最终建议

一句话总结：

- `runtime/input/keyboard.ts` 应从 `whiteboard-editor` 移除
- `toolbox.ts` 必须改成 `insert.ts`
- `types.ts` 必须删除
- `tool.ts` 应删除，tool 直接进入 root
- `shortcut.ts` 必须删除
- `draw.ts` 可以保留，但其底层实现应与 runtime draw state 分离
- root `index.ts` 必须瘦身，停止充当“大而全转发器”

如果后续严格按这份方案落地，`whiteboard-editor/src` 的顶层结构会更短、更稳、更符合长期 public surface 设计。
