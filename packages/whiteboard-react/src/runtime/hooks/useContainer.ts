import type { ContainerView } from '../view/container'
import { useInternalInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useContainer = (): ContainerView => {
  const instance = useInternalInstance()
  return useStoreValue(instance.view.container)
}
