import type { InteractionStart } from '../../runtime/input/pointer'

type MindmapInteractionStart = InteractionStart & {
  tool: Extract<InteractionStart['tool'], {
    type: 'select'
  }>
  pick: Extract<InteractionStart['pick'], {
    kind: 'mindmap'
  }>
}

const allowsCanvasContent = (
  start: InteractionStart
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const isMindmapInteractionStart = (
  start: InteractionStart
): start is MindmapInteractionStart => (
  start.tool.type === 'select'
  && start.pick.kind === 'mindmap'
  && allowsCanvasContent(start)
)
