import type { InstanceConfig } from '@engine-types/instance/config'
import type { MindmapView, MindmapViewTree } from '@engine-types/instance/read'
import type { State } from '@engine-types/instance/state'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { NodeId } from '@whiteboard/core/types'
import type { Change } from '../../write/pipeline/ChangeBus'
import { createMindmapDerivations } from './createMindmapDerivations'

type MindmapModelOptions = {
  readState: State['read']
  readSnapshot: () => ReadModelSnapshot
  config: InstanceConfig
}

export type MindmapReadModel = {
  applyChange: (change: Change) => void
  getMindmapIds: () => NodeId[]
  getMindmapById: (id: NodeId) => MindmapViewTree | undefined
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

export const createMindmapModel = ({
  readState,
  readSnapshot,
  config
}: MindmapModelOptions): MindmapReadModel => {
  const mindmapDerivations = createMindmapDerivations({
    readState,
    readSnapshot,
    config
  })

  let mindmapViewCache: MindmapViewCache | undefined

  const getMindmapView = () => {
    const trees = mindmapDerivations.trees()
    if (mindmapViewCache && isSameMindmapTreeList(mindmapViewCache.trees, trees)) {
      return mindmapViewCache.view
    }

    const view: MindmapView = {
      ids: trees.map((entry) => entry.id),
      byId: new Map(trees.map((entry) => [entry.id, entry]))
    }
    mindmapViewCache = {
      trees,
      view
    }
    return view
  }

  return {
    applyChange: () => {
      // Mindmap read model relies on readSnapshot/readState references; no explicit invalidation required.
    },
    getMindmapIds: () => getMindmapView().ids,
    getMindmapById: (id) => getMindmapView().byId.get(id)
  }
}
