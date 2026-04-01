import {
  createMarqueeItemsKey,
  createMarqueeRect,
  hasMarqueeStarted,
  type SelectionDragAction,
  type SelectionTarget
} from '@whiteboard/core/selection'
import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core/types'
import { createRafTask } from '@whiteboard/engine'
import { GestureTuning, type InteractionSession } from '../../runtime/interaction'
import type { PointerDownInput } from '../../types/input'
import type {
  SelectionInteractionCtx,
  SessionPointer
} from './context'
import { readViewport } from './context'

type MarqueeItems = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

type MarqueeEnd = {
  moved: boolean
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

type MarqueeStartInput = {
  pointerId: number
  start: {
    screen: Point
    world: Point
  }
  match: import('../../runtime/overlay').MarqueeMatch
  onStart?: () => void
  onChange?: (items: MarqueeItems) => void
  onEnd?: (result: MarqueeEnd) => void
}

type MarqueeState = {
  pointerId: number
  start: {
    screen: Point
    world: Point
  }
  match: import('../../runtime/overlay').MarqueeMatch
  latest?: MarqueeItems
  emittedKey: string
  onChange?: (items: MarqueeItems) => void
  onEnd?: (result: MarqueeEnd) => void
}

const buildSelectionWriter = (
  ctx: SelectionInteractionCtx,
  base: SelectionTarget,
  mode: SelectionMode
) => {
  return (matched: SelectionTarget) => {
    ctx.commands.selection.replace({
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
  }
}

const readMatchedMarqueeItems = (
  ctx: SelectionInteractionCtx,
  queryRect: Rect,
  match: import('../../runtime/overlay').MarqueeMatch
): MarqueeItems => ({
  nodeIds: ctx.read.node.idsInRect(queryRect, {
    match
  }),
  edgeIds: ctx.read.edge.idsInRect(queryRect, {
    match
  })
})

export const createSelectionMarqueeInput = (
  ctx: SelectionInteractionCtx,
  start: PointerDownInput,
  action: Extract<SelectionDragAction, { kind: 'marquee' }>,
  extra?: {
    onStart?: () => void
  }
): MarqueeStartInput => {
  const applyMatched = buildSelectionWriter(ctx, action.base, action.mode)

  return {
    pointerId: start.pointerId,
    start: {
      screen: start.screen,
      world: start.world
    },
    match: action.match,
    onStart: extra?.onStart,
    onChange: applyMatched,
    onEnd: (result) => {
      if (!result.moved) {
        return
      }

      applyMatched({
        nodeIds: result.nodeIds,
        edgeIds: result.edgeIds
      })
    }
  }
}

const createMarqueeState = (
  input: MarqueeStartInput
): MarqueeState => ({
  pointerId: input.pointerId,
  start: input.start,
  match: input.match,
  emittedKey: '',
  onChange: input.onChange,
  onEnd: input.onEnd
})

const createMarqueeController = (
  ctx: SelectionInteractionCtx
) => {
  let pendingFlush: MarqueeState | null = null

  const flushChange = (
    state: MarqueeState
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
    state: MarqueeState
  ) => {
    pendingFlush = state
    flushTask.schedule()
  }

  const update = (
    state: MarqueeState,
    pointer: {
      clientX: number
      clientY: number
    }
  ) => {
    const current = readViewport(ctx).pointer(pointer)
    if (!hasMarqueeStarted({
      startScreen: state.start.screen,
      currentScreen: current.screen,
      minDistance: GestureTuning.dragMinDistance,
      active: state.latest !== undefined
    })) {
      return false
    }

    const worldRect = createMarqueeRect(state.start.world, current.world)
    state.latest = readMatchedMarqueeItems(ctx, worldRect, state.match)
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
    state: MarqueeState,
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
    state: MarqueeState,
    input: SessionPointer
  ) => update(state, {
      clientX: input.client.x,
      clientY: input.client.y
    })

  const finish = (
    state: MarqueeState,
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

    state.latest = readMatchedMarqueeItems(
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

export const createMarqueeInteraction = (
  ctx: SelectionInteractionCtx,
  input: MarqueeStartInput,
  options?: {
    initialInput?: SessionPointer
  }
): InteractionSession => {
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
