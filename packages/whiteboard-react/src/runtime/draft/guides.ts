import type { Guide } from '@whiteboard/core/node'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import { useStoreValue } from '../hooks'

const EMPTY_GUIDES: readonly Guide[] = []

export type GuidesDraftStore =
  Pick<StagedValueStore<readonly Guide[]>, 'get' | 'subscribe' | 'write' | 'clear'>

export type GuidesReader =
  Pick<GuidesDraftStore, 'get' | 'subscribe'>

export type GuidesWriter =
  Pick<GuidesDraftStore, 'write' | 'clear'>

export const useGuidesDraft = (
  guides: GuidesReader
) => useStoreValue(guides)

const normalizeGuides = (
  guides: readonly Guide[]
): readonly Guide[] => guides.length ? guides : EMPTY_GUIDES

export const createGuidesDraftStore = (
  schedule: () => void
) => {
  const store = createStagedValueStore({
    schedule,
    initial: EMPTY_GUIDES,
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
