import type { Node } from '@whiteboard/core'
import { groupNodeDragStrategy } from './groupNodeDragStrategy'
import { plainNodeDragStrategy } from './plainNodeDragStrategy'
import type { NodeDragGroupOptions, NodeDragStrategy } from 'types/node/drag'

export const selectNodeDragStrategy = (
  nodeType: Node['type'],
  group?: NodeDragGroupOptions
): NodeDragStrategy => {
  if (nodeType === 'group' && group) {
    return groupNodeDragStrategy
  }
  return plainNodeDragStrategy
}
