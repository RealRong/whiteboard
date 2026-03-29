# Whiteboard 类型审计与收口清单

## 1. 结论

当前仓库的类型问题，核心不是“没有类型目录”，而是下面四件事同时存在：

1. 每个主包其实都已经有自己的 `src/types`，但大量导出的类型仍散落在 `runtime/*`、`features/*`、`hooks/*`、`components/*` 文件里。
2. 一部分类型只是重复别名，或者同语义多名字，属于纯噪音。
3. 一部分类型在不同包里重复定义，owner 不清楚。
4. 一部分类型其实只是单文件实现细节，却被 `export` 了，导致 public surface 被无意义放大。

我的判断是：

- 现在**不应该**新增一个总的 `whiteboard-types` 包。
- 现在**应该**做的是“按包收口类型 owner”，并把**导出的共享类型**稳定收进各包固定的 `src/types` 目录。
- 只有**单文件私有实现类型**可以继续留在文件内，而且最好不要 `export`。

一句话说：

**先做类型瘦脸和 owner 收口，再考虑是否需要更高层的 protocol/model 包；现在不需要一个泛化的 `types` 总包。**

---

## 2. 现状数据

下面这组数据是对 `export type` / `export interface` 的粗盘点，只统计源码，不含 `dist`。  
它不是“精确治理目标”，但足够说明问题分布。

| 包 | 已有 `src/types` | `src/types` 外的导出类型条数 | `src/types` 外的导出类型文件数 |
| --- | --- | ---: | ---: |
| `whiteboard-core` | 有 | 122 | 32 |
| `whiteboard-engine` | 有 | 12 | 5 |
| `whiteboard-editor` | 有 | 206 | 59 |
| `whiteboard-react` | 有 | 43 | 19 |
| `whiteboard-collab` | 无目录，只有 `src/types.ts` | 8 | 2 |

说明：

- `whiteboard-editor` 是当前类型收口压力最大的包。
- `whiteboard-core` 的问题不是数量，而是“类型 owner 分散在 domain 逻辑文件里”。
- `whiteboard-react` 的问题不是基础协议，而是 view model / hook model / runtime alias 噪音很多。
- `whiteboard-collab` 最容易一次收干净。

---

## 3. 推荐规则

后续类型治理建议统一遵守下面几条：

1. **导出的共享类型必须进固定目录。**
   - 建议统一放在每个包的 `src/types/**`。
   - 如果是 internal-only 但跨多个文件共享，放 `src/types/internal/**` 或 `src/runtime/types/**`。

2. **单文件私有实现类型可以留在文件内，但不要 `export`。**
   - 例如组件内部 props helper、局部 state tuple、局部泛型 helper。
   - 只在一个文件里使用，不值得提到全局类型目录。

3. **不要保留 1:1 重命名别名，除非它真的是公共边界。**
   - `type X = Y` 如果只是换个名字，没有边界价值，就应该删掉。

4. **一个语义只允许一个 owner。**
   - 比如写入来源，应该由 `core` 拥有一份，`engine` 不再复制一份同值 union。

5. **不要让 feature 实现文件承载 public type。**
   - `features/draw/state.ts`、`runtime/context/types.ts` 这类文件里可以有内部类型，
   - 但 public type 应该从 `src/types/**` 统一导出。

---

## 4. 跨包共性问题

## 4.1 同语义重复定义

### `Origin` 和 `WriteOrigin`

- `packages/whiteboard-core/src/types/core.ts`
- `packages/whiteboard-engine/src/types/command.ts`

`core` 已经有：

- `Origin = 'user' | 'remote' | 'system'`

`engine` 又定义了一份：

- `WriteOrigin = 'system' | 'user' | 'remote'`

这是最典型的“同语义双 owner”。  
建议：

- 删除 `WriteOrigin` 独立定义。
- `engine` 直接复用 `core` 的 `Origin`。
- 如果 public API 仍想保留 `WriteOrigin` 这个词，最多只做一次 public alias，不要再保留一份新的 union 定义。

