# Viewport 与 Instance API 设计方案（调研与建议）

## 目标
- `useViewportSize` 不再单独存在，尺寸监听内聚到 `useViewport`。
- `screenToWorld/worldToScreen` 作为跨模块工具函数挂到 `instance` 上。
- `instance` 提供 `getViewport()` 等只读运行时接口，区分“读取一次”和“订阅更新”。
- 明确哪些组件/模块必须订阅 viewport 状态才能正确渲染。

---

## 1. 现有 Instance API 盘点
来源：`packages/whiteboard-react/src/common/instance/whiteboardInstance.ts`

当前 `instance` 主要包含：
- **基础引用**
  - `core`
  - `docRef`
  - `containerRef`
  - `getContainer()`
- **services**
  - `nodeSizeObserver`（ResizeObserver 监听节点大小）
- **shortcutManager**
  - 用于 shortcut 注册和处理（已内置在 instance）
- **commands / setCommands**
  - `selection / tool / interaction / viewport / node / edge / edgeConnect / group / mindmap`
- **事件绑定辅助**
  - `addWindowEventListener`
  - `addContainerEventListener`

**结论**：
- instance 已承载“运行时服务 + 命令入口 + 事件绑定”。
- 新增 viewport/transform 工具应保持同层次语义，不建议散落到 atom 或白板顶层。

---

## 2. 新增 API 的命名与归属建议
### 推荐方案：`instance.viewport`
保持与 `instance.commands.viewport` 区隔（命令是写操作，viewport 是运行时只读）。

建议结构：
```
instance.viewport = {
  get: () => Viewport,
  getZoom: () => number,
  screenToWorld: (point: Point) => Point,
  worldToScreen: (point: Point) => Point,
  getScreenCenter: () => Point,
  getContainerSize: () => Size
}
```

**优点**：
- 语义清晰：“commands” 负责写；“viewport” 负责读+转换
- 便于跨模块调用，无需依赖 atom
- 便于未来扩展（比如 `getTransformStyle`）

### 备选方案：`instance.transforms`
```
instance.transforms = { screenToWorld, worldToScreen, getViewport }
```
**缺点**：
- `getViewport` 不属于“transform”，语义略弱

### 结论
优先推荐 **`instance.viewport`**（只读运行时 API），避免引入新的命名层次。

---

## 3. `useViewport` 内聚 ResizeObserver
不再保留 `useViewportSize`：
- `useViewport` 内部维护 `size` state
- 在 `useLayoutEffect` 中创建 `ResizeObserver` 监听 `containerRef`
- 每次 callback **只 setState 一次**（满足“批量更新一次”的要求）

示意（保持你期望的写法）：
```
const [size, setSize] = useState<Size>({ width: 0, height: 0 })

useLayoutEffect(() => {
  const element = containerRef.current
  if (!element) return
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    const { width, height } = entry.contentRect
    setSize({ width, height })
  })
  observer.observe(element)
  return () => observer.disconnect()
}, [containerRef])
```

**注意点**：
- callback 内不进行 `forEach setState`，保证“单次批量更新”。
- 建议保留 width/height 为 0 的容错（避免初始 undefined）

---

## 4. `screenToWorld/worldToScreen` 挂到 instance
### 方式
- `useViewport` 每次计算后同步写入 `instance.viewport.screenToWorld/worldToScreen`。
- 额外同步 `getViewport()` 或 `viewportSnapshot`。

### 优点
- 事件/交互层无需订阅 atom，直接从 instance 读取实时函数。
- 跨模块依赖更清晰（instance = 运行时 API 入口）。

---

## 5. 是否需要 `instance.getViewport()`？
**建议加。**

### 能用 `getViewport()` 的场景
- 事件处理（pointer down / drag start / commit）
- 命令调用时读取当前视口参数
- 只需“当前值”的算法（如 edge connect snap）

### 必须订阅 viewport 的场景（不能靠 get）
以下模块如果不订阅 viewport，会导致渲染不更新：

#### 直接订阅 viewportAtom 的组件
- `packages/whiteboard-react/src/node/components/NodeLayerStack.tsx`
  - 传 `zoom` 给 `NodeLayer`/`NodeItem`
  - Snap 计算依赖 `zoom`
- `packages/whiteboard-react/src/edge/components/EdgeLayerStack.tsx`
  - 传 `zoom` 给 edge 相关渲染（后续可能影响 hitTest/handle 尺寸）

#### 间接依赖 viewport 的渲染链
- `NodeLayer` → `NodeItem` → `useNodeItem/useNodeTransform/useNodeStyle`
  - 多处使用 `zoom` 调整 handles、交互阈值
- `NodeRegistry` 的 `render` props 包含 `zoom`（节点渲染可变）
- `EdgeLayerModel` 目前传 `zoom`（虽暂未直接使用，但逻辑上应随 viewport 变化）

#### 交互/算法依赖
- `useEdgeConnect` 通过 `viewportAtom.zoom` 计算 snapThresholdWorld
  - 可以迁移为 `instance.viewport.getZoom()`，但交互中也需要及时更新

**结论**：
- 渲染层必须继续订阅 viewport（atom 或其它响应式 store）。
- `getViewport()` 只替代交互层/命令层。

---

## 6. 建议的迁移顺序
1. `useViewport(containerRef, doc.viewport)` 内聚 ResizeObserver
2. 在 `useViewport` 中更新 `instance.viewport`（函数 + snapshot）
3. 将交互层（如 `useEdgeConnect`）逐步改为读取 `instance.viewport.getZoom()`
4. 保留渲染层订阅：`NodeLayerStack/EdgeLayerStack` 继续使用 viewportAtom

---

## 7. 总结
- `instance` 适合承载 **运行时只读 viewport API + 变换函数**。
- `getViewport()` 只能覆盖“读取一次”场景，**渲染层仍需订阅**。
- `useViewport` 内聚 ResizeObserver 可显著简化顶层逻辑，并符合“批量更新一次”的要求。

