import { buildEdgeCreateOperation } from '../edge/commands'
import { readEdgeRoutePoints } from '../edge/types'
import { resolveEdgeEnds } from '../edge/endpoints'
import { getAABBFromPoints, getNodeRect, getRectCenter } from '../geometry'
import {
  getGroupDescendants,
  getNodeOwnerMap,
  getNodesBoundingRect,
  isOwnerNode
} from '../node/group'
import { buildNodeCreateOperation } from '../node/commands'
import { createId } from '../utils/id'
import { cloneValue } from '../utils/merge'
import { err, ok } from '../types'
import type {
  CoreRegistries,
  Document,
  Edge,
  EdgeEnd,
  EdgeId,
  Node,
  NodeId,
  Operation,
  Point,
  Rect,
  Result,
  Size
} from '../types'
import {
  getEdge,
  getNode,
  isNodeEdgeEnd,
  listEdges,
  listNodes
} from '../types'

export type Slice = {
  version: 1
  nodes: Node[]
  edges: Edge[]
}

export type SliceRoots = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type SliceExportResult = {
  slice: Slice
  roots: SliceRoots
  bounds: Rect
}

export type SliceInsertOptions = {
  at?: Point
  offset?: Point
  ownerId?: NodeId
  roots?: SliceRoots
}

export type SliceInsertResult = {
  operations: Operation[]
  roots: SliceRoots
  allNodeIds: readonly NodeId[]
  allEdgeIds: readonly EdgeId[]
}

type ExportNodesInput = {
  doc: Document
  ids: readonly NodeId[]
  nodeSize: Size
}

type ExportEdgeInput = {
  doc: Document
  edgeId: EdgeId
  nodeSize: Size
}

type ExportSelectionInput = {
  doc: Document
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
  nodeSize: Size
}

type InsertSliceInput = {
  doc: Document
  slice: Slice
  nodeSize: Size
  registries: CoreRegistries
  createNodeId?: () => NodeId
  createEdgeId?: () => EdgeId
  at?: Point
  offset?: Point
  ownerId?: NodeId
  roots?: SliceRoots
}

const toRoots = (roots?: Partial<SliceRoots>): SliceRoots => ({
  nodeIds: roots?.nodeIds ? [...roots.nodeIds] : [],
  edgeIds: roots?.edgeIds ? [...roots.edgeIds] : []
})

const dedupeIds = <T extends string>(ids: readonly T[]) => [...new Set(ids)]

const cloneEdgeEnd = (end: EdgeEnd): EdgeEnd => (
  isNodeEdgeEnd(end)
    ? {
      ...cloneValue(end),
      anchor: end.anchor ? cloneValue(end.anchor) : undefined
    }
    : {
      kind: 'point',
      point: cloneValue(end.point)
    }
)

const cloneNode = (node: Node): Node => ({
  ...cloneValue(node),
  position: cloneValue(node.position),
  size: node.size ? cloneValue(node.size) : undefined,
  children: node.children ? [...node.children] : undefined,
  data: node.data ? cloneValue(node.data) : undefined,
  style: node.style ? cloneValue(node.style) : undefined
})

const filterNodeChildren = (
  node: Node,
  includedNodeIds: ReadonlySet<NodeId>
): Node => ({
  ...node,
  children: node.children
    ? node.children.filter((childId) => includedNodeIds.has(childId))
    : undefined
})

const cloneEdge = (edge: Edge): Edge => ({
  ...cloneValue(edge),
  source: cloneEdgeEnd(edge.source),
  target: cloneEdgeEnd(edge.target),
  route: edge.route ? cloneValue(edge.route) : undefined,
  style: edge.style ? cloneValue(edge.style) : undefined,
  label: edge.label ? cloneValue(edge.label) : undefined,
  data: edge.data ? cloneValue(edge.data) : undefined
})

const collectExpandedNodeIds = (
  nodes: readonly Node[],
  selectedIds: readonly NodeId[]
) => {
  const nodeById = new Map<NodeId, Node>(nodes.map((node) => [node.id, node]))
  const expandedIds = new Set<NodeId>()
  const stack = dedupeIds(selectedIds)

  while (stack.length) {
    const nodeId = stack.pop()
    if (!nodeId || expandedIds.has(nodeId)) continue

    const node = nodeById.get(nodeId)
    if (!node) continue

    expandedIds.add(nodeId)

    if (!isOwnerNode(node)) continue

    getGroupDescendants(nodes, nodeId).forEach((child) => {
      stack.push(child.id)
    })
  }

  return expandedIds
}

