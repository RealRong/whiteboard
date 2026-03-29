import type { PointerStart } from '../../runtime/input/pointer'

type MindmapInteractionStart = PointerStart & {
  tool: Extract<PointerStart['tool'], {
    type: 'select'
  }>
  pick: Extract<PointerStart['pick'], {
    kind: 'mindmap'
  }>
}

const allowsCanvasContent = (
  start: PointerStart
) => (
  !start.editable
  && !start.ignoreInput
  && !start.ignoreSelection
)

export const isMindmapInteractionStart = (
  start: PointerStart
): start is MindmapInteractionStart => (
  start.tool.type === 'select'
  && start.pick.kind === 'mindmap'
  && allowsCanvasContent(start)
)
