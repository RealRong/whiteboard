import type { Rect } from '@whiteboard/core/types'
import { createValueDraftStore, useValueDraft } from './shared/valueStore'
import { isRectEqual } from '../utils/equality'

export type SelectionDraftStore = {
  get: () => Rect | undefined
  subscribe: (listener: () => void) => () => void
  write: (rect: Rect | undefined) => void
  clear: () => void
}

export type SelectionReader =
  Pick<SelectionDraftStore, 'get' | 'subscribe'>

export type SelectionWriter =
  Pick<SelectionDraftStore, 'write' | 'clear'>

export const useSelectionDraft = (
  selection: SelectionReader
) => useValueDraft(selection, () => undefined)

export { isRectEqual as isSelectionRectEqual }

export const createSelectionDraftStore = (
  schedule: () => void
) => {
  const { flush, ...selection } = createValueDraftStore({
    schedule,
    initialValue: undefined as Rect | undefined,
    isEqual: isRectEqual
  })

  return {
    selection,
    flush
  }
}
