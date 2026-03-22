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
  pathPoints?: readonly Point[]
  activePathIndex?: number
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

type EdgeHintStore =
  Pick<StagedValueStore<EdgeHint>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

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
      pathPoints: entry.pathPoints,
      activePathIndex: entry.activePathIndex
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

  if (patch.pathPoints) {
    const points = next.path?.points ?? []
    if (patch.pathPoints !== points) {
      next = {
        ...next,
        path: {
          ...(next.path ?? {}),
          points: [...patch.pathPoints]
        }
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

  const hint = createStagedValueStore({
    schedule,
    initial: EMPTY_HINT,
    isEqual: isHintEqual
  })
  const patch = createStagedKeyedStore({
    schedule,
    emptyState: EMPTY_PATCH_MAP,
    emptyValue: EMPTY_PATCH,
    build: toPatchMap,
    isEqual: (left, right) => (
      isEdgeEndPatchEqual(left.source, right.source)
      && isEdgeEndPatchEqual(left.target, right.target)
      && left.pathPoints === right.pathPoints
      && left.activePathIndex === right.activePathIndex
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

export const toPatchEntry = (
  edgeId: EdgeId,
  patch: CoreEdgePatch,
  activePathIndex?: number
): EdgePatchEntry => ({
  id: edgeId,
  source: patch.source,
  target: patch.target,
  pathPoints: patch.path?.points,
  activePathIndex
})

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
