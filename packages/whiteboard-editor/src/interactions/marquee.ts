import { rectFromPoints } from '@whiteboard/core/geometry'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import { createRafTask } from '@whiteboard/engine'
import { GestureTuning } from '../runtime/interaction'
import type { PointerDown } from '../runtime/input/pointer'
import type { FeatureRuntime } from '../runtime/editor/createEditor'
import type { ViewportPointer } from '../runtime/viewport'
import type { MarqueeMatch } from '../runtime/feedback/marquee'
import type {
  InteractionRegistration,
  InteractionPointerInput,
  RuntimeSession
} from '../runtime/interaction'

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

export type ActiveMarquee = {
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

type MarqueeRuntimeDeps = Pick<
  FeatureRuntime,
  'query' | 'viewport' | 'output'
>

const toItemsKey = (
  items: MarqueeItems
) => [
  [...items.nodeIds].sort().join('|'),
  [...items.edgeIds].sort().join('|')
].join('::')

const readMatchedItems = (
  ctx: MarqueeRuntimeDeps,
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

const hasStartedMarquee = (
  state: ActiveMarquee,
  current: ViewportPointer
) => {
  const dx = Math.abs(current.screen.x - state.start.screen.x)
  const dy = Math.abs(current.screen.y - state.start.screen.y)

  return (
    state.latest !== undefined
    || dx >= GestureTuning.dragMinDistance
    || dy >= GestureTuning.dragMinDistance
  )
}

export const createMarqueeState = (
  input: MarqueeStartInput
): ActiveMarquee => ({
  pointerId: input.pointerId,
  start: input.start,
  match: input.match,
  emittedKey: '',
  onChange: input.onChange,
  onEnd: input.onEnd
})

export const createMarqueeRuntime = (
  ctx: MarqueeRuntimeDeps
) => {
  let pendingFlush: ActiveMarquee | null = null

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
    if (!pendingFlush) {
      return
    }

    flushChange(pendingFlush)
  })

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
    pointer: {
      clientX: number
      clientY: number
    }
  ) => {
    const current = ctx.viewport.pointer(pointer)
    if (!hasStartedMarquee(state, current)) {
      return false
    }

    const worldRect = rectFromPoints(state.start.world, current.world)
    state.latest = readMatchedItems(ctx, worldRect, state.match)
    ctx.output.marquee.set({
      worldRect,
      match: state.match
    })
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
    ctx.output.marquee.clear()
  }

  const move = (
    state: ActiveMarquee,
    session: RuntimeSession,
    input: InteractionPointerInput
  ) => {
    if (!update(state, {
      clientX: input.client.x,
      clientY: input.client.y
    })) {
      return
    }

    session.pan({
      clientX: input.client.x,
      clientY: input.client.y
    })
  }

  const up = (
    state: ActiveMarquee,
    session: RuntimeSession,
    input: InteractionPointerInput
  ) => {
    if (state.latest === undefined) {
      state.onEnd?.({
        moved: false,
        nodeIds: [],
        edgeIds: []
      })
      session.finish()
      return
    }

    state.latest = readMatchedItems(
      ctx,
      rectFromPoints(state.start.world, input.world),
      state.match
    )
    flushChange(state)
    state.onEnd?.({
      moved: true,
      nodeIds: state.latest.nodeIds,
      edgeIds: state.latest.edgeIds
    })
    session.finish()
  }

  return {
    clear,
    start,
    move,
    up,
    pan
  }
}
