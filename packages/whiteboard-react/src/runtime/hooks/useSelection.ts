import type { View } from '../selection'
import { useInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useSelection = (): View => {
  const instance = useInstance()
  return useStoreValue(instance.state.selection)
}
