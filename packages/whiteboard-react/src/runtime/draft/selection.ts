import type { Rect } from '@whiteboard/core/types'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import { isRectEqual } from '../utils/equality'
import { useStoreValue } from '../hooks'

export type SelectionDraftStore =
  Pick<StagedValueStore<Rect | undefined>, 'get' | 'subscribe' | 'write' | 'clear'>

export type SelectionReader =
  Pick<SelectionDraftStore, 'get' | 'subscribe'>

export type SelectionWriter =
  Pick<SelectionDraftStore, 'write' | 'clear'>

export const useSelectionDraft = (
  selection: SelectionReader
) => useStoreValue(selection)

export { isRectEqual as isSelectionRectEqual }

export const createSelectionDraftStore = (
  schedule: () => void
) => {
  const { flush, ...selection } = createStagedValueStore({
    schedule,
    initial: undefined as Rect | undefined,
    isEqual: isRectEqual
  })

  return {
    selection,
    flush
  }
}
