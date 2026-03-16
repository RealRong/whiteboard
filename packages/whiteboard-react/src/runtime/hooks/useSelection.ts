import type { Selection } from '../state'
import { useInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useSelection = (): Selection => {
  const instance = useInstance()
  return useStoreValue(instance.state.selection)
}
