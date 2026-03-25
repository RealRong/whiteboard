# 下一阶段架构收敛实施方案

## 1. 目标

这份文档只覆盖当前最值得继续收敛的 5 个点：

1. node drag 提交链路
2. `gesture.ts`
3. engine `write/normalize.ts`
4. `read.node.chrome`
5. `NodeToolbar` / `ContextMenu` 的 surface binding

目标不是“拆更多文件”，而是把复杂度放回正确的位置：

- React 负责交互输入、临时 preview、UI 组合
- core 负责纯几何/纯算法
- engine 负责文档语义的 finalize / normalize
- read 层负责稳定的读模型，不混 UI policy
- toolbar / context menu 负责 surface 渲染，不重复翻译动作语义

明确约束：

- 不需要兼容旧实现
- 不新增第二套写 API
- engine 保持纯同步，不引入 Promise / await
- selection / edit / container 的修正继续走 finalize / reconcile，不回流到每个 action
- 命名保持简短清晰，避免 `selectionSelectionState` 这类重复命名

---

## 2. 总体顺序

依赖顺序必须固定，不能乱做：

1. 先收 node drag 提交链路
2. 再瘦 `gesture.ts`
3. 再整理 engine `write/normalize.ts` 内部阶段
4. 再把 `read.node.chrome` 从 `read.node` 拆出去
5. 最后收 `NodeToolbar` / `ContextMenu`

原因：

- 第 1 阶段会把“拖拽提交语义”从 React 挪到 engine，是后续大量简化的基础
- 第 2 阶段的 `gesture.ts` 复杂度，很多是被第 1 阶段拖出来的
- 第 3 阶段是把第 1 阶段新增到 engine 的逻辑收成稳定基建
- 第 4 阶段清语义边界
- 第 5 阶段是 surface 收口，应该放最后，避免中途重做一遍

---

## 3. 阶段 1：收敛 node drag 提交链路

### 3.1 当前问题

现在 React 拖拽提交链路里混了太多文档语义：

- `packages/whiteboard-react/src/features/node/hooks/drag/math.ts`
  - preview
  - hovered container 推断
  - `parentId` 推断
  - 脱离 container 判定
  - attached edge route 跟随
- `packages/whiteboard-react/src/features/node/gesture.ts`
  - pointer 行为分流之外，还在拼最终 `node.update` / `edge.update`

这会导致：

- 只有“鼠标拖拽节点”这条路径有这些语义
- 其他来源的节点位移无法自动共享
- React 层被迫知道过多文档规则
- engine normalize 无法成为单一最终语义入口

### 3.2 目标模型

拖拽链路改成三段：

1. React 只做 preview
2. React 提交普通 geometry patch
3. engine 根据 geometry patch 自动 finalize 文档语义

提交目标统一为：

```ts
instance.commands.node.updateMany([
  { id, patch: { position } }
])
```

必要时包含 `size` / `rotation`，但不再由 React 主动写 `parentId`，也不再由 React 提交持久化的 edge route 跟随 patch。

### 3.3 具体怎么做

#### React 侧

- 保留：
  - `buildNodeDragState`
  - `resolveNodeDragPreview`
  - preview 期的 hovered container
  - preview 期的 edge 路径临时显示
- 删除或缩减：
  - `resolveNodeDragCommit` 中对 `parentId` 的推断
  - `resolveNodeDragCommit` 中 container 脱离逻辑
  - `gesture.ts` 提交时拼持久化 `edge.update`

React 在 pointerup 时只提交“成员节点的最终几何位置”。

#### engine 侧

engine 在 normalize/finalize 阶段统一补语义：

1. 找出本次真正发生 geometry 变化的 node ids
2. 从变化集合里求 moved roots
   - 规则：如果一个节点的祖先也在变化集合里，它不是 root
3. 基于 finalized 后的 doc，判断每个 moved root：
   - 是否应该进入某个 container
   - 是否应该从当前 parent 脱离
4. 基于前后文档，对 attached edge 做 route follow
   - 条件：source / target 都是 node
   - 两端 endpoint delta 相同
   - 才整体平移 edge 的 route/path points

### 3.4 涉及文件

