import { useKeyedView } from '../../../runtime/hooks'
import type { EdgeId } from '@whiteboard/core/types'
import type { EdgeView } from '../../../runtime/instance/view/edge'
import { useInternalInstance as useInstance } from '../../../runtime/hooks'

export const useEdgeView = (
  edgeId: EdgeId | undefined
) => {
  const instance = useInstance()
  return useKeyedView(instance.view.edge, edgeId)
}
