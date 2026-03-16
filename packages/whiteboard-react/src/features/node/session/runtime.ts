import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import {
  createGuidesSessionStore,
  type GuidesSessionStore
} from './guides'
import {
  createNodeSessionStore,
  type NodeSessionStore
} from './node'

export type NodeFeatureRuntime = {
  session: NodeSessionStore
  guides: GuidesSessionStore
  clear: () => void
}

export const createNodeFeatureRuntime = (): NodeFeatureRuntime => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const node = createNodeSessionStore(schedule)
  const guides = createGuidesSessionStore(schedule)

  flushAll.push(node.flush, guides.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    session: node,
    guides,
    clear: () => {
      task.cancel()
      node.clear()
      guides.clear()
    }
  }
}
