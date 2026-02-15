import type { Instance } from '@engine-types/instance'

type Options = {
  events: Instance['runtime']['events']
  setSpacePressed: (pressed: boolean) => void
}

export const bindSpaceKey = ({ events, setSpacePressed }: Options) => {
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

  const offKeyDown = events.onWindow('keydown', handleKeyDown)
  const offKeyUp = events.onWindow('keyup', handleKeyUp)

  return () => {
    offKeyDown()
    offKeyUp()
  }
}
