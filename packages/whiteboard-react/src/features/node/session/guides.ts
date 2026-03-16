import type { Guide } from '@whiteboard/core/node'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import { useStoreValue } from '../../../runtime/hooks'

export type GuidesSessionStore =
  Pick<StagedValueStore<readonly Guide[]>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type GuidesSessionReader =
  Pick<GuidesSessionStore, 'get' | 'subscribe'>

export type GuidesSessionWriter =
  Pick<GuidesSessionStore, 'write' | 'clear'>

const EMPTY_GUIDES: readonly Guide[] = []

const normalizeGuides = (
  guides: readonly Guide[]
): readonly Guide[] => guides.length ? guides : EMPTY_GUIDES

export const createGuidesSessionStore = (
  schedule: () => void
) => {
  const store = createStagedValueStore({
    schedule,
    initial: EMPTY_GUIDES,
    isEqual: (left, right) => left === right
  })

  return {
    get: store.get,
    subscribe: store.subscribe,
    write: (next: readonly Guide[]) => {
      store.write(normalizeGuides(next))
    },
    clear: store.clear,
    flush: store.flush
  }
}

export const useGuidesSession = (
  store: GuidesSessionReader
) => useStoreValue(store)
