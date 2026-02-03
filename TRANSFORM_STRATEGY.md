# 全 Transform 渲染方案（Whiteboard）

本方案目标：节点/边/视口统一使用 transform 渲染，交互与几何计算完全基于数据坐标，DOM 只用于「内容尺寸」输入与少量交互辅助，避免拖拽时频繁读 DOM。

## 1. 总体思路
- **世界坐标（world）** 是唯一真实数据坐标。
- **视口变换（viewport transform）** 负责世界 → 屏幕映射：平移/缩放/旋转（如有）。
- **节点/边** 在世界坐标中定位，渲染时使用 transform 做变换。
- **命中/连线/吸附/布局** 统一基于世界坐标计算，不依赖 DOM 测量结果。

## 2. 变换层级建议
1) **Viewport 层（最外层）**
   - 作用：整体平移/缩放/旋转。
   - CSS：`transform: translate(...) scale(...)`（或 `matrix(...)`）。
   - 所有子层（node/edge/overlay）都放在这个容器内。

2) **Layer 层（Node/Edge/Mindmap）**
   - 作用：逻辑分层与 z-index 管理。
   - 不做额外 transform，只做 absolute 定位与 pointer-events 控制。

3) **Node/Edge Item 层**
   - 作用：单对象位移/局部动画。
   - CSS：`transform: translate(x, y)`，必要时加 `translate3d` 触发合成。

## 3. 渲染与交互规范
- **渲染坐标**：
  - 节点/边的几何数据永远是 world 坐标。
  - 渲染时，node/item 使用 transform 将 world 坐标映射到视口空间。

- **事件坐标**：
  - 所有 pointer 事件先通过 `screenToWorld()` 转换为 world 坐标。
  - 命中/拖拽/对齐等逻辑仅使用 world 坐标计算。

- **边计算**：
  - 使用世界坐标计算路由/控制点，再渲染为 svg/path（同样在 viewport 变换内）。

## 4. DOM 尺寸获取（何时 & 如何）
> 只在「内容驱动尺寸变化」场景获取，不在拖拽高频场景使用。

### 4.1 适合获取 DOM 尺寸的场景
- 文本编辑导致节点尺寸变化
- 图片/图标加载后尺寸变化
- 动态组件（表单、表格、卡片）内容变化
- Mindmap 节点文本变化

### 4.2 不适合的场景
- 节点拖拽中每帧读取 DOM
- 大量节点持续测量
- 依赖 `getBoundingClientRect()` 做吸附/命中

### 4.3 推荐方式：ResizeObserver
- 为节点内容容器注册 ResizeObserver
- 尺寸变化时更新数据模型中的 `size`
- 下一帧（或批量）触发布局/连线更新

**伪流程**：
1) ResizeObserver 回调得到 `contentRect`（逻辑尺寸，**不受 transform 影响**）
2) 和当前 size 比较，变更时更新 core/node size
3) 触发布局/边重算

### 4.4 兜底方式：getBoundingClientRect
- 仅在 Debug 或极少数需要 DOM 位置的场景使用
- 结果受 transform 影响，需要反算回 world 坐标
- 不建议用于频繁逻辑计算

## 5. 数据模型与缓存策略
- 节点保存：`position`（world）、`size`（world 逻辑尺寸）
- 边保存：`source/target` + 控制点（world）
- 缓存：
  - 对齐/命中：使用空间索引（grid/quad）缓存 world 矩形
  - 只在节点位置/尺寸变化时更新索引

## 6. 性能与体验策略
- **拖拽性能**：
  - 仅更新被拖拽节点的位置（world）并通过 transform 渲染
  - 不要在拖拽过程读 DOM

- **缩放性能**：
  - 只变更 viewport transform
  - 避免在缩放时触发重算布局（除非必要）

- **文本清晰度**：
  - 低倍缩放时直接放大缩小
  - 高倍缩放时可考虑“跳档渲染”或文本层单独 scale

## 7. 现有模块拆分建议
- `whiteboard-core`：
  - 负责 world 坐标、布局、路由、命中、吸附
- `whiteboard-react`：
  - 负责 transform 渲染、ResizeObserver 尺寸同步
  - 事件坐标转换 `screenToWorld`

## 8. 迁移步骤建议
1) 统一 viewport transform（如已存在只需强化标准）
2) Node/Edge 渲染改为 transform（先 node，后 edge）
3) 去除拖拽中 DOM 读数
4) 引入 ResizeObserver 管理节点尺寸
5) 统一命中/吸附只用 world 坐标

## 9. 常见坑与规避
- ResizeObserver 回调中引发布局循环：
  - 先比对 size，变化才更新
  - 使用 rAF 或批处理
- Transform 下 `getBoundingClientRect()` 结果不等于 world：
  - 不要直接用于逻辑
- 多层 transform 叠加：
  - 统一入口处理 world ↔ screen

