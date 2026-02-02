# Node Registry & Renderer Contract + Text/Sticky & Group 设计整合

## 目标
- 先确定“节点注册 + 渲染契约”的核心接口与约束。
- 在该体系下落地两项最重要功能：
  1) Text / Sticky
  2) Group 完整体验（折叠/标题/拖拽进出更细致）

---

## 一、Node Registry（节点注册）

### 1) 注册入口
- `registerNodeType(type, definition)`
- 每个节点类型注册一次，支持覆盖/扩展。

### 2) Node Definition（建议结构）
- `type: string`
- `label?: string`
- `defaultData?: Record<string, unknown>`
- `render(props)`
- `measure?(props, context) -> Size`
- `anchors?(props, context) -> Anchor[]`
- `toolbar?(props, context) -> ReactNode`
- `hitAreas?(props, context) -> Rect[]`
- `canEdit?(props) -> boolean`
- `onEdit?(ctx)`

### 3) 约束
- data-only：业务状态只存在 node.data，不依赖外部 UI 状态。
- 渲染和交互通过 core dispatch 修改 data。
- 不允许在 renderer 内部直接写 doc。

---

## 二、Renderer Contract（渲染契约）

### 1) NodeRendererProps
- `node`（只读数据）
- `selected` / `hovered`
- `zoom` / `viewport`
- `dispatch(intent)`
- `measureRef` / `onSizeChange`（可选）
- `actions`（例如 `useNodeActions(nodeId)`）

### 2) 行为规范
- 渲染组件不维护“真实数据”；所有状态通过 dispatch 修改 node.data。
- measure 结果走 `node.size` patch。
- 命中/吸附统一走几何算法（AABB/rotated rect）。

---

## 三、Text / Sticky 设计（基于 Registry）

### 1) Node 类型
- `type: 'text'` / `type: 'sticky'`
- `data` 结构示例：
  - `text: string`
  - `fontSize: number`
  - `color: string`
  - `background: string`（sticky 默认有底色）
  - `align?: 'left'|'center'|'right'`

### 2) 交互规则
- 双击进入编辑（contentEditable 或 textarea）
- Esc 退出编辑，Enter 换行
- 编辑时禁用拖拽与 selection

### 3) 自动测量
- `measure` 依赖文本内容计算 size
- 更新 size -> `node.update` patch
- sticky 允许最小尺寸与 padding

### 4) anchors
- 默认四边中心点
- 可选：文本节点禁用边连接（根据需求）

---

## 四、Group 完整体验（基于 Registry）

### 1) Node 类型
- `type: 'group'`
- `data` 结构示例：
  - `title?: string`
  - `padding?: number`
  - `autoFit?: 'expand-only' | 'fit' | 'manual'`
  - `collapsed?: boolean`

### 2) 关键交互
- **折叠/展开**：点击标题栏折叠，折叠后只显示标题与边框
- **标题编辑**：双击标题可编辑
- **拖拽进出**：
  - 拖入组：高亮 + 松开自动加入
  - 拖出组：离开边界自动移除
- **自动扩展**：
  - 子节点超出时扩展（expand-only）
  - 子节点收缩不自动缩小

### 3) 视觉规范
- 边框虚线 + 浅底色
- 折叠时透明或半透明区域

---

## 五、两者整合方式

### 1) 数据层统一
- Text/Sticky/Group 均是 `Node`
- 通过 `node.data` 存储差异化字段

### 2) 渲染层统一
- `NodeRenderer` 根据 type 调用 registry 中的 renderer
- 支持自定义 handle / toolbar

### 3) 交互层统一
- Selection / Drag / Snap / Resize / Rotate 使用统一几何工具
- Group/Sticky/Text 都遵循相同 pointer 事件协议

---

## 六、落地顺序建议
1) 实现 Registry + Renderer Contract
2) Text / Sticky（作为第一个自定义节点）
3) Group 完整体验（折叠/标题/拖入拖出）

