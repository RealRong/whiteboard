import type { Node, NodeId, Point } from '@whiteboard/core'
import { getGroupDescendants } from '../../utils/group'
import type { NodeViewUpdate } from 'types/state'
import { plainNodeDragStrategy } from './plainNodeDragStrategy'
import type { NodeDragChildren, NodeDragStrategy } from 'types/node/drag'

const buildGroupChildren = (context: {
  groupNodes: Node[]
  nodeId: NodeId
  origin: Point
}): NodeDragChildren | undefined => {
  const children = getGroupDescendants(context.groupNodes, context.nodeId).map((child) => child.id)
  if (!children.length) return undefined

  const offsets = new Map<NodeId, Point>()
  children.forEach((childId) => {
    const childNode = context.groupNodes.find((node) => node.id === childId)
    if (!childNode) return
    offsets.set(childId, {
      x: childNode.position.x - context.origin.x,
      y: childNode.position.y - context.origin.y
    })
  })

  return {
    ids: children,
    offsets
  }
}

export const groupNodeDragStrategy: NodeDragStrategy = {
  key: 'group',
  initialize: ({ group, nodeId, position }) => {
    if (!group) return undefined
    return buildGroupChildren({
      groupNodes: group.nodes,
      nodeId,
      origin: position
    })
  },
  handleMove: (context) => {
    const { core, drag, nodeId, transient } = context
    const nextX = context.nextPosition.x
    const nextY = context.nextPosition.y

    if (!drag.children) {
      plainNodeDragStrategy.handleMove(context)
      return
    }

    const updates: NodeViewUpdate[] = [
      {
        id: nodeId,
        position: { x: nextX, y: nextY }
      }
    ]
    drag.children.ids.forEach((childId) => {
      const offset = drag.children?.offsets.get(childId)
      if (!offset) return
      updates.push({
        id: childId,
        position: { x: nextX + offset.x, y: nextY + offset.y }
      })
    })

    if (transient) {
      transient.setOverrides(updates)
      return
    }

    core.model.node.updateMany(
      updates.map((item) => ({ id: item.id, patch: { position: item.position as Point } }))
    )
  },
  handlePointerUp: (context) => {
    const { drag, nodeId, position, transient, updateHoverGroup } = context

    if (!drag.children) {
      plainNodeDragStrategy.handlePointerUp(context)
      return
    }

    if (transient) {
      const finalPos = drag.last ?? { x: position.x, y: position.y }
      const updates: NodeViewUpdate[] = [{ id: nodeId, position: finalPos }]
      drag.children.ids.forEach((childId) => {
        const offset = drag.children?.offsets.get(childId)
        if (!offset) return
        updates.push({ id: childId, position: { x: finalPos.x + offset.x, y: finalPos.y + offset.y } })
      })
      transient.commitOverrides(updates)
    }

    updateHoverGroup(undefined)
  }
}
