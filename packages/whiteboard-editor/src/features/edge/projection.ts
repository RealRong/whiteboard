import {
  createStagedKeyedStore,
  createStagedValueStore,
  type StagedKeyedStore,
  type StagedValueStore
} from '@whiteboard/engine'
import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeItem } from '@whiteboard/engine'
import type {
  EdgeEnd,
  EdgeId,
  EdgePatch as CoreEdgePatch,
  Point
} from '@whiteboard/core/types'
import { createRafTask, type RafTask } from '../../runtime/utils/rafTask'

export type EdgeProjectionHint = {
  line?: {
    from: Point
    to: Point
  }
  snap?: Point
}

export type EdgeProjectionPatch = {
  source?: EdgeItem['edge']['source']
  target?: EdgeItem['edge']['target']
  route?: EdgeItem['edge']['route']
  activeRouteIndex?: number
}

type EdgeProjectionPatchEntry =
  EdgeProjectionPatch & {
    id: EdgeId
  }

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

export type EdgeProjection = {
  patch: EdgeProjectionPatchStore
  hint: EdgeProjectionHintStore
  emptyPatch: EdgeProjectionPatch
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
  clear: () => void
}

const EMPTY_HINT: EdgeProjectionHint = {}
export const EMPTY_EDGE_PROJECTION_PATCH: EdgeProjectionPatch = {}
const EMPTY_PATCH_MAP: EdgeProjectionPatchMap =
  new Map<EdgeId, EdgeProjectionPatch>()

const isHintEqual = (
  left: EdgeProjectionHint,
  right: EdgeProjectionHint
) => (
  isPointEqual(left.line?.from, right.line?.from)
  && isPointEqual(left.line?.to, right.line?.to)
  && isPointEqual(left.snap, right.snap)
)

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

const isEdgeEndPatchEqual = (
  left: EdgeEnd | undefined,
  right: EdgeEnd | undefined
) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return left === right
  }
  if (left.kind !== right.kind) {
    return false
  }
  if (left.kind === 'point' && right.kind === 'point') {
    return isPointEqual(left.point, right.point)
  }
  if (left.kind === 'node' && right.kind === 'node') {
    return left.nodeId === right.nodeId
      && left.anchor?.side === right.anchor?.side
      && left.anchor?.offset === right.anchor?.offset
  }
  return false
}

const applyPatch = (
  edge: EdgeItem['edge'],
  patch: EdgeProjectionPatch
): EdgeItem['edge'] => {
  let next = edge

  if (patch.source && patch.source !== next.source) {
    next = {
      ...next,
      source: patch.source
    }
  }

  if (patch.target && patch.target !== next.target) {
    next = {
      ...next,
      target: patch.target
    }
  }

  if (patch.route && patch.route !== next.route) {
    next = {
      ...next,
      route:
        patch.route.kind === 'manual'
          ? {
              kind: 'manual',
              points: [...patch.route.points]
            }
          : {
              kind: 'auto'
            }
    }
  }

  return next
}

export const createEdgeProjection = (): EdgeProjection => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const hintValue = createStagedValueStore({
    schedule,
    initial: EMPTY_HINT,
    isEqual: isHintEqual
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
  const patch = createStagedKeyedStore({
    schedule,
    emptyState: EMPTY_PATCH_MAP,
    emptyValue: EMPTY_EDGE_PROJECTION_PATCH,
    build: toPatchMap,
    isEqual: (left, right) => (
      isEdgeEndPatchEqual(left.source, right.source)
      && isEdgeEndPatchEqual(left.target, right.target)
      && left.route === right.route
      && left.activeRouteIndex === right.activeRouteIndex
    )
  })

  flushAll.push(hint.flush, patch.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  const writePatch: EdgeProjection['writePatch'] = (
    edgeId,
    nextPatch,
    activeRouteIndex
  ) => {
    patch.write([
      toEdgeProjectionEntry(edgeId, nextPatch, activeRouteIndex)
    ])
  }

  const writeRoute: EdgeProjection['writeRoute'] = (
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

  return {
    patch,
    hint,
    emptyPatch: EMPTY_EDGE_PROJECTION_PATCH,
    writePatch,
    writeRoute,
    clear: () => {
      task.cancel()
      patch.clear()
      hint.clear()
    }
  }
}

export const toEdgeProjectionEntry = (
  edgeId: EdgeId,
  patch: CoreEdgePatch,
  activeRouteIndex?: number
): EdgeProjectionPatchEntry => ({
  id: edgeId,
  source: patch.source,
  target: patch.target,
  route: patch.route,
  activeRouteIndex
})

export const writeEdgeProjectionPatch = (
  projection: Pick<EdgeProjection, 'patch'>,
  edgeId: EdgeId,
  patch: CoreEdgePatch,
  activeRouteIndex?: number
) => {
  projection.patch.write([
    toEdgeProjectionEntry(edgeId, patch, activeRouteIndex)
  ])
}

export const writeEdgeProjectionRoute = (
  projection: Pick<EdgeProjection, 'patch'>,
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

export const projectEdgeItem = (
  item: EdgeItem,
  patch: EdgeProjectionPatch
): EdgeItem => {
  const edge = applyPatch(item.edge, patch)
  if (edge === item.edge) {
    return item
  }

  return {
    ...item,
    edge
  }
}
