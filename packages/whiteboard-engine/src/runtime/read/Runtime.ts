import { atom, createStore } from 'jotai/vanilla'
import type { Atom } from 'jotai/vanilla'
import { toLayerOrderedCanvasNodes } from '@whiteboard/core/node'
import type { EdgeId, Node, NodeId, Viewport } from '@whiteboard/core/types'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type {
  EdgeEndpoints,
  EdgePathEntry,
  EngineRead,
  MindmapView,
  MindmapViewTree,
  NodeViewItem,
  ViewportTransformView
} from '@engine-types/instance/read'
import type { ProjectionStore } from '@engine-types/projection'
import type { State } from '@engine-types/instance/state'
import type { StateAtoms } from '../../state/factory'
import { createEdgePathStore } from '../query/EdgePath'
import { createEdgeEndpointsResolver } from '../../domains/edge/view'
import { createMindmapViewDerivations } from '../../domains/mindmap/view'

type Options = {
  projection: ProjectionStore
  state: State
  stateStore: ReturnType<typeof createStore>
  stateAtoms: StateAtoms
  query: Query
  config: InstanceConfig
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

const isSameNodeOrder = (left: readonly string[], right: readonly string[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const isSameMindmapTreeList = (left: readonly MindmapViewTree[], right: readonly MindmapViewTree[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

type MindmapViewCache = {
  trees: MindmapViewTree[]
  view: MindmapView
}

export const createReadRuntime = ({
  projection,
  state,
  stateStore,
  stateAtoms,
  query,
  config
}: Options): EngineRead => {
  const store = stateStore
  const projectionSnapshotAtom = atom(projection.getSnapshot())
  const selectionAtom = stateAtoms.selection
  const mindmapLayoutAtom = stateAtoms.mindmapLayout
  const viewportAtom = stateAtoms.viewport
  const edgePathRevisionAtom = atom(0)

  const resolveEndpoints = createEdgeEndpointsResolver(query.canvas.nodeRect)
  const edgePathStore = createEdgePathStore({
    readProjection: () => store.get(projectionSnapshotAtom),
    getNodeRect: query.canvas.nodeRect,
    resolveEndpoints
  })

  const nodeByIdAtoms = new Map<NodeId, Atom<NodeViewItem | undefined>>()
  const edgeByIdAtoms = new Map<EdgeId, Atom<EdgePathEntry | undefined>>()
  const mindmapByIdAtoms = new Map<NodeId, Atom<MindmapViewTree | undefined>>()

  const nodeItemCacheById = new Map<NodeId, NodeViewItem>()
  let nodeIdsCache: NodeId[] = []
  let nodeIdsSourceRef: Node[] | undefined
  let edgeSelectedEndpointsCache: EdgeEndpoints | undefined
  let mindmapViewCache: MindmapViewCache | undefined

  const readState = state.read
  const mindmapDerivations = createMindmapViewDerivations({
    readState,
    readProjection: () => store.get(projectionSnapshotAtom),
    config
  })

  const viewportTransformAtom = atom((get) =>
    toViewportTransform(get(viewportAtom))
  )

  const nodeIdsAtom = atom((get) => {
    const canvasNodes = get(projectionSnapshotAtom).nodes.canvas
    if (canvasNodes === nodeIdsSourceRef) return nodeIdsCache
    const next = toLayerOrderedCanvasNodes(canvasNodes).map((node) => node.id)
    if (isSameNodeOrder(nodeIdsCache, next)) {
      nodeIdsSourceRef = canvasNodes
      return nodeIdsCache
    }
    nodeIdsSourceRef = canvasNodes
    nodeIdsCache = next
    return nodeIdsCache
  })

  const createNodeByIdAtom = (id: NodeId) => {
    const cached = nodeByIdAtoms.get(id)
    if (cached) return cached
    const nextAtom = atom((get) => {
      const snapshot = get(projectionSnapshotAtom)
      const node = snapshot.indexes.canvasNodeById.get(id)
      if (!node) {
        nodeItemCacheById.delete(id)
        return undefined
      }
      const rect = query.canvas.nodeRect(id)?.rect ?? {
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
    })
    nodeByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  const edgeIdsAtom = atom((get) => {
    get(edgePathRevisionAtom)
    return edgePathStore.getIds()
  })

  const createEdgeByIdAtom = (id: EdgeId) => {
    const cached = edgeByIdAtoms.get(id)
    if (cached) return cached
    const nextAtom = atom((get) => {
      get(edgePathRevisionAtom)
      return edgePathStore.getById().get(id)
    })
    edgeByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  const selectedEdgeIdAtom = atom((get) => get(selectionAtom).selectedEdgeId)

  const edgeSelectedEndpointsAtom = atom((get) => {
    get(edgePathRevisionAtom)
    const selectedEdgeId = get(selectedEdgeIdAtom)
    const edge = selectedEdgeId ? edgePathStore.getEdge(selectedEdgeId) : undefined
    const next = edge ? resolveEndpoints(edge) : undefined

    const changed =
      edgeSelectedEndpointsCache?.source.point.x !== next?.source.point.x ||
      edgeSelectedEndpointsCache?.source.point.y !== next?.source.point.y ||
      edgeSelectedEndpointsCache?.target.point.x !== next?.target.point.x ||
      edgeSelectedEndpointsCache?.target.point.y !== next?.target.point.y ||
      edgeSelectedEndpointsCache?.source.nodeId !== next?.source.nodeId ||
      edgeSelectedEndpointsCache?.target.nodeId !== next?.target.nodeId

    if (changed) {
      edgeSelectedEndpointsCache = next
    }
    return edgeSelectedEndpointsCache
  })

  const mindmapTreesAtom = atom((get) => {
    get(projectionSnapshotAtom)
    get(mindmapLayoutAtom)
    return mindmapDerivations.trees()
  })

  const mindmapViewAtom = atom((get) => {
    const trees = get(mindmapTreesAtom)
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
  })

  const mindmapIdsAtom = atom((get) => get(mindmapViewAtom).ids)

  const createMindmapByIdAtom = (id: NodeId) => {
    const cached = mindmapByIdAtoms.get(id)
    if (cached) return cached
    const nextAtom = atom((get) => get(mindmapViewAtom).byId.get(id))
    mindmapByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  projection.subscribe((commit) => {
    edgePathStore.applyCommit(commit)
    store.set(projectionSnapshotAtom, commit.snapshot)
    store.set(edgePathRevisionAtom, (previous: number) => previous + 1)
  })

  const atoms = {
    viewportTransform: viewportTransformAtom,
    nodeIds: nodeIdsAtom,
    nodeById: createNodeByIdAtom,
    edgeIds: edgeIdsAtom,
    edgeById: createEdgeByIdAtom,
    selectedEdgeId: selectedEdgeIdAtom,
    edgeSelectedEndpoints: edgeSelectedEndpointsAtom,
    mindmapIds: mindmapIdsAtom,
    mindmapById: createMindmapByIdAtom
  }

  return {
    store,
    atoms,
    get: {
      viewportTransform: () => store.get(atoms.viewportTransform),
      nodeIds: () => store.get(atoms.nodeIds),
      nodeById: (id) => store.get(atoms.nodeById(id)),
      edgeIds: () => store.get(atoms.edgeIds),
      edgeById: (id) => store.get(atoms.edgeById(id)),
      selectedEdgeId: () => store.get(atoms.selectedEdgeId),
      edgeSelectedEndpoints: () => store.get(atoms.edgeSelectedEndpoints),
      mindmapIds: () => store.get(atoms.mindmapIds),
      mindmapById: (id) => store.get(atoms.mindmapById(id))
    }
  }
}
