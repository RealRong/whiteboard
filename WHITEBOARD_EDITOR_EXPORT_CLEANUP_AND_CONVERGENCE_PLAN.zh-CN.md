# Whiteboard Editor 导出面进一步清理收敛方案

## 1. 文档目标

这份文档只回答一个问题：

**在已经抽出 `packages/whiteboard-editor` 之后，下一步如何继续清理它的 public exports、顶层 entry 与 React 侧镜像层，让整体边界继续向长期最优收敛。**

本文明确：

- 不考虑兼容成本
- 不保留迁移期双轨 API
- 不为了目录对称保留 public subpath
- 目标不是“文件看起来更少”，而是“只有真正值得公开的东西被公开”

---

## 2. 当前问题的本质

当前 `packages/whiteboard-editor/src` 顶层有很多小文件，例如：

- `edit.ts`
- `frame.ts`
- `interaction.ts`
- `pick.ts`
- `selection.ts`
- `viewport.ts`
- `utils.ts`

这些文件本身并不是问题。

**真正的问题是：它们对应的 public subpath 大量直接映射了 editor 内部 runtime 分层。**

于是系统出现了三层冗余：

1. `editor` 内部真实实现文件
2. `editor/src/*.ts` 顶层 public barrel
3. `react/src/runtime/*/index.ts` 再做一次同名转发

这会带来几个直接后果：

- `package.json exports` 持续膨胀
- `tsup` 多入口持续膨胀
- 外部使用方被鼓励跟随内部目录结构消费能力
- `react` 内部继续复制 editor 的 runtime 分层命名
- 有状态 runtime 能力与纯静态 helper 混在同一个 public 面里

所以这里真正要清理的，不是“碎文件”本身，而是：

- **不该存在的 public subpath**
- **不该继续外露的 runtime 能力**
- **React 里没必要继续保留的镜像转发层**

---

## 3. 长期最优下的收敛原则

进一步清理时，建议严格遵守下面几条原则。

### 3.1 主 API 永远是 `editor` 实例

包的主交互方式应保持为：

- `createEditor()`
- `editor.commands`
- `editor.read`
- `editor.state`
- `editor.viewport`

也就是说：

- 有状态能力优先进入 `editor.*`
- 生命周期相关能力优先进入 `editor.*`
- 会话、协调器、preview runtime 优先进入 editor 内部模块

### 3.2 subpath 只承载少量静态能力

一个能力只有同时满足下面条件，才值得保留为 public subpath：

- 不持有 runtime state
- 不依赖 editor 生命周期
- 可以以纯函数 / 纯 builder / 纯类型存在
- 在 React host 之外也可能被复用

不满足这些条件时，应该：

- 收回 `editor.*`
- 或留在 editor 内部模块

### 3.3 不为目录对称设计 exports

不能因为 editor 内部有：

- `runtime/selection`
- `runtime/edit`
- `runtime/frame`
- `runtime/interaction`
- `runtime/viewport`

就机械地导出：

- `@whiteboard/editor/selection`
- `@whiteboard/editor/edit`
- `@whiteboard/editor/frame`
- `@whiteboard/editor/interaction`
- `@whiteboard/editor/viewport`

内部目录结构是实现组织方式，不应自动升级为 public API。

### 3.4 React 不应继续镜像 editor 的 runtime 分层

`whiteboard-react` 应该：

- 读取 `editor` 实例能力
- 消费少量静态 subpath
- 保留宿主适配职责

但不应该继续保留大量这种文件：

- `react/runtime/edit/index.ts`
- `react/runtime/frame/index.ts`
- `react/runtime/interaction/index.ts`
- `react/runtime/pick/index.ts`
- `react/runtime/selection/index.ts`

因为这些只是 editor public API 的第二层镜像壳。

---

## 4. 目标 public surface

## 4.1 最终保留的包级入口

长期最优下，`@whiteboard/editor` 建议只保留下面这些稳定入口：

- `.`  
  职责：`createEditor`、`Editor`、`EditorCommands`、`EditorRead`、`EditorState`、`EditorViewport`
- `./tool`  
  职责：tool 类型、tool factory、tool normalize/match helper
- `./input`  
  职责：输入翻译 helper、target helper、shortcut helper
- `./node`  
  职责：node 相关静态 view-model、模板、shape spec、summary、action builder
- `./toolbox`  
  职责：insert preset、palette view-model、insert 静态 adapter
- `./chrome`  
  职责：toolbar/context menu 纯 model 与 binding helper
