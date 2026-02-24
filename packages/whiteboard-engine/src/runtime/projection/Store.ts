import type { Document, NodeId } from '@whiteboard/core/types'
import { ProjectionCache } from './cache/ProjectionCache'
import type {
  ProjectionApplyInput,
  ProjectionCommit,
  ProjectionImpact,
  ProjectionImpactTag,
  ProjectionReplaceInput,
  ProjectionStore as ProjectionStoreType
} from '@engine-types/projection'

const EMPTY_TAGS = new Set<ProjectionImpactTag>()
const FULL_TAGS = new Set<ProjectionImpactTag>(['full'])
const RUNTIME_NODE_DIRTY_TAGS = new Set<ProjectionImpactTag>([
  'nodes',
  'geometry'
])

const EMPTY_IMPACT: ProjectionImpact = {
  tags: EMPTY_TAGS
}

const FULL_IMPACT: ProjectionImpact = {
  tags: FULL_TAGS
}

const hasDirtyHints = (impact: ProjectionImpact) =>
  Boolean(impact.dirtyNodeIds?.length || impact.dirtyEdgeIds?.length)

const uniqueNodeIds = (nodeIds: readonly NodeId[]): NodeId[] =>
  Array.from(new Set(nodeIds))

const normalizeImpact = (
  impact: ProjectionImpact | undefined,
  fallback: ProjectionImpact
): ProjectionImpact => {
  const next = impact ?? fallback
  const dirtyNodeIds = next.dirtyNodeIds?.length
    ? uniqueNodeIds(next.dirtyNodeIds)
    : undefined
  const dirtyEdgeIds = next.dirtyEdgeIds?.length
    ? Array.from(new Set(next.dirtyEdgeIds))
    : undefined
  return {
    tags: next.tags,
    dirtyNodeIds,
    dirtyEdgeIds
  }
}

const toFallbackApplyImpact = (input: ProjectionApplyInput): ProjectionImpact =>
  input.operations.length ? FULL_IMPACT : EMPTY_IMPACT

export class ProjectionStore implements ProjectionStoreType {
  private readonly cache = new ProjectionCache()
  private currentSnapshot = this.cache.read(this.getDoc())
  private listeners = new Set<(commit: ProjectionCommit) => void>()

  constructor(private readonly getDoc: () => Document) {}

  getSnapshot: ProjectionStoreType['getSnapshot'] = () => this.currentSnapshot

  getRevision: ProjectionStoreType['getRevision'] = () => this.currentSnapshot.revision

  subscribe: ProjectionStoreType['subscribe'] = (listener) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  readNodeOverrides: ProjectionStoreType['readNodeOverrides'] = () =>
    this.cache.readNodeOverrides()

  apply: ProjectionStoreType['apply'] = (input) => {
    const impact = normalizeImpact(
      input.impact,
      toFallbackApplyImpact(input)
    )
    const previous = this.currentSnapshot
    const next = this.cache.read(input.doc)
    this.currentSnapshot = next

    const changed = next !== previous
    const commit = this.toCommit('apply', impact)
    if (changed || hasDirtyHints(impact)) {
      this.emitCommit(commit)
    }
    return commit
  }

  patchNodeOverrides: ProjectionStoreType['patchNodeOverrides'] = (updates) => {
    const changedNodeIds = this.cache.patchNodeOverrides(updates)
    if (!changedNodeIds.length) return undefined
    return this.apply({
      doc: this.getDoc(),
      operations: [],
      impact: {
        tags: RUNTIME_NODE_DIRTY_TAGS,
        dirtyNodeIds: changedNodeIds
      }
    })
  }

  clearNodeOverrides: ProjectionStoreType['clearNodeOverrides'] = (ids) => {
    const changedNodeIds = this.cache.clearNodeOverrides(ids)
    if (!changedNodeIds.length) return undefined
    return this.apply({
      doc: this.getDoc(),
      operations: [],
      impact: {
        tags: RUNTIME_NODE_DIRTY_TAGS,
        dirtyNodeIds: changedNodeIds
      }
    })
  }

  replace: ProjectionStoreType['replace'] = (input) => {
    this.currentSnapshot = this.cache.read(input.doc)
    const impact = normalizeImpact(input.impact, FULL_IMPACT)
    const commit = this.toCommit('replace', impact)
    this.emitCommit(commit)
    return commit
  }

  private toCommit = (
    kind: ProjectionCommit['kind'],
    impact: ProjectionImpact
  ): ProjectionCommit => ({
    revision: this.currentSnapshot.revision,
    kind,
    snapshot: this.currentSnapshot,
    impact
  })

  private emitCommit = (commit: ProjectionCommit) => {
    if (!this.listeners.size) return
    this.listeners.forEach((listener) => {
      listener(commit)
    })
  }
}
