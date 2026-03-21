import type { Guide } from '@whiteboard/core/node'
import {
  createStagedValueStore,
  createValueStore,
  type StagedValueStore,
  type ValueStore
} from '@whiteboard/core/runtime'
import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import {
  createNodeSessionStore,
  type NodeSessionStore
} from './node'

export type NodeChromeHidden = boolean

export type GuidesSessionStore =
  Pick<StagedValueStore<readonly Guide[]>, 'get' | 'subscribe' | 'write' | 'clear' | 'flush'>

const EMPTY_GUIDES: readonly Guide[] = []

const createGuidesSessionStore = (
  schedule: () => void
) => {
  const store = createStagedValueStore({
    schedule,
    initial: EMPTY_GUIDES,
    isEqual: (left, right) => left === right
  })

  return {
    get: store.get,
    subscribe: store.subscribe,
    write: (next: readonly Guide[]) => {
      store.write(next.length ? next : EMPTY_GUIDES)
    },
    clear: store.clear,
    flush: store.flush
  }
}

export type NodeFeatureRuntime = {
  session: NodeSessionStore
  guides: GuidesSessionStore
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
  const guides = createGuidesSessionStore(schedule)
  const chromeHidden = createValueStore<NodeChromeHidden>(false)

  flushAll.push(node.flush, guides.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    session: node,
    guides,
    chromeHidden,
    clear: () => {
      task.cancel()
      chromeHidden.set(false)
      node.clear()
      guides.clear()
    }
  }
}