- `./types`  
  职责：稳定公共类型，不想继续放大 root barrel 时的承载点

目标不是“必须有 7 个入口”，而是：

- **入口数尽可能少**
- **每个入口都要有明确静态复用价值**

如果未来 `./types` 没有形成真实价值，也可以不单独存在。

## 4.2 明确移除的包级入口

长期最优下，下面这些入口不应继续作为 public exports：

- `./selection`
- `./edit`
- `./frame`
- `./interaction`
- `./pick`
- `./viewport`
- `./utils`
- `./draw`
- `./edge`
- `./mindmap`

原因分别是：

- `selection/edit/frame/viewport` 属于有状态 runtime 面，应进入 `editor.*`
- `interaction/pick/utils` 属于 editor 内部装配或基础设施，不应 host-facing
- `draw/edge/mindmap` 当前导出面混有大量 session、preview、runtime、命令细节，不符合静态 subpath 标准

## 4.3 目标 `exports` 形态

长期最优里，`package.json` 建议收敛为：

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

对应地，`tsup` 入口也应同步收缩，不再保留那些只为 runtime subpath 服务的 entry。

---

## 5. 顶层 entry 文件的最终处置

下面给出一个直接可执行的收敛判断。

## 5.1 应保留的顶层 entry

### `src/index.ts`

保留。

职责应仅限于：

- `createEditor`
- editor 实例类型
- 极少量真正属于主入口的公共类型

不应把各种静态 helper 再重新扁平导回 root。

### `src/tool.ts`

保留。

它适合作为纯静态领域入口：

- tool 类型
- tool factory
- normalize / match helper

### `src/input.ts`

保留。

它适合作为宿主绑定侧的静态 helper 入口：

- pointer down 解析
- target helper
- keyboard shortcut helper

### `src/node.ts`

保留，但必须明显瘦身。

可以继续公开的内容：

- node 模板
- shape spec
- summary / selection view-model
- action builder

不应继续公开的内容：

- node session store
- node preview patch runtime
- transform session
- feature runtime
- raw patch 编译 helper

换句话说，`node.ts` 应变成“静态 node 领域入口”，而不是“node 全家桶”。

### `src/toolbox.ts`

保留。

它承载的是：

- preset
- palette view-model
- insert 相关静态 adapter

这类能力跨 host 复用价值较高。

### `src/chrome.ts`

保留。

它承载的是：

- toolbar/context menu 纯 model
- layout helper
- action binding helper

但前提是这些 helper 自身不能持有 runtime state。

### `src/types.ts`

建议新增。

用途：

- 承载稳定对外类型
- 避免 root `index.ts` 不断膨胀
- 给 React 宿主适配、插件、外部工具一个稳定类型入口

## 5.2 应直接删除的顶层 entry

### `src/edit.ts`

删除。

归属调整为：

- `editor.commands.edit.*`
- `editor.state.edit.*`

不再保留 `@whiteboard/editor/edit`。

### `src/frame.ts`

删除。

归属调整为：

- `editor.commands.frame.*`
- `editor.state.frame.*`

### `src/selection.ts`

删除。

归属调整为：

- `editor.commands.selection.*`
- `editor.read.selection.*`
- `editor.state.selection.*`

其中：

- marquee/gesture 这类会话能力留在 editor 内部
- clipboard 语义动作进入 `editor.commands.clipboard.*`

### `src/interaction.ts`

删除。

它属于 editor 内部 runtime 组织方式，不是 public API。

### `src/pick.ts`

删除。

pick runtime 是内部热路径能力，不适合作为 host-facing 静态入口。

### `src/viewport.ts`

删除。

viewport 属于 `editor.viewport.*`，而不是 `@whiteboard/editor/viewport`。

如果宿主确实需要少量类型：

- 放 root
- 或放 `./types`

而不是继续保留一个 runtime subpath。

### `src/utils.ts`

删除。

`utils` 既不是稳定领域，也不是可长期维护的 public API 命名。

任何仍需外部使用的个别 helper，都应：

- 移到某个明确语义域
- 或直接 internalize

## 5.3 当前形态不应保留、应拆散后收回的 entry

### `src/draw.ts`

当前不建议继续保留为 public subpath。

原因：

- `createDrawState` 属于 runtime state
- 这组能力没有形成明确跨 host 的静态公共面

处理建议：

- draw state 收回 `editor.state` / editor 内部
- 少量纯 brush/style helper 若仍有价值，再决定并入 `tool`、`chrome` 或 `types`

### `src/edge.ts`

当前不建议继续保留为 public subpath。

