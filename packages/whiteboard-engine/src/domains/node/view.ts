import type {
  ProjectionCommit,
  ProjectionSnapshot
} from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type {
  NodeViewItem,
  NodesView
} from '@engine-types/instance/view'
import type { Node, NodeId, Rect } from '@whiteboard/core/types'
import { toLayerOrderedCanvasNodes } from '@whiteboard/core/node'
import { hasImpactTag } from '../../runtime/mutation/Impact'
import { isSameIdOrder } from '../../runtime/view/shared'

type Options = {
  query: Query
  readProjection: () => ProjectionSnapshot
}

export type NodeDomain = {
  applyCommit: (commit: ProjectionCommit) => boolean
  getState: () => NodesView
}

const getNodeRect = (query: Query, node: Node): Rect =>
  query.canvas.nodeRect(node.id)?.rect ?? {
    x: node.position.x,
    y: node.position.y,
    width: node.size?.width ?? 0,
    height: node.size?.height ?? 0
  }

const projectNodeItem = (options: {
  node: Node
  query: Query
  previous?: NodeViewItem
}): NodeViewItem => {
  const { node, query, previous } = options
  const rect = getNodeRect(query, node)
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0
  const transformBase = `translate(${rect.x}px, ${rect.y}px)`

  if (
    previous
    && previous.node === node
    && previous.rect === rect
    && previous.container.rotation === rotation
    && previous.container.transformBase === transformBase
  ) {
    return previous
  }

  return {
    node,
    rect,
    container: {
      transformBase,
      rotation,
      transformOrigin: 'center center'
    }
  }
}

const ensureMutableMap = <T>(
  current: Map<NodeId, T>,
  next: Map<NodeId, T>
) => (next === current ? new Map(current) : next)

export const createNodeDomain = ({
  query,
  readProjection
}: Options): NodeDomain => {
  let nodeItemsById = new Map<NodeId, NodeViewItem>()
  let nodeIds: NodeId[] = []

  const syncByIds = (
    targetNodeIds: Iterable<NodeId>,
    canvasNodeById: ReadonlyMap<NodeId, Node>
  ) => {
    let nextById = nodeItemsById
    let changed = false

    for (const nodeId of targetNodeIds) {
      const node = canvasNodeById.get(nodeId)
      const previous = nodeItemsById.get(nodeId)

      if (!node) {
        if (!previous) continue
        nextById = ensureMutableMap(nodeItemsById, nextById)
        nextById.delete(nodeId)
        changed = true
        continue
      }

      const next = projectNodeItem({
        node,
        query,
        previous
      })
      if (previous === next) continue

      nextById = ensureMutableMap(nodeItemsById, nextById)
      nextById.set(nodeId, next)
      changed = true
    }

    if (!changed) return false
    nodeItemsById = nextById
    return true
  }

  const syncNodeOrder = () => {
    const nextNodeIds = toLayerOrderedCanvasNodes(readProjection().nodes.canvas).map(
      (node) => node.id
    )
    if (isSameIdOrder(nodeIds, nextNodeIds)) return false
    nodeIds = nextNodeIds
    return true
  }

  const syncFull = () => {
    const snapshot = readProjection()
    let changed = syncNodeOrder()
    const changedNodeIds = new Set<NodeId>(nodeIds)
    for (const nodeId of nodeItemsById.keys()) {
      changedNodeIds.add(nodeId)
    }
    if (!changedNodeIds.size) return changed
    changed = syncByIds(
      changedNodeIds,
      snapshot.indexes.canvasNodeById
    ) || changed
    return changed
  }

  const applyCommit = (commit: ProjectionCommit) => {
    const impact = commit.impact
    const fullSync = commit.kind === 'replace' || hasImpactTag(impact, 'full')
    if (fullSync) {
      return syncFull()
    }

    const dirtyNodeIds = impact.dirtyNodeIds
    const orderChanged = hasImpactTag(impact, 'order')
    const nodesChanged = hasImpactTag(impact, 'nodes')
    const hasDirtyNodeIds = Boolean(dirtyNodeIds?.length)

    if (!orderChanged && !nodesChanged && !hasDirtyNodeIds) {
      return false
    }

    let changed = false
    const snapshot = readProjection()
    if (dirtyNodeIds?.length) {
      changed = syncByIds(
        dirtyNodeIds,
        snapshot.indexes.canvasNodeById
      ) || changed
    }

    if (orderChanged) {
      changed = syncNodeOrder() || changed
    }

    if (nodesChanged && !hasDirtyNodeIds) {
      changed = syncFull() || changed
    }
    return changed
  }

  const getState = (): NodesView => ({
    ids: nodeIds,
    byId: nodeItemsById
  })

  return {
    applyCommit,
    getState
  }
}
