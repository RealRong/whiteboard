import type { Document, NodeId } from '@whiteboard/core/types'
import { hasProjectionChange } from './ProjectionChange'
import { ProjectionCache } from './cache/ProjectionCache'
import type {
  ProjectionCommit,
  ProjectionChange,
  ProjectionChangeSource,
  ProjectionSyncInput,
  ProjectionInvalidation,
  ProjectionStore as ProjectionStoreType
} from '@engine-types/projection'

export class ProjectionStore implements ProjectionStoreType {
  private readonly cache = new ProjectionCache()
  private currentSnapshot = this.cache.read(this.getDoc())
  private listeners = new Set<(commit: ProjectionCommit) => void>()

  constructor(private readonly getDoc: () => Document | null) {}

  get: ProjectionStoreType['get'] = () => this.currentSnapshot

  subscribe: ProjectionStoreType['subscribe'] = (listener) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readNodeOverrides: ProjectionStoreType['readNodeOverrides'] = () =>
    this.cache.readNodeOverrides()

  apply: ProjectionStoreType['apply'] = (input = {}) => {
    const source = input.source ?? 'doc'
    const previous = this.currentSnapshot
    const next = this.cache.read(this.getDoc())
    this.currentSnapshot = next
    const projection: ProjectionInvalidation = {
      visibleNodesChanged: previous.nodes.visible !== next.nodes.visible,
      canvasNodesChanged: previous.nodes.canvas !== next.nodes.canvas,
      visibleEdgesChanged: previous.edges.visible !== next.edges.visible
    }

    if (input.full) {
      const commit = this.toCommit(this.toFullChange(source))
      this.emitCommit(commit)
      return commit
    }

    const dirtyNodeIds = this.collectChangedNodeIds({
      previous,
      next,
      hintNodeIds: input.dirtyNodeIds
    })
    const payload: ProjectionChange = {
      source,
      kind: 'partial',
      projection,
      dirtyNodeIds
    }
    const changed =
      hasProjectionChange(payload) ||
      Boolean(dirtyNodeIds?.length)
    if (!changed) return undefined
    const commit = this.toCommit(payload)
    this.emitCommit(commit)
    return commit
  }

  patchNodeOverrides: ProjectionStoreType['patchNodeOverrides'] = (updates) => {
    const changedNodeIds = this.cache.patchNodeOverrides(updates)
    if (!changedNodeIds.length) return undefined
    return this.apply({
      source: 'runtime',
      dirtyNodeIds: changedNodeIds
    })
  }

  clearNodeOverrides: ProjectionStoreType['clearNodeOverrides'] = (ids) => {
    const changedNodeIds = this.cache.clearNodeOverrides(ids)
    if (!changedNodeIds.length) return undefined
    return this.apply({
      source: 'runtime',
      dirtyNodeIds: changedNodeIds
    })
  }

  replace: ProjectionStoreType['replace'] = (source = 'doc') => {
    this.currentSnapshot = this.cache.read(this.getDoc())
    const commit = this.toCommit(this.toFullChange(source))
    this.emitCommit(commit)
    return commit
  }

  private collectChangedNodeIds = ({
    previous,
    next,
    hintNodeIds
  }: {
    previous: ReturnType<ProjectionStoreType['get']>
    next: ReturnType<ProjectionStoreType['get']>
    hintNodeIds?: ProjectionSyncInput['dirtyNodeIds']
  }): NodeId[] | undefined => {
    const merged = new Set<NodeId>(hintNodeIds ?? [])

    if (previous.indexes.canvasNodeById !== next.indexes.canvasNodeById) {
      previous.indexes.canvasNodeById.forEach((node, nodeId) => {
        if (next.indexes.canvasNodeById.get(nodeId) !== node) {
          merged.add(nodeId)
        }
      })

      next.indexes.canvasNodeById.forEach((node, nodeId) => {
        if (previous.indexes.canvasNodeById.get(nodeId) !== node) {
          merged.add(nodeId)
        }
      })
    }

    if (!merged.size) return undefined
    return Array.from(merged)
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

  private toCommit = (change: ProjectionChange): ProjectionCommit => ({
    snapshot: this.currentSnapshot,
    change
  })

  private emitCommit = (commit: ProjectionCommit) => {
    if (!this.listeners.size) return
    this.listeners.forEach((listener) => {
      listener(commit)
    })
  }
}
