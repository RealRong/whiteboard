import type { PointerStart } from '../../runtime/input/pointer'

type SelectionInteractionStart = PointerStart & {
  tool: Extract<PointerStart['tool'], {
    type: 'select'
  }>
}

const allowsCanvasContent = (
  start: PointerStart
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const isSelectionInteractionStart = (
  start: PointerStart
): start is SelectionInteractionStart => (
  start.tool.type === 'select'
  && allowsCanvasContent(start)
)
