import { isPointEqual } from '@whiteboard/core/geometry'
import {
  getEdgePath,
  getEdgePathBounds,
  matchEdgeRect,
  resolveEdgeEnds
} from '@whiteboard/core/edge'
import { createKeyedDerivedStore } from '@whiteboard/core/runtime'
import type { KeyedReadStore } from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import {
  projectEdgeItem,
  type EdgePatchReader
} from '../../features/edge/preview'

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

      const nextEntry = projectEdgeItem(entry, readStore(patch, edgeId))
      const source =
        nextEntry.edge.source.kind === 'node'
          ? readStore(nodeItem, nextEntry.edge.source.nodeId)
          : undefined
      const target =
        nextEntry.edge.target.kind === 'node'
          ? readStore(nodeItem, nextEntry.edge.target.nodeId)
          : undefined
      if (
        (nextEntry.edge.source.kind === 'node' && !source)
        || (nextEntry.edge.target.kind === 'node' && !target)
      ) {
        return nextEntry
      }

      const ends = resolveEdgeEnds({
        edge: nextEntry.edge,
        source: source ? toNodeCanvas(source) : undefined,
        target: target ? toNodeCanvas(target) : undefined
      })
      if (!ends) {
        return nextEntry
      }

      return {
        ...nextEntry,
        ends
      }
    },
    isEqual: isEdgeItemEqual
  })

  const readEdgePath = (edgeId: EdgeId) => {
    const entry = item.get(edgeId)
    if (!entry) {
      return undefined
    }

    return getEdgePath({
      edge: entry.edge,
      source: {
        point: entry.ends.source.point,
        side: entry.ends.source.anchor?.side
      },
      target: {
        point: entry.ends.target.point,
        side: entry.ends.target.anchor?.side
      }
    })
  }

  return {
    list: read.edge.list,
    item,
    related: read.edge.related,
    bounds: (edgeId) => {
      const path = readEdgePath(edgeId)
      return path
        ? getEdgePathBounds(path)
        : undefined
    },
    idsInRect: (rect, options) => read.edge.list.get().filter((edgeId) => {
      const path = readEdgePath(edgeId)
      if (!path) {
        return false
      }

      return matchEdgeRect({
        path,
        queryRect: rect,
        mode: options?.match ?? 'touch'
      })
    })
  }
}
