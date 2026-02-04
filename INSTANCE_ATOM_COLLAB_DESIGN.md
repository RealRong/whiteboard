# Instance 与 Atom 协作设计方案

## 目标
- 用 instance 承载命令式 API 与副作用（DOM/事件/测量/插件），减少 UI 层散落的监听逻辑。
- 用 atom 承载渲染相关状态，保持单一数据源，避免双写。
- 形成清晰分层：instance = 运行时服务层，atom = 渲染/交互状态层。

## 核心原则
1. **单一真相**：UI 相关状态只在 atom 中保存，不在 instance 内保存副本。
2. **副作用集中**：DOM 监听、ResizeObserver、pointer 捕获等统一放在 instance 或 manager hook 内。
3. **只读组合**：派生数据只读组合，不写入组合 atom。
4. **低频合并**：低频输入允许合并为一个可写大 atom。

---

## 角色与职责划分

### Instance（运行时/服务层）
**适合承载**
- core 引用与命令封装（dispatch/undo/redo/批量事务）
- DOM 绑定与事件管理（container、pointer 监听、ResizeObserver）
- 插件/扩展注册、生命周期钩子
- 外部 API（导出、截图、加载、执行脚本）

**不适合承载**
- selection/viewport/edgeConnect/interaction 等高频 UI 状态
- 任何会直接影响渲染、频繁更新的状态

### Atom（状态层）
**承载**
- 渲染所需状态：selection、viewport、edgeConnect、interaction、hover、临时态
- 派生结果：visibleNodes、nodeMap、visibleEdges
- 输入数据：doc、core、containerRef、screenToWorld、nodeSize

---

## Instance 与 Atom 的协作方式

### 1) instance 只读 atom，触发命令
- instance 可以读取 atom（如 viewport/selection）来做命令逻辑
- instance 发起命令只通过 core.dispatch，不直接改 atom

### 2) atom 读取 instance 输入
- 白板初始化时，将 core、containerRef 等写入 input atom
- instance 内部持有 DOM 引用，必要时更新 input atom（如 container 变更）

### 3) manager hook 模式
- instance 提供 manager hook（如 useEdgeConnectManager）
- manager hook 订阅 atom 并注册/释放事件
- UI 层只用 useEdgeConnect（读写 atom），不关心事件细节

---

## Atom 分区与整合策略

### A. 输入类（Input）可合并为可写大 atom
**推荐合并**
- core/doc/docRef/containerRef/screenToWorld/mindmapLayout
**不推荐合并**
- nodeSize/mindmapNodeSize（高频变化）

**原因**
- 输入类低频更新，合并后读取清晰
- nodeSize 高频，合并会放大重渲染范围

### B. 派生类（Derived）只读组合 atom
**推荐组合**
- canvasNodes/visibleEdges/nodeMap/mindmapNodes
**禁止写入**
- 派生类不作为写入口，避免双源数据

### C. 高频状态不合并
- selection/viewport/interaction/edgeConnect 保持独立 atom
- 如需方便读取，提供只读“组合 atom”

---

## 建议的 Atom 结构（概念）

### 1) whiteboardInputAtom（可写）
- core/doc/docRef/containerRef/screenToWorld/mindmapLayout

### 2) sizeAtoms（独立）
- nodeSizeAtom/mindmapNodeSizeAtom

### 3) viewGraphAtom（只读组合）
- canvasNodes/visibleEdges/nodeMap/mindmapNodes

### 4) interactionAtoms（独立）
- selectionAtom/viewportAtom/interactionAtom/edgeConnectAtom

### 5) optional: read-only 组合
- selectionEdgeConnectAtom（只读）
- viewportInteractionAtom（只读）

---

## Instance 结构建议（概念）

```
instance = {
  core,
  container,
  services: {
    pointer,
    resize,
    clipboard,
    history,
    plugins
  },
  api: {
    select, createNode, createEdge,
    export, import, fitView
  }
}
```

**说明**
- services 负责副作用、监听、生命周期
- api 负责对外命令接口

---

## 协作流程示例

### 1) 初始化
- Whiteboard 创建 instance
- 将 core/containerRef/screenToWorld 写入 input atom
- manager hook 根据 atom 注册事件

### 2) 拖拽与连线
- UI 交互更新 edgeConnectAtom/selectionAtom
- instance 只响应命令式调用（如 commitTo 触发 core.dispatch）
- manager hook 负责全局 pointer 监听

### 3) Resize
- instance 监听 ResizeObserver
- 将 nodeSize 写入独立 size atom
- 渲染层根据 size atom 重新布局

---

## 迁移与落地步骤建议
1. 新建 instance 模块（单例或按 Whiteboard 实例生成）
2. 将 DOM 监听迁移到 instance/services
3. 对高频状态保持 atom 独立
4. 引入 read-only 组合 atom，减少读散落
5. 删除旧的 provider 或 runtime context

---

## 禁止项（避免踩坑）
- 不要在 instance 保存 selection/viewport/edgeConnect 的副本
- 不要将派生数据变成可写大 atom
- 不要将 nodeSize 合并进 input 大 atom
- 不要让 UI 直接操作 instance 内部 state

---

## 结论
- Instance 是命令与副作用中心，Atom 是渲染状态中心。
- 低频输入可合并，高频与派生保持独立。
- 通过组合 atom 提升读取体验，不破坏单一数据源。
