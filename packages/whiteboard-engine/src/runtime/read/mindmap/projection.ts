import type { NodeId } from '@whiteboard/core/types'
import {
  READ_PUBLIC_KEYS,
  READ_SUBSCRIBE_KEYS,
  type MindmapView,
  type MindmapViewTree
} from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '../context'
import { cache as createMindmapCache } from './cache'

export type MindmapReadSnapshot = {
  readonly ids: NodeId[]
  readonly byId: ReadonlyMap<NodeId, MindmapViewTree>
}

export type MindmapProjection = {
  getSnapshot: () => MindmapReadSnapshot
}

type MindmapProjectionCache = {
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

export const projection = (context: ReadRuntimeContext): MindmapProjection => {
  const cache = createMindmapCache(context)
  let projectionCache: MindmapProjectionCache | undefined

  const getSnapshot: MindmapProjection['getSnapshot'] = () => {
    const trees = cache.trees({
      visibleNodes: context.get(READ_SUBSCRIBE_KEYS.snapshot).nodes.visible,
      layout: context.get(READ_PUBLIC_KEYS.mindmapLayout)
    })
    if (projectionCache && isSameMindmapTreeList(projectionCache.trees, trees)) {
      return projectionCache.view
    }

    const view: MindmapView = {
      ids: trees.map((entry) => entry.id),
      byId: new Map(trees.map((entry) => [entry.id, entry]))
    }
    projectionCache = {
      trees,
      view
    }
    return view
  }

  return {
    getSnapshot
  }
}
