import type { SelectionState } from '../view/selection'
import { useInternalInstance } from './useInstance'
import { useView } from './useView'

export const useSelection = (): SelectionState => {
  const instance = useInternalInstance()
  return useView(instance.view.selection)
}
