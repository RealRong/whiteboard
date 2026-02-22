import type { NodeId } from '@whiteboard/core/types'
import type { WritableStateSnapshot } from '@engine-types/instance/state'
import { DEFAULT_CONFIG } from '../config'

export const createInitialState = (): WritableStateSnapshot => ({
  interaction: {
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
  },
  tool: DEFAULT_CONFIG.tool,
  selection: {
    selectedNodeIds: new Set<NodeId>(),
    isSelecting: false,
    mode: 'replace',
    selectionRect: undefined,
    selectionRectWorld: undefined
  },
  edgeSelection: undefined,
  history: {
    canUndo: false,
    canRedo: false,
    undoDepth: 0,
    redoDepth: 0,
    isApplying: false,
    lastUpdatedAt: undefined
  },
  edgeConnect: { isConnecting: false },
  routingDrag: {},
  mindmapLayout: { ...DEFAULT_CONFIG.mindmapLayout },
  mindmapDrag: {},
  nodeDrag: {},
  nodeTransform: {},
  spacePressed: false,
  dragGuides: [],
  groupHovered: undefined
})
