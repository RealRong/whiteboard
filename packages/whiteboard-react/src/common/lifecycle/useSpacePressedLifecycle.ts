import { useEffect } from 'react'
import { useInstance } from '../hooks/useInstance'

export const useSpacePressedLifecycle = () => {
  const instance = useInstance()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        instance.commands.keyboard.setSpacePressed(true)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        instance.commands.keyboard.setSpacePressed(false)
      }
    }
    const offKeyDown = instance.runtime.events.onWindow('keydown', onKeyDown)
    const offKeyUp = instance.runtime.events.onWindow('keyup', onKeyUp)
    return () => {
      offKeyDown()
      offKeyUp()
    }
  }, [instance])
}
