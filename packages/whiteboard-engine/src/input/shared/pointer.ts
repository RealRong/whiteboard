import type { PointerInput } from '@engine-types/common'
import type { ViewportApi } from '@engine-types/instance/runtime'
import type { PointerInputEvent } from '@engine-types/input'

export const normalizePointerButton = (button: number): 0 | 1 | 2 => {
  if (button === 1 || button === 2) return button
  return 0
}

export const normalizePointerType = (
  pointerType: string
): PointerInputEvent['pointerType'] => {
  if (pointerType === 'mouse') return 'mouse'
  if (pointerType === 'pen') return 'pen'
  if (pointerType === 'touch') return 'touch'
  return 'unknown'
}

export const readPointerModifiers = (
  event: Pick<PointerEvent, 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>
) => ({
  alt: event.altKey,
  shift: event.shiftKey,
  ctrl: event.ctrlKey,
  meta: event.metaKey
})

export const toPointerInputFromDomEvent = (
  viewport: Pick<ViewportApi, 'clientToScreen' | 'clientToWorld'>,
  event: PointerEvent
): PointerInput => {
  const client = {
    x: event.clientX,
    y: event.clientY
  }
  const screen = viewport.clientToScreen(event.clientX, event.clientY)
  const world = viewport.clientToWorld(event.clientX, event.clientY)

  return {
    pointerId: event.pointerId,
    button: normalizePointerButton(event.button),
    client,
    screen,
    world,
    modifiers: readPointerModifiers(event)
  }
}

export const toPointerInputFromEvent = (
  event: {
    pointerId: number
    button: number
    client: { x: number; y: number }
    screen: { x: number; y: number }
    modifiers: {
      alt: boolean
      shift: boolean
      ctrl: boolean
      meta: boolean
    }
  },
  screenToWorld: (point: { x: number; y: number }) => { x: number; y: number }
): PointerInput => ({
  pointerId: event.pointerId,
  button: normalizePointerButton(event.button),
  client: event.client,
  screen: event.screen,
  world: screenToWorld(event.screen),
  modifiers: {
    alt: event.modifiers.alt,
    shift: event.modifiers.shift,
    ctrl: event.modifiers.ctrl,
    meta: event.modifiers.meta
  }
})
