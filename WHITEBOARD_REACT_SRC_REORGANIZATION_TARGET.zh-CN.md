# `packages/whiteboard-react/src` 最优目录重组方案

## 背景

当前 `packages/whiteboard-react/src` 的问题，不是单纯“目录太多”，而是 **顶层目录的拆分轴混在一起了**。

现在同时存在三套拆分方式：

1. 按领域拆分
   - `node`
   - `edge`
   - `mindmap`

2. 按 UI 分层拆分
   - `scene`
   - `overlay`
   - `surface`
   - `input`

3. 按 runtime / editor 基建拆分
   - `common`
   - `viewport`
   - `transient`
   - `selection`
   - `container`
   - `interaction`
   - `toolbar`
   - `context-menu`

结果是：

- 想找一个文件时，先要猜它是按“领域”放，还是按“UI 层级”放，还是按“runtime”放
- 顶层目录越来越多，但每个目录的语义并不稳定
- `common` 逐渐成为“暂时不知道放哪”的兜底目录
- 一些目录只剩一两个文件，但仍然占着一级目录，噪音很大

这不是局部命名问题，而是 **目录组织的主轴不统一**。

---

## 目标

把 `src` 顶层收敛成少数几个稳定大类，使目录组织只表达三件事：

1. 这是运行时基建
2. 这是领域 feature
3. 这是 UI 壳层

也就是：

- `runtime`
- `features`
- `ui`

再加上少量基础目录：

- `config`
- `styles`
- `types`

---

## 最优形态

### 顶层目标树

```text
packages/whiteboard-react/src/
  Whiteboard.tsx
  index.ts
  config/
  styles/
  types/
  runtime/
  features/
  ui/
```

这是最优顶层形态。

判断标准：

- 顶层目录数量尽量少
- 每个顶层目录的语义稳定
- 不依赖“历史包袱”去理解
- 后续新增 feature 时，不会再把顶层撑乱

---

## 目录语义

## `runtime/`

放所有 editor runtime、instance、draft、state、resolved view、viewport、运行时工具。

这里的内容不表达“某个节点长什么样”，而表达：

- instance 如何组织
- editor 原始状态如何存
- draft/transient 如何组织
- resolved view 如何产出
- interaction runtime 如何驱动
- viewport/runtime hook 如何工作

建议目标树：

```text
runtime/
  instance/
  interaction/
  state/
  view/
  draft/
  viewport/
  hooks/
  utils/
```

### `runtime/instance`

放 instance 组合与对外类型：

- `createWhiteboardInstance.ts`
- `createWhiteboardUiStore.ts`
- `types.ts`
- `tool.ts`
- `toolState.ts`

### `runtime/interaction`

放 interaction runtime 与运行时输入能力：

- 当前已存在的 interaction runtime
- `interactionLock`
- `useWindowPointerSession`
- shortcut dispatch / bindings

这里表达的是“交互行为系统”，而不是 React UI。

### `runtime/state`

放 editor 原始状态域：

- `selection`
- `container`
- 其他 editor 级原始 state

这些内容本质上是 editor state/domain，不应该继续挂在顶层一级目录。

### `runtime/view`

放 resolved view 相关逻辑：

- instance view runtime
- `interaction/view.ts`
- `overlay/view.ts`
- `surface/view.ts`
- `container/view.ts`
- `selection/view.ts`
- 其他 resolved view 计算

原则：

- UI 只消费 resolved view
- resolved view 的实现集中在这里

### `runtime/draft`

这是现在 `transient` 的目标归宿。

建议最终把：

- `transient/node.ts`
- `transient/edge.ts`
- `transient/selection.ts`
- `transient/mindmap.ts`
- `transient/guides.ts`
- `transient/connection.ts`
- `transient/runtime.ts`

整体迁到：

```text
runtime/draft/
```

原因：

- 现在语义已经不是“零散 transient helper”
- 而是 editor 交互期 draft visual state
- `draft` 比 `transient` 更短、更行业常见、更贴近职责

### `runtime/viewport`

放 viewport runtime：

