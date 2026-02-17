import { atom } from 'jotai'
import type { Document, Node, NodeId, Point, Size } from '@whiteboard/core'
import { docAtom } from '../contextAtoms'
import type { NodeOverride } from '@engine-types/state'
import { writableStateAtoms } from '../atoms'

type ViewNodesCache = {
  doc: Document
  nodes: Node[]
  indexById: Map<NodeId, number>
  overrides: Map<NodeId, NodeOverride>
}

let viewNodesCache: ViewNodesCache | null = null

const isPointEqual = (left: Point, right: Point) => left.x === right.x && left.y === right.y

const isSizeEqual = (left: Size | undefined, right: Size | undefined) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.width === right.width && left.height === right.height
}

const isOptionalPointEqual = (left: Point | undefined, right: Point | undefined) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return isPointEqual(left, right)
}

const isOverrideEqual = (left: NodeOverride | undefined, right: NodeOverride | undefined) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return isOptionalPointEqual(left.position, right.position) && isSizeEqual(left.size, right.size)
}

const applyOverride = (node: Node, override: NodeOverride | undefined): Node => {
  if (!override) return node
  const position = override.position ?? node.position
  const size = override.size ?? node.size
  if (isPointEqual(position, node.position) && isSizeEqual(size, node.size)) {
    return node
  }
  return {
    ...node,
    position,
    size
  }
}

const buildIndexById = (nodes: Node[]) => {
  const indexById = new Map<NodeId, number>()
  nodes.forEach((node, index) => {
    indexById.set(node.id, index)
  })
  return indexById
}

const buildViewNodesCache = (doc: Document, overrides: Map<NodeId, NodeOverride>): ViewNodesCache => {
  const nodes = doc.nodes.map((node) => applyOverride(node, overrides.get(node.id)))
  return {
    doc,
    nodes,
    indexById: buildIndexById(doc.nodes),
    overrides: new Map(overrides)
  }
}

export const viewNodesAtom = atom<Node[]>((get) => {
  const doc = get(docAtom)
  if (!doc) return []
  const overrides = get(writableStateAtoms.nodeOverrides)
  if (!overrides.size) return doc.nodes

  const cache = viewNodesCache
  if (!cache || cache.doc !== doc) {
    viewNodesCache = buildViewNodesCache(doc, overrides)
    return viewNodesCache.nodes
  }

  const changedNodeIds = new Set<NodeId>()
  overrides.forEach((override, nodeId) => {
    if (!isOverrideEqual(override, cache.overrides.get(nodeId))) {
      changedNodeIds.add(nodeId)
    }
  })

  cache.overrides.forEach((_, nodeId) => {
    if (!overrides.has(nodeId)) {
      changedNodeIds.add(nodeId)
    }
  })

  if (!changedNodeIds.size) {
    return cache.nodes
  }

  const nextNodes = cache.nodes.slice()
  changedNodeIds.forEach((nodeId) => {
    const index = cache.indexById.get(nodeId)
    if (index === undefined) return
    const sourceNode = doc.nodes[index]
    if (!sourceNode) return
    nextNodes[index] = applyOverride(sourceNode, overrides.get(nodeId))
  })

  viewNodesCache = {
    ...cache,
    nodes: nextNodes,
    overrides: new Map(overrides)
  }

  return viewNodesCache.nodes
})
