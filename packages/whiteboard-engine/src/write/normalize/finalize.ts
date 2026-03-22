import { moveEdgePath } from '@whiteboard/core/edge'
import {
  getNodeAABB,
  isPointEqual,
  rectContains
} from '@whiteboard/core/geometry'
import {
  findSmallestContainerAtPoint,
  getNodesBoundingRect,
  resolveContainerPadding
} from '@whiteboard/core/node'
import type {
  Document,
  Edge,
  EdgeEnd,
  EdgeId,
  EdgeLabel,
  Node,
  NodeId,
  Operation,
  Point,
  Size
} from '@whiteboard/core/types'

const TEXT_WIDTH_MODE_KEY = 'widthMode'
const EDGE_FOLLOW_DELTA_EPSILON = 0.001
type NodeEdgeEnd = Extract<EdgeEnd, { kind: 'node' }>

type NodeChange = {
  before?: Node
  after?: Node
  geometry: boolean
  relation: boolean
  value: boolean
}

type EdgeChange = {
  before?: Edge
  after?: Edge
  geometry: boolean
  value: boolean
}

type WriteChanges = {
  nodes: ReadonlyMap<NodeId, NodeChange>
  edges: ReadonlyMap<EdgeId, EdgeChange>
}

type TouchedIds = {
  nodeIds: ReadonlySet<NodeId>
  edgeIds: ReadonlySet<EdgeId>
}

const collectTouchedIds = (
  operations: readonly Operation[]
): TouchedIds => {
  const nodeIds = new Set<NodeId>()
  const edgeIds = new Set<EdgeId>()

  operations.forEach((operation) => {
    switch (operation.type) {
      case 'node.create':
        nodeIds.add(operation.node.id)
        return
      case 'node.update':
      case 'node.delete':
        nodeIds.add(operation.id)
        return
      case 'edge.create':
        edgeIds.add(operation.edge.id)
        return
      case 'edge.update':
      case 'edge.delete':
        edgeIds.add(operation.id)
        return
      default:
        return
    }
  })

  return {
    nodeIds,
    edgeIds
  }
}

const isSizeEqual = (
  left?: Size,
  right?: Size
) => (
  (left?.width ?? 0) === (right?.width ?? 0)
  && (left?.height ?? 0) === (right?.height ?? 0)
)

const isRotationEqual = (
  left?: number,
  right?: number
) => (left ?? 0) === (right ?? 0)

const isArrayEqual = (
  left: readonly unknown[] | undefined,
  right: readonly unknown[] | undefined
) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

const isPointOptionalEqual = (
  left?: Point,
  right?: Point
) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  return isPointEqual(left, right)
}

const isPointArrayEqual = (
  left: readonly Point[] | undefined,
  right: readonly Point[] | undefined
) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }
  if (left.length !== right.length) {
    return false
  }

  return left.every((point, index) =>
    isPointEqual(point, right[index]!)
  )
}

const isShallowEqual = (
  left: object | undefined,
  right: object | undefined
) => {
  if (left === right) {
    return true
  }
  if (!left || !right) {
    return false
  }

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((key) => {
    const leftValue = leftRecord[key]
    const rightValue = rightRecord[key]
    if (leftValue === rightValue) {
      return true
    }
    if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
      return isArrayEqual(leftValue, rightValue)
    }
    return false
  })
}

const isEdgeAnchorEqual = (
  left: NodeEdgeEnd['anchor'],
  right: NodeEdgeEnd['anchor']
) => (
  left?.side === right?.side
  && (left?.offset ?? 0) === (right?.offset ?? 0)
)

const isEdgeEndEqual = (
  left: EdgeEnd,
  right: EdgeEnd
) => {
  if (left.kind !== right.kind) {
    return false
  }

  if (left.kind === 'point' && right.kind === 'point') {
    return isPointEqual(left.point, right.point)
  }

  if (left.kind === 'node' && right.kind === 'node') {
    return (
      left.nodeId === right.nodeId
      && isEdgeAnchorEqual(left.anchor, right.anchor)
    )
  }

  return false
}

