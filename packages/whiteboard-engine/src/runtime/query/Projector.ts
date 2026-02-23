import type { ProjectionChange, ProjectionStore } from '@engine-types/projection'
import type { QueryIndexes } from './Indexes'

type Options = {
  projection: ProjectionStore
  indexes: QueryIndexes
}

export const createQueryProjector = ({ projection, indexes }: Options) => {
  const syncFull = () => {
    indexes.syncFull(projection.read().canvasNodes)
  }

  const syncOrder = () => {
    indexes.syncOrder(projection.read().canvasNodes.map((node) => node.id))
  }

  const applyProjection = (change: ProjectionChange) => {
    const fullSync = change.kind === 'full'
    const source = change.source
    const dirtyNodeIds = change.kind === 'partial' ? change.dirtyNodeIds : undefined
    const orderChanged = change.kind === 'partial' ? change.orderChanged : undefined
    const shouldSync =
      fullSync ||
      change.projection.canvasNodesChanged ||
      Boolean(dirtyNodeIds?.length) ||
      Boolean(orderChanged)
    if (!shouldSync) {
      return
    }
    if (fullSync) {
      syncFull()
      return
    }
    if (dirtyNodeIds?.length) {
      const done = indexes.syncDirty(dirtyNodeIds, projection.readNode, {
        skipSnap: source === 'runtime'
      })
      if (!done) {
        syncFull()
        return
      }
      if (orderChanged) {
        syncOrder()
      }
      return
    }
    if (orderChanged) {
      syncOrder()
      return
    }
    syncFull()
  }

  return {
    syncFull,
    applyProjection
  }
}
