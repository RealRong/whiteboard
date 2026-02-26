import type { Edge, EdgeId } from '@whiteboard/core/types'
import type { Query } from '@engine-types/instance/query'
import type { ProjectionCommit, ProjectionSnapshot } from '@engine-types/projection'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/view'
import { createEdgeEndpointsResolver } from './endpoints'
import { createEdgePathStore } from '../../../../runtime/query/EdgePath'

type Options = {
  readProjection: () => ProjectionSnapshot
  query: Query
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

  const getPaths = (): EdgePathEntry[] => pathStore.getEntries()

  return {
    applyCommit,
    getEndpoints,
    getEdge,
    getPaths
  }
}

export type EdgeViewQuery = ReturnType<typeof createEdgeViewQuery>
