import { READ_SUBSCRIPTION_KEYS } from '@engine-types/instance'
import type { ReadImpact } from '@engine-types/read'
import type { EdgeReadProjection, ReadModel } from '@engine-types/read'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import { NodeRectIndex } from './indexes'
import { SnapIndex } from './indexes'

type Rebuild = 'none' | 'dirty' | 'full'
type ReadTopic =
  | typeof READ_SUBSCRIPTION_KEYS.node
  | typeof READ_SUBSCRIPTION_KEYS.edge
  | typeof READ_SUBSCRIPTION_KEYS.mindmap

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

const shouldPublishNode = (impact: ReadImpact) => (
  impact.reset
  || impact.node.geometry
  || impact.node.list
  || impact.node.value
)

const shouldPublishEdge = (impact: ReadImpact) => (
  impact.reset
  || impact.node.list
  || impact.edge.geometry
  || impact.edge.list
  || impact.edge.value
)

const shouldPublishMindmap = (impact: ReadImpact) => (
  impact.reset
  || impact.mindmap.view
)

const collectTopics = (impact: ReadImpact): ReadTopic[] => {
  const topics: ReadTopic[] = []

  if (shouldPublishNode(impact)) {
    topics.push(READ_SUBSCRIPTION_KEYS.node)
  }
  if (shouldPublishEdge(impact)) {
    topics.push(READ_SUBSCRIPTION_KEYS.edge)
  }
  if (shouldPublishMindmap(impact)) {
    topics.push(READ_SUBSCRIPTION_KEYS.mindmap)
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
  publish: (topics: readonly ReadTopic[]) => void
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

  const topics = collectTopics(impact)
  if (topics.length) {
    publish(topics)
  }
}
