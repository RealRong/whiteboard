import type { Edge, EdgeId } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { MutationMeta } from '../../../write/pipeline/MutationMetaBus'

export type ResolveEndpoints = (edge: Edge) => EdgeEndpoints | undefined

export type EdgePathCacheEntry = {
  geometrySignature: string
  edge: EdgePathEntry['edge']
  path: EdgePathEntry['path']
  entry: EdgePathEntry
}

export type EdgePathStoreOptions = {
  readSnapshot: () => ReadModelSnapshot
  getNodeRect: QueryCanvas['nodeRect']
  resolveEndpoints: ResolveEndpoints
}

export type EdgePathStore = {
  applyMutation: (meta: MutationMeta) => void
  getEntries: () => EdgePathEntry[]
  getIds: () => EdgeId[]
  getById: () => Map<EdgeId, EdgePathEntry>
  getEdge: (edgeId: EdgeId) => Edge | undefined
}
