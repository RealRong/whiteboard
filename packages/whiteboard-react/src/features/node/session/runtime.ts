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

export type NodePress = NodePressPhase | null

export type NodePressPhase = 'repeat' | 'retarget' | 'hold'

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
  press: ValueStore<NodePress>
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
  const press = createValueStore<NodePress>(null)

  flushAll.push(node.flush, guides.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    session: node,
    guides,
    press,
    clear: () => {
      task.cancel()
      press.set(null)
      node.clear()
      guides.clear()
    }
  }
}
