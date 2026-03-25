import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import {
  createNodeSessionStore,
  type NodeSessionStore
} from './node'

export type NodeFeatureRuntime = {
  session: NodeSessionStore
  clear: () => void
}

export const createNodeFeatureRuntime = (): NodeFeatureRuntime => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const node = createNodeSessionStore(schedule)

  flushAll.push(node.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    session: node,
    clear: () => {
      task.cancel()
      node.clear()
    }
  }
}
