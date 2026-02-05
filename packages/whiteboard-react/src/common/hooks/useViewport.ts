import { useCallback, useMemo } from 'react'
import type { Point, Viewport } from '@whiteboard/core'

const DEFAULT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

type Size = { width: number; height: number }

export const useViewport = (viewport: Viewport | undefined, size: Size) => {
  const actual = viewport ?? DEFAULT_VIEWPORT
  const screenCenter = useMemo(
    () => ({ x: size.width / 2, y: size.height / 2 }),
    [size.width, size.height]
  )

  const worldToScreen = useCallback(
    (point: Point) => ({
      x: (point.x - actual.center.x) * actual.zoom + screenCenter.x,
      y: (point.y - actual.center.y) * actual.zoom + screenCenter.y
    }),
    [actual.center.x, actual.center.y, actual.zoom, screenCenter.x, screenCenter.y]
  )

  const screenToWorld = useCallback(
    (point: Point) => ({
      x: (point.x - screenCenter.x) / actual.zoom + actual.center.x,
      y: (point.y - screenCenter.y) / actual.zoom + actual.center.y
    }),
    [actual.center.x, actual.center.y, actual.zoom, screenCenter.x, screenCenter.y]
  )

  const transformStyle = useMemo(
    () => ({
      transform: `translate(${screenCenter.x}px, ${screenCenter.y}px) scale(${actual.zoom}) translate(${-actual.center.x}px, ${-actual.center.y}px)`,
      transformOrigin: '0 0'
    }),
    [actual.center.x, actual.center.y, actual.zoom, screenCenter.x, screenCenter.y]
  )

  return {
    viewport: actual,
    screenCenter,
    containerSize: size,
    transformStyle,
    screenToWorld,
    worldToScreen
  }
}
