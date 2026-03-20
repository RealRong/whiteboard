import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import {
  createEdgeConnectSessionStore,
  type EdgeConnectSessionStore
} from './connect'
import {
  createEdgePathSessionStore,
  type EdgePathSessionStore
} from './path'

export type EdgeFeatureRuntime = {
  path: EdgePathSessionStore
  connection: EdgeConnectSessionStore
  clear: () => void
}

export const createEdgeFeatureRuntime = (): EdgeFeatureRuntime => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const path = createEdgePathSessionStore(schedule)
  const connection = createEdgeConnectSessionStore(schedule)

  flushAll.push(path.flush, connection.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    path,
    connection,
    clear: () => {
      task.cancel()
      path.clear()
      connection.clear()
    }
  }
}
