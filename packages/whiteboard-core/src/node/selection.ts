export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export type SelectionModifiers = {
  alt: boolean
  shift: boolean
  ctrl: boolean
  meta: boolean
}

type SelectionModifierEventLike = {
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

const toSelectionModifiers = (
  modifiers: SelectionModifiers | SelectionModifierEventLike
): SelectionModifiers => {
  if ('alt' in modifiers) {
    return modifiers
  }
  return {
    alt: modifiers.altKey,
    shift: modifiers.shiftKey,
    ctrl: modifiers.ctrlKey,
    meta: modifiers.metaKey
  }
}

export const resolveSelectionMode = (
  modifiers: SelectionModifiers | SelectionModifierEventLike
): SelectionMode => {
  const normalized = toSelectionModifiers(modifiers)
  if (normalized.alt) return 'subtract'
  if (normalized.meta || normalized.ctrl) return 'toggle'
  if (normalized.shift) return 'add'
  return 'replace'
}

export const applySelection = <T>(
  prevSelectedIds: Set<T>,
  ids: T[],
  mode: SelectionMode
): Set<T> => {
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
