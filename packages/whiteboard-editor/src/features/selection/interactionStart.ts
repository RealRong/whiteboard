import type { InteractionStart } from '../../runtime/input/pointer'

type SelectionInteractionStart = InteractionStart & {
  tool: Extract<InteractionStart['tool'], {
    type: 'select'
  }>
}

const allowsCanvasContent = (
  start: InteractionStart
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const isSelectionInteractionStart = (
  start: InteractionStart
): start is SelectionInteractionStart => (
  start.tool.type === 'select'
  && allowsCanvasContent(start)
)
