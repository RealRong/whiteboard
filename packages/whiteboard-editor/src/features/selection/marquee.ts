import {
  rectFromPoints
} from '@whiteboard/core/geometry'
import {
  createDerivedStore,
  createValueStore,
  type ReadStore
} from '@whiteboard/engine'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import {
  createInteractionSessionSlot,
  GestureTuning
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

export type MarqueeSession = {
  rect: ReadStore<Rect | undefined>
  match: ReadStore<MarqueeMatch | undefined>
  start: (input: MarqueeStartInput) => boolean
  cancel: () => void
}

type MarqueeSessionDeps = Pick<
  EditorRuntime,
  'interaction' | 'read' | 'viewport'
>

const toItemsKey = (
  items: MarqueeItems
) => [
  [...items.nodeIds].sort().join('|'),
  [...items.edgeIds].sort().join('|')
].join('::')

const projectWorldRect = (
  editor: MarqueeSessionDeps,
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

export const createMarqueeSession = (
  editor: MarqueeSessionDeps
): MarqueeSession => {
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
  const interaction = createInteractionSessionSlot<ActiveMarquee>({
    interaction: editor.interaction,
    cleanup: () => {
      flushTask.cancel()
      activeMatch.set(undefined)
      worldRect.set(undefined)
    }
  })

  const readActive = () => interaction.getActive()

  const writeActive = (
    next: ActiveMarquee | null
  ) => {
    interaction.setActive(next)
  }

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

  const flushChange = () => {
    const active = readActive()
    if (!active || active.latest === undefined) {
      return
    }

    const nextKey = toItemsKey(active.latest)
    if (nextKey === active.emittedKey) {
      return
    }

    active.emittedKey = nextKey
    active.onChange?.(active.latest)
  }

  const flushTask = createRafTask(flushChange)

  const update = (
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = readActive()
    if (!active) {
      return false
    }

    const current = editor.viewport.pointer(input)
    const dx = Math.abs(current.screen.x - active.start.screen.x)
    const dy = Math.abs(current.screen.y - active.start.screen.y)

    if (
      active.latest === undefined
      && dx < GestureTuning.dragMinDistance
      && dy < GestureTuning.dragMinDistance
    ) {
      return false
    }

    active.latest = readMatchedItems(
      rectFromPoints(active.start.world, current.world),
      active.match
    )
    worldRect.set(rectFromPoints(active.start.world, current.world))
    flushTask.schedule()
    return true
  }

  return {
    rect,
    match: activeMatch,
    start: ({
      pointerId,
      capture,
      start,
      match,
      onChange,
      onEnd
    }) => {
      if (interaction.hasActive() || editor.interaction.busy.get()) {
        return false
      }

      const nextSession = interaction.start({
        mode: 'marquee',
        pointerId,
        capture,
        pan: {
          frame: (pointer) => {
            const active = readActive()
            if (!active || active.latest === undefined) {
              return
            }

            update(pointer)
          }
        },
        move: (moveEvent, interactionSession) => {
          if (update(moveEvent)) {
            interactionSession.pan(moveEvent)
          }
        },
        up: (upEvent, interactionSession) => {
          const active = readActive()
          if (!active) {
            return
          }

          if (active.latest !== undefined) {
            const current = editor.viewport.pointer(upEvent)
            active.latest = readMatchedItems(
              rectFromPoints(active.start.world, current.world),
              active.match
            )
            flushChange()
            active.onEnd?.({
              moved: true,
              nodeIds: active.latest.nodeIds,
              edgeIds: active.latest.edgeIds
            })
          } else {
            active.onEnd?.({
              moved: false,
              nodeIds: [],
              edgeIds: []
            })
          }

          interactionSession.finish()
        }
      })
      if (!nextSession) {
        return false
      }

      writeActive({
        pointerId,
        start,
        match,
        emittedKey: '',
        onChange,
        onEnd
      })
      activeMatch.set(match)
      worldRect.set(undefined)
      return true
    },
    cancel: () => {
      interaction.cancel()
    }
  }
}
