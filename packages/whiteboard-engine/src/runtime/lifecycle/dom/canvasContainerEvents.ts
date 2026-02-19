import type { DomBindings } from '../../../host/dom'
import type { CanvasEventHandlers } from '../input/types'

type Options = {
  dom: DomBindings
  handlers: CanvasEventHandlers
  onWheel: (event: WheelEvent) => void
}

export const bindCanvasContainerEvents = ({ dom, handlers, onWheel }: Options) => {
  const offPointerDownCapture = dom.onContainer('pointerdown', (event) => handlers.handlePointerDownCapture(event), true)
  const offPointerDown = dom.onContainer('pointerdown', (event) => handlers.handlePointerDown(event))
  const offPointerMove = dom.onContainer('pointermove', (event) => handlers.handlePointerMove(event))
  const offPointerUp = dom.onContainer('pointerup', (event) => handlers.handlePointerUp(event))
  const offWheel = dom.onContainer('wheel', (event) => onWheel(event), {
    passive: false
  })
  const offKeyDown = dom.onContainer('keydown', (event) => handlers.handleKeyDown(event))

  return () => {
    offPointerDownCapture()
    offPointerDown()
    offPointerMove()
    offPointerUp()
    offWheel()
    offKeyDown()
  }
}
