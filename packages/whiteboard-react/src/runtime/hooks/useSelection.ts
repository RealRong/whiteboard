import type { View } from '../selection'
import { useWhiteboard } from './useWhiteboard'
import { useStoreValue } from './useStoreValue'

export const useSelection = (): View => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.selection)
}
