import type { Rect } from '@whiteboard/core/types'
import { createValueDraftStore, useValueDraft } from './shared/valueStore'
import { isRectEqual } from '../utils/equality'

export type TransientSelection = {
  get: () => Rect | undefined
  subscribe: (listener: () => void) => () => void
  write: (rect: Rect | undefined) => void
  clear: () => void
}

export type SelectionReader =
  Pick<TransientSelection, 'get' | 'subscribe'>

export type SelectionWriter =
  Pick<TransientSelection, 'write' | 'clear'>

export const useTransientSelection = (
  selection: SelectionReader
) => useValueDraft(selection, () => undefined)

export { isRectEqual as isSelectionRectEqual }

export const createTransientSelection = (
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
