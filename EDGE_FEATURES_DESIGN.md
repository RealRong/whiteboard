# Edge 方案设计（whiteboard-core / whiteboard-react）

> 目标：以最优数据结构为前提，建设一套可扩展、可维护的 Edge 能力，包括：
> - 线型：linear / step(90°) / polyline / bezier / curve / custom
> - 交互：选择、重连、添加/拖拽折点、手动路由
> - 视觉：markers（箭头等）、dash/animated edge、label
> - 自动：轻量避障（实时拖拽可用）
> - 扩展：自定义 Edge 渲染器、路由器、样式

---

## 一、现状简述（基于仓库）
- `whiteboard-react` 目前 Edge 渲染是直线 `<line>`；连接逻辑只负责 anchor 计算与创建/更新。
- `whiteboard-core` 已包含折线路径工具 `getSmoothPolyPath` / `getBezierPath`（`packages/whiteboard-core/src/utils/path.ts`）。
- legacy 实现中存在多线型与折线路径绘制逻辑，但未迁移到 `whiteboard-react`。

结论：逻辑能力在 core 侧“部分具备”，但缺乏统一的路径模型与渲染扩展点。

---

## 二、总体目标与边界
### 目标
1) 统一 Edge 数据模型，支持路径段与手动折点
2) 路由逻辑归入 `whiteboard-core`，渲染与交互归入 `whiteboard-react`
3) 提供可扩展的 **Edge 渲染器** 与 **路由器** 注册机制
4) 以“轻量避障 + 手动可调”为默认策略

### 非目标（当前阶段）
- 全局最优寻路（可见性图 / 全局 A*）
- 复杂电气/工程制图约束（严格无交叉、端口模型）

---

## 三、数据模型设计（最优设计，放在 whiteboard-core）
### 1) Edge 类型（最终形态）
直接以最优模型为准，不考虑兼容性：
```ts
export type EdgeType = 'linear' | 'step' | 'polyline' | 'bezier' | 'curve' | 'custom'
export type EdgeRouteMode = 'auto' | 'manual'

export type EdgeRouting = {
  mode?: EdgeRouteMode
  points?: Point[]          // 手动折点（polyline/step）
  locked?: boolean[]        // 与 points 对齐，可选：锁定某些点
  avoid?: {
    enabled?: boolean
    padding?: number        // 障碍扩展边距
    maxTurns?: number       // 最大折点数
    strategy?: 'simple' | 'grid' | 'visibility'
  }
  ortho?: {
    offset?: number         // 与节点的出线间距
    radius?: number         // 圆角半径
  }
}

export type EdgeStyle = {
  stroke?: string
  strokeWidth?: number
  dash?: number[]           // [dash, gap]
  animated?: boolean
  animationSpeed?: number
  markerStart?: string
  markerEnd?: string
}

export type EdgeLabel = {
  text?: string
  position?: 'center' | 'start' | 'end'
  offset?: Point
}

export interface Edge {
  id: EdgeId
  source: { nodeId: NodeId; anchor?: EdgeAnchor }
  target: { nodeId: NodeId; anchor?: EdgeAnchor }
  type: EdgeType
  routing?: EdgeRouting
  style?: EdgeStyle
  label?: EdgeLabel
  data?: Record<string, unknown>
}
```

---

## 四、逻辑分层与职责
### 1) whiteboard-core（纯逻辑）
负责：
- 路径生成、避障、路径点计算
- 边界框、碰撞检测、命中测试算法（可复用）
- Edge 类型/协议定义

建议目录结构：
```
packages/whiteboard-core/src/edge/
  types.ts             // EdgeRouting / EdgeStyle / 路由输出结构
  anchors.ts           // anchor 计算、端点出线方向
  router/
    index.ts           // Router 注册与选择
    simple-ortho.ts    // 轻量 90° + 碰撞检测 + 简单绕行
    polyline.ts        // 路径点连接
    bezier.ts          // 曲线控制点计算
  hit-test.ts          // 点到折线段距离、矩形相交
  path.ts              // 统一输出 { points, svgPath, labelPos }
```

**核心输出统一结构**：
```ts
export type EdgePathResult = {
  points: Point[]
  svgPath: string
  label?: Point
}
```

### 2) whiteboard-react（渲染与交互）
负责：
- 渲染 `<path>` / `<polyline>` / `<marker>`
- 交互（选择、重连、拖拽折点、编辑 label）
- 自定义 Edge 渲染器注册

建议目录结构：
```
packages/whiteboard-react/src/edge/
  EdgeLayer.tsx            // 统一绘制与命中
  EdgeRendererRegistry.ts  // 渲染器注册
  EdgePath.tsx             // 基础 path 渲染（含 marker、dash、anim）
  EdgeHandles.tsx          // 端点与折点交互句柄
  EdgeLabel.tsx            // 标签渲染
  useEdgeRouting.ts        // 与 core 路由对接的 hook
```

