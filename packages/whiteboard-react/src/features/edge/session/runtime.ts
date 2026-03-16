import { createRafTask, type RafTask } from '../../../runtime/utils/rafTask'
import {
  createEdgeConnectSessionStore,
  type EdgeConnectSessionStore
} from './connect'
import {
  createEdgeRoutingSessionStore,
  type EdgeRoutingSessionStore
} from './routing'

export type EdgeFeatureRuntime = {
  routing: EdgeRoutingSessionStore
  connection: EdgeConnectSessionStore
  clear: () => void
}

export const createEdgeFeatureRuntime = (): EdgeFeatureRuntime => {
  const flushAll: Array<() => void> = []
  let task!: RafTask
  const schedule = () => {
    task.schedule()
  }

  const routing = createEdgeRoutingSessionStore(schedule)
  const connection = createEdgeConnectSessionStore(schedule)

  flushAll.push(routing.flush, connection.flush)

  task = createRafTask(() => {
    flushAll.forEach((flush) => {
      flush()
    })
  }, { fallback: 'microtask' })

  return {
    routing,
    connection,
    clear: () => {
      task.cancel()
      routing.clear()
      connection.clear()
    }
  }
}