- `packages/whiteboard-react/src/features/node/hooks/drag/math.ts`
- `packages/whiteboard-react/src/features/node/gesture.ts`
- `packages/whiteboard-engine/src/write/normalize.ts`
- 如有必要，可新增私有 helper 到：
  - `packages/whiteboard-engine/src/write/normalize/*`

### 3.5 本阶段不要做的事

- 不新增 `node.transform(...)`
- 不新增 `GeometryWrite`
- 不新增 drag 专用 command result
- 不把 selection / edit 再塞进 drag commit
- 不在 React 和 engine 各保留一套持久化 edge follow 逻辑

### 3.6 验收标准

- 拖拽节点时，React 提交内容只包含普通 node geometry patch
- container reparent / detach 由 engine 自动完成
- 两端同时移动的 attached edge route 由 engine 自动持久化
- 非拖拽来源的 node geometry 变更也能共享同一套 finalize 语义
- `gesture.ts` 不再直接拼持久化 `edge.update`

---

## 4. 阶段 2：把 `gesture.ts` 收成“读上下文 + 决定意图 + 委托执行”

### 4.1 当前问题

`packages/whiteboard-react/src/features/node/gesture.ts` 现在同时承担：

- pointer context 读取
- tap / hold / drag / marquee 意图判断
- chrome 显隐控制
- drag session 启动
- marquee session 启动
- selection / edit 触发
- drag preview / drag commit 串接

文件大不是根因，根因是“意图漏斗”和“具体执行”混在同一层。

### 4.2 目标模型

`gesture.ts` 最终只保留三件事：

1. 读 `PressContext`
2. 产出 `PressIntent`
3. 把 intent 委托给 drag / marquee / tap executor

### 4.3 具体怎么做

#### 压平 plan 模型

现在的 `MovePlan` + `HoldPlan` 可以收成一个更扁平的 `PressIntent`：

```ts
type PressIntent = {
  tap: 'select' | 'edit' | 'noop'
  move: 'drag' | 'marquee'
  hold: 'none' | 'marquee'
  tapSelectionIds: readonly NodeId[]
  dragSelectionIds: readonly NodeId[]
  hideChromeOnPress: boolean
  clearSelectionOnHold: boolean
  marqueeMatch: 'touch' | 'contain'
  marqueeExclude?: NodeId
}
```

核心思想：

- `PressIntent` 只描述事实，不描述实现细节
- 不再嵌套 `MovePlan` / `HoldPlan` 这类二级结构

#### 执行层收口

`gesture.ts` 内部只保留三类 executor：

- `runTap(...)`
- `startDrag(...)`
- `startMarquee(...)`

再由一个统一的 `startPress(...)` 串起来。

#### 让 drag 自己更独立

第 1 阶段完成后，`startDrag(...)` 不再负责文档语义提交，只负责：

- 确定 drag selection
- 启动 interaction session
- 写 preview
- pointerup 时提交 geometry patch

这样 `gesture.ts` 就会自然瘦下来。

### 4.4 涉及文件

- `packages/whiteboard-react/src/features/node/gesture.ts`
- `packages/whiteboard-react/src/runtime/interaction/press.ts`

### 4.5 本阶段不要做的事

- 不再拆更多“只转发数据”的 helper 文件
- 不把 `gesture` 绑到 instance 成为全局 API
- 不把 selection policy 挪回具体动作

### 4.6 验收标准

- `gesture.ts` 的职责描述可以一句话说清：读上下文、决策意图、委托执行
- `PressPlan` 不再是多层 union 结构
- `gesture.ts` 中不再出现文档 finalize 级别的业务判断

---

## 5. 阶段 3：把 engine `write/normalize.ts` 收成稳定的内部阶段管线

### 5.1 当前问题

`packages/whiteboard-engine/src/write/normalize.ts` 方向是对的，但已经同时承担：

- illegal patch sanitize
- text/group finalize
- group normalizer orchestration

如果第 1 阶段把 reparent / edge follow 继续塞进来，而内部结构不变，它会很快重新长成一个新的巨石文件。

### 5.2 目标模型

外部仍然只保留一个入口：

