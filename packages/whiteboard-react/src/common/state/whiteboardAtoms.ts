import { atom } from 'jotai'
import type { EdgeId, NodeId, Viewport } from '@whiteboard/core'
import { getPlatformInfo } from '../shortcuts/shortcutManager'
import type { EdgeConnectState, HistoryState, InteractionState, SelectionState } from 'types/state'
import { docAtom } from './whiteboardContextAtoms'

const createNodeSelectionState = (): SelectionState => ({
  selectedNodeIds: new Set<NodeId>(),
  isSelecting: false,
  mode: 'replace',
  selectionRect: undefined,
  selectionRectWorld: undefined
})

const createHistoryState = (): HistoryState => ({
  canUndo: false,
  canRedo: false,
  undoDepth: 0,
  redoDepth: 0,
  isApplying: false,
  lastUpdatedAt: undefined
})

export const platformAtom = atom<ReturnType<typeof getPlatformInfo>>(getPlatformInfo())

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

export const spacePressedAtom = atom<boolean>(false)

export const toolAtom = atom<string>('select')

export const nodeSelectionAtom = atom<SelectionState>(createNodeSelectionState())

export const edgeSelectionAtom = atom<EdgeId | undefined>(undefined)

export const historyAtom = atom<HistoryState>(createHistoryState())

const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

export const viewportAtom = atom<Viewport>((get) => {
  const doc = get(docAtom)
  const viewport = doc?.viewport
  if (!viewport) return DEFAULT_VIEWPORT

  return {
    center: {
      x: viewport.center?.x ?? DEFAULT_VIEWPORT.center.x,
      y: viewport.center?.y ?? DEFAULT_VIEWPORT.center.y
    },
    zoom: viewport.zoom ?? DEFAULT_VIEWPORT.zoom
  }
})

export const edgeConnectAtom = atom<EdgeConnectState>({
  isConnecting: false
})

export const edgeConnectTransientAtom = edgeConnectAtom
