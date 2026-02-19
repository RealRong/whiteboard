import type { GraphChange, GraphProjector } from '@engine-types/graph'
import { toChangeView } from '../../graph/change'
import type { QueryIndexes } from './indexes'

type Options = {
  graph: GraphProjector
  indexes: QueryIndexes
}

export const createQueryProjector = ({ graph, indexes }: Options) => {
  const syncFull = () => {
    indexes.syncFull(graph.read().canvasNodes)
  }

  const syncOrder = () => {
    indexes.syncOrder(graph.read().canvasNodes.map((node) => node.id))
  }

  const syncGraph = (change: GraphChange) => {
    const {
      source,
      fullSync,
      dirtyNodeIds,
      orderChanged,
      canvasNodesChanged
    } = toChangeView(change)

    if (!fullSync && !canvasNodesChanged && !dirtyNodeIds?.length && !orderChanged) {
      return
    }
    if (fullSync) {
      syncFull()
      return
    }
    if (dirtyNodeIds?.length) {
      const done = indexes.syncDirty(dirtyNodeIds, graph.readNode, {
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
    syncGraph
  }
}
