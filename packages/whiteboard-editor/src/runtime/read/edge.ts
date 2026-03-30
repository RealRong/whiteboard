import { isPointEqual } from '@whiteboard/core/geometry'
import {
  applyEdgeProjectionPatch,
  type EdgeConnectCandidate,
  getEdgePathBounds,
  matchEdgeRect,
  resolveEdgeView
} from '@whiteboard/core/edge'
import type { EdgeView as CoreEdgeView } from '@whiteboard/core/edge'
import { isPointEdgeEnd } from '@whiteboard/core/types'
import type { EdgeId, Node, NodeId, NodeType, Rect } from '@whiteboard/core/types'
import {
  createKeyedDerivedStore,
  type EdgeItem,
  type EngineRead,
  type KeyedReadStore,
  type NodeItem
} from '@whiteboard/engine'
import type { EdgeProjectionPatchReader } from '../projection/edge'

type RuntimeEdgeView = CoreEdgeView & {
  edge: EdgeItem['edge']
  can: {
    move: boolean
    reconnectSource: boolean
    reconnectTarget: boolean
    editRoute: boolean
  }
}

const toNodeCanvas = (item: NodeItem) => ({
  node: item.node,
  rect: item.rect,
  rotation: item.node.type === 'group'
    ? 0
    : (item.node.rotation ?? 0)
})

const isEdgeItemEqual = (
  left: EdgeItem | undefined,
  right: EdgeItem | undefined
) => (
  left === right
  || (
    left?.edge === right?.edge
    && left?.ends.source.end.kind === right?.ends.source.end.kind
    && left?.ends.target.end.kind === right?.ends.target.end.kind
    && left?.ends.source.anchor?.side === right?.ends.source.anchor?.side
    && left?.ends.target.anchor?.side === right?.ends.target.anchor?.side
    && left?.ends.source.anchor?.offset === right?.ends.source.anchor?.offset
    && left?.ends.target.anchor?.offset === right?.ends.target.anchor?.offset
    && isPointEqual(left?.ends.source.point, right?.ends.source.point)
    && isPointEqual(left?.ends.target.point, right?.ends.target.point)
  )
)

const resolveEdgeCan = (
  edge: EdgeItem['edge']
): RuntimeEdgeView['can'] => ({
  move: isPointEdgeEnd(edge.source) && isPointEdgeEnd(edge.target),
  reconnectSource: true,
  reconnectTarget: true,
  editRoute: true
})

export type EdgeConnectRead = {
  candidatesInRect: (rect: Rect) => readonly EdgeConnectCandidate[]
}

export type EdgeRead = {
  list: EngineRead['edge']['list']
  item: KeyedReadStore<EdgeId, EdgeItem | undefined>
  view: KeyedReadStore<EdgeId, RuntimeEdgeView | undefined>
  connect: EdgeConnectRead
  related: (nodeIds: Iterable<NodeId>) => readonly EdgeId[]
  bounds: (edgeId: EdgeId) => Rect | undefined
  idsInRect: (rect: Rect, options?: {
    match?: 'touch' | 'contain'
  }) => EdgeId[]
}

export const createEdgeRead = ({
  read,
  nodeItem,
  patch,
  connect
}: {
  read: Pick<EngineRead, 'edge' | 'index'>
  nodeItem: KeyedReadStore<string, NodeItem | undefined>
  patch: EdgeProjectionPatchReader
  connect: (node: Pick<Node, 'type'> | NodeType) => boolean
}): EdgeRead => {
  const item = createKeyedDerivedStore({
    get: (readStore, edgeId: EdgeId) => {
      const entry = readStore(read.edge.item, edgeId)
      if (!entry) {
        return undefined
      }

      const nextEdge = applyEdgeProjectionPatch(entry.edge, readStore(patch, edgeId))
      return nextEdge === entry.edge
        ? entry
        : {
            ...entry,
            edge: nextEdge
          }
    },
    isEqual: isEdgeItemEqual
  })

  const view = createKeyedDerivedStore({
    get: (readStore, edgeId: EdgeId) => {
      const entry = readStore(item, edgeId)
      if (!entry) {
        return undefined
      }

      const source =
        entry.edge.source.kind === 'node'
          ? readStore(nodeItem, entry.edge.source.nodeId)
          : undefined
      const target =
        entry.edge.target.kind === 'node'
          ? readStore(nodeItem, entry.edge.target.nodeId)
          : undefined

      const resolved = resolveEdgeView({
        edge: entry.edge,
        source: source ? toNodeCanvas(source) : undefined,
        target: target ? toNodeCanvas(target) : undefined
      })

      return {
        edge: entry.edge,
        can: resolveEdgeCan(entry.edge),
        ...resolved
      }
    }
  })

  const readEdgeView = (edgeId: EdgeId) => view.get(edgeId)
  const readConnectCandidatesInRect: EdgeConnectRead['candidatesInRect'] = (
    rect
  ) => {
    const nodeIds = read.index.node.idsInRect(rect)
    const candidates: EdgeConnectCandidate[] = []

    for (let index = 0; index < nodeIds.length; index += 1) {
      const entry = read.index.node.get(nodeIds[index])
      if (!entry || !connect(entry.node)) {
        continue
      }

      candidates.push({
        nodeId: entry.node.id,
        node: entry.node,
        rect: entry.rect,
        aabb: entry.aabb,
        rotation: entry.rotation
      })
    }

    return candidates
  }

  return {
    list: read.edge.list,
    item,
    view,
    connect: {
      candidatesInRect: readConnectCandidatesInRect
    },
    related: read.edge.related,
    bounds: (edgeId) => {
      const nextView = readEdgeView(edgeId)
      return nextView
        ? getEdgePathBounds(nextView.path)
        : undefined
    },
    idsInRect: (rect, options) => read.edge.list.get().filter((edgeId) => {
      const nextView = readEdgeView(edgeId)
      if (!nextView) {
        return false
      }

      return matchEdgeRect({
        path: nextView.path,
        queryRect: rect,
        mode: options?.match ?? 'touch'
      })
    })
  }
}