```ts
createWriteNormalize({ reduce, nodeSize, groupPadding })
```

内部固定成 3 个私有阶段：

1. sanitize
2. finalize
3. normalize

### 5.3 具体怎么做

#### 阶段一：sanitize

处理“这类 patch 不应该直接进入文档”的规则，例如：

- group rotation

输入：

- `document`
- `operations`

输出：

- `sanitizedOperations`

#### 阶段二：finalize

处理“普通写入之后，需要补上的文档语义”，例如：

- text `widthMode: fixed`
- group `autoFit: manual`
- group padding 回写
- moved root 的 container reparent / detach
- attached edge route follow

这里的关键原则：

- finalize 是文档语义
- finalize 只能依赖前后文档和本次 operations
- finalize 不依赖 UI 状态

#### 阶段三：normalize

处理“全局结构归一化”，例如：

- group normalizer

### 5.4 文件组织策略

公共入口不变：

- `packages/whiteboard-engine/src/write/normalize.ts`

私有实现按体量决定：

- 初始可以先在同文件内整理为 3 个阶段函数
- 当 finalize 明显继续膨胀时，再拆到私有目录：
  - `write/normalize/sanitize.ts`
  - `write/normalize/finalize.ts`
  - `write/normalize/group.ts`

这不是新增公共概念，只是内部实现分层。

### 5.5 本阶段不要做的事

- 不改成异步
- 不引入 Promise 风格 command
- 不增加新的 public normalize API
- 不把 group normalizer 再拆成另一套外部 service

### 5.6 验收标准

- `createWriteNormalize()` 仍然是唯一公共入口
- 任何 geometry write 的最终文档语义都由 finalize/normalize 统一给出
- engine 整条写链路保持纯同步
- 新增规则只需要明确归类到 sanitize / finalize / normalize 其中一层

---

## 6. 阶段 4：把 `read.node.chrome` 从 `read.node` 拆出去

### 6.1 当前问题

现在 `packages/whiteboard-react/src/runtime/read/node.ts` 里混了三类完全不同的东西：

- node capability
  - `scene`
  - `transform`
- hit / query 读能力
  - `containerAt`
  - `idsInRect`
- UI chrome policy
  - `toolbar`
  - `transform`
  - `connect`

问题不是“都能读”，而是语义边界已经不清楚。

### 6.2 目标模型

`read.node` 只保留 node 自身读能力：

- `item`
- `scene`
- `transform`
- `filter`
- `containerAt`
- `idsInRect`

chrome 读模型独立成：

```ts
instance.read.chrome.node
```

这个命名很短，也明确表明它是“UI chrome 的读模型”，不是 node 数据本体。

### 6.3 具体怎么做

#### `read.node` 保留什么

- 与 node registry / hit test / capability 直接相关的读

#### `read.chrome.node` 承担什么

- 基于以下输入派生：
  - tool
  - edit
  - selection
  - interaction
  - `chromeHidden`

输出：

- `selection`
- `toolbar`
- `transform`
- `connect`

#### 代码组织

建议引入一个独立文件，例如：

- `packages/whiteboard-react/src/runtime/read/chrome.ts`

或私有目录：

- `packages/whiteboard-react/src/runtime/read/chrome/node.ts`

原则：

- 不新增写能力
- 不把 `chromeHidden` 本身移出 node session runtime
- 只是把 UI chrome 派生逻辑从 `read.node` 剥离出来

### 6.4 涉及文件

- `packages/whiteboard-react/src/runtime/read/node.ts`
- `packages/whiteboard-react/src/runtime/read/index.ts`
- `packages/whiteboard-react/src/runtime/instance/types.ts`
- 使用 `instance.read.node.chrome` 的 UI 组件

### 6.5 本阶段不要做的事

- 不把 chrome 做成新的全局 state 域
- 不把 overlay 渲染细节挂到 instance
- 不把 capability 与 chrome 再揉回同一个文件

### 6.6 验收标准

- `read.node` 不再包含 UI chrome policy
- `instance.read.chrome.node` 成为唯一共享 chrome 读入口
- `NodeOverlayLayer`、`NodeToolbar` 等组件不再依赖 `read.node.chrome`

