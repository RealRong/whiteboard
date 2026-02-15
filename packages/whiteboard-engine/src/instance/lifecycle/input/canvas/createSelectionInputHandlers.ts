import type { Point, Rect } from '@whiteboard/core'
import type { WhiteboardInstance } from '@engine-types/instance'
import type { SelectionMode } from '@engine-types/state'
import { rectFromPoints } from '../../../../infra/geometry'
import { getSelectionModeFromEvent } from '../../../../node/utils/selection'

type Options = {
  instance: WhiteboardInstance
  enabled: boolean
  minDragDistance: number
}

export const createSelectionInputHandlers = ({
  instance,
  enabled,
  minDragDistance
}: Options) => {
  let startPoint: Point | null = null
  let mode: SelectionMode = 'replace'
  let rafId: number | null = null
  let isSelecting = false
  let latestRectWorld: Rect | null = null
  let activePointerId: number | null = null
  const activeWatchers = new Set<() => void>()

  const emitActiveChange = () => {
    activeWatchers.forEach((listener) => listener())
  }

  const cancelPendingRaf = () => {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId)
      rafId = null
    }
    latestRectWorld = null
  }

  const reset = () => {
    const wasActive = startPoint !== null
    startPoint = null
    cancelPendingRaf()
    isSelecting = false
    activePointerId = null
    instance.commands.selection.endBox()
    if (wasActive) {
      emitActiveChange()
    }
  }

  const getScreenPoint = (event: PointerEvent) => {
    const element = instance.runtime.containerRef.current
    if (!element) return null
    return instance.runtime.viewport.clientToScreen(event.clientX, event.clientY)
  }

  const isActivePointer = (event: PointerEvent) => {
    if (activePointerId === null) return true
    return activePointerId === event.pointerId
  }

  const hitTest = (rectWorld: Rect, nextMode: SelectionMode) => {
    const matched = instance.query.getNodeIdsInRect(rectWorld)
    if (!matched.length) return
    instance.commands.selection.select(matched, nextMode)
  }

  const updateBox = (pointScreen: Point) => {
    const start = startPoint
    if (!start) return

    const rectScreen = rectFromPoints(start, pointScreen)
    const startWorld = instance.runtime.viewport.screenToWorld({
      x: rectScreen.x,
      y: rectScreen.y
    })
    const endWorld = instance.runtime.viewport.screenToWorld({
      x: rectScreen.x + rectScreen.width,
      y: rectScreen.y + rectScreen.height
    })
    const rectWorld = rectFromPoints(startWorld, endWorld)

    isSelecting = true
    latestRectWorld = rectWorld
    instance.commands.selection.updateBox(rectScreen, rectWorld)

    if (rafId !== null) return
    rafId = window.requestAnimationFrame(() => {
      rafId = null
      const latest = latestRectWorld
      if (!latest) return
      hitTest(latest, mode)
    })
  }

  const onPointerDown = (event: PointerEvent) => {
    if (!enabled) return
    if (event.button !== 0) return
    if (instance.state.read('spacePressed')) return
    if (!instance.query.isCanvasBackgroundTarget(event.target)) return

    const point = getScreenPoint(event)
    if (!point) return

    mode = getSelectionModeFromEvent(event)
    const wasActive = startPoint !== null
    startPoint = point
    latestRectWorld = null
    isSelecting = false
    activePointerId = event.pointerId
    instance.commands.selection.beginBox(mode)
    if (!wasActive) {
      emitActiveChange()
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!startPoint) return
    if (!isActivePointer(event)) return

    const point = getScreenPoint(event)
    if (!point) return

    const dx = Math.abs(point.x - startPoint.x)
    const dy = Math.abs(point.y - startPoint.y)
    if (!isSelecting && dx < minDragDistance && dy < minDragDistance) {
      return
    }

    event.preventDefault()
    updateBox(point)
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!startPoint) return
    if (!isActivePointer(event)) return

    if (!isSelecting && mode === 'replace') {
      instance.commands.selection.clear()
    }

    reset()
  }

  const onPointerCancel = (event: PointerEvent) => {
    if (!startPoint) return
    if (!isActivePointer(event)) return
    reset()
  }

  const cancel = () => {
    if (!startPoint) {
      cancelPendingRaf()
      return
    }
    reset()
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    watchActive: (listener: () => void) => {
      activeWatchers.add(listener)
      return () => {
        activeWatchers.delete(listener)
      }
    },
    isActive: () => startPoint !== null,
    getPointerId: () => activePointerId,
    cancel
  }
}
