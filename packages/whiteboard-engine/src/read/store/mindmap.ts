import type { ReadContext } from '@engine-types/read'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { MindmapViewTree } from '@engine-types/instance'
import type { Node, NodeId } from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../../config'
import {
  buildMindmapLines,
  computeMindmapLayout,
  getMindmapLabel,
  getMindmapTree
} from '@whiteboard/core/mindmap'
import { notifyListeners, subscribeListener } from './subscriptions'

type MindmapTreeCacheKey = {
  treeId: string
  rootId: string
  rootRef: Node
  treeNodesRef: MindmapViewTree['tree']['nodes']
  treeChildrenRef: MindmapViewTree['tree']['children']
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

const MINDMAP_CACHE_SCALAR_KEYS = [
  'treeId',
  'rootId',
  'rootRef',
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

const isSameIds = (left: readonly NodeId[], right: readonly NodeId[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const toCacheKey = ({
  tree,
  root,
  layout,
  nodeSize
}: {
  tree: MindmapViewTree['tree']
  root: Node
  layout: MindmapLayoutConfig
  nodeSize: { width: number; height: number }
}): MindmapTreeCacheKey => ({
  treeId: tree.id,
  rootId: tree.rootId,
  rootRef: root,
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

export const createMindmapProjection = (context: ReadContext) => {
  const config = context.config
  const idsListeners = new Set<() => void>()
  const listenersById = new Map<NodeId, Set<() => void>>()
  let treeCache = new Map<NodeId, MindmapTreeCacheEntry>()
  let entryById = new Map<NodeId, MindmapViewTree>()
  let idsRef: readonly NodeId[] = []
  let visibleNodesRef: readonly Node[] | undefined
  let layoutRef: MindmapLayoutConfig | undefined

  const buildTree = (
    root: Node,
    tree: MindmapViewTree['tree'],
    layout: MindmapLayoutConfig
  ): MindmapViewTree => {
    const computed = computeMindmapLayout(tree, config.mindmapNodeSize, layout)
    const shiftX = -computed.bbox.x
    const shiftY = -computed.bbox.y
    const labels = Object.fromEntries(
      Object.entries(tree.nodes).map(([nodeId, node]) => [nodeId, getMindmapLabel(node)])
    )

    return {
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
  }

  const reconcile = () => {
    const visibleNodes = context.model().nodes.visible
    const layout = context.mindmapLayout()
    if (visibleNodes === visibleNodesRef && layout === layoutRef) {
      return {
        idsChanged: false,
        changedTreeIds: new Set<NodeId>()
      }
    }

    visibleNodesRef = visibleNodes
    layoutRef = layout

    const roots = visibleNodes.filter((node) => node.type === 'mindmap')
    const resolvedLayout: MindmapLayoutConfig = {
      mode: layout.mode ?? DEFAULT_TUNING.mindmap.defaultMode,
      options: layout.options
    }

    const previousIds = idsRef
    const previousById = entryById
    const nextCache = new Map<NodeId, MindmapTreeCacheEntry>()
    const nextById = new Map<NodeId, MindmapViewTree>()
    const nextIds: NodeId[] = []
    const changedTreeIds = new Set<NodeId>()
    const previousTreeIds = new Set(previousIds)

    roots.forEach((root) => {
      const tree = getMindmapTree(root)
      if (!tree) return

      const cacheKey = toCacheKey({
        tree,
        root,
        layout: resolvedLayout,
        nodeSize: config.mindmapNodeSize
      })
      const previous = treeCache.get(root.id)
      const nextTree = previous && isSameCacheKey(previous.key, cacheKey)
        ? previous.tree
        : buildTree(root, tree, layout)
      const nextCacheEntry = {
        key: cacheKey,
        tree: nextTree
      }

      nextCache.set(root.id, nextCacheEntry)
      nextById.set(root.id, nextTree)
      nextIds.push(root.id)

      if (previousById.get(root.id) !== nextTree) {
        changedTreeIds.add(root.id)
      }

      previousTreeIds.delete(root.id)
    })

    previousTreeIds.forEach((treeId) => {
      changedTreeIds.add(treeId)
    })

    treeCache = nextCache
    entryById = nextById

    const idsChanged = !isSameIds(previousIds, nextIds)
    idsRef = nextIds

    return {
      idsChanged,
      changedTreeIds
    }
  }

  const ensureSynced = () => {
    reconcile()
  }

  const ids = () => {
    ensureSynced()
    return idsRef
  }

  const get = (treeId: NodeId) => {
    ensureSynced()
    return entryById.get(treeId)
  }

  const subscribe = (treeId: NodeId, listener: () => void) => {
    const treeListeners = listenersById.get(treeId) ?? new Set<() => void>()
    if (!listenersById.has(treeId)) {
      listenersById.set(treeId, treeListeners)
    }
    treeListeners.add(listener)
    return () => {
      treeListeners.delete(listener)
      if (!treeListeners.size) {
        listenersById.delete(treeId)
      }
    }
  }

  const subscribeIds = (listener: () => void) => subscribeListener(idsListeners, listener)

  const notifyTree = (treeId: NodeId) => {
    const treeListeners = listenersById.get(treeId)
    if (!treeListeners?.size) return
    notifyListeners(treeListeners)
  }

  const applyChange = (impact: KernelReadImpact) => {
    if (!impact.reset && !impact.mindmap.view && !impact.node.list && !impact.node.geometry) {
      return
    }

    const { idsChanged, changedTreeIds } = reconcile()

    if (idsChanged) {
      notifyListeners(idsListeners)
    }

    changedTreeIds.forEach((treeId) => {
      notifyTree(treeId)
    })
  }

  return {
    ids,
    get,
    subscribe,
    subscribeIds,
    applyChange
  }
}
