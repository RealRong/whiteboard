# Whiteboard React 收口与噪音层审查

## 1. 文档目标

本文只回答 React 侧三个问题：

1. `packages/whiteboard-react/src` 里哪些目录/文件已经没有实际承载内容
2. 哪些模块“看上去有抽象”，但本质只是路径兼容壳、单消费者包装层或重复 view-model
3. React 这边下一轮继续收口，优先应该动哪里

本文基于当前仓库状态编写，对应时间点为 `2026-03-28`。

---

## 2. 已完成清理

## 2.1 已删除空目录

以下空目录已经从 `packages/whiteboard-react/src` 删除：

- `features/edge/hooks/connect`
- `features/edge/session`
- `features/mindmap/session`
- `features/node/drag`
- `features/node/hooks/transform`
- `features/node/session`
- `features/selection/actions`
- `runtime/container`
- `runtime/edit`
- `runtime/frame`
- `runtime/interaction`
- `runtime/pick`
- `runtime/selection`

这一步的意义很直接：

- 这些目录不再承担代码组织价值
- 它们会制造“这里还有一层 runtime / session / action”的错觉
- 对后续收口判断是噪音，不是资产

## 2.2 已删除的薄封装壳文件

本轮已经直接收掉一批 React 内部纯壳层：

- `packages/whiteboard-react/src/runtime/instance/types.ts`
- `packages/whiteboard-react/src/runtime/input/keyboard.ts`
- `packages/whiteboard-react/src/runtime/input/target.ts`
- `packages/whiteboard-react/src/features/toolbox/insert.ts`
- `packages/whiteboard-react/src/features/node/frame.ts`
- `packages/whiteboard-react/src/features/draw/state.ts`
- `packages/whiteboard-react/src/features/edge/preview.ts`
- `packages/whiteboard-react/src/runtime/viewport/index.ts`

对应处理方式：

- 类型壳改为直接从 `runtime/instance` 引用
- 输入工具壳改为直接从 `@whiteboard/editor/input` 引用
- `frame` 常量壳改为直接从 `@whiteboard/editor/node` 引用
- `draw` 类型与工具改为直接从 `@whiteboard/editor` 引用
- edge preview 写入改为直接走 `instance.host.edge.preview`
- viewport 默认值移动到 `config/defaultViewport.ts`，输入绑定改为直连实现文件
- 无消费者的 `toolbox/insert.ts` 直接删除

这类文件的问题不是“代码量小”，而是：

- 只增加一跳 import
- 不增加任何语义
- 让 React 看起来像还有自己的 runtime/input/node 子系统
- 实际上只是 editor public API 的转发镜像

## 2.3 已落地状态（2026-03-28）

本次第二轮 React 收口已经继续落地，当前状态如下：

- 已删除剩余兼容壳：
  `features/draw/state.ts`、`features/edge/preview.ts`、`runtime/viewport/index.ts`
- 已压平 `features/node/selection.ts`：
  中间 resolver/type 不再作为公开层扩散，`useNodeChrome` 已退出，保留 `useSelection` / `useSelectionPresentation` 两个真正有消费者的 hook
- 已拆分 `selection chrome` 公共动作层：
  `selectionMenu.ts` 现在退回 barrel，动作、过滤、section 组装分别下沉到
  `selectionMenuActions.ts`、`selectionFilter.ts`、`selectionSections.ts`
- 已把 context menu 的样式菜单逻辑独立出来：
  `selectionStyleMenu.ts`
- 已收掉 `features/toolbox/paletteModel.ts`：
  单消费者 palette 计算已并回 `ToolPalette.tsx`
- 已收掉 `features/selection/chrome/contextMenuModel.ts`：
  选择快照已回收到 `ContextMenu.tsx`，菜单解析迁移到 `contextMenuView.ts`
- 已把 `NodeToolbar.tsx` 的文本提交、图标渲染、toolbar 状态推导拆出：
  `nodeToolbarText.ts`、`nodeToolbarIcon.tsx`、`nodeToolbarModel.ts`
