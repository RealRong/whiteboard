import type { Tool } from '../instance'
import { useWhiteboard } from './useWhiteboard'
import { useStoreValue } from './useStoreValue'

export const useTool = (): Tool => {
  const instance = useWhiteboard()
  return useStoreValue(instance.state.tool)
}
