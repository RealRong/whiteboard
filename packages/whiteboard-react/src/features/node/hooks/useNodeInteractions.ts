import { useEffect } from 'react'
import { useInternalInstance as useInstance, useView } from '../../../runtime/hooks'
import { useWindowPointerSession } from '../../../runtime/interaction/useWindowPointerSession'

export const useNodeInteractions = () => {
  const instance = useInstance()
  const runtime = instance.interaction.node
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
    cancelNodeInteractionSession: runtime.cancel,
    handleNodeDoubleClick: runtime.handleNodeDoubleClick,
    handleNodePointerDown: runtime.handleNodePointerDown,
    handleTransformPointerDown: runtime.handleTransformPointerDown
  }
}
