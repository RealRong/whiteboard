import { useMemo } from 'react'
import type { Document, Node, NodeId } from '@whiteboard/core'
import { getCollapsedGroupIds, isNodeHiddenByCollapsedGroup } from '../../node/utils/group'

export type VisibleNodesResult = {
  nodeMap: Map<NodeId, Node>
  visibleNodes: Node[]
  canvasNodes: Node[]
  mindmapNodes: Node[]
  visibleEdges: Document['edges']
}

export const useVisibleNodes = (doc: Document, viewNodes: Node[]): VisibleNodesResult => {
  const nodeMap = useMemo(() => new Map(viewNodes.map((node) => [node.id, node])), [viewNodes])
  const collapsedGroupIds = useMemo(() => getCollapsedGroupIds(viewNodes), [viewNodes])
  const hiddenNodeIds = useMemo(() => {
    const set = new Set<NodeId>()
    viewNodes.forEach((node) => {
      if (isNodeHiddenByCollapsedGroup(node, nodeMap, collapsedGroupIds)) {
        set.add(node.id)
      }
    })
    return set
  }, [collapsedGroupIds, nodeMap, viewNodes])
  const visibleNodes = useMemo(
    () => viewNodes.filter((node) => !hiddenNodeIds.has(node.id)),
    [hiddenNodeIds, viewNodes]
  )
  const mindmapNodes = useMemo(() => visibleNodes.filter((node) => node.type === 'mindmap'), [visibleNodes])
  const canvasNodes = useMemo(() => visibleNodes.filter((node) => node.type !== 'mindmap'), [visibleNodes])
  const canvasNodeIds = useMemo(() => new Set(canvasNodes.map((node) => node.id)), [canvasNodes])
  const visibleEdges = useMemo(
    () => doc.edges.filter((edge) => canvasNodeIds.has(edge.source.nodeId) && canvasNodeIds.has(edge.target.nodeId)),
    [doc.edges, canvasNodeIds]
  )

  return {
    nodeMap,
    visibleNodes,
    canvasNodes,
    mindmapNodes,
    visibleEdges
  }
}
