import {
  createMarqueeItemsKey,
  finishMarqueeSession,
  startMarqueeSession,
  stepMarqueeSession,
  type SelectionMarqueeDecision,
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
import type { PointerDownInput } from '../../types/input'
import {
  writeSelectionMarquee
} from './overlay'

type SelectionInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'config' | 'commands' | 'overlay' | 'snap'
>

type MarqueeItems = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

type MarqueePointer = Pick<PointerDownInput, 'screen' | 'world'>

type MarqueeInteractionInput = {
  start: PointerDownInput
  action: SelectionMarqueeDecision
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
  match: SelectionMarqueeDecision['match']
): MarqueeItems => ({
  nodeIds: ctx.read.node.idsInRect(rect, {
    match
  }),
  edgeIds: ctx.read.edge.idsInRect(rect, {
    match
  })
})

const writeMatchedSelection = (
  ctx: SelectionInteractionCtx,
  action: SelectionMarqueeDecision,
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
  session: ReturnType<typeof startMarqueeSession>,
  input: MarqueePointer
) => stepMarqueeSession({
  session,
  currentScreen: input.screen,
  currentWorld: input.world,
  minDistance: GestureTuning.dragMinDistance
})

export const createMarqueeInteraction = (
  ctx: SelectionInteractionCtx,
  input: MarqueeInteractionInput
): InteractionSession => {
  let session = startMarqueeSession({
    pointerId: input.start.pointerId,
    startScreen: input.start.screen,
    startWorld: input.start.world,
    match: input.action.match
  })
  let emittedKey = ''

  writeSelectionMarquee(ctx, undefined)
  if (input.action.clearOnStart) {
    ctx.commands.selection.clear()
  }

  const step = (
    pointer: MarqueePointer
  ) => {
    const result = projectMarquee(session, pointer)
    session = result.session
    if (!result.active || !result.worldRect) {
      return false
    }

    const worldRect = result.worldRect
    const matched = readMatchedItems(ctx, worldRect, input.action.match)
    const nextKey = createMarqueeItemsKey(matched)

    if (nextKey !== emittedKey) {
      emittedKey = nextKey
      writeMatchedSelection(ctx, input.action, matched)
    }

    writeSelectionMarquee(ctx, {
      worldRect,
      match: input.action.match
    })

    return true
  }

  return {
    mode: 'marquee',
    pointerId: input.start.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        if (!session.active) {
          return
        }

        const sample = ctx.read.viewport.pointer(pointer)
        step({
          screen: sample.screen,
          world: sample.world
        })
      }
    },
    move: (next) => {
      step(next)
    },
    up: (next) => {
      const finalState = projectMarquee(session, next)
      session = finalState.session

      const finished = finishMarqueeSession(session)
      if (!finished.active || !finished.worldRect) {
        return
      }

      const matched = readMatchedItems(ctx, finished.worldRect, input.action.match)
      writeMatchedSelection(ctx, input.action, matched)
    },
    cleanup: () => {
      writeSelectionMarquee(ctx, undefined)
    }
  }
}