const isEdgePathEqual = (
  left: Edge['path'],
  right: Edge['path']
) => isPointArrayEqual(left?.points, right?.points)

const isEdgeLabelEqual = (
  left?: EdgeLabel,
  right?: EdgeLabel
) => (
  left?.text === right?.text
  && left?.position === right?.position
  && isPointOptionalEqual(left?.offset, right?.offset)
)

const diffNodeChange = (
  before: Node | undefined,
  after: Node | undefined
): NodeChange | undefined => {
  if (!before && !after) {
    return undefined
  }

  if (!before || !after) {
    return {
      before,
      after,
      geometry: true,
      relation: true,
      value: true
    }
  }

  const geometry = (
    !isPointEqual(before.position, after.position)
    || !isSizeEqual(before.size, after.size)
    || !isRotationEqual(before.rotation, after.rotation)
  )
  const relation = (
    before.parentId !== after.parentId
    || before.type !== after.type
  )
  const value = (
    before.layer !== after.layer
    || before.zIndex !== after.zIndex
    || before.locked !== after.locked
    || !isShallowEqual(before.data, after.data)
    || !isShallowEqual(before.style, after.style)
  )

  if (!geometry && !relation && !value) {
    return undefined
  }

  return {
    before,
    after,
    geometry,
    relation,
    value
  }
}

const diffEdgeChange = (
  before: Edge | undefined,
  after: Edge | undefined
): EdgeChange | undefined => {
  if (!before && !after) {
    return undefined
  }

  if (!before || !after) {
    return {
      before,
      after,
      geometry: true,
      value: true
    }
  }

  const geometry = (
    !isEdgeEndEqual(before.source, after.source)
    || !isEdgeEndEqual(before.target, after.target)
    || before.type !== after.type
    || !isEdgePathEqual(before.path, after.path)
  )
  const value = (
    !isShallowEqual(before.style, after.style)
    || !isEdgeLabelEqual(before.label, after.label)
    || !isShallowEqual(before.data, after.data)
  )

  if (!geometry && !value) {
    return undefined
  }

  return {
    before,
    after,
    geometry,
    value
  }
}

const diffChanges = ({
  beforeDocument,
  afterDocument,
  touched
}: {
  beforeDocument: Document
  afterDocument: Document
  touched: TouchedIds
}): WriteChanges => {
  const nodes = new Map<NodeId, NodeChange>()
  touched.nodeIds.forEach((nodeId) => {
    const change = diffNodeChange(
      beforeDocument.nodes.entities[nodeId],
      afterDocument.nodes.entities[nodeId]
    )
    if (change) {
      nodes.set(nodeId, change)
    }
  })

  const edges = new Map<EdgeId, EdgeChange>()
  touched.edgeIds.forEach((edgeId) => {
    const change = diffEdgeChange(
      beforeDocument.edges.entities[edgeId],
      afterDocument.edges.entities[edgeId]
    )
    if (change) {
      edges.set(edgeId, change)
    }
  })

  return {
    nodes,
    edges
  }
}

export const collectChanges = ({
  beforeDocument,
  afterDocument,
  operations
}: {
  beforeDocument: Document
  afterDocument: Document
  operations: readonly Operation[]
}): WriteChanges => diffChanges({
  beforeDocument,
  afterDocument,
  touched: collectTouchedIds(operations)
})

const hasNodePositionChange = (
  change: NodeChange
) => Boolean(
  change.before
  && change.after
  && !isPointEqual(change.before.position, change.after.position)
)

const hasNodeSizeChange = (
  change: NodeChange
) => {
  if (!change.before || !change.after) {
    return false
  }

  const before = change.before.size
  const after = change.after.size
  if (!before && !after) {
    return false
  }

  return (
    (before?.width ?? 0) !== (after?.width ?? 0)
    || (before?.height ?? 0) !== (after?.height ?? 0)
  )
}

const readGroupPadding = (
  node: Pick<Node, 'data'>
) => {
  const value = node.data?.padding
  return typeof value === 'number' ? value : undefined
}

