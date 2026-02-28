import type { Edge } from '@whiteboard/core/types'
import { getAnchorPoint, getRectCenter } from '@whiteboard/core/geometry'
import { getAutoAnchorFromRect } from '@whiteboard/core/edge'
import type { Query } from '@engine-types/instance/query'
import type {
  EdgeEndpoints
} from '@engine-types/instance/read'

export const createEdgeEndpointsResolver = (
  getNodeRect: Query['canvas']['nodeRect']
) => {
  const resolveEndpoints = (edge: Edge): EdgeEndpoints | undefined => {
    const sourceEntry = getNodeRect(edge.source.nodeId)
    const targetEntry = getNodeRect(edge.target.nodeId)
    if (!sourceEntry || !targetEntry) return undefined

    const sourceCenter = getRectCenter(sourceEntry.rect)
    const targetCenter = getRectCenter(targetEntry.rect)

    const sourceAuto = getAutoAnchorFromRect(
      sourceEntry.rect,
      sourceEntry.rotation,
      targetCenter
    )
    const targetAuto = getAutoAnchorFromRect(
      targetEntry.rect,
      targetEntry.rotation,
      sourceCenter
    )

    const sourceAnchor = edge.source.anchor ?? sourceAuto.anchor
    const targetAnchor = edge.target.anchor ?? targetAuto.anchor

    const sourcePoint = edge.source.anchor
      ? getAnchorPoint(sourceEntry.rect, sourceAnchor, sourceEntry.rotation)
      : sourceAuto.point
    const targetPoint = edge.target.anchor
      ? getAnchorPoint(targetEntry.rect, targetAnchor, targetEntry.rotation)
      : targetAuto.point

    return {
      source: {
        nodeId: sourceEntry.node.id,
        anchor: sourceAnchor,
        point: sourcePoint
      },
      target: {
        nodeId: targetEntry.node.id,
        anchor: targetAnchor,
        point: targetPoint
      }
    }
  }

  return resolveEndpoints
}
