import type { ViewSnapshot } from '@engine-types/instance/view'
import type { NodeId } from '@whiteboard/core'
import {
  isSameIdOrder,
  notifyListeners,
  watchEntity,
  watchSet
} from './shared'

type MindmapTreeViewEntry = ViewSnapshot['mindmap.trees'][number]

type Options = {
  readTrees: () => ViewSnapshot['mindmap.trees']
}

export type MindmapRegistry = {
  sync: () => void
  getMindmapTreeIds: () => NodeId[]
  watchMindmapTreeIds: (listener: () => void) => () => void
  getMindmapTree: (treeId: NodeId) => MindmapTreeViewEntry | undefined
  watchMindmapTree: (treeId: NodeId, listener: () => void) => () => void
}

export const createMindmapRegistry = ({
  readTrees
}: Options): MindmapRegistry => {
  const mindmapTreeIdsListeners = new Set<() => void>()
  const mindmapTreeListeners = new Map<NodeId, Set<() => void>>()

  let mindmapTreeIds: NodeId[] = []
  let mindmapTreesById = new Map<NodeId, MindmapTreeViewEntry>()

  const sync: MindmapRegistry['sync'] = () => {
    const trees = readTrees()
    const nextIds = trees.map((tree) => tree.id)
    const nextById = new Map<NodeId, MindmapTreeViewEntry>()
    trees.forEach((tree) => {
      nextById.set(tree.id, tree)
    })

    const changedIds = new Set<NodeId>()
    nextById.forEach((tree, treeId) => {
      if (mindmapTreesById.get(treeId) !== tree) {
        changedIds.add(treeId)
      }
    })
    mindmapTreesById.forEach((_, treeId) => {
      if (!nextById.has(treeId)) {
        changedIds.add(treeId)
      }
    })

    const treeOrderChanged = !isSameIdOrder(mindmapTreeIds, nextIds)
    if (treeOrderChanged) {
      mindmapTreeIds = nextIds
      notifyListeners(mindmapTreeIdsListeners)
    }
    mindmapTreesById = nextById

    changedIds.forEach((treeId) => {
      notifyListeners(mindmapTreeListeners.get(treeId))
    })
  }

  return {
    sync,
    getMindmapTreeIds: () => mindmapTreeIds,
    watchMindmapTreeIds: (listener) => watchSet(mindmapTreeIdsListeners, listener),
    getMindmapTree: (treeId) => mindmapTreesById.get(treeId),
    watchMindmapTree: (treeId, listener) =>
      watchEntity(mindmapTreeListeners, treeId, listener)
  }
}
