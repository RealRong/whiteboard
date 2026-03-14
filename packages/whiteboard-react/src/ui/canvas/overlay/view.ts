import { useInternalInstance, useView } from '../../../runtime/hooks'
import type { InternalWhiteboardInstance } from '../../../runtime/instance'

type OverlayView = ReturnType<InternalWhiteboardInstance['view']['overlay']['get']>

export const useOverlayView = (): OverlayView => {
  const instance = useInternalInstance()
  return useView(instance.view.overlay)
}
