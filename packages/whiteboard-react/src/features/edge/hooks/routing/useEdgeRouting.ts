import { useEffect } from 'react'
import { useInternalInstance as useInstance, useView } from '../../../../runtime/hooks'
import { useWindowPointerSession } from '../../../../runtime/interaction/useWindowPointerSession'

export const useEdgeRouting = () => {
  const instance = useInstance()
  const runtime = instance.interaction.edgeRouting
  const pointerId = useView(runtime.pointer)

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
    cancelRoutingSession: runtime.cancel,
    handleEdgePathPointerDown: runtime.handleEdgePathPointerDown,
    handleRoutingPointerDown: runtime.handleRoutingPointerDown,
    handleRoutingKeyDown: runtime.handleRoutingKeyDown
  }
}