---

## 7. 阶段 5：收 `NodeToolbar` / `ContextMenu` 的 surface binding

### 7.1 当前问题

现在已经有比较健康的动作目录入口：

- `packages/whiteboard-react/src/features/node/actions.ts`

但 `NodeToolbar` 和 `ContextMenu` 仍在重复做：

- 把 action sections 转成各自的 surface 模型
- dismiss 包装
- `closeAfter` 包装
- filter 绑定
- group 插入/重排

这会造成：

- 两个 surface 的行为一致性难维护
- 新动作接入要改两边
- 菜单逻辑虽然集中在 `actions.ts`，但绑定逻辑仍然散

### 7.2 目标模型

保留一个动作目录：

```ts
createNodeSelectionActions(...)
```

再补两层很薄的 surface adapter：

- `readNodeToolbarModel(actions, context)`
- `readContextMenuModel(actions, context)`

注意，这里不要发明全局菜单 DSL。现有 action catalog 已经足够，不需要再造一层抽象。

### 7.3 具体怎么做

#### `actions.ts` 负责什么

- 动作语义
- 动作可用性
- 统一 command 入口
- summary / can / filter / layout / layer / structure / state / edit / danger

#### toolbar adapter 负责什么

- 从 `actions` 派生 toolbar 可见区块
- 处理 toolbar 独有布局
- 处理图标菜单与动作分组的映射

#### context menu adapter 负责什么

- 从 `actions` 派生文本菜单 groups
- 统一 dismiss 包装
- 统一 filter 绑定
- 处理 context menu 独有的 group 插入顺序

### 7.4 特别说明

`FillMenu` / `StrokeMenu` / `TextMenu` 这类控件型菜单，不应该被硬塞进通用文本 action schema。

正确做法是：

- 动作目录负责命令语义
- surface adapter 负责把这些语义接到具体 widget
- widget 本身仍然保留独立 props 设计，例如：

```tsx
<FillMenu value={value} onChange={onChange} />
```

### 7.5 涉及文件

- `packages/whiteboard-react/src/features/node/actions.ts`
- `packages/whiteboard-react/src/canvas/NodeToolbar.tsx`
- `packages/whiteboard-react/src/canvas/ContextMenu.tsx`

如有必要，可新增两个很薄的 adapter 文件，但不要继续扩散出新的中间层体系。

### 7.6 本阶段不要做的事

- 不新造 menu DSL
- 不把 toolbar 和 context menu 合成一个巨型组件
- 不让 surface 反过来主导动作语义

### 7.7 验收标准

- `createNodeSelectionActions()` 仍是唯一动作目录
- toolbar / context menu 不再各自重复包装同一套动作
- 新动作接入时，优先改 catalog，其次只改对应 surface adapter
- widget menu 继续保持独立组件和独立样式

---

## 8. 建议的落地顺序与提交边界

为了避免一次改太散，建议按下面的提交边界做：

### 提交 1

- 阶段 1：drag commit 收敛到 geometry-only
- engine 增加 reparent / edge follow finalize

### 提交 2

- 阶段 2：重写 `gesture.ts` 的 plan / executor 结构

### 提交 3

- 阶段 3：整理 `write/normalize.ts` 内部阶段

### 提交 4

- 阶段 4：`read.chrome.node`

### 提交 5

- 阶段 5：toolbar / context menu surface adapter

这样可以保证每一步都是可独立验证的，而不是做一个横跨交互、engine、菜单的超大混合重构。

---

## 9. 最终状态

这 5 个阶段完成后，整体架构应满足下面几条：

- React 交互层只负责输入与 preview，不负责文档 finalize
- engine 是 geometry write 之后唯一的文档语义落点
- `gesture.ts` 是“意图漏斗”，不是业务巨石
- `read.node` 只表示 node 读模型，不再夹带 UI chrome
- action catalog 是唯一动作目录，surface 只做渲染绑定

如果后续还要继续收，下一批才应该看：

- overlay 进一步变薄
- text 测量基础设施是否需要内部再整理
- edge / draw 是否还能继续共享部分交互基建

在这 5 个阶段完成之前，不建议再开新的大范围收敛主题。
