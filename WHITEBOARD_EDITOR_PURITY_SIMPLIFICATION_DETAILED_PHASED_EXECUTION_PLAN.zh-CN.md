# Whiteboard Editor 纯化简化详细分阶段施工文档

## 1. 文档定位

这份文档是施工依据，不再讨论“是否应该收边界”，而是直接给出：

- 已经确定的长期最优判断
- `editor` / `react` 的最终职责切分
- 宿主桥接到底放哪
- 当前文件该怎么分流
- 分阶段实施顺序
- 每阶段的输入、输出、禁做项与完成标准

本文与以下文档配套使用：

- [WHITEBOARD_EDITOR_PURITY_SIMPLIFICATION_PHASED_IMPLEMENTATION_PLAN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_EDITOR_PURITY_SIMPLIFICATION_PHASED_IMPLEMENTATION_PLAN.zh-CN.md)
- [WHITEBOARD_EDITOR_RUNTIME_ACTION_CHROME_BOUNDARY_OPTIMAL_DESIGN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_EDITOR_RUNTIME_ACTION_CHROME_BOUNDARY_OPTIMAL_DESIGN.zh-CN.md)
- [WHITEBOARD_EDITOR_PUBLIC_API_AND_SEMANTIC_COMMAND_LONG_TERM_DESIGN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_EDITOR_PUBLIC_API_AND_SEMANTIC_COMMAND_LONG_TERM_DESIGN.zh-CN.md)
- [WHITEBOARD_REACT_BOUNDARY_LONG_TERM_OPTIMAL_DESIGN.zh-CN.md](/Users/realrong/whiteboard/WHITEBOARD_REACT_BOUNDARY_LONG_TERM_OPTIMAL_DESIGN.zh-CN.md)

如果本文件与旧实现或旧 import 习惯冲突，以本文件描述的目标边界为准。

---

## 2. 已冻结的长期判断

这部分视为硬约束，不再在实施阶段反复讨论。

## 2.1 `editor` 的最小职责

`@whiteboard/editor` 长期最优只保留下面五类能力：

1. 交互运行时基础设施
2. feature-owned transient session
3. interactive projected read
4. 语义化 commands
5. 最小宿主桥接

## 2.2 最小宿主桥接留在 `editor`

这个判断已经冻结：

**runtime-critical host bridge 留在 `editor`，不留在 `react`。**

具体包括：

- clipboard port / clipboard bridge
- document selection lock
- pointer session continuation
- browser-level input target semantics

原因：

- 它们直接决定 interaction session 是否成立
- 直接决定 preview/commit 链是否正确
- 直接决定 `clipboard` 是否能作为正式 command 域成立

## 2.3 `react` 保留 host binding 与 UI binding

这个判断也已经冻结：

**`react` 保留 host binding + UI binding，不重新接管 editor runtime。**

具体包括：

- DOM 事件绑定
- refs / effect 生命周期
- DOM measurement
- 文本测量
- toolbar / context menu / palette 的视觉层
- placement 到 style 的最后一跳
- renderer registry

## 2.4 `editor` 禁止 import `react`

最终目标中：

- `@whiteboard/editor` 不再 import `react`
- `NodeDefinition` 不再包含 `ReactNode` / `CSSProperties`

## 2.5 `editor.read` 只做 interactive projected read

`editor.read` 只表达：

- committed 状态与 transient/session 状态合并后的最终领域交互态

明确不做：

- toolbar read
- context menu read
- palette read
- 视觉层 chrome read

## 2.6 `editor.commands` 仍然是唯一写入口

不引入第二写入口。

不让 menu / toolbar model 直接承载 write 语义。

## 2.7 不为了“未来可能复用”提前造复杂 action framework

当前优先级是简化，不是预抽象。

所以：

- 不先上统一 action engine
- 不先上统一 spec runtime
- 不先上插件化 action 执行总线

只有出现真实多宿主复用需求，再决定是否补纯 action spec。

---

## 3. 最终职责矩阵

这部分回答“什么放哪”。

## 3.1 留在 `editor` 的

### Runtime Infra

- `interaction`
- `input`
- `pick`
- `viewport`
- `snap`
- `finalize`

### Feature Session

- `node/session`
- `node/drag`
- `node/transform`
- `edge/connect`
- `edge/preview`
- `selection/marquee`
- `selection/gesture`
- `mindmap/drag`

### Interactive Projected Read

- `runtime/read/*`
- 所有 committed + transient 的最终领域态投影

### Semantic Commands

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

### Runtime-Critical Host Bridge

- clipboard port / service
- selection lock service
- pointer continuation service
- input target semantics

## 3.2 留在 `react` 的

### Host Binding

- DOM 事件接线
- refs 与 effect 生命周期
- component-level input wiring

### UI Host Helpers