### `ResolvedEdgeEnd` / `EdgeEnds`

- `packages/whiteboard-core/src/edge/endpoints.ts`
- `packages/whiteboard-engine/src/types/projection.ts`

这两处基本表达的是同一概念：解析后的 edge endpoint。  
建议：

- 只保留一个 owner。
- 更优先让 `engine` 复用 `core` 的边端点类型。
- 如果 `engine` 的投影语义确实不同，就必须改名，例如 `ProjectedEdgeEnd`。

### `MindmapLine`

- `packages/whiteboard-core/src/mindmap/query.ts`
- `packages/whiteboard-engine/src/types/projection.ts`

两边都是 `{ x1, y1, x2, y2 }` 这一类连接线结构。  
建议：

- 不要继续保留同名双定义。
- 方案 A：统一复用 `core`。
- 方案 B：保留两者，但 `engine` 改名为 `MindmapProjectionLine`。

## 4.2 editor/react 的 Node 元数据重复

- `packages/whiteboard-editor/src/types/node/registry.ts`
- `packages/whiteboard-react/src/types/node/registry.ts`

重复项包括：

- `NodeRole`
- `NodeHit`
- `NodeFamily`
- `ControlId`
- `NodeMeta`

问题不是“React 不能扩展类型”，而是这些基础元信息目前被复制了两份。  
建议：

- 把 node 元数据基础类型收成单一 owner。
- 更合理的 owner 是 `editor` 的 node type public module。
- `react` 只扩展渲染相关类型，例如 `NodeRenderProps`、`NodeWrite`、带 `render/style` 的 React 版 `NodeDefinition`。

## 4.3 太多 “View / Can / Runtime” 后缀

当前命名里有大量下面这类词：

- `Can`
- `View`
- `Runtime`
- `ItemView`
- `GroupView`
- `SelectionNodeSummary`
- `ContextNodeSummary`

这些名字的问题不是不能用，而是：

- 粒度不一致
- 同一层次重复加后缀
- 同语义在不同 domain 下又换一套名字

建议：

- `Can` 统一改成 `Capabilities`
- 能共用的 `MenuItemView / MenuGroupView / NodeSummary / NodeTypeSummary` 就不要再复制 `Selection*` / `Context*` 双前缀
- internal-only runtime 类型可以保留 `Runtime`，但不要放在 public 命名里泛滥

---

## 5. 分包审计

## 5.1 `whiteboard-core`

### 当前判断

`core` 已经天然承担“领域协议层”的角色。  
也就是说，`Document / Node / Edge / Operation / Result / Origin` 这类稳定事实类型，继续由 `core` 拥有是对的。

当前问题主要有两个：

1. `src/types/core.ts` 太大，同时又从 `../mindmap/types` 回拉类型，owner 有点绕。
2. 很多已经对外导出的 domain 类型还散在 domain 逻辑文件里，比如 `node/layout.ts`、`node/snap.ts`、`edge/endpoints.ts`、`mindmap/query.ts`。

### 明确可合并/可改名项

1. `MindmapLine`
   - 文件：`packages/whiteboard-core/src/mindmap/query.ts`
   - 建议：改名为 `MindmapConnectionLine`
   - 原因：语义更清楚，也避免和 `engine` 投影线重名。

2. `MindmapAttachPayload`
   - 文件：`packages/whiteboard-core/src/mindmap/types.ts`
   - 建议：更名为 `MindmapInsertPayload` 或 `MindmapNodePayload`
   - 原因：当前名字像“挂载动作”，但它实际表达的是 mindmap 插入输入 payload。
   - 这里不建议直接删除，因为它和存储后的 `MindmapNodeData` 还不完全等价。

3. `ResolvedEdgeEnd` / `ResolvedEdgeEnds`
   - 文件：`packages/whiteboard-core/src/edge/endpoints.ts`
   - 建议：继续保留 owner 在 `core`，让 `engine` 复用，不要在 `engine` 复制一份。

