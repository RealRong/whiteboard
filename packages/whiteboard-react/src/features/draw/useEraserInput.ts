import { getSegmentBounds } from '@whiteboard/core/geometry'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  useCallback,
  useEffect,
  useRef
} from 'react'
import { useInternalInstance } from '../../runtime/hooks'
import {
  readPointerSamples,
  type EraserDown
} from '../../runtime/input/pointer'

const ERASER_HIT_EPSILON_SCREEN = 2
const ZOOM_EPSILON = 0.0001

type ActiveErase = {
  ids: Set<NodeId>
  lastWorld: Point
}

export const useEraserInput = () => {
  const instance = useInternalInstance()
  const activeRef = useRef<ActiveErase | null>(null)

  const syncHidden = useCallback((active: ActiveErase | null) => {
    if (!active) {
      instance.internals.node.hidden.clear()
      return
    }

    instance.internals.node.hidden.write([...active.ids])
  }, [instance])

  const collectRect = useCallback((active: ActiveErase, rect: Rect) => {
    const nodeIds = instance.read.node.idsInRect(rect, {
      match: 'touch'
    })
    let changed = false

    nodeIds.forEach((nodeId) => {
      const item = instance.read.node.item.get(nodeId)
      if (!item || item.node.type !== 'draw' || active.ids.has(nodeId)) {
        return
      }

      active.ids.add(nodeId)
      changed = true
    })

    if (changed) {
      syncHidden(active)
    }
  }, [instance, syncHidden])

  const collectPoint = useCallback((active: ActiveErase, world: Point) => {
    const halfWorld = ERASER_HIT_EPSILON_SCREEN / Math.max(instance.viewport.get().zoom, ZOOM_EPSILON)
    collectRect(active, getSegmentBounds(active.lastWorld, world, halfWorld))
    active.lastWorld = world
  }, [collectRect, instance])

  const collectEvent = useCallback((active: ActiveErase, event: PointerEvent) => {
    const samples = readPointerSamples(event)

    for (let index = 0; index < samples.length; index += 1) {
      const pointer = instance.viewport.pointer(samples[index]!)
      collectPoint(active, pointer.world)
    }
  }, [collectPoint, instance])

  const clear = useCallback(() => {
    activeRef.current = null
    instance.internals.node.hidden.clear()
  }, [instance])

  useEffect(() => clear, [clear])

  const down = useCallback((
    input: EraserDown
  ) => {
    const active: ActiveErase = {
      ids: new Set<NodeId>(),
      lastWorld: input.point.world
    }
    collectPoint(active, input.point.world)

    const session = instance.interaction.start({
      mode: 'draw',
      pointerId: input.event.pointerId,
      capture: input.capture,
      move: (moveEvent) => {
        const current = activeRef.current
        if (!current) {
          return
        }

        collectEvent(current, moveEvent)
      },
      up: (upEvent, currentSession) => {
        const current = activeRef.current
        if (!current) {
          currentSession.finish()
          return
        }

        collectEvent(current, upEvent)
        if (current.ids.size > 0) {
          instance.commands.node.delete([...current.ids])
        }
        currentSession.finish()
      },
      cleanup: clear
    })

    if (!session) {
      clear()
      return false
    }

    activeRef.current = active
    syncHidden(active)
    input.event.preventDefault()
    input.event.stopPropagation()
    return true
  }, [clear, collectEvent, collectPoint, instance, syncHidden])

  return {
    down
  }
}
