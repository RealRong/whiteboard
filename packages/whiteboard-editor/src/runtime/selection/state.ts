import {
  applySelection,
  type TargetBoundsInput,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  createValueStore,
  type ValueStore
} from '@whiteboard/engine'
import type { EdgeItem, NodeItem } from '@whiteboard/engine'
import type {
  Edge,
  EdgeId,
  Node,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { NodeRole } from '../../types/node'
import {
  isOrderedArrayEqual,
  isRectEqual
} from '../utils/equality'

export type SelectionInput = {
  nodeIds?: readonly NodeId[]
  edgeIds?: readonly EdgeId[]
}

export type SelectionTarget = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type Input = SelectionInput
export type Source = SelectionTarget

export type Commands = {
  replace: (input: SelectionInput) => void
  add: (input: SelectionInput) => void
  remove: (input: SelectionInput) => void
  toggle: (input: SelectionInput) => void
  clear: () => void
}

export type Transform = {
  move: boolean
  resize: 'none' | 'resize' | 'scale'
}

export type SelectionSnapshot = {
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

export type View = SelectionSnapshot

export type Store = {
  source: ValueStore<SelectionTarget>
  commands: Commands
}

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_NODE_SET: ReadonlySet<NodeId> = new Set<NodeId>()
const EMPTY_EDGE_IDS: readonly EdgeId[] = []
const EMPTY_EDGE_SET: ReadonlySet<EdgeId> = new Set<EdgeId>()
const EMPTY_NODES: readonly Node[] = []
const EMPTY_EDGES: readonly Edge[] = []
const EMPTY_SELECTION_TARGET: SelectionTarget = {
  nodeIds: EMPTY_NODE_IDS,
  edgeIds: EMPTY_EDGE_IDS
}
const EMPTY_TRANSFORM: Transform = {
  move: false,
  resize: 'none'
}

const canScaleNode = (
  node: Node,
  resolveNodeRole: (node: Node) => NodeRole
) => (
  !node.locked
  && resolveNodeRole(node) !== 'frame'
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

export const isSourceEqual = (
  left: SelectionTarget,
  right: SelectionTarget
) => (
  isOrderedArrayEqual(left.nodeIds, right.nodeIds)
  && isOrderedArrayEqual(left.edgeIds, right.edgeIds)
)

export const isSelectionTargetEqual = isSourceEqual

export const isViewEqual = (
  left: SelectionSnapshot,
  right: SelectionSnapshot
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

export const isSelectionSnapshotEqual = isViewEqual

export const isSelectionBoxInteractive = (
  selection: Pick<SelectionSnapshot, 'box' | 'kind' | 'transform' | 'items'>
) => {
  if (!selection.box) {
    return false
  }

  if (selection.items.count > 1) {
    return true
  }

  return (
    selection.transform.resize === 'scale'
    && !(
      selection.kind === 'node'
      && selection.items.primaryNode?.type === 'group'
    )
  )
}

export const toSource = (
  input: SelectionInput
): SelectionTarget => {
  const nodeIds = [...new Set(input.nodeIds ?? EMPTY_NODE_IDS)]
  const edgeIds = [...new Set(input.edgeIds ?? EMPTY_EDGE_IDS)]

  if (!nodeIds.length && !edgeIds.length) {
    return EMPTY_SELECTION_TARGET
  }

  return {
    nodeIds,
    edgeIds
  }
}

export const toSelectionTarget = toSource

export const resolveView = ({
  source,
  readNode,
  readEdge,
  resolveNodeTransform,
  resolveNodeRole,
  readBounds
}: {
  source: SelectionTarget
  readNode: (nodeId: NodeId) => NodeItem | undefined
  readEdge: (edgeId: EdgeId) => EdgeItem | undefined
  resolveNodeTransform: (node: Node) => {
    resize: boolean
    rotate: boolean
  }
  resolveNodeRole: (node: Node) => NodeRole
  readBounds: (input: TargetBoundsInput) => Rect | undefined
}): SelectionSnapshot => {
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
    && nodes.every((node) => canScaleNode(node, resolveNodeRole))
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
  const box = readBounds({
    nodeIds,
    edgeIds,
    groups: 'content'
  })

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

export const resolveSelectionSnapshot = resolveView

export const applySource = (
  current: SelectionTarget,
  input: SelectionInput,
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

export const applySelectionTarget = applySource

export const createState = (): Store => {
  const source = createValueStore<SelectionTarget>(EMPTY_SELECTION_TARGET, {
    isEqual: isSourceEqual
  })
  const readSource = () => source.get()
  const writeSource = (next: SelectionTarget) => {
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
        writeSource(applySource(readSource(), input, 'add'))
      },
      remove: (input) => {
        writeSource(applySource(readSource(), input, 'subtract'))
      },
      toggle: (input) => {
        writeSource(applySource(readSource(), input, 'toggle'))
      },
      clear: () => {
        writeSource(EMPTY_SELECTION_TARGET)
      }
    }
  }
}
