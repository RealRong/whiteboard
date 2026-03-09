import { useMemo, useSyncExternalStore } from 'react'
import type { Viewport } from '@whiteboard/core/types'
import { useInstance } from './useInstance'

const FALLBACK_ZOOM = 1

export const useViewport = (): Readonly<Viewport> => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => instance.viewport.subscribe(listener),
    [instance]
  )

  const getSnapshot = useMemo(
    () => () => instance.viewport.getCommitted(),
    [instance]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export const useViewportZoom = (): number => {
  const instance = useInstance()

  const subscribe = useMemo(
    () => (listener: () => void) => instance.viewport.subscribe(listener),
    [instance]
  )

  const getSnapshot = useMemo(
    () => () => instance.viewport.getCommitted().zoom,
    [instance]
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => FALLBACK_ZOOM)
}
