import type {
  Document,
  Node,
  NodeId,
  Point,
  Size
} from '@whiteboard/core'
import type { NodeOverride } from '../overrides'
import { buildIndexById } from './shared'

type ViewNodesCache = {
  sourceNodesRef: Document['nodes']
  nodes: Node[]
  indexById: Map<NodeId, number>
  overrides: Map<NodeId, NodeOverride>
}

export type ViewNodesUpdate = {
  cache: ViewNodesCache
  sourceNodesChanged: boolean
  changedNodeIds: Set<NodeId>
}

const isPointEqual = (left: Point, right: Point) =>
  left.x === right.x && left.y === right.y

const isSizeEqual = (left: Size | undefined, right: Size | undefined) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.width === right.width && left.height === right.height
}

const isOptionalPointEqual = (
  left: Point | undefined,
  right: Point | undefined
) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return isPointEqual(left, right)
}

const isOverrideEqual = (
  left: NodeOverride | undefined,
  right: NodeOverride | undefined
) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return (
    isOptionalPointEqual(left.position, right.position) &&
    isSizeEqual(left.size, right.size)
  )
}

const applyOverride = (
  node: Node,
  override: NodeOverride | undefined
): Node => {
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

const buildCache = (
  doc: Document,
  overrides: Map<NodeId, NodeOverride>
): ViewNodesCache => {
  const nodes = doc.nodes.map((node) =>
    applyOverride(node, overrides.get(node.id))
  )
  return {
    sourceNodesRef: doc.nodes,
    nodes,
    indexById: buildIndexById(doc.nodes),
    overrides: new Map(overrides)
  }
}

export class ViewNodesState {
  private cache: ViewNodesCache | null = null

  reset = () => {
    this.cache = null
  }

  update = (
    doc: Document,
    overrides: Map<NodeId, NodeOverride>
  ): ViewNodesUpdate => {
    const current = this.cache
    if (!current || current.sourceNodesRef !== doc.nodes) {
      const cache = buildCache(doc, overrides)
      this.cache = cache
      return {
        cache,
        sourceNodesChanged: true,
        changedNodeIds: new Set(doc.nodes.map((node) => node.id))
      }
    }

    const changedNodeIds = new Set<NodeId>()
    overrides.forEach((override, nodeId) => {
      if (!isOverrideEqual(override, current.overrides.get(nodeId))) {
        changedNodeIds.add(nodeId)
      }
    })

    current.overrides.forEach((_, nodeId) => {
      if (!overrides.has(nodeId)) {
        changedNodeIds.add(nodeId)
      }
    })

    if (!changedNodeIds.size) {
      return {
        cache: current,
        sourceNodesChanged: false,
        changedNodeIds
      }
    }

    const nextNodes = current.nodes.slice()
    changedNodeIds.forEach((nodeId) => {
      const index = current.indexById.get(nodeId)
      if (index === undefined) return
      const sourceNode = doc.nodes[index]
      if (!sourceNode) return
      nextNodes[index] = applyOverride(sourceNode, overrides.get(nodeId))
    })

    const cache = {
      ...current,
      sourceNodesRef: doc.nodes,
      nodes: nextNodes,
      overrides: new Map(overrides)
    }
    this.cache = cache

    return {
      cache,
      sourceNodesChanged: false,
      changedNodeIds
    }
  }
}