- 已把 `features/node/text.ts` 从 mega util 拆成：
  `textContent.ts`、`textMeasure.ts`、`textAutoFont.ts`
  原 `text.ts` 退回薄出口层

这意味着本文原先列出的四个主阶段：

1. 删除兼容壳
2. 压平 node selection presentation
3. 收敛 selection chrome
4. 拆分文本 mega util

现在都已经进入代码落地状态。

---

## 3. 结论概览

React 侧还能继续收口，而且空间仍然明显。

当前剩余问题主要分成三类：

1. 兼容性壳层还没有完全删完
2. 单消费者 view-model 被抽成独立 model / presentation 文件
3. 个别文件把“菜单动作 + schema 读取 + 渲染状态 + 文本测量”混成过胖模块

一句话概括当前 React 侧复杂度来源：

**不是功能太多，而是 React 在 editor public API 之上又叠了一层自己的兼容壳和 view-model 壳。**

---

## 4. 已确认的噪音类型

## 4.1 纯路径兼容壳

这类文件已经证明不是独立职责，而是转发层。

已删除：

- `runtime/instance/types.ts`
- `runtime/input/keyboard.ts`
- `runtime/input/target.ts`
- `features/toolbox/insert.ts`
- `features/node/frame.ts`

本轮已继续删除的同类文件：

- `packages/whiteboard-react/src/features/draw/state.ts`
- `packages/whiteboard-react/src/runtime/viewport/index.ts`
- `packages/whiteboard-react/src/features/edge/preview.ts`

判断标准：

- 文件本身不做真实逻辑
- 只是换个路径 re-export editor 类型/工具
- 删除后只需要改 import，不需要改行为

这些文件已经按同样原则退出：

- 调用方直接指向 `@whiteboard/editor`
- edge preview 直接读写 `instance.host.edge.preview`
- viewport 默认值与输入绑定不再共用一个壳文件

## 4.2 单消费者 model / presentation 壳

这类模块比纯 re-export 更隐蔽，因为它们确实有逻辑，但抽出来以后并没有形成真正复用，只是多加了一层命名。

### `features/toolbox/paletteModel.ts`

证据很明确：

- 文件约 `207` 行
- `readToolPaletteView` / `readToolPaletteMenuPlacement` 等核心函数几乎只被 `ToolPalette.tsx` 消费

这说明它不是公共 palette domain，而是 `ToolPalette.tsx` 的局部视图计算。

当前问题：

- 把 palette view、draw brush state、menu 宽高、placement 估算放在同一层
- 造成 “ToolPalette -> paletteModel -> draw state / preset” 的额外跳转
- 复用面并没有真的打开

更合理的做法：

- 保留纯计算函数
- 但把它们下沉为 `ToolPalette.tsx` 邻近 helper
- 不再维持一个名为 `paletteModel.ts` 的伪公共层

这一点已经落地：

- `paletteModel.ts` 已删除
- palette view / placement 计算已直接并回 `ToolPalette.tsx`

### `features/node/selection.ts`

这个文件约 `217` 行，但真正的问题不是大小，而是层次重复：

- `SelectionView`
- `NodeSelectionView`
- `NodeChromeView`
- `SelectionPresentation`
- `resolveSelectionBoxView`
- `resolveNodeChromeView`
- `resolveSelectionPresentation`
- `resolveNodeSelectionView`
- `useSelection`
- `useNodeChrome`
- `useSelectionPresentation`

这里已经形成了明显的：

- selection snapshot
- chrome state
- presentation 聚合

三层包装。

但真实消费者主要还是：

- `features/node/components/NodeOverlayLayer.tsx`
- `features/selection/chrome/NodeToolbar.tsx`

这说明它没有形成“可复用 presentation 体系”，而是在单个交互域里自我包装。

这部分已经按以下方向落地：

