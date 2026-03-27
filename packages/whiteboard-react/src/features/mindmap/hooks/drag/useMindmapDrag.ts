import {
  createMindmapDragSession
} from '@whiteboard/editor'
import { useEffect, useRef } from 'react'
import { useInternalInstance } from '../../../../runtime/hooks'

export const useMindmapDrag = () => {
  const instance = useInternalInstance()
  const controllerRef = useRef<ReturnType<typeof createMindmapDragSession> | null>(null)
  const controller =
    controllerRef.current
    ?? (controllerRef.current = createMindmapDragSession(instance))

  useEffect(() => () => {
    controller.cancel()
  }, [controller])

  return {
    down: controller.down
  }
}