### 类型目录化建议

`core` 最终应把 public type 收到下面这种结构：

```txt
packages/whiteboard-core/src/types/
  index.ts
  core.ts
  document.ts
  node.ts
  edge.ts
  mindmap.ts
  kernel.ts
  result.ts
  schema.ts
```

说明：

- 算法函数仍然留在 `src/node/*`、`src/edge/*`、`src/mindmap/*`。
- 这些 domain 入口只 re-export 类型，不再自己承载大段 public type 定义。

### 优先级

- 优先级：中
- 原因：`core` 的 owner 边界基本是对的，主要是目录化和去重复，不是概念失控。

---

## 5.2 `whiteboard-engine`

### 当前判断

`engine` 已经有 `src/types/*`，这点比 `editor` 和 `react` 好。  
但它有两个明显结构问题：

1. 有 `src/types/*`，却没有统一的 `src/types/index.ts`。
2. 内部到处走 `@engine-types/*` 旁路，说明类型入口没有真正收稳。

### 明确可删项

1. `WriteOrigin`
   - 文件：`packages/whiteboard-engine/src/types/command.ts`
   - 建议：删除独立定义，直接复用 `@whiteboard/core/types` 的 `Origin`
   - 优先级：高

2. `TranslateFailure`
   - 文件：`packages/whiteboard-engine/src/write/translate/result.ts`
   - 当前：`type TranslateFailure = CommandFailure`
   - 建议：删除这个别名
   - 原因：没有新增语义，只是换名

3. `TranslateSuccess`
   - 文件：`packages/whiteboard-engine/src/write/translate/result.ts`
   - 建议：如果没有外部直接消费需求，可以转为文件内私有类型
   - 保留 `TranslateResult` 即可

### 明确可合并项

1. `ResolvedEdgeEnd` / `EdgeEnds`
   - 文件：`packages/whiteboard-engine/src/types/projection.ts`
   - 建议：复用 `core` 对应类型，或明确改名为 `ProjectedEdgeEnd`

2. `MindmapLine`
   - 文件：`packages/whiteboard-engine/src/types/projection.ts`
   - 建议：复用 `core`，或改名为 `MindmapProjectionLine`

3. `ReadSnapshot`
   - 文件：`packages/whiteboard-engine/src/read/store/types.ts`
   - 当前是跨多个 `read/store/*` 文件共享的 internal 类型
   - 建议：移到 `src/types/internal/read.ts`

### 命名简化建议

1. `WriteInput`、`WriteResult`、`WriteControl` 可以保留
   - 这些是 `engine` 边界上真实有意义的概念

2. `TranslateResult` 保留，`TranslateFailure` 和 `TranslateSuccess` 尽量不暴露
   - 对调用方来说，重要的是总结果，不是拆出来的实现辅助 union 成员

### 类型目录化建议

```txt
packages/whiteboard-engine/src/types/
  index.ts
  command.ts
  commit.ts
  instance.ts
  projection.ts
  read.ts
  result.ts
  store.ts
  write.ts
  mindmap.ts
  internal/
    read.ts
    translate.ts
```

说明：

- `read/store/types.ts`、`write/translate/result.ts` 这类真正被多文件共享的类型，应迁到 `src/types/internal/**`。
- 之后逐步消掉 `@engine-types/*` 旁路，统一改成相对路径或 `src/types/index.ts` 聚合入口。

### 优先级

- 优先级：中高
- 原因：数量不大，但结构异味明显，修完收益很直接。

---

## 5.3 `whiteboard-editor`

### 当前判断

`editor` 是当前类型最胖的包。  
问题不是“类型太多”本身，而是：

1. public type 分散在 `runtime/editor/types.ts`、`runtime/context/types.ts`、`runtime/tool/index.ts`、`features/draw/state.ts`
2. internal type 也散在 runtime/feature 实现文件里
3. 同语义别名和多套命名并存

### 明确可删项

