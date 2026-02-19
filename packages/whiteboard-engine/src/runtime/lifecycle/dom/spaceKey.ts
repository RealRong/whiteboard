import type { DomBindings } from '../../../host/dom'

type Options = {
  dom: DomBindings
  setSpacePressed: (pressed: boolean) => void
}

export const bindSpaceKey = ({ dom, setSpacePressed }: Options) => {
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
