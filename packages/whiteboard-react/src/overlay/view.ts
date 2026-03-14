import { useInternalInstance, useView } from '../common/hooks'
import type { InternalWhiteboardInstance } from '../common/instance'

type OverlayView = ReturnType<InternalWhiteboardInstance['view']['overlay']['get']>

export const useOverlayView = (): OverlayView => {
  const instance = useInternalInstance()
  return useView(instance.view.overlay)
}
