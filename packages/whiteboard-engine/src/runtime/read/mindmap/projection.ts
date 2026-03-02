import type { NodeId } from '@whiteboard/core/types'
import { isSameRefOrder } from '@whiteboard/core/utils'
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

export const projection = (context: ReadRuntimeContext): MindmapProjection => {
  const cache = createMindmapCache(context)
  let projectionCache: MindmapProjectionCache | undefined

  const getSnapshot: MindmapProjection['getSnapshot'] = () => {
    const trees = cache.trees({
      visibleNodes: context.get(READ_SUBSCRIBE_KEYS.snapshot).nodes.visible,
      layout: context.get(READ_PUBLIC_KEYS.mindmapLayout)
    })
    if (projectionCache && isSameRefOrder(projectionCache.trees, trees)) {
      return projectionCache.view
    }

    const ids: NodeId[] = []
    const byId = new Map<NodeId, MindmapViewTree>()
    trees.forEach((entry) => {
      ids.push(entry.id)
      byId.set(entry.id, entry)
    })

    const view: MindmapView = {
      ids,
      byId
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