1. `DrawState`
   - 文件：`packages/whiteboard-editor/src/features/draw/state.ts`
   - 当前：`type DrawState = DrawPreferences`
   - 建议：删除
   - 原因：没有任何新增语义，纯别名噪音

2. `ContextMenuItemView`
3. `ContextMenuGroupView`
4. `ContextNodeTypeSummary`
5. `ContextNodeSummary`
6. `ContextSelectionCan`
7. `ContextMenuFilterView`
   - 文件：`packages/whiteboard-editor/src/runtime/context/types.ts`
   - 当前：全部都是 `Selection*` 对应类型的 1:1 alias
   - 建议：不要保留双套命名
   - 做法：改成共享基础类型

### 不建议删除，但应该迁走的位置错误类型

1. `EditorHost`
2. `EditorRuntime`
   - 文件：`packages/whiteboard-editor/src/runtime/editor/types.ts`
   - 它们不是 public facade，应移到 internal type 文件

3. `EditorPlatform`
   - 文件：`packages/whiteboard-editor/src/runtime/editor/createEditorPlatform.ts`
   - 是 editor 内部装配类型，应放 `src/types/internal/editor-platform.ts`

4. `EditorStores`
5. `EditorInternals`
   - 文件：`packages/whiteboard-editor/src/runtime/editor/createEditorStores.ts`
   - 应放 `src/types/internal/editor-store.ts`

6. `EditorCommandHost`
7. `EditorCommandDocumentRuntime`
8. `EditorCommandSelectionRuntime`
9. `EditorCommandToolRuntime`
10. `EditorCommandDrawRuntime`
11. `EditorCommandNodeRuntime`
12. `EditorCommandClipboardRuntime`
13. `EditorCommandRuntime`
   - 文件：`packages/whiteboard-editor/src/runtime/commands/runtime.ts`
   - 它们不是逻辑文件该承载的类型，应该整体迁到 internal command types

### 命名简化建议

1. `SelectionCan`
   - 文件：`packages/whiteboard-editor/src/runtime/context/types.ts`
   - 建议改为：`SelectionCapabilities`
   - 原因：`Can` 太短，语义不稳定，读起来像函数，不像数据结构

2. `SelectionNodeTypeSummary`
   - 建议改为：`NodeTypeSummary`

3. `SelectionNodeSummary`
   - 建议改为：`NodeSummary`

4. `SelectionMenuItemView`
   - 建议改为：`MenuItemView`

5. `SelectionMenuGroupView`
   - 建议改为：`MenuGroupView`

6. `SelectionMenuFilterView`
   - 建议改为：`MenuFilterView` 或 `TypeFilterView`

7. `SelectionLayoutView`
   - 建议改为：`LayoutActions`
   - 因为它更像“可执行布局动作”，不是纯展示 view model

8. `EditorCommand*Runtime`
   - 迁入专门类型文件后可以去掉统一 `EditorCommand` 前缀
   - 例如：
     - `CommandRuntime`
     - `DocumentRuntime`
     - `SelectionRuntime`
     - `ClipboardRuntimeDeps`

### `selection` 这条线的判断

`SelectionInput`、`SelectionTarget`、`SelectionSnapshot` 不是噪音，它们是真正的层次分隔：

- `SelectionInput` 是写入输入
- `SelectionTarget` 是归一化后的目标集合
- `SelectionSnapshot` 是读模型

这三个类型应该保留，但应该：

- 继续 internal-only
- 从 `runtime/selection/state.ts` 抽到 `src/types/internal/selection.ts`

`SelectionTapAction`、`SelectionDragAction`、`SelectionPressPlan` 也是合理的内部概念，但同样不该继续挂在 `runtime/selection/press.ts` 上。

### 类型目录化建议

`editor` 建议分成 public 和 internal 两层：

