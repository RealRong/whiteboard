import type { NodeId } from '@whiteboard/core/types'
import type { MindmapView, MindmapViewTree } from '@engine-types/instance/read'

type MindmapViewModelOptions = {
  getTrees: () => MindmapViewTree[]
}

export type MindmapReadSnapshot = {
  readonly ids: NodeId[]
  readonly byId: ReadonlyMap<NodeId, MindmapViewTree>
}

export type MindmapViewModel = {
  getSnapshot: () => MindmapReadSnapshot
}

type MindmapViewCache = {
  trees: MindmapViewTree[]
  view: MindmapView
}

const isSameMindmapTreeList = (
  left: readonly MindmapViewTree[],
  right: readonly MindmapViewTree[]
) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const viewModel = ({
  getTrees
}: MindmapViewModelOptions): MindmapViewModel => {
  let cache: MindmapViewCache | undefined

  const getSnapshot: MindmapViewModel['getSnapshot'] = () => {
    const trees = getTrees()
    if (cache && isSameMindmapTreeList(cache.trees, trees)) {
      return cache.view
    }

    const view: MindmapView = {
      ids: trees.map((entry) => entry.id),
      byId: new Map(trees.map((entry) => [entry.id, entry]))
    }
    cache = {
      trees,
      view
    }
    return view
  }

  return {
    getSnapshot
  }
}
