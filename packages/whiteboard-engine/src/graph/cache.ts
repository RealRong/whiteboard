import type {
  Document,
  Edge,
  EdgeId,
  Node,
  NodeId,
  Point,
  Size
} from '@whiteboard/core'
import type { NodeOverride } from '@engine-types/graph'
import {
  getCollapsedGroupIds,
  isHiddenByCollapsedGroup
} from '../node/utils/group'
import type { GraphSnapshot } from './types'

type ViewNodesCache = {
  doc: Document
  nodes: Node[]
  indexById: Map<NodeId, number>
  overrides: Map<NodeId, NodeOverride>
}

const EMPTY_NODES: Node[] = []
const EMPTY_EDGES: Edge[] = []
const EMPTY_NODE_MAP = new Map<NodeId, Node>()

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

const buildIndexById = (nodes: Node[]) => {
  const indexById = new Map<NodeId, number>()
  nodes.forEach((node, index) => {
    indexById.set(node.id, index)
  })
  return indexById
}

const buildViewNodesCache = (
  doc: Document,
  overrides: Map<NodeId, NodeOverride>
): ViewNodesCache => {
  const nodes = doc.nodes.map((node) =>
    applyOverride(node, overrides.get(node.id))
  )
  return {
    doc,
    nodes,
    indexById: buildIndexById(doc.nodes),
    overrides: new Map(overrides)
  }
}

const updateViewNodesCache = (
  cache: ViewNodesCache,
  doc: Document,
  overrides: Map<NodeId, NodeOverride>
): ViewNodesCache => {
  if (cache.doc !== doc) {
    return buildViewNodesCache(doc, overrides)
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
    return cache
  }

  const nextNodes = cache.nodes.slice()
  changedNodeIds.forEach((nodeId) => {
    const index = cache.indexById.get(nodeId)
    if (index === undefined) return
    const sourceNode = doc.nodes[index]
    if (!sourceNode) return
    nextNodes[index] = applyOverride(sourceNode, overrides.get(nodeId))
  })

  return {
    ...cache,
    nodes: nextNodes,
    overrides: new Map(overrides)
  }
}

const isSameRefList = <T,>(left: T[], right: T[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const orderByIds = <T extends { id: string }>(items: T[], ids: string[]) => {
  if (!ids.length) return items

  if (ids.length === items.length) {
    let sameOrder = true
    for (let index = 0; index < items.length; index += 1) {
      if (items[index]?.id !== ids[index]) {
        sameOrder = false
        break
      }
    }
    if (sameOrder) return items
  }

  const map = new Map(items.map((item) => [item.id, item]))
  const ordered: T[] = []
  const idSet = new Set(ids)

  ids.forEach((id) => {
    const item = map.get(id)
    if (item) ordered.push(item)
  })

  if (ordered.length === items.length) return ordered

  items.forEach((item) => {
    if (!idSet.has(item.id)) {
      ordered.push(item)
    }
  })

  return ordered
}

const deriveVisibleNodes = (viewNodes: Node[]) => {
  if (!viewNodes.length) return EMPTY_NODES
  const nodeMap = new Map(viewNodes.map((node) => [node.id, node]))
  const collapsedGroupIds = getCollapsedGroupIds(viewNodes)
  const hiddenNodeIds = new Set<NodeId>()

  viewNodes.forEach((node) => {
    if (isHiddenByCollapsedGroup(node, nodeMap, collapsedGroupIds)) {
      hiddenNodeIds.add(node.id)
    }
  })

  return viewNodes.filter((node) => !hiddenNodeIds.has(node.id))
}

const deriveCanvasNodes = (visibleNodes: Node[]) =>
  visibleNodes.filter((node) => node.type !== 'mindmap')

const deriveVisibleEdges = (doc: Document, canvasNodes: Node[]) => {
  if (!doc.edges.length || !canvasNodes.length) return EMPTY_EDGES
  const edgeOrder: EdgeId[] = doc.order?.edges ?? doc.edges.map((edge) => edge.id)
  const canvasNodeIds = new Set(canvasNodes.map((node) => node.id))
  const edges = doc.edges.filter(
    (edge) =>
      canvasNodeIds.has(edge.source.nodeId) &&
      canvasNodeIds.has(edge.target.nodeId)
  )
  return orderByIds(edges, edgeOrder)
}

export class GraphCache {
  private viewNodesCache: ViewNodesCache | null = null
  private snapshot: GraphSnapshot = {
    visibleNodes: EMPTY_NODES,
    canvasNodes: EMPTY_NODES,
    canvasNodeById: EMPTY_NODE_MAP,
    visibleEdges: EMPTY_EDGES
  }

  read = (
    doc: Document | null,
    overrides: Map<NodeId, NodeOverride>
  ): GraphSnapshot => {
    if (!doc) {
      this.viewNodesCache = null
      if (
        this.snapshot.visibleNodes !== EMPTY_NODES ||
        this.snapshot.canvasNodes !== EMPTY_NODES ||
        this.snapshot.canvasNodeById !== EMPTY_NODE_MAP ||
        this.snapshot.visibleEdges !== EMPTY_EDGES
      ) {
        this.snapshot = {
          visibleNodes: EMPTY_NODES,
          canvasNodes: EMPTY_NODES,
          canvasNodeById: EMPTY_NODE_MAP,
          visibleEdges: EMPTY_EDGES
        }
      }
      return this.snapshot
    }

    const previousViewNodesCache = this.viewNodesCache
    const nextViewNodesCache = previousViewNodesCache
      ? updateViewNodesCache(previousViewNodesCache, doc, overrides)
      : buildViewNodesCache(doc, overrides)

    this.viewNodesCache = nextViewNodesCache

    const nodeOrder = doc.order?.nodes ?? doc.nodes.map((node) => node.id)
    const orderedViewNodes = orderByIds(nextViewNodesCache.nodes, nodeOrder)
    const nextVisibleNodes = deriveVisibleNodes(orderedViewNodes)
    const nextCanvasNodes = deriveCanvasNodes(nextVisibleNodes)
    const nextVisibleEdges = deriveVisibleEdges(doc, nextCanvasNodes)

    const visibleNodes = isSameRefList(
      this.snapshot.visibleNodes,
      nextVisibleNodes
    )
      ? this.snapshot.visibleNodes
      : nextVisibleNodes
    const canvasNodes = isSameRefList(this.snapshot.canvasNodes, nextCanvasNodes)
      ? this.snapshot.canvasNodes
      : nextCanvasNodes
    const canvasNodeById =
      canvasNodes === this.snapshot.canvasNodes
        ? this.snapshot.canvasNodeById
        : new Map(canvasNodes.map((node) => [node.id, node]))
    const visibleEdges = isSameRefList(
      this.snapshot.visibleEdges,
      nextVisibleEdges
    )
      ? this.snapshot.visibleEdges
      : nextVisibleEdges

    if (
      visibleNodes !== this.snapshot.visibleNodes ||
      canvasNodes !== this.snapshot.canvasNodes ||
      canvasNodeById !== this.snapshot.canvasNodeById ||
      visibleEdges !== this.snapshot.visibleEdges
    ) {
      this.snapshot = {
        visibleNodes,
        canvasNodes,
        canvasNodeById,
        visibleEdges
      }
    }

    return this.snapshot
  }

  readNode = (
    doc: Document | null,
    overrides: Map<NodeId, NodeOverride>,
    nodeId: NodeId
  ): Node | undefined => this.read(doc, overrides).canvasNodeById.get(nodeId)
}
