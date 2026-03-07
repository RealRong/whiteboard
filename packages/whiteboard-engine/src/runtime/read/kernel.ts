import type { Deps as ReadDeps } from '@engine-types/read/deps'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type EngineRead,
  type NodeViewItem,
  type ReadSubscriptionKey,
  type ViewportTransformView
} from '@engine-types/instance/read'
import type { ReadContext } from '@engine-types/read/context'
import type { ReadImpact } from '@engine-types/read/impact'
import type { ReadIndexes } from '@engine-types/read/indexer'
import type { Atom } from 'jotai/vanilla'
import { atom } from 'jotai/vanilla'
import type { Node, NodeId, Viewport } from '@whiteboard/core/types'
import { DEFAULT_TUNING } from '../../config'
import { compileReadControl } from './control'
import { createReadApply } from './apply'
import { createReadSignals } from './signals'
import { createReadModel } from './stages/model'
import { cache as createEdgeCache } from './stages/edge/cache'
import { cache as createMindmapCache } from './stages/mindmap/cache'
import { NodeRectIndex } from './stages/index/NodeRectIndex'
import { SnapIndex } from './stages/index/SnapIndex'

export type ReadPort = {
  read: EngineRead
  ingest: (impact: ReadImpact) => void
}

const toViewportTransform = (viewport: Viewport): ViewportTransformView => {
  const zoom = viewport.zoom
  return {
    center: viewport.center,
    zoom,
    transform: `translate(50%, 50%) scale(${zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
    cssVars: {
      '--wb-zoom': `${zoom}`
    }
  }
}

export const createReadKernel = ({
  store,
  stateAtoms,
  config,
  viewport
}: ReadDeps): ReadPort => {
  const nodeSignalAtom = atom(0)
  const edgeSignalAtom = atom(0)
  const mindmapSignalAtom = atom(0)
  const readDocument = () => store.get(stateAtoms.document)
  const readModel = createReadModel({ readDocument })

  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )
  const indexes: ReadIndexes = {
    canvas: {
      all: nodeRectIndex.all,
      byId: nodeRectIndex.byId,
      idsInRect: nodeRectIndex.nodeIdsInRect
    },
    snap: {
      all: snapIndex.all,
      inRect: snapIndex.queryInRect
    }
  }

  const state: ReadContext['state'] = {
    interaction: () => store.get(stateAtoms.interaction),
    tool: () => store.get(stateAtoms.tool),
    selection: () => store.get(stateAtoms.selection),
    viewport: () => store.get(stateAtoms.viewport),
    mindmapLayout: () => store.get(stateAtoms.mindmapLayout)
  }

  const subscribableAtomMap = {
    [READ_STATE_KEYS.interaction]: stateAtoms.interaction,
    [READ_STATE_KEYS.tool]: stateAtoms.tool,
    [READ_STATE_KEYS.selection]: stateAtoms.selection,
    [READ_STATE_KEYS.viewport]: stateAtoms.viewport,
    [READ_STATE_KEYS.mindmapLayout]: stateAtoms.mindmapLayout,
    [READ_SUBSCRIPTION_KEYS.node]: nodeSignalAtom,
    [READ_SUBSCRIPTION_KEYS.edge]: edgeSignalAtom,
    [READ_SUBSCRIPTION_KEYS.mindmap]: mindmapSignalAtom
  } as Record<ReadSubscriptionKey, Atom<unknown>>

  const subscribe: ReadContext['subscribe'] = (keys, listener) => {
    const unsubs = keys.map((key) => store.sub(subscribableAtomMap[key], listener))
    return () => unsubs.forEach((off) => off())
  }

  const readContext: ReadContext = {
    state,
    model: readModel,
    subscribe,
    indexes,
    config
  }

  const edgeCache = createEdgeCache(readContext)
  const mindmapCache = createMindmapCache(readContext)
  const nodeItemCacheById = new Map<NodeId, NodeViewItem>()
  let viewportRef: Viewport | undefined
  let viewportTransformCache: ViewportTransformView | undefined
  let nodeViewCache: EngineRead['projection']['node'] | undefined
  let nodeViewIdsRef: readonly NodeId[] | undefined
  let nodeViewByIdRef: ReadonlyMap<NodeId, Node> | undefined

  const signals = createReadSignals({
    store,
    atoms: {
      node: nodeSignalAtom,
      edge: edgeSignalAtom,
      mindmap: mindmapSignalAtom
    }
  })

  const apply = createReadApply({
    readModel,
    nodeRectIndex,
    snapIndex,
    edgeCache,
    applySignals: signals.apply
  })

  nodeRectIndex.applyChange({ rebuild: 'full', nodeIds: [] }, readModel())
  snapIndex.applyChange({ rebuild: 'full', nodeIds: [] }, nodeRectIndex)

  const getViewportTransform = () => {
    const currentViewport = state.viewport()
    if (viewportTransformCache && viewportRef === currentViewport) {
      return viewportTransformCache
    }
    viewportRef = currentViewport
    viewportTransformCache = toViewportTransform(currentViewport)
    return viewportTransformCache
  }

  const resolveNodeItem = (
    nodeById: ReadonlyMap<NodeId, Node>,
    id: NodeId
  ): NodeViewItem | undefined => {
    const node = nodeById.get(id)
    if (!node) {
      nodeItemCacheById.delete(id)
      return undefined
    }

    const rect = indexes.canvas.byId(id)?.rect ?? {
      x: node.position.x,
      y: node.position.y,
      width: node.size?.width ?? 0,
      height: node.size?.height ?? 0
    }
    const rotation = typeof node.rotation === 'number' ? node.rotation : 0
    const transformBase = `translate(${rect.x}px, ${rect.y}px)`
    const previous = nodeItemCacheById.get(id)
    if (
      previous &&
      previous.node === node &&
      previous.rect === rect &&
      previous.container.rotation === rotation &&
      previous.container.transformBase === transformBase
    ) {
      return previous
    }

    const next: NodeViewItem = {
      node,
      rect,
      container: {
        transformBase,
        rotation,
        transformOrigin: 'center center'
      }
    }
    nodeItemCacheById.set(id, next)
    return next
  }

  const getNodeView = () => {
    const model = readModel()
    const ids = model.indexes.canvasNodeIds
    const nodeById = model.indexes.canvasNodeById

    if (
      nodeViewCache &&
      nodeViewIdsRef === ids &&
      nodeViewByIdRef === nodeById
    ) {
      return nodeViewCache
    }

    const byId = new Map<NodeId, NodeViewItem>()
    const seenIds = new Set<NodeId>()
    ids.forEach((id) => {
      seenIds.add(id)
      const item = resolveNodeItem(nodeById, id)
      if (!item) return
      byId.set(id, item)
    })
    nodeItemCacheById.forEach((_, id) => {
      if (seenIds.has(id)) return
      nodeItemCacheById.delete(id)
    })

    nodeViewIdsRef = ids
    nodeViewByIdRef = nodeById
    nodeViewCache = {
      ids,
      byId
    }
    return nodeViewCache
  }

  const read: EngineRead = {
    state: {
      get interaction() { return state.interaction() },
      get tool() { return state.tool() },
      get selection() { return state.selection() },
      get viewport() { return state.viewport() },
      get mindmapLayout() { return state.mindmapLayout() }
    },
    projection: {
      get viewportTransform() { return getViewportTransform() },
      get node() { return getNodeView() },
      get edge() { return edgeCache.getView() },
      get mindmap() { return mindmapCache.getView() }
    },
    viewport: {
      get: viewport.get,
      getZoom: viewport.getZoom,
      screenToWorld: viewport.screenToWorld,
      worldToScreen: viewport.worldToScreen,
      clientToScreen: viewport.clientToScreen,
      clientToWorld: viewport.clientToWorld,
      getScreenCenter: viewport.getScreenCenter,
      getContainerSize: viewport.getContainerSize
    },
    index: {
      nodeRects: indexes.canvas.all,
      nodeRect: indexes.canvas.byId,
      nodeIdsInRect: indexes.canvas.idsInRect,
      snapCandidates: indexes.snap.all,
      snapCandidatesInRect: indexes.snap.inRect
    },
    config,
    get document() { return readDocument() },
    subscribe
  }

  const ingest = (impact: ReadImpact) => {
    apply(compileReadControl(impact))
  }

  return {
    read,
    ingest
  }
}
