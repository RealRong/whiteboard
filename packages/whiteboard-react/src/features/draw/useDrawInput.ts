import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  useEffect,
  useRef,
  type RefObject
} from 'react'
import { isCanvasContentIgnoredTarget } from '../../canvas/target'
import { useInternalInstance } from '../../runtime/hooks'
import { leave } from '../../runtime/container'
import type { DrawPresetKey } from '../../runtime/tool'
import type { DrawStyle } from '../../runtime/draw'
import {
  DRAW_MIN_LENGTH_SCREEN,
  DRAW_SIMPLIFY_DISTANCE_SCREEN,
  simplifyDrawPoints,
  resolveDrawStroke
} from './stroke'

type ActiveStroke = {
  parentId?: NodeId
  preset: DrawPresetKey
  style: DrawStyle
  points: Point[]
  lastScreen: Point
  lengthScreen: number
}

const SAMPLE_DISTANCE_SCREEN = 1.5

const isPointInRect = (
  point: Point,
  rect: Rect
) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

const readCaptureTarget = (
  event: PointerEvent
): Element | null => (
  event.currentTarget instanceof Element
    ? event.currentTarget
    : event.target instanceof Element
      ? event.target
      : null
)

const hasMovedEnough = (
  left: Point,
  right: Point
) => {
  const dx = right.x - left.x
  const dy = right.y - left.y
  return (dx * dx) + (dy * dy) >= SAMPLE_DISTANCE_SCREEN * SAMPLE_DISTANCE_SCREEN
}

export const useDrawInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const activeRef = useRef<ActiveStroke | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const writePreview = (active: ActiveStroke) => {
      instance.internals.draw.preview.set({
        preset: active.preset,
        style: active.style,
        points: active.points
      })
    }

    const pushPoint = (
      active: ActiveStroke,
      event: PointerEvent,
      force = false
    ) => {
      const pointer = instance.viewport.pointer(event)
      const previous = active.points[active.points.length - 1]

      if (
        !force
        && !hasMovedEnough(active.lastScreen, pointer.screen)
      ) {
        return
      }

      if (
        previous
        && previous.x === pointer.world.x
        && previous.y === pointer.world.y
      ) {
        active.lastScreen = pointer.screen
        return
      }

      active.points = [
        ...active.points,
        pointer.world
      ]
      active.lengthScreen += Math.hypot(
        pointer.screen.x - active.lastScreen.x,
        pointer.screen.y - active.lastScreen.y
      )
      active.lastScreen = pointer.screen
      writePreview(active)
    }

    const commit = (active: ActiveStroke) => {
      if (
        active.points.length < 2
        || active.lengthScreen < DRAW_MIN_LENGTH_SCREEN
      ) {
        return
      }

      const zoom = Math.max(0.0001, instance.viewport.get().zoom)
      const points = simplifyDrawPoints({
        points: active.points,
        tolerance: DRAW_SIMPLIFY_DISTANCE_SCREEN / zoom
      })
      const stroke = resolveDrawStroke({
        points,
        width: active.style.width
      })
      if (!stroke) {
        return
      }

      const result = instance.commands.node.create({
        type: 'draw',
        parentId: active.parentId,
        position: stroke.position,
        size: stroke.size,
        data: {
          points: stroke.points,
          baseSize: stroke.size
        },
        style: {
          stroke: active.style.color,
          strokeWidth: active.style.width,
          opacity: active.style.opacity
        }
      })

      if (!result.ok) {
        return
      }

      instance.commands.selection.replace([result.data.nodeId])
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (instance.interaction.mode.get() !== 'idle') return

      const tool = instance.read.tool.get()
      if (tool.type !== 'draw') return
      if (!(event.target instanceof Element) || !container.contains(event.target)) return
      if (isCanvasContentIgnoredTarget(event.target)) return

      let activeContainer = instance.state.container.get()
      const pointer = instance.viewport.pointer(event)

      if (activeContainer.id) {
        const activeRect = instance.read.index.node.get(activeContainer.id)?.rect
        const insideActiveContainer = Boolean(
          activeRect && isPointInRect(pointer.world, activeRect)
        )

        if (!insideActiveContainer) {
          leave(instance)
          activeContainer = instance.state.container.get()
        }
      }

      const active: ActiveStroke = {
        parentId: activeContainer.id,
        preset: tool.preset,
        style: instance.read.draw.style(tool.preset),
        points: [pointer.world],
        lastScreen: pointer.screen,
        lengthScreen: 0
      }

      const session = instance.interaction.start({
        mode: 'draw',
        pointerId: event.pointerId,
        capture: readCaptureTarget(event),
        move: (moveEvent) => {
          const current = activeRef.current
          if (!current) {
            return
          }

          pushPoint(current, moveEvent)
        },
        up: (upEvent, session) => {
          const current = activeRef.current
          if (!current) {
            session.finish()
            return
          }

          pushPoint(current, upEvent, true)
          commit(current)
          session.finish()
        },
        cleanup: () => {
          activeRef.current = null
          instance.internals.draw.preview.set(null)
        }
      })

      if (!session) {
        return
      }

      activeRef.current = active
      instance.commands.edit.clear()
      instance.commands.selection.clear()
      writePreview(active)

      event.preventDefault()
      event.stopPropagation()
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      activeRef.current = null
      instance.internals.draw.preview.set(null)
    }
  }, [containerRef, instance])
}
