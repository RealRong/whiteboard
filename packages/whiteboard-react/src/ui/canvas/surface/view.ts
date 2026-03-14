import { useInternalInstance, useViewArgs } from '../../../runtime/hooks'
import type { SurfaceView } from '../../../runtime/view'

export const useSurfaceView = ({
  containerWidth,
  containerHeight
}: {
  containerWidth: number
  containerHeight: number
}): SurfaceView => {
  const instance = useInternalInstance()
  return useViewArgs(instance.view.surface, {
    containerWidth,
    containerHeight
  })
}
