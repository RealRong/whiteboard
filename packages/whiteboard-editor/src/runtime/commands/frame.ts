import type { Editor } from '../../types/public/editor'
import type { FrameState } from '../frame'

export const createFrameCommands = ({
  frame,
  selection
}: {
  frame: FrameState
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
