import { isDrawBrushKind } from '../../runtime/tool'
import type { PointerStart } from '../../runtime/input/pointer'

type DrawInteractionStart = PointerStart & {
  tool: Extract<PointerStart['tool'], {
    type: 'draw'
  }>
}

const allowsCanvasContent = (
  start: PointerStart
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const isDrawInteractionStart = (
  start: PointerStart
): start is DrawInteractionStart => (
  start.tool.type === 'draw'
  && isDrawBrushKind(start.tool.kind)
  && allowsCanvasContent(start)
)

export const isEraseInteractionStart = (
  start: PointerStart
): start is DrawInteractionStart => (
  start.tool.type === 'draw'
  && start.tool.kind === 'eraser'
  && !start.editable
  && !start.ignoreInput
)
