import type { ReadControl } from '@engine-types/read/change'
import type { ReadImpact } from '@engine-types/read/impact'
import type { EdgeId, NodeId } from '@whiteboard/core/types'

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

export const compileReadControl = (impact: ReadImpact): ReadControl => {
  const indexFull = (
    impact.reset ||
    impact.node.list ||
    (impact.node.geometry && impact.node.ids.length === 0)
  )

  const edgeFull = (
    impact.reset ||
    (
      impact.edge.geometry &&
      impact.edge.ids.length === 0 &&
      impact.edge.nodeIds.length === 0
    )
  )

  return {
    index: {
      rebuild: indexFull
        ? 'full'
        : impact.node.geometry
          ? 'dirty'
          : 'none',
      nodeIds: indexFull ? EMPTY_NODE_IDS : impact.node.ids
    },
    edge: {
      rebuild: edgeFull
        ? 'full'
        : impact.edge.geometry
          ? 'dirty'
          : 'none',
      nodeIds: edgeFull ? EMPTY_NODE_IDS : impact.edge.nodeIds,
      edgeIds: edgeFull ? EMPTY_EDGE_IDS : impact.edge.ids
    },
    signals: {
      node: (
        impact.reset ||
        impact.node.geometry ||
        impact.node.list ||
        impact.node.value
      ),
      edge: (
        impact.reset ||
        impact.node.list ||
        impact.edge.geometry ||
        impact.edge.list ||
        impact.edge.value
      ),
      mindmap: (
        impact.reset ||
        impact.mindmap.view
      )
    }
  }
}
