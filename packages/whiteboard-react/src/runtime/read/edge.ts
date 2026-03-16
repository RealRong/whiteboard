import { isPointEqual } from '@whiteboard/core/geometry'
import { resolveEdgeEndpoints } from '@whiteboard/core/edge'
import { createKeyedDerivedStore } from '@whiteboard/core/runtime'
import type { KeyedReadStore } from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type { EdgeId } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import {
  projectEdgeItem,
  type EdgeRoutingSessionReader
} from '../../features/edge/session/routing'

const toNodeCanvas = (item: NodeItem) => ({
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
    && left?.endpoints.source.nodeId === right?.endpoints.source.nodeId
    && left?.endpoints.target.nodeId === right?.endpoints.target.nodeId
    && left?.endpoints.source.anchor.side === right?.endpoints.source.anchor.side
    && left?.endpoints.target.anchor.side === right?.endpoints.target.anchor.side
    && left?.endpoints.source.anchor.offset === right?.endpoints.source.anchor.offset
    && left?.endpoints.target.anchor.offset === right?.endpoints.target.anchor.offset
    && isPointEqual(left?.endpoints.source.point, right?.endpoints.source.point)
    && isPointEqual(left?.endpoints.target.point, right?.endpoints.target.point)
  )
)

export const createEdgeRead = ({
  read,
  nodeItem,
  session
}: {
  read: Pick<EngineRead, 'edge'>
  nodeItem: KeyedReadStore<string, NodeItem | undefined>
  session: EdgeRoutingSessionReader
}): {
  list: EngineRead['edge']['list']
  item: KeyedReadStore<EdgeId, EdgeItem | undefined>
} => ({
  list: read.edge.list,
  item: createKeyedDerivedStore({
    get: (readStore, edgeId: EdgeId) => {
      const entry = readStore(read.edge.item, edgeId)
      if (!entry) {
        return undefined
      }

      const nextEntry = projectEdgeItem(entry, readStore(session, edgeId))
      const source = readStore(nodeItem, nextEntry.edge.source.nodeId)
      const target = readStore(nodeItem, nextEntry.edge.target.nodeId)
      if (!source || !target) {
        return nextEntry
      }

      const endpoints = resolveEdgeEndpoints({
        edge: nextEntry.edge,
        source: toNodeCanvas(source),
        target: toNodeCanvas(target)
      })

      return {
        ...nextEntry,
        endpoints
      }
    },
    isEqual: isEdgeItemEqual
  })
})
