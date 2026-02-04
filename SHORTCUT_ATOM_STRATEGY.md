# 快捷键与交互状态的 Jotai 拆分方案（大粒度版本）

目标：避免把 atoms 拆得过碎，按“职责/语义”合并成大一点的状态块，同时仍保持可维护、低耦合与性能可控。

---

## 1. 拆分原则（大粒度）

1) **按职责域合并**
- 不是按字段拆，而是按“语义域”拆：输入焦点、选择、指针交互、视口与工具。

2) **低频写入进 Atom，高频变化留局部**
- 拖拽过程中的“点位/路径”仍留在 hook 内部 state，避免全局订阅抖动。
- Atom 仅保存“需要跨模块共享”的状态，如选中、是否连接中、当前工具等。

3) **ShortcutContext 由少量大 Atom 组合**
- 用一个 derived atom 组装 ShortcutContext，方便统一读取。
- 其它模块不需要知道快捷键细节，只更新“自己负责”的 Atom。

---

## 2. 推荐的 Atom 划分（大粒度）

### A. `interactionAtom`（输入与指针）
包含：
- `focus`: `{ isEditingText, isInputFocused, isImeComposing }`
- `pointer`: `{ isDragging, button, modifiers }`
- `hover`: `{ nodeId?, edgeId? }`

职责：
> 所有“输入与指针行为”的状态统一到一个 Atom，避免拆成多个小 Atom。

写入者：
- Whiteboard 容器（pointer down/move/up）
- 编辑组件（textarea/contentEditable）
- Node/Edge 交互逻辑（hover 反馈）

读取者：
- ShortcutContext（快捷键判断）
- UI 层（例如 hover 工具条）

---

### B. `selectionAtom`（选中与工具态）
包含：
- `selectedNodeIds: string[]`
- `selectedEdgeId?: string`
- `tool: 'select' | 'edge' | ...`

职责：
> “与选择相关的语义”以及当前工具模式放在一起。

写入者：
- selection hook（选中变化）
- edgeConnect（选中边变化）
- tool 切换入口

读取者：
- ShortcutContext
- PropertyPanel / EdgeLayer 等

---

### C. `viewportAtom`（视口与缩放）
包含：
- `zoom`
- （可选）`center` 或 `viewportRect`

职责：
> 与缩放/视口相关的状态统一管理。

写入者：
- useViewport / useViewportControls

读取者：
- ShortcutContext
- 缩放相关逻辑（例如快捷键放大/缩小）

---

### D. `edgeConnectAtom`（轻量版连接状态）
包含：
- `isConnecting`
- `reconnect?: { edgeId, end }`

职责：
> 只记录“连接行为的状态开关”，不记录高频点位。

写入者：
- useEdgeConnect（连接开始/结束）

读取者：
- ShortcutContext
- UI 层（比如连接中禁用某些快捷键）

---

## 3. ShortcutContext 的构建（派生 Atom）

建立 `shortcutContextAtom`：
```ts
const shortcutContextAtom = atom((get) => {
  const interaction = get(interactionAtom)
  const selection = get(selectionAtom)
  const viewport = get(viewportAtom)
  const edgeConnect = get(edgeConnectAtom)
  return {
    platform: get(platformAtom),
    focus: interaction.focus,
    pointer: interaction.pointer,
    hover: interaction.hover,
    selection: {
      count: selection.selectedNodeIds.length,
      hasSelection: selection.selectedNodeIds.length > 0,
      selectedNodeIds: selection.selectedNodeIds,
      selectedEdgeId: selection.selectedEdgeId
    },
    tool: { active: selection.tool },
    viewport: { zoom: viewport.zoom },
    // 如果需要也可把 edgeConnect.isConnecting 放到 pointer.isDragging 的判断逻辑中
  }
})
```

优点：
- Whiteboard 不需要在本地拼 Context。
- ShortcutManager 直接读 `shortcutContextAtom`，逻辑统一。

---

## 4. 高频状态如何处理

以下状态不要放进 Atom：
- edgeConnect 的 `from/to/hover` 点位
- 拖拽过程中的实时坐标

原因：
> 这些会导致高频更新与无意义重渲染；只在具体组件内更新即可。

---

## 5. 迁移步骤建议

1) 把 Whiteboard 里的 `getShortcutContext` 替换为 `shortcutContextAtom`。
2) 将 selection/edgeConnect/hover/focus 等写入点改为写 atom。
3) 删除 Whiteboard 中与 shortcut 相关的 useState/useMemo。
4) ShortcutManager 只接受“外部 ctx”或读取 atom 快照。

---

## 6. 结论

这套拆分方式避免“过碎 atom”，同时满足：
- 快捷键可跨模块访问统一上下文
- 高性能（高频状态仍留在局部）
- 维护清晰（职责域大而清楚）

如果需要，我可以按这套方案落地并迁移现有 Whiteboard 的快捷键上下文构建逻辑。
