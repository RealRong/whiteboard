import {
  createRafKeyedStore,
  type KeyedReadStore,
  type StagedKeyedStore
} from '@whiteboard/engine'
import { isEdgePatchEqual } from '@whiteboard/core/edge'
import type { EdgeId, EdgePatch } from '@whiteboard/core/types'

export type EdgeTransientEntry = {
  id: EdgeId
  patch?: EdgePatch
  activeRouteIndex?: number
}

export type EdgeTransientProjection = {
  patch?: EdgePatch
  activeRouteIndex?: number
}

export type EdgeTransientRuntime = {
  set: (entries: readonly EdgeTransientEntry[]) => void
  clear: () => void
}

export type EdgeTransientReader =
  KeyedReadStore<EdgeId, EdgeTransientProjection>

type EdgeTransientStore =
  Pick<StagedKeyedStore<EdgeId, EdgeTransientProjection, readonly EdgeTransientEntry[]>, 'get' | 'subscribe' | 'write' | 'clear'>

const EMPTY_EDGE_TRANSIENT_PROJECTION: EdgeTransientProjection = {}
const EMPTY_EDGE_TRANSIENT_MAP = new Map<EdgeId, EdgeTransientProjection>()

const toEdgeTransientMap = (
  entries: readonly EdgeTransientEntry[]
) => {
  if (!entries.length) {
    return EMPTY_EDGE_TRANSIENT_MAP
  }

  const next = new Map<EdgeId, EdgeTransientProjection>()

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!
    if (!entry.patch && entry.activeRouteIndex === undefined) {
      continue
    }

    next.set(entry.id, {
      patch: entry.patch,
      activeRouteIndex: entry.activeRouteIndex
    })
  }

  return next.size > 0
    ? next
    : EMPTY_EDGE_TRANSIENT_MAP
}

export const createEdgeTransient = (): {
  runtime: EdgeTransientRuntime
  reader: EdgeTransientReader
} => {
  const store: EdgeTransientStore = createRafKeyedStore({
    emptyState: EMPTY_EDGE_TRANSIENT_MAP,
    emptyValue: EMPTY_EDGE_TRANSIENT_PROJECTION,
    build: toEdgeTransientMap,
    isEqual: (left, right) => (
      isEdgePatchEqual(left.patch, right.patch)
      && left.activeRouteIndex === right.activeRouteIndex
    )
  })

  return {
    runtime: {
      set: store.write,
      clear: store.clear
    },
    reader: {
      get: store.get,
      subscribe: store.subscribe
    }
  }
}