- 保留一个语义清晰的 `useSelectionPresentation`
- 把中间层 type / resolve helper 收到文件私有
- `useNodeChrome` 已删除
- `selectionBox` 命名已压平成更直接的 `boxState`

## 4.3 重复菜单建模

这是 React 侧当前最值得继续收口的一组。

### `features/selection/chrome/contextMenuModel.ts`

这个文件约 `404` 行，承担了：

- 右键目标快照与恢复
- node summary / can 计算
- style 菜单构建
- canvas / node / edge 三类菜单拼装
- 对 selection menu 公共动作的二次拼接

真正的问题不是它大，而是它和 `selectionMenu.ts` 之间边界模糊：

- `contextMenuModel.ts` 自己做一部分菜单视图建模
- 又依赖 `selectionMenu.ts` 的 filter / group / action 解析

结果是：

- 菜单动作定义散在两处
- selection action 的语义被 toolbar/context menu 各拼一次
- “context menu model” 这个名字会让人误以为它是独立领域，其实只是 selection chrome 的一个分支

这部分也已经继续收口：

- `contextMenuModel.ts` 已删除
- selection 快照/恢复回收到 `ContextMenu.tsx`
- 纯菜单解析迁移到 `contextMenuView.ts`

### `features/selection/chrome/selectionMenu.ts`

这个文件约 `659` 行，已经不是单纯菜单配置，而是一个巨大纯函数工具箱，里面混合了：

- 过滤动作
- 排列动作
- 对齐/分布动作
- 分组/解组
- 锁定/解锁
- 删除/复制等 more menu section
- context menu group 组装

它的问题是“抽象面太宽”：

- 名字叫 `selectionMenu`
- 实际承担了 selection chrome 的公共动作仓库
- toolbar 和 context menu 都要来这里取逻辑

长期更合适的是把它拆成三块：

- `selectionActions.ts`：只保留真正的命令动作
- `selectionMenuSections.ts`：只负责把动作排成 toolbar/menu section
- `selectionFilter.ts`：只负责类型过滤和 selection replace

这一点已经部分按同样思路落地：

- `selectionMenuActions.ts`
- `selectionFilter.ts`
- `selectionSections.ts`
- `selectionMenu.ts` 退回 barrel

### `features/selection/chrome/NodeToolbar.tsx`

这个文件约 `615` 行，是 React 侧最典型的“看上去像组件，实际上像半个 feature runtime”。

它同时承担：

- toolbar icon 渲染
- menu 开闭状态
- selection 读取与定位
- schema 读取
- 文字节点 source 查询与 commit
- font size 测量与写回
- selection layout/filter/more menu 拼装

这意味着它不是薄组件，而是：

- 组件
- view-model
- menu runtime
- text command adapter

四层混在一起。

这部分不建议继续往里加能力。下一轮应该优先拆。

这部分已经按下面的方向落地：

- `NodeToolbar.tsx` 只保留容器渲染和 menu 开闭
- 文本编辑相关逻辑已拆到 `nodeToolbarText.ts`
- toolbar icon 渲染已拆到 `nodeToolbarIcon.tsx`
- toolbar 状态推导已拆到 `nodeToolbarModel.ts`

## 4.4 过胖工具文件

### `features/node/text.ts`

这个文件约 `682` 行，已经承载：

- text 宽度模式
- editable 内容处理
- DOM 测量元素准备
- line-height / typography 归一化
- auto-font queue
- raf task 调度
- text size 测量
- auto-font task 创建和调度

这里不是“无用”，而是“有用但过于集中”，导致它成为一个高噪音源：

- 任何文本相关问题都会把人带进一个超大工具文件
- DOM 细节、测量细节、排版细节、任务调度细节没有分层

这部分已经拆成三块：

- `textContent.ts`：宽度模式、editable 内容、placeholder
- `textMeasure.ts`：测量 DOM 与 typography 归一化
- `textAutoFont.ts`：auto-font queue 与调度

原 `features/node/text.ts` 现在只保留出口职责。

---

