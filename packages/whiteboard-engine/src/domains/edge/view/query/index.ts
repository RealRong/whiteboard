import { getEdgePath } from '@whiteboard/core/edge'
import type { Edge, EdgeId, Point } from '@whiteboard/core/types'
import type { Query } from '@engine-types/instance/query'
import type { ProjectionCommit, ProjectionSnapshot } from '@engine-types/projection'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/view'
import type { RoutingDragState } from '@engine-types/state'
import { createEdgeEndpointsResolver } from './endpoints'
import { createEdgePathStore } from '../../../../runtime/query/EdgePath'

type Options = {
  readProjection: () => ProjectionSnapshot
  query: Query
}

const mergeRoutingPath = (
  entries: EdgePathEntry[],
  routing: EdgePathEntry | undefined
) => {
  if (!routing) return entries
  let matched = false
  const nextEntries = entries.map((entry) => {
    if (entry.id !== routing.id) return entry
    matched = true
    return routing
  })
  return matched ? nextEntries : entries
}

export const createEdgeViewQuery = ({ readProjection, query }: Options) => {
  const resolveEndpoints = createEdgeEndpointsResolver(query.canvas.nodeRect)
  const pathStore = createEdgePathStore({
    readProjection,
    getNodeRect: query.canvas.nodeRect,
    resolveEndpoints
  })

  const applyCommit = (commit: ProjectionCommit) => {
    pathStore.applyCommit(commit)
  }

  const getEndpoints = (edge: Edge): EdgeEndpoints | undefined =>
    resolveEndpoints(edge)

  const getEdge = (edgeId: EdgeId): Edge | undefined =>
    pathStore.getEdge(edgeId)

  const getRoutingEntry = (
    routingDrag: RoutingDragState
  ): EdgePathEntry | undefined => {
    const payload = routingDrag.payload
    if (!payload) return undefined
    const edge = getEdge(payload.edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') return undefined

    const points = edge.routing?.points ?? []
    if (payload.index < 0 || payload.index >= points.length) return undefined
    const routingPoints = points.map((point, index): Point =>
      index === payload.index ? payload.point : point
    )
    const previewEdge: Edge = {
      ...edge,
      routing: {
        ...(edge.routing ?? {}),
        mode: edge.routing?.mode ?? 'manual',
        points: routingPoints
      }
    }
    const endpoints = getEndpoints(previewEdge)
    if (!endpoints) return undefined
    return {
      id: previewEdge.id,
      edge: previewEdge,
      path: getEdgePath({
        edge: previewEdge,
        source: {
          point: endpoints.source.point,
          side: endpoints.source.anchor.side
        },
        target: {
          point: endpoints.target.point,
          side: endpoints.target.anchor.side
        }
      })
    }
  }

  const getPaths = (
    routingDrag: RoutingDragState
  ): EdgePathEntry[] => {
    const entries = pathStore.getEntries()
    return mergeRoutingPath(entries, getRoutingEntry(routingDrag))
  }

  return {
    applyCommit,
    getEndpoints,
    getEdge,
    getPaths
  }
}

export type EdgeViewQuery = ReturnType<typeof createEdgeViewQuery>