```txt
packages/whiteboard-editor/src/types/
  index.ts
  public/
    editor.ts
    tool.ts
    draw.ts
    context.ts
    node.ts
    shortcut.ts
    mindmap.ts
  internal/
    editor-runtime.ts
    editor-platform.ts
    editor-store.ts
    command-runtime.ts
    interaction.ts
    selection.ts
    selection-press.ts
    viewport.ts
```

说明：

- `src/index.ts`、`src/tool.ts`、`src/draw.ts`、`src/context.ts` 只 re-export `src/types/public/**`。
- `runtime/*`、`features/*` 里的导出类型应该持续减少。

### 优先级

- 优先级：最高
- 原因：editor 当前是类型扩散的主战场，也是公共边界最容易再次变脏的地方。

---

## 5.4 `whiteboard-react`

### 当前判断

`react` 最大的问题不是基础领域类型，而是：

1. runtime alias 过多
2. feature view type 散在 hook / component 文件里
3. 一批只在单文件里使用的类型还被 `export` 了

### 明确可删项

1. `Editor`
   - 文件：`packages/whiteboard-react/src/runtime/editor/index.ts`
   - 当前：`type Editor = WhiteboardRuntime`
   - 建议：删除
   - 原因：纯别名噪音

2. `ResolvedHistoryConfig`
3. `ResolvedViewportConfig`
4. `ResolvedNodeConfig`
5. `ResolvedEdgeConfig`
   - 文件：`packages/whiteboard-react/src/config/types.ts`
   - 建议：删除这些中间 alias，直接内联到 `ResolvedConfig`
   - 原因：目前只在本文件服务 `ResolvedConfig`

3. `ElementSize`
   - 文件：`packages/whiteboard-react/src/runtime/hooks/useElementSize.ts`
   - 建议：去掉 `export`
   - 原因：只在本文件使用

4. `ViewportInputOptions`
   - 文件：`packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts`
   - 建议：去掉 `export`
   - 原因：只在本文件使用

5. `ShapeMenuValue`
   - 文件：`packages/whiteboard-react/src/features/toolbox/menus/ShapeMenu.tsx`
   - 当前：`type ShapeMenuValue = string`
   - 建议：去掉 `export`，并考虑直接用 `string` 或更明确的 `ShapePresetKey`

6. `NodeSummaryView`
   - 文件：`packages/whiteboard-react/src/features/node/summary.ts`
   - 建议：去掉 `export`
   - 原因：仅在本文件使用

7. `NodeToolbarModel`
   - 文件：`packages/whiteboard-react/src/features/selection/chrome/nodeToolbarModel.ts`
   - 建议：去掉 `export`
   - 原因：仅本文件返回值使用

### 可以保留，但要迁到类型目录的共享 view type

1. `ToolPaletteView`
   - 文件：`packages/whiteboard-react/src/features/toolbox/model.ts`
   - 被多个 toolbox 文件消费
   - 建议迁到 `src/types/toolbox.ts`

2. `SelectedEdgeView`
3. `SelectedEdgeRoutePointView`
   - 文件：`packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts`
   - 被 overlay layer 复用
   - 建议迁到 `src/types/edge.ts`

3. `MindmapTreeViewData`
   - 文件：`packages/whiteboard-react/src/features/mindmap/hooks/useMindmapTreeView.ts`
   - 被组件复用
   - 建议迁到 `src/types/mindmap.ts`

4. `ToolbarItemKey`、`ToolbarItem`、`ToolbarMenuAnchor`、`ContextMenuPlacement`
   - 文件：`packages/whiteboard-react/src/features/selection/chrome/layout.ts`
   - 是 selection chrome feature 的共享 view model
   - 建议迁到 `src/types/selection.ts`

### 命名简化建议

1. `WhiteboardInstance` / `WhiteboardRuntime`
   - 文件：`packages/whiteboard-react/src/runtime/editor/index.ts`
   - 当前问题：public / internal 别名堆叠
   - 建议最终只保留两个名字：
     - public：`WhiteboardEditor` 或继续 `WhiteboardInstance`
     - internal：`InternalWhiteboardEditor`

