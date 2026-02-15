import { atom } from 'jotai'
import type { PrimitiveAtom } from 'jotai'
import type { EdgeId, NodeId, Viewport } from '@whiteboard/core'
import type {
  EdgeConnectState,
  EdgeRoutingPointDragState,
  HistoryState,
  InteractionState,
  MindmapDragState,
  NodeDragState,
  NodeTransformState,
  SelectionState
} from '@engine-types/state'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
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

const createInteractionState = (): InteractionState => ({
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

const createMindmapDragState = (): MindmapDragState => ({})
const createNodeDragState = (): NodeDragState => ({})
const createNodeTransformState = (): NodeTransformState => ({})

type WritableStateInitializers = {
  interaction: () => InteractionState
  tool: () => string
  selection: () => SelectionState
  edgeSelection: () => EdgeId | undefined
  history: () => HistoryState
  edgeConnect: () => EdgeConnectState
  edgeRoutingPointDrag: () => EdgeRoutingPointDragState
  mindmapLayout: () => MindmapLayoutConfig
  mindmapDrag: () => MindmapDragState
  nodeDrag: () => NodeDragState
  nodeTransform: () => NodeTransformState
  spacePressed: () => boolean
}

const createAtomsFromInitializers = <T extends Record<string, () => unknown>>(initializers: T) => {
  const keys = Object.keys(initializers) as Array<keyof T>
  return Object.fromEntries(keys.map((key) => [key, atom(initializers[key]())])) as unknown as {
    [K in keyof T]: PrimitiveAtom<ReturnType<T[K]>>
  }
}

const writableStateInitializers: WritableStateInitializers = {
  interaction: createInteractionState,
  tool: () => 'select',
  selection: createNodeSelectionState,
  edgeSelection: () => undefined,
  history: createHistoryState,
  edgeConnect: () => ({ isConnecting: false }),
  edgeRoutingPointDrag: () => ({}),
  mindmapLayout: () => ({}),
  mindmapDrag: createMindmapDragState,
  nodeDrag: createNodeDragState,
  nodeTransform: createNodeTransformState,
  spacePressed: () => false
}

export const writableStateAtoms = createAtomsFromInitializers(writableStateInitializers)

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
