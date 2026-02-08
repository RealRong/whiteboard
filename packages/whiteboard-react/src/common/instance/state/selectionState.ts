import type { NodeId } from '@whiteboard/core'
import type { SelectionMode } from 'types/state'

export const applySelection = (prevSelectedIds: Set<NodeId>, ids: NodeId[], mode: SelectionMode): Set<NodeId> => {
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
