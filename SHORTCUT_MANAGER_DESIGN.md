# ShortcutManager 设计方案（行业规范版）

本文档目标：在 whiteboard-react 侧集中配置快捷键（键盘/鼠标/修饰键），根据“上下文”动态启用，并统一映射到 core 命令。ShortcutContext 按职责分区，不平铺属性，便于扩展与维护。

---

## 1. 总体原则（行业通用做法）

1) **输入在 UI 层，命令在 Core 层**
- 快捷键属于交互层（焦点/输入法/编辑态/悬浮态），应放在 whiteboard-react。
- core 只提供无状态命令（move/duplicate/align/undo 等）。

2) **上下文优先**
- 同一按键在不同上下文有不同功能（如选中 vs 未选中）。
- 匹配顺序：编辑态 > 选中态 > 工具态 > 默认态。

3) **单一注册点，集中配置**
- 全部快捷键集中在一个 registry（便于查重、可视化、文档）。

4) **冲突可控、优先级明确**
- 显式优先级 + 最长匹配（modifier 多/组合更复杂者优先）。

5) **平台兼容**
- cmd/ctrl 自动映射；保留系统关键快捷键（如 cmd+L、cmd+R）。

---

## 2. ShortcutContext（按职责分区）

避免平铺属性，按“状态域”拆分：

```ts
export type ShortcutContext = {
  platform: {
    os: 'mac' | 'win' | 'linux'
    metaKeyLabel: 'cmd' | 'ctrl'
  }
  focus: {
    isEditingText: boolean
    isInputFocused: boolean
    isImeComposing: boolean
  }
  tool: {
    active: 'select' | 'edge' | 'pan' | 'text' | string
  }
  selection: {
    count: number
    hasSelection: boolean
    selectedNodeIds: string[]
    selectedEdgeId?: string
  }
  hover: {
    nodeId?: string
    edgeId?: string
  }
  pointer: {
    isDragging: boolean
    button?: 0 | 1 | 2
    modifiers: {
      alt: boolean
      shift: boolean
      ctrl: boolean
      meta: boolean
    }
  }
  viewport: {
    zoom: number
  }
}
```

说明：
- `focus` 独立是为了处理编辑态/输入框焦点/IME。
- `selection` 不与 hover 混合；hover 只影响临时交互。
- `tool` 明确当前工具模式。

---

## 3. Shortcut 定义结构（集中配置）

```ts
type Shortcut = {
  id: string
  title?: string
  category?: 'edit' | 'view' | 'navigate' | 'node' | 'edge' | 'group' | 'tool'
  keys?: string[] // 例：['Shift+ArrowUp', 'Alt+Drag']
  pointer?: {
    button?: 0 | 1 | 2
    alt?: boolean
    shift?: boolean
    ctrl?: boolean
    meta?: boolean
  }
  when?: (ctx: ShortcutContext) => boolean
  priority?: number // 默认 0，越大越优先
  handler: (ctx: ShortcutContext, event: KeyboardEvent | PointerEvent) => void
}
```

关键点：
- `when(ctx)` 控制上下文启用。
- `priority` + “匹配复杂度”解决冲突。

---

## 4. 解析与匹配策略（行业规范）

1) **标准化输入**
- 键盘事件统一转为 `KeyChord`（如 `Shift+ArrowUp`）。
- mac 侧 `Meta` 视为主修饰键，win/linux 侧 `Ctrl` 为主修饰键。

2) **匹配优先级**
- `when(ctx)` 为 false 的直接跳过。
- `priority` 高的先匹配。
- 修饰键更多的优先（如 `Shift+Alt+S` > `Alt+S`）。

3) **冲突处理**
- 若多条匹配：取最高优先级 + 最长匹配。
- 可配置冲突日志（开发态提醒）。

---

## 5. 事件绑定规范

- `keydown/keyup` 绑定在 Whiteboard 根容器（或 window，按需）。
- pointer 相关（左键/右键/中键 + 修饰）绑定在容器上。
- 编辑态（textarea/contenteditable）直接放行，不拦截。
- 对 IME 组合输入（`isComposing`）不触发快捷键。

---

## 6. 与 Core 的关系

- ShortcutManager 只负责「输入 → 命令」的转换。
- 核心业务由 `core.commands` 或 `core.dispatch` 完成。
- 示例：
  - `Delete` → `core.dispatch({ type: 'node.delete', ids })`
  - `Cmd+G` → `core.commands.group.create(ids)`

---

## 7. 如何实现（落地步骤）

### Step 1：建立 ShortcutManager（whiteboard-react）
- 文件建议：`packages/whiteboard-react/src/common/shortcuts/ShortcutManager.ts`
- 提供：
  - `register(shortcut)`
  - `unregister(id)`
  - `handleKeyDown(event, ctx)`
  - `handlePointerDown(event, ctx)`

### Step 2：建立 ShortcutContext 工厂
- 在 `Whiteboard` 里通过现有状态汇总 context：
  - selection、tool、hover、viewport、focus
- 对编辑态输入框直接 short-circuit。

### Step 3：定义集中配置
- 统一一个 `shortcuts.ts`，按分类分组
- 逐条迁移：
  - 现有的 `cmd+g` / `shift+cmd+g`
  - 现有 edge 相关动作

### Step 4：挂载事件
- `Whiteboard` 中统一 `keydown` / `pointerdown` 调用 manager
- 仅当 manager 返回 “handled = true” 时阻止默认行为

---

## 8. 迁移计划（从当前代码）

当前已有的分散逻辑：
- `Whiteboard.tsx` 内的 `cmd+g` / `shift+cmd+g`
- 选择、拖拽、edge 操作逻辑

迁移顺序建议：
1) 建立 manager + context
2) 迁移 `cmd+g` / `shift+cmd+g` 到集中配置
3) 迁移常用快捷键（Delete / Duplicate / Undo / Redo）
4) 最后迁移鼠标修饰键逻辑（如 Alt/Shift+drag）

---

## 9. 可扩展点

- 支持用户自定义快捷键映射（持久化）
- 支持 mac/win 默认映射表
- 支持多语言提示（快捷键面板）

---

## 10. 结论

建议把 ShortcutManager 放在 **whiteboard-react**：
- 可直接访问 UI 状态（selection/hover/编辑态）
- 易于集中配置、动态启用
- core 只负责稳定命令与状态，不参与输入解析

这符合主流白板/图编辑器的行业惯例。

