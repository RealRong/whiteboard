import { useEffect } from 'react'
import { useInternalInstance, useView } from '../../../runtime/hooks'
import { useWindowPointerSession } from '../../../runtime/interaction/useWindowPointerSession'

export const useSelectionBoxInteraction = () => {
  const instance = useInternalInstance()
  const runtime = instance.interaction.selection
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
    cancelSelectionSession: runtime.cancel,
    handleContainerPointerDown: runtime.handleContainerPointerDown
  }
}
