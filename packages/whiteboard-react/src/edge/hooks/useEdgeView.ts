import { useKeyedView } from '../../common/hooks'
import type { EdgeId } from '@whiteboard/core/types'
import type { EdgeView } from '../../common/instance/view/edge'
import { useInternalInstance as useInstance } from '../../common/hooks'

export const useEdgeView = (
  edgeId: EdgeId | undefined
) => {
  const instance = useInstance()
  return useKeyedView(instance.view.edge, edgeId)
}
