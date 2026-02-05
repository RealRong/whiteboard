import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { spacePressedAtom } from '../state/whiteboardAtoms'
import { useInstance } from '../hooks/useInstance'

export const useSpacePressedLifecycle = () => {
  const instance = useInstance()
  const setSpacePressed = useSetAtom(spacePressedAtom)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setSpacePressed(true)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setSpacePressed(false)
      }
    }
    const offKeyDown = instance.addWindowEventListener('keydown', onKeyDown)
    const offKeyUp = instance.addWindowEventListener('keyup', onKeyUp)
    return () => {
      offKeyDown()
      offKeyUp()
    }
  }, [instance, setSpacePressed])
}
