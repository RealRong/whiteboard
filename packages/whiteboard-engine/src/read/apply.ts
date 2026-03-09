import { READ_KEYS } from '@engine-types/instance'
import type {
  EdgeReadProjection,
  ProjectionSubscriptionKey,
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

const collectTopics = ({
  reset,
  node,
  edge,
  mindmap
}: ReadImpact): ProjectionSubscriptionKey[] => {
  const topics: ProjectionSubscriptionKey[] = []

  if (reset || node.geometry || node.list || node.value) {
    topics.push(READ_KEYS.node)
  }
  if (reset || node.list || edge.geometry || edge.list || edge.value) {
    topics.push(READ_KEYS.edge)
  }
  if (reset || mindmap.view) {
    topics.push(READ_KEYS.mindmap)
  }

  return topics
}

export const createReadApply = ({
  readModel,
  nodeRectIndex,
  snapIndex,
  edgeProjection,
  publish
}: {
  readModel: () => ReadModel
  nodeRectIndex: NodeRectIndex
  snapIndex: SnapIndex
  edgeProjection: EdgeReadProjection
  publish: (topics: readonly ProjectionSubscriptionKey[]) => void
}) => (impact: ReadImpact) => {
  const indexRebuild = resolveRebuild({
    reset: impact.reset,
    geometry: impact.node.geometry,
    full: impact.node.list || (impact.node.geometry && impact.node.ids.length === 0)
  })
  const edgeRebuild = resolveRebuild({
    reset: impact.reset,
    geometry: impact.edge.geometry,
    full: (
      impact.edge.geometry
      && impact.edge.ids.length === 0
      && impact.edge.nodeIds.length === 0
    )
  })
  const indexNodeIds = indexRebuild === 'full' ? EMPTY_NODE_IDS : impact.node.ids
  const edgeNodeIds = edgeRebuild === 'full' ? EMPTY_NODE_IDS : impact.edge.nodeIds
  const edgeIds = edgeRebuild === 'full' ? EMPTY_EDGE_IDS : impact.edge.ids

  if (indexRebuild !== 'none') {
    nodeRectIndex.applyChange(indexRebuild, indexNodeIds, readModel())
    snapIndex.applyChange(indexRebuild, indexNodeIds, nodeRectIndex)
  }

  if (edgeRebuild !== 'none') {
    edgeProjection.applyChange(edgeRebuild, edgeNodeIds, edgeIds)
  }

  const topics = collectTopics(impact)
  if (topics.length) {
    publish(topics)
  }
}
