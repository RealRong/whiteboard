import type { Point, Viewport } from '../types'

export const viewportScreenToWorld = (
  point: Point,
  viewport: Viewport,
  screenCenter: Point
): Point => ({
  x: (point.x - screenCenter.x) / viewport.zoom + viewport.center.x,
  y: (point.y - screenCenter.y) / viewport.zoom + viewport.center.y
})

export const viewportWorldToScreen = (
  point: Point,
  viewport: Viewport,
  screenCenter: Point
): Point => ({
  x: (point.x - viewport.center.x) * viewport.zoom + screenCenter.x,
  y: (point.y - viewport.center.y) * viewport.zoom + screenCenter.y
})

export const panViewport = (
  viewport: Viewport,
  delta: Point
): Viewport => ({
  center: {
    x: viewport.center.x + delta.x,
    y: viewport.center.y + delta.y
  },
  zoom: viewport.zoom
})

export const zoomViewport = (
  viewport: Viewport,
  factor: number,
  anchor?: Point
): Viewport => {
  if (!anchor) {
    return {
      center: viewport.center,
      zoom: viewport.zoom * factor
    }
  }

  return {
    center: {
      x: anchor.x - (anchor.x - viewport.center.x) / factor,
      y: anchor.y - (anchor.y - viewport.center.y) / factor
    },
    zoom: viewport.zoom * factor
  }
}

export const isSameViewport = (
  left: Viewport,
  right: Viewport
) =>
  left.zoom === right.zoom
  && left.center.x === right.center.x
  && left.center.y === right.center.y