- DOM measurement
- 文本测量
- placement to style
- portal / overlay / animation

### Renderer

- node renderer registry
- visual style registry
- ReactNode / JSX / CSSProperties

### Chrome / Presentation

- toolbar
- context menu
- palette
- summary 文案
- option 列表
- shape/menu 视觉结构

## 3.3 直接删除或消失的概念

- `editor` 内部的 `hooks/` 目录
- 当前形态的 `NodeActionItem / NodeActionSection / NodeSelectionActions`
- `closeAfter`
- `@whiteboard/editor/chrome` 这条 React-only public surface
- 所有模块级共享可变状态

---

## 4. 当前文件归类与目标落点

## 4.1 当前文件到目标层的映射

### 保留在 `editor`

- `packages/whiteboard-editor/src/runtime/interaction/*`
- `packages/whiteboard-editor/src/runtime/input/*`
- `packages/whiteboard-editor/src/runtime/pick/*`
- `packages/whiteboard-editor/src/runtime/viewport/*`
- `packages/whiteboard-editor/src/runtime/read/*`
- `packages/whiteboard-editor/src/runtime/selection/*`
- `packages/whiteboard-editor/src/runtime/finalize.ts`
- `packages/whiteboard-editor/src/features/node/session/node.ts`
- `packages/whiteboard-editor/src/features/node/drag/session.ts`
- `packages/whiteboard-editor/src/features/node/hooks/transform/session.ts`  
  迁移后改名
- `packages/whiteboard-editor/src/features/edge/connect.ts`
- `packages/whiteboard-editor/src/features/edge/connectSession.ts`
- `packages/whiteboard-editor/src/features/edge/preview.ts`
- `packages/whiteboard-editor/src/features/selection/marquee.ts`
- `packages/whiteboard-editor/src/features/selection/gesture.ts`
- `packages/whiteboard-editor/src/features/mindmap/session/drag.ts`
- `packages/whiteboard-editor/src/features/mindmap/dragSession.ts`
- `packages/whiteboard-editor/src/features/mindmap/commands.ts`
- `packages/whiteboard-editor/src/features/toolbox/insert.ts`
- `packages/whiteboard-editor/src/features/toolbox/presets.ts`
- `packages/whiteboard-editor/src/features/node/summary.ts` 中纯语义部分

### 改造成 `editor` 内的 host bridge/service

- `packages/whiteboard-editor/src/features/selection/actions/clipboard.ts`
- `packages/whiteboard-editor/src/runtime/interaction/coordinator.ts` 中 selection lock 逻辑
- `packages/whiteboard-editor/src/runtime/interaction/coordinator.ts` 中 pointer capture / window listener / blur 协调逻辑

### 移到 `react`

- `packages/whiteboard-editor/src/features/selection/chrome/*`
- `packages/whiteboard-editor/src/features/toolbox/paletteModel.ts`
- `packages/whiteboard-editor/src/features/node/summaryView.ts`  
  如果最终只用于 UI summary 展示
- `packages/whiteboard-editor/src/features/node/selection.ts` 中 chrome/presentation 部分
- `packages/whiteboard-editor/src/features/selection/chrome/options.ts`
- `packages/whiteboard-editor/src/types/node/registry.ts` 中 render/style 部分

### 删除或重写

- `packages/whiteboard-editor/src/features/node/actions.ts`
- `packages/whiteboard-editor/src/features/selection/chrome/menuModel.ts`
- `packages/whiteboard-editor/src/chrome.ts`

---

## 5. 目标目录蓝图

这不是要求一次性改到位，而是最终参考蓝图。

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
      pick/
      viewport/
      snap/
    host/
      clipboard/
      selectionLock/
      pointerContinuation/
      inputTarget/
    read/
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
      summary.ts
      session/
        node.ts
        drag.ts
        transform.ts
    edge/
      connect.ts
      session/
        connect.ts
        preview.ts
    selection/
      policy/
      session/
        gesture.ts
        marquee.ts
    mindmap/
      session/
        drag.ts
      commands.ts
    toolbox/
      presets.ts
      insert.ts
  types/
    node/
      semanticRegistry.ts
```

React 侧承接：

```text
packages/whiteboard-react/src/
  editor/
    host/
      bindings/
      measurement/
      textMeasure/
    chrome/
      toolbar/
      contextMenu/
      palette/
    registry/
      rendererRegistry.ts
