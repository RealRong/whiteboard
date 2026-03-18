import { buildEdgeCreateOperation } from '../edge/commands'
import { createEdgeDuplicateInput } from '../edge/duplicate'
import { err, ok } from '../types'
import type {
  CoreRegistries,
  Document,
  Node,
  NodeId,
  NodeInput,
  Operation,
  Point,
  EdgeId,
  Result
} from '../types'
import { buildNodeCreateOperation } from './commands'
import { getContainerDescendants } from './group'
import { listEdges, listNodes } from '../types'

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

export const expandNodeSelection = (nodes: readonly Node[], selectedIds: NodeId[]) => {
  const nodeById = new Map<NodeId, Node>(nodes.map((node) => [node.id, node]))
  const expandedIds = new Set<NodeId>(selectedIds)

  selectedIds.forEach((id) => {
    const node = nodeById.get(id)
    if (node?.type !== 'group') return
    getContainerDescendants(Array.from(nodes), id).forEach((child) => {
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

const withCreatedNodes = (
  doc: Document,
  operations: readonly Extract<Operation, { type: 'node.create' }>[],
  operation?: Extract<Operation, { type: 'node.create' }>
): Document => {
  const nodes = { ...doc.nodes.entities }
  const order = [...doc.nodes.order]

  operations.forEach(({ node }) => {
    nodes[node.id] = node
    if (!order.includes(node.id)) {
      order.push(node.id)
    }
  })

  if (operation) {
    nodes[operation.node.id] = operation.node
    if (!order.includes(operation.node.id)) {
      order.push(operation.node.id)
    }
  }

  return {
    ...doc,
    nodes: {
      entities: nodes,
      order
    }
  }
}

const withCreatedEdges = (
  doc: Document,
  operations: readonly Extract<Operation, { type: 'edge.create' }>[],
  operation?: Extract<Operation, { type: 'edge.create' }>
): Document => {
  const edges = { ...doc.edges.entities }
  const order = [...doc.edges.order]

  operations.forEach(({ edge }) => {
    edges[edge.id] = edge
    if (!order.includes(edge.id)) {
      order.push(edge.id)
    }
  })

  if (operation) {
    edges[operation.edge.id] = operation.edge
    if (!order.includes(operation.edge.id)) {
      order.push(operation.edge.id)
    }
  }

  return {
    ...doc,
    edges: {
      entities: edges,
      order
    }
  }
}

export const buildNodeDuplicateOperations = ({
  doc,
  ids,
  registries,
  createNodeId,
  createEdgeId,
  offset
}: BuildNodeDuplicateOperationsInput): Result<{
  operations: Operation[]
  nodeIds: NodeId[]
  edgeIds: EdgeId[]
}, 'invalid'> => {
  if (!ids.length) {
    return err('invalid', 'No nodes selected.')
  }

  const orderedNodes = listNodes(doc)
  const { expandedIds, nodeById } = expandNodeSelection(orderedNodes, Array.from(ids))
  const selectedNodes = Array.from(expandedIds)
    .map((id) => nodeById.get(id))
    .filter((node): node is Node => Boolean(node))
  if (!selectedNodes.length) {
    return err('invalid', 'No nodes selected.')
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
  const nodeIds: NodeId[] = []
  const edgeIds: EdgeId[] = []
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
      doc: withCreatedNodes(doc, duplicatedNodeOperations),
      registries,
      createNodeId: () => duplicatedNodeId
    })
    if (!planned.ok) {
      return err('invalid', planned.error.message)
    }

    duplicatedNodeOperations.push(planned.data.operation)
    operations.push(planned.data.operation)
    nodeIds.push(planned.data.nodeId)
    sourceToDuplicatedId.set(sourceNode.id, planned.data.nodeId)
  }

  const selectedEdges = listEdges(doc).filter(
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
      doc: withCreatedEdges(withCreatedNodes(doc, duplicatedNodeOperations), duplicatedEdgeOperations),
      registries,
      createEdgeId: () => duplicatedEdgeId
    })
    if (!planned.ok) {
      return err('invalid', planned.error.message)
    }

    duplicatedEdgeOperations.push(planned.data.operation)
    operations.push(planned.data.operation)
    edgeIds.push(planned.data.edgeId)
  }

  return ok({
    operations,
    nodeIds,
    edgeIds
  })
}