## 5. 哪些“看上去有用”，但实际上价值不高

这里专门列出几类最容易误判的点。

## 5.1 `useWhiteboard.ts` 里的聚合语义 hook

`useWhiteboard`、`useEdit`、`useTool`、`useFrameScope`、`useInteraction` 不是完全没用。

从当前引用看，它们仍然被多个位置消费，例如：

- `Whiteboard.tsx`
- `ToolPalette.tsx`
- `NodeOverlayLayer.tsx`
- `EdgeOverlayLayer.tsx`
- 若干默认 node 组件

所以这层不能简单判定为噪音。

但它也不应该继续无限扩张。它适合承载的是：

- 高频公共语义读取

不适合承载的是：

- feature 专属聚合
- 把本该在使用点直接读的 runtime getter 再包一层

结论：

- 可以保留
- 但要把它限制在小而稳定的公共语义 hook 集合

## 5.2 `features/edge/preview.ts`

这个文件很薄，只提供：

- `EMPTY_PATCH`
- `writeEdgePreviewPatch`
- `writeEdgePreviewRoute`
- 若干类型别名

当前消费者只有边相关的少数 hooks：

- `useEdgeView.ts`
- `useEdgeDragInput.ts`
- `useEdgeRouteInput.ts`

所以它不像 `node/text.ts` 那样“过胖”，相反是“过薄”。

它的问题在于：

- 逻辑过于简单
- 复用面很小
- 对外形成了一个看似独立的 `preview.ts`

这类文件可以等下一轮一并内联到边输入/视图层，不需要单独长期保留。

---

## 6. 推荐执行顺序

## Phase 1：继续删除兼容壳

目标：

- 把 React 内部仍然只是 editor 转发层的文件继续去掉

优先项：

- `features/draw/state.ts`
- `runtime/viewport/index.ts` 里的类型壳与 hook 转发部分
- `features/edge/preview.ts`

原则：

- 能直接从 `@whiteboard/editor` 或实际实现文件读取的，不保留 React 二级壳

## Phase 2：压平 node selection presentation

目标：

- 减少 `features/node/selection.ts` 的重复 view-model 分层

做法：

- 保留一层最终语义 hook
- 中间 resolve helper 尽量私有化
- 避免继续公开 `View / Presentation / Chrome` 三套名词

## Phase 3：收敛 selection chrome

目标：

- 让 toolbar 与 context menu 共用同一份 selection action 语义，而不是两边各拼一次

做法：

- 拆 `selectionMenu.ts`
- 缩 `contextMenuModel.ts`
- 让 `NodeToolbar.tsx` 退回薄组件

这是 React 侧最有收益的一轮。

## Phase 4：拆文本 mega util

目标：

- 把 `features/node/text.ts` 从“所有文本逻辑都往里塞”改成职责明确的三个子模块

收益：

- 更容易维护 auto-font 和测量逻辑
- 文本 feature 的调用面更清晰
- 避免 toolbar/text/node registry 在同一个大文件上反复耦合

---

## 7. 最终判断

React 侧当前不是“功能太散”，而是“壳层太多、伪分层太多、少数文件又过胖”。

因此最优策略不是继续增加新的 model / presentation 层，而是：

- 删除纯兼容壳
- 合并单消费者包装层
- 把真正过胖的模块按职责拆开

主线改造已经完成。如果只看当前剩余的低优先级残项，建议排序如下：

1. 继续观察 `runtime/hooks/useWhiteboard.ts` 是否还会继续膨胀
2. 如果 `ToolPalette.tsx` 再增长，考虑把局部 helper 拆到同目录邻近文件，而不是恢复 model 壳
3. 如果 `contextMenuView.ts` 再增长，优先按 canvas/node/edge 三类拆 view，而不是恢复 model 命名
4. 只在出现真实复用后，再决定是否把部分 helper 提升成稳定入口

其中前两项都已经不属于“主线收口未完成”，而是后续维护期的低优先级整洁性工作。
