import type { SelectionState } from '../view/selection'
import { useInternalInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useSelection = (): SelectionState => {
  const instance = useInternalInstance()
  return useStoreValue(instance.view.selection)
}
