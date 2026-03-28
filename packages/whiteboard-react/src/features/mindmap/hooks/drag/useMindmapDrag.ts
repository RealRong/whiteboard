import { useEffect, useRef } from 'react'
import { useInternalInstance } from '../../../../runtime/hooks'

export const useMindmapDrag = () => {
  const instance = useInternalInstance()
  const controllerRef = useRef(instance.host.mindmap.controller)
  const controller = controllerRef.current

  useEffect(() => () => {
    controller.cancel()
  }, [controller])

  return {
    down: controller.down
  }
}
