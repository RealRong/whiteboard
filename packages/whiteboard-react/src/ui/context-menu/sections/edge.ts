import type { EdgeId } from '@whiteboard/core/types'
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
          void instance.commands.edge.delete([edgeId])
            .then((result) => {
              if (!result.ok) return
              instance.commands.selection.selectEdge(undefined)
            })
            .finally(close)
        }
      }
    ]
  }
]
