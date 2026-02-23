export type ShortcutModifierState = {
  alt: boolean
  shift: boolean
  ctrl: boolean
  meta: boolean
}

export type ShortcutKeyEvent = {
  key: string
  code: string
  repeat: boolean
  modifiers: ShortcutModifierState
  isComposing?: boolean
}

export type ShortcutPointerEvent = {
  button: number
  modifiers: ShortcutModifierState
}

export type ShortcutNativeEvent = ShortcutKeyEvent | ShortcutPointerEvent

export type ShortcutAction =
  | 'group.create'
  | 'group.ungroup'
  | 'selection.selectAll'
  | 'selection.clear'
  | 'selection.delete'
  | 'selection.duplicate'
  | 'history.undo'
  | 'history.redo'

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
    active: string
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

export type Shortcut = {
  id: string
  title?: string
  category?: 'edit' | 'view' | 'navigate' | 'node' | 'edge' | 'group' | 'tool'
  keys?: string[]
  pointer?: {
    button?: 0 | 1 | 2
    alt?: boolean
    shift?: boolean
    ctrl?: boolean
    meta?: boolean
  }
  when?: (ctx: ShortcutContext) => boolean
  priority?: number
  allowWhenEditing?: boolean
  handler: (ctx: ShortcutContext, event: ShortcutNativeEvent) => void
}

export type { ShortcutManager, ShortcutManagerOptions, ShortcutOverrides, Shortcuts } from './manager'