2. `EdgeView`
   - 文件：`packages/whiteboard-react/src/features/edge/hooks/useEdgeView.ts`
   - 当前和 `@whiteboard/core/edge` 的 `EdgeView` 撞名
   - 建议改为：`ProjectedEdgeView` 或 `CanvasEdgeView`

3. `MindmapNodeView`
   - 如果不跨文件用，建议降为文件内私有类型

4. `ToolPaletteBrushState`
   - 若只作为 `ToolPaletteView` 的内部拼装结构，建议降为文件内私有类型

### 类型目录化建议

```txt
packages/whiteboard-react/src/types/
  index.ts
  common/
    board.ts
    config.ts
    collab.ts
    shortcut.ts
  node/
    index.ts
    registry.ts
  edge.ts
  selection.ts
  toolbox.ts
  mindmap.ts
  runtime.ts
```

规则：

- `hook` / `component` 文件不再导出共享类型。
- 真正被多文件共享的 feature view model 才进入 `src/types/**`。
- 只在一个文件里用的类型，要么内联，要么保留文件内私有，不再 `export`。

### 优先级

- 优先级：高
- 原因：React 侧 public API 已经相对收口，现在最值得做的是“去噪音”和“把共享 feature view type 挪走”。

---

## 5.5 `whiteboard-collab`

### 当前判断

`collab` 最简单，也最容易一次做干净。  
现在它只有 `src/types.ts`，没有固定目录。

### 明确可删项

1. `LocalCommit`
   - 文件：`packages/whiteboard-collab/src/types.ts`
   - 当前没有实际使用
   - 建议：删除

### 需要判断是否 public 的类型

1. `RemoteDocumentChange`
   - 文件：`packages/whiteboard-collab/src/types.ts`
   - 当前只在 `yjs/diff.ts` 使用
   - 如果不准备作为 public API 暴露，就改成 internal 类型，不要继续从公共类型文件暴露

### 命名建议

1. `YjsSessionOptions`
   - 建议考虑改成 `CreateYjsSessionOptions`
   - 原因：表达“创建参数”更明确

### 类型目录化建议

```txt
packages/whiteboard-collab/src/types/
  index.ts
  session.ts
  provider.ts
```

### 优先级

- 优先级：高
- 原因：小包，小成本，高确定性。

---

## 6. 确定可砍掉的类型清单

这部分只列我认为“可以直接动手”的高置信度项。

1. `packages/whiteboard-editor/src/features/draw/state.ts`
   - 删除 `DrawState`

2. `packages/whiteboard-engine/src/types/command.ts`
   - 删除独立 `WriteOrigin` 定义，统一用 `Origin`

3. `packages/whiteboard-engine/src/write/translate/result.ts`
   - 删除 `TranslateFailure`
   - `TranslateSuccess` 改为文件内私有

4. `packages/whiteboard-editor/src/runtime/context/types.ts`
   - 删除下面这些 1:1 alias：
   - `ContextMenuItemView`
   - `ContextMenuGroupView`
   - `ContextNodeTypeSummary`
   - `ContextNodeSummary`
   - `ContextSelectionCan`
   - `ContextMenuFilterView`

5. `packages/whiteboard-react/src/runtime/editor/index.ts`
   - 删除 `Editor = WhiteboardRuntime`

6. `packages/whiteboard-react/src/config/types.ts`
   - 删除：
   - `ResolvedHistoryConfig`
   - `ResolvedViewportConfig`
   - `ResolvedNodeConfig`
   - `ResolvedEdgeConfig`

7. `packages/whiteboard-react/src/runtime/hooks/useElementSize.ts`
   - `ElementSize` 去掉 `export`

8. `packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts`
   - `ViewportInputOptions` 去掉 `export`

9. `packages/whiteboard-react/src/features/toolbox/menus/ShapeMenu.tsx`
   - `ShapeMenuValue` 去掉 `export`

