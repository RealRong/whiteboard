import {
  buildInsertSliceOperations,
  exportSliceFromNodes
} from '../document'
import { ok } from '../types'
import type {
  CoreRegistries,
  Document,
  Node,
  NodeId,
  Operation,
  Point,
  EdgeId,
  Result,
  Size
} from '../types'
import { getContainerDescendants } from './group'

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
  nodeSize: Size
  offset: Point
}

export const buildNodeDuplicateOperations = ({
  doc,
  ids,
  registries,
  createNodeId,
  createEdgeId,
  nodeSize,
  offset
}: BuildNodeDuplicateOperationsInput): Result<{
  operations: Operation[]
  nodeIds: NodeId[]
  edgeIds: EdgeId[]
}, 'invalid'> => {
  const exported = exportSliceFromNodes({
    doc,
    ids,
    nodeSize
  })
  if (!exported.ok) {
    return exported
  }

  const inserted = buildInsertSliceOperations({
    doc,
    slice: exported.data.slice,
    nodeSize,
    registries,
    createNodeId,
    createEdgeId,
    offset,
    roots: exported.data.roots
  })
  if (!inserted.ok) {
    return inserted
  }

  return ok({
    operations: inserted.data.operations,
    nodeIds: [...inserted.data.roots.nodeIds],
    edgeIds: [...inserted.data.allEdgeIds]
  })
}
