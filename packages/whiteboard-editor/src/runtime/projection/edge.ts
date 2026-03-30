import {
  createRafKeyedStore,
  createRafValueStore,
  type StagedKeyedStore,
  type StagedValueStore
} from '@whiteboard/engine'
import {
  EMPTY_EDGE_PROJECTION_PATCH,
  isEdgeProjectionHintEqual,
  isEdgeProjectionPatchEqual,
  toEdgeProjectionPatchEntry,
  type EdgeProjectionHint,
  type EdgeProjectionPatch,
  type EdgeProjectionPatchEntry
} from '@whiteboard/core/edge'
import type {
  EdgeId,
  EdgePatch as CoreEdgePatch,
  Point
} from '@whiteboard/core/types'

type EdgeProjectionPatchMap = ReadonlyMap<EdgeId, EdgeProjectionPatch>

type EdgeProjectionPatchStore =
  Pick<StagedKeyedStore<EdgeId, EdgeProjectionPatch, readonly EdgeProjectionPatchEntry[]>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type EdgeProjectionPatchReader =
  Pick<EdgeProjectionPatchStore, 'get' | 'subscribe'>

type EdgeProjectionHintValueStore = StagedValueStore<EdgeProjectionHint>

type EdgeProjectionHintStore =
  Pick<EdgeProjectionHintValueStore, 'get' | 'subscribe' | 'clear' | 'flush'> & {
    set: (next?: EdgeProjectionHint) => void
  }

export type EdgeProjectionRuntime = {
  patch: EdgeProjectionPatchStore
  hint: EdgeProjectionHintStore
  emptyPatch: EdgeProjectionPatch
  writeEntries: (
    entries: readonly EdgeProjectionPatchEntry[]
  ) => void
  clearPatch: () => void
  writePatch: (
    edgeId: EdgeId,
    patch: CoreEdgePatch,
    activeRouteIndex?: number
  ) => void
  writeRoute: (
    edgeId: EdgeId,
    points: readonly Point[],
    activeRouteIndex?: number
  ) => void
  writeHint: (next?: EdgeProjectionHint) => void
  clearHint: () => void
  clear: () => void
}

const EMPTY_HINT: EdgeProjectionHint = {}
const EMPTY_PATCH_MAP: EdgeProjectionPatchMap =
  new Map<EdgeId, EdgeProjectionPatch>()

const toPatchMap = (
  entries: readonly EdgeProjectionPatchEntry[]
): EdgeProjectionPatchMap => {
  if (!entries.length) {
    return EMPTY_PATCH_MAP
  }

  const next = new Map<EdgeId, EdgeProjectionPatch>()
  entries.forEach((entry) => {
    next.set(entry.id, {
      source: entry.source,
      target: entry.target,
      route: entry.route,
      activeRouteIndex: entry.activeRouteIndex
    })
  })
  return next
}

export const createEdgeProjectionRuntime = (): EdgeProjectionRuntime => {
  const hintValue = createRafValueStore({
    initial: EMPTY_HINT,
    isEqual: isEdgeProjectionHintEqual
  })
  const hint: EdgeProjectionHintStore = {
    get: hintValue.get,
    subscribe: hintValue.subscribe,
    clear: hintValue.clear,
    flush: hintValue.flush,
    set: (next) => {
      if (!next) {
        hintValue.clear()
        return
      }

      hintValue.write(next)
    }
  }
  const patch = createRafKeyedStore({
    emptyState: EMPTY_PATCH_MAP,
    emptyValue: EMPTY_EDGE_PROJECTION_PATCH,
    build: toPatchMap,
    isEqual: isEdgeProjectionPatchEqual
  })

  const writeEntries: EdgeProjectionRuntime['writeEntries'] = (
    entries
  ) => {
    patch.write(entries)
  }

  const clearPatch: EdgeProjectionRuntime['clearPatch'] = () => {
    patch.clear()
  }

  const writePatch: EdgeProjectionRuntime['writePatch'] = (
    edgeId,
    nextPatch,
    activeRouteIndex
  ) => {
    writeEntries([
      toEdgeProjectionPatchEntry(edgeId, nextPatch, activeRouteIndex)
    ])
  }

  const writeRoute: EdgeProjectionRuntime['writeRoute'] = (
    edgeId,
    points,
    activeRouteIndex
  ) => {
    writePatch(
      edgeId,
      {
        route: {
          kind: 'manual',
          points: [...points]
        }
      },
      activeRouteIndex
    )
  }

  const writeHint: EdgeProjectionRuntime['writeHint'] = (
    next
  ) => {
    if (!next) {
      hint.clear()
      return
    }

    hint.set(next)
  }

  const clearHint: EdgeProjectionRuntime['clearHint'] = () => {
    hint.clear()
  }

  return {
    patch,
    hint,
    emptyPatch: EMPTY_EDGE_PROJECTION_PATCH,
    writeEntries,
    clearPatch,
    writePatch,
    writeRoute,
    writeHint,
    clearHint,
    clear: () => {
      clearPatch()
      clearHint()
    }
  }
}

export const writeEdgeProjectionPatch = (
  projection: Pick<EdgeProjectionRuntime, 'writeEntries'>,
  edgeId: EdgeId,
  patch: CoreEdgePatch,
  activeRouteIndex?: number
) => {
  projection.writeEntries([
    toEdgeProjectionPatchEntry(edgeId, patch, activeRouteIndex)
  ])
}

export const writeEdgeProjectionRoute = (
  projection: Pick<EdgeProjectionRuntime, 'writeEntries'>,
  edgeId: EdgeId,
  points: readonly Point[],
  activeRouteIndex?: number
) => {
  writeEdgeProjectionPatch(
    projection,
    edgeId,
    {
      route: {
        kind: 'manual',
        points: [...points]
      }
    },
    activeRouteIndex
  )
}

export const writeEdgeProjectionHint = (
  projection: Pick<EdgeProjectionRuntime, 'writeHint'>,
  next?: EdgeProjectionHint
) => {
  projection.writeHint(next)
}

export const clearEdgeProjectionPatch = (
  projection: Pick<EdgeProjectionRuntime, 'clearPatch'>
) => {
  projection.clearPatch()
}

export const clearEdgeProjectionHint = (
  projection: Pick<EdgeProjectionRuntime, 'clearHint'>
) => {
  projection.clearHint()
}
