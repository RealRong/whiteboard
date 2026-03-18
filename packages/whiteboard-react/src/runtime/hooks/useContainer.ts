import type { Container } from '../container'
import { useInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useContainer = (): Container => {
  const instance = useInstance()
  return useStoreValue(instance.state.container)
}
