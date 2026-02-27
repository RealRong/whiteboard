import { toLayerOrderedCanvasNodes } from '@whiteboard/core/node'
import type {
  EdgeId,
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { Query } from '@engine-types/instance/query'
import type {
  EdgePathEntry,
  MindmapView,
  MindmapViewTree
} from '@engine-types/instance/read'
import type {
  ProjectionCommit,
  ProjectionSnapshot
} from '@engine-types/projection'
import type { State } from '@engine-types/instance/state'
import { createEdgeEndpointsResolver } from '../../../domains/edge/view'
import { createMindmapViewDerivations } from '../../../domains/mindmap/view'
import { createEdgePathStore } from './edgePath/Query'

const isSameNodeOrder = (left: readonly string[], right: readonly string[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
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

type MindmapViewCache = {
  trees: MindmapViewTree[]
  view: MindmapView
}

type CreateMaterializedReadModelOptions = {
  readProjection: () => ProjectionSnapshot
  state: State
  query: Query
  config: InstanceConfig
}

export type MaterializedReadModel = {
  applyCommit: (commit: ProjectionCommit) => void
  getNodeIds: () => NodeId[]
  getEdgeIds: () => EdgeId[]
  getEdgeById: (edgeId: EdgeId) => EdgePathEntry | undefined
  getEdge: (edgeId: EdgeId) => EdgePathEntry['edge'] | undefined
  getMindmapIds: () => NodeId[]
  getMindmapById: (id: NodeId) => MindmapViewTree | undefined
}

export const createMaterializedReadModel = ({
  readProjection,
  state,
  query,
  config
}: CreateMaterializedReadModelOptions): MaterializedReadModel => {
  const resolveEndpoints = createEdgeEndpointsResolver(query.canvas.nodeRect)
  const edgePathStore = createEdgePathStore({
    readProjection,
    getNodeRect: query.canvas.nodeRect,
    resolveEndpoints
  })

  const mindmapDerivations = createMindmapViewDerivations({
    readState: state.read,
    readProjection,
    config
  })

  let nodeIdsCache: NodeId[] = []
  let nodeIdsSourceRef: Node[] | undefined
  let mindmapViewCache: MindmapViewCache | undefined

  const getNodeIds = () => {
    const canvasNodes = readProjection().nodes.canvas
    if (canvasNodes === nodeIdsSourceRef) return nodeIdsCache
    const next = toLayerOrderedCanvasNodes(canvasNodes).map((node) => node.id)
    if (isSameNodeOrder(nodeIdsCache, next)) {
      nodeIdsSourceRef = canvasNodes
      return nodeIdsCache
    }
    nodeIdsSourceRef = canvasNodes
    nodeIdsCache = next
    return nodeIdsCache
  }

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
    applyCommit: (commit) => {
      edgePathStore.applyCommit(commit)
    },
    getNodeIds,
    getEdgeIds: () => edgePathStore.getIds(),
    getEdgeById: (edgeId) => edgePathStore.getById().get(edgeId),
    getEdge: (edgeId) => edgePathStore.getEdge(edgeId),
    getMindmapIds: () => getMindmapView().ids,
    getMindmapById: (id) => getMindmapView().byId.get(id)
  }
}
