import { useMemo } from 'react'
import type { EdgeId, Point } from '@whiteboard/core/types'
import {
  useTransientEdge,
  type EdgeReader,
  type NodeReader
} from '../../transient'
import { useSelectedEdgeId } from '../../selection'
import { useEdgeView } from './useEdgeView'

export type SelectedEdgeRoutingHandleView = {
  key: string
  edgeId: EdgeId
  index: number
  point: Point
  active: boolean
}

export type SelectedEdgeView = {
  edgeId: EdgeId
  endpoints: NonNullable<ReturnType<typeof useEdgeView>>['endpoints']
  routingHandles: readonly SelectedEdgeRoutingHandleView[]
}

export const useSelectedEdgeView = (
  node: NodeReader,
  edge: EdgeReader
): SelectedEdgeView | undefined => {
  const edgeId = useSelectedEdgeId()
  const entry = useEdgeView(edgeId, node, edge)
  const draft = useTransientEdge(edge, edgeId)

  return useMemo(() => {
    if (!edgeId || !entry) return undefined
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
            active: draft.activeRoutingIndex === index
          }))

    return {
      edgeId,
      endpoints: entry.endpoints,
      routingHandles
    }
  }, [draft.activeRoutingIndex, edgeId, entry])
}
