import { useEffect, type RefObject } from 'react'
import type { InternalInstance } from '../instance'
import { createRafTask } from '../utils/rafTask'
import type { ContainerRect, WheelInput } from './logic'

export type ViewportInputOptions = {
  panEnabled: boolean
  wheelEnabled: boolean
  wheelSensitivity: number
}

type PanState = {
  lastX: number
  lastY: number
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

const isIgnoredPointerTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('[data-input-ignore]'))

const readContainerRect = (
  element: HTMLDivElement
): ContainerRect => {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  }
}

export const useBindViewportInput = ({
  instance,
  containerRef,
  options
}: {
  instance: InternalInstance
  containerRef: RefObject<HTMLDivElement | null>
  options: ViewportInputOptions
}) => {
  useEffect(() => {
    const element = containerRef.current
    if (!element) {
      return
    }
    const viewport = instance.internals.viewport
    const interaction = instance.interaction

    let pan: PanState | null = null
    let panSession: ReturnType<typeof interaction.start> = null
    let pendingWheelInput: WheelInput | null = null

    const isViewportInputBlocked = () => interaction.mode.get() !== 'idle'

    const refreshContainerRect = () => {
      viewport.setRect(readContainerRect(element))
    }

    refreshContainerRect()

    const clearPan = () => {
      pan = null
      panSession = null
    }

    const clearWheelFrame = () => {
      pendingWheelInput = null
      wheelTask.cancel()
    }

    const flushWheel = () => {
      const input = pendingWheelInput
      if (!input) {
        return
      }

      pendingWheelInput = null
      if (!options.wheelEnabled) {
        return
      }
      if (isViewportInputBlocked()) {
        return
      }

      refreshContainerRect()
      viewport.input.wheel(input, options.wheelSensitivity)
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
      if (!options.wheelEnabled) return
      if (isTextInputElement(event.target)) return

      if (isViewportInputBlocked()) {
        clearWheelFrame()
        if (event.cancelable) {
          event.preventDefault()
        }
        event.stopPropagation()
        return
      }

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

    const onPointerDown = (event: PointerEvent) => {
      if (!options.panEnabled) return
      if (isIgnoredPointerTarget(event.target)) return

      const middleDrag = event.button === 1 || (event.buttons & 4) === 4
      const leftDrag =
        (event.button === 0 || (event.buttons & 1) === 1)
        && (interaction.space.get() || instance.read.tool.is('hand'))
      if (!middleDrag && !leftDrag) return

      const nextSession = interaction.start({
        mode: 'viewport-pan',
        pointerId: event.pointerId,
        capture: element,
        cleanup: clearPan,
        move: (event) => {
          if (!pan) {
            return
          }

          const deltaX = event.clientX - pan.lastX
          const deltaY = event.clientY - pan.lastY
          if (deltaX === 0 && deltaY === 0) {
            return
          }

          pan.lastX = event.clientX
          pan.lastY = event.clientY
          viewport.input.panScreenBy({
            x: -deltaX,
            y: -deltaY
          })

          if (event.cancelable) {
            event.preventDefault()
          }
        },
        up: (event, session) => {
          if (!pan) {
            return
          }

          session.finish()
          if (event.cancelable) {
            event.preventDefault()
          }
        }
      })
      if (!nextSession) return

      refreshContainerRect()
      clearWheelFrame()
      panSession = nextSession
      pan = {
        lastX: event.clientX,
        lastY: event.clientY
      }

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onBlur = () => {
      clearWheelFrame()
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
    element.addEventListener('pointerdown', onPointerDown, true)
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onBlur)
    }

    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('pointerdown', onPointerDown, true)
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onBlur)
      }
      observer?.disconnect()
      panSession?.cancel()
      clearWheelFrame()
    }
  }, [containerRef, instance, options])
}
