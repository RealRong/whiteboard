import type { GraphChange, GraphProjector } from '@engine-types/graph'
import { toChangeView } from '../../runtime/actors/graph/sync/ChangeView'
import {
  hasDirtyNodeHints,
  shouldSyncCanvasNodes
} from '../../runtime/actors/graph/sync/Policy'
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
    const changeView = toChangeView(change)
    const { source, fullSync, dirtyNodeIds, orderChanged } = changeView

    if (!shouldSyncCanvasNodes(changeView)) {
      return
    }
    if (fullSync) {
      syncFull()
      return
    }
    if (hasDirtyNodeHints(changeView) && dirtyNodeIds) {
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
