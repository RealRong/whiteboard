import type { ScopeView } from '../view/scope'
import { useInternalInstance } from './useInstance'
import { useView } from './useView'

export const useScope = (): ScopeView => {
  const instance = useInternalInstance()
  return useView(instance.view.scope)
}
