import type { Node, NodeId, NodePatch, Point } from '@whiteboard/core'
import {
  findSmallestGroupContainingPoint,
  getGroupDescendants,
  getNodesBoundingRect,
  expandGroupRect,
  rectEquals
} from '../../utils/group'
import { getNodeAABB, rectContains } from '../../../geometry/geometry'
import type { NodeDragGroupOptions, NodeDragStrategy, NodeDragTransientApi } from '@engine-types/node/drag'

const commitNodeTransient = (
  nodeId: NodeId,
  position: Point,
  transient?: NodeDragTransientApi
) => {
  if (!transient) return
  transient.commitOverrides([{ id: nodeId, position }])
}

const handleDropToGroup = (context: {
  nodeId: NodeId
  finalPos: Point
  currentNode: Node
  hoveredId?: NodeId
  group: NodeDragGroupOptions
  applyNodePatch: (nodeId: NodeId, patch: NodePatch) => void
  size: { width: number; height: number }
}) => {
  const { applyNodePatch, currentNode, finalPos, group, hoveredId, nodeId, size } = context
  const parentId = currentNode.parentId

  if (hoveredId && hoveredId !== parentId) {
    const hovered = group.nodes.find((node) => node.id === hoveredId)
    if (!hovered) return
    applyNodePatch(nodeId, { parentId: hovered.id })
    const groupRect = getNodeAABB(hovered, group.nodeSize)
    const children = getGroupDescendants(group.nodes, hovered.id)
    const virtualNode: Node = {
      ...currentNode,
      position: finalPos
    }
    const contentRect = getNodesBoundingRect([...children, virtualNode], group.nodeSize)
    if (!contentRect) return
    const padding =
      hovered.data && typeof hovered.data.padding === 'number' ? hovered.data.padding : group.padding ?? 24
    const expanded = expandGroupRect(groupRect, contentRect, padding)
    if (rectEquals(expanded, groupRect)) return
    applyNodePatch(hovered.id, {
      position: { x: expanded.x, y: expanded.y },
      size: { width: expanded.width, height: expanded.height }
    })
    return
  }

  if (!hoveredId && parentId) {
    const parent = group.nodes.find((node) => node.id === parentId)
    if (!parent) return
    const nodeRect = { x: finalPos.x, y: finalPos.y, width: size.width, height: size.height }
    const parentRect = getNodeAABB(parent, group.nodeSize)
    if (!rectContains(parentRect, nodeRect)) {
      applyNodePatch(nodeId, { parentId: undefined })
    }
  }
}

export const plainNodeDragStrategy: NodeDragStrategy = {
  key: 'plain',
  initialize: () => undefined,
  handleMove: ({ applyNodePatch, group, nodeId, size, transient, updateHoverGroup, nextPosition }) => {
    const { x: nextX, y: nextY } = nextPosition

    if (group) {
      const center = { x: nextX + size.width / 2, y: nextY + size.height / 2 }
      const hovered = findSmallestGroupContainingPoint(group.nodes, group.nodeSize, center, nodeId)
      updateHoverGroup(hovered?.id)
    }

    if (transient) {
      transient.setOverrides([{ id: nodeId, position: { x: nextX, y: nextY } }])
      return
    }

    applyNodePatch(nodeId, { position: { x: nextX, y: nextY } })
  },
  handlePointerUp: ({
    drag,
    getHoverGroupId,
    group,
    nodeId,
    nodeType,
    applyNodePatch,
    position,
    size,
    transient,
    updateHoverGroup
  }) => {
    const finalPos = drag.last ?? { x: position.x, y: position.y }
    commitNodeTransient(nodeId, finalPos, transient)

    if (!group) return

    if (nodeType !== 'group') {
      const currentNode = group.nodes.find((node) => node.id === nodeId)
      if (currentNode) {
        handleDropToGroup({
          applyNodePatch,
          currentNode,
          finalPos,
          group,
          hoveredId: getHoverGroupId(),
          nodeId,
          size
        })
      }
    }

    updateHoverGroup(undefined)
  }
}
