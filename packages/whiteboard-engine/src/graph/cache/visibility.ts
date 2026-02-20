import type { Node, NodeId } from '@whiteboard/core'
import {
  getCollapsedGroupIds,
  isHiddenByCollapsedGroup
} from '../../node/utils/group'
import { EMPTY_NODES } from './shared'

export const deriveVisibleNodes = (viewNodes: Node[]) => {
  if (!viewNodes.length) return EMPTY_NODES
  const nodeMap = new Map(viewNodes.map((node) => [node.id, node]))
  const collapsedGroupIds = getCollapsedGroupIds(viewNodes)
  const hiddenNodeIds = new Set<NodeId>()

  viewNodes.forEach((node) => {
    if (isHiddenByCollapsedGroup(node, nodeMap, collapsedGroupIds)) {
      hiddenNodeIds.add(node.id)
    }
  })

  return viewNodes.filter((node) => !hiddenNodeIds.has(node.id))
}

export const deriveCanvasNodes = (visibleNodes: Node[]) =>
  visibleNodes.filter((node) => node.type !== 'mindmap')
