import {
  rectFromPoints
} from '@whiteboard/core/geometry'
import {
  createDerivedStore,
  createValueStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { useStoreValue } from '../runtime/hooks'
import { GestureTuning } from '../runtime/interaction'
import type { InternalInstance } from '../runtime/instance'
import { createRafTask } from '../runtime/utils/rafTask'
import type { ViewportPointer } from '../runtime/viewport'

export type MarqueeMatch = 'touch' | 'contain'

export type MarqueeEnd = {
  moved: boolean
  nodeIds: readonly NodeId[]
}

export type MarqueeStartInput = {
  pointerId: number
  capture: Element
  start: ViewportPointer
  scope?: ReadonlySet<NodeId>
  match: MarqueeMatch
  onChange?: (nodeIds: readonly NodeId[]) => void
  onEnd?: (result: MarqueeEnd) => void
}

type ActiveMarquee = {
  pointerId: number
  start: ViewportPointer
  scope?: ReadonlySet<NodeId>
  match: MarqueeMatch
  latestNodeIds?: NodeId[]
  emittedKey: string
  onChange?: (nodeIds: readonly NodeId[]) => void
  onEnd?: (result: MarqueeEnd) => void
}

export type MarqueeSession = {
  rect: ReadStore<Rect | undefined>
  match: ReadStore<MarqueeMatch | undefined>
  start: (input: MarqueeStartInput) => boolean
  cancel: () => void
}

const toNodeIdKey = (nodeIds: Iterable<NodeId>) => [...nodeIds].sort().join('|')

const projectWorldRect = (
  instance: InternalInstance,
  worldRect: Rect
): Rect => {
  const topLeft = instance.viewport.worldToScreen({
    x: worldRect.x,
    y: worldRect.y
  })
  const bottomRight = instance.viewport.worldToScreen({
    x: worldRect.x + worldRect.width,
    y: worldRect.y + worldRect.height
  })

  return rectFromPoints(topLeft, bottomRight)
}

export const createMarqueeSession = (
  instance: InternalInstance
): MarqueeSession => {
  const worldRect = createValueStore<Rect | undefined>(undefined)
  const activeMatch = createValueStore<MarqueeMatch | undefined>(undefined)
  const rect = createDerivedStore<Rect | undefined>({
    get: (read) => {
      const nextWorldRect = read(worldRect)
      read(instance.viewport)
      if (!nextWorldRect) {
        return undefined
      }
      return projectWorldRect(instance, nextWorldRect)
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
  let active: ActiveMarquee | null = null
  let session: ReturnType<typeof instance.interaction.start> = null

  const readMatchedNodeIds = (
    queryRect: Rect,
    scope: ReadonlySet<NodeId> | undefined,
    match: MarqueeMatch
  ) => {
    const matchedNodeIds = instance.read.node.idsInRect(queryRect, {
      match
    })
    return scope
      ? matchedNodeIds.filter((nodeId) => scope.has(nodeId))
      : matchedNodeIds
  }

  const flushChange = () => {
    if (!active || active.latestNodeIds === undefined) {
      return
    }

    const nextKey = toNodeIdKey(active.latestNodeIds)
    if (nextKey === active.emittedKey) {
      return
    }

    active.emittedKey = nextKey
    active.onChange?.(active.latestNodeIds)
  }

  const flushTask = createRafTask(flushChange)

  const clear = () => {
    active = null
    session = null
    flushTask.cancel()
    activeMatch.set(undefined)
    worldRect.set(undefined)
  }

  const update = (
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    if (!active) {
      return false
    }

    const current = instance.viewport.pointer(input)
    const dx = Math.abs(current.screen.x - active.start.screen.x)
    const dy = Math.abs(current.screen.y - active.start.screen.y)

    if (
      active.latestNodeIds === undefined
      && dx < GestureTuning.dragMinDistance
      && dy < GestureTuning.dragMinDistance
    ) {
      return false
    }

    active.latestNodeIds = readMatchedNodeIds(
      rectFromPoints(active.start.world, current.world),
      active.scope,
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
      scope,
      match,
      onChange,
      onEnd
    }) => {
      if (active || instance.interaction.mode.get() !== 'idle') {
        return false
      }

      const nextSession = instance.interaction.start({
        mode: 'marquee',
        pointerId,
        capture,
        pan: {
          frame: (pointer) => {
            if (!active || active.latestNodeIds === undefined) {
              return
            }

            update(pointer)
          }
        },
        cleanup: clear,
        move: (moveEvent, interactionSession) => {
          if (update(moveEvent)) {
            interactionSession.pan(moveEvent)
          }
        },
        up: (upEvent, interactionSession) => {
          if (!active) {
            return
          }

          if (active.latestNodeIds !== undefined) {
            const current = instance.viewport.pointer(upEvent)
            active.latestNodeIds = readMatchedNodeIds(
              rectFromPoints(active.start.world, current.world),
              active.scope,
              active.match
            )
            flushChange()
            active.onEnd?.({
              moved: true,
              nodeIds: active.latestNodeIds
            })
          } else {
            active.onEnd?.({
              moved: false,
              nodeIds: []
            })
          }

          interactionSession.finish()
        }
      })
      if (!nextSession) {
        return false
      }

      active = {
        pointerId,
        start,
        scope,
        match,
        emittedKey: '',
        onChange,
        onEnd
      }
      session = nextSession
      activeMatch.set(match)
      worldRect.set(undefined)
      return true
    },
    cancel: () => {
      if (session) {
        session.cancel()
        return
      }
      clear()
    }
  }
}

export const Marquee = ({
  marquee
}: {
  marquee: MarqueeSession
}) => {
  const rect = useStoreValue(marquee.rect)
  const match = useStoreValue(marquee.match)

  if (!rect || !match) return null

  return (
    <div
      className="wb-marquee-layer"
      data-match={match}
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height
      }}
    />
  )
}