- `atoms.ts`
- `core.ts`
- `logic.ts`
- `hooks.ts`
- `useViewportController.ts`

viewport 明显属于 runtime，而不是 feature。

### `runtime/hooks`

放 runtime 访问 hook：

- `useInstance`
- `useView`
- `useTool`
- `useNode`
- `useEdge`
- `useMindmap`
- `useUiAtom`

现在这些放在 `common/hooks`，语义太泛。

### `runtime/utils`

只保留真正通用、与领域无关的小工具。

例如：

- `rafTask.ts`

原则：

- 只有真正跨 runtime 复用的纯工具才放这里
- 不要再次演化出“大杂烩 common”

---

## `features/`

放真正的领域 feature。

建议目标树：

```text
features/
  node/
  edge/
  mindmap/
```

每个 feature 自己负责：

- 组件
- feature 内部 view hook
- geometry / math
- registry
- actions

### `features/node`

包括：

- `components/`
- `hooks/`
- `registry/`
- `actions.ts`

### `features/edge`

包括：

- `components/`
- `hooks/`
- `constants.ts`

### `features/mindmap`

包括：

- `components/`
- `hooks/`

### 为什么 `selection` 不在 `features/`

`selection` 现在更像 editor runtime state/domain，而不是一个独立渲染 feature。

它更多承担：

- selected node ids / edge id
- selection domain
- selection resolved view

所以更适合进入 `runtime/state` 和 `runtime/view`。

---

## `ui/`

放 React 侧 UI 壳层。

注意：这里不是“业务领域”，而是“画布和 chrome 的组织层”。

建议目标树：

```text
ui/
  canvas/
    input/
    scene/
    overlay/
    surface/
  chrome/
    toolbar/
    context-menu/
```

### `ui/canvas`

把现在分散的：

- `input`
- `scene`
- `overlay`
- `surface`

统一收进 `canvas` 下面。

原因：

- 它们本质上都属于 whiteboard canvas shell
- 单独挂一级目录，顶层噪音太大
- `scene / overlay / surface / input` 是平行概念，但它们的上层应该是 `canvas`

### `ui/chrome`

把：

- `toolbar`
- `context-menu`

放到一起。

原因：

- 两者都属于 chrome
- 都依赖 selection / interaction / surface state
- 放在不同一级目录会人为放大差异，但它们其实是同类系统

---

## 当前目录到目标目录的映射

## 直接映射

```text
common/instance           -> runtime/instance
common/interaction        -> runtime/interaction
common/hooks             -> runtime/hooks
common/utils             -> runtime/utils
viewport                 -> runtime/viewport
transient                -> runtime/draft
node                     -> features/node
edge                     -> features/edge
mindmap                  -> features/mindmap
input                    -> ui/canvas/input
scene                    -> ui/canvas/scene
overlay                  -> ui/canvas/overlay
surface                  -> ui/canvas/surface
toolbar                  -> ui/chrome/toolbar
context-menu             -> ui/chrome/context-menu
```

## 需要拆分后再迁移的目录

### `selection`

当前文件：

- `domain.ts`
- `view.ts`
- `hooks.ts`
- `useSelectionBoxInteraction.ts`
- `index.ts`

建议去向：

- `domain.ts` -> `runtime/state/selection.ts`
- `view.ts` -> `runtime/view/selection.ts`
- `hooks.ts` -> `runtime/state/selectionHooks.ts` 或并入 `runtime/hooks`
- `useSelectionBoxInteraction.ts` -> `ui/canvas/input/useSelectionBoxInteraction.ts`
- `index.ts` 视最终公开 API 决定是否保留

### `container`

当前文件：

- `domain.ts`
- `read.ts`
- `view.ts`
- `hooks.ts`

建议去向：

- `domain.ts` -> `runtime/state/container.ts`
- `read.ts` -> `runtime/state/containerRead.ts` 或 `runtime/view/containerRead.ts`
- `view.ts` -> `runtime/view/container.ts`
- `hooks.ts` -> `runtime/state/containerHooks.ts`

### `interaction`

