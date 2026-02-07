import type { Core, Node, NodeId, Point } from '@whiteboard/core'
import {
  findSmallestGroupContainingPoint,
  getGroupDescendants,
  getNodesBoundingRect,
  expandGroupRect,
  rectEquals
} from '../../utils/group'
import { getNodeAABB, rectContains } from '../../../common/utils/geometry'
import type { NodeDragGroupOptions, NodeDragStrategy, NodeDragTransientApi } from './types'

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
  core: Core
  size: { width: number; height: number }
}) => {
  const { core, currentNode, finalPos, group, hoveredId, nodeId, size } = context
  const parentId = currentNode.parentId

  if (hoveredId && hoveredId !== parentId) {
    const hovered = group.nodes.find((node) => node.id === hoveredId)
    if (!hovered) return
    core.dispatch({ type: 'node.update', id: nodeId, patch: { parentId: hovered.id } })
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
    core.dispatch({
      type: 'node.update',
      id: hovered.id,
      patch: {
        position: { x: expanded.x, y: expanded.y },
        size: { width: expanded.width, height: expanded.height }
      }
    })
    return
  }

  if (!hoveredId && parentId) {
    const parent = group.nodes.find((node) => node.id === parentId)
    if (!parent) return
    const nodeRect = { x: finalPos.x, y: finalPos.y, width: size.width, height: size.height }
    const parentRect = getNodeAABB(parent, group.nodeSize)
    if (!rectContains(parentRect, nodeRect)) {
      core.dispatch({ type: 'node.update', id: nodeId, patch: { parentId: undefined } })
    }
  }
}

export const plainNodeDragStrategy: NodeDragStrategy = {
  key: 'plain',
  initialize: () => undefined,
  handleMove: ({ core, group, nodeId, size, transient, updateHoverGroup, nextPosition }) => {
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

    core.dispatch({
      type: 'node.update',
      id: nodeId,
      patch: {
        position: { x: nextX, y: nextY }
      }
    })
  },
  handlePointerUp: ({
    core,
    drag,
    getHoverGroupId,
    group,
    nodeId,
    nodeType,
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
          core,
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
