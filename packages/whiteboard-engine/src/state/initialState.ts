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
    selectedEdgeId: undefined,
    mode: 'replace'
  },
  mindmapLayout: { ...DEFAULT_CONFIG.mindmapLayout }
})
