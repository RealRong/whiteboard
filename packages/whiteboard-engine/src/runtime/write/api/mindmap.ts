import type { MindmapCommandsApi } from '@engine-types/write/commands'
import type { Apply } from '../stages/plan/draft'

export const mindmap = ({
  apply
}: {
  apply: Apply
}): MindmapCommandsApi => ({
  apply: (command) =>
    apply({
      domain: 'mindmap',
      command,
      source: 'ui'
    })
})
