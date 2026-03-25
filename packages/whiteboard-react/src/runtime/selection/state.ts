import {
  applySelection,
  getGroupDescendants,
  type SelectionMode
} from '@whiteboard/core/node'
import { getRectsBoundingRect } from '@whiteboard/core/geometry'
import {
  createValueStore,
  type ValueStore
} from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type {
  Edge,
  EdgeId,
  Node,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { NodeScene } from '../../types/node'
import {
  isOrderedArrayEqual,
  isRectEqual
} from '../utils/equality'

export type Input = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
}

export type Source = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type Commands = {
  replace: (input: Input) => void
  add: (input: Input) => void
  remove: (input: Input) => void
  toggle: (input: Input) => void
  clear: () => void
}

export type Transform = {
  move: boolean
  resize: 'none' | 'resize' | 'scale'
}

export type View = {
  kind: 'none' | 'node' | 'nodes' | 'edge' | 'edges' | 'mixed'
  target: {
    nodeIds: readonly NodeId[]
    nodeSet: ReadonlySet<NodeId>
    edgeIds: readonly EdgeId[]
    edgeSet: ReadonlySet<EdgeId>
    edgeId?: EdgeId
  }
  items: {
    nodes: readonly Node[]
    edges: readonly Edge[]
    primaryNode?: Node
    primaryEdge?: Edge
    count: number
    nodeCount: number
    edgeCount: number
  }
  transform: Transform
  box?: Rect
}

export type Store = {
  source: ValueStore<Source>
  commands: Commands
}

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_NODE_SET: ReadonlySet<NodeId> = new Set<NodeId>()
const EMPTY_EDGE_IDS: readonly EdgeId[] = []
const EMPTY_EDGE_SET: ReadonlySet<EdgeId> = new Set<EdgeId>()
const EMPTY_NODES: readonly Node[] = []
const EMPTY_EDGES: readonly Edge[] = []
const EMPTY_SOURCE: Source = {
  nodeIds: EMPTY_NODE_IDS,
  edgeIds: EMPTY_EDGE_IDS
}
const EMPTY_TRANSFORM: Transform = {
  move: false,
  resize: 'none'
}

const canScaleNode = (
  node: Node,
  resolveNodeScene: (node: Node) => NodeScene
) => (
  !node.locked
  && (
    node.type === 'group'
    || (
      node.type !== 'frame'
      && resolveNodeScene(node) !== 'container'
    )
  )
)

const readNodeItems = (
  readNode: (nodeId: NodeId) => NodeItem | undefined,
  nodeIds: readonly NodeId[]
): readonly NodeItem[] => nodeIds
  .map((nodeId) => readNode(nodeId))
  .filter((item): item is NodeItem => Boolean(item))

const readEdgeItems = (
  readEdge: (edgeId: EdgeId) => EdgeItem | undefined,
  edgeIds: readonly EdgeId[]
): readonly EdgeItem[] => edgeIds
  .map((edgeId) => readEdge(edgeId))
  .filter((item): item is EdgeItem => Boolean(item))

const readSelectionNodeRects = ({
  nodes,
  allNodes,
  readNode
}: {
  nodes: readonly Node[]
  allNodes: readonly Node[]
  readNode: (nodeId: NodeId) => NodeItem | undefined
}): readonly Rect[] => {
  const rects: Rect[] = []
  const rectNodeIds = new Set<NodeId>()

  const pushRect = (
    nodeId: NodeId
  ) => {
    if (rectNodeIds.has(nodeId)) {
      return
    }

    const item = readNode(nodeId)
    if (!item) {
      return
    }

    rectNodeIds.add(nodeId)
    rects.push(item.rect)
  }

  nodes.forEach((node) => {
    if (node.type !== 'group') {
      pushRect(node.id)
      return
    }

    const descendants = getGroupDescendants(allNodes, node.id)
    const contentDescendants = descendants.filter((descendant) => descendant.type !== 'group')

    if (!contentDescendants.length) {
      pushRect(node.id)
      return
    }

    contentDescendants.forEach((descendant) => {
      pushRect(descendant.id)
    })
  })

  return rects
}

const isSourceEqual = (
  left: Source,
  right: Source
) => (
  isOrderedArrayEqual(left.nodeIds, right.nodeIds)
  && isOrderedArrayEqual(left.edgeIds, right.edgeIds)
)

export const isViewEqual = (
  left: View,
  right: View
) => (
  left.kind === right.kind
  && left.target.edgeId === right.target.edgeId
  && left.items.primaryNode === right.items.primaryNode
  && left.items.primaryEdge === right.items.primaryEdge
  && left.items.count === right.items.count
  && left.items.nodeCount === right.items.nodeCount
  && left.items.edgeCount === right.items.edgeCount
  && left.transform.move === right.transform.move
  && left.transform.resize === right.transform.resize
  && isOrderedArrayEqual(left.target.nodeIds, right.target.nodeIds)
  && isOrderedArrayEqual(left.target.edgeIds, right.target.edgeIds)
  && isOrderedArrayEqual(left.items.nodes, right.items.nodes)
  && isOrderedArrayEqual(left.items.edges, right.items.edges)
  && isRectEqual(left.box, right.box)
)

