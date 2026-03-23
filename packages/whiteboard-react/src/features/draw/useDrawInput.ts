import { isPointInRect } from '@whiteboard/core/geometry'
import {
  compactDrawPoints,
  resolveDrawStroke
} from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import { leave } from '../../runtime/container'
import { useInternalInstance } from '../../runtime/hooks'
import type { DrawPresetKey } from '../../runtime/tool'
import type { DrawPreview, DrawStyle } from './state'

type ActiveStroke = {
  parentId?: NodeId
  preset: DrawPresetKey
  style: DrawStyle
  points: Point[]
  lastScreen: Point
  lengthScreen: number
}

const SAMPLE_DISTANCE_SCREEN = 1.5
const DRAW_MIN_LENGTH_SCREEN = 4
const DRAW_SIMPLIFY_DISTANCE_SCREEN = 1.5
const DRAW_POINT_BUDGET_MIN = 24
const DRAW_POINT_BUDGET_MAX = 320
const DRAW_POINT_BUDGET_STEP_SCREEN = 6

const resolveDrawPointBudget = (
  lengthScreen: number
) => {
  if (!Number.isFinite(lengthScreen) || lengthScreen <= 0) {
    return DRAW_POINT_BUDGET_MIN
  }

  return Math.min(
    DRAW_POINT_BUDGET_MAX,
    Math.max(
      DRAW_POINT_BUDGET_MIN,
      Math.ceil(lengthScreen / DRAW_POINT_BUDGET_STEP_SCREEN)
    )
  )
}

const readSampleEvents = (
  event: PointerEvent
) => {
  if (typeof event.getCoalescedEvents !== 'function') {
    return [event]
  }

  const samples = event.getCoalescedEvents()
  return samples.length ? samples : [event]
}

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

export const useDrawInput = () => {
  const instance = useInternalInstance()
  const activeRef = useRef<ActiveStroke | null>(null)
  const frameRef = useRef<number | null>(null)
  const [preview, setPreview] = useState<DrawPreview | null>(null)

  const flushPreview = useCallback((active: ActiveStroke | null) => {
    frameRef.current = null
    if (!active) {
      setPreview(null)
      return
    }

    setPreview({
      preset: active.preset,
      style: active.style,
      points: active.points
    })
  }, [])

  const schedulePreview = useCallback(() => {
    if (frameRef.current !== null) {
      return
    }

    frameRef.current = window.requestAnimationFrame(() => {
      flushPreview(activeRef.current)
    })
  }, [flushPreview])

  const clearPreview = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    setPreview(null)
  }, [])

  const pushPoint = useCallback((
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

    active.points.push(pointer.world)
    active.lengthScreen += Math.hypot(
      pointer.screen.x - active.lastScreen.x,
      pointer.screen.y - active.lastScreen.y
    )
    active.lastScreen = pointer.screen
    return true
  }, [instance])

  const pushEventPoints = useCallback((
    active: ActiveStroke,
    event: PointerEvent,
    force = false
  ) => {
    let changed = false
    const samples = readSampleEvents(event)

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index]
      changed = pushPoint(
        active,
        sample,
        force && index === samples.length - 1
      ) || changed
    }

    if (changed) {
      schedulePreview()
    }
  }, [pushPoint, schedulePreview])

  const commit = useCallback((active: ActiveStroke) => {
    if (
      active.points.length < 2
      || active.lengthScreen < DRAW_MIN_LENGTH_SCREEN
    ) {
      return
    }

    const zoom = Math.max(0.0001, instance.viewport.get().zoom)
    const points = compactDrawPoints({
      points: active.points,
      tolerance: DRAW_SIMPLIFY_DISTANCE_SCREEN / zoom,
      budget: resolveDrawPointBudget(active.lengthScreen)
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
  }, [instance])

  useEffect(() => () => {
    activeRef.current = null
    clearPreview()
  }, [clearPreview])

  const handleCanvasPointerDown = useCallback((
    container: HTMLDivElement,
    event: PointerEvent
  ) => {
    if (event.defaultPrevented) return false
    if (event.button !== 0) return false
    if (instance.interaction.mode.get() !== 'idle') return false

    const tool = instance.read.tool.get()
    if (tool.type !== 'draw') return false

    const input = instance.read.pick.from(event, container)
    if (
      input.editable
      || input.ignoreInput
      || input.ignoreSelection
      || input.pick.kind !== 'background'
    ) {
      return false
    }

    let activeContainer = instance.state.container.get()
    if (activeContainer.id) {
      const activeRect = instance.read.index.node.get(activeContainer.id)?.rect
      const insideActiveContainer = Boolean(
        activeRect && isPointInRect(input.point.world, activeRect)
      )

      if (!insideActiveContainer) {
        leave(instance)
        activeContainer = instance.state.container.get()
      }
    }

    const active: ActiveStroke = {
      parentId: activeContainer.id,
      preset: tool.preset,
      style: instance.state.draw.get()[tool.preset],
      points: [input.point.world],
      lastScreen: input.point.screen,
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

        pushEventPoints(current, moveEvent)
      },
      up: (upEvent, currentSession) => {
        const current = activeRef.current
        if (!current) {
          currentSession.finish()
          return
        }

        pushEventPoints(current, upEvent, true)
        commit(current)
        currentSession.finish()
      },
      cleanup: () => {
        activeRef.current = null
        clearPreview()
      }
    })

    if (!session) {
      return false
    }

    activeRef.current = active
    instance.commands.edit.clear()
    instance.commands.selection.clear()
    flushPreview(active)

    event.preventDefault()
    event.stopPropagation()
    return true
  }, [clearPreview, commit, flushPreview, instance, pushEventPoints])

  return {
    preview,
    handleCanvasPointerDown
  }
}
