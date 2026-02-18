import type { GraphProjector } from '@engine-types/graph'
import type { QueryIndexes } from './indexes'

type Options = {
  graph: GraphProjector
  indexes: QueryIndexes
}

export const startQueryProjector = ({ graph, indexes }: Options) => {
  const syncFull = () => {
    indexes.syncFull(graph.read().canvasNodes)
  }

  const syncOrder = () => {
    indexes.syncOrder(graph.read().canvasNodes.map((node) => node.id))
  }

  syncFull()
  return graph.watch(({ dirtyNodeIds, orderChanged, fullSync, canvasNodesChanged }) => {
    if (!fullSync && !canvasNodesChanged && !dirtyNodeIds?.length && !orderChanged) {
      return
    }
    if (fullSync) {
      syncFull()
      return
    }
    if (dirtyNodeIds?.length) {
      const done = indexes.syncDirty(dirtyNodeIds, graph.readNode)
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
