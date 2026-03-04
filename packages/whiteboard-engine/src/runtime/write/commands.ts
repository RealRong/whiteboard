import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import {
  edge,
  interaction,
  mindmap,
  node,
  shortcut,
  selection,
  viewport
} from './api'
import type { Apply } from './stages/plan/draft'

export const createWriteCommands = ({
  instance,
  apply,
  history
}: {
  instance: WriteDeps['instance']
  apply: Apply
  history: WriteRuntime['history']
}): WriteRuntime['commands'] => {
  const edgeCommands = edge({ instance, apply })
  const nodeCommands = node({ instance, apply })
  const selectionCommands = selection({
    instance,
    commands: {
      node: nodeCommands,
      edge: edgeCommands
    }
  })

  return {
    edge: edgeCommands,
    interaction: interaction({ instance }),
    viewport: viewport({ apply }),
    node: nodeCommands,
    mindmap: mindmap({ apply }),
    selection: selectionCommands,
    shortcut: shortcut({
      selection: selectionCommands,
      history
    })
  }
}
