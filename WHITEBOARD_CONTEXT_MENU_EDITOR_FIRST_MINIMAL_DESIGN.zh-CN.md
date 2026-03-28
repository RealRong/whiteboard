# Whiteboard Context Menu Editor-First 最简设计方案

## 1. 文档目标

这份文档回答一个更具体的问题：

- `context menu` 这条链路，是否应该由 `whiteboard-editor` 先把语义和菜单模型准备好，再由 `whiteboard-react` 只负责渲染

本文的结论是：

- 是，而且这是比“把 `ContextTarget` 搬到 React”更彻底、更稳定的收口方向

本文聚焦的当前文件：

- `packages/whiteboard-editor/src/runtime/input/pointer.ts`
- `packages/whiteboard-editor/src/runtime/input/target.ts`
- `packages/whiteboard-react/src/features/selection/chrome/ContextMenu.tsx`
- `packages/whiteboard-react/src/features/selection/chrome/contextMenuView.ts`
- `packages/whiteboard-react/src/features/selection/chrome/selectionFilter.ts`
- `packages/whiteboard-react/src/features/selection/chrome/selectionMenuActions.ts`

---

## 2. 结论先行

`context menu` 最合理的长期形态，不应该是：

1. React 监听右键事件
2. React 调 editor 的 `pick`
3. React 自己继续调用：
   - `readContextOpen(...)`
   - `resolveContextTarget(...)`
   - `readContextMenuView(...)`
4. React 自己组装菜单 view
5. React 渲染

而应该是：

1. React 监听右键事件
2. React 先把宿主事件归一化成标准输入
3. editor 内部完成：
   - target 语义解释
   - menu model 构建
   - dismiss 恢复语义
4. React 只读取 editor 产出的 menu view 并渲染

一句话概括：

**React 负责 overlay 和浏览器事件接入，editor 负责 context 语义与菜单模型。**

---

## 3. 为什么要这样改

## 3.1 当前 React 做了过多 editor 语义工作

当前 `ContextMenu.tsx` 实际承担了下面这些工作：

- 从容器事件读取 `pick`
- 调 `readContextOpen(...)`
- 持有 `ContextTarget`
- 再调 `resolveContextTarget(...)`
- 再调 `readContextMenuView(...)`
- 最后才开始渲染

这说明 React 不只是“渲染菜单”，而是在承担 editor 语义解释链。

这层职责太重，也让 `ContextTarget`、`ContextResolved` 这些 editor 语义类型泄露到了 React。

## 3.2 `ContextTarget` 本质上不是 React 概念

`ContextTarget` 表达的是：

- 当前上下文操作作用于 `canvas`
- 单个 `node`
- 当前 selection 对应的多个 `nodes`
- 某个 `edge`

它依赖的是：

- `pick`
- `selection`
- `frame`
- editor `read`

这不是 JSX 结构，不是 DOM 结构，也不是菜单组件自己的 UI 模型。

所以它更适合作为 editor 内部语义概念，而不是 React 公共输入。

## 3.3 这条链最终应该支持非 React 宿主

如果未来：

- 菜单不是 React 实现
- 菜单来自插件系统
- 菜单来自宿主壳层

那么 editor 仍然需要独立给出“这次 context 行为作用于谁，以及有哪些菜单项”。

所以这条能力本质上应该属于 editor，而不是 React。

---

## 4. 最简职责切分

## 4.1 editor 负责

editor 应该负责：

- 消费标准化后的 `ContextOpenInput`
- `ContextTarget`
- `leaveFrame`
- `ContextResolved`
- `ContextMenuView`
- 菜单 action 的 command 绑定
- dismiss 时 selection 是否恢复

## 4.2 react 负责

React 应该负责：

- 监听 `pointerdown/contextmenu`
- DOM 级 ignore / duplicate open 去重
- 把宿主事件转换成 `ContextOpenInput`
- 容器尺寸测量
- placement 计算
- submenu hover / focus
- outside click / `Escape`
- JSX 渲染

最重要的一条：

**React 不再自己解释 context 语义，只消费 editor 产出的 view model。**

---

## 5. 目标链路

## 5.1 Open 链路

目标链路应为：

1. React 捕获 `pointerdown` 右键或 `contextmenu`
2. React 做浏览器级前置过滤：
   - ignore target
   - duplicate open 去重
3. React 把事件转换成 `ContextOpenInput`
4. React 调 editor 的语义单入口
5. editor 内部完成：
   - 基于 `pointer` 解释 target
   - `readContextOpen`
   - `resolveContextTarget`
   - `readContextMenuView`
   - 写入 context menu state
6. React 订阅该 state 并渲染

## 5.2 Dismiss 链路

目标链路应为：

1. React 监听 outside click / `Escape`
2. React 调 editor dismiss 入口
3. editor 内部关闭 context session
4. editor 根据 open 时 snapshot 的语义决定是否恢复 selection

## 5.3 Action 链路

目标链路应为：

