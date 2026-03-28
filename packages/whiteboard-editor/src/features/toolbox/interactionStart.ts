import type { InteractionStart } from '../../runtime/input/pointer'

type InsertInteractionStart = InteractionStart & {
  tool: Extract<InteractionStart['tool'], {
    type: 'insert'
  }>
}

const allowsCanvasContent = (
  start: InteractionStart
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const isInsertInteractionStart = (
  start: InteractionStart
): start is InsertInteractionStart => (
  start.tool.type === 'insert'
  && allowsCanvasContent(start)
)
