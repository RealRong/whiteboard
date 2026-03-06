import { buildEdgeCreateOperation } from '../edge/commands'
import { createEdgeDuplicateInput } from '../edge/duplicate'
import type {
  CoreRegistries,
  CoreResult,
  Document,
  Node,
  NodeId,
  NodeInput,
  Operation,
  Point,
  EdgeId
} from '../types'
import { buildNodeCreateOperation } from './commands'
import { getGroupDescendants } from './group'

export const createNodeDuplicateInput = (
  node: Node,
  parentId: NodeId | undefined,
  delta: Point
): NodeInput => ({
  type: node.type,
  position: {
    x: node.position.x + delta.x,
    y: node.position.y + delta.y
  },
  size: node.size ? { width: node.size.width, height: node.size.height } : undefined,
  rotation: typeof node.rotation === 'number' ? node.rotation : undefined,
  layer: node.layer,
  zIndex: typeof node.zIndex === 'number' ? node.zIndex : undefined,
  locked: typeof node.locked === 'boolean' ? node.locked : undefined,
  data: node.data ? { ...node.data } : undefined,
  style: node.style ? { ...node.style } : undefined,
  parentId
})

export const expandNodeSelection = (nodes: Node[], selectedIds: NodeId[]) => {
  const nodeById = new Map<NodeId, Node>(nodes.map((node) => [node.id, node]))
  const expandedIds = new Set<NodeId>(selectedIds)

  selectedIds.forEach((id) => {
    const node = nodeById.get(id)
    if (node?.type !== 'group') return
    getGroupDescendants(nodes, id).forEach((child) => {
      expandedIds.add(child.id)
    })
  })

  return {
    nodeById,
    expandedIds
  }
}

type BuildNodeDuplicateOperationsInput = {
  doc: Document
  ids: readonly NodeId[]
  registries: CoreRegistries
  createNodeId: () => NodeId
  createEdgeId: () => EdgeId
  offset: Point
}

export const buildNodeDuplicateOperations = ({
  doc,
  ids,
  registries,
  createNodeId,
  createEdgeId,
  offset
}: BuildNodeDuplicateOperationsInput): CoreResult<{ operations: Operation[] }> => {
  if (!ids.length) {
    return {
      ok: false,
      message: 'No nodes selected.'
    }
  }

  const { expandedIds, nodeById } = expandNodeSelection(doc.nodes, Array.from(ids))
  const selectedNodes = Array.from(expandedIds)
    .map((id) => nodeById.get(id))
    .filter((node): node is Node => Boolean(node))
  if (!selectedNodes.length) {
    return {
      ok: false,
      message: 'No nodes selected.'
    }
  }

  const depthCache = new Map<NodeId, number>()
  const getDepth = (node: Node): number => {
    if (!node.parentId || !expandedIds.has(node.parentId)) return 0
    const cached = depthCache.get(node.id)
    if (typeof cached === 'number') return cached
    const parent = nodeById.get(node.parentId)
    const depth = parent ? getDepth(parent) + 1 : 0
    depthCache.set(node.id, depth)
    return depth
  }
  selectedNodes.sort((left, right) => getDepth(left) - getDepth(right))

  const operations: Operation[] = []
  const sourceToDuplicatedId = new Map<NodeId, NodeId>()
  const duplicatedNodeOperations: Extract<Operation, { type: 'node.create' }>[] = []
  const duplicatedEdgeOperations: Extract<Operation, { type: 'edge.create' }>[] = []

  for (const sourceNode of selectedNodes) {
    const duplicatedNodeId = createNodeId()
    const parentId =
      sourceNode.parentId && sourceToDuplicatedId.has(sourceNode.parentId)
        ? sourceToDuplicatedId.get(sourceNode.parentId)
        : sourceNode.parentId
    const payload = {
      ...createNodeDuplicateInput(sourceNode, parentId, offset),
      id: duplicatedNodeId
    }
    const planned = buildNodeCreateOperation({
      payload,
      doc: {
        ...doc,
        nodes: [...doc.nodes, ...duplicatedNodeOperations.map((operation) => operation.node)]
      },
      registries,
      createNodeId: () => duplicatedNodeId
    })
    if (!planned.ok) {
      return {
        ok: false,
        message: planned.message ?? 'Invalid node duplicate command.'
      }
    }

    duplicatedNodeOperations.push(planned.operation)
    operations.push(planned.operation)
    sourceToDuplicatedId.set(sourceNode.id, planned.operation.node.id)
  }

  const selectedEdges = doc.edges.filter(
    (edge) =>
      expandedIds.has(edge.source.nodeId)
      && expandedIds.has(edge.target.nodeId)
  )

  for (const sourceEdge of selectedEdges) {
    const sourceNodeId = sourceToDuplicatedId.get(sourceEdge.source.nodeId)
    const targetNodeId = sourceToDuplicatedId.get(sourceEdge.target.nodeId)
    if (!sourceNodeId || !targetNodeId) continue

    const duplicatedEdgeId = createEdgeId()
    const payload = {
      ...createEdgeDuplicateInput(sourceEdge, sourceNodeId, targetNodeId),
      id: duplicatedEdgeId
    }
    const planned = buildEdgeCreateOperation({
      payload,
      doc: {
        ...doc,
        nodes: [...doc.nodes, ...duplicatedNodeOperations.map((operation) => operation.node)],
        edges: [...doc.edges, ...duplicatedEdgeOperations.map((operation) => operation.edge)]
      },
      registries,
      createEdgeId: () => duplicatedEdgeId
    })
    if (!planned.ok) {
      return {
        ok: false,
        message: planned.message ?? 'Invalid node duplicate command.'
      }
    }

    duplicatedEdgeOperations.push(planned.operation)
    operations.push(planned.operation)
  }

  return {
    ok: true,
    operations
  }
}
