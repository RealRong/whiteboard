import type { Edge, EdgeId } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/read'
import type { ProjectionCommit, ProjectionSnapshot } from '@engine-types/projection'

export type ResolveEndpoints = (edge: Edge) => EdgeEndpoints | undefined

export type EdgePathCacheEntry = {
  geometrySignature: string
  edge: EdgePathEntry['edge']
  path: EdgePathEntry['path']
  entry: EdgePathEntry
}

export type EdgePathStoreOptions = {
  readProjection: () => ProjectionSnapshot
  getNodeRect: QueryCanvas['nodeRect']
  resolveEndpoints: ResolveEndpoints
}

export type EdgePathStore = {
  applyCommit: (commit: ProjectionCommit) => void
  getEntries: () => EdgePathEntry[]
  getIds: () => EdgeId[]
  getById: () => Map<EdgeId, EdgePathEntry>
  getEdge: (edgeId: EdgeId) => Edge | undefined
}