```

---

## 6. 分阶段依赖关系

实施顺序不能乱。

正确依赖关系是：

1. 先冻结边界与护栏
2. 先解决跨实例与 browser-global 风险
3. 再把 `editor.read` 站稳
4. 再拆 React 泄漏
5. 再搬 React-only chrome
6. 再瘦身 `createEditor` 和 `InternalEditor`
7. 最后删中间抽象与收 public API

原因：

- 不先做 host bridge，后面每一步都会踩模块级状态和全局副作用
- 不先做 projected read，后面 chrome 与 UI 很容易继续手工拼 preview
- 不先拆 registry，就没法真正定义 `editor` 是框架无关 runtime

---

## 7. 详细阶段计划

下面每个阶段都按：

- 目标
- 范围
- 要做的事
- 不做的事
- 交付物
- 完成标准

来写。

## Phase 0：边界冻结与迁移台账

### 目标

把边界判断正式冻结，避免施工中反复漂移。

### 范围

- 文档
- 目录台账
- 硬约束

### 要做的事

1. 按本文的职责矩阵给当前 `packages/whiteboard-editor/src` 全量文件打标签：
   - keep-editor
   - move-react
   - host-bridge
   - delete
   - split
2. 明确宿主边界：
   - runtime-critical host bridge 在 `editor`
   - host binding / UI binding 在 `react`
3. 明确三个硬约束：
   - `editor` 禁止新增 `react` import
   - `editor` 禁止新增 `hooks/` 目录
   - 禁止新增模块级共享可变状态

### 不做的事

- 不改代码逻辑
- 不改 public API

### 交付物

- 完整迁移台账
- 约束说明

### 完成标准

- 每个关键模块都有最终归属
- 宿主桥接边界不再含糊

## Phase 1：宿主桥接显式化

### 目标

把真正应留在 `editor` 的宿主桥接从散落逻辑改成显式 port/service。

### 范围

- clipboard
- selection lock
- pointer continuation

### 要做的事

1. 把 clipboard 改造成 `editor` 内的正式 host port：
   - command 语义留在 `editor.commands.clipboard`
   - browser IO 通过 clipboard port 注入
2. 把 document selection lock 从 coordinator 内联逻辑中拆出：
   - 变成 shared 或 ref-counted service
3. 把 pointer capture / window 级 move/up/cancel / blur 协调从 coordinator 内联逻辑中收敛：
   - 变成 `pointerContinuation` 或同类 browser service
4. 明确这些 service 的创建、注入、dispose 时机。

### 不做的事

- 不搬 chrome
- 不拆 registry
- 不瘦身 `createEditor`

### 交付物

- clipboard port/service
- selection lock service
- pointer continuation service

### 完成标准

- 多实例 clipboard 不再互相污染
- selection lock 不再是模块级或隐式全局行为
- session continuation 不再散落在 coordinator 内部实现细节中

## Phase 2：收敛 interactive projected read

### 目标

让 `editor.read` 真正成为最终交互态领域读模型。

### 范围

- `runtime/read/*`
- feature session 与 read 的拼接边界

### 要做的事

1. 梳理 node / edge / bounds / pick / snap 当前消费的源。
2. 确保这些能力统一消费 interactive projected read。
3. 禁止 React 再自行手工拼接 committed + transient preview。
4. 明确：
   - `editor.read` 只表达交互态领域对象
   - chrome/palette/menu 不进 `editor.read`

### 不做的事

- 不引入统一 `runtime.session.*` 顶层公开面
- 不把 toolbar/context menu 读模型塞进 `editor.read`

### 交付物

- 更稳定的 node/edge preview 投影路径
- 更清晰的 read 责任边界

### 完成标准

- React 组件层不再分散地合并 preview
- pick/snap/bounds 与实际 preview 一致

## Phase 3：拆掉 React 泄漏

### 目标

让 `editor` 在类型和 registry 层真正脱离 React。

### 范围

- `types/node/registry.ts`
- `package.json`

### 要做的事

1. 拆 semantic registry 与 renderer registry。
2. 从 `editor` 类型面移除：
   - `ReactNode`
   - `CSSProperties`
3. 清理 `editor` 对 React 的 peer/import 依赖。

### 不做的事

- 不同时全面迁移 toolbar/menu

### 交付物

- semantic registry
- renderer registry
- 无 React import 的 `editor`

### 完成标准

- `packages/whiteboard-editor/src` 不再 import `react`
- `editor` 成为真正框架无关 runtime

## Phase 4：搬走 React-only chrome 与 UI helper

### 目标

把纯 React host 的 UI 层能力一次性搬出去。

### 范围

- `features/selection/chrome/*`
- `paletteModel`
- 文案 helper
- option list
- measurement/style helper

### 要做的事

1. 把 toolbar/context menu/palette 相关 helper 挪到 `react`。
2. 把 DOM measurement 与 `CSSProperties` helper 挪到 `react`。
3. 把 summary title/detail 这类 UI 文案 helper 挪到 `react`。
4. 明确 React 只消费：
   - `editor.read`
   - `editor.state`
   - `editor.commands`
   - 本地 UI helper

### 不做的事

- 不先造 editor 内部的通用 spec runtime

### 交付物

- React 侧完整接管 chrome/presentation helper

### 完成标准

- `editor` 中不再出现 DOM measurement
- `editor` 中不再出现 style object builder
- `chrome.ts` 可以开始删除或极限收缩

## Phase 5：瘦身 `createEditor` 与 `InternalEditor`

### 目标

把 `createEditor` 收回 composition-only，并消灭 feature 对 God object 的默认依赖。

### 范围

- `runtime/instance/createInstance.ts`
- `runtime/instance/types.ts`

### 要做的事

1. 把 command 语义拆到独立模块：
   - selection
   - frame
   - draw
   - node appearance
   - node text
   - insert
   - clipboard
   - mindmap
2. 让 `createEditor` 只负责接线。
3. 为 feature session / read helper 定义更窄的依赖 port。
4. 移除 `hooks/` 路径名。

### 不做的事

- 不同时重构 React UI

### 交付物

- 拆分后的 command 模块
- 更窄的 feature 依赖端口

### 完成标准

- `createEditor` 不再装大量业务规则
- 多数 feature 不再直接依赖完整 `InternalEditor`

## Phase 6：删除中间 action/model 抽象

### 目标

让 React 直接使用语义化 read + commands，不再依赖 editor 内部的 UI-oriented action builder。

### 范围

- `features/node/actions.ts`
- `features/selection/chrome/menuModel.ts`
- 同类 UI item builder

### 要做的事

1. 删除当前形态的 `NodeActionItem / NodeSelectionActions`。
2. React 基于：
   - `summarizeNodes`
   - `resolveNodeSelectionCan`
   - `editor.read`
   - `editor.commands`
   直接组织 toolbar/menu。
3. 若有局部重复，优先在 `react` 内补局部 helper，而不是回流到 `editor`。

### 不做的事

- 不引入统一 action framework

### 交付物

- 更直接的 React UI 组合方式

### 完成标准

- `editor` 中不再有“label + disabled + onClick”混合 action model

## Phase 7：收口 public API

### 目标

让公开面与最终职责一致。

### 范围

- `package.json exports`
- `src/chrome.ts`
- `src/node.ts`
- `src/toolbox.ts`

### 要做的事

1. 删除或极限收缩 `./chrome`
2. 收窄 `./node`
3. 收窄 `./toolbox`
4. 不再镜像内部目录导出 subpath
5. 只保留真正有跨 host 价值的纯静态能力

### 不做的事

- 不为了兼容旧调用面保留 facade

### 交付物

- 更小、更稳定的 public surface

### 完成标准

- `editor` 的公开面不再暴露 React-only helper
- 包级 subpath 不再等同于内部目录结构

---

## 8. 实施顺序中的禁止事项

为避免施工跑偏，下面这些行为明确禁止。

## 8.1 不要先搬 UI，再补 projected read

否则 React 会继续在新位置手工拼 preview，问题只是换地方。

## 8.2 不要把 host binding 也算进 `editor` 宿主桥接

`editor` 只保留 runtime-critical host bridge。

不要把：

- refs
- DOM measurement
- text measurement
- toolbar layout

也塞回 `editor`。

## 8.3 不要为了“通用性”提前引入 spec framework

当前目标是简化。

任何新增：

- action runtime
- command metadata bus
- generic menu spec engine

都应被默认视为过度设计，除非有明确复用证据。

## 8.4 不要在阶段中途恢复模块级共享状态

任何新的：

- `let cache`
- `let current`
- `let packet`

如果不是 instance/service 持有，都应视为架构回退。

---

## 9. 每阶段验收时必须检查的回归面

## 9.1 交互回归

- node drag
- node transform
- edge connect / reconnect
- marquee
- mindmap drag
- auto-pan
- viewport direct gesture

## 9.2 command 回归

- undo / redo
- selection replace / clear / selectAll
- frame enter / exit
- clipboard copy / cut / paste
- insert preset

## 9.3 边界回归

- `editor` 是否重新 import 了 `react`
- 是否新增 `hooks/` 目录
- 是否新增模块级共享状态
- 是否有 chrome/presentation logic 又回流进 `editor.read`

---

## 10. 最终完成态的判断标准

当整个施工完成后，应满足下面五条。

1. `editor` 只关心交互正确性、preview 正确性与语义写入。
2. `react` 只关心 host binding、rendering 与 UI lifecycle。
3. runtime-critical host bridge 全留在 `editor`，host binding / UI binding 全留在 `react`。
4. `editor.read` 是 interactive projected read，不是 chrome read。
5. `editor.commands` 是唯一写入口，UI 直接消费它，而不是先绕过一层混合 action model。

一句话总结：

**最终的 `@whiteboard/editor` 应该像“交互运行时内核”，而不是“React UI 工具包”；最终的 `@whiteboard/react` 应该像“宿主绑定与渲染层”，而不是“隐形 editor runtime”。**

