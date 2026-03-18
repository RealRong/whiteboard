import type { EditTarget } from '../edit'
import { useWhiteboard } from './useWhiteboard'
import { useStoreValue } from './useStoreValue'

export const useEdit = (): EditTarget => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.edit)
}
