# Whiteboard 开源重构指引（基于本打包文件）

本文件夹是从当前仓库抽出的“白板相关最小集合”，用于在新仓库中启动开源重构。

## 1. 打包内容（已包含）
- `src/core/components/whiteboard/`：白板完整实现（渲染、交互、工具、节点、连线、拖拽、mindmap、panzoom 等）。
- `_rendevoz/typings/components/whiteboard/`：白板类型定义（IWhiteboard / IWhiteboardNode / IWhiteboardInstance 等）。
- `src/scenes/WhiteboardPage.tsx`：当前应用的白板页面入口示例。
- `src/api/stores/object/custom/WhiteboardStore.ts`：白板对象存储/搜索/序列化逻辑。
- `src/api/lifycycle/initializeApp/normalizeWhiteboards.ts`：白板初始化/结构修复。
- `src/core/setting/*`（3个文件）：白板设置项与全局设置入口。
- `src/core/index.ts`：白板导出入口。
- `WHITEBOARD_OPEN_SOURCE_REPORT.md`：拆分分析与路线（本次报告）。

## 2. 建议的开源重构顺序（参考）

### Step 1：建立新仓库骨架
- 建议创建三包结构：
  - `packages/whiteboard-core`（类型 + 算法 + 数据结构）
  - `packages/whiteboard-react`（组件 + hooks + UI渲染）
  - `packages/whiteboard-plugins`（业务扩展，可选）

### Step 2：从本包迁移“核心类型与纯函数”
- 先把 `_rendevoz/typings/components/whiteboard/*` 迁移到 `whiteboard-core/src/types`。
- 将 `src/core/components/whiteboard/utils` 里不依赖 React/DOM 的部分先搬进 core。
- 将 `node/mindmap/utils`、`hooks/ops/*` 中的纯逻辑拆进 core。

### Step 3：构建 Adapter 层（解除强耦合）
建议在 `whiteboard-react` 中定义如下接口并逐步替换：
- `DataAdapter`：`load / subscribe / update / createId`
- `I18nAdapter`：`t(key)`
- `ThemeAdapter`：颜色/图标 token
- `NodeRendererRegistry`：按 node.type 返回组件
- `Menu/Command Registry`：右键菜单/快捷键注册

### Step 4：拆业务节点（最关键）
- `MetaObjectNode` 强依赖 Rendevoz 业务对象（note/pdf/chat/tweet/...）。
- 在开源版中：仅保留 `text/image/freehand/mindmap/group`。
- 将 `MetaObjectNode` 及其依赖移入 `plugins` 包（或应用侧实现）。

### Step 5：序列化与数据结构统一
- 当前实现使用 `Map` 存储节点/连线，存储层在 `WhiteboardStore.ts` 转换。
- 开源建议统一输出 JSON schema（Array + id），在 core 提供 `toMap/fromMap`。

## 3. 未包含但需要处理的依赖（重要）
以下是白板文件中引用、但本打包未携带的依赖，需要在新仓库中替换或重写：
- UI/基础组件：`@/components`、`@/components/base/*`
- Hooks/工具：`@/hooks`、`@/utils`
- 全局与设置：`Global`、`SettingAtom`、`getSetting`
- Store：`ObjectStore / MetaStore / NoteStore`
- 编辑器相关：`slate`, `deserializeHTML/deserializeMarkdown`, `slateToMarkdown`
- 业务组件：pdf / note / chat / tweet / exam / message / code / media 等

**建议做法**：
- 对这些依赖建立 Adapter 接口或提供默认简化实现。
- 白板核心功能与“业务卡片渲染”严格分层。

## 4. 开源重构的起点建议
- 主入口：`src/core/components/whiteboard/index.tsx`
- 类型定义：`_rendevoz/typings/components/whiteboard/index.d.ts`
- 交互核心：`hooks/useWhiteboardInstance.ts` + `hooks/ops/*`
- 画布交互：`hooks/WhiteboardPanzoom.tsx` + `panzoom/`

## 5. 推荐你下一步要做的第一件事
- 在新仓库里用这套文件搭起 **能跑通的最小白板 demo**（仅基础节点），然后再加插件体系。

如需我继续帮你做“自动抽包/替换适配层/生成新仓库骨架”，告诉我目标结构即可继续推进。
