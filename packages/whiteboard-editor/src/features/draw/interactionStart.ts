import { isDrawBrushKind } from '../../runtime/tool'
import type { InteractionStart } from '../../runtime/input/pointer'

type DrawInteractionStart = InteractionStart & {
  tool: Extract<InteractionStart['tool'], {
    type: 'draw'
  }>
}

const allowsCanvasContent = (
  start: InteractionStart
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const isDrawInteractionStart = (
  start: InteractionStart
): start is DrawInteractionStart => (
  start.tool.type === 'draw'
  && isDrawBrushKind(start.tool.kind)
  && allowsCanvasContent(start)
)

export const isEraseInteractionStart = (
  start: InteractionStart
): start is DrawInteractionStart => (
  start.tool.type === 'draw'
  && start.tool.kind === 'eraser'
  && !start.editable
  && !start.ignoreInput
)
