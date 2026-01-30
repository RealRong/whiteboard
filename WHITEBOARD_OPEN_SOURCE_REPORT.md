# Rendevoz Whiteboard 开源拆分分析报告

> 说明：你提到的路径是 `src/core/whiteboard`，实际实现位于 `src/core/components/whiteboard`，并依赖 `_rendevoz/typings/components/whiteboard` 里的类型定义。

## 1. 现状概览

### 1.1 入口与数据流
- 入口组件：`src/core/components/whiteboard/index.tsx` 导出 `Whiteboard`。
- 数据源：`ObjectStore('whiteboard')` 提供白板数据；`globalStore.sub()` 订阅全局变更。
- 状态分层：
  - **WhiteboardAtom**：白板数据（nodes/edges/白板设置等）。
  - **WhiteboardStateAtom**：交互状态（缩放、工具、选择、是否拖拽等）。
  - **WhiteboardTransformAtom**：视口变换（x/y/scale）。
- 核心实例：`IWhiteboardInstance`（`useWhiteboardInstance` + `useAssignWhiteboardInstance`）集中挂载操作能力（nodeOps、layoutOps、containerOps、historyOps…）。
- 行为挂载：`WhiteboardHookContainer` 统一注册所有行为（自动滚动、拖放、快捷键、历史记录等）。