---

## 五、功能设计细节
### 1) 线型与路径生成
- **linear**：直线；最低成本
- **step/orthogonal**：90°折线（优先支持）
- **polyline**：多段折线（来自 points）
- **bezier/curve**：使用控制点或自动生成曲线

> `whiteboard-core` 统一提供 `EdgePathResult`，渲染层只关注 svgPath。

### 2) 轻量避障（默认策略）
目标：拖拽时实时可用

流程（simple-ortho router）：
1) 根据 source/target anchor 先生成基础 L/Z 线路径
2) 碰撞检测（路径段 vs 障碍矩形 AABB）
3) 若碰撞：尝试 2~4 条简单绕行路径（上下左右偏移）
4) 仍碰撞：接受最短路径或回退到直线

性能：O(k * n)（k 为候选路径数，n 为障碍数）

### 2.1) 轻量避障的用户可控开关
建议支持三层开关（优先级从高到低）：
1) **临时模式开关**（交互时按键切换）
   - 例如按住 `Alt` 暂停避障，便于快速拉线
2) **边级覆盖**（单条 edge 指定）
   - `edge.routing.avoid.enabled` 强制开/关
3) **全局默认**（白板设置）
   - Whiteboard 设置中的“自动避障”开关，作为默认值

行为建议：
- 新建 edge：继承全局默认
- 用户手动打点后：自动切换 `routing.mode = 'manual'`，避免后续自动覆写
- 提供“恢复自动路由”入口（重算 points 并切回 `auto`）

### 3) 手动折点（waypoints）
- 双击 edge 在最近线段处插入折点
- 拖拽折点移动
- 删除折点（Backspace 或双击）

与避障共存策略：
- 用户插入折点后，`routing.mode = 'manual'`
- 后续节点移动时，只对非锁定点段做局部调整
- 提供“恢复自动路由”动作

### 4) Markers 与箭头
- SVG `<marker>` 支持 start/end
- `EdgeStyle.markerStart / markerEnd` 指向 marker id
- 在 EdgeLayer 中集中维护 `<defs>`，避免重复

### 5) Dash / 动画
- `dash: [dash, gap]` 映射到 `stroke-dasharray`
- `animated` + `animationSpeed` 通过 CSS `stroke-dashoffset` 动画

### 6) Custom Edge
- 在 `whiteboard-react` 提供渲染器注册接口

示例接口：
```ts
type EdgeRenderer = (props: {
  edge: Edge
  path: EdgePathResult
  selected: boolean
}) => ReactNode
```

- `edge.type === 'custom'` 时通过注册表查找渲染器

---

## 六、交互与事件流
### 1) 创建/连接
- 仍使用 `useEdgeConnect` 生成 source/target + anchor
- 创建后：`edge.create` 携带 `type/routing/style`

### 2) 选中/命中
- 从“点到线段距离”升级为“点到折线段最小距离”
- 边界框加大阈值以提升可点性

### 3) 端点重连
- 复用现有 handles；重连后重新计算路径

### 4) 折点编辑
- EdgeHandles 负责渲染折点
- 交互层只维护折点坐标并 dispatch `edge.update`

---

## 七、拆分与维护建议
### 1) Core 与 React 的分界
- `whiteboard-core`：只输出路径（Points + SVG path）
- `whiteboard-react`：不关心具体算法，只消费 `EdgePathResult`

### 2) 注册机制
- Router 注册在 core（可测试）
- Renderer 注册在 react（可扩展）

### 3) 可测试性
- Core：为 router 添加单元测试（输入 anchors/obstacles -> 断言 points）
- React：只做少量渲染快照或最小交互测试

---

## 八、建议实施阶段
### Phase 1（低风险）
- 引入 core 路由输出结构与基础 renderer
- 支持 linear / step / bezier
- EdgeLayer 改用 `<path>`

### Phase 2（体验提升）
- 手动折点编辑
- dash/animated/marker
- label 统一布局

### Phase 3（高级）
- 轻量避障（simple-ortho）
- custom edge 渲染器注册

---

## 九、扩展点与示例
### 1) Router 注册
```
registerEdgeRouter('step', createStepRouter())
registerEdgeRouter('bezier', createBezierRouter())
registerEdgeRouter('custom', myCustomRouter())
```

### 2) Renderer 注册
```
registerEdgeRenderer('custom', CustomEdgeRenderer)
```

---

## 十、性能与体验守则
- 拖拽时只重算受影响的边（与拖拽节点相连，或线段包围盒相交）
- 使用 requestAnimationFrame 节流路由计算
- 复杂避障只在 dragEnd 或 idle 时执行

---

## 十一、结论
该方案将 edge 的“路由逻辑与渲染/交互”彻底拆分：
- core 侧统一路径计算与避障策略
- react 侧统一渲染与交互扩展

这可以稳定支撑白板的常用 edge 能力，并为未来复杂路由或自定义扩展预留清晰接口。
