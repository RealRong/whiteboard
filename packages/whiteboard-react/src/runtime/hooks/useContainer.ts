import type { Container } from '../container'
import { useWhiteboard } from './useWhiteboard'
import { useStoreValue } from './useStoreValue'

export const useContainer = (): Container => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.container)
}
