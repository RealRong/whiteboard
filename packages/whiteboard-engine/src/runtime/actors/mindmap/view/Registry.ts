import type { ViewSnapshot } from '@engine-types/instance/view'
import type { NodeId } from '@whiteboard/core'
import {
  isSameIdOrder,
  notifyListeners,
  watchEntity,
  watchSet
} from '../../../common/view/shared'

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

  const hasSubscribers = () =>
    mindmapTreeIdsListeners.size > 0 || mindmapTreeListeners.size > 0

  const pull = () => {
    const trees = readTrees()
    mindmapTreeIds = trees.map((tree) => tree.id)
    mindmapTreesById = new Map<NodeId, MindmapTreeViewEntry>(
      trees.map((tree) => [tree.id, tree])
    )
  }

  const sync: MindmapRegistry['sync'] = () => {
    if (!hasSubscribers()) return
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
    getMindmapTreeIds: () => {
      if (!hasSubscribers()) {
        pull()
      }
      return mindmapTreeIds
    },
    watchMindmapTreeIds: (listener) => {
      pull()
      return watchSet(mindmapTreeIdsListeners, listener)
    },
    getMindmapTree: (treeId) => {
      if (!hasSubscribers()) {
        pull()
      }
      return mindmapTreesById.get(treeId)
    },
    watchMindmapTree: (treeId, listener) => {
      pull()
      return watchEntity(mindmapTreeListeners, treeId, listener)
    }
  }
}
