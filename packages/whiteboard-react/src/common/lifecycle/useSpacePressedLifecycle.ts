import { useEffect } from 'react'
import { useInstance } from '../hooks/useInstance'

export const useSpacePressedLifecycle = () => {
  const instance = useInstance()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        instance.api.keyboard.setSpacePressed(true)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        instance.api.keyboard.setSpacePressed(false)
      }
    }
    const offKeyDown = instance.addWindowEventListener('keydown', onKeyDown)
    const offKeyUp = instance.addWindowEventListener('keyup', onKeyUp)
    return () => {
      offKeyDown()
      offKeyUp()
    }
  }, [instance])
}