### 1.2 目录结构（核心模块划分）
- `edge/`：连线渲染与交互（添加、重连、样式）。
- `freehand/`：自由绘制层（perfect-freehand）。
- `hooks/`：交互与操作逻辑（state、history、select、keyboard、ops/*）。
- `node/`：节点容器、节点类型、mindmap 逻辑、拖拽/resize。 
- `panzoom/`：自带 pan/zoom 实现（本地拷贝版）。
- `toolbars/`：工具条、浮动面板、菜单。
- `sidebar/`：右侧内容/大纲面板。
- `utils/`：几何、对齐、布局、导出等工具函数。
- 顶层：`WhiteboardMinimap`、`WhiteboardSearch`、`WhiteboardSettings`、`WhiteboardPasteSelector` 等功能组件。

## 2. 功能清单（可作为开源卖点）
- 视口：平滑 pan/zoom、滚轮与快捷键协同、记忆视口。
- 节点系统：
  - 基础节点：`text / image / freehand / group / mindmap`。
  - 扩展节点：`metaObject`，可嵌入 note/pdf/chat/tweet/whiteboard 等业务对象。
- 连线：多种线型（直线/曲线/折线/紧凑曲线）、样式（虚线/动画）、端点控制。
- 选择/操作：框选、拖拽、缩放、吸附对齐（SnapDragLayer）、对齐/分布/自动布局。
- Mindmap：左右树结构、拖拽吸附、展开/折叠、自动布局。
- 绘制：多种笔刷参数，压力/透明度等。
- 工具：右键菜单、浮动工具栏、搜索、迷你地图、导出图片。
- 历史：基于 Immer patches 的撤销/重做。

## 3. 当前耦合点与拆分阻力

### 3.1 数据/业务耦合（高）
- `ObjectStore / MetaStore / NoteStore / groupStore`：白板数据持久化与业务对象互链。
- `MetaObjectNode`：渲染 note/pdf/video/audio/chat/question/tweet/exam 等强业务组件。
- 白板搜索依赖 `SearchHelper`、`slateToMarkdown`。

### 3.2 全局依赖（高）
- `Global`：拖拽、文件归一化、图标、布局打开等。
- `SettingAtom / GlobalSetting`：白板设置项来自应用全局设置。

### 3.3 UI/样式依赖（中-高）
- `@/components`：Content/Icon/Menu/Modal/WithBorder 等基础 UI。
- `@/consts`：Colors/Icons/trans，内建 i18n key。

### 3.4 编辑器/文档能力依赖（中）
- TextNode 基于 Slate content；粘贴依赖 `deserializeHTML/deserializeMarkdown`。

### 3.5 类型来源（中）
- `_rendevoz/typings/components/whiteboard` 作为类型基准，若开源需抽离并去应用化。

结论：**当前 whiteboard 是“强内嵌式模块”，需要解耦适配层与插件体系，才能变成独立开源组件。**

## 4. 开源价值评估

### 4.1 价值点
- **功能密度高**：白板 + mindmap + 卡片式对象 + 连线编辑 + 绘图 + 搜索/导出/历史。
- **节点模型清晰**：`IWhiteboardNode` 类型扩展结构天然支持插件化。
- **交互细节成熟**：Snap/对齐/拖拽/缩放/快捷键等完整。
- **可作为“白板内核”**：适合被其他团队嵌入自己的应用。

### 4.2 风险与成本
- 需要剥离大量业务节点与 Rendevoz 特有数据/组件。
- 现有代码默认依赖全局状态和 UI 组件系统，独立化需要重构。
- 类型定义与持久化格式（Map）需要标准化序列化方案。
- 需要补齐文档、示例、测试和许可证审核（panzoom / html-to-image / perfect-freehand / re-resizable 等）。

## 5. 拆分目标架构（建议）

### 5.1 包结构
1) **@rendevoz/whiteboard-core**
- 只包含：类型定义、纯函数算法、布局/对齐/几何、数据结构、序列化/反序列化、历史记录逻辑。
- 不依赖 React/DOM。

2) **@rendevoz/whiteboard-react**
- 只包含：React 组件、hooks、交互逻辑、pan/zoom、渲染层。
- 只依赖 `whiteboard-core` + React + UI 基础（可提供可替换 UI 接口）。

3) **@rendevoz/whiteboard-plugins**（可选）
- Rendevoz 业务插件：`MetaObjectNode`、对象拖放/链接、SearchHelper、Note/Chat/PDF 等。

### 5.2 关键适配接口（需要设计）
- **DataAdapter**：负责持久化与订阅
  - `load(id)` / `subscribe(id, cb)` / `update(id, next)` / `createId()`
- **NodeRendererRegistry**：根据 `node.type` 返回 React 组件
- **Command/Toolbar/ContextMenu Registry**：开放菜单与快捷键注册
- **I18n Adapter**：`t(key, params)` + 词条 map
- **Asset Adapter**：图片/文件/剪贴板输入标准化
- **Theme Adapter**：颜色/图标 token

### 5.3 模块归属建议（示例）
- **core**：`utils/`、`node/mindmap/utils`、`hooks/ops/*`（不依赖 DOM 的部分）、类型（IWhiteboard*）、序列化、对齐与布局算法。
- **react**：`index.tsx`、`WhiteboardPanzoom`、`WrapperNode`、`EdgeOverlay`、`FreeHandLayer`、`WhiteboardSelect`、`SnapDragLayer`、`WhiteboardMinimap` 等。
- **plugin**：`MetaObjectNode`、`WhiteboardSearch`（依赖 SearchHelper）、`useWhiteboardDrop`（依赖 Global + MetaStore + ObjectStore）等。

## 6. 拆分迁移路线（可执行）

### Step 1：抽离类型与纯函数
- 将 `_rendevoz/typings/components/whiteboard` 复制到 `packages/whiteboard-core/src/types`。
- 将不依赖 UI 的工具函数与布局算法迁移到 core。

### Step 2：引入 Adapter 入口（先不改功能）
- 在白板代码中逐步替换 `ObjectStore/MetaStore/Global/SettingAtom` 为接口调用，提供默认实现仍指向当前 App。

### Step 3：分离“业务节点”
- `MetaObjectNode` 及其子组件整体转移到插件层。
- 默认开源版本只保留 `text/image/freehand/mindmap/group`。

### Step 4：React 包拆分
- 将 `src/core/components/whiteboard` 内的 UI 组件迁移到 `whiteboard-react`。
- 通过 Adapter 提供 `Icon/Theme/i18n`，避免硬依赖 `@/components`。

### Step 5：持久化与序列化标准化
- 统一 nodes/edges 结构为 `Array` + `id`，在内核层提供 `toMap/fromMap`。
- 对外暴露 JSON schema，便于社区使用与存储。

### Step 6：示例与文档
- 增加 `examples/basic`（只用基础节点）与 `examples/advanced`（演示插件）
- 说明如何注册自定义节点与菜单。

### Step 7：应用侧回接
- 在 Rendevoz 内部用插件实现保留原功能（对象卡片、搜索、拖拽、白板链接等）。
- 替换 `src/core/components/whiteboard` 为新包。

## 7. 建议的开源最小版本（MVP）
- 白板渲染与基础交互（pan/zoom、选中、拖拽、缩放）
- 基础节点：text / image / freehand / group / mindmap
- 线条与对齐布局
- Undo/Redo
- Minimap + 导出图片
- 简单 toolbar + 事件 API

## 8. 结论
- 现有白板模块功能完整、交互成熟，**具备较高开源价值**。
- 主要难点在于 **强业务耦合与 UI/数据层依赖**。
- 通过 **core/react/plugin 三层架构 + adapter 抽象**，可以最小成本达成开源与内部复用。

---

如需我下一步继续做“拆分实施”或“自动生成骨架包/adapter”，告诉我目标结构和开源仓库形态，我可以直接开始改代码。
