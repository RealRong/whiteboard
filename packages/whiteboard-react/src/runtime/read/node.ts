import {
  createDerivedStore,
  createKeyedDerivedStore
} from '@whiteboard/core/runtime'
import type {
  KeyedReadStore,
  ReadStore
} from '@whiteboard/core/runtime'
import type { NodeItem } from '@whiteboard/core/read'
import type { NodeId } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import type { EditTarget } from '../edit'
import type { InteractionMode } from '../interaction'
import type { View as SelectionView } from '../selection'
import type { Tool } from '../tool'
import {
  resolveChrome,
  type Chrome
} from '../../features/node/chrome'
import {
  projectNodeItem,
  type NodeSessionReader
} from '../../features/node/session/node'
import type { NodePress } from '../../features/node/session/runtime'

const isChromeEqual = (
  left: Chrome,
  right: Chrome
) => (
  left.selection === right.selection
  && left.toolbar === right.toolbar
  && left.transform === right.transform
  && left.connect === right.connect
)

export type NodeRead = {
  list: EngineRead['node']['list']
  item: KeyedReadStore<NodeId, NodeItem | undefined>
  chrome: ReadStore<Chrome>
}

export const createNodeRead = ({
  read,
  session,
  tool,
  edit,
  selection,
  interaction,
  press
}: {
  read: Pick<EngineRead, 'node'>
  session: NodeSessionReader
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionView>
  interaction: ReadStore<InteractionMode>
  press: ReadStore<NodePress>
}): NodeRead => {
  const chrome = createDerivedStore<Chrome>({
    get: (readStore) => resolveChrome({
      tool: readStore(tool),
      edit: readStore(edit),
      selection: readStore(selection),
      interaction: readStore(interaction),
      press: readStore(press)
    }),
    isEqual: isChromeEqual
  })

  return {
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
    }),
    chrome
  }
}

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
