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
  interactionSession: {},
  tool: DEFAULT_CONFIG.tool,
  selection: {
    selectedNodeIds: new Set<NodeId>(),
    selectedEdgeId: undefined,
    groupHovered: undefined,
    isSelecting: false,
    mode: 'replace',
    selectionRect: undefined,
    selectionRectWorld: undefined
  },
  edgeConnect: {},
  routingDrag: {},
  mindmapLayout: { ...DEFAULT_CONFIG.mindmapLayout },
  mindmapDrag: {},
  nodeDrag: {},
  nodeTransform: {},
  spacePressed: false,
  dragGuides: []
})
