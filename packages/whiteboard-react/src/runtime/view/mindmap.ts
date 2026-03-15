import type { NodeId } from '@whiteboard/core/types'
import type { MindmapViewTree } from '@whiteboard/engine'
import type { InternalWhiteboardInstance } from '../instance/types'
import type { KeyedView } from './types'

export const createMindmapView = (
  getInstance: () => InternalWhiteboardInstance
): KeyedView<NodeId | undefined, MindmapViewTree | undefined> => ({
  get: (treeId) => {
    if (!treeId) return undefined
    return getInstance().read.mindmap.get(treeId)
  },
  subscribe: (treeId, listener) => {
    if (!treeId) return () => {}
    return getInstance().read.mindmap.subscribe(treeId, listener)
  }
})
