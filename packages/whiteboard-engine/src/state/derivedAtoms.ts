import { atom } from 'jotai'
import type { Edge, EdgeId, Node, NodeId } from '@whiteboard/core'
import { docAtom } from './contextAtoms'
import { viewNodesAtom } from '../node/state/viewNodesAtom'
import { getCollapsedGroupIds, isNodeHiddenByCollapsedGroup } from '../node/utils/group'

const orderByIds = <T extends { id: string }>(items: T[], ids: string[]) => {
  if (!ids.length) return items
  const map = new Map(items.map((item) => [item.id, item]))
  const ordered: T[] = []
  const idSet = new Set(ids)
  ids.forEach((id) => {
    const item = map.get(id)
    if (item) ordered.push(item)
  })
  if (ordered.length === items.length) return ordered
  items.forEach((item) => {
    if (!idSet.has(item.id)) {
      ordered.push(item)
    }
  })
  return ordered
}

export const nodeOrderAtom = atom<NodeId[]>((get) => {
  const doc = get(docAtom)
  if (!doc) return []
  return doc.order?.nodes ?? doc.nodes.map((node) => node.id)
})

export const edgeOrderAtom = atom<EdgeId[]>((get) => {
  const doc = get(docAtom)
  if (!doc) return []
  return doc.order?.edges ?? doc.edges.map((edge) => edge.id)
})

export const resolvedViewNodesAtom = atom<Node[]>((get) => {
  return get(viewNodesAtom)
})

export const orderedViewNodesAtom = atom<Node[]>((get) => {
  const viewNodes = get(resolvedViewNodesAtom)
  const order = get(nodeOrderAtom)
  return orderByIds(viewNodes, order)
})

export const nodeMapAtom = atom<Map<NodeId, Node>>((get) => {
  const viewNodes = get(orderedViewNodesAtom)
  return new Map(viewNodes.map((node) => [node.id, node]))
})

export const visibleNodesAtom = atom<Node[]>((get) => {
  const viewNodes = get(orderedViewNodesAtom)
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

export const canvasNodesAtom = atom<Node[]>((get) => {
  const visibleNodes = get(visibleNodesAtom)
  return visibleNodes.filter((node) => node.type !== 'mindmap')
})

export const visibleEdgesAtom = atom<Edge[]>((get) => {
  const doc = get(docAtom)
  if (!doc) return []
  const canvasNodes = get(canvasNodesAtom)
  const edgeOrder = get(edgeOrderAtom)
  const canvasNodeIds = new Set(canvasNodes.map((node) => node.id))
  const edges = doc.edges.filter(
    (edge) => canvasNodeIds.has(edge.source.nodeId) && canvasNodeIds.has(edge.target.nodeId)
  )
  return orderByIds(edges, edgeOrder)
})
