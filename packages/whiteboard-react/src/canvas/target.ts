import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { EditField } from '../runtime/edit'

export const CanvasContentIgnoreSelector = [
  '[data-selection-ignore]',
  '[data-input-ignore]',
  '[data-input-role]',
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])'
].join(', ')

const CanvasEntitySelector = [
  '[data-node-id]',
  '[data-edge-id]'
].join(', ')

export const readElementNodeId = (
  targetElement: Element | null
): NodeId | undefined => (
  targetElement
    ?.closest('[data-node-id]')
    ?.getAttribute('data-node-id')
    ?? undefined
)

export const readElementEdgeId = (
  targetElement: Element | null
): EdgeId | undefined => (
  targetElement
    ?.closest('[data-edge-id]')
    ?.getAttribute('data-edge-id')
    ?? undefined
)

export const readEditableFieldTarget = (
  target: EventTarget | null
): EditField | undefined => {
  if (!(target instanceof Element)) return undefined

  const value = target
    .closest('[data-node-editable-field]')
    ?.getAttribute('data-node-editable-field')

  return value === 'text' || value === 'title'
    ? value
    : undefined
}

export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target.closest('[contenteditable]:not([contenteditable="false"])')) return true
  return target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
}

export const isInputIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-input-ignore]'))

export const isSelectionIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-selection-ignore]'))

export const isContextMenuIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-context-menu-ignore]'))

export const isCanvasContentIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest(CanvasContentIgnoreSelector))

export const isNodeEditableDisplayTarget = (target: EventTarget | null) =>
  readEditableFieldTarget(target) !== undefined

export const isBackgroundPointerTarget = ({
  target,
  currentTarget,
  activeContainerId
}: {
  target: EventTarget | null
  currentTarget: HTMLDivElement
  activeContainerId?: NodeId
}) => (
  target instanceof Element
  && currentTarget.contains(target)
  && !target.closest(CanvasContentIgnoreSelector)
  && (() => {
    const entity = target.closest(CanvasEntitySelector)
    if (!entity) return true
    if (entity.hasAttribute('data-edge-id')) return false
    return activeContainerId !== undefined
      && entity.getAttribute('data-node-id') === activeContainerId
  })()
)
