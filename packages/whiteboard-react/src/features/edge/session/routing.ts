import {
  createStagedKeyedStore,
  type StagedKeyedStore
} from '@whiteboard/core/runtime'
import type { EdgeItem } from '@whiteboard/core/read'
import type { EdgeId, Point } from '@whiteboard/core/types'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'

type EdgeRoutingSessionMap = ReadonlyMap<EdgeId, EdgeRoutingSession>

type EdgeRoutingPatch = {
  routingPoints?: readonly Point[]
}

type EdgeRoutingSessionWritePatch =
  EdgeRoutingPatch & {
    id: EdgeId
    activeRoutingIndex?: number
  }

type EdgeRoutingSessionWrite = {
  patches: readonly EdgeRoutingSessionWritePatch[]
}

type EdgeRoutingSession = {
  patch?: EdgeRoutingPatch
  activeRoutingIndex?: number
}

export type EdgeRoutingSessionStore =
  Pick<StagedKeyedStore<EdgeId, EdgeRoutingSession, EdgeRoutingSessionWrite>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type EdgeRoutingSessionReader =
  Pick<EdgeRoutingSessionStore, 'get' | 'subscribe'>

const EMPTY_EDGE_ROUTING_SESSION: EdgeRoutingSession = {}

const EMPTY_EDGE_MAP: EdgeRoutingSessionMap =
  new Map<EdgeId, EdgeRoutingSession>()

const toEdgeRoutingSessionMap = ({
  patches
}: EdgeRoutingSessionWrite): EdgeRoutingSessionMap => {
  if (!patches.length) {
    return EMPTY_EDGE_MAP
  }

  const next = new Map<EdgeId, EdgeRoutingSession>()
  patches.forEach((patch) => {
    next.set(patch.id, {
      patch: patch.routingPoints
        ? {
            routingPoints: patch.routingPoints
          }
        : undefined,
      activeRoutingIndex: patch.activeRoutingIndex
    })
  })
  return next
}

export const createEdgeRoutingSessionStore = (
  schedule: () => void
) => createStagedKeyedStore({
  schedule,
  emptyState: EMPTY_EDGE_MAP,
  emptyValue: EMPTY_EDGE_ROUTING_SESSION,
  build: toEdgeRoutingSessionMap,
  isEqual: (left, right) => (
    left.patch?.routingPoints === right.patch?.routingPoints
    && left.activeRoutingIndex === right.activeRoutingIndex
  )
})

const applyRoutingPatch = (
  edge: EdgeItem['edge'],
  routingPoints: readonly Point[] | undefined
): EdgeItem['edge'] => {
  if (!routingPoints || edge.type === 'bezier' || edge.type === 'curve') {
    return edge
  }

  const routing = edge.routing
  const points = routing?.points ?? []
  if (routingPoints === points) {
    return edge
  }

  return {
    ...edge,
    routing: {
      ...(routing ?? {}),
      mode: routing?.mode ?? 'manual',
      points: [...routingPoints]
    }
  }
}

export const projectEdgeItem = (
  item: EdgeItem,
  session: EdgeRoutingSession
): EdgeItem => {
  const edge = applyRoutingPatch(item.edge, session.patch?.routingPoints)
  if (edge === item.edge) {
    return item
  }

  return {
    ...item,
    edge
  }
}

export const useEdgeRoutingSession = (
  store: EdgeRoutingSessionReader,
  edgeId: EdgeId | undefined
) => useOptionalKeyedStoreValue(store, edgeId, EMPTY_EDGE_ROUTING_SESSION)
