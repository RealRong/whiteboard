import type { Rect } from '@whiteboard/core/types'
import {
  createStagedValueStore,
  type StagedValueStore
} from '@whiteboard/core/runtime'
import { createRafTask, type RafTask } from '../utils/rafTask'
import { isRectEqual } from '../utils/equality'

type SelectionBoxSessionStore =
  Pick<StagedValueStore<Rect | undefined>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

export type SelectionBoxStore =
  Pick<SelectionBoxSessionStore, 'get' | 'subscribe' | 'write' | 'clear'>

const createSelectionBoxSessionStore = (
  schedule: () => void
) => createStagedValueStore({
  schedule,
  initial: undefined as Rect | undefined,
  isEqual: isRectEqual
})

export const createSelectionBoxStore = (): SelectionBoxStore => {
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const store = createSelectionBoxSessionStore(schedule)

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
