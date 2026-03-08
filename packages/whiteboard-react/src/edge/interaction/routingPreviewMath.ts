import type { Edge, EdgeId, Point } from '@whiteboard/core/types'
import type { EdgeEntry } from '@whiteboard/engine'
import type { RoutingPreviewDraft } from './routingPreviewState'

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

export const resolveEdgeEntryWithRoutingDraft = (
  entry: EdgeEntry,
  draft?: RoutingPreviewDraft
): EdgeEntry => {
  if (!draft || draft.edgeId !== entry.edge.id) return entry
  const previewEdge = resolvePreviewEdge(entry.edge, draft)
  if (!previewEdge || previewEdge === entry.edge) return entry

  return {
    ...entry,
    edge: previewEdge
  }
}
