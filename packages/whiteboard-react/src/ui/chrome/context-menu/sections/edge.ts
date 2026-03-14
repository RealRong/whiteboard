import type { EdgeId } from '@whiteboard/core/types'
import { closeAfterDispatch } from '../commands'
import type { ContextMenuSection } from '../types'

export const buildEdgeSections = (
  edgeId: EdgeId
): readonly ContextMenuSection[] => [
  {
    key: 'edge.actions',
    items: [
      {
        key: 'edge.delete',
        label: 'Delete',
        tone: 'danger',
        run: ({ instance, close }) => {
          closeAfterDispatch(
            instance.commands.edge.delete([edgeId]),
            close,
            () => {
              instance.commands.selection.selectEdge(undefined)
            }
          )
        }
      }
    ]
  }
]
