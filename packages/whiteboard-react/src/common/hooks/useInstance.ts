import { useAtomValue } from 'jotai'
import { instanceAtom } from '../state/whiteboardInputAtoms'

export const useInstance = () => {
  const instance = useAtomValue(instanceAtom)
  if (!instance) {
    throw new Error('Whiteboard instance is not initialized')
  }
  return instance
}
