import type { Guide } from '@whiteboard/core/node'
import { createValueDraftStore, useValueDraft } from './shared/valueStore'

export const EMPTY_GUIDES: readonly Guide[] = []

export type GuidesDraftStore = {
  get: () => readonly Guide[]
  subscribe: (listener: () => void) => () => void
  write: (guides: readonly Guide[]) => void
  clear: () => void
}

export type GuidesReader =
  Pick<GuidesDraftStore, 'get' | 'subscribe'>

export type GuidesWriter =
  Pick<GuidesDraftStore, 'write' | 'clear'>

export const useGuidesDraft = (
  guides: GuidesReader
) => useValueDraft(guides, () => EMPTY_GUIDES)

export const normalizeGuides = (
  guides: readonly Guide[]
): readonly Guide[] => guides.length ? guides : EMPTY_GUIDES

export const createGuidesDraftStore = (
  schedule: () => void
) => {
  const store = createValueDraftStore({
    schedule,
    initialValue: EMPTY_GUIDES,
    isEqual: (left, right) => left === right
  })

  return {
    guides: {
      get: store.get,
      subscribe: store.subscribe,
      write: (next: readonly Guide[]) => {
        store.write(normalizeGuides(next))
      },
      clear: store.clear
    },
    flush: () => {
      store.flush()
    }
  }
}