const toSource = (
  input: Input
): Source => {
  const nodeIds = [...new Set(input.nodeIds ?? EMPTY_NODE_IDS)]
  const edgeIds = [...new Set(input.edgeIds ?? EMPTY_EDGE_IDS)]

  if (!nodeIds.length && !edgeIds.length) {
    return EMPTY_SOURCE
  }

  return {
    nodeIds,
    edgeIds
  }
}

export const resolveView = ({
  source,
  readNode,
  readEdge,
  resolveNodeTransform,
  resolveNodeScene,
  readEdgeBounds,
  allNodeIds
}: {
  source: Source
  readNode: (nodeId: NodeId) => NodeItem | undefined
  readEdge: (edgeId: EdgeId) => EdgeItem | undefined
  resolveNodeTransform: (node: Node) => {
    resize: boolean
    rotate: boolean
  }
  resolveNodeScene: (node: Node) => NodeScene
  readEdgeBounds: (edgeId: EdgeId) => Rect | undefined
  allNodeIds: readonly NodeId[]
}): View => {
  const nodeItems = readNodeItems(readNode, source.nodeIds)
  const edgeItems = readEdgeItems(readEdge, source.edgeIds)
  const nodes = nodeItems.length > 0
    ? nodeItems.map((item) => item.node)
    : EMPTY_NODES
  const edges = edgeItems.length > 0
    ? edgeItems.map((item) => item.edge)
    : EMPTY_EDGES
  const nodeIds = nodes.length > 0
    ? nodes.map((node) => node.id)
    : EMPTY_NODE_IDS
  const nodeSet = nodeIds.length > 0
    ? new Set<NodeId>(nodeIds)
    : EMPTY_NODE_SET
  const edgeIds = edges.length > 0
    ? edges.map((edge) => edge.id)
    : EMPTY_EDGE_IDS
  const edgeSet = edgeIds.length > 0
    ? new Set<EdgeId>(edgeIds)
    : EMPTY_EDGE_SET
  const nodeCount = nodes.length
  const edgeCount = edges.length
  const count = nodeCount + edgeCount
  const canResizeNodes = nodeCount > 0
    && nodes.every((node) => (
      !node.locked
      && resolveNodeTransform(node).resize
    ))
  const canScaleNodes = nodeCount > 0
    && nodes.every((node) => canScaleNode(node, resolveNodeScene))
  const transform = count > 0
    ? {
        move: nodes.every((node) => !node.locked),
        resize: edgeCount === 0
          ? (
              nodeCount === 1
                ? (
                    canResizeNodes
                      ? 'resize' as const
                      : canScaleNodes
                        ? 'scale' as const
                        : 'none' as const
                  )
                : nodeCount > 1 && canScaleNodes
                  ? 'scale' as const
                  : 'none' as const
            )
          : 'none' as const
      }
    : EMPTY_TRANSFORM
  const nodeRects = nodes.some((node) => node.type === 'group')
    ? readSelectionNodeRects({
        nodes,
        allNodes: allNodeIds
          .map((nodeId) => readNode(nodeId)?.node)
          .filter((node): node is Node => Boolean(node)),
        readNode
      })
    : nodeItems.map((item) => item.rect)
  const box = getRectsBoundingRect([
    ...nodeRects,
    ...edgeIds
      .map((edgeId) => readEdgeBounds(edgeId))
      .filter((rect): rect is Rect => Boolean(rect))
  ])

  return {
    kind:
      nodeCount > 0 && edgeCount > 0
        ? 'mixed'
        : nodeCount === 1
          ? 'node'
          : nodeCount > 1
            ? 'nodes'
            : edgeCount === 1
              ? 'edge'
              : edgeCount > 1
                ? 'edges'
                : 'none',
    target: {
      nodeIds,
      nodeSet,
      edgeIds,
      edgeSet,
      edgeId: edgeCount === 1 ? edgeIds[0] : undefined
    },
    items: {
      nodes,
      edges,
      primaryNode: nodes[0],
      primaryEdge: edges[0],
      count,
      nodeCount,
      edgeCount
    },
    transform,
    box
  }
}

const writeSelection = (
  current: Source,
  input: Input,
  mode: SelectionMode
) => toSource({
  nodeIds: [...applySelection(
    new Set(current.nodeIds),
    [...(input.nodeIds ?? EMPTY_NODE_IDS)],
    mode
  )],
  edgeIds: [...applySelection(
    new Set(current.edgeIds),
    [...(input.edgeIds ?? EMPTY_EDGE_IDS)],
    mode
  )]
})

export const createState = (): Store => {
  const source = createValueStore<Source>(EMPTY_SOURCE, {
    isEqual: isSourceEqual
  })
  const readSource = () => source.get()
  const writeSource = (next: Source) => {
    if (isSourceEqual(readSource(), next)) {
      return
    }
    source.set(next)
  }

  return {
    source,
    commands: {
      replace: (input) => {
        writeSource(toSource(input))
      },
      add: (input) => {
        writeSource(writeSelection(readSource(), input, 'add'))
      },
      remove: (input) => {
        writeSource(writeSelection(readSource(), input, 'subtract'))
      },
      toggle: (input) => {
        writeSource(writeSelection(readSource(), input, 'toggle'))
      },
      clear: () => {
        writeSource(EMPTY_SOURCE)
      }
    }
  }
}
