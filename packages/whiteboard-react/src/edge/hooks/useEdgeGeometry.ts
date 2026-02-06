import { useMemo } from 'react'
import type { Edge, EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
import { getEdgePath } from '@whiteboard/core'
import type { EdgeConnectState } from '../../common/state'
import type { Size } from '../../common/types'
import { getAnchorPoint, getNodeRect, getRectCenter } from '../../common/utils/geometry'

export type EdgePathEntry = {
  id: string
  edge: Edge
  path: {
    points: Point[]
    svgPath: string
  }
}

type Options = {
  nodes: Node[]
  edges: Edge[]
  nodeSize: Size
  connectState?: EdgeConnectState
}

export const useEdgeGeometry = ({ nodes, edges, nodeSize, connectState }: Options): EdgePathEntry[] => {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])

  return useMemo(() => {
    const getAutoAnchor = (rect: Rect, rotation: number, otherCenter: Point) => {
      const center = getRectCenter(rect)
      const dx = otherCenter.x - center.x
      const dy = otherCenter.y - center.y
      const side: EdgeAnchor['side'] =
        Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'
      const anchor = { side, offset: 0.5 }
      const point = getAnchorPoint(rect, anchor, rotation)
      return { anchor, point }
    }

    const getReconnectPoint = (
      to?: EdgeConnectState['to']
    ): { point: Point; side?: EdgeAnchor['side'] } | undefined => {
      if (!to) return undefined
      if (to.pointWorld) return { point: to.pointWorld, side: to.anchor?.side }
      if (to.nodeId && to.anchor) {
        const node = nodeMap.get(to.nodeId)
        if (!node) return undefined
        const rect = getNodeRect(node, nodeSize)
        const rotation = typeof node.rotation === 'number' ? node.rotation : 0
        return { point: getAnchorPoint(rect, to.anchor, rotation), side: to.anchor.side }
      }
      return undefined
    }

    return edges
      .map((edge) => {
        const source = nodeMap.get(edge.source.nodeId)
        const target = nodeMap.get(edge.target.nodeId)
        if (!source || !target) return null
        const sourceRect = getNodeRect(source, nodeSize)
        const targetRect = getNodeRect(target, nodeSize)
        const sourceRotation = typeof source.rotation === 'number' ? source.rotation : 0
        const targetRotation = typeof target.rotation === 'number' ? target.rotation : 0
        const sourceCenter = getRectCenter(sourceRect)
        const targetCenter = getRectCenter(targetRect)
        const sourceAnchor = edge.source.anchor ?? getAutoAnchor(sourceRect, sourceRotation, targetCenter).anchor
        const targetAnchor = edge.target.anchor ?? getAutoAnchor(targetRect, targetRotation, sourceCenter).anchor
        const sourcePoint = getAnchorPoint(sourceRect, sourceAnchor, sourceRotation)
        const targetPoint = getAnchorPoint(targetRect, targetAnchor, targetRotation)

        let sourceEndpoint = { point: sourcePoint, side: sourceAnchor.side }
        let targetEndpoint = { point: targetPoint, side: targetAnchor.side }

        if (connectState?.isConnecting && connectState.reconnect?.edgeId === edge.id) {
          const moved = getReconnectPoint(connectState.to)
          if (moved) {
            if (connectState.reconnect.end === 'source') {
              sourceEndpoint = moved
            } else {
              targetEndpoint = moved
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
  }, [connectState?.isConnecting, connectState?.reconnect?.edgeId, connectState?.reconnect?.end, connectState?.to, edges, nodeMap, nodeSize])
}
