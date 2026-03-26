import { isPointEqual } from '@whiteboard/core/geometry'
import {
  getEdgePathBounds,
  matchEdgeRect,
  resolveEdgeView
} from '@whiteboard/core/edge'
import type { EdgeView as CoreEdgeView } from '@whiteboard/core/edge'
import { createKeyedDerivedStore } from '@whiteboard/core/runtime'
import type { KeyedReadStore } from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import {
  projectEdgeItem,
  type EdgePatchReader
} from '../../features/edge/preview'

type RuntimeEdgeView = CoreEdgeView & {
  edge: EdgeItem['edge']
}

const toNodeCanvas = (item: NodeItem) => ({
  node: item.node,
  rect: item.rect,
  rotation: item.node.rotation ?? 0
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

export const createEdgeRead = ({
  read,
  nodeItem,
  patch
}: {
  read: Pick<EngineRead, 'edge'>
  nodeItem: KeyedReadStore<string, NodeItem | undefined>
  patch: EdgePatchReader
}): {
  list: EngineRead['edge']['list']
  item: KeyedReadStore<EdgeId, EdgeItem | undefined>
  view: KeyedReadStore<EdgeId, RuntimeEdgeView | undefined>
  related: (nodeIds: Iterable<NodeId>) => readonly EdgeId[]
  bounds: (edgeId: EdgeId) => Rect | undefined
  idsInRect: (rect: Rect, options?: {
    match?: 'touch' | 'contain'
  }) => EdgeId[]
} => {
  const item = createKeyedDerivedStore({
    get: (readStore, edgeId: EdgeId) => {
      const entry = readStore(read.edge.item, edgeId)
      if (!entry) {
        return undefined
      }

      return projectEdgeItem(entry, readStore(patch, edgeId))
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
        ...resolved
      }
    }
  })

  const readEdgeView = (edgeId: EdgeId) => view.get(edgeId)

  return {
    list: read.edge.list,
    item,
    view,
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
