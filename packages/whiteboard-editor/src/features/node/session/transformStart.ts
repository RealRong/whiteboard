import type { PointerStart } from '../../../runtime/input/pointer'

type TransformInteractionStart = PointerStart & {
  tool: Extract<PointerStart['tool'], {
    type: 'select'
  }>
  pick: Extract<PointerStart['pick'], {
    kind: 'node' | 'selection-box'
  }> & {
    part: 'transform'
    handle: NonNullable<PointerStart['pick'] extends { handle?: infer T } ? T : never>
  }
}

export const isTransformInteractionStart = (
  start: PointerStart
): start is TransformInteractionStart => (
  start.tool.type === 'select'
  && (start.pick.kind === 'node' || start.pick.kind === 'selection-box')
  && start.pick.part === 'transform'
  && Boolean(start.pick.handle)
)
