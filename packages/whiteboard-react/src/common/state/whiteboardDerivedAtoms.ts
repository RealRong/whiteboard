import { atom } from 'jotai'
import type { Edge, Node, NodeId } from '@whiteboard/core'
import { whiteboardInputAtom } from './whiteboardInputAtoms'
import { viewNodesAtom } from '../../node/state/viewNodesAtom'
import { getCollapsedGroupIds, isNodeHiddenByCollapsedGroup } from '../../node/utils/group'

export const resolvedViewNodesAtom = atom<Node[]>((get) => {
  const doc = get(whiteboardInputAtom).doc
  if (!doc) return []
  const override = get(viewNodesAtom)
  return override ?? doc.nodes
})

export const nodeMapAtom = atom<Map<NodeId, Node>>((get) => {
  const viewNodes = get(resolvedViewNodesAtom)
  return new Map(viewNodes.map((node) => [node.id, node]))
})

export const visibleNodesAtom = atom<Node[]>((get) => {
  const viewNodes = get(resolvedViewNodesAtom)
  const nodeMap = get(nodeMapAtom)
  const collapsedGroupIds = getCollapsedGroupIds(viewNodes)
  const hiddenNodeIds = new Set<NodeId>()
  viewNodes.forEach((node) => {
    if (isNodeHiddenByCollapsedGroup(node, nodeMap, collapsedGroupIds)) {
      hiddenNodeIds.add(node.id)
    }
  })
  return viewNodes.filter((node) => !hiddenNodeIds.has(node.id))
})

export const mindmapNodesAtom = atom<Node[]>((get) => {
  const visibleNodes = get(visibleNodesAtom)
  return visibleNodes.filter((node) => node.type === 'mindmap')
})

export const canvasNodesAtom = atom<Node[]>((get) => {
  const visibleNodes = get(visibleNodesAtom)
  return visibleNodes.filter((node) => node.type !== 'mindmap')
})

export const visibleEdgesAtom = atom<Edge[]>((get) => {
  const doc = get(whiteboardInputAtom).doc
  if (!doc) return []
  const canvasNodes = get(canvasNodesAtom)
  const canvasNodeIds = new Set(canvasNodes.map((node) => node.id))
  return doc.edges.filter(
    (edge) => canvasNodeIds.has(edge.source.nodeId) && canvasNodeIds.has(edge.target.nodeId)
  )
})

export type ViewGraph = {
  viewNodes: Node[]
  visibleNodes: Node[]
  canvasNodes: Node[]
  mindmapNodes: Node[]
  nodeMap: Map<NodeId, Node>
  visibleEdges: Edge[]
}

export const viewGraphAtom = atom<ViewGraph>((get) => {
  const viewNodes = get(resolvedViewNodesAtom)
  const visibleNodes = get(visibleNodesAtom)
  const canvasNodes = get(canvasNodesAtom)
  const mindmapNodes = get(mindmapNodesAtom)
  const nodeMap = get(nodeMapAtom)
  const visibleEdges = get(visibleEdgesAtom)

  return {
    viewNodes,
    visibleNodes,
    canvasNodes,
    mindmapNodes,
    nodeMap,
    visibleEdges
  }
})
