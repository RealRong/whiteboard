import { isPointInRect } from '@whiteboard/core/geometry'
import {
  isContainerNode,
  resolveDrawPoints,
  resolveDrawStroke
} from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import type { CanvasDown } from '../../runtime/input/down'
import { useInternalInstance } from '../../runtime/hooks'
import {
  isDrawBrushKind,
  type DrawBrushKind
} from '../../runtime/tool'
import {
  readDrawStyle,
  type DrawPreview,
  type ResolvedDrawStyle
} from './state'

type ActiveStroke = {
  containerId?: NodeId
  kind: DrawBrushKind
  style: ResolvedDrawStyle
  points: Point[]
  lastScreen: Point
  lengthScreen: number
}

const DRAW_MIN_LENGTH_SCREEN = 4
const SAMPLE_DISTANCE_SCREEN = 1

const readSampleEvents = (
  event: PointerEvent
) => {
  if (typeof event.getCoalescedEvents !== 'function') {
    return [event]
  }

  const samples = event.getCoalescedEvents()
  return samples.length ? samples : [event]
}

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

  const resolvePoints = useCallback((
    points: readonly Point[]
  ) => {
    const zoom = instance.viewport.get().zoom
    return resolveDrawPoints({
      points,
      zoom
    })
  }, [instance])

  const flushPreview = useCallback((active: ActiveStroke | null) => {
    frameRef.current = null
    if (!active) {
      setPreview(null)
      return
    }

    setPreview({
      kind: active.kind,
      style: active.style,
      points: resolvePoints(active.points)
    })
  }, [resolvePoints])

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

    const points = resolvePoints(active.points)
    const stroke = resolveDrawStroke({
      points,
      width: active.style.width
    })
    if (!stroke) {
      return
    }

    const result = instance.commands.node.create({
      type: 'draw',
      containerId: active.containerId,
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
  }, [instance, resolvePoints])

  useEffect(() => () => {
    activeRef.current = null
    clearPreview()
  }, [clearPreview])

  const down = useCallback((
    input: CanvasDown
  ) => {
    const { event } = input

    if (event.defaultPrevented) return false
    if (event.button !== 0) return false
    if (input.mode !== 'idle') return false

    if (input.tool.type !== 'draw' || !isDrawBrushKind(input.tool.kind)) return false
    if (
      input.editable
      || input.ignoreInput
      || input.ignoreSelection
    ) {
      return false
    }

    let activeFrame = instance.state.frame.get()
    if (activeFrame.id) {
      const activeRect = instance.read.index.node.get(activeFrame.id)?.rect
      const insideActiveFrame = Boolean(
        activeRect && isPointInRect(input.point.world, activeRect)
      )

      if (!insideActiveFrame) {
        instance.commands.frame.exit()
        activeFrame = instance.state.frame.get()
      }
    }

    const frameTargetId =
      input.pick.kind === 'node'
      && input.pick.part === 'container'
      && isContainerNode(instance.read.node.item.get(input.pick.id)?.node ?? { type: '' })
        ? input.pick.id
        : undefined
    const canDraw =
      input.pick.kind === 'background'
      || frameTargetId !== undefined
    if (!canDraw) {
      return false
    }

    const active: ActiveStroke = {
      containerId: activeFrame.id ?? frameTargetId,
      kind: input.tool.kind,
      style: readDrawStyle(instance.state.draw.get(), input.tool.kind),
      points: [input.point.world],
      lastScreen: input.point.screen,
      lengthScreen: 0
    }

    const session = instance.interaction.start({
      mode: 'draw',
      pointerId: event.pointerId,
      capture: input.capture,
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
    flushPreview(active)

    event.preventDefault()
    event.stopPropagation()
    return true
  }, [clearPreview, commit, flushPreview, instance, pushEventPoints])

  return {
    preview,
    down
  }
}
