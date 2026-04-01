import type { InteractionCtx } from '../../runtime/interaction/ctx'
import type { PointerMoveInput, PointerUpInput } from '../../types/input'

export type SelectionInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'state' | 'config' | 'commands' | 'overlay' | 'snap'
>

export type SessionPointer = PointerMoveInput | PointerUpInput

export const readViewport = (
  ctx: SelectionInteractionCtx
) => ctx.state.viewport.read