const buildGroupContentRect = (
  document: Document,
  groupId: NodeId,
  nodeSize: Size
) => getNodesBoundingRect(
  Object.values(document.nodes.entities)
    .filter((node) => node.parentId === groupId),
  nodeSize
)

type NodeMoveAnalysis = {
  idSet: ReadonlySet<NodeId>
  rootIds: readonly NodeId[]
  deltaById: ReadonlyMap<NodeId, Point>
}

const analyzeNodeMoves = ({
  afterDocument,
  changes
}: {
  afterDocument: Document
  changes: WriteChanges
}): NodeMoveAnalysis | undefined => {
  const idSet = new Set<NodeId>()
  const deltaById = new Map<NodeId, Point>()

  changes.nodes.forEach((change, nodeId) => {
    if (!change.geometry || !hasNodePositionChange(change) || !change.before || !change.after) {
      return
    }

    if (idSet.has(nodeId)) {
      return
    }

    idSet.add(nodeId)
    deltaById.set(nodeId, {
      x: change.after.position.x - change.before.position.x,
      y: change.after.position.y - change.before.position.y
    })
  })

  if (!idSet.size) {
    return undefined
  }

  const nodeById = afterDocument.nodes.entities
  const rootIds = [...idSet].filter((nodeId) => {
    const node = nodeById[nodeId]
    if (!node) {
      return false
    }
    return !hasMovedAncestor(node, idSet, nodeById)
  })

  return {
    idSet,
    rootIds,
    deltaById
  }
}

const hasMovedAncestor = (
  node: Node,
  movedNodeIds: ReadonlySet<NodeId>,
  nodeById: Readonly<Record<NodeId, Node>>
) => {
  let parentId = node.parentId
  while (parentId) {
    if (movedNodeIds.has(parentId)) {
      return true
    }
    parentId = nodeById[parentId]?.parentId
  }
  return false
}

const collectNodeDataOps = ({
  document,
  changes,
  nodeSize
}: {
  document: Document
  changes: WriteChanges
  nodeSize: Size
}): Operation[] => {
  const next: Operation[] = []

  changes.nodes.forEach((change, nodeId) => {
    if (!change.after || !change.geometry) {
      return
    }

    const node = document.nodes.entities[nodeId]
    if (!node) {
      return
    }

    let data = node.data

    if (node.type === 'text' && hasNodeSizeChange(change)) {
      if (node.data?.[TEXT_WIDTH_MODE_KEY] !== 'fixed') {
        data = {
          ...(data ?? {}),
          [TEXT_WIDTH_MODE_KEY]: 'fixed'
        }
      }
    }

    if (
      node.type === 'group'
      && (
        hasNodePositionChange(change)
        || hasNodeSizeChange(change)
      )
    ) {
      const nextData: Record<string, unknown> = {
        ...(data ?? {}),
        autoFit: 'manual'
      }
      const contentRect = buildGroupContentRect(
        document,
        node.id,
        nodeSize
      )

      if (contentRect) {
        const nextRect = {
          x: node.position.x,
          y: node.position.y,
          width: node.size?.width ?? nodeSize.width,
          height: node.size?.height ?? nodeSize.height
        }
        const padding = resolveContainerPadding({
          containerRect: nextRect,
          contentRect,
          currentPadding: readGroupPadding(node)
        })
        if (padding !== undefined) {
          nextData.padding = padding
        }
      }

      data = nextData
    }

    if (isShallowEqual(node.data, data)) {
      return
    }

    next.push({
      type: 'node.update',
      id: nodeId,
      patch: {
        data
      }
    })
  })

  return next
}

const isSameDelta = (
  left: Point,
  right: Point,
  epsilon = EDGE_FOLLOW_DELTA_EPSILON
) => (
  Math.abs(left.x - right.x) <= epsilon
  && Math.abs(left.y - right.y) <= epsilon
)

