import type { Edge, NodeId } from '@whiteboard/core/types'
import type { ProjectionCommit, ProjectionSnapshot } from '@engine-types/projection'
import { hasImpactTag } from '../../mutation/Impact'

type Plan = {
  edges: Edge[]
  edgesChanged: boolean
  dirtyNodeIds: Set<NodeId>
}

export class Invalidation {
  private renderEdgesRef: unknown
  private pendingNodeIds = new Set<NodeId>()

  onProjectionCommit = (commit: ProjectionCommit) => {
    const impact = commit.impact
    const fullSync = commit.kind === 'replace' || hasImpactTag(impact, 'full')
    const dirtyNodeIds = impact.dirtyNodeIds
    const shouldReset =
      fullSync ||
      hasImpactTag(impact, 'edges') ||
      hasImpactTag(impact, 'order') ||
      hasImpactTag(impact, 'mindmap') ||
      (
        (
          hasImpactTag(impact, 'nodes') ||
          hasImpactTag(impact, 'geometry')
        ) &&
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

  consume = (readProjection: () => ProjectionSnapshot): Plan => {
    const edges = readProjection().edges.visible
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
