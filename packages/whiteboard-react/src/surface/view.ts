import { useInternalInstance, useViewArgs } from '../common/hooks'
import type { SurfaceView } from '../common/instance/view'

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
