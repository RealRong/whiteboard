import { useEffect, useRef, type RefObject } from 'react'
import type { createStore } from 'jotai/vanilla'
import type { Viewport } from '@whiteboard/core/types'
import { interactionLock, type InteractionLockToken } from '../common/interaction/interactionLock'
import { createRafTask } from '../common/utils/rafTask'
import {
  applyScreenPan,
  applyWheelInput,
  copyContainerRect,
  EMPTY_CONTAINER_RECT,
  isSameContainerRect,
  normalizeViewportLimits,
  type ContainerRect,
  type WheelInput
} from './logic'
import {
  createViewportCore,
  type ViewportCore,
  type WhiteboardViewport
} from './core'

export type ViewportBindingOptions = {
  panEnabled: boolean
  wheelEnabled: boolean
  minZoom: number
  maxZoom: number
  wheelSensitivity: number
}

type PanState = {
  pointerId: number
  lastX: number
  lastY: number
  viewport: Viewport
  captureTarget: HTMLDivElement | null
}

const DEFAULT_OPTIONS: ViewportBindingOptions = {
  panEnabled: true,
  wheelEnabled: true,
  minZoom: 0.1,
  maxZoom: 4,
  wheelSensitivity: 0.001
}

const isTextInputElement = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false
  if (target.closest('textarea,select,[contenteditable]:not([contenteditable="false"])')) {
    return true
  }
  if (!(target instanceof HTMLInputElement)) return false
  const type = (target.type || 'text').toLowerCase()
  return (
    type === 'text'
    || type === 'search'
    || type === 'email'
    || type === 'url'
    || type === 'tel'
    || type === 'password'
    || type === 'number'
    || type === 'date'
    || type === 'datetime-local'
    || type === 'month'
    || type === 'time'
    || type === 'week'
  )
}

const normalizeBindingOptions = (
  options: ViewportBindingOptions
): ViewportBindingOptions => {
  const limits = normalizeViewportLimits({
    minZoom: options.minZoom,
    maxZoom: options.maxZoom
  })

  return {
    panEnabled: Boolean(options.panEnabled),
    wheelEnabled: Boolean(options.wheelEnabled),
    minZoom: limits.minZoom,
    maxZoom: limits.maxZoom,
    wheelSensitivity: Math.max(0, options.wheelSensitivity)
  }
}