当前只剩：

- `view.ts`

建议去向：

- `runtime/view/interaction.ts`

这个目录本身应该删除。

### `chrome`

如果当前还有内容，需要判断是否并入：

- `ui/chrome`
- 或 `runtime/view`

原则是不再单独保留一个含义模糊的一级 `chrome/`。

---

## 应删除的历史概念

以下目录/概念不应该继续保留：

### `common`

原因：

- 语义过宽
- 会变成垃圾桶目录
- 无法指导新增文件放置

### 单独一级的 `scene / overlay / surface / input`

原因：

- 它们是 `canvas` 下的平行 UI 壳层
- 不应该每个都占一个顶层目录

### 单独一级的 `toolbar / context-menu`

原因：

- 它们都属于 chrome
- 顶层分开会让结构更散

### 单独一级的 `interaction`

原因：

- 当前只剩一个 `view.ts`
- 没有独立一级目录的必要

---

## 重组原则

## 原则 1：顶层只表达稳定大类

不要把“某个实现细节”提升到顶层。

顶层只允许：

- `runtime`
- `features`
- `ui`
- `config`
- `styles`
- `types`

## 原则 2：不要同时混用多套拆分轴

不要一部分目录按领域拆，一部分按层级拆，一部分按 runtime 拆，然后全部并排挂顶层。

这正是当前结构混乱的根源。

## 原则 3：UI 壳和 runtime 分开

应明确：

- runtime 负责 state / draft / resolved view / interaction
- UI 负责 canvas shell / chrome shell / feature render

## 原则 4：feature 只保留真正的业务/图元领域

继续保留 feature 顶层的只应是：

- node
- edge
- mindmap

不要把 editor state domain 误当成 feature。

## 原则 5：不留兼容目录

如果决定重组，就直接移动，不保留 re-export 兼容层。

否则：

- import 路径会长期双轨
- 目录语义无法真正收敛

---

## 推荐迁移顺序

不建议一次性无脑大搬迁。

建议分三阶段：

## Phase 1：顶层先收口

目标：

- 先建立三大主目录
- 不先追求 runtime 内部最优细分

步骤：

1. 建立 `runtime / features / ui`
2. 移动 `common/* -> runtime/*`
3. 移动 `node/edge/mindmap -> features/*`
4. 移动 `input/scene/overlay/surface -> ui/canvas/*`
5. 移动 `toolbar/context-menu -> ui/chrome/*`
6. 移动 `viewport -> runtime/viewport`
7. 移动 `transient -> runtime/draft`

结果：

- 顶层目录数会明显下降
- 主轴先统一

## Phase 2：拆 `selection/container/interaction`

目标：

- 消灭当前还不完全归属清晰的一级目录

步骤：

1. `selection` 拆到 `runtime/state + runtime/view + ui/canvas/input`
2. `container` 拆到 `runtime/state + runtime/view`
3. `interaction/view.ts` 并到 `runtime/view/interaction.ts`

结果：

- 剩余历史目录基本清空

## Phase 3：runtime 内部细化

目标：

- 把 `runtime` 内部也收成稳定结构

步骤：

1. 校正 `runtime/view`
2. 校正 `runtime/state`
3. 校正 `runtime/draft`
4. 校正 `runtime/hooks`
5. 清理多余 index / barrel / 临时文件

结果：

- 不是只“搬目录”
- 而是让 runtime 真正可理解

---

## 最终判断

从全局角度看，`whiteboard-react/src` 的最优形态不是：

- 继续保留十几个一级目录
- 只改几个名字
- 把 `common` 拆一点点但继续保留
- 继续把新 feature 直接加到顶层

最优形态是：

```text
src/
  runtime/
  features/
  ui/
  config/
  styles/
  types/
```

其中：

- `runtime` 负责 editor runtime 基建
- `features` 负责 node / edge / mindmap 等领域
- `ui` 负责 canvas shell 与 chrome shell

这是能在不考虑重构成本时，**最大程度减少顶层噪音、降低认知切换、并保持长期可扩展性** 的组织方式。
