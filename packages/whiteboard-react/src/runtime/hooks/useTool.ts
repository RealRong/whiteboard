import type { EditorTool } from '../instance/types'
import { useInternalInstance } from './useInstance'
import { useStoreValue } from './useStoreValue'

export const useTool = (): EditorTool => {
  const instance = useInternalInstance()
  return useStoreValue(instance.view.tool)
}