1. React 点击某个菜单项
2. React 直接调用 view model 上的 action
3. editor 内部执行 command
4. editor 内部完成 close / selection 更新 / command side effect

---

## 6. 状态模型设计

建议把 context 分成两层模型：

## 6.1 editor 内部 session

这个 session 是 editor 内部概念，不需要暴露给 React。

```ts
type ContextMenuSession = {
  screen: Point
  target: ContextTarget
  restoreSelection?: SelectionTarget
  view: ContextMenuView
}
```

含义：

- `screen`：菜单锚点
- `target`：editor 内部语义目标
- `restoreSelection`：dismiss 时可能需要恢复的 selection
- `view`：给 React 的最终菜单模型

这里最重要的是：

- `ContextTarget` 仍然留在 editor 内部
- React 不直接依赖它

## 6.2 React 只读 view

React 只需要读这一层：

```ts
type ContextMenuView = {
  screen: Point
  summary?: ContextMenuSummaryView
  filter?: ContextMenuFilterView
  groups: readonly ContextMenuGroupView[]
}
```

这是一份纯展示模型。

React 可以在这层之上继续派生：

- placement
- submenu side

但不再从事件重新推导 target 和菜单语义。

---

## 7. View Model 最简形状

## 7.1 菜单项

为了让 React 真正只渲染，不再二次解释 action，我建议菜单项直接带可执行行为：

```ts
type ContextMenuItemView = {
  key: string
  label: string
  tone?: 'danger'
  disabled?: boolean
  children?: readonly ContextMenuItemView[]
  onSelect: () => unknown
}
```

这是当前实现的自然延伸，因为现有 `contextMenuView.ts` 已经在构造 `onClick`。

如果未来更强调序列化，也可以改成：

```ts
type ContextMenuItemView = {
  key: string
  label: string
  actionId: string
}
```

但这会额外引入一层 action routing，并不符合“最简”目标。

所以当前阶段更推荐：

- **editor 直接产 `onSelect`**

## 7.2 Filter

Filter 也建议直接变成 view：

```ts
type ContextMenuFilterView = {
  types: readonly {
    key: string
    label: string
    count: number
    active: boolean
  }[]
  onSelect: (key: string) => unknown
}
```

React 只负责把按钮渲染出来。

---

## 8. 哪些内容应该继续留在 React

不是所有 context menu 相关逻辑都应该下沉到 editor。

下面这些仍然更适合留在 React：

- `isDuplicateMenuOpen(...)`
- 菜单 placement 计算
- 容器宽高读取
- submenu 展开方向
- DOM focus / hover 行为
- pointerdown outside dismiss
- `Escape` dismiss 的宿主绑定

原因很简单：

- 这些依赖 DOM 和布局
- 这些是 overlay 渲染问题，不是 editor 语义问题

所以最合理的边界是：

- editor 负责“菜单是什么”
- React 负责“菜单怎么显示”

---

## 9. 哪些内容应该从 React 下沉到 editor

下面这些更适合下沉到 editor：

## 9.1 `readContextMenuView(...)`

当前 `packages/whiteboard-react/src/features/selection/chrome/contextMenuView.ts`

这一层本质上不是 React 视图，而是 editor 语义解释：

- canvas target 对应哪些菜单组
- node / nodes 对应哪些操作组
- edge 对应哪些操作组
- 哪些菜单项应该启用
- filter 怎么构造

这应该整体进入 editor。

## 9.2 `resolveSelectionFilter(...)`

当前 filter 实际上是：

- 基于当前 selection summary 生成语义过滤动作

这不是 UI 逻辑，应该下沉。

## 9.3 `runMenuAction(...)`

这个函数包装的是：

- action 执行
- 异步 close

这更接近 editor command action 语义，也适合一起下沉。

## 9.4 selection snapshot / restore

当前 `ContextMenu.tsx` 里有：

- open 时 snapshot selection
- dismiss 时 restore

这其实不是 overlay 行为，而是 context session 语义。

它更适合作为 editor 内部 session 的一部分。

---

## 10. 推荐 API 形态

## 10.1 editor 输入入口

不建议在 editor 侧直接提供按浏览器事件命名的入口，例如：

```ts
handleContextPointerDown(instance, container, event)
handleContextMenu(instance, container, event)
```

这种 API 的问题是：

- editor 直接吃 `PointerEvent / MouseEvent / container`
- editor 仍然绑定浏览器事件模型
- `secondary pointerdown` 和 `contextmenu` 这种宿主层差异泄露到了 editor

更解耦的设计应该是：

- React / host 负责把宿主事件转换成标准化输入
- editor 只暴露一个语义动作：`open`

建议形态：

```ts
instance.commands.context.open(input)
```

其中 `input` 不是 DOM event，而是标准化后的语义输入：

```ts
type ContextOpenInput = {
  source: 'secondary-press' | 'context-menu'
  pointer: PointerPick
}
```

这里：

- `source` 只表达触发来源
- `pointer` 是已经归一化好的 pointer facts
- editor 不再依赖 `PointerEvent` / `MouseEvent`

