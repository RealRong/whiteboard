import type { NodeId } from '@whiteboard/core/types'
import type { WritableStateSnapshot } from '@engine-types/instance/state'
import type { WritableRenderSnapshot } from '@engine-types/instance/render'
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
    selectedEdgeId: undefined,
    mode: 'replace'
  },
  mindmapLayout: { ...DEFAULT_CONFIG.mindmapLayout }
})

export const createInitialRenderState = (): WritableRenderSnapshot => ({
  interactionSession: {},
  selectionBox: {
    isSelecting: false,
    selectionRect: undefined,
    selectionRectWorld: undefined
  },
  edgeConnect: {},
  routingDrag: {},
  viewportGesture: {},
  mindmapDrag: {},
  nodeDrag: {},
  nodePreview: {
    updates: []
  },
  spacePressed: false,
  dragGuides: [],
  groupHover: {}
})
