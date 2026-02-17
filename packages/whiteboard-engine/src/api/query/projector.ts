import type { State } from '@engine-types/instance'
import type { QueryIndexes } from './indexes'

type Options = {
  state: State
  indexes: QueryIndexes
}

export const startQueryProjector = ({ state, indexes }: Options) => {
  const syncFull = () => {
    indexes.syncFull(state.read('canvasNodes'))
  }

  const syncOrder = () => {
    indexes.syncOrder(state.read('canvasNodes').map((node) => node.id))
  }

  syncFull()
  return state.watchCanvasNodeChanges(({ dirtyNodeIds, orderChanged, fullSync }) => {
    if (fullSync) {
      syncFull()
      return
    }
    if (dirtyNodeIds?.length) {
      const done = indexes.syncDirty(dirtyNodeIds, state.readCanvasNodeById)
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
  })
}
