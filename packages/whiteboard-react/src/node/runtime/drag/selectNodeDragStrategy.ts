import type { Node } from '@whiteboard/core'
import { groupNodeDragStrategy } from './groupNodeDragStrategy'
import { plainNodeDragStrategy } from './plainNodeDragStrategy'
import type { NodeDragStrategy } from 'types/node/drag'

export const selectNodeDragStrategy = (nodeType: Node['type']): NodeDragStrategy => {
  if (nodeType === 'group') {
    return groupNodeDragStrategy
  }
  return plainNodeDragStrategy
}
