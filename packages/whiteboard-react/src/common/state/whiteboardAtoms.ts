import { atom } from 'jotai'
import type { EdgeAnchor, EdgeId, NodeId, Point, Rect } from '@whiteboard/core'
import { getPlatformInfo } from '../shortcuts/shortcutManager'
import type { ShortcutContext } from '../shortcuts/types'
import { docAtom } from './whiteboardContextAtoms'

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export type SelectionState = {
  selectedNodeIds: Set<NodeId>
  isSelecting: boolean
  selectionRect?: Rect
  selectionRectWorld?: Rect
  mode: SelectionMode
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

const createNodeSelectionState = (): SelectionState => ({
  selectedNodeIds: new Set<NodeId>(),
  isSelecting: false,
  mode: 'replace',
  selectionRect: undefined,
  selectionRectWorld: undefined
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

type HoveredEdgeIdUpdate =
  | EdgeId
  | undefined
  | ((prev: EdgeId | undefined) => EdgeId | undefined)

export const hoveredEdgeIdAtom = atom(
  (get) => get(interactionAtom).hover.edgeId,
  (get, set, update: HoveredEdgeIdUpdate) => {
    const prev = get(interactionAtom).hover.edgeId
    const next = typeof update === 'function' ? update(prev) : update
    if (prev === next) return
    set(interactionAtom, (current) => ({
      ...current,
      hover: {
        ...current.hover,
        edgeId: next
      }
    }))
  }
)

export const spacePressedAtom = atom<boolean>(false)

export const toolAtom = atom<string>('select')

export const nodeSelectionAtom = atom<SelectionState>(createNodeSelectionState())

export const edgeSelectionAtom = atom<EdgeId | undefined>(undefined)

export const viewportAtom = atom<ViewportState>((get) => {
  const doc = get(docAtom)
  return {
    zoom: doc?.viewport?.zoom ?? 1
  }
})

export const edgeConnectAtom = atom<EdgeConnectState>({
  isConnecting: false
})

export const edgeConnectTransientAtom = edgeConnectAtom

export const shortcutContextAtom = atom<ShortcutContext>((get) => {
  const platform = get(platformAtom)
  const interaction = get(interactionAtom)
  const tool = get(toolAtom)
  const selection = get(nodeSelectionAtom)
  const selectedEdgeId = get(edgeSelectionAtom)
  const viewport = get(viewportAtom)
  const edgeConnect = get(edgeConnectAtom)
  const selectedNodeIds = Array.from(selection.selectedNodeIds)
  return {
    platform,
    focus: interaction.focus,
    tool: { active: tool },
    selection: {
      count: selectedNodeIds.length,
      hasSelection: selectedNodeIds.length > 0,
      selectedNodeIds,
      selectedEdgeId
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