在当前实现阶段，React 可以继续通过：

```ts
const pointer = instance.read.pick.from(event, container)
```

得到 `pointer`，然后再调用：

```ts
instance.commands.context.open({
  source: 'secondary-press',
  pointer
})
```

或者：

```ts
instance.commands.context.open({
  source: 'context-menu',
  pointer
})
```

这样 editor 内部再完成：

- open 语义计算
- session 写入
- menu view 构建

React 不再自己调：

- `readContextOpen(...)`
- `resolveContextTarget(...)`

## 10.2 editor 只读输出

建议 editor 侧提供：

```ts
instance.read.context.menu
```

或者：

```ts
instance.read.context.view
```

类型为：

```ts
ReadStore<ContextMenuView | null>
```

React 只需要订阅它。

## 10.3 editor dismiss 入口

建议再提供：

```ts
instance.commands.context.dismiss(mode)
```

其中：

```ts
type ContextDismissMode =
  | 'dismiss'
  | 'action'
```

这样：

- `dismiss` 可以恢复 snapshot
- `action` 正常关闭但不恢复旧 selection

---

## 11. 文件级迁移方案

## 11.1 editor 新增

建议新增：

- `packages/whiteboard-editor/src/runtime/context/*`

建议职责拆分如下：

- `state.ts`
  - context session store
  - read store
- `open.ts`
  - `openContextMenu`
  - `ContextOpenInput -> session/view`
- `view.ts`
  - `readContextMenuView`
  - filter / groups / item action 组装
- `dismiss.ts`
  - dismiss / restore selection

如果不想一开始拆太细，也可以先收成：

- `packages/whiteboard-editor/src/runtime/context/index.ts`

后续再拆。

## 11.2 editor 保留

下面这些继续留在 editor：

- `ContextTarget`
- `ContextResolved`
- `readContextTarget`
- `resolveContextTarget`

但它们逐步不再对 React 公开消费。

## 11.3 React 变薄

`packages/whiteboard-react/src/features/selection/chrome/ContextMenu.tsx`

最后应该主要只剩：

- 事件绑定
- placement
- dismiss host binding
- 渲染

`packages/whiteboard-react/src/features/selection/chrome/contextMenuView.ts`

最终应整体删除或迁空。

---

## 12. 分阶段落地建议

## 第一阶段

目标：

- editor 增加 context menu state
- editor 增加 `open` / `dismiss` 入口
- React 改成读 editor 的 menu store

但第一阶段允许：

- `ContextTarget` 仍暂时对外导出
- React 仍保留部分旧的类型引用

重点先把主链切过去。

## 第二阶段

目标：

- `contextMenuView.ts` 迁入 editor
- `selectionFilter.ts` 相关语义构造迁入 editor
- React 不再构造 menu groups/filter

## 第三阶段

目标：

- `ContextTarget` / `ContextResolved` 从 React 使用面消失
- React 只面向 `ContextMenuView`

这是最关键的收口完成标志。

---

## 13. 验收标准

当这轮 context 收口完成时，应满足下面几条：

### 13.1 React 不再调用 context 语义解析链

也就是说，React 不再直接调用：

- `readContextOpen(...)`
- `resolveContextTarget(...)`
- `readContextMenuView(...)`

但 React 仍然可以在宿主适配层调用：

- `instance.read.pick.from(...)`

前提是这一步只负责把浏览器事件转换成 `ContextOpenInput`，不再承担 context 语义解释。

### 13.2 React 只订阅一个 menu view store

也就是说，React 只需要读：

- `ContextMenuView | null`

### 13.3 `ContextTarget` 成为 editor 内部概念

也就是说，`ContextTarget` 最终不再是 React 组件层公开使用的输入类型。

### 13.4 dismiss 语义由 editor 接管

包括：

- selection snapshot
- selection restore
- action close vs dismiss close

### 13.5 新增 context menu item 时只改 editor 菜单模型

而不是每次都要求：

1. editor 提供 target
2. React 再手工解释 target
3. React 再组 menu item

---

## 14. 最终建议

如果只给一个建议，那就是：

**不要再讨论“`ContextTarget` 搬不搬到 React”，而应该继续往前走，直接让 React 不再接触 `ContextTarget`，同时避免 editor 暴露浏览器事件入口。**

更准确地说：

- `ContextTarget` 留在 editor
- `ContextMenuView` 由 editor 产出
- `ContextMenu.tsx` 只做 overlay rendering
- editor 通过 `context.open(input)` 接收标准化输入，而不是 `handleContextMenu(event)` 这类浏览器专用入口

这才是这条链路真正的最简设计。

从长期维护成本看，这个方向的收益非常明确：

- editor 语义归 editor
- React 渲染归 React
- context menu 不再是半截语义链
- 后续换宿主或接插件菜单时，能力面更稳定

这也是比“把 `target.ts` 直接搬去 React”更正确的收口方式。
