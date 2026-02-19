import type { Instance, PointerInput } from '@whiteboard/engine'

type PointerEventLike = {
  pointerId: number
  button: number
  clientX: number
  clientY: number
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export const toPointerInput = (
  instance: Instance,
  event: PointerEventLike
): PointerInput => {
  const client = {
    x: event.clientX,
    y: event.clientY
  }

  return {
    pointerId: event.pointerId,
    button: event.button as 0 | 1 | 2,
    client,
    screen: instance.runtime.viewport.clientToScreen(event.clientX, event.clientY),
    world: instance.runtime.viewport.clientToWorld(event.clientX, event.clientY),
    modifiers: {
      alt: event.altKey,
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey
    }
  }
}
