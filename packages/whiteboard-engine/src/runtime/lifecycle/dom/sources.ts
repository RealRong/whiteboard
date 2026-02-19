import type { DomBindings } from '../../../host/dom'
import type { CanvasEventHandlers } from '../input/types'

type CanvasContainerOptions = {
  dom: DomBindings
  handlers: CanvasEventHandlers
  onWheel: (event: WheelEvent) => void
}

export const bindCanvasContainerEvents = ({
  dom,
  handlers,
  onWheel
}: CanvasContainerOptions) => {
  const offPointerDownCapture = dom.onContainer(
    'pointerdown',
    (event) => handlers.handlePointerDownCapture(event),
    true
  )
  const offPointerDown = dom.onContainer('pointerdown', (event) =>
    handlers.handlePointerDown(event)
  )
  const offPointerMove = dom.onContainer('pointermove', (event) =>
    handlers.handlePointerMove(event)
  )
  const offPointerUp = dom.onContainer('pointerup', (event) =>
    handlers.handlePointerUp(event)
  )
  const offWheel = dom.onContainer('wheel', (event) => onWheel(event), {
    passive: false
  })
  const offKeyDown = dom.onContainer('keydown', (event) =>
    handlers.handleKeyDown(event)
  )

  return () => {
    offPointerDownCapture()
    offPointerDown()
    offPointerMove()
    offPointerUp()
    offWheel()
    offKeyDown()
  }
}

type SpaceKeyOptions = {
  dom: DomBindings
  setSpacePressed: (pressed: boolean) => void
}

export const bindSpaceKey = ({ dom, setSpacePressed }: SpaceKeyOptions) => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space') return
    event.preventDefault()
    setSpacePressed(true)
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space') return
    event.preventDefault()
    setSpacePressed(false)
  }

  const offKeyDown = dom.onWindow('keydown', handleKeyDown)
  const offKeyUp = dom.onWindow('keyup', handleKeyUp)

  return () => {
    offKeyDown()
    offKeyUp()
  }
}
