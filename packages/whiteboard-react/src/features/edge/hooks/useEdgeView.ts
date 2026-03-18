import type { EdgeItem } from '@whiteboard/core/read'
import type { EdgeId, Point } from '@whiteboard/core/types'
import { useMemo } from 'react'
import {
  useInternalInstance,
  useSelection
} from '../../../runtime/hooks'
import { useOptionalKeyedStoreValue } from '../../../runtime/hooks/useStoreValue'
import { useEdgeRoutingSession } from '../session/routing'

export type EdgeView = {
  edge: EdgeItem['edge']
  endpoints: EdgeItem['endpoints']
}

export type SelectedEdgeRoutingHandleView = {
  key: string
  edgeId: EdgeId
  index: number
  point: Point
  active: boolean
}

export type SelectedEdgeView = {
  edgeId: EdgeId
  endpoints: EdgeView['endpoints']
  routingHandles: readonly SelectedEdgeRoutingHandleView[]
}

export const useEdgeView = (
  edgeId: EdgeId | undefined
): EdgeView | undefined => {
  const instance = useInternalInstance()
  const entry = useOptionalKeyedStoreValue(
    instance.read.edge.item,
    edgeId,
    undefined
  )

  return useMemo(
    () => {
      if (!entry) {
        return undefined
      }

      return {
        edge: entry.edge,
        endpoints: entry.endpoints
      }
    },
    [entry]
  )
}

export const useSelectedEdgeView = (): SelectedEdgeView | undefined => {
  const instance = useInternalInstance()
  const edgeId = useSelection().target.edgeId
  const entry = useEdgeView(edgeId)
  const routing = useEdgeRoutingSession(instance.internals.edge.routing, edgeId)

  return useMemo(() => {
    if (!edgeId || !entry) {
      return undefined
    }

    const edge = entry.edge
    const points = edge.routing?.points ?? []
    const routingHandles =
      edge.type === 'bezier' || edge.type === 'curve'
        ? []
        : points.map((point, index) => ({
            key: `${edge.id}-point-${index}`,
            edgeId: edge.id,
            index,
            point,
            active: routing.activeRoutingIndex === index
          }))

    return {
      edgeId,
      endpoints: entry.endpoints,
      routingHandles
    }
  }, [routing.activeRoutingIndex, edgeId, entry])
}
