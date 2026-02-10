import { useEffect } from 'react'
import { useInstance } from '../../common/hooks'
import { useEdgeConnectLayerState } from '../hooks'

export const useEdgeConnectLifecycle = () => {
  const instance = useInstance()
  const { state } = useEdgeConnectLayerState()
  const clientToScreen = instance.runtime.viewport.clientToScreen
  const screenToWorld = instance.runtime.viewport.screenToWorld

  useEffect(() => {
    if (!state.isConnecting) return

    const toWorld = (event: PointerEvent) => screenToWorld(clientToScreen(event.clientX, event.clientY))

    const handlePointerMove = (event: PointerEvent) => {
      if (state.pointerId !== undefined && state.pointerId !== null && event.pointerId !== state.pointerId) return
      instance.commands.edgeConnect.updateTo(toWorld(event))
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (state.pointerId !== undefined && state.pointerId !== null && event.pointerId !== state.pointerId) return
      instance.commands.edgeConnect.commitTo(toWorld(event))
    }
    const offMove = instance.runtime.events.onWindow('pointermove', handlePointerMove)
    const offUp = instance.runtime.events.onWindow('pointerup', handlePointerUp)
    return () => {
      offMove()
      offUp()
    }
  }, [clientToScreen, instance, screenToWorld, state.isConnecting, state.pointerId])
}
