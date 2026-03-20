import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import type { InternalInstance } from '../../runtime/instance'
import type { NodeDefinition, NodeScene } from '../../types/node'

const isPointInRect = (
  point: Point,
  rect: Rect
) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

export const getNodeScene = (
  definition?: Pick<NodeDefinition, 'scene'>
): NodeScene => definition?.scene === 'container'
  ? 'container'
  : 'content'

export const filterNodeIdsByScene = (
  instance: Pick<InternalInstance, 'read' | 'registry'>,
  nodeIds: readonly NodeId[],
  scene: NodeScene
): readonly NodeId[] => nodeIds.filter((nodeId) => {
  const item = instance.read.node.item.get(nodeId)
  if (!item) {
    return false
  }

  return getNodeScene(instance.registry.get(item.node.type)) === scene
})

export const readContainerBodyTarget = (
  instance: Pick<InternalInstance, 'read' | 'registry'>,
  point: Point
): NodeId | undefined => {
  const nodeIds = instance.read.node.list.get()

  for (let index = nodeIds.length - 1; index >= 0; index -= 1) {
    const nodeId = nodeIds[index]
    const entry = instance.read.index.node.get(nodeId)
    if (!entry) {
      continue
    }

    if (getNodeScene(instance.registry.get(entry.node.type)) !== 'container') {
      continue
    }

    if (isPointInRect(point, entry.rect)) {
      return nodeId
    }
  }

  return undefined
}
