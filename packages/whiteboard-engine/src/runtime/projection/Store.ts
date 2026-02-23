import type { Document } from '@whiteboard/core/types'
import { hasProjectionChange } from './ProjectionChange'
import { ProjectionCache } from './cache/ProjectionCache'
import type {
  ProjectionChange,
  ProjectionChangeSource,
  ProjectionSyncInput,
  ProjectionInvalidation,
  ProjectionStore as ProjectionStoreType
} from '@engine-types/projection'

export class ProjectionStore implements ProjectionStoreType {
  private readonly cache = new ProjectionCache()
  private currentSnapshot = this.cache.read(this.getDoc())

  constructor(private readonly getDoc: () => Document | null) {}

  read: ProjectionStoreType['read'] = () => {
    this.currentSnapshot = this.cache.read(this.getDoc())
    return this.currentSnapshot
  }

  readNode: ProjectionStoreType['readNode'] = (nodeId) =>
    this.cache.readNode(this.getDoc(), nodeId)

  readNodeOverrides: ProjectionStoreType['readNodeOverrides'] = () =>
    this.cache.readNodeOverrides()

  sync: ProjectionStoreType['sync'] = (input = {}) => {
    const source = input.source ?? 'doc'
    const previous = this.currentSnapshot
    const next = this.cache.read(this.getDoc())
    this.currentSnapshot = next
    const projection: ProjectionInvalidation = {
      visibleNodesChanged: previous.visibleNodes !== next.visibleNodes,
      canvasNodesChanged: previous.canvasNodes !== next.canvasNodes,
      visibleEdgesChanged: previous.visibleEdges !== next.visibleEdges
    }

    if (input.full) {
      return this.toFullChange(source)
    }

    const dirtyNodeIds = this.toDirtyNodeIds(input.dirtyNodeIds)
    const orderChanged = input.orderChanged ? true : undefined
    const payload: ProjectionChange = {
      source,
      kind: 'partial',
      projection,
      dirtyNodeIds,
      orderChanged
    }
    const changed =
      hasProjectionChange(payload) ||
      Boolean(dirtyNodeIds?.length) ||
      Boolean(orderChanged)
    if (!changed) return undefined
    return payload
  }

  patchNodeOverrides: ProjectionStoreType['patchNodeOverrides'] = (updates) => {
    const changedNodeIds = this.cache.patchNodeOverrides(updates)
    if (!changedNodeIds.length) return undefined
    return this.sync({
      source: 'runtime',
      dirtyNodeIds: changedNodeIds
    })
  }

  clearNodeOverrides: ProjectionStoreType['clearNodeOverrides'] = (ids) => {
    const changedNodeIds = this.cache.clearNodeOverrides(ids)
    if (!changedNodeIds.length) return undefined
    return this.sync({
      source: 'runtime',
      dirtyNodeIds: changedNodeIds
    })
  }

  private toDirtyNodeIds = (dirtyNodeIds?: ProjectionSyncInput['dirtyNodeIds']) => {
    if (!dirtyNodeIds?.length) return undefined
    const normalized = Array.from(new Set(dirtyNodeIds))
    return normalized.length ? normalized : undefined
  }

  private toFullChange = (source: ProjectionChangeSource): ProjectionChange => ({
    source,
    kind: 'full',
    projection: {
      visibleNodesChanged: true,
      canvasNodesChanged: true,
      visibleEdgesChanged: true
    }
  })
}
