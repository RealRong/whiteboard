import { useMemo } from 'react'
import type { EdgeAnchor, Point } from '@whiteboard/core'
import { getEdgePath } from '@whiteboard/core'
import { useInstance } from '../../common/hooks'
import { getAnchorPoint } from '../../common/utils/geometry'
import type { EdgePathEntry, UseEdgeGeometryOptions } from 'types/edge'
import type { EdgeConnectState } from 'types/state'

export const useEdgeGeometry = ({
  edges,
  connectState
}: UseEdgeGeometryOptions): EdgePathEntry[] => {
  const instance = useInstance()

  return useMemo(() => {
    const getReconnectPoint = (
      to?: EdgeConnectState['to']
    ): { point: Point; side?: EdgeAnchor['side'] } | undefined => {
      if (!to) return undefined
      if (to.pointWorld) return { point: to.pointWorld, side: to.anchor?.side }
      if (to.nodeId && to.anchor) {
        const entry = instance.query.getCanvasNodeRectById(to.nodeId)
        if (!entry) return undefined
        return { point: getAnchorPoint(entry.rect, to.anchor, entry.rotation), side: to.anchor.side }
      }
      return undefined
    }

    return edges
      .map((edge) => {
        const endpoints = instance.query.getEdgeResolvedEndpoints(edge)
        if (!endpoints) return null

        let sourceEndpoint = {
          point: endpoints.source.point,
          side: endpoints.source.anchor.side
        }
        let targetEndpoint = {
          point: endpoints.target.point,
          side: endpoints.target.anchor.side
        }

        if (connectState?.isConnecting && connectState.reconnect?.edgeId === edge.id) {
          const moved = getReconnectPoint(connectState.to)
          if (moved) {
            if (connectState.reconnect.end === 'source') {
              sourceEndpoint = { point: moved.point, side: moved.side ?? sourceEndpoint.side }
            } else {
              targetEndpoint = { point: moved.point, side: moved.side ?? targetEndpoint.side }
            }
          }
        }

        const path = getEdgePath({
          edge,
          source: sourceEndpoint,
          target: targetEndpoint
        })

        return { id: edge.id, edge, path }
      })
      .filter((line): line is EdgePathEntry => Boolean(line))
  }, [
    connectState?.isConnecting,
    connectState?.reconnect?.edgeId,
    connectState?.reconnect?.end,
    connectState?.to,
    edges,
    instance
  ])
}
