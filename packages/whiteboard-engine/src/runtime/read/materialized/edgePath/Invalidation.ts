import type { Edge, NodeId } from '@whiteboard/core/types'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import { hasImpactTag } from '../../../write/mutation/Impact'
import type { MutationMeta } from '../../../write/pipeline/MutationMetaBus'

type Plan = {
  edges: Edge[]
  edgesChanged: boolean
  dirtyNodeIds: Set<NodeId>
}

export class Invalidation {
  private renderEdgesRef: unknown
  private pendingNodeIds = new Set<NodeId>()

  onMutation = (meta: MutationMeta) => {
    const impact = meta.impact
    const fullSync = meta.kind === 'replace' || hasImpactTag(impact, 'full')
    const dirtyNodeIds = impact.dirtyNodeIds
    const shouldReset =
      fullSync ||
      hasImpactTag(impact, 'edges') ||
      hasImpactTag(impact, 'mindmap') ||
      (
        hasImpactTag(impact, 'geometry') &&
        !dirtyNodeIds?.length
      )

    if (fullSync) {
      this.renderEdgesRef = undefined
      this.pendingNodeIds = new Set<NodeId>()
      return
    }
    if (shouldReset) {
      this.renderEdgesRef = undefined
    }
    if (!dirtyNodeIds?.length) return
    dirtyNodeIds.forEach((nodeId) => {
      this.pendingNodeIds.add(nodeId)
    })
  }

  consume = (readSnapshot: () => ReadModelSnapshot): Plan => {
    const edges = readSnapshot().edges.visible
    const edgesChanged = edges !== this.renderEdgesRef
    if (edgesChanged) {
      this.renderEdgesRef = edges
      this.pendingNodeIds = new Set<NodeId>()
      return {
        edges,
        edgesChanged: true,
        dirtyNodeIds: new Set<NodeId>()
      }
    }

    const dirtyNodeIds = this.pendingNodeIds
    this.pendingNodeIds = new Set<NodeId>()
    return {
      edges,
      edgesChanged: false,
      dirtyNodeIds
    }
  }
}
