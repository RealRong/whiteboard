import type { Editor } from '../instance/types'
import { createState as createFrameState } from '../frame'

export const createFrameCommands = ({
  frame,
  selection
}: {
  frame: ReturnType<typeof createFrameState>
  selection: Pick<Editor['commands']['selection'], 'clear'>
}): Editor['commands']['frame'] => ({
  enter: (nodeId) => {
    selection.clear()
    frame.commands.enter(nodeId)
  },
  exit: () => {
    selection.clear()
    frame.commands.exit()
  },
  clear: () => {
    selection.clear()
    frame.commands.clear()
  }
})