const getEdgeBounds = ({
  edge,
  nodesById,
  nodeSize
}: {
  edge: Edge
  nodesById: ReadonlyMap<NodeId, Node>
  nodeSize: Size
}): Rect | undefined => {
  const resolved = resolveEdgeEnds({
    edge,
    source: isNodeEdgeEnd(edge.source)
      ? (() => {
        const node = nodesById.get(edge.source.nodeId)
        if (!node) return undefined
        return {
          node,
          rect: getNodeRect(node, nodeSize),
          rotation: node.rotation
        }
      })()
      : undefined,
    target: isNodeEdgeEnd(edge.target)
      ? (() => {
        const node = nodesById.get(edge.target.nodeId)
        if (!node) return undefined
        return {
          node,
          rect: getNodeRect(node, nodeSize),
          rotation: node.rotation
        }
      })()
      : undefined
  })
  if (!resolved) return undefined

  const points: Point[] = [
    resolved.source.point,
    ...readEdgeRoutePoints(edge.route).map((point) => cloneValue(point)),
    resolved.target.point
  ]

  return points.length > 0 ? getAABBFromPoints(points) : undefined
}

const mergeRects = (rects: readonly Rect[]): Rect | undefined => {
  if (!rects.length) return undefined

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  rects.forEach((rect) => {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  })

  if (
    !Number.isFinite(minX)
    || !Number.isFinite(minY)
    || !Number.isFinite(maxX)
    || !Number.isFinite(maxY)
  ) {
    return undefined
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  }
}

export const getSliceBounds = (
  slice: Slice,
  nodeSize: Size
): Rect | undefined => {
  const nodeBounds = getNodesBoundingRect(slice.nodes, nodeSize)
  const nodesById = new Map<NodeId, Node>(slice.nodes.map((node) => [node.id, node]))
  const edgeBounds = slice.edges
    .map((edge) => getEdgeBounds({
      edge,
      nodesById,
      nodeSize
    }))
    .filter((rect): rect is Rect => Boolean(rect))

  return mergeRects([
    ...(nodeBounds ? [nodeBounds] : []),
    ...edgeBounds
  ])
}

const detachEdge = ({
  edge,
  doc,
  nodeSize
}: {
  edge: Edge
  doc: Document
  nodeSize: Size
}): Result<Edge, 'invalid'> => {
  const sourceNode = isNodeEdgeEnd(edge.source)
    ? getNode(doc, edge.source.nodeId)
    : undefined
  const targetNode = isNodeEdgeEnd(edge.target)
    ? getNode(doc, edge.target.nodeId)
    : undefined

  const resolved = resolveEdgeEnds({
    edge,
    source: sourceNode
      ? {
        node: sourceNode,
        rect: getNodeRect(sourceNode, nodeSize),
        rotation: sourceNode.rotation
      }
      : undefined,
    target: targetNode
      ? {
        node: targetNode,
        rect: getNodeRect(targetNode, nodeSize),
        rotation: targetNode.rotation
      }
      : undefined
  })

  if (!resolved) {
    return err('invalid', `Edge ${edge.id} could not be resolved.`)
  }

  return ok({
    ...cloneEdge(edge),
    source: {
      kind: 'point',
      point: cloneValue(resolved.source.point)
    },
    target: {
      kind: 'point',
      point: cloneValue(resolved.target.point)
    }
  })
}

const detachSelectionEdge = ({
  edge,
  doc,
  nodeIds,
  nodeSize
}: {
  edge: Edge
  doc: Document
  nodeIds: ReadonlySet<NodeId>
  nodeSize: Size
}): Result<Edge, 'invalid'> => {
  const sourceNode = isNodeEdgeEnd(edge.source)
    ? getNode(doc, edge.source.nodeId)
    : undefined
  const targetNode = isNodeEdgeEnd(edge.target)
    ? getNode(doc, edge.target.nodeId)
    : undefined
  const resolved = resolveEdgeEnds({
    edge,
    source: sourceNode
      ? {
        node: sourceNode,
        rect: getNodeRect(sourceNode, nodeSize),
        rotation: sourceNode.rotation
      }
      : undefined,
    target: targetNode
      ? {
        node: targetNode,
        rect: getNodeRect(targetNode, nodeSize),
        rotation: targetNode.rotation
      }
      : undefined
  })

  if (!resolved) {
    return err('invalid', `Edge ${edge.id} could not be resolved.`)
  }

  return ok({
    ...cloneEdge(edge),
    source:
      isNodeEdgeEnd(edge.source) && nodeIds.has(edge.source.nodeId)
        ? cloneEdgeEnd(edge.source)
        : {
          kind: 'point',
          point: cloneValue(resolved.source.point)
        },
    target:
      isNodeEdgeEnd(edge.target) && nodeIds.has(edge.target.nodeId)
        ? cloneEdgeEnd(edge.target)
        : {
          kind: 'point',
          point: cloneValue(resolved.target.point)
        }
  })
}

