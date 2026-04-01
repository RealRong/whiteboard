import {
  createMarqueeItemsKey,
  createMarqueeRect,
  hasMarqueeStarted,
  type SelectionMarqueeItems
} from '@whiteboard/core/selection'
import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import { createRafTask } from '@whiteboard/engine'
import {
  GestureTuning,
  type ActiveInteraction,
  type InteractionPointerInput
} from '../runtime/interaction'
import type { InteractionHost } from '../runtime/interaction/host'
import type { ViewportPointer } from '../runtime/viewport'
import type { MarqueeMatch } from '../runtime/overlay'

export type MarqueeItems = SelectionMarqueeItems

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

type MarqueePhaseDeps = Pick<
  InteractionHost,
  'read' | 'viewport' | 'overlay'
>

const readMatchedItems = (
  ctx: MarqueePhaseDeps,
  queryRect: Rect,
  match: MarqueeMatch
): MarqueeItems => ({
  nodeIds: ctx.read.node.idsInRect(queryRect, {
    match
  }),
  edgeIds: ctx.read.edge.idsInRect(queryRect, {
    match
  })
})

const createMarqueeState = (
  input: MarqueeStartInput
): ActiveMarquee => ({
  pointerId: input.pointerId,
  start: input.start,
  match: input.match,
  emittedKey: '',
  onChange: input.onChange,
  onEnd: input.onEnd
})

const createMarqueeController = (
  ctx: MarqueePhaseDeps
) => {
  let pendingFlush: ActiveMarquee | null = null

  const flushChange = (
    state: ActiveMarquee
  ) => {
    if (state.latest === undefined) {
      return
    }

    const nextKey = createMarqueeItemsKey(state.latest)
    if (nextKey === state.emittedKey) {
      return
    }

    state.emittedKey = nextKey
    state.onChange?.(state.latest)
  }

  const flushTask = createRafTask(() => {
    if (!pendingFlush) {
      return
    }

    flushChange(pendingFlush)
  })

  const clear = () => {
    pendingFlush = null
    flushTask.cancel()
    ctx.overlay.set((current) => (
      current.select.marquee === undefined
        ? current
        : {
            ...current,
            select: {
              ...current.select,
              marquee: undefined
            }
          }
    ))
  }

  const scheduleFlush = (
    state: ActiveMarquee
  ) => {
    pendingFlush = state
    flushTask.schedule()
  }

  const update = (
    state: ActiveMarquee,
    pointer: {
      clientX: number
      clientY: number
    }
  ) => {
    const current = ctx.viewport.pointer(pointer)
    if (!hasMarqueeStarted({
      startScreen: state.start.screen,
      currentScreen: current.screen,
      minDistance: GestureTuning.dragMinDistance,
      active: state.latest !== undefined
    })) {
      return false
    }

    const worldRect = createMarqueeRect(state.start.world, current.world)
    state.latest = readMatchedItems(ctx, worldRect, state.match)
    ctx.overlay.set((currentOverlay) => ({
      ...currentOverlay,
      select: {
        ...currentOverlay.select,
        marquee: {
          worldRect,
          match: state.match
        }
      }
    }))
    scheduleFlush(state)
    return true
  }

  const pan = (
    state: ActiveMarquee,
    pointer: {
      clientX: number
      clientY: number
    }
  ) => {
    if (state.latest === undefined) {
      return
    }

    update(state, pointer)
  }

  const start = (
    input: MarqueeStartInput
  ) => {
    input.onStart?.()
    clear()
  }

  const move = (
    state: ActiveMarquee,
    input: InteractionPointerInput
  ) => update(state, {
      clientX: input.client.x,
      clientY: input.client.y
    })

  const finish = (
    state: ActiveMarquee,
    world: Point
  ): MarqueeEnd => {
    if (state.latest === undefined) {
      const result = {
        moved: false,
        nodeIds: [],
        edgeIds: []
      } satisfies MarqueeEnd
      state.onEnd?.(result)
      return result
    }

    state.latest = readMatchedItems(
      ctx,
      createMarqueeRect(state.start.world, world),
      state.match
    )
    flushChange(state)
    const result = {
      moved: true,
      nodeIds: state.latest.nodeIds,
      edgeIds: state.latest.edgeIds
    } satisfies MarqueeEnd
    state.onEnd?.(result)
    return result
  }

  return {
    clear,
    start,
    move,
    finish,
    pan
  }
}

export const startSelectionMarqueePhase = (
  ctx: MarqueePhaseDeps,
  input: MarqueeStartInput,
  options?: {
    initialInput?: InteractionPointerInput
  }
): ActiveInteraction => {
  const controller = createMarqueeController(ctx)
  const state = createMarqueeState(input)

  controller.start(input)
  if (options?.initialInput) {
    controller.move(state, options.initialInput)
  }

  return {
    mode: 'marquee',
    pointerId: input.pointerId,
    chrome: false,
    autoPan: {
      frame: (pointer) => {
        controller.pan(state, pointer)
      }
    },
    move: (next) => {
      controller.move(state, next)
    },
    up: (next) => {
      controller.finish(state, next.world)
    },
    cleanup: () => {
      controller.clear()
    }
  }
}
