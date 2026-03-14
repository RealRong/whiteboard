# Container 第二阶段收尾清单

## 当前结论

目前状态可以概括为两句：

- `group as container` 的最小可用闭环已经完成
- `container capability` 还没有彻底抽象完成

也就是说，现在已经可以把 group 当作一个“可进入、可内部编辑”的容器来使用，但还不能说整套 container 基建已经 fully done。

## 已完成

当前已经具备这些能力：

- `activeContainerId` 已存在，并挂在 `instance.state` / `instance.commands.container`
- 双击 group 进入 scope
- scope 内点击 child 可单选
- `Shift` 可多选 child
- `Cmd/Ctrl+A` 只选当前 container descendants
- scope 内可在 group 空白区直接拖框
- 点击外部空白退出 scope
- 点击外部 node 会退出 scope，并直接切换选中目标
- `Esc` 退出 scope
- 有轻量 scope 提示
- scope 内右键菜单创建 node，会默认写入当前 `parentId`
- demo 面板插入 node，也会默认写入当前 `parentId`

这说明：

- group 的内部编辑体验已经不是半成品
- 但通用 container 抽象还处在“第一阶段完成，第二阶段待收口”的状态

### 当前创建入口审计

目前 React / demo 侧显式的 `node.create` 入口已经查过一遍：

- `packages/whiteboard-react/src/context-menu/canvasSections.ts`
- `apps/demo/src/App.tsx`

这两条链路现在都已经是 scope-aware。

当前没有发现第二条独立的 UI `node.create` 入口。

需要注意的是，下面这些不属于“UI 侧补 parentId”的问题，而属于命令自身语义：

- `duplicate`
- `group.create`
- `mindmap insert`

也就是说，后续如果它们在 scope 内需要特殊 parent 规则，应该优先在命令语义层审，而不是继续散落在 UI 入口补丁里。

## P0

这部分做完，`group as container` 才算真正稳定。

- scope badge 改成显示节点标题，而不是硬编码 `Editing group`
- 明确 nested container 规则
- 为 scope 相关交互补最小测试覆盖
- 审一遍 toolbar / context-menu / handles / edge controls 在 scope 内外的显示与命中规则

### 当前 nested 规则

当前实现采用最小规则，不维护 container stack，只维护一个：

- `activeContainerId`

这意味着：

- 只存在一个当前激活容器
- 在 scope 内双击子 group，会直接切换到子 group
- 不保留父级 breadcrumb / parent scope stack
- `Esc` 直接退出到 canvas，而不是逐级返回父容器

这是当前阶段的刻意约束，不是最终形态。

如果后续需要真正的多级 drill-in，再把它扩成 `activeContainerPath`
或等价的 stack 模型。

### P0 完成标准

- 用户能明确看出当前正在编辑哪个容器
- scope 进入/退出规则稳定，没有明显歧义
- 主要交互路径有测试保护
- scope 不会导致 chrome 泄漏或外部对象误响应

## P1

这部分做完，container 才不再只是 group 的别名。

- 抽明确的 `container capability`
- React 层交互判断尽量从 `node.type === 'group'` 改为“是否具备 container 能力”
- 继续收口命名，让通用逻辑优先使用 `container`，只把真正私有部分保留为 `group`
- 把 scope 相关 helper 提升为稳定的 container 读模型

建议最少具备这些 helper：

- `getScopedNodeIds`
- `isInContainerScope`
- `getContainerAncestors`
- `resolveContainerAtPoint`

### P1 完成标准

- 交互主流程不再依赖 group 特判
- 代码阅读时，能明显看出“通用 container 语义”和“group 私有语义”的边界
- scope / hit-test / selection 的通用逻辑可被复用

## P2

这部分做完，group 私有语义和通用 container 语义才会真正拆开。

- `collapsed` 保持为 group 私有
- 审查 `autoFit` / `padding` 是否属于所有 container，还是只属于 group 这类内容包裹容器
- 明确区分两类容器：
  - `content container`
  - `frame container`

建议语义：

- `content container`
  例如 group，主要围绕 children 自适应或包裹内容
- `frame container`
  例如 artboard / 16:9 / 4:3 / 1:1，尺寸由设计约束决定，不自动贴 children bounding

### P2 完成标准

- group 私有字段不会污染未来的 frame / artboard
- container 相关字段命名和职责清晰
- 后续新增容器类型时，不需要沿用 group 语义凑合

## P3

这部分是验证抽象是否真的成立的关键阶段。

建议新增一个非 group 的容器类型：

- `frame`

建议它具备：

- 固定尺寸或固定比例
- 可进入内部编辑
- 不自动贴合 children bounds
- 自己的视觉边框、标题区、背景区

### 为什么先做 frame

因为它和 group 足够像，但又不一样：

- 一样的地方：
  - 都是容器
  - 都需要 scope / 内部选择 / 内部拖框
- 不一样的地方：
  - frame 不该走 group 的 auto-fit 逻辑
  - frame 的尺寸与视觉更偏设计画板

如果 frame 能复用当前大部分 container 主流程，说明抽象方向正确。  
如果做 frame 时又到处出现 `if (type === 'group')` / `if (type === 'frame')`，说明基建还没抽干净。

### P3 完成标准

- 至少两种容器类型共享同一套主要 scope / selection / hit-test 流程
- 新容器只需提供少量特性逻辑，而不是复制整套 group 代码

## Done 标准

只有下面四条同时成立，才能说 `container 基建完成`：

1. `group` 的内部编辑交互稳定，没有明显边界 bug
2. 交互层主语已经从 `group special case` 变成 `container capability`
3. `group` 和至少一个非 group 容器类型共享同一套主流程
4. group 私有能力与通用 container 能力边界清晰

## 推荐实施顺序

建议按这个顺序推进：

1. 先做 `P0`
2. 再做 `P1`
3. 然后做 `P2`
4. 最后用 `frame` 完成 `P3`

原因很简单：

- 不先做 `P0`，当前 group 交互还不够稳
- 不先做 `P1`，后面抽象会继续散落在 group 特判里
- 不先做 `P2`，新增 frame 时字段语义会混乱
- `P3` 是验证题，不该拿来代替设计题

## 一句话总结

当前最准确的判断是：

- `group` 这一轮基本完成
- `container` 第一阶段完成
- `container` 第二阶段还需要按清单继续收口与验证
