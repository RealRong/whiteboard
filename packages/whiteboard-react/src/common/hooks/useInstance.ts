import { useAtomValue } from 'jotai'
import { instanceAtom } from '../state/whiteboardInputAtoms'

type Options = {
  required?: boolean
}

export const useInstance = (options: Options = {}) => {
  const instance = useAtomValue(instanceAtom)
  const required = options.required ?? true
  if (!instance && required) {
    throw new Error('Whiteboard instance is not initialized')
  }
  return instance
}
