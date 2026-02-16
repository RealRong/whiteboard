import type { Instance } from '@engine-types/instance'
import type { CanvasEventHandlers } from '../input'

type Options = {
  events: Instance['runtime']['events']
  handlers: CanvasEventHandlers
  onWheel: (event: WheelEvent) => void
}

export const bindCanvasContainerEvents = ({ events, handlers, onWheel }: Options) => {
  const offPointerDownCapture = events.onContainer('pointerdown', (event) => handlers.handlePointerDownCapture(event), true)
  const offPointerDown = events.onContainer('pointerdown', (event) => handlers.handlePointerDown(event))
  const offPointerMove = events.onContainer('pointermove', (event) => handlers.handlePointerMove(event))
  const offPointerUp = events.onContainer('pointerup', (event) => handlers.handlePointerUp(event))
  const offWheel = events.onContainer('wheel', (event) => onWheel(event), {
    passive: false
  })
  const offKeyDown = events.onContainer('keydown', (event) => handlers.handleKeyDown(event))

  return () => {
    offPointerDownCapture()
    offPointerDown()
    offPointerMove()
    offPointerUp()
    offWheel()
    offKeyDown()
  }
}
