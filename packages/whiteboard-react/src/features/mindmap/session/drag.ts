import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/engine'
import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'

type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragState = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

type BaseMindmapDragStore =
  Pick<StagedValueStore<MindmapDragState | undefined>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type MindmapDragStore =
  Pick<BaseMindmapDragStore, 'get' | 'subscribe' | 'write'> & {
    clear: () => void
  }

export const createMindmapDragStore = (): MindmapDragStore => {
  let task!: RafTask
  const store = createStagedValueStore({
    schedule: () => {
      task.schedule()
    },
    initial: undefined as MindmapDragState | undefined,
    isEqual: (left, right) => left === right
  })

  task = createRafTask(() => {
    store.flush()
  }, { fallback: 'microtask' })

  return {
    get: store.get,
    subscribe: store.subscribe,
    write: store.write,
    clear: () => {
      task.cancel()
      store.clear()
    }
  }
}