export const useViewportController = ({
  uiStore,
  containerRef,
  options
}: {
  uiStore: ReturnType<typeof createStore>
  containerRef: RefObject<HTMLDivElement | null>
  options: ViewportBindingOptions
}): WhiteboardViewport => {
  const coreRef = useRef<ViewportCore | null>(null)
  if (!coreRef.current) {
    coreRef.current = createViewportCore({
      store: uiStore
    })
  }
  const core = coreRef.current

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const policy = normalizeBindingOptions({
      ...DEFAULT_OPTIONS,
      ...options
    })

    core.setLimits({
      minZoom: policy.minZoom,
      maxZoom: policy.maxZoom
    })

    let containerRect = copyContainerRect(EMPTY_CONTAINER_RECT)
    let pan: PanState | null = null
    let lockToken: InteractionLockToken | null = null
    let pendingWheelInput: WheelInput | null = null
    let spacePressed = false

    const updateContainerRect = (rect: ContainerRect) => {
      if (isSameContainerRect(containerRect, rect)) return
      containerRect = copyContainerRect(rect)
      core.setRect(containerRect)
    }

    const refreshContainerRect = () => {
      updateContainerRect(element.getBoundingClientRect())
    }

    refreshContainerRect()

    const clearPan = (pointerId?: number) => {
      if (!pan) {
        if (lockToken) {
          interactionLock.release(uiStore, lockToken)
          lockToken = null
        }
        return
      }
      if (pointerId !== undefined && pan.pointerId !== pointerId) return
      const captureTarget = pan.captureTarget
      if (captureTarget) {
        try {
          captureTarget.releasePointerCapture(pan.pointerId)
        } catch {
          // Ignore pointer release failures.
        }
      }
      pan = null
      if (lockToken) {
        interactionLock.release(uiStore, lockToken)
        lockToken = null
      }
    }

    const clearWheelFrame = () => {
      pendingWheelInput = null
      wheelTask.cancel()
    }

    const flushWheel = () => {
      const input = pendingWheelInput
      if (!input) return
      pendingWheelInput = null
      if (!policy.wheelEnabled) return
      refreshContainerRect()
      core.viewport.set(
        applyWheelInput({
          viewport: core.viewport.get(),
          input,
          rect: containerRect,
          limits: {
            minZoom: policy.minZoom,
            maxZoom: policy.maxZoom
          },
          wheelSensitivity: policy.wheelSensitivity
        })
      )
    }
    const wheelTask = createRafTask(flushWheel)

    const scheduleWheel = (input: WheelInput) => {
      if (pendingWheelInput) {
        pendingWheelInput.deltaX += input.deltaX
        pendingWheelInput.deltaY += input.deltaY
        pendingWheelInput.clientX = input.clientX
        pendingWheelInput.clientY = input.clientY
        pendingWheelInput.ctrlKey = pendingWheelInput.ctrlKey || input.ctrlKey
        pendingWheelInput.metaKey = pendingWheelInput.metaKey || input.metaKey
      } else {
        pendingWheelInput = { ...input }
      }

      wheelTask.schedule()
    }

    const onWheel = (event: WheelEvent) => {
      if (!policy.wheelEnabled) return
      if (isTextInputElement(event.target)) return
      refreshContainerRect()
      scheduleWheel({
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        clientX: event.clientX,
        clientY: event.clientY
      })
      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!pan || event.pointerId !== pan.pointerId) return
      const deltaX = event.clientX - pan.lastX
      const deltaY = event.clientY - pan.lastY
      if (deltaX === 0 && deltaY === 0) return
      pan.lastX = event.clientX
      pan.lastY = event.clientY
      pan.viewport = applyScreenPan(pan.viewport, {
        x: -deltaX,
        y: -deltaY
      })
      core.viewport.set(pan.viewport)
      if (event.cancelable) {
        event.preventDefault()
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      if (!pan || event.pointerId !== pan.pointerId) return
      clearPan(pan.pointerId)
      if (event.cancelable) {
        event.preventDefault()
      }
    }

    const onPointerCancel = (event: PointerEvent) => {
      if (!pan || event.pointerId !== pan.pointerId) return
      clearPan(pan.pointerId)
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!policy.panEnabled) return
      const middleDrag = event.button === 1 || (event.buttons & 4) === 4
      const leftDrag = (event.button === 0 || (event.buttons & 1) === 1) && spacePressed
      if (!middleDrag && !leftDrag) return

      const nextLock = interactionLock.tryAcquire(uiStore, 'viewportGesture', event.pointerId)
      if (!nextLock) return
      lockToken = nextLock

      refreshContainerRect()
      clearWheelFrame()
      pan = {
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
        viewport: core.viewport.get() as Viewport,
        captureTarget: element
      }
      try {
        element.setPointerCapture(event.pointerId)
      } catch {
        // Ignore pointer capture failures.
      }
      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onBlur = () => {
      spacePressed = false
      clearPan()
      clearWheelFrame()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (isTextInputElement(event.target)) return
      spacePressed = true
      event.preventDefault()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spacePressed = false
      if (!isTextInputElement(event.target)) {
        event.preventDefault()
      }
    }

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
        refreshContainerRect()
      })

    if (observer) {
      observer.observe(element)
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('pointerdown', onPointerDown, { capture: true })
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerCancel)
      window.addEventListener('blur', onBlur)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
    }

    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('pointerdown', onPointerDown, { capture: true })
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerCancel)
        window.removeEventListener('blur', onBlur)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
      }
      observer?.disconnect()
      clearPan()
      clearWheelFrame()
      spacePressed = false
    }
  }, [containerRef, core, options, uiStore])

  return core.viewport
}
