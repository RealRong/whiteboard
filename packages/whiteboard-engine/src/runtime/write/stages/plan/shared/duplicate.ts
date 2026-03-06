import { createEdgeDuplicateInput } from '@whiteboard/core/edge'
import {
  createNodeDuplicateInput,
  expandNodeSelection
} from '@whiteboard/core/node'
import {
  corePlan,
  reduceOperations
} from '@whiteboard/core/kernel'
import type {
  CoreRegistries,
  Document,
  EdgeId,
  Node,
  NodeId,
  Operation,
  Point
} from '@whiteboard/core/types'
import type { Draft } from '../draft'
import { cancelled, invalid, success } from '../draft'

type DuplicateNodesOptions = {
  doc: Document
  ids: readonly NodeId[]
  registries: CoreRegistries
  createNodeId: () => NodeId
  createEdgeId: () => EdgeId
  offset: Point
}

const toInvalidMessage = (message?: string) =>
  message ?? 'Invalid node duplicate command.'

const asNodeCreateOperation = (
  operations: readonly Operation[]
): Extract<Operation, { type: 'node.create' }> | undefined => {
  if (operations.length !== 1) return undefined
  const operation = operations[0]
  return operation.type === 'node.create' ? operation : undefined
}

const asEdgeCreateOperation = (
  operations: readonly Operation[]
): Extract<Operation, { type: 'edge.create' }> | undefined => {
  if (operations.length !== 1) return undefined
  const operation = operations[0]
  return operation.type === 'edge.create' ? operation : undefined
}

export const buildDuplicateNodesDraft = ({
  doc,
  ids,
  registries,
  createNodeId,
  createEdgeId,
  offset
}: DuplicateNodesOptions): Draft => {
  if (!ids.length) {
    return cancelled('No nodes selected.')
  }

  const { expandedIds, nodeById } = expandNodeSelection(
    doc.nodes,
    Array.from(ids)
  )
  const selectedNodes = Array.from(expandedIds)
    .map((id) => nodeById.get(id))
    .filter((node): node is Node => Boolean(node))
  if (!selectedNodes.length) {
    return cancelled('No nodes selected.')
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

  const operationList: Operation[] = []
  const duplicatedNodeIds: NodeId[] = []
  const sourceToDuplicatedId = new Map<NodeId, NodeId>()
  let workingDoc = doc

  for (const sourceNode of selectedNodes) {
    const parentId =
      sourceNode.parentId && sourceToDuplicatedId.has(sourceNode.parentId)
        ? sourceToDuplicatedId.get(sourceNode.parentId)
        : sourceNode.parentId
    const payload = createNodeDuplicateInput(sourceNode, parentId, offset)
    const planned = corePlan.node.create({
      payload,
      doc: workingDoc,
      registries,
      createNodeId
    })
    if (!planned.ok) return invalid(toInvalidMessage(planned.message))

    const operation = asNodeCreateOperation(planned.operations)
    if (!operation) {
      return invalid('Node duplicate plan must contain one node.create operation.')
    }

    operationList.push(operation)
    duplicatedNodeIds.push(operation.node.id)
    sourceToDuplicatedId.set(sourceNode.id, operation.node.id)

    const reduced = reduceOperations(workingDoc, [operation])
    if (!reduced.ok) return reduced
    workingDoc = reduced.doc
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

    const payload = createEdgeDuplicateInput(
      sourceEdge,
      sourceNodeId,
      targetNodeId
    )
    const planned = corePlan.edge.create({
      payload,
      doc: workingDoc,
      registries,
      createEdgeId
    })
    if (!planned.ok) return invalid(toInvalidMessage(planned.message))

    const operation = asEdgeCreateOperation(planned.operations)
    if (!operation) {
      return invalid('Edge duplicate plan must contain one edge.create operation.')
    }

    operationList.push(operation)
    const reduced = reduceOperations(workingDoc, [operation])
    if (!reduced.ok) return reduced
    workingDoc = reduced.doc
  }

  return success(operationList, {
    selectedNodeIds: duplicatedNodeIds
  })
}