原因：

- connect session
- preview patch
- reconnect draft

这些都属于 editor runtime / preview 细节。

处理建议：

- 语义写动作收敛到 `editor.commands.edge.*`
- session / preview 能力 internalize
- 真正纯静态 helper 若仍有价值，再抽到更小的静态模块，而不是继续暴露整个 `edge` 子入口

### `src/mindmap.ts`

当前不建议继续保留为 public subpath。

原因：

- 一部分是命令
- 一部分是 drag store
- 一部分是 drag session

静态领域与 runtime 会话已经混在一起。

处理建议：

- mindmap 语义命令进入 `editor.commands.mindmap.*`
- 插入模板归到 `toolbox`
- drag session / store internalize

---

## 6. `node.ts` 的专项瘦身方案

`node.ts` 是当前最容易“名义上合理、实际上过厚”的入口。

长期最优里，建议明确分成两类。

## 6.1 可以保留在 `@whiteboard/editor/node` 的内容

- `createNodeSelectionActions`
- `createTextNodeInput`
- `createStickyNodeInput`
- `createFrameNodeInput`
- `createShapeNodeInput`
- `readShapeSpec`
- `readShapeMeta`
- `readNodeSummaryView`
- `resolveNodeSelectionCan`
- `resolveNodeSelectionView`
- `resolveSelectionPresentation`

这些能力的共同特点是：

- 静态
- 可预测
- 不依赖 editor 生命周期
- 更像 builder / resolver / view-model

## 6.2 应从 `@whiteboard/editor/node` 收回内部的内容

- `createNodeFeatureRuntime`
- `createNodeSessionStore`
- `writeNodeSessionPatch`
- `writeNodeSessionPreview`
- `writeNodeSessionHidden`
- `clearNodeSessionPatch`
- `clearNodeSessionPreview`
- `clearNodeSessionHidden`
- `createTransformSession`
- `NodePatch`
- `toNodeDataPatch`
- `toNodeStylePatch`
- `toNodeFieldUpdate`

这些能力的问题不是“不重要”，而是：

- 它们属于 runtime/session/preview/write 编译细节
- 它们会鼓励 UI 与 host 继续拼 patch
- 它们会让 `node` 子入口从静态 view-model 变成 editor 内脏公开面

长期最优里，这些能力应：

- 要么 internalize
- 要么被 `editor.commands.node.*` 替代

---

## 7. React 侧需要一起收掉的镜像层

仅仅缩 `editor` 的 exports 还不够。

如果 `whiteboard-react` 继续保留大量纯转发文件，边界仍然是虚的。

## 7.1 应删除的 React 镜像 barrel

以下这类文件应优先删除：

- `packages/whiteboard-react/src/runtime/edit/index.ts`
- `packages/whiteboard-react/src/runtime/frame/index.ts`
- `packages/whiteboard-react/src/runtime/interaction/index.ts`
- `packages/whiteboard-react/src/runtime/pick/index.ts`
- `packages/whiteboard-react/src/runtime/selection/index.ts`
- `packages/whiteboard-react/src/runtime/utils/rafTask.ts`

它们的问题是：

- 不增加语义
- 不做适配
- 只是复述 editor public API

这种文件存在越多，包边界越看似分层、实际越模糊。

## 7.2 React 应保留的能力

`whiteboard-react` 仍应保留下面这些真正属于宿主/UI 的模块：

- DOM 事件绑定
- `useBindViewportInput` 这类宿主绑定 hook
- clipboard host adapter
- text measurement
- ResizeObserver
- pointer capture / 浏览器行为差异处理
- JSX render / 组件组合

也就是说：

- **宿主适配保留在 React**
- **runtime 能力归 editor**
- **纯静态 helper 走稳定 subpath**

## 7.3 React 的最终 import 形态

长期最优里，React 侧 import 应尽量收敛为三类：

### A. editor 实例能力

例如：

- `editor.commands.selection.clear()`
- `editor.commands.node.appearance.setFill(...)`
- `editor.read.selection.summary()`
- `editor.state.tool.get()`
- `editor.viewport.clientToScreen(...)`

### B. editor 静态 subpath

例如：

- `@whiteboard/editor/tool`
- `@whiteboard/editor/input`
- `@whiteboard/editor/node`
- `@whiteboard/editor/toolbox`
- `@whiteboard/editor/chrome`

### C. editor 稳定类型

例如：

- `@whiteboard/editor`
- `@whiteboard/editor/types`

React 不应继续依赖：

