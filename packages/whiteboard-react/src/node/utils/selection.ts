import type { SelectionMode } from '../../common/state/whiteboardAtoms'

export const getSelectionModeFromEvent = (event: PointerEvent | MouseEvent): SelectionMode => {
  if (event.altKey) return 'subtract'
  if (event.metaKey || event.ctrlKey) return 'toggle'
  if (event.shiftKey) return 'add'
  return 'replace'
}

export const applySelectionMode = (
  current: Set<string>,
  ids: string[],
  mode: SelectionMode
) => {
  const next = new Set(current)
  if (mode === 'replace') {
    next.clear()
    ids.forEach((id) => next.add(id))
    return next
  }
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
    } else {
      next.add(id)
    }
  })
  return next
}
