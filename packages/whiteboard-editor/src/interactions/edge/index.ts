import type { InteractionControl, InteractionSession } from '../../runtime/interaction'
import type { PointerDownInput } from '../../types/input'
import { readEdgeType } from '../../edge/preset'
import { createConnectInteraction, startEdgeCreateSession, startEdgeReconnectSession } from './connect'
import { createEdgeObserve } from './observe'
import { clearEdgeOverlay } from './overlay'
import { createMoveBodyInteraction, createRouteInteraction, startEdgeRouteSession } from './route'
import type {
  BodyMoveState,
  EdgeInteraction,
  EdgeInteractionCtx,
  EdgeSession
} from './types'
import { readPointer } from './types'

const startEdgeSession = (
  ctx: EdgeInteractionCtx,
  input: PointerDownInput
): EdgeSession | null => {
  const tool = ctx.read.tool.get()

  if (tool.type === 'edge') {
    const canStartFromNodeHandle =
      input.pick.kind === 'node'
      && input.pick.part === 'connect'
      && Boolean(input.pick.side)

    if (
      !canStartFromNodeHandle
      && (input.editable || input.ignoreInput || input.ignoreSelection)
    ) {
      return null
    }

    return {
      kind: 'connect',
      state: startEdgeCreateSession(
        ctx,
        input,
        readPointer({
          pointerId: input.pointerId,
          world: input.world
        }),
        readEdgeType(tool.preset)
      )
    }
  }

  if (
    tool.type === 'select'
    && input.pick.kind === 'edge'
    && input.pick.part === 'end'
    && input.pick.end
  ) {
    const state = startEdgeReconnectSession(
      ctx,
      input.pick.id,
      input.pick.end,
      readPointer({
        pointerId: input.pointerId,
        world: input.world
      })
    )
    if (!state || state.kind !== 'reconnect') {
      return null
    }

    ctx.commands.selection.replace({
      edgeIds: [state.edgeId]
    })
    return {
      kind: 'connect',
      state
    }
  }

  if (
    tool.type === 'select'
    && input.pick.kind === 'edge'
    && input.pick.part === 'path'
  ) {
    const state = startEdgeRouteSession(ctx, input)
    return state
      ? {
          kind: 'route',
          state
        }
      : null
  }

  if (
    tool.type === 'select'
    && input.pick.kind === 'edge'
    && input.pick.part === 'body'
  ) {
    const item = ctx.read.edge.item.get(input.pick.id)
    const capability = item
      ? ctx.read.edge.capability(item.edge)
      : undefined
    if (!capability) {
      return null
    }

    if (input.modifiers.shift || input.detail >= 2) {
      if (!capability.editRoute) {
        return null
      }

      ctx.commands.selection.replace({
        edgeIds: [input.pick.id]
      })

      return {
        kind: 'insertBodyRoute',
        edgeId: input.pick.id
      }
    }

    if (!capability.move) {
      return null
    }

    const state: BodyMoveState = {
      edgeId: input.pick.id,
      pointerId: input.pointerId,
      start: input.world,
      delta: { x: 0, y: 0 }
    }

    ctx.commands.selection.replace({
      edgeIds: [state.edgeId]
    })

    return {
      kind: 'moveBody',
      state
    }
  }

  return null
}

const createEdgeSession = (
  ctx: EdgeInteractionCtx,
  session: EdgeSession,
  input: PointerDownInput,
  control: InteractionControl
): InteractionSession => {
  if (session.kind === 'connect') {
    return createConnectInteraction(ctx, session.state, control)
  }

  if (session.kind === 'moveBody') {
    return createMoveBodyInteraction(ctx, session.state, control)
  }

  if (session.kind === 'insertBodyRoute') {
    ctx.commands.edge.route.insert(session.edgeId, input.world)
    control.finish()

    return {
      mode: 'edge-route',
      cleanup: () => {
        clearEdgeOverlay(ctx)
      }
    }
  }

  return createRouteInteraction(ctx, session.state, input, control)
}

export const createEdgeInteraction = (
  ctx: EdgeInteractionCtx
): EdgeInteraction => {
  const observe = createEdgeObserve(ctx)

  return {
    owner: {
      key: 'edge',
      priority: 500,
      start: (input, control) => {
        const session = startEdgeSession(ctx, input)
        return session
          ? createEdgeSession(ctx, session, input, control)
          : null
      },
      observe
    },
    clear: () => {
      observe.cancel?.()
      clearEdgeOverlay(ctx)
    }
  }
}

export type { EdgeInteraction } from './types'
