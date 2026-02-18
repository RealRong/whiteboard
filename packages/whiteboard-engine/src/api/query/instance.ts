import type {
  QueryDebugSnapshot,
  Query
} from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { CanvasNodes } from '../../kernel/projector/canvas'
import { createCanvas } from './canvas'
import { createGeometry } from './geometry'
import { createQueryIndexes } from './indexes'
import { startQueryProjector } from './projector'
import { createSnap } from './snap'

type Options = {
  state: State
  canvas: CanvasNodes
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export const createQuery = ({
  state,
  canvas,
  config,
  getContainer
}: Options): Query => {
  const indexes = createQueryIndexes({
    config
  })
  startQueryProjector({
    state,
    canvas,
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
