import type {
  QueryDebugSnapshot,
  Query
} from '@engine-types/instance/query'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { ProjectionChange, ProjectionStore } from '@engine-types/projection'
import { createCanvas } from './Canvas'
import { createGeometry } from './Geometry'
import { createQueryIndexes } from './Indexes'
import { createSnap } from './Snap'
import { createQueryProjector } from './Projector'

type Options = {
  projection: ProjectionStore
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export class QueryStore {
  readonly query: Query

  private readonly applyProjectionRuntime: (change: ProjectionChange) => void

  constructor({
    projection,
    config,
    getContainer
  }: Options) {
    const indexes = createQueryIndexes({
      config
    })
    const projector = createQueryProjector({
      projection,
      indexes
    })
    projector.syncFull()

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

    this.query = {
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

    this.applyProjectionRuntime = projector.applyProjection
  }

  apply = (change: ProjectionChange | undefined) => {
    if (!change) return
    this.applyProjectionRuntime(change)
  }
}
