import type { PointerStart } from '../../runtime/input/pointer'

type InsertInteractionStart = PointerStart & {
  tool: Extract<PointerStart['tool'], {
    type: 'insert'
  }>
}

const allowsCanvasContent = (
  start: PointerStart
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const isInsertInteractionStart = (
  start: PointerStart
): start is InsertInteractionStart => (
  start.tool.type === 'insert'
  && allowsCanvasContent(start)
)
