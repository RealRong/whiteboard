import type { NodeId } from '@whiteboard/core/types'
import type { MindmapViewTree } from '@whiteboard/engine'
import { useInternalInstance } from './useInstance'
import { useKeyedView } from './useView'

export const useMindmap = (
  treeId: NodeId | undefined
): MindmapViewTree | undefined => {
  const instance = useInternalInstance()
  return useKeyedView(instance.view.mindmap, treeId)
}
