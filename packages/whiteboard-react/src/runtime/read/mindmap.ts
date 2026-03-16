import { createKeyedDerivedStore } from '@whiteboard/core/runtime'
import type { KeyedReadStore } from '@whiteboard/core/runtime'
import type { MindmapItem } from '@whiteboard/core/read'
import type { NodeId } from '@whiteboard/core/types'
import type { EngineRead } from '@whiteboard/engine'
import type { MindmapDragSessionReader } from '../../features/mindmap/session'

const isMindmapItemEqual = (
  left: MindmapItem | undefined,
  right: MindmapItem | undefined
) => (
  left === right
  || (
    left?.node === right?.node
    && left?.tree === right?.tree
    && left?.layout === right?.layout
    && left?.computed === right?.computed
    && left?.shiftX === right?.shiftX
    && left?.shiftY === right?.shiftY
    && left?.lines === right?.lines
    && left?.labels === right?.labels
  )
)

export const createMindmapRead = ({
  read,
  session
}: {
  read: Pick<EngineRead, 'mindmap'>
  session: MindmapDragSessionReader
}): {
  list: EngineRead['mindmap']['list']
  item: KeyedReadStore<NodeId, MindmapItem | undefined>
} => ({
  list: read.mindmap.list,
  item: createKeyedDerivedStore({
    get: (readStore, treeId: NodeId) => {
      const item = readStore(read.mindmap.item, treeId)
      if (!item) {
        return undefined
      }

      const drag = readStore(session)
      if (!drag || drag.treeId !== treeId || drag.kind !== 'root') {
        return item
      }

      if (
        drag.baseOffset.x === item.node.position.x
        && drag.baseOffset.y === item.node.position.y
      ) {
        return item
      }

      return {
        ...item,
        node: {
          ...item.node,
          position: drag.baseOffset
        }
      }
    },
    isEqual: isMindmapItemEqual
  })
})
