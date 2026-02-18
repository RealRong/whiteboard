import type {
  QueryDebugSnapshot,
  Query
} from '@engine-types/instance/query'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { GraphProjector } from '@engine-types/graph'
import { createCanvas } from './canvas'
import { createGeometry } from './geometry'
import { createQueryIndexes } from './indexes'
import { startQueryProjector } from './projector'
import { createSnap } from './snap'

type Options = {
  graph: GraphProjector
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createQuery = ({
  graph,
  config,
  getContainer
}: Options): Query => {
  const indexes = createQueryIndexes({
    config
  })
  startQueryProjector({
    graph,
    indexes
  })

  const canvasQuery = createCanvas({
    indexes,
    getContainer
  })
  const snapQuery = createSnap({
    indexes
  })
  const geometryQuery = createGeometry({
    config
  })

  const getMetrics = (): QueryDebugSnapshot => ({
    canvas: canvasQuery.debug.getMetrics(),
    snap: snapQuery.debug.getMetrics()
  })

  return {
    canvas: canvasQuery.query,
    snap: snapQuery.query,
    geometry: geometryQuery,
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
