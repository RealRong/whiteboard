import { useMemo, type CSSProperties } from 'react'
import type { Viewport } from '@whiteboard/core/types'
import { useInternalInstance } from '../hooks/useInstance'
import { useStoreValue } from '../hooks/useStoreValue'

const useViewportSnapshot = () => {
  const instance = useInternalInstance()
  return useStoreValue(instance.viewport)
}

export const useViewport = (): Readonly<Viewport> => useViewportSnapshot()

export const useViewportZoom = (): number => {
  const viewport = useViewportSnapshot()
  return viewport.zoom
}

export const useViewportTransformStyle = (): CSSProperties => {
  const viewport = useViewportSnapshot()

  return useMemo(
    () => ({
      transform: `translate(50%, 50%) scale(${viewport.zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
      transformOrigin: '0 0',
      '--wb-zoom': `${viewport.zoom}`
    } as CSSProperties),
    [viewport]
  )
}
