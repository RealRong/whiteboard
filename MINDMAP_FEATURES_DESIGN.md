# Mindmap 常用功能设计方案

## 目标
- 完成 mindmap 常见交互：四向新增、拖拽重排（含外部拖入）、布局变化动画过渡。
- 与现有 core / react 架构一致：数据在 core，UI 状态在 react（Jotai）。
- 先支持横向（左右）布局，保留扩展到 4-way / radial 的空间。

---

## 现有能力复用
- core 已有命令：`mindmap.addChild / addSibling / moveSubtree / reorderChild / setSide / attachExternal / toggleCollapse / setNodeData`。
- layout：`layoutMindmap` 与 `layoutMindmapTidy`，支持 `side: 'left' | 'right' | 'both'`。
- UI：已有 `MindmapLayer` 只负责静态渲染，可作为基础层改为可交互。

---

## 一、四向新增子节点（UI + 数据）

### 交互设计
- 每个 mindmap node 显示 4 个 “+” 方向按钮：上 / 下 / 左 / 右。
- 触发规则：
  - 左：创建 `side='left'` 子节点（若 root 或允许跨侧）。
  - 右：创建 `side='right'` 子节点。
  - 上 / 下：创建“同侧”的子节点，并按顺序插入到开头/末尾（用于“上下”语义）。

### 数据映射（建议）
- `left/right` -> `mindmap.addChild(id, parentId, payload, { side })`
- `up/down` -> `mindmap.addChild(id, parentId, payload, { index })`
  - `up`: index = 0
  - `down`: index = children.length
- root 节点默认 `side='both'`，非 root 子节点若 `side` 未指定，继承父节点侧（保持布局一致性）。

### UI 细节
- 按钮在 hover/selection 时出现，避免干扰。
- 按钮点击后自动进入文本编辑（若 node kind 为 text）。
- 支持快捷键：`Tab` 新增同级末尾 / `Enter` 新增同级下方 / `Ctrl+Enter` 新增子级（后续可加）。

---

## 二、拖拽重排（内部 + 外部）

### 1) 内部拖拽（拖动已有 mindmap 节点）
目标：改变父节点 / 顺序 / side。

#### 推荐交互结构（Drag Layer）
- 原节点不移动，拖拽时降低透明度或显示占位。
- 新增 `MindmapNodeDragLayer`：渲染 ghost 节点，并跟随指针移动。
- 接近可吸附节点时展示“虚拟连接线 / 插入线”，提示 drop 位置。
- 好处：拖拽期间不触发布局重排，性能稳定，反馈清晰。

#### 交互态与状态机
- dragging: 记录 `dragNodeId`, `originParentId`, `originSide`。
- hover: 记录 `targetParentId`, `targetIndex`, `targetSide`, `dropType`（插入/附着）。
- preview: 通过“占位线/占位卡片”展示放置位置。

#### 命中与插入规则
- 计算目标节点的“可放置区域”：
  - **附着到节点**：进入节点的内圈区域（例如节点 rect 60% 以内）。
  - **插入兄弟序列**：靠近两节点间的 gap，显示插入线。
- side 判定：
  - 当 layout 为 `both` 时，鼠标在 parent 中轴左侧 => `left`，右侧 => `right`。
  - 若 parent 本身已经固定 side，可继承 parent 的 side。

#### 提交命令
1) 父节点发生变化：`mindmap.moveSubtree`
2) side 发生变化：`mindmap.setSide`
3) 兄弟顺序变化：`mindmap.reorderChild`

> 为减少多次 render，可在 UI 侧合并到一次 dispatch 队列（或 core 内部合并 changeset）。

### 2) 外部拖拽（白板 node / 文件 / 链接）
#### 拖入 payload 统一格式
使用 `MindmapAttachPayload`：
- 文件：`{ kind: 'file', fileId, name }`
- 链接：`{ kind: 'link', url, title }`
- 白板节点：`{ kind: 'ref', ref: { type: 'whiteboard-node', id } }`
- 纯文本：`{ kind: 'text', text }`

#### 提交命令
- 拖入到节点：`mindmap.attachExternal(id, targetId, payload, { side?, index? })`
- 拖入到空白处：创建新 root 或新 tree（可选）

---

## 三、布局与动画过渡

### 1) 布局计算
- 通过 `layoutMindmap` / `layoutMindmapTidy` 计算每个节点的目标位置。
- 保留 `layout.bbox` 作为渲染容器的尺寸与 offset。

### 2) 位置动画（建议用 FLIP）
目标：layout 变化时节点平滑过渡，避免“跳跃”。

#### FLIP 思路
1) First：记录变更前每个节点的 `rect`（x/y/width/height）。
2) Last：layout 更新后得到新 `rect`。
3) Invert：对每个节点施加 `transform: translate(dx, dy)` 使其回到旧位置。
4) Play：在下一帧移除 transform，使用 CSS transition 实现平滑过渡。

#### 注意点
- width/height 变化也要考虑（可配合 `scale` 或直接更新尺寸 + 位移）。
- 大量节点时只动画可见区域，减少开销。
- 拖拽时禁用动画（防止跟手延迟）。

---

## 四、Mindmap UI 层结构建议

### 组件划分
- `MindmapLayer`：静态布局 + 线条 + 节点容器。
- `MindmapNode`：节点渲染 + 文本编辑 + 方向按钮。
- `MindmapDragOverlay`：拖拽时的占位线/高亮。
- `MindmapHitLayer`：用于统一处理命中与 drop 计算（避免每个节点绑定过多事件）。

### Jotai 状态（建议）
- `mindmapUI.dragging`: { treeId, nodeId, pointerId, start }
- `mindmapUI.dropTarget`: { parentId, index, side, type }
- `mindmapUI.editingNodeId`
- `mindmapUI.hoverNodeId`
- `mindmapUI.layoutCache`（用于动画）

---

## 五、行业常见功能清单（可选扩展）

### 1) 节点编辑
- 双击进入编辑，支持快捷键、换行、自动测量。
- 支持 `icon/emoji` 前缀。

### 2) 折叠/展开
- 子树折叠，隐藏节点与连线。
- 折叠状态写入 node.data / node.collapsed。

### 3) 快捷键
- Tab / Enter / Shift+Enter 创建兄弟/子级。
- Delete 删除子树（带确认）。
- Alt 拖拽复制子树。

### 4) 导入导出
- Markdown / OPML / JSON。

### 5) 多选与批量操作
- 多选后批量调整样式、移动子树。

### 6) 布局模式切换
- simple / tidy / radial（后续）。
- 保存到 `MindmapLayoutOptions` 或 tree meta。

### 7) 搜索与定位
- 搜索节点内容，自动展开路径并聚焦。

---

## 六、落地步骤建议

1) **可交互 MindmapNode**
   - 支持选择、编辑、方向新增按钮。
2) **内部拖拽与重排**
   - drop 目标计算 + 指示线。
3) **外部拖入**
   - payload -> `attachExternal`。
4) **布局动画**
   - FLIP 过渡 + 拖拽禁用动画。
5) **补充常见功能**
   - 折叠/快捷键/导入导出。

---

## 附：与现有 core 命令的映射表

- 新增子节点：`mindmap.addChild`
- 新增兄弟：`mindmap.addSibling`
- 移动子树：`mindmap.moveSubtree`
- 调整顺序：`mindmap.reorderChild`
- 左右侧切换：`mindmap.setSide`
- 外部拖入：`mindmap.attachExternal`
- 折叠：`mindmap.toggleCollapse`
- 文本更新：`mindmap.setNodeData`
