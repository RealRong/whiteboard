import { getAutoAnchorFromRect, getEdgePath } from '@whiteboard/core/edge'
import { getAnchorPoint, getRectCenter } from '@whiteboard/core/geometry'
import type { Edge, EdgeId, Point } from '@whiteboard/core/types'
import type { EdgePathEntry } from '@whiteboard/engine'
import type { RoutingPreviewDraft } from './routingPreviewState'

type NodeRectEntry = {
  node: {
    id: Edge['source']['nodeId']
  }
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  rotation: number
}

type NodeRectReader = (id: Edge['source']['nodeId']) => NodeRectEntry | undefined

const buildRoutingPoints = (
  edgeId: EdgeId,
  points: Point[],
  draft?: RoutingPreviewDraft
) => {
  if (!draft || draft.edgeId !== edgeId) return points
  if (draft.index < 0 || draft.index >= points.length) return points
  return points.map((point, index) =>
    index === draft.index ? draft.point : point
  )
}

const resolvePreviewEdge = (
  edge: Edge,
  draft?: RoutingPreviewDraft
): Edge | undefined => {
  if (edge.type === 'bezier' || edge.type === 'curve') return undefined
  const points = edge.routing?.points ?? []
  if (!points.length) return undefined
  const previewPoints = buildRoutingPoints(edge.id, points, draft)
  if (previewPoints === points) return edge
  return {
    ...edge,
    routing: {
      ...(edge.routing ?? {}),
      mode: edge.routing?.mode ?? 'manual',
      points: previewPoints
    }
  }
}

export const resolveRoutingPointsWithDraft = (
  edgeId: EdgeId,
  points: Point[],
  draft?: RoutingPreviewDraft
) => buildRoutingPoints(edgeId, points, draft)

export const resolveEdgePathEntryWithRoutingDraft = (
  entry: EdgePathEntry,
  getNodeRect: NodeRectReader,
  draft?: RoutingPreviewDraft
): EdgePathEntry => {
  if (!draft || draft.edgeId !== entry.edge.id) return entry
  const previewEdge = resolvePreviewEdge(entry.edge, draft)
  if (!previewEdge || previewEdge === entry.edge) return entry

  const sourceEntry = getNodeRect(previewEdge.source.nodeId)
  const targetEntry = getNodeRect(previewEdge.target.nodeId)
  if (!sourceEntry || !targetEntry) return entry

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

  const sourceAnchor = previewEdge.source.anchor ?? sourceAuto.anchor
  const targetAnchor = previewEdge.target.anchor ?? targetAuto.anchor
  const sourcePoint = previewEdge.source.anchor
    ? getAnchorPoint(sourceEntry.rect, sourceAnchor, sourceEntry.rotation)
    : sourceAuto.point
  const targetPoint = previewEdge.target.anchor
    ? getAnchorPoint(targetEntry.rect, targetAnchor, targetEntry.rotation)
    : targetAuto.point

  return {
    ...entry,
    edge: previewEdge,
    path: getEdgePath({
      edge: previewEdge,
      source: {
        point: sourcePoint,
        side: sourceAnchor.side
      },
      target: {
        point: targetPoint,
        side: targetAnchor.side
      }
    })
  }
}
