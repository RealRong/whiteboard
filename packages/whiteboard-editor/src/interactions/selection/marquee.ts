import {
  createMarqueeItemsKey,
  finishMarqueeSession,
  startMarqueeSession,
  stepMarqueeSession,
  type SelectionDragDecision,
  type SelectionTarget
} from '@whiteboard/core/selection'
import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import {
  GestureTuning,
  type InteractionCtx,
  type InteractionSession
} from '../../runtime/interaction'
import type {
  PointerDownInput,
  PointerMoveInput,
  PointerUpInput
} from '../../types/input'

type SelectionInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'state' | 'config' | 'commands' | 'overlay' | 'snap'
>

type SessionPointer = PointerMoveInput | PointerUpInput

type MarqueeItems = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

type MarqueeInteractionInput = {
  start: PointerDownInput
  action: Extract<SelectionDragDecision, { kind: 'marquee' }>
  initialInput?: SessionPointer
}

type MarqueeState = {
  session: ReturnType<typeof startMarqueeSession>
  latest?: MarqueeItems
  emittedKey: string
}

const applyMatchedSelection = (
  base: SelectionTarget,
  matched: SelectionTarget,
  mode: SelectionMode
): SelectionTarget => ({
  nodeIds: [
    ...applySelection(
      new Set(base.nodeIds),
      [...matched.nodeIds],
      mode
    )
  ],
  edgeIds: [
    ...applySelection(
      new Set(base.edgeIds),
      [...matched.edgeIds],
      mode
    )
  ]
})

const readMatchedItems = (
  ctx: SelectionInteractionCtx,
  rect: Rect,
  match: Extract<SelectionDragDecision, { kind: 'marquee' }>['match']
): MarqueeItems => ({
  nodeIds: ctx.read.node.idsInRect(rect, {
    match
  }),
  edgeIds: ctx.read.edge.idsInRect(rect, {
    match
  })
})

const clearMarqueeOverlay = (
  ctx: SelectionInteractionCtx
) => {
  ctx.overlay.set((current) => (
    current.selection.marquee === undefined
      ? current
      : {
          ...current,
          selection: {
            ...current.selection,
            marquee: undefined
          }
        }
  ))
}

const writeMatchedSelection = (
  ctx: SelectionInteractionCtx,
  action: Extract<SelectionDragDecision, { kind: 'marquee' }>,
  items: MarqueeItems
) => {
  ctx.commands.selection.replace(
    applyMatchedSelection(
      action.base,
      {
        nodeIds: items.nodeIds,
        edgeIds: items.edgeIds
      },
      action.mode
    )
  )
}

const projectMarquee = (
  ctx: SelectionInteractionCtx,
  state: MarqueeState,
  action: Extract<SelectionDragDecision, { kind: 'marquee' }>,
  input: SessionPointer
) => {
  const result = stepMarqueeSession({
    session: state.session,
    currentScreen: input.screen,
    currentWorld: input.world,
    minDistance: GestureTuning.dragMinDistance
  })

  state.session = result.session
  if (!result.active || !result.worldRect) {
    return false
  }

  const worldRect = result.worldRect
  const matched = readMatchedItems(ctx, worldRect, action.match)
  const nextKey = createMarqueeItemsKey(matched)

  state.latest = matched
  if (nextKey !== state.emittedKey) {
    state.emittedKey = nextKey
    writeMatchedSelection(ctx, action, matched)
  }

  ctx.overlay.set((current) => ({
      ...current,
      selection: {
        ...current.selection,
        marquee: {
          worldRect,
          match: action.match
        }
      }
  }))

  return true
}

export const createMarqueeInteraction = (
  ctx: SelectionInteractionCtx,
  input: MarqueeInteractionInput
): InteractionSession => {
  const state: MarqueeState = {
    session: startMarqueeSession({
      pointerId: input.start.pointerId,
      startScreen: input.start.screen,
      startWorld: input.start.world,
      match: input.action.match
    }),
    emittedKey: ''
  }

  clearMarqueeOverlay(ctx)
  if (input.action.clearOnStart) {
    ctx.commands.selection.clear()
  }

  if (input.initialInput) {
    projectMarquee(ctx, state, input.action, input.initialInput)
  }

  return {
    mode: 'marquee',
    pointerId: input.start.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        if (!state.session.active) {
          return
        }

        projectMarquee(ctx, state, input.action, {
          ...input.start,
          phase: 'move',
          client: {
            x: pointer.clientX,
            y: pointer.clientY
          },
          screen: ctx.state.viewport.read.pointer(pointer).screen,
          world: ctx.state.viewport.read.pointer(pointer).world
        })
      }
    },
    move: (next) => {
      projectMarquee(ctx, state, input.action, next)
    },
    up: (next) => {
      const finalState = stepMarqueeSession({
        session: state.session,
        currentScreen: next.screen,
        currentWorld: next.world,
        minDistance: GestureTuning.dragMinDistance
      })
      state.session = finalState.session

      const finished = finishMarqueeSession(state.session)
      if (!finished.active || !finished.worldRect) {
        return
      }

      const matched = readMatchedItems(ctx, finished.worldRect, input.action.match)
      state.latest = matched
      writeMatchedSelection(ctx, input.action, matched)
    },
    cleanup: () => {
      clearMarqueeOverlay(ctx)
    }
  }
}
