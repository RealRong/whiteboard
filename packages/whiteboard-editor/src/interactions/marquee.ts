import { rectFromPoints } from '@whiteboard/core/geometry'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import { createRafTask } from '@whiteboard/engine'
import {
  GestureTuning,
  type InteractionPointerInput,
  type InteractionRegistration
} from '../../runtime/interaction'
import type { PointerDown } from '../../runtime/input/pointer'
import type { FeatureRuntime } from '../../runtime/editor/featureRuntime'
import type { ViewportPointer } from '../../runtime/viewport'
import type { MarqueeMatch } from '../../runtime/feedback/marquee'

export type MarqueeItems = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type MarqueeEnd = {
  moved: boolean
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type MarqueeStartInput = {
  pointerId: number
  start: ViewportPointer
  match: MarqueeMatch
  onStart?: () => void
  onChange?: (items: MarqueeItems) => void
  onEnd?: (result: MarqueeEnd) => void
}

type ActiveMarquee = {
  pointerId: number
  start: ViewportPointer
  match: MarqueeMatch
  latest?: MarqueeItems
  emittedKey: string
  onChange?: (items: MarqueeItems) => void
  onEnd?: (result: MarqueeEnd) => void
}

export type MarqueeInteraction = {
  interaction: InteractionRegistration<ActiveMarquee, MarqueeStartInput>
  createState: (input: MarqueeStartInput) => ActiveMarquee
  clear: () => void
}

type MarqueeInteractionDeps = Pick<
  FeatureRuntime,
  'query' | 'viewport' | 'output'
>

const toItemsKey = (
  items: MarqueeItems
) => [
  [...items.nodeIds].sort().join('|'),
  [...items.edgeIds].sort().join('|')
].join('::')

export const createMarqueeInteraction = (
  ctx: MarqueeInteractionDeps
): MarqueeInteraction => {
  const readMatchedItems = (
    queryRect: Rect,
    match: MarqueeMatch
  ): MarqueeItems => ({
    nodeIds: ctx.query.read.node.idsInRect(queryRect, {
      match
    }),
    edgeIds: ctx.query.read.edge.idsInRect(queryRect, {
      match
    })
  })

  const flushChange = (
    state: ActiveMarquee
  ) => {
    if (state.latest === undefined) {
      return
    }

    const nextKey = toItemsKey(state.latest)
    if (nextKey === state.emittedKey) {
      return
    }

    state.emittedKey = nextKey
    state.onChange?.(state.latest)
  }

  const flushTask = createRafTask(() => {
    const current = pendingFlush
    if (!current) {
      return
    }

    flushChange(current)
  })
  let pendingFlush: ActiveMarquee | null = null

  const clear = () => {
    pendingFlush = null
    flushTask.cancel()
    ctx.output.marquee.clear()
  }

  const scheduleFlush = (
    state: ActiveMarquee
  ) => {
    pendingFlush = state
    flushTask.schedule()
  }

  const update = (
    state: ActiveMarquee,
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const current = ctx.viewport.pointer(input)
    const dx = Math.abs(current.screen.x - state.start.screen.x)
    const dy = Math.abs(current.screen.y - state.start.screen.y)

    if (
      state.latest === undefined
      && dx < GestureTuning.dragMinDistance
      && dy < GestureTuning.dragMinDistance
    ) {
      return false
    }

    const worldRect = rectFromPoints(state.start.world, current.world)
    state.latest = readMatchedItems(worldRect, state.match)
    ctx.output.marquee.set({
      worldRect,
      match: state.match
    })
    scheduleFlush(state)
    return true
  }

  const createState = (
    input: MarqueeStartInput
  ): ActiveMarquee => ({
    pointerId: input.pointerId,
    start: input.start,
    match: input.match,
    emittedKey: '',
    onChange: input.onChange,
    onEnd: input.onEnd
  })

  const interaction: InteractionRegistration<ActiveMarquee, MarqueeStartInput> = {
    key: 'selection.marquee',
    mode: 'marquee',
    pan: (state) => ({
      frame: (pointer) => {
        if (state.latest === undefined) {
          return
        }

        update(state, pointer)
      }
    }),
    start: ({ input }) => {
      input.onStart?.()
      ctx.output.marquee.clear()
    },
    move: ({ state, session }, input: InteractionPointerInput) => {
      if (update(state, {
        clientX: input.client.x,
        clientY: input.client.y
      })) {
        session.pan({
          clientX: input.client.x,
          clientY: input.client.y
        })
      }
    },
    up: ({ state, session }, input: InteractionPointerInput) => {
      if (state.latest !== undefined) {
        state.latest = readMatchedItems(
          rectFromPoints(state.start.world, input.world),
          state.match
        )
        flushChange(state)
        state.onEnd?.({
          moved: true,
          nodeIds: state.latest.nodeIds,
          edgeIds: state.latest.edgeIds
        })
      } else {
        state.onEnd?.({
          moved: false,
          nodeIds: [],
          edgeIds: []
        })
      }

      session.finish()
    },
    cleanup: () => {
      clear()
    }
  }

  return {
    interaction,
    createState,
    clear
  }
}
