import { useEffect } from 'react'
import { useInstance } from '../../common/hooks'
import { useEdgeConnectState } from '../hooks'

export const useEdgeConnectLifecycle = () => {
  const instance = useInstance()
  const edgeConnectState = useEdgeConnectState()
  const { state, screenToWorld, containerRef } = edgeConnectState

  useEffect(() => {
    if (!state.isConnecting) return
    if (!screenToWorld || !containerRef?.current) return
    const handlePointerMove = (event: PointerEvent) => {
      if (state.pointerId !== undefined && state.pointerId !== null && event.pointerId !== state.pointerId) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      instance.api.edgeConnect.updateTo(screenToWorld(point))
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (state.pointerId !== undefined && state.pointerId !== null && event.pointerId !== state.pointerId) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      instance.api.edgeConnect.commitTo(screenToWorld(point))
    }
    const offMove = instance.addWindowEventListener('pointermove', handlePointerMove)
    const offUp = instance.addWindowEventListener('pointerup', handlePointerUp)
    return () => {
      offMove()
      offUp()
    }
  }, [containerRef, instance, screenToWorld, state.isConnecting, state.pointerId])
}
