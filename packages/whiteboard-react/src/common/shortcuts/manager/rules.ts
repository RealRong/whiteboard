import type { Shortcut, ShortcutContext } from 'types/shortcuts'

export type Candidate = {
  shortcut: Shortcut
  complexity: number
}

export const isShortcutEnabled = (shortcut: Shortcut, ctx: ShortcutContext) => {
  if (shortcut.when && !shortcut.when(ctx)) return false
  if (ctx.focus.isEditingText || ctx.focus.isInputFocused) {
    return Boolean(shortcut.allowWhenEditing)
  }
  return true
}

export const compareCandidates = (a: Candidate, b: Candidate) => {
  const priorityDelta = (b.shortcut.priority ?? 0) - (a.shortcut.priority ?? 0)
  if (priorityDelta !== 0) return priorityDelta
  return b.complexity - a.complexity
}

export const getPointerComplexity = (shortcut: Shortcut) => {
  const rule = shortcut.pointer
  if (!rule) return 0
  return (
    Number(Boolean(rule.alt)) +
    Number(Boolean(rule.shift)) +
    Number(Boolean(rule.ctrl)) +
    Number(Boolean(rule.meta))
  )
}
