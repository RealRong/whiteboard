import type { Edge, EdgeId } from '@whiteboard/core/types'
import type { Query } from '@engine-types/instance/query'
import type { ProjectionChange, ProjectionSnapshot } from '@engine-types/projection'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/view'
import type { EdgeConnectState } from '@engine-types/state'
import { createEdgeEndpointsResolver } from './endpoints'
import { createEdgePathStore } from '../../../../query/EdgePath'
import { createEdgePreviewResolver } from './preview'

type Options = {
  readProjection: () => ProjectionSnapshot
  query: Query
}

const mergeReconnectPath = (
  entries: EdgePathEntry[],
  reconnect: EdgePathEntry | undefined
) => {
  if (!reconnect) return entries
  let matched = false
  const nextEntries = entries.map((entry) => {
    if (entry.id !== reconnect.id) return entry
    matched = true
    return reconnect
  })
  return matched ? nextEntries : entries
}

export const createEdgeViewQuery = ({ readProjection, query }: Options) => {
  const resolveEndpoints = createEdgeEndpointsResolver(query.canvas.nodeRect)
  const preview = createEdgePreviewResolver({
    getNodeRect: query.canvas.nodeRect
  })
  const pathStore = createEdgePathStore({
    readProjection,
    getNodeRect: query.canvas.nodeRect,
    resolveEndpoints,
    resolveReconnectPoint: preview.resolveReconnectPoint
  })

  const applyProjection = (change: ProjectionChange) => {
    pathStore.syncProjection(change)
  }

  const getEndpoints = (edge: Edge): EdgeEndpoints | undefined =>
    resolveEndpoints(edge)

  const getEdge = (edgeId: EdgeId): Edge | undefined =>
    pathStore.getEdge(edgeId)

  const getPaths = (
    edgeConnect: EdgeConnectState,
    isConnecting: boolean
  ): EdgePathEntry[] => {
    const entries = pathStore.getEntries()
    const reconnectEntry = pathStore.getReconnectEntry(edgeConnect, isConnecting)
    return mergeReconnectPath(entries, reconnectEntry)
  }

  return {
    applyProjection,
    getEndpoints,
    getEdge,
    getPaths,
    getPreview: preview.getPreview
  }
}

export type EdgeViewQuery = ReturnType<typeof createEdgeViewQuery>
