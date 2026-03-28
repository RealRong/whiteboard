import type { InteractionStart } from '../../../runtime/input/pointer'

type TransformInteractionStart = InteractionStart & {
  tool: Extract<InteractionStart['tool'], {
    type: 'select'
  }>
  pick: Extract<InteractionStart['pick'], {
    kind: 'node' | 'selection-box'
  }> & {
    part: 'transform'
    handle: NonNullable<InteractionStart['pick'] extends { handle?: infer T } ? T : never>
  }
}

export const isTransformInteractionStart = (
  start: InteractionStart
): start is TransformInteractionStart => (
  start.tool.type === 'select'
  && (start.pick.kind === 'node' || start.pick.kind === 'selection-box')
  && start.pick.part === 'transform'
  && Boolean(start.pick.handle)
)
