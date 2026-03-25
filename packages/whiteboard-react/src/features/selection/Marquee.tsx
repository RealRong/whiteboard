import {
  rectFromPoints
} from '@whiteboard/core/geometry'
import {
  createDerivedStore,
  createValueStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import { useStoreValue } from '../../runtime/hooks'
import { GestureTuning } from '../../runtime/interaction'
import type { InternalInstance } from '../../runtime/instance'
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
  scope?: ReadonlySet<NodeId>
  edgeFilter?: (edgeId: EdgeId) => boolean
  match: MarqueeMatch
  onChange?: (items: MarqueeItems) => void
  onEnd?: (result: MarqueeEnd) => void
}

type ActiveMarquee = {
  pointerId: number
  start: ViewportPointer
  scope?: ReadonlySet<NodeId>
  edgeFilter?: (edgeId: EdgeId) => boolean
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

const toItemsKey = (
  items: MarqueeItems
) => [
  [...items.nodeIds].sort().join('|'),
  [...items.edgeIds].sort().join('|')
].join('::')

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

  const readMatchedItems = (
    queryRect: Rect,
    scope: ReadonlySet<NodeId> | undefined,
    edgeFilter: ((edgeId: EdgeId) => boolean) | undefined,
    match: MarqueeMatch
  ): MarqueeItems => {
    const matchedNodeIds = instance.read.node.idsInRect(queryRect, {
      match
    })
    const nodeIds = scope
      ? matchedNodeIds.filter((nodeId) => scope.has(nodeId))
      : matchedNodeIds
    const edgeIds = instance.read.edge.idsInRect(queryRect, {
      match
    }).filter((edgeId) => (
      edgeFilter
        ? edgeFilter(edgeId)
        : true
    ))

    return {
      nodeIds,
      edgeIds
    }
  }

  const flushChange = () => {
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
      active.latest === undefined
      && dx < GestureTuning.dragMinDistance
      && dy < GestureTuning.dragMinDistance
    ) {
      return false
    }

    active.latest = readMatchedItems(
      rectFromPoints(active.start.world, current.world),
      active.scope,
      active.edgeFilter,
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
      edgeFilter,
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
            if (!active || active.latest === undefined) {
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

          if (active.latest !== undefined) {
            const current = instance.viewport.pointer(upEvent)
            active.latest = readMatchedItems(
              rectFromPoints(active.start.world, current.world),
              active.scope,
              active.edgeFilter,
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

      active = {
        pointerId,
        start,
        scope,
        edgeFilter,
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
