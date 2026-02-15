import type { WhiteboardCommands } from '@engine-types/commands'
import type { WhiteboardInstance } from '@engine-types/instance'
import { applySelection } from '../state/selectionState'

export const createSelectionCommands = (instance: WhiteboardInstance): WhiteboardCommands['selection'] => {
  const { read, write } = instance.state

  return {
    select: (ids, mode = 'replace') => {
      write('edgeSelection', undefined)
      write('edgeRoutingPointDrag', {})
      write('selection', (prev) => ({
        ...prev,
        mode,
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, mode)
      }))
    },
    toggle: (ids) => {
      write('edgeSelection', undefined)
      write('edgeRoutingPointDrag', {})
      write('selection', (prev) => ({
        ...prev,
        mode: 'toggle',
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, 'toggle')
      }))
    },
    clear: () => {
      write('edgeSelection', undefined)
      write('edgeRoutingPointDrag', {})
      write('selection', (prev) => ({
        ...prev,
        selectedNodeIds: new Set(),
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    },
    getSelectedNodeIds: () => Array.from(read('selection').selectedNodeIds),
    beginBox: (mode = 'replace') => {
      write('edgeSelection', undefined)
      write('edgeRoutingPointDrag', {})
      write('selection', (prev) => ({
        ...prev,
        mode,
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    },
    updateBox: (selectionRect, selectionRectWorld) => {
      write('selection', (prev) => ({
        ...prev,
        isSelecting: true,
        selectionRect,
        selectionRectWorld
      }))
    },
    endBox: () => {
      write('selection', (prev) => ({
        ...prev,
        isSelecting: false,
        selectionRect: undefined,
        selectionRectWorld: undefined
      }))
    }
  }
}
