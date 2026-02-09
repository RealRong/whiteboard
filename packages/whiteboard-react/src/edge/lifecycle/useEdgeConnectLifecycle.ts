import { useEffect } from 'react'
import { useInstance } from '../../common/hooks'
import { useEdgeConnectLayerState } from '../hooks'

export const useEdgeConnectLifecycle = () => {
  const instance = useInstance()
  const { state } = useEdgeConnectLayerState()
  const containerRef = instance.runtime.containerRef
  const screenToWorld = instance.runtime.viewport.screenToWorld

  useEffect(() => {
    if (!state.isConnecting) return
    if (!screenToWorld || !containerRef?.current) return
    const handlePointerMove = (event: PointerEvent) => {
      if (state.pointerId !== undefined && state.pointerId !== null && event.pointerId !== state.pointerId) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      instance.commands.edgeConnect.updateTo(screenToWorld(point))
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (state.pointerId !== undefined && state.pointerId !== null && event.pointerId !== state.pointerId) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      instance.commands.edgeConnect.commitTo(screenToWorld(point))
    }
    const offMove = instance.runtime.events.onWindow('pointermove', handlePointerMove)
    const offUp = instance.runtime.events.onWindow('pointerup', handlePointerUp)
    return () => {
      offMove()
      offUp()
    }
  }, [containerRef, instance, screenToWorld, state.isConnecting, state.pointerId])
}
