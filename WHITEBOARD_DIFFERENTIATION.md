# Whiteboard Differentiation (App-level + Custom Nodes)

## 目标定位
- 不是“流程图组件库”，而是“白板应用级引擎”。
- 核心差异围绕：可自定义节点系统 + 应用级交互体验 + 文档级数据模型。

## 核心差异点（对标 React Flow）
1) 可自定义节点系统（第一差异）
   - 节点注册与渲染协议（Node Registry + Renderer Contract）。
   - 节点数据与视图分离（data-only schema, renderer 负责 UI）。
   - 节点尺寸/锚点/工具条/交互可扩展。

2) 文档级能力（第二差异）
   - 操作模型（ops）细粒度，天然支持协作/撤销/回放。
   - 可导出/导入/版本管理（后续）优先级高于 UI 状态。

3) 白板级交互体验（第三差异）
   - 吸附、对齐、拖拽、框选、手势等体验重点打磨。
   - 多工具模式（select/edge/comment/laser/etc）一致化。

4) Mindmap 等结构化内容（第四差异）
   - 作为旗舰功能（布局、重排、子树折叠、拖入合并）。

## 节点系统设计（建议接口草案）

### 1) Node Schema（Core）
- Node 最小数据结构（示例）：
  - id, type, position, size?, data, meta
- data 只存业务/内容，render 不依赖外部状态。
- size 可为：
  - fixed（固定）
  - auto（内容测量）
  - hybrid（最小/最大约束）

### 2) Node Registry（React）
- registerNodeType(type, definition)
- definition 包含：
  - render(props)
  - measure?(props, context) -> Size
  - anchors?(props, context) -> Anchor[]
  - toolbar?(props, context)
  - hitAreas?(props, context)
  - canEdit?(props) / onEdit?(...)

### 3) Renderer Contract（React）
- NodeRendererProps:
  - node, selected, zoom, viewport, dispatch
  - measureRef / onSizeChange
  - hooks: useNodeActions(nodeId)
- 要点：
  - UI 只读 data，写入统一走 dispatch/ops。
  - measure 可独立运行（内容变更 -> size op）。

### 4) Anchors 与连接策略
- Anchor = { side, offset } 已存在。
- Node 可声明：
  - anchorMode: 'fixed' | 'auto'
  - anchors(): 返回可吸附点
- Edge 连接工具根据 anchors 决定吸附点。

### 5) 操作模型（ops）
- node.create / node.update / node.delete
- node.move / node.resize
- node.data.patch (细粒度)
- edge.create / edge.update / edge.delete
- mindmap.node.create / update / move / reorder / delete
- 每个 op 记录在 change set，便于协作/历史。

### 6) 文档与 UI 状态分离
- Core: 只管理 doc state
- UI: selection/hover/tool/mode 为 transient state（react/jotai）
- 后续协作可扩展“远端选区提示”。

## 体验级差异建议
- 拖拽吸附更智能：
  - 同类对齐默认启用；交叉对齐仅在 Alt。
  - 网格索引提升大节点数量的性能。
- Edge 连接体验：
  - 自动吸附 + 单点提示，不依赖 handles hover。
- 画布手势：
  - 触控板平移/缩放优化，避免选中文本。
- Mindmap 交互：
  - 拖入/重排/折叠成为第一能力。

## 落地优先级（建议）
1) Node Registry + Renderer Contract
2) Node data schema + ops 细粒度
3) 交互体验（drag/snap/selection/edge）
4) Mindmap 深度能力
5) 导入/导出/历史/协作

## 对外差异表述（简化）
- React Flow 是流程图库；本项目是可扩展白板引擎。
- 核心是“自定义节点系统 + 文档模型 + 交互体验”。

