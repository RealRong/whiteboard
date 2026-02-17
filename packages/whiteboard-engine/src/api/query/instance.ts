import type {
  InstanceConfig,
  QueryDebugSnapshot,
  Query,
  State
} from '@engine-types/instance'
import { createCanvas } from './canvas'
import { createQueryIndexes } from './indexes'
import { startQueryProjector } from './projector'
import { createSnap } from './snap'

type Options = {
  state: State
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createQuery = ({
  state,
  config,
  getContainer
}: Options): Query => {
  const indexes = createQueryIndexes({
    config
  })
  startQueryProjector({
    state,
    indexes
  })

  const canvasQuery = createCanvas({
    indexes,
    config,
    getContainer
  })
  const snapQuery = createSnap({
    indexes
  })

  const getMetrics = (): QueryDebugSnapshot => ({
    canvas: canvasQuery.debug.getMetrics(),
    snap: snapQuery.debug.getMetrics()
  })

  return {
    ...canvasQuery,
    ...snapQuery,
    watchNodeChanges: indexes.watchNodeChanges,
    debug: {
      getMetrics,
      resetMetrics: (target) => {
        if (target === 'canvas') {
          canvasQuery.debug.resetMetrics()
          return
        }
        if (target === 'snap') {
          snapQuery.debug.resetMetrics()
          return
        }
        canvasQuery.debug.resetMetrics()
        snapQuery.debug.resetMetrics()
      }
    }
  }
}
