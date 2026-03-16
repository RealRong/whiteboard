import { createKeyedDerivedStore } from '@whiteboard/core/runtime'
import type { KeyedReadStore } from '@whiteboard/core/runtime'
import type { NodeItem } from '@whiteboard/core/read'
import type { NodeId } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import {
  projectNodeItem,
  type NodeSessionReader
} from '../../features/node/session/node'

const isNodeItemEqual = (
  left: NodeItem | undefined,
  right: NodeItem | undefined
) => (
  left === right
  || (
    left?.node === right?.node
    && left?.rect.x === right?.rect.x
    && left?.rect.y === right?.rect.y
    && left?.rect.width === right?.rect.width
    && left?.rect.height === right?.rect.height
  )
)

export const createNodeRead = ({
  read,
  session
}: {
  read: Pick<EngineRead, 'node'>
  session: NodeSessionReader
}): {
  list: EngineRead['node']['list']
  item: KeyedReadStore<NodeId, NodeItem | undefined>
} => ({
  list: read.node.list,
  item: createKeyedDerivedStore({
    get: (readStore, nodeId: NodeId) => {
      const item = readStore(read.node.item, nodeId)
      if (!item) {
        return undefined
      }
      const sessionValue = readStore(session, nodeId)
      return projectNodeItem(item, sessionValue)
    },
    isEqual: isNodeItemEqual
  })
})
