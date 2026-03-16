import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import {
  createMindmapDragSessionStore,
  type MindmapDragSessionStore
} from './drag'

export type MindmapFeatureRuntime = {
  drag: MindmapDragSessionStore
  clear: () => void
}

export const createMindmapFeatureRuntime = (): MindmapFeatureRuntime => {
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const drag = createMindmapDragSessionStore(schedule)

  task = createRafTask(() => {
    drag.flush()
  }, { fallback: 'microtask' })

  return {
    drag,
    clear: () => {
      task.cancel()
      drag.clear()
    }
  }
}
