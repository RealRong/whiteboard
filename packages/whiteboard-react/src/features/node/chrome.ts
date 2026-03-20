import type { EditTarget } from '../../runtime/edit'
import type { InteractionMode } from '../../runtime/interaction'
import type { View as SelectionView } from '../../runtime/selection'
import type { Tool } from '../../runtime/tool'
import type { NodePress } from './session/runtime'

export type Chrome = {
  selection: boolean
  toolbar: boolean
  transform: boolean
  connect: boolean
}

type ResolveChromeInput = {
  tool: Tool
  edit: EditTarget
  selection: SelectionView
  interaction: InteractionMode
  press: NodePress
}

const showsSelection = (
  press: NodePress
) => press === null || press === 'repeat'

export const resolveChrome = ({
  tool,
  edit,
  selection,
  interaction,
  press
}: ResolveChromeInput): Chrome => {
  const selectionVisible = showsSelection(press)
  const editing = edit !== null
  const edgeSelected = selection.target.edgeId !== undefined
  const idle = interaction === 'idle'

  return {
    selection: selectionVisible,
    toolbar:
      tool.type === 'select'
      && !editing
      && idle
      && selectionVisible
      && !edgeSelected
      && selection.items.count > 0,
    transform:
      tool.type === 'select'
      && !editing
      && !edgeSelected
      && (
        interaction === 'node-transform'
        || (idle && selectionVisible)
      ),
    connect:
      tool.type === 'edge'
      && !editing
      && idle
      && selectionVisible
  }
}
