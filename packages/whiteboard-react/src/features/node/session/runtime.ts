import { createValueStore, type ValueStore } from '@whiteboard/core/runtime'
import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import {
  createGuidesSessionStore,
  type GuidesSessionStore
} from './guides'
import {
  createNodeSessionStore,
  type NodeSessionStore
} from './node'

export type NodePress = NodePressPhase | null

export type NodePressPhase = 'repeat' | 'retarget' | 'hold'

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
