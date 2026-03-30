import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  type StagedValueStore
} from '@whiteboard/engine'
import { createRafValueStore } from '../../../runtime/utils/rafStore'

type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragProjection = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

type BaseMindmapDragProjectionStore =
  Pick<StagedValueStore<MindmapDragProjection | undefined>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type MindmapDragProjectionStore =
  Pick<BaseMindmapDragProjectionStore, 'get' | 'subscribe'> & {
    set: (next?: MindmapDragProjection) => void
    clear: () => void
  }

export const createMindmapDragProjectionStore = (): MindmapDragProjectionStore => {
  const store = createRafValueStore({
    initial: undefined as MindmapDragProjection | undefined,
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
