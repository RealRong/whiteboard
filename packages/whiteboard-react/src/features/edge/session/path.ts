import {
  createStagedKeyedStore,
  type StagedKeyedStore
} from '@whiteboard/core/runtime'
import { isPointEqual } from '@whiteboard/core/geometry'
import type { EdgeItem } from '@whiteboard/core/read'
import type { EdgeEnd, EdgeId, Point } from '@whiteboard/core/types'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'

type EdgePathSessionMap = ReadonlyMap<EdgeId, EdgePathSession>

type EdgePathPatch = {
  source?: EdgeItem['edge']['source']
  target?: EdgeItem['edge']['target']
  pathPoints?: readonly Point[]
}

type EdgePathSessionWritePatch =
  EdgePathPatch & {
    id: EdgeId
    activePathIndex?: number
  }

type EdgePathSessionWrite = {
  patches: readonly EdgePathSessionWritePatch[]
}

type EdgePathSession = {
  patch?: EdgePathPatch
  activePathIndex?: number
}

export type EdgePathSessionStore =
  Pick<StagedKeyedStore<EdgeId, EdgePathSession, EdgePathSessionWrite>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type EdgePathSessionReader =
  Pick<EdgePathSessionStore, 'get' | 'subscribe'>

const EMPTY_EDGE_PATH_SESSION: EdgePathSession = {}

const EMPTY_EDGE_MAP: EdgePathSessionMap =
  new Map<EdgeId, EdgePathSession>()

const toEdgePathSessionMap = ({
  patches
}: EdgePathSessionWrite): EdgePathSessionMap => {
  if (!patches.length) {
    return EMPTY_EDGE_MAP
  }

  const next = new Map<EdgeId, EdgePathSession>()
  patches.forEach((patch) => {
    next.set(patch.id, {
      patch: patch.source || patch.target || patch.pathPoints
        ? {
            source: patch.source,
            target: patch.target,
            pathPoints: patch.pathPoints
          }
        : undefined,
      activePathIndex: patch.activePathIndex
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

export const createEdgePathSessionStore = (
  schedule: () => void
) => createStagedKeyedStore({
  schedule,
  emptyState: EMPTY_EDGE_MAP,
  emptyValue: EMPTY_EDGE_PATH_SESSION,
  build: toEdgePathSessionMap,
  isEqual: (left, right) => (
    isEdgeEndPatchEqual(left.patch?.source, right.patch?.source)
    && isEdgeEndPatchEqual(left.patch?.target, right.patch?.target)
    && left.patch?.pathPoints === right.patch?.pathPoints
    && left.activePathIndex === right.activePathIndex
  )
})

const applyPathPatch = (
  edge: EdgeItem['edge'],
  patch: EdgePathPatch | undefined
): EdgeItem['edge'] => {
  if (!patch) {
    return edge
  }

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

export const projectEdgeItem = (
  item: EdgeItem,
  session: EdgePathSession
): EdgeItem => {
  const edge = applyPathPatch(item.edge, session.patch)
  if (edge === item.edge) {
    return item
  }

  return {
    ...item,
    edge
  }
}

export const useEdgePathSession = (
  store: EdgePathSessionReader,
  edgeId: EdgeId | undefined
) => useOptionalKeyedStoreValue(store, edgeId, EMPTY_EDGE_PATH_SESSION)