10. `packages/whiteboard-react/src/features/node/summary.ts`
   - `NodeSummaryView` 去掉 `export`

11. `packages/whiteboard-react/src/features/selection/chrome/nodeToolbarModel.ts`
   - `NodeToolbarModel` 去掉 `export`

12. `packages/whiteboard-collab/src/types.ts`
   - 删除 `LocalCommit`

---

## 7. 推荐改名清单

这部分是“建议改”，不是“必须立刻改”。

1. `SelectionCan` -> `SelectionCapabilities`
2. `SelectionNodeTypeSummary` -> `NodeTypeSummary`
3. `SelectionNodeSummary` -> `NodeSummary`
4. `SelectionMenuItemView` -> `MenuItemView`
5. `SelectionMenuGroupView` -> `MenuGroupView`
6. `SelectionMenuFilterView` -> `MenuFilterView` 或 `TypeFilterView`
7. `SelectionLayoutView` -> `LayoutActions`
8. `MindmapAttachPayload` -> `MindmapInsertPayload` 或 `MindmapNodePayload`
9. `MindmapLine`（core） -> `MindmapConnectionLine`
10. `MindmapLine`（engine） -> `MindmapProjectionLine`
11. `EdgeView`（react hook） -> `ProjectedEdgeView` 或 `CanvasEdgeView`
12. `WhiteboardRuntime` -> `InternalWhiteboardEditor`

---

## 8. 不建议删除的类型

为了避免误伤，这里列一批我认为应该保留的类型。

1. `EditorRead`
2. `EditorViewport`
   - 它们虽然是 alias，但承担 public facade 边界，保留是合理的

3. `SelectionInput`
4. `SelectionTarget`
5. `SelectionSnapshot`
   - 它们分别对应输入、归一化目标、读模型，层次是成立的
   - 但应改成 internal type 文件 owner

6. `SelectionTapAction`
7. `SelectionDragAction`
8. `SelectionPressPlan`
   - 这些是 selection 按压决策里的真实中间模型
   - 不建议删，但应 internal-only，并迁到固定类型目录

9. `ToolPaletteView`
10. `SelectedEdgeView`
11. `MindmapTreeViewData`
   - 这些是共享 feature view model，不是噪音
   - 应迁走，不应删除

12. `RemoteDocumentChange`
   - 如果未来 collab diff API 要公开，就该保留
   - 如果不公开，再降为 internal

---

## 9. 推荐执行顺序

按性价比排序，我建议这样做：

1. 先删高置信度噪音类型
   - `DrawState`
   - `WriteOrigin`
   - `LocalCommit`
   - React 那批只在单文件使用却被 `export` 的类型

2. 再收 editor/context 命名
   - 消掉 `Selection*` / `Context*` 双套 alias

3. 再建每个包的固定类型入口
   - `whiteboard-collab/src/types/index.ts`
   - `whiteboard-engine/src/types/index.ts`
   - `whiteboard-editor/src/types/index.ts`
   - `whiteboard-react/src/types/index.ts`

4. 再把共享 feature view model 挪进类型目录
   - `ToolPaletteView`
   - `SelectedEdgeView`
   - `MindmapTreeViewData`
   - selection chrome layout types

5. 最后再做跨包重复消重
   - `Origin` / `WriteOrigin`
   - `ResolvedEdgeEnd`
   - `MindmapLine`
   - node metadata 基础 union

---

## 10. 最终目标状态

类型收口完成后，仓库应该接近下面这个状态：

1. 每个包都有明确的 `src/types` 入口。
2. 导出的共享类型都能在固定目录找到。
3. runtime / feature / hook / component 文件里的 `export type` 显著减少。
4. 1:1 alias 基本消失，只保留真正承担边界语义的 alias。
5. 跨包不再出现同语义双定义。
6. public type 和 internal type 分层明确。

如果只用一句话概括这个清单的方向，就是：

**类型要跟着 owner 走，跟着语义走，不要跟着“写在哪个实现文件顺手”走。**
