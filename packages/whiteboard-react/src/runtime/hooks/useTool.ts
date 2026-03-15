import type { EditorTool } from '../instance/types'
import { useInternalInstance } from './useInstance'
import { useView } from './useView'

export const useTool = (): EditorTool => {
  const instance = useInternalInstance()
  return useView(instance.view.tool)
}
