import { useAtomValue } from 'jotai'
import { instanceAtom } from '@whiteboard/engine'

export const useInstance = () => {
  const instance = useAtomValue(instanceAtom)
  if (!instance) {
    throw new Error('Whiteboard instance is not initialized')
  }
  return instance
}
