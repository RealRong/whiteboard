import type { Tool } from '../instance/types'
import { useInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useTool = (): Tool => {
  const instance = useInstance()
  return useStoreValue(instance.state.tool)
}
