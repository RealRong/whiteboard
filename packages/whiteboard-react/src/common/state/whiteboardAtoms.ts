import { atom } from 'jotai'
import type { EdgeAnchor, EdgeId, NodeId, Point, Rect } from '@whiteboard/core'
import { getPlatformInfo } from '../shortcuts/shortcutManager'
import type { ShortcutContext } from '../shortcuts/types'

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export type SelectionState = {
  selectedNodeIds: Set<NodeId>
  isSelecting: boolean
  selectionRect?: Rect
  selectionRectWorld?: Rect
  mode: SelectionMode
}

export type SelectionStore = SelectionState & {
  selectedEdgeId?: EdgeId
  tool: string
}

export type InteractionState = {
  focus: {
    isEditingText: boolean
    isInputFocused: boolean
    isImeComposing: boolean
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
  hover: {
    nodeId?: NodeId
    edgeId?: EdgeId
  }
}

export type ViewportState = {
  zoom: number
}

export type EdgeConnectFrom = {
  nodeId: NodeId
  anchor: EdgeAnchor
}

export type EdgeConnectTo = {
  nodeId?: NodeId
  anchor?: EdgeAnchor
  pointWorld?: Point
}

export type EdgeReconnectInfo = {
  edgeId: EdgeId
  end: 'source' | 'target'
}

export type EdgeConnectState = {
  isConnecting: boolean
  from?: EdgeConnectFrom
  to?: EdgeConnectTo
  hover?: EdgeConnectTo
  reconnect?: EdgeReconnectInfo
  pointerId?: number | null
}

const createSelectionState = (): SelectionStore => ({
  selectedNodeIds: new Set<NodeId>(),
  isSelecting: false,
  mode: 'replace',
  selectionRect: undefined,
  selectionRectWorld: undefined,
  selectedEdgeId: undefined,
  tool: 'select'
})

export const platformAtom = atom<ShortcutContext['platform']>(getPlatformInfo())

export const interactionAtom = atom<InteractionState>({
  focus: {
    isEditingText: false,
    isInputFocused: false,
    isImeComposing: false
  },
  pointer: {
    isDragging: false,
    button: undefined,
    modifiers: {
      alt: false,
      shift: false,
      ctrl: false,
      meta: false
    }
  },
  hover: {
    nodeId: undefined,
    edgeId: undefined
  }
})

export const selectionAtom = atom<SelectionStore>(createSelectionState())

export const viewportAtom = atom<ViewportState>({
  zoom: 1
})

export const edgeConnectAtom = atom<EdgeConnectState>({
  isConnecting: false
})

export const updateInteractionAtom = atom(null, (get, set, patch: Partial<InteractionState>) => {
  const prev = get(interactionAtom)
  set(interactionAtom, {
    ...prev,
    ...patch,
    focus: patch.focus ? { ...prev.focus, ...patch.focus } : prev.focus,
    pointer: patch.pointer
      ? {
          ...prev.pointer,
          ...patch.pointer,
          modifiers: patch.pointer.modifiers
            ? { ...prev.pointer.modifiers, ...patch.pointer.modifiers }
            : prev.pointer.modifiers
        }
      : prev.pointer,
    hover: patch.hover ? { ...prev.hover, ...patch.hover } : prev.hover
  })
})

export const setSelectionAtom = atom(null, (get, set, updater: (prev: SelectionStore) => SelectionStore) => {
  set(selectionAtom, updater(get(selectionAtom)))
})

export const updateViewportAtom = atom(null, (get, set, patch: Partial<ViewportState>) => {
  const prev = get(viewportAtom)
  set(viewportAtom, { ...prev, ...patch })
})

export const shortcutContextAtom = atom<ShortcutContext>((get) => {
  const platform = get(platformAtom)
  const interaction = get(interactionAtom)
  const selection = get(selectionAtom)
  const viewport = get(viewportAtom)
  const edgeConnect = get(edgeConnectAtom)
  const selectedNodeIds = Array.from(selection.selectedNodeIds)
  return {
    platform,
    focus: interaction.focus,
    tool: { active: selection.tool },
    selection: {
      count: selectedNodeIds.length,
      hasSelection: selectedNodeIds.length > 0,
      selectedNodeIds,
      selectedEdgeId: selection.selectedEdgeId
    },
    hover: interaction.hover,
    pointer: {
      ...interaction.pointer,
      isDragging: interaction.pointer.isDragging || selection.isSelecting || edgeConnect.isConnecting
    },
    viewport: {
      zoom: viewport.zoom
    }
  }
})
