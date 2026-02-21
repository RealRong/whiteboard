import type { SelectionMode } from '@engine-types/state'

type SelectionModifiers = {
  alt: boolean
  shift: boolean
  ctrl: boolean
  meta: boolean
}

export const resolveSelectionMode = (modifiers: SelectionModifiers): SelectionMode => {
  if (modifiers.alt) return 'subtract'
  if (modifiers.meta || modifiers.ctrl) return 'toggle'
  if (modifiers.shift) return 'add'
  return 'replace'
}