- `@whiteboard/editor/selection`
- `@whiteboard/editor/frame`
- `@whiteboard/editor/edit`
- `@whiteboard/editor/interaction`
- `@whiteboard/editor/pick`
- `@whiteboard/editor/viewport`

---

## 8. editor 源码布局的目标形态

进一步清理后，`packages/whiteboard-editor/src` 顶层应趋近于：

```text
src/
  index.ts
  types.ts
  tool.ts
  input.ts
  node.ts
  toolbox.ts
  chrome.ts
  runtime/
  features/
  types/
```

关键点：

- 顶层文件只代表真正公开的稳定入口
- `runtime/` 与 `features/` 可以继续存在
- 但它们主要是内部组织空间
- 不能再让每个内部子目录都对应一个包级出口

换句话说：

- **内部目录可以多**
- **public entry 必须少**

---

## 9. 一步到位的执行顺序

因为不考虑兼容成本，建议不要分很碎的过渡阶段，直接按一个收口顺序完成。

## 9.1 第一步：先冻结最终 exports 白名单

先定死最后允许存在的 public entry：

- `.`
- `./tool`
- `./input`
- `./node`
- `./toolbox`
- `./chrome`
- `./types`

这一步的意义是：

- 后续所有迁移都有明确目标面
- 不再围绕“这个子入口也许还能留”来摇摆

## 9.2 第二步：先瘦 `node.ts`

在所有保留入口里，`node.ts` 是最需要先收紧的。

优先动作：

- 把 session / preview / transform / raw patch helper 从 `node.ts` 移出
- 只保留静态 resolver / builder / 模板 / spec

这样可以避免“虽然删了很多 subpath，但 `node` 又变成新的超级出口”。

## 9.3 第三步：React 全量改用最终消费面

在删 exports 之前，先把 `whiteboard-react` 的消费方式统一改到：

- `editor.*`
- 保留的静态 subpath
- 根入口或 `./types`

这一步应同时删除 React 中纯镜像转发层。

## 9.4 第四步：一次性删除废弃 exports 与 entry 文件

完成消费面迁移后，一次性删除：

- `package.json` 中废弃 exports
- `tsup.config.ts` 中废弃 entry
- `src` 下对应顶层 barrel

建议不要保留空壳或 deprecated alias。

## 9.5 第五步：清理 editor 内部命名

删掉 public exports 后，editor 内部也应继续收口命名：

- 公开概念叫 `editor.commands.*`
- 内部概念才叫 runtime / session / coordinator / preview

不要把内部命名继续借 public 层露出去。

---

## 10. 收敛完成后的判定标准

如果下面这些条件同时满足，就说明这轮清理真正完成了。

### 10.1 package exports 已明显收缩

- `@whiteboard/editor` 不再公开 selection/edit/frame/interaction/pick/viewport/utils/draw/edge/mindmap
- 顶层 entry 从当前形态明显收敛到少量稳定入口

### 10.2 root barrel 不再膨胀

- `index.ts` 不再重回“大扁平导出”
- 静态 helper 不再全部回灌到根入口

### 10.3 React 不再镜像 editor runtime 分层

- `whiteboard-react/src/runtime/*` 中不再保留大量纯转发 index
- React 只保留真正的宿主适配和 UI 组合逻辑

### 10.4 UI 不再继续消费 runtime 细节

- UI 不再 import selection/edit/frame/interaction/pick/viewport subpath
- UI 不再直接依赖 session store、preview patch、raw mutation helper

### 10.5 公共 API 语义更稳定

- 外部使用方面对的是 `editor` 实例与少量静态领域
- 不再需要理解 editor 内部目录结构才能正确使用包

---

## 11. 最终结论

进一步清理收敛时，最重要的判断不是：

**“这些顶层文件是不是看起来太碎。”**

而是：

**“这些文件背后的 public subpath，是否真的值得公开存在。”**

长期最优里，答案已经很明确：

- `tool/input/node/toolbox/chrome` 这类静态领域可以保留
- `selection/edit/frame/interaction/pick/viewport/utils` 这类 runtime 映射入口应删除
- `draw/edge/mindmap` 当前形态也不应继续作为 public subpath 保留
- `node` 必须瘦身，不能承接所有残余能力
- `react` 必须同时删掉镜像转发层，否则边界仍然是假的

最终目标不是把 `src` 顶层文件数量做小，而是让：

- **editor 只有少量稳定入口**
- **runtime 能力回到 `editor.*`**
- **React 只承担宿主与 UI 责任**

这才是 public surface 和包边界真正收敛后的长期最优形态。
