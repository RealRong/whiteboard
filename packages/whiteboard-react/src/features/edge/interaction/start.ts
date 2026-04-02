import type {
  InteractionControl,
  InteractionStartResult
} from '../../../board'
import type { PointerDownInput } from '../../../board'
import { startEdgeConnectInteraction } from './connect'
import { startEdgeRouteInteraction } from './route'
import type { EdgeInteractionCtx } from './types'

export const startEdgeInteraction = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput,
  control: InteractionControl
): InteractionStartResult => (
  startEdgeConnectInteraction(ctx, input, control)
  ?? startEdgeRouteInteraction(ctx, input, control)
)
