import type { NodeId } from '@whiteboard/core/types'
import type { MindmapViewTree } from '@whiteboard/engine'
import type { WhiteboardRead } from '../instance/types'
import type { KeyedView } from './types'

export const createMindmapView = (
  read: WhiteboardRead
): KeyedView<NodeId | undefined, MindmapViewTree | undefined> => ({
  get: (treeId) => {
    if (!treeId) return undefined
    return read.mindmap.get(treeId)
  },
  subscribe: (treeId, listener) => {
    if (!treeId) return () => {}
    return read.mindmap.subscribe(treeId, listener)
  }
})
