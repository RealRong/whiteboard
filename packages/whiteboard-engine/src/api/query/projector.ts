import type { State } from '@engine-types/instance'
import type { QueryIndexes } from './indexes'
import type { CanvasNodes } from '../../kernel/projector/canvas'

type Options = {
  state: State
  canvas: CanvasNodes
  indexes: QueryIndexes
}

export const startQueryProjector = ({ state, canvas, indexes }: Options) => {
  const syncFull = () => {
    indexes.syncFull(state.read('canvasNodes'))
  }

  const syncOrder = () => {
    indexes.syncOrder(state.read('canvasNodes').map((node) => node.id))
  }

  syncFull()
  return canvas.watch(({ dirtyNodeIds, orderChanged, fullSync }) => {
    if (fullSync) {
      syncFull()
      return
    }
    if (dirtyNodeIds?.length) {
      const done = indexes.syncDirty(dirtyNodeIds, canvas.readById)
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
