import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import type { NodeId } from '@whiteboard/core/types'
import type { SelectionMode } from '@engine-types/state'

const applySelection = (
  prevSelectedIds: Set<NodeId>,
  ids: NodeId[],
  mode: SelectionMode
): Set<NodeId> => {
  if (mode === 'replace') {
    return new Set(ids)
  }

  const next = new Set(prevSelectedIds)
  if (mode === 'add') {
    ids.forEach((id) => next.add(id))
    return next
  }

  if (mode === 'subtract') {
    ids.forEach((id) => next.delete(id))
    return next
  }

  ids.forEach((id) => {
    if (next.has(id)) {
      next.delete(id)
      return
    }
    next.add(id)
  })
  return next
}

export const createSelection = (instance: Instance): Commands['selection'] => {
  const { read, write, batch } = instance.state

  return {
    select: (ids, mode = 'replace') => {
      batch(() => {
        write('edgeSelection', undefined)
        write('routingDrag', {})
        write('selection', (prev) => ({
          ...prev,
          mode,
          selectedNodeIds: applySelection(prev.selectedNodeIds, ids, mode)
        }))
      })
    },
    toggle: (ids) => {
      batch(() => {
        write('edgeSelection', undefined)
        write('routingDrag', {})
        write('selection', (prev) => ({
          ...prev,
          mode: 'toggle',
          selectedNodeIds: applySelection(prev.selectedNodeIds, ids, 'toggle')
        }))
      })
    },
    clear: () => {
      batch(() => {
        write('edgeSelection', undefined)
        write('routingDrag', {})
        write('selection', (prev) => ({
          ...prev,
          selectedNodeIds: new Set(),
          isSelecting: false,
          selectionRect: undefined,
          selectionRectWorld: undefined
        }))
      })
    },
    getSelectedNodeIds: () => Array.from(read('selection').selectedNodeIds),
    beginBox: (mode = 'replace') => {
      batch(() => {
        write('edgeSelection', undefined)
        write('routingDrag', {})
        write('selection', (prev) => ({
          ...prev,
          mode,
          isSelecting: false,
          selectionRect: undefined,
          selectionRectWorld: undefined
        }))
      })
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