const collectReparentOps = ({
  afterDocument,
  moves,
  nodeSize
}: {
  afterDocument: Document
  moves: NodeMoveAnalysis | undefined
  nodeSize: Size
}): Operation[] => {
  if (!moves?.rootIds.length) {
    return []
  }

  const nodes = Object.values(afterDocument.nodes.entities)
  const containerNodes = nodes.filter((node) => !moves.idSet.has(node.id))
  const next: Operation[] = []

  moves.rootIds.forEach((rootId) => {
    const node = afterDocument.nodes.entities[rootId]
    if (!node) {
      return
    }

    const rect = getNodeAABB(node, nodeSize)
    const targetContainerId = findSmallestContainerAtPoint(
      containerNodes,
      nodeSize,
      {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
      },
      node.id
    )?.id

    if (targetContainerId && targetContainerId !== node.parentId) {
      next.push({
        type: 'node.update',
        id: node.id,
        patch: {
          parentId: targetContainerId
        }
      })
      return
    }

    if (!node.parentId) {
      return
    }

    const parentNode = afterDocument.nodes.entities[node.parentId]
    if (!parentNode) {
      return
    }

    const parentRect = getNodeAABB(parentNode, nodeSize)
    if (!rectContains(parentRect, rect)) {
      next.push({
        type: 'node.update',
        id: node.id,
        patch: {
          parentId: undefined
        }
      })
    }
  })

  return next
}

const collectEdgeFollowOps = ({
  afterDocument,
  changes,
  moves
}: {
  afterDocument: Document
  changes: WriteChanges
  moves: NodeMoveAnalysis | undefined
}): Operation[] => {
  if (!moves?.deltaById.size) {
    return []
  }

  const updatedEdgeIds = new Set(changes.edges.keys())
  const next: Operation[] = []

  Object.values(afterDocument.edges.entities).forEach((edge) => {
    if (updatedEdgeIds.has(edge.id)) {
      return
    }
    if (edge.source.kind !== 'node' || edge.target.kind !== 'node') {
      return
    }

    const sourceDelta = moves.deltaById.get(edge.source.nodeId)
    const targetDelta = moves.deltaById.get(edge.target.nodeId)
    if (!sourceDelta || !targetDelta || !isSameDelta(sourceDelta, targetDelta)) {
      return
    }

    const patch = moveEdgePath(edge, sourceDelta)
    if (!patch) {
      return
    }

    next.push({
      type: 'edge.update',
      id: edge.id,
      patch
    })
  })

  return next
}

export const collectFinalizeOps = ({
  afterDocument,
  changes,
  nodeSize
}: {
  afterDocument: Document
  changes: WriteChanges
  nodeSize: Size
}): Operation[] => {
  const moves = analyzeNodeMoves({
    afterDocument,
    changes
  })

  return [
    ...collectNodeDataOps({
      document: afterDocument,
      changes,
      nodeSize
    }),
    ...collectReparentOps({
      afterDocument,
      moves,
      nodeSize
    }),
    ...collectEdgeFollowOps({
      afterDocument,
      changes,
      moves
    })
  ]
}

const readGroupLayoutState = (
  node: Node | undefined
) => (
  node?.type === 'group'
    ? {
        autoFit: node.data?.autoFit,
        padding: typeof node.data?.padding === 'number'
          ? node.data.padding
          : undefined
      }
    : undefined
)

const affectsGroupLayout = (
  change: NodeChange
) => {
  const before = readGroupLayoutState(change.before)
  const after = readGroupLayoutState(change.after)
  if (!before && !after) {
    return false
  }

  return (
    before?.autoFit !== after?.autoFit
    || before?.padding !== after?.padding
  )
}

export const collectDirtyNodeIds = (
  changes: WriteChanges
): ReadonlySet<NodeId> => {
  const nodeIds = new Set<NodeId>()

  changes.nodes.forEach((change, nodeId) => {
    if (
      !change.geometry
      && !change.relation
      && !affectsGroupLayout(change)
    ) {
      return
    }

    if (change.after) {
      nodeIds.add(nodeId)
    }
    if (change.before?.parentId) {
      nodeIds.add(change.before.parentId)
    }
    if (change.after?.parentId) {
      nodeIds.add(change.after.parentId)
    }
  })

  return nodeIds
}
