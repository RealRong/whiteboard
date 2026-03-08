import type { ReadImpact } from '@engine-types/read/control/impact'
import type { EdgeReadProjection } from '@engine-types/read/projection/edge'
import type { ReadModel } from '@engine-types/read/model'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { NodeRectIndex } from './stages/index/NodeRectIndex'
import { SnapIndex } from './stages/index/SnapIndex'

type Rebuild = 'none' | 'dirty' | 'full'

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

const resolveIndexRebuild = (impact: ReadImpact): Rebuild => {
  if (
    impact.reset
    || impact.node.list
    || (impact.node.geometry && impact.node.ids.length === 0)
  ) {
    return 'full'
  }
  if (impact.node.geometry) {
    return 'dirty'
  }
  return 'none'
}

const resolveEdgeRebuild = (impact: ReadImpact): Rebuild => {
  if (
    impact.reset
    || (
      impact.edge.geometry
      && impact.edge.ids.length === 0
      && impact.edge.nodeIds.length === 0
    )
  ) {
    return 'full'
  }
  if (impact.edge.geometry) {
    return 'dirty'
  }
  return 'none'
}

const shouldSignalNode = (impact: ReadImpact) => (
  impact.reset
  || impact.node.geometry
  || impact.node.list
  || impact.node.value
)

const shouldSignalEdge = (impact: ReadImpact) => (
  impact.reset
  || impact.node.list
  || impact.edge.geometry
  || impact.edge.list
  || impact.edge.value
)

const shouldSignalMindmap = (impact: ReadImpact) => (
  impact.reset
  || impact.mindmap.view
)

export const createReadApply = ({
  readModel,
  nodeRectIndex,
  snapIndex,
  edgeProjection,
  applySignals
}: {
  readModel: () => ReadModel
  nodeRectIndex: NodeRectIndex
  snapIndex: SnapIndex
  edgeProjection: EdgeReadProjection
  applySignals: (node: boolean, edge: boolean, mindmap: boolean) => void
}) => (impact: ReadImpact) => {
  const indexRebuild = resolveIndexRebuild(impact)
  const edgeRebuild = resolveEdgeRebuild(impact)
  const indexNodeIds = indexRebuild === 'full' ? EMPTY_NODE_IDS : impact.node.ids
  const edgeNodeIds = edgeRebuild === 'full' ? EMPTY_NODE_IDS : impact.edge.nodeIds
  const edgeIds = edgeRebuild === 'full' ? EMPTY_EDGE_IDS : impact.edge.ids

  if (indexRebuild !== 'none') {
    const changed = nodeRectIndex.applyChange(indexRebuild, indexNodeIds, readModel())
    if (changed) {
      snapIndex.applyChange(indexRebuild, indexNodeIds, nodeRectIndex)
    }
  }

  edgeProjection.applyChange(edgeRebuild, edgeNodeIds, edgeIds)

  applySignals(
    shouldSignalNode(impact),
    shouldSignalEdge(impact),
    shouldSignalMindmap(impact)
  )
}
