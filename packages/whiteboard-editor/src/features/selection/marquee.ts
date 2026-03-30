import { rectFromPoints } from '@whiteboard/core/geometry'
import {
  createDerivedStore,
  createValueStore,
  type ReadStore
} from '@whiteboard/engine'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import {
  GestureTuning,
  type InteractionPointerInput,
  type InteractionRegistration
} from '../../runtime/interaction'
import type { EditorRuntime } from '../../types/internal/editor'
import { createRafTask } from '../../runtime/utils/rafTask'
import type { ViewportPointer } from '../../runtime/viewport'

export type MarqueeMatch = 'touch' | 'contain'

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
  capture: Element
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
  rect: ReadStore<Rect | undefined>
  match: ReadStore<MarqueeMatch | undefined>
  interaction: InteractionRegistration<ActiveMarquee, MarqueeStartInput>
  createState: (input: MarqueeStartInput) => ActiveMarquee
  clear: () => void
}

type MarqueeInteractionDeps = Pick<
  EditorRuntime,
  'read' | 'viewport'
>

const toItemsKey = (
  items: MarqueeItems
) => [
  [...items.nodeIds].sort().join('|'),
  [...items.edgeIds].sort().join('|')
].join('::')

const projectWorldRect = (
  editor: MarqueeInteractionDeps,
  worldRect: Rect
): Rect => {
  const topLeft = editor.viewport.worldToScreen({
    x: worldRect.x,
    y: worldRect.y
  })
  const bottomRight = editor.viewport.worldToScreen({
    x: worldRect.x + worldRect.width,
    y: worldRect.y + worldRect.height
  })

  return rectFromPoints(topLeft, bottomRight)
}

export const createMarqueeInteraction = (
  editor: MarqueeInteractionDeps
): MarqueeInteraction => {
  const worldRect = createValueStore<Rect | undefined>(undefined)
  const activeMatch = createValueStore<MarqueeMatch | undefined>(undefined)
  const rect = createDerivedStore<Rect | undefined>({
    get: (read) => {
      const nextWorldRect = read(worldRect)
      read(editor.viewport)
      if (!nextWorldRect) {
        return undefined
      }
      return projectWorldRect(editor, nextWorldRect)
    },
    isEqual: (left, right) => (
      left === right
      || (
        left?.x === right?.x
        && left?.y === right?.y
        && left?.width === right?.width
        && left?.height === right?.height
      )
    )
  })

  const readMatchedItems = (
    queryRect: Rect,
    match: MarqueeMatch
  ): MarqueeItems => {
    const nodeIds = editor.read.node.idsInRect(queryRect, {
      match
    })
    const edgeIds = editor.read.edge.idsInRect(queryRect, {
      match
    })

    return {
      nodeIds,
      edgeIds
    }
  }

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
    activeMatch.set(undefined)
    worldRect.set(undefined)
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
    const current = editor.viewport.pointer(input)
    const dx = Math.abs(current.screen.x - state.start.screen.x)
    const dy = Math.abs(current.screen.y - state.start.screen.y)

    if (
      state.latest === undefined
      && dx < GestureTuning.dragMinDistance
      && dy < GestureTuning.dragMinDistance
    ) {
      return false
    }

    state.latest = readMatchedItems(
      rectFromPoints(state.start.world, current.world),
      state.match
    )
    worldRect.set(rectFromPoints(state.start.world, current.world))
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
      activeMatch.set(input.match)
      worldRect.set(undefined)
    },
    move: ({ state, session }, input: InteractionPointerInput) => {
      if (update(state, input.raw)) {
        session.pan(input.raw)
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
    rect,
    match: activeMatch,
    interaction,
    createState,
    clear
  }
}
