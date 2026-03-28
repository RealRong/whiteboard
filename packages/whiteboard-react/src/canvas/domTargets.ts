export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) return true
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
}

export const isInputIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-input-ignore]'))

export const isKeyboardIgnoredTarget = (target: EventTarget | null) =>
  isEditableTarget(target) || isInputIgnoredTarget(target)

export const isContextMenuIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-context-menu-ignore]'))
