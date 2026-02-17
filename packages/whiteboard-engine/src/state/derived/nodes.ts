import { atom } from 'jotai'
import type { Node, NodeId } from '@whiteboard/core'
import {
  getCollapsedGroupIds,
  isHiddenByCollapsedGroup
} from '../../node/utils/group'
import { nodeOrderAtom, orderByIds } from './order'
import { viewNodesAtom } from './viewNodes'

export const orderedViewNodesAtom = atom<Node[]>((get) => {
  const viewNodes = get(viewNodesAtom)
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
    if (isHiddenByCollapsedGroup(node, nodeMap, collapsedGroupIds)) {
      hiddenNodeIds.add(node.id)
    }
  })

  return viewNodes.filter((node) => !hiddenNodeIds.has(node.id))
})

export const canvasNodesAtom = atom<Node[]>((get) => {
  const visibleNodes = get(visibleNodesAtom)
  return visibleNodes.filter((node) => node.type !== 'mindmap')
})
