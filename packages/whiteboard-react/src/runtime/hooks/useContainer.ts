import type { ContainerView } from '../view/container'
import { useInternalInstance } from './useInstance'
import { useView } from './useView'

export const useContainer = (): ContainerView => {
  const instance = useInternalInstance()
  return useView(instance.view.container)
}
