import type { Edge, EdgeId, Point } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/view'
import type { ProjectionCommit, ProjectionSnapshot } from '@engine-types/projection'
import type { EdgeConnectState } from '@engine-types/state'

export type ReconnectPoint = {
  point: Point
  side?: NonNullable<EdgePathEntry['edge']['source']['anchor']>['side']
}

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
  resolveReconnectPoint: (to: EdgeConnectState['to']) => ReconnectPoint | undefined
}

export type EdgePathStore = {
  applyCommit: (commit: ProjectionCommit) => void
  getEntries: () => EdgePathEntry[]
  getReconnectEntry: (
    edgeConnect: EdgeConnectState,
    isConnecting: boolean
  ) => EdgePathEntry | undefined
  getEdge: (edgeId: EdgeId) => Edge | undefined
}
