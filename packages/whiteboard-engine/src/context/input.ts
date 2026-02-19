import type { ViewportApi } from '@engine-types/instance/runtime'
import type {
  PointerInput,
  PointerModifiers
} from './types'

export const readPointerModifiers = (
  event: Pick<PointerEvent, 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey'>
): PointerModifiers => ({
  alt: event.altKey,
  shift: event.shiftKey,
  ctrl: event.ctrlKey,
  meta: event.metaKey
})

export const toPointerInput = (
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
    button: event.button as 0 | 1 | 2,
    client,
    screen,
    world,
    modifiers: readPointerModifiers(event)
  }
}
