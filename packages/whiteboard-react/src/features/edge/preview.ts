import {
  createStagedKeyedStore,
  createStagedValueStore,
  type StagedKeyedStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeItem } from '@whiteboard/core/read'
import type {
  EdgeEnd,
  EdgeId,
  EdgePatch as CoreEdgePatch,
  Point
} from '@whiteboard/core/types'
import { createRafTask, type RafTask } from '../../runtime/utils/rafTask'

export type EdgeHint = {
  line?: {
    from: Point
    to: Point
  }
  snap?: Point
}

type EdgePatch = {
  source?: EdgeItem['edge']['source']
  target?: EdgeItem['edge']['target']
  route?: EdgeItem['edge']['route']
  activeRouteIndex?: number
}

type EdgePatchEntry =
  EdgePatch & {
    id: EdgeId
  }

type PatchMap = ReadonlyMap<EdgeId, EdgePatch>

type EdgePatchStore =
  Pick<StagedKeyedStore<EdgeId, EdgePatch, readonly EdgePatchEntry[]>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type EdgePatchReader =
  Pick<EdgePatchStore, 'get' | 'subscribe'>

type EdgeHintValueStore = StagedValueStore<EdgeHint>

type EdgeHintStore =
  Pick<EdgeHintValueStore, 'get' | 'subscribe' | 'clear' | 'flush'> & {
    set: (next?: EdgeHint) => void
  }

export type EdgePreview = {
  patch: EdgePatchStore
  hint: EdgeHintStore
  clear: () => void
}

const EMPTY_HINT: EdgeHint = {}
export const EMPTY_PATCH: EdgePatch = {}
const EMPTY_PATCH_MAP: PatchMap =
  new Map<EdgeId, EdgePatch>()

const isHintEqual = (
  left: EdgeHint,
  right: EdgeHint
) => (
  isPointEqual(left.line?.from, right.line?.from)
  && isPointEqual(left.line?.to, right.line?.to)
  && isPointEqual(left.snap, right.snap)
)

const toPatchMap = (
  entries: readonly EdgePatchEntry[]
): PatchMap => {
  if (!entries.length) {
    return EMPTY_PATCH_MAP
  }

  const next = new Map<EdgeId, EdgePatch>()
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
  patch: EdgePatch
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

export const createEdgePreview = (): EdgePreview => {
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
  const hint: EdgeHintStore = {
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
    emptyValue: EMPTY_PATCH,
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

  return {
    patch,
    hint,
    clear: () => {
      task.cancel()
      patch.clear()
      hint.clear()
    }
  }
}

export const toEdgePreviewEntry = (
  edgeId: EdgeId,
  patch: CoreEdgePatch,
  activeRouteIndex?: number
): EdgePatchEntry => ({
  id: edgeId,
  source: patch.source,
  target: patch.target,
  route: patch.route,
  activeRouteIndex
})

export const writeEdgePreviewPatch = (
  preview: EdgePreview,
  edgeId: EdgeId,
  patch: CoreEdgePatch,
  activeRouteIndex?: number
) => {
  preview.patch.write([
    toEdgePreviewEntry(edgeId, patch, activeRouteIndex)
  ])
}

export const writeEdgePreviewRoute = (
  preview: EdgePreview,
  edgeId: EdgeId,
  points: readonly Point[],
  activeRouteIndex?: number
) => {
  writeEdgePreviewPatch(
    preview,
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
  patch: EdgePatch
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
