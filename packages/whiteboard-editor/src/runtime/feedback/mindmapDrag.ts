import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  createRafValueStore,
  type StagedValueStore
} from '@whiteboard/engine'

type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragFeedback = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

type BaseMindmapDragFeedbackStore =
  Pick<StagedValueStore<MindmapDragFeedback | undefined>, 'get' | 'subscribe' | 'write' | 'clear'>

export type MindmapDragFeedbackRuntime =
  Pick<BaseMindmapDragFeedbackStore, 'get' | 'subscribe'> & {
    set: (next?: MindmapDragFeedback) => void
    clear: () => void
  }

export const createMindmapDragFeedback = (): MindmapDragFeedbackRuntime => {
  const store = createRafValueStore({
    initial: undefined as MindmapDragFeedback | undefined,
    isEqual: (left, right) => left === right
  })

  return {
    get: store.get,
    subscribe: store.subscribe,
    set: (next) => {
      if (!next) {
        store.clear()
        return
      }

      store.write(next)
    },
    clear: store.clear
  }
}
