import { useEffect } from 'react'
import type { RefObject } from 'react'
import { useInternalInstance as useInstance, useTool, useView } from '../../../../runtime/hooks'
import { useWindowPointerSession } from '../../../../runtime/interaction/useWindowPointerSession'

export const useEdgeConnect = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInstance()
  const runtime = instance.interaction.edgeConnect
  const tool = useTool()
  const pointerId = useView(runtime.pointer)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handlePointerDown = (event: PointerEvent) => {
      runtime.handleContainerPointerDown(event, container)
    }
    const handlePointerMove = (event: PointerEvent) => {
      runtime.handleContainerPointerMove(event)
    }
    const handlePointerLeave = () => {
      runtime.handleContainerPointerLeave()
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      runtime.handleContainerPointerLeave()
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [containerRef, runtime])

  useEffect(() => {
    if (tool !== 'edge') {
      runtime.cancel()
    }
  }, [runtime, tool])

  useWindowPointerSession({
    pointerId,
    onPointerMove: runtime.onWindowPointerMove,
    onPointerUp: runtime.onWindowPointerUp,
    onPointerCancel: runtime.onWindowPointerCancel,
    onBlur: runtime.onWindowBlur,
    onKeyDown: runtime.onWindowKeyDown
  })

  useEffect(() => () => {
    runtime.cancel()
  }, [runtime])

  return {
    cancelConnectSession: runtime.cancel
  }
}
