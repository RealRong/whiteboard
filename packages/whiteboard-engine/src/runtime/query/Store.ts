import type { Query } from '@engine-types/instance/query'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { ProjectionStore } from '@engine-types/projection'
import { createCanvas } from './Canvas'
import { createGeometry } from './Geometry'
import { createQueryIndexes } from './Indexes'
import { createSnap } from './Snap'

type Options = {
  projection: ProjectionStore
  config: InstanceConfig
  getContainer: () => HTMLDivElement | null
}

export type QueryRuntime = {
  query: Query
}

export const createQueryRuntime = ({
  projection,
  config,
  getContainer
}: Options): QueryRuntime => {
  const indexes = createQueryIndexes({
    config
  })
  let syncedCanvasNodes = projection.read().canvasNodes
  indexes.syncFull(syncedCanvasNodes)

  const ensureIndexesSynced = () => {
    const canvasNodes = projection.read().canvasNodes
    if (canvasNodes === syncedCanvasNodes) return
    syncedCanvasNodes = canvasNodes
    indexes.syncFull(canvasNodes)
  }

  const canvas = createCanvas({
    indexes,
    getContainer,
    ensureIndexesSynced
  })
  const snap = createSnap({
    indexes,
    ensureIndexesSynced
  })
  const geometry = createGeometry({
    config
  })

  return {
    query: {
      canvas,
      snap,
      geometry
    }
  }
}
