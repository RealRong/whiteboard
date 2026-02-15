import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'
import { applySelection } from '../../state/internal/selectionState'

export const createSelection = (instance: Instance): Commands['selection'] => {
  const { read, write } = instance.state

  return {
    select: (ids, mode = 'replace') => {
      write('edgeSelection', undefined)
      write('routingDrag', {})
      write('selection', (prev) => ({
        ...prev,
        mode,
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, mode)
      }))
    },
    toggle: (ids) => {
      write('edgeSelection', undefined)
      write('routingDrag', {})
      write('selection', (prev) => ({
        ...prev,
        mode: 'toggle',
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, 'toggle')
      }))
    },
    clear: () => {
      write('edgeSelection', undefined)
      write('routingDrag', {})
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
      write('routingDrag', {})
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
