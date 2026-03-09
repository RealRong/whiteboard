import type { MindmapCommandsApi } from '@engine-types/write'
import type { Apply } from '../write/draft'

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
