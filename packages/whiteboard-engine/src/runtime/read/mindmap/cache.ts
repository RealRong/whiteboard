import type { MindmapLayoutConfig } from '@engine-types/mindmap/layout'
import {
  READ_PUBLIC_KEYS,
  READ_SUBSCRIBE_KEYS,
  type MindmapView,
  type MindmapViewTree
} from '@engine-types/instance/read'
import type { MindmapTree, Node, NodeId } from '@whiteboard/core/types'
import { isSameRefOrder } from '@whiteboard/core/utils'
import { DEFAULT_TUNING } from '../../../config'
import {
  buildMindmapLines,
  computeMindmapLayout,
  getMindmapLabel,
  getMindmapTree,
  getMindmapRoots
} from '@whiteboard/core/mindmap'
import type { ReadRuntimeContext } from '@engine-types/read/context'
import type {
  MindmapReadCache,
  MindmapReadSnapshot
} from '@engine-types/read/mindmap'

type MindmapCacheInput = {
  visibleNodes: Node[]
  layout: MindmapLayoutConfig
}

type MindmapTreeCacheKey = {
  treeId: string
  rootId: string
  treeNodesRef: MindmapTree['nodes']
  treeChildrenRef: MindmapTree['children']
  rootPositionX: number
  rootPositionY: number
  rootWidth: number | undefined
  rootHeight: number | undefined
  mode: 'simple' | 'tidy'
  hGap: number | undefined
  vGap: number | undefined
  side: 'left' | 'right' | 'both' | undefined
  nodeWidth: number
  nodeHeight: number
}

type MindmapTreeCacheEntry = {
  key: MindmapTreeCacheKey
  tree: MindmapViewTree
}

type MindmapProjectionCache = {
  trees: MindmapViewTree[]
  view: MindmapView
}

const MINDMAP_CACHE_SCALAR_KEYS = [
  'treeId',
  'rootId',
  'treeNodesRef',
  'treeChildrenRef',
  'rootPositionX',
  'rootPositionY',
  'rootWidth',
  'rootHeight',
  'mode',
  'hGap',
  'vGap',
  'side',
  'nodeWidth',
  'nodeHeight'
] as const satisfies readonly (keyof MindmapTreeCacheKey)[]

const toCacheKey = ({
  tree,
  root,
  layout,
  nodeSize
}: {
  tree: MindmapTree
  root: Node
  layout: MindmapLayoutConfig
  nodeSize: { width: number; height: number }
}): MindmapTreeCacheKey => ({
  treeId: tree.id,
  rootId: tree.rootId,
  treeNodesRef: tree.nodes,
  treeChildrenRef: tree.children,
  rootPositionX: root.position.x,
  rootPositionY: root.position.y,
  rootWidth: root.size?.width,
  rootHeight: root.size?.height,
  mode: layout.mode === 'tidy' ? 'tidy' : 'simple',
  hGap: layout.options?.hGap,
  vGap: layout.options?.vGap,
  side: layout.options?.side,
  nodeWidth: nodeSize.width,
  nodeHeight: nodeSize.height
})

const isSameCacheKey = (left: MindmapTreeCacheKey, right: MindmapTreeCacheKey) => {
  for (const key of MINDMAP_CACHE_SCALAR_KEYS) {
    if (left[key] !== right[key]) return false
  }
  return true
}

export const cache = (context: ReadRuntimeContext): MindmapReadCache => {
  const config = context.config
  let treeCache = new Map<string, MindmapTreeCacheEntry>()
  let projectionCache: MindmapProjectionCache | undefined

  const trees = ({
    visibleNodes,
    layout
  }: MindmapCacheInput): MindmapViewTree[] => {
    const allRoots = getMindmapRoots(visibleNodes)
    const nextCache = new Map<string, MindmapTreeCacheEntry>()
    const nextTrees: MindmapViewTree[] = []
    const layoutForCacheKey: MindmapLayoutConfig = {
      mode: layout.mode ?? DEFAULT_TUNING.mindmap.defaultMode,
      options: layout.options
    }

    allRoots.forEach((root) => {
      const tree = getMindmapTree(root)
      if (!tree) return

      const cacheKey = toCacheKey({
        tree,
        root,
        layout: layoutForCacheKey,
        nodeSize: config.mindmapNodeSize
      })
      const previous = treeCache.get(root.id)
      if (previous && isSameCacheKey(previous.key, cacheKey)) {
        nextCache.set(root.id, previous)
        nextTrees.push(previous.tree)
        return
      }

      const computed = computeMindmapLayout(tree, config.mindmapNodeSize, layout)
      const shiftX = -computed.bbox.x
      const shiftY = -computed.bbox.y
      const labels = Object.fromEntries(
        Object.entries(tree.nodes).map(([nodeId, node]) => [nodeId, getMindmapLabel(node)])
      )
      const treeModel: MindmapViewTree = {
        id: root.id,
        node: root,
        tree,
        layout,
        computed,
        shiftX,
        shiftY,
        lines: buildMindmapLines(tree, computed),
        labels
      }
      const cacheEntry = { key: cacheKey, tree: treeModel }
      nextCache.set(root.id, cacheEntry)
      nextTrees.push(treeModel)
    })

    treeCache = nextCache
    return nextTrees
  }

  const getSnapshot: MindmapReadCache['getSnapshot'] = () => {
    const nextTrees = trees({
      visibleNodes: context.get(READ_SUBSCRIBE_KEYS.snapshot).nodes.visible,
      layout: context.get(READ_PUBLIC_KEYS.mindmapLayout)
    })

    if (projectionCache && isSameRefOrder(projectionCache.trees, nextTrees)) {
      return projectionCache.view
    }

    const ids: NodeId[] = []
    const byId = new Map<NodeId, MindmapViewTree>()
    nextTrees.forEach((entry) => {
      ids.push(entry.id)
      byId.set(entry.id, entry)
    })

    const view: MindmapView = {
      ids,
      byId
    }
    projectionCache = {
      trees: nextTrees,
      view
    }
    return view
  }

  return {
    getSnapshot
  }
}