const isEdgeInsideNodeSlice = (
  edge: Edge,
  nodeIds: ReadonlySet<NodeId>
) => {
  const sourceInside = !isNodeEdgeEnd(edge.source) || nodeIds.has(edge.source.nodeId)
  const targetInside = !isNodeEdgeEnd(edge.target) || nodeIds.has(edge.target.nodeId)
  const touchesSelection =
    (isNodeEdgeEnd(edge.source) && nodeIds.has(edge.source.nodeId))
    || (isNodeEdgeEnd(edge.target) && nodeIds.has(edge.target.nodeId))

  return sourceInside && targetInside && touchesSelection
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

const readDefaultRoots = (slice: Slice): SliceRoots => {
  const ownerByChildId = getNodeOwnerMap(slice.nodes)
  const nodeIds = slice.nodes
    .filter((node) => !ownerByChildId.has(node.id))
    .map((node) => node.id)

  if (nodeIds.length > 0) {
    return {
      nodeIds,
      edgeIds: []
    }
  }

  return {
    nodeIds: [],
    edgeIds: slice.edges.map((edge) => edge.id)
  }
}

const remapRoots = ({
  roots,
  nodeIdMap,
  edgeIdMap
}: {
  roots: SliceRoots
  nodeIdMap: ReadonlyMap<NodeId, NodeId>
  edgeIdMap: ReadonlyMap<EdgeId, EdgeId>
}): SliceRoots => ({
  nodeIds: roots.nodeIds
    .map((nodeId) => nodeIdMap.get(nodeId))
    .filter((nodeId): nodeId is NodeId => Boolean(nodeId)),
  edgeIds: roots.edgeIds
    .map((edgeId) => edgeIdMap.get(edgeId))
    .filter((edgeId): edgeId is EdgeId => Boolean(edgeId))
})

export const exportSliceFromNodes = ({
  doc,
  ids,
  nodeSize
}: ExportNodesInput): Result<SliceExportResult, 'invalid'> => {
  const selectedIds = dedupeIds(ids)
  if (!selectedIds.length) {
    return err('invalid', 'No nodes selected.')
  }

  const orderedNodes = listNodes(doc)
  const expandedIds = collectExpandedNodeIds(orderedNodes, selectedIds)
  const rawNodes = orderedNodes
    .filter((node) => expandedIds.has(node.id))
    .map((node) => cloneNode(node))

  if (!rawNodes.length) {
    return err('invalid', 'No nodes selected.')
  }

  const nodeIdSet = new Set(rawNodes.map((node) => node.id))
  const nodes = rawNodes.map((node) => filterNodeChildren(node, nodeIdSet))
  const edges = listEdges(doc)
    .filter((edge) => isEdgeInsideNodeSlice(edge, nodeIdSet))
    .map((edge) => cloneEdge(edge))

  const bounds = getSliceBounds({
    version: 1,
    nodes,
    edges
  }, nodeSize)
  if (!bounds) {
    return err('invalid', 'Slice bounds could not be resolved.')
  }

  return ok({
    slice: {
      version: 1,
      nodes,
      edges
    },
    roots: {
      nodeIds: selectedIds.filter((nodeId) => nodeIdSet.has(nodeId)),
      edgeIds: []
    },
    bounds
  })
}

export const exportSliceFromEdge = ({
  doc,
  edgeId,
  nodeSize
}: ExportEdgeInput): Result<SliceExportResult, 'invalid'> => {
  const edge = getEdge(doc, edgeId)
  if (!edge) {
    return err('invalid', `Edge ${edgeId} not found.`)
  }

  const detached = detachEdge({
    edge,
    doc,
    nodeSize
  })
  if (!detached.ok) {
    return detached
  }

  const slice: Slice = {
    version: 1,
    nodes: [],
    edges: [detached.data]
  }
  const bounds = getSliceBounds(slice, nodeSize)
  if (!bounds) {
    return err('invalid', 'Slice bounds could not be resolved.')
  }

  return ok({
    slice,
    roots: {
      nodeIds: [],
      edgeIds: [edgeId]
    },
    bounds
  })
}

export const exportSliceFromSelection = ({
  doc,
  nodeIds = [],
  edgeIds = [],
  nodeSize
}: ExportSelectionInput): Result<SliceExportResult, 'invalid'> => {
  const selectedNodeIds = dedupeIds(nodeIds)
  const selectedEdgeIds = dedupeIds(edgeIds)
  if (!selectedNodeIds.length && !selectedEdgeIds.length) {
    return err('invalid', 'No selection provided.')
  }

  const orderedNodes = listNodes(doc)
  const expandedNodeIds = collectExpandedNodeIds(orderedNodes, selectedNodeIds)
  const rawNodes = orderedNodes
    .filter((node) => expandedNodeIds.has(node.id))
    .map((node) => cloneNode(node))
  const nodeIdSet = new Set(rawNodes.map((node) => node.id))
  const nodes = rawNodes.map((node) => filterNodeChildren(node, nodeIdSet))

  const edges: Edge[] = []
  const includedEdgeIds = new Set<EdgeId>()

  listEdges(doc).forEach((edge) => {
    if (isEdgeInsideNodeSlice(edge, nodeIdSet)) {
      edges.push(cloneEdge(edge))
      includedEdgeIds.add(edge.id)
      return
    }

    if (!selectedEdgeIds.includes(edge.id)) {
      return
    }

    const detached = detachSelectionEdge({
      edge,
      doc,
      nodeIds: nodeIdSet,
      nodeSize
    })
    if (!detached.ok) {
      return
    }

    edges.push(detached.data)
    includedEdgeIds.add(edge.id)
  })

  const slice: Slice = {
    version: 1,
    nodes,
    edges
  }
  const bounds = getSliceBounds(slice, nodeSize)
  if (!bounds) {
    return err('invalid', 'Slice bounds could not be resolved.')
  }

  return ok({
    slice,
    roots: {
      nodeIds: selectedNodeIds.filter((nodeId) => nodeIdSet.has(nodeId)),
      edgeIds: selectedEdgeIds.filter((edgeId) => includedEdgeIds.has(edgeId))
    },
    bounds
  })
}

export const buildInsertSliceOperations = ({
  doc,
  slice,
  nodeSize,
  registries,
  createNodeId = () => createId('node'),
  createEdgeId = () => createId('edge'),
  at,
  offset,
  ownerId,
  roots
}: InsertSliceInput): Result<SliceInsertResult, 'invalid'> => {
  if (!slice.nodes.length && !slice.edges.length) {
    return err('invalid', 'Slice is empty.')
  }

  const bounds = getSliceBounds(slice, nodeSize)
  if (!bounds) {
    return err('invalid', 'Slice bounds could not be resolved.')
  }

  const delta = at
    ? {
      x: at.x - getRectCenter(bounds).x,
      y: at.y - getRectCenter(bounds).y
    }
    : offset
      ? cloneValue(offset)
      : { x: 0, y: 0 }

  const normalizedRoots = toRoots(roots ?? readDefaultRoots(slice))

  const operations: Operation[] = []
  const duplicatedNodeOperations: Extract<Operation, { type: 'node.create' }>[] = []
  const duplicatedEdgeOperations: Extract<Operation, { type: 'edge.create' }>[] = []
  const nodeIdMap = new Map<NodeId, NodeId>()
  const edgeIdMap = new Map<EdgeId, EdgeId>()
  const allNodeIds: NodeId[] = []
  const allEdgeIds: EdgeId[] = []
  const depthCache = new Map<NodeId, number>()
  const nodeById = new Map<NodeId, Node>(slice.nodes.map((node) => [node.id, node]))
  const ownerByChildId = getNodeOwnerMap(slice.nodes)

  const getDepth = (node: Node): number => {
    const currentOwnerId = ownerByChildId.get(node.id)
    if (!currentOwnerId) return 0
    const cached = depthCache.get(node.id)
    if (typeof cached === 'number') return cached
    const parent = nodeById.get(currentOwnerId)
    const depth = parent ? getDepth(parent) + 1 : 0
    depthCache.set(node.id, depth)
    return depth
  }

  const orderedNodes = [...slice.nodes].sort((left, right) => getDepth(left) - getDepth(right))
  orderedNodes.forEach((sourceNode) => {
    nodeIdMap.set(sourceNode.id, createNodeId())
  })

  for (const sourceNode of orderedNodes) {
    const nextNodeId = nodeIdMap.get(sourceNode.id)
    if (!nextNodeId) {
      return err('invalid', `Node ${sourceNode.id} could not be remapped.`)
    }

    const nextChildren = sourceNode.children
      ? sourceNode.children
        .map((childId) => nodeIdMap.get(childId))
        .filter((childId): childId is NodeId => Boolean(childId))
      : undefined

    const planned = buildNodeCreateOperation({
      payload: {
        ...cloneNode(sourceNode),
        id: nextNodeId,
        position: {
          x: sourceNode.position.x + delta.x,
          y: sourceNode.position.y + delta.y
        },
        children: nextChildren
      },
      doc: withCreatedNodes(doc, duplicatedNodeOperations),
      registries,
      createNodeId: () => nextNodeId
    })
    if (!planned.ok) {
      return err('invalid', planned.error.message, planned.error.details)
    }

    duplicatedNodeOperations.push(planned.data.operation)
    operations.push(planned.data.operation)
    allNodeIds.push(planned.data.nodeId)
    nodeIdMap.set(sourceNode.id, planned.data.nodeId)
  }

  const nextRootNodeIds = normalizedRoots.nodeIds
    .map((nodeId) => nodeIdMap.get(nodeId))
    .filter((nodeId): nodeId is NodeId => Boolean(nodeId))

  if (ownerId && nextRootNodeIds.length > 0) {
    const owner = getNode(doc, ownerId)
    if (!owner) {
      return err('invalid', `Owner ${ownerId} not found.`)
    }
    if (!isOwnerNode(owner)) {
      return err('invalid', `Node ${ownerId} is not an owner.`)
    }

    operations.push({
      type: 'node.update',
      id: owner.id,
      patch: {
        children: [
          ...(owner.children ?? []),
          ...nextRootNodeIds
        ]
      }
    })
  }

  for (const sourceEdge of slice.edges) {
    const nextEdgeId = createEdgeId()
    const nextSource: Edge['source'] | undefined =
      isNodeEdgeEnd(sourceEdge.source)
        ? (() => {
          const nodeId = nodeIdMap.get(sourceEdge.source.nodeId)
          if (!nodeId) return undefined
          return {
            kind: 'node',
            nodeId,
            anchor: sourceEdge.source.anchor ? cloneValue(sourceEdge.source.anchor) : undefined
          } as const
        })()
        : {
          kind: 'point',
          point: {
            x: sourceEdge.source.point.x + delta.x,
            y: sourceEdge.source.point.y + delta.y
          }
        }

    const nextTarget: Edge['target'] | undefined =
      isNodeEdgeEnd(sourceEdge.target)
        ? (() => {
          const nodeId = nodeIdMap.get(sourceEdge.target.nodeId)
          if (!nodeId) return undefined
          return {
            kind: 'node',
            nodeId,
            anchor: sourceEdge.target.anchor ? cloneValue(sourceEdge.target.anchor) : undefined
          } as const
        })()
        : {
          kind: 'point',
          point: {
            x: sourceEdge.target.point.x + delta.x,
            y: sourceEdge.target.point.y + delta.y
          }
        }

    if (!nextSource || !nextTarget) {
      return err('invalid', `Edge ${sourceEdge.id} references nodes outside the slice.`)
    }

    const planned = buildEdgeCreateOperation({
      payload: {
        ...cloneEdge(sourceEdge),
        id: nextEdgeId,
        source: nextSource,
        target: nextTarget,
        route: sourceEdge.route?.kind === 'manual'
          ? {
            kind: 'manual',
            points: sourceEdge.route.points.map((point) => ({
              x: point.x + delta.x,
              y: point.y + delta.y
            }))
          }
          : sourceEdge.route
            ? cloneValue(sourceEdge.route)
            : undefined,
        label: sourceEdge.label
          ? {
            ...cloneValue(sourceEdge.label),
            offset: sourceEdge.label.offset
              ? {
                x: sourceEdge.label.offset.x,
                y: sourceEdge.label.offset.y
              }
              : undefined
          }
          : undefined
      },
      doc: withCreatedEdges(withCreatedNodes(doc, duplicatedNodeOperations), duplicatedEdgeOperations),
      registries,
      createEdgeId: () => nextEdgeId
    })
    if (!planned.ok) {
      return err('invalid', planned.error.message, planned.error.details)
    }

    duplicatedEdgeOperations.push(planned.data.operation)
    operations.push(planned.data.operation)
    allEdgeIds.push(planned.data.edgeId)
    edgeIdMap.set(sourceEdge.id, planned.data.edgeId)
  }

  return ok({
    operations,
    roots: remapRoots({
      roots: normalizedRoots,
      nodeIdMap,
      edgeIdMap
    }),
    allNodeIds,
    allEdgeIds
  })
}
