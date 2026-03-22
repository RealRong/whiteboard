import {
  createValueStore,
  type ValueStore
} from '@whiteboard/core/runtime'
import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import {
  createNodeSessionStore,
  type NodeSessionStore
} from './node'

export type NodeChromeHidden = boolean

export type NodeFeatureRuntime = {
  session: NodeSessionStore
  chromeHidden: ValueStore<NodeChromeHidden>
  clear: () => void
}

export const createNodeFeatureRuntime = (): NodeFeatureRuntime => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const node = createNodeSessionStore(schedule)
  const chromeHidden = createValueStore<NodeChromeHidden>(false)

  flushAll.push(node.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    session: node,
    chromeHidden,
    clear: () => {
      task.cancel()
      chromeHidden.set(false)
      node.clear()
    }
  }
}
