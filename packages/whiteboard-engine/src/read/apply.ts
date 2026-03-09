import type {
  EdgeReadProjection,
  MindmapReadProjection,
  NodeReadProjection,
  ReadImpact,
  ReadModel
} from '@engine-types/read'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { NodeRectIndex } from './indexes'
import { SnapIndex } from './indexes'

type Rebuild = 'none' | 'dirty' | 'full'

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

const resolveRebuild = ({
  reset,
  geometry,
  full
}: {
  reset: boolean
  geometry: boolean
  full: boolean
}): Rebuild => {
  if (reset || full) {
    return 'full'
  }
  if (geometry) {
    return 'dirty'
  }
  return 'none'
}

const resolveEdgeRebuild = (impact: ReadImpact): Rebuild => {
  if (impact.reset || impact.node.list || impact.edge.list) {
    return 'full'
  }

  if (
    impact.edge.geometry
    || impact.edge.value
    || impact.edge.ids.length > 0
    || impact.edge.nodeIds.length > 0
  ) {
    return 'dirty'
  }

  return 'none'
}

export const createReadApply = ({
  readModel,
  nodeRectIndex,
  snapIndex,
  nodeProjection,
  edgeProjection,
  mindmapProjection
}: {
  readModel: () => ReadModel
  nodeRectIndex: NodeRectIndex
  snapIndex: SnapIndex
  nodeProjection: NodeReadProjection
  edgeProjection: EdgeReadProjection
  mindmapProjection: MindmapReadProjection
}) => (impact: ReadImpact) => {
  const indexRebuild = resolveRebuild({
    reset: impact.reset,
    geometry: impact.node.geometry,
    full: impact.node.list || (impact.node.geometry && impact.node.ids.length === 0)
  })
  const edgeRebuild = resolveEdgeRebuild(impact)
  const indexNodeIds = indexRebuild === 'full' ? EMPTY_NODE_IDS : impact.node.ids
  const edgeNodeIds = edgeRebuild === 'full' ? EMPTY_NODE_IDS : impact.edge.nodeIds
  const edgeIds = edgeRebuild === 'full' ? EMPTY_EDGE_IDS : impact.edge.ids

  if (indexRebuild !== 'none') {
    nodeRectIndex.applyChange(indexRebuild, indexNodeIds, readModel())
    snapIndex.applyChange(indexRebuild, indexNodeIds, nodeRectIndex)
  }

  nodeProjection.applyChange(impact)

  if (edgeRebuild !== 'none') {
    edgeProjection.applyChange(edgeRebuild, edgeNodeIds, edgeIds)
  }
  mindmapProjection.applyChange(impact)
}
