import type { EdgeId, NodeId } from '@whiteboard/core'
import type { WritableStateSnapshot } from '@engine-types/instance/state'
import type {
  EdgeConnectState,
  RoutingDragState,
  HistoryState,
  InteractionState,
  MindmapDragState,
  NodeDragState,
  NodeOverride,
  NodeTransformState,
  SelectionState
} from '@engine-types/state'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { Guide } from '@engine-types/node/snap'

const createSelection = (): SelectionState => ({
  selectedNodeIds: new Set<NodeId>(),
  isSelecting: false,
  mode: 'replace',
  selectionRect: undefined,
  selectionRectWorld: undefined
})

const createHistory = (): HistoryState => ({
  canUndo: false,
  canRedo: false,
  undoDepth: 0,
  redoDepth: 0,
  isApplying: false,
  lastUpdatedAt: undefined
})

const createInteraction = (): InteractionState => ({
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

const createMindmapDrag = (): MindmapDragState => ({})
const createNodeDrag = (): NodeDragState => ({})
const createNodeTransform = (): NodeTransformState => ({})

type WritableStateInitializers = {
  interaction: () => InteractionState
  tool: () => 'select' | 'edge'
  selection: () => SelectionState
  edgeSelection: () => EdgeId | undefined
  history: () => HistoryState
  edgeConnect: () => EdgeConnectState
  routingDrag: () => RoutingDragState
  mindmapLayout: () => MindmapLayoutConfig
  mindmapDrag: () => MindmapDragState
  nodeDrag: () => NodeDragState
  nodeTransform: () => NodeTransformState
  spacePressed: () => boolean
  dragGuides: () => Guide[]
  groupHovered: () => NodeId | undefined
  nodeOverrides: () => Map<NodeId, NodeOverride>
}

const writableStateInitializers: WritableStateInitializers = {
  interaction: createInteraction,
  tool: () => 'select',
  selection: createSelection,
  edgeSelection: () => undefined,
  history: createHistory,
  edgeConnect: () => ({ isConnecting: false }),
  routingDrag: () => ({}),
  mindmapLayout: () => ({}),
  mindmapDrag: createMindmapDrag,
  nodeDrag: createNodeDrag,
  nodeTransform: createNodeTransform,
  spacePressed: () => false,
  dragGuides: () => [],
  groupHovered: () => undefined,
  nodeOverrides: () => new Map<NodeId, NodeOverride>()
}

export const createWritableStateSnapshot = (): WritableStateSnapshot => ({
  interaction: writableStateInitializers.interaction(),
  tool: writableStateInitializers.tool(),
  selection: writableStateInitializers.selection(),
  edgeSelection: writableStateInitializers.edgeSelection(),
  history: writableStateInitializers.history(),
  edgeConnect: writableStateInitializers.edgeConnect(),
  routingDrag: writableStateInitializers.routingDrag(),
  mindmapLayout: writableStateInitializers.mindmapLayout(),
  mindmapDrag: writableStateInitializers.mindmapDrag(),
  nodeDrag: writableStateInitializers.nodeDrag(),
  nodeTransform: writableStateInitializers.nodeTransform(),
  spacePressed: writableStateInitializers.spacePressed(),
  dragGuides: writableStateInitializers.dragGuides(),
  groupHovered: writableStateInitializers.groupHovered(),
  nodeOverrides: writableStateInitializers.nodeOverrides()
})
